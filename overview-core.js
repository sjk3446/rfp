/* Source-grounded business information, independent of requirement extraction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReqlyOverviewCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const categories=['사업개요·목적','사업범위','사업기간','예산·대금','추진일정','참가자격','제출서류·제출방법','평가·선정','계약조건','수행·운영조건','산출물·보고','보안·준수사항','기타 중요사항'];
  const normalized=value=>String(value||'').replace(/\s+/g,'').normalize('NFKC');
  function batches(text,limit=8000){
    if(limit<1000)throw new Error('분석 구간 크기가 너무 작습니다.');
    const parts=String(text||'').split(/(\[\[(?:PAGE|SHEET):[^\]\n]+\]\])/g),units=[];
    let label='본문',page=null,sheet='',sequence=0;
    for(const part of parts){
      const marker=part.match(/^\[\[(PAGE|SHEET):([^\]\n]+)\]\]$/);
      if(marker){page=marker[1]==='PAGE'?Number(marker[2]):null;sheet=marker[1]==='SHEET'?marker[2]:'';label=page?`${page}페이지`: `${sheet} 시트`;continue;}
      const content=part.replace(/\[\[TABLE_LAYOUT\]\]/g,'').trim();if(!content)continue;
      for(let offset=0;offset<content.length;offset+=limit){units.push({sourceId:`s${++sequence}`,label:label==='본문'?`본문 구간 ${sequence}`:label,page,sheet,text:content.slice(offset,offset+limit)});}
    }
    const result=[];let group=[],size=0;
    for(const unit of units){if(group.length&&size+unit.text.length>limit){result.push(group);group=[];size=0;}group.push(unit);size+=unit.text.length;}
    if(group.length)result.push(group);return result;
  }
  function validate(response,units){
    if(!response||!Array.isArray(response.items))throw new Error('사업 정보 분석 결과의 형식이 올바르지 않습니다.');
    const sources=new Map(units.map(unit=>[unit.sourceId,unit]));const items=[];let rejected=0;
    for(const raw of response.items){
      const source=sources.get(raw?.sourceId),quote=String(raw?.quote||'').trim(),title=String(raw?.title||'').trim(),content=String(raw?.content||'').trim();
      if(!source||!categories.includes(raw.category)||!title||!content||quote.length<4||quote.length>2000||!normalized(source.text).includes(normalized(quote))||title.length>200||content.length>4000){rejected++;continue;}
      items.push({category:raw.category,title,content,quote,sourceId:source.sourceId,sourceLabel:source.label,page:source.page,sheet:source.sheet});
    }
    return{items,rejected};
  }
  function merge(results){const items=[],seen=new Set();let rejected=0;for(const result of results){rejected+=result.rejected||0;for(const item of result.items){const key=normalized(`${item.category}|${item.content}|${item.quote}`);if(!seen.has(key)){seen.add(key);items.push(item);}}}return{items,rejected};}
  const batchSize=batch=>batch.reduce((size,unit)=>size+unit.text.length,0);
  function progress(data){
    const total=data.batches.reduce((sum,batch)=>sum+batchSize(batch),0);
    const completed=data.batches.reduce((sum,batch,index)=>sum+(data.results[index]?batchSize(batch):0),0);
    return total?Math.floor(100*completed/total):0;
  }
  function splitBatch(batch){
    const size=batchSize(batch);if(size<2000)return null;
    const halfway=Math.floor(size/2),left=[],right=[];let offset=0;
    for(const unit of batch){
      const end=offset+unit.text.length;
      if(end<=halfway)left.push(unit);
      else if(offset>=halfway)right.push(unit);
      else{
        let cut=halfway-offset;
        const newline=unit.text.lastIndexOf('\n',cut);
        if(newline>cut-300&&newline>0)cut=newline+1;
        // Keep every character and page/sheet reference; split IDs remain unique.
        if(cut>0)left.push({...unit,sourceId:`${unit.sourceId}-a`,text:unit.text.slice(0,cut)});
        if(cut<unit.text.length)right.push({...unit,sourceId:`${unit.sourceId}-b`,text:unit.text.slice(cut)});
      }
      offset=end;
    }
    return left.length&&right.length?[left,right]:null;
  }
  async function analyze(data,{request,validateResult=validate,shouldStop=()=>false,onEvent=()=>{}}){
    data.depths ||= data.batches.map(()=>0);
    for(let index=0;index<data.batches.length;){
      if(shouldStop())throw new Error('분석을 중단했습니다. 완료된 구간은 유지되며 이어서 분석할 수 있습니다.');
      if(data.results[index]){index++;continue;}
      onEvent({type:'request',index});
      try{
        const response=await request(data.batches[index]);
        data.results[index]=validateResult(response,data.batches[index]);
        onEvent({type:'completed',index});index++;
      }catch(error){
        const retryable=['OUTPUT_LIMIT','CONTEXT_LIMIT','INVALID_JSON','AI_TIMEOUT'].includes(error.code);
        const depth=data.depths[index]||0,parts=retryable&&depth<3?splitBatch(data.batches[index]):null;
        if(!parts)throw error;
        data.batches.splice(index,1,...parts);
        data.results.splice(index,1,undefined,undefined);
        data.depths.splice(index,1,depth+1,depth+1);
        data.splitCount=(data.splitCount||0)+1;
        onEvent({type:'split',index,reason:error.message});
      }
    }
    return merge(data.results);
  }
  function workflow({hasFile=false,prepared=false,draft=false,saved=false,completed=0,total=0,operation='',readDone=0,readTotal=0,errorStage='',stopped=false}={}){
    const count=Math.max(0,Math.min(Number(completed)||0,Number(total)||0));
    const pending=prepared&&count<total;
    let phase=!hasFile?'select':draft?'review':pending?(count?'paused':'ready'):saved?'saved':prepared?'ready':'prepare';
    if(operation)phase=operation;
    else if(errorStage)phase=stopped?(errorStage==='prepare'?'preparePaused':'paused'):'error';
    const definitions={
      select:[1,'RFP를 먼저 선택해 주세요','원본 RFP를 추가한 뒤 분석할 문서를 선택하세요.','문서 읽기'],
      prepare:[2,'문서를 읽을 준비가 되었습니다','문서 읽기를 누르면 전체 분량과 필요한 AI 요청 횟수를 확인합니다. 아직 AI를 호출하지 않습니다.','문서 읽기'],
      loading:[2,'RFP 원본을 불러오는 중입니다','원본을 불러온 뒤 문서 읽기를 시작합니다. 이 단계에서는 AI를 호출하지 않습니다.','문서를 불러오는 중…'],
      reading:[2,'문서 내용을 읽고 있습니다','전체 문서를 읽어 분석 구간을 나누고 있습니다. PDF는 읽은 페이지 수를 표시합니다.','문서를 읽는 중…'],
      ready:[3,'이제 AI 분석을 시작할 수 있습니다','예정된 요청 횟수를 확인한 뒤 AI 분석 시작을 눌러 주세요.','AI 분석 시작'],
      analyzing:[3,'AI가 사업 정보를 정리하고 있습니다','완료된 구간을 기준으로 진행률이 올라갑니다. 현재 구간의 응답을 기다리는 동안에는 비율이 그대로 유지됩니다.','AI 분석 중…'],
      paused:[3,'분석이 중단되었습니다','완료된 구간은 유지됩니다. 이어서 분석하면 남은 구간만 요청합니다.','이어서 분석'],
      preparePaused:[2,'문서 읽기가 중단되었습니다','문서 읽기를 다시 시작해 주세요. 아직 AI를 호출하지 않았습니다.','문서 읽기 다시 시작'],
      review:[4,'분석 완료 · 아직 저장 전입니다','아래의 정리 내용과 원문 근거를 검토한 뒤 결과 저장을 눌러 주세요.','결과 저장'],
      saving:[4,'검토 결과를 저장하고 있습니다','저장이 끝날 때까지 기다려 주세요. AI는 다시 호출하지 않습니다.','저장 중…'],
      saved:[4,'저장 완료 · 언제든 다시 볼 수 있습니다','아래에서 항목을 검색하거나 원문 근거를 확인하세요. 다시 열람할 때 AI를 호출하지 않습니다.','새로 분석 준비'],
      error:[errorStage==='save'?4:errorStage==='prepare'?2:3,'작업을 완료하지 못했습니다','아래 오류 안내를 확인한 뒤 다시 시도해 주세요. 기존 저장 내용은 유지됩니다.',errorStage==='save'?'저장 다시 시도':errorStage==='prepare'?'문서 읽기 다시 시도':'이어서 분석'],
    };
    const [activeStep,title,hint,action]=definitions[phase]||definitions.prepare;
    const reading=phase==='reading'||phase==='preparePaused'||(phase==='error'&&errorStage==='prepare'),indeterminate=['loading','saving'].includes(phase)||(phase==='reading'&&!readTotal);
    const percent=indeterminate?null:reading?(readTotal?Math.round(100*Math.min(readDone,readTotal)/readTotal):0):total?Math.round(100*count/total):0;
    const doneSteps=[hasFile,prepared||draft||saved,draft||saved,!draft&&saved&&!pending&&!operation&&!errorStage];
    for(let i=activeStep-1;i<doneSteps.length;i++)doneSteps[i]=phase==='saved';
    return{phase,activeStep,title,hint,action,percent,completed:count,total,remaining:Math.max(0,total-count),doneSteps,progressLabel:reading?'문서 읽기 진행률':phase==='loading'?'원본 불러오기':phase==='saving'?'저장 처리':phase==='prepare'||phase==='select'?'분석 준비 상태':'AI 분석 진행률'};
  }
  function filterItems(items,{category='',query=''}={}){
    const term=String(query).trim().toLocaleLowerCase();
    const matched=items.filter(item=>!term||`${item.title} ${item.content} ${item.quote} ${item.category}`.toLocaleLowerCase().includes(term));
    const counts=Object.fromEntries(categories.map(name=>[name,matched.filter(item=>item.category===name).length]));
    return{items:matched.filter(item=>!category||item.category===category),counts,matched:matched.length,total:items.length};
  }
  return{categories,batches,validate,merge,workflow,filterItems,splitBatch,progress,analyze};
});
