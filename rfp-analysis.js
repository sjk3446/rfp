/* One source-grounded analysis shared by requirements and business information. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./overview-core.js'),require('./requirement-ai-core.js'));
  else root.ReqlyRfpAnalysis=factory(root.ReqlyOverviewCore,root.ReqlyRequirementAI).createService({
    app:()=>root.ReqlyApp,files:()=>root.ReqlyFiles,portal:()=>root.ReqlyPortal,ai:()=>root.ReqlyPersistentAI,crypto:root.crypto,
    notify:detail=>root.dispatchEvent(new CustomEvent('reqly-rfp-analysis-update',{detail}))
  });
})(typeof globalThis!=='undefined'?globalThis:this,function(overviewCore,requirementCore){
  'use strict';
  const schemaVersion=1,copy=value=>JSON.parse(JSON.stringify(value));
  const error=(code,message)=>Object.assign(new Error(message),{code});
  function validateCombined(response,units,categories){
    if(!Array.isArray(response?.requirements)||!Array.isArray(response?.overview))throw error('INVALID_JSON','RFP 통합 분석 결과의 형식이 올바르지 않습니다.');
    return{requirements:requirementCore.validate({items:response.requirements},units,categories),overview:overviewCore.validate({items:response.overview},units)};
  }
  function createService(env){
    const records=new Map(),preparing=new Map(),running=new Map(),saving=new Map();
    const app=()=>env.app(),key=(projectId,assetId)=>JSON.stringify([projectId,assetId]);
    const isRunning=(projectId,assetId)=>{const cacheKey=key(projectId,assetId);return preparing.has(cacheKey)||running.has(cacheKey)||saving.has(cacheKey);};
    const current=projectId=>app()?.projectId===projectId;
    function assertCurrent(projectId){if(!current(projectId))throw error('STALE_PROJECT','프로젝트가 변경되어 분석 결과를 적용하지 않았습니다.');}
    const timestamp=()=>new Date().toISOString();
    async function hash(text){return [...new Uint8Array(await env.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
    function notify(record){env.notify?.({projectId:record.projectId,assetId:record.assetId});}
    function summarize(record){
      if(record.results?.length){
        const completed=record.results.filter(Boolean),requirements=requirementCore.merge(completed.map(item=>item.requirements)),overview=overviewCore.merge(completed.map(item=>item.overview));
        record.requirements=requirements.items;record.overview=overview.items;record.rejectedRequirements=requirements.rejected;record.rejectedOverview=overview.rejected;
        record.completedBatches=completed.length;
      }
      record.batchCount=record.batches.length;record.totalBatches=record.batchCount;
      record.percent=progress(record);return record;
    }
    function progress(record){
      if(record?.complete)return 100;
      const total=record?.canonicalLength||0;
      const done=(record?.batches||[]).reduce((sum,batch,index)=>sum+(record.results?.[index]?batch.reduce((count,unit)=>count+unit.end-unit.start,0):0),0);
      return total?Math.floor(100*done/total):0;
    }
    function descriptor(unit){return{sourceId:unit.sourceId,label:unit.label,page:unit.page??null,sheet:unit.sheet||'',start:unit.start,end:unit.end};}
    function snapshot(record){
      summarize(record);
      const value={schemaVersion,projectId:record.projectId,assetId:record.assetId,analysisId:record.analysisId,
        sourceName:record.file.name,sourceType:record.sourceType,sourceSize:record.file.size,pages:record.pages,characters:record.characters,
        contentHash:record.contentHash,canonicalLength:record.canonicalLength,
        plan:record.batches.map((units,index)=>({depth:record.depths[index]||0,units:units.map(descriptor)})),
        completedBatches:record.completedBatches,batchCount:record.batchCount,totalBatches:record.batchCount,complete:record.complete,
        model:record.model||'',models:record.models||[],analyzedAt:record.analyzedAt||'',savedAt:record.savedAt||'',splitCount:record.splitCount||0};
      // Keep evidence once: completed analyses need no per-batch duplicate result payload.
      if(record.complete)Object.assign(value,{requirements:record.requirements,overview:record.overview,rejectedRequirements:record.rejectedRequirements,rejectedOverview:record.rejectedOverview});
      else value.batchResults=record.results.map(result=>result||null);
      return copy(value);
    }
    function restore(value,projectId,assetId){
      if(value?.schemaVersion!==schemaVersion||value.projectId!==projectId||value.assetId!==assetId||!Array.isArray(value.plan)||!value.plan.length||!value.contentHash)return null;
      if(value.complete&&(!Array.isArray(value.requirements)||!Array.isArray(value.overview)))return null;
      const record={...copy(value),projectId,assetId,file:{name:value.sourceName,size:value.sourceSize,type:value.sourceType},
        batches:value.plan.map(entry=>entry.units.map(unit=>({...unit,text:''}))),depths:value.plan.map(entry=>entry.depth||0),results:value.complete?[]:copy(value.batchResults||[]),
        requirements:copy(value.requirements||[]),overview:copy(value.overview||[]),rejectedRequirements:value.rejectedRequirements||0,rejectedOverview:value.rejectedOverview||0,
        savedAt:value.savedAt||'',expectedSavedAt:value.savedAt||'',persistError:'',hydrated:false};
      return summarize(record);
    }
    function get(projectId,assetId){
      if(!current(projectId))return null;
      const cacheKey=key(projectId,assetId),saved=app().document?.rfpAnalysisByAsset?.[assetId],record=records.get(cacheKey);
      if(record&&(!saved?.savedAt||saved.savedAt===record.savedAt||running.has(cacheKey)||record.persistError||(record.hydrated&&(!record.savedAt||!record.complete))))return record;
      const restored=restore(saved,projectId,assetId);if(restored){records.set(cacheKey,restored);return restored;}
      return record||null;
    }
    function fresh(projectId,assetId,file,text,pages,contentHash,expectedSavedAt){
      let offset=0;
      const batches=overviewCore.batches(text).map(batch=>batch.map(unit=>{const start=offset;offset+=unit.text.length;return{...unit,start,end:offset};}));
      if(!batches.length)throw new Error('읽을 수 있는 텍스트가 없습니다. 스캔 문서는 OCR 처리된 문서로 올려 주세요.');
      return{schemaVersion,projectId,assetId,analysisId:env.crypto.randomUUID(),file,sourceType:file.name.split('.').pop().toUpperCase(),
        contentHash,pages:pages||0,characters:text.length,canonicalLength:offset,batches,depths:batches.map(()=>0),results:[],requirements:[],overview:[],
        rejectedRequirements:0,rejectedOverview:0,completedBatches:0,batchCount:batches.length,totalBatches:batches.length,complete:false,model:'',models:[],
        analyzedAt:'',savedAt:'',expectedSavedAt:expectedSavedAt||'',percent:0,splitCount:0,persistError:'',hydrated:true};
    }
    function hydrate(record,canonical,categories){
      let offset=0;
      for(const batch of record.batches)for(const unit of batch){
        if(!Number.isInteger(unit.start)||!Number.isInteger(unit.end)||unit.start!==offset||unit.end<=unit.start||unit.end>canonical.length)throw new Error('분석 구간 정보가 원문과 일치하지 않습니다.');
        unit.text=canonical.slice(unit.start,unit.end);offset=unit.end;
      }
      if(offset!==canonical.length)throw new Error('분석 구간이 원문 전체를 포함하지 않습니다.');
      if(record.complete){
        const validated=validateCombined({requirements:record.requirements,overview:record.overview},record.batches.flat(),categories);
        if(validated.requirements.rejected||validated.overview.rejected)throw new Error('저장된 분석 근거가 현재 원문과 일치하지 않습니다.');
      }else for(let i=0;i<record.results.length;i++)if(record.results[i]){
        const result=record.results[i],validated=validateCombined({requirements:result.requirements.items,overview:result.overview.items},record.batches[i],categories);
        if(validated.requirements.rejected||validated.overview.rejected)throw new Error('저장된 분석 근거가 현재 원문과 일치하지 않습니다.');
      }
      record.hydrated=true;return record;
    }
    async function prepare(projectId,assetId,{onProgress=()=>{},force=false}={}){
      assertCurrent(projectId);const cacheKey=key(projectId,assetId),cached=get(projectId,assetId);
      if(running.has(cacheKey))return running.get(cacheKey);
      if(preparing.has(cacheKey))return preparing.get(cacheKey);
      if(cached?.hydrated&&!force)return cached;
      const work=(async()=>{
        env.files().setProject(projectId);const file=await env.files().original(assetId);assertCurrent(projectId);
        const extracted=await env.portal().extractFile(file,{onProgress:value=>{assertCurrent(projectId);onProgress(value);}});assertCurrent(projectId);
        const contentHash=await hash(extracted.text);assertCurrent(projectId);
        const next=fresh(projectId,assetId,file,extracted.text,extracted.pages,contentHash,app().document?.rfpAnalysisByAsset?.[assetId]?.savedAt||'');
        let record=next;
        if(!force&&cached?.contentHash===contentHash&&cached.canonicalLength===next.canonicalLength){
          try{record=hydrate(cached,next.batches.flat().map(unit=>unit.text).join(''),app().categories||[]);record.file=file;}catch(_){record=next;}
        }
        records.set(cacheKey,record);summarize(record);notify(record);return record;
      })();
      preparing.set(cacheKey,work);notify({projectId,assetId});try{return await work;}finally{if(preparing.get(cacheKey)===work){preparing.delete(cacheKey);notify({projectId,assetId});}}
    }
    async function save(record){
      assertCurrent(record.projectId);const cacheKey=key(record.projectId,record.assetId);
      if(saving.has(cacheKey))return saving.get(cacheKey);
      const work=(async()=>{
        try{
          const saved=await app().saveRfpAnalysis(record.assetId,snapshot(record),record.projectId,record.expectedSavedAt||'');assertCurrent(record.projectId);
          record.savedAt=saved.savedAt;record.expectedSavedAt=saved.savedAt;record.persistError='';notify(record);return record;
        }catch(cause){record.persistError=cause.message;notify(record);throw cause;}
      })();
      saving.set(cacheKey,work);notify(record);try{return await work;}finally{if(saving.get(cacheKey)===work){saving.delete(cacheKey);notify(record);}}
    }
    function split(record,index){
      const depth=record.depths[index]||0,parts=depth<3?overviewCore.splitBatch(record.batches[index]):null;
      if(!parts)return false;
      let offset=record.batches[index][0].start;
      for(const batch of parts)for(const unit of batch){unit.start=offset;offset+=unit.text.length;unit.end=offset;}
      record.batches.splice(index,1,...parts);record.results.splice(index,1,undefined,undefined);record.depths.splice(index,1,depth+1,depth+1);
      record.splitCount++;summarize(record);return true;
    }
    async function analyze(record,{shouldStop=()=>false,onEvent=()=>{}}={}){
      assertCurrent(record.projectId);const cacheKey=key(record.projectId,record.assetId);
      if(running.has(cacheKey))return running.get(cacheKey);
      if(record.complete){if(record.persistError||!record.savedAt)await save(record);return record;}
      const work=(async()=>{
        if(!record.hydrated){record=await prepare(record.projectId,record.assetId);if(record.complete)return record;}
        const ai=env.ai(),info=await ai.getConnectionInfo();assertCurrent(record.projectId);
        if(!info.connected)throw new Error('AI 연결에서 API 키를 연결해 주세요.');
        const emit=event=>{summarize(record);onEvent(event);notify(record);};
        let sinceSave=0;
        try{
          for(let index=0;index<record.batches.length;){
            assertCurrent(record.projectId);if(shouldStop())throw error('AI_STOPPED','분석을 중단했습니다. 완료된 구간은 이어서 사용할 수 있습니다.');
            if(record.results[index]){index++;continue;}
            emit({type:'request',index});let response;
            try{response=await ai.generate('rfpAnalysis',{documentName:record.file.name,requirementCategories:app().categories||[],overviewCategories:overviewCore.categories,units:record.batches[index].map(({start,end,...unit})=>unit)});}
            catch(cause){
              assertCurrent(record.projectId);
              if(['OUTPUT_LIMIT','CONTEXT_LIMIT','INVALID_JSON','AI_TIMEOUT'].includes(cause.code)&&split(record,index)){emit({type:'split',index,reason:cause.message});continue;}throw cause;
            }
            assertCurrent(record.projectId);
            try{record.results[index]=validateCombined(response,record.batches[index],app().categories||[]);}
            catch(cause){if(cause.code==='INVALID_JSON'&&split(record,index)){emit({type:'split',index,reason:cause.message});continue;}throw cause;}
            if(info.label&&!record.models.includes(info.label))record.models.push(info.label);record.model=record.models.join(' / ');record.analyzedAt=timestamp();
            emit({type:'completed',index});index++;sinceSave++;
            if(sinceSave>=3&&index<record.batches.length){emit({type:'saving'});await save(record);sinceSave=0;emit({type:'saved'});}
          }
          record.complete=true;summarize(record);emit({type:'saving'});await save(record);emit({type:'saved'});return record;
        }catch(cause){
          if(current(record.projectId)&&record.results.some(Boolean)&&!record.persistError&&sinceSave){try{await save(record);}catch(_){/* Results remain available for an explicit save retry. */}}
          throw cause;
        }
      })();
      running.set(cacheKey,work);notify(record);try{return await work;}finally{if(running.get(cacheKey)===work){running.delete(cacheKey);notify(record);}}
    }
    return{get,prepare,analyze,save,progress,snapshot,isRunning};
  }
  return{schemaVersion,validateCombined,createService};
});
