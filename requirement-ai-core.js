/* Evidence checks and append-only imports for ID-less requirement candidates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReqlyRequirementAI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=value=>String(value||'').replace(/\s+/g,'').normalize('NFKC');
  const identity=item=>normalize(`${item.id}|${item.name}|${item.description||item.quote}`);
  function validate(response,units,categories){
    if(!Array.isArray(response?.items))throw Object.assign(new Error('요구사항 후보 응답의 형식이 올바르지 않습니다.'),{code:'INVALID_JSON'});
    const sources=new Map(units.map(unit=>[unit.sourceId,unit])),items=[];let rejected=0;
    for(const raw of response.items){
      const unit=sources.get(raw?.sourceId),quote=String(raw?.quote||'').trim(),name=String(raw?.name||'').trim();
      if(!unit||quote.length<4||quote.length>8000||!normalize(unit.text).includes(normalize(quote))||!name||name.length>200){rejected++;continue;}
      let id=String(raw.id||'').trim();const warnings=[];
      const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const labelled=id&&new RegExp(`(?:요구사항\\s*(?:ID|번호|식별자|고유번호)|고유번호|식별자)[\\s:：|]{0,30}${escaped}(?![\\p{L}\\d])`,'iu').test(unit.text);
      const coded=/^[\p{L}\d]+(?:[-_./][\p{L}\d]+)+$/u.test(id)&&/\p{L}/u.test(id)||/^\p{L}+\d[\p{L}\d]*$/u.test(id);
      if(id&&(!unit.text.includes(id)||id.length>120||(!labelled&&!coded))){id='';warnings.push('요구사항 ID로 확인할 수 없어 비워 두었습니다. 원문 위치로 구분해 주세요.');}
      if(id&&!quote.includes(id))warnings.push('같은 원문 구간에서 확인한 ID입니다. 이 요구사항의 ID가 맞는지 검토해 주세요.');
      items.push({id,name,description:quote,quote,category:categories.includes(raw.category)?raw.category:'기타',sourceId:unit.sourceId,sourceLabel:unit.label,page:unit.page,sheet:unit.sheet,warnings});
    }
    return{items,rejected};
  }
  function merge(results){const items=[],seen=new Set();let rejected=0;for(const result of results){if(!result)continue;rejected+=result.rejected||0;for(const item of result.items){const key=identity(item);if(!seen.has(key)){seen.add(key);items.push(item);}}}return{items,rejected};}
  function duplicate(existing,item,assetId){
    return existing.some(previous=>(item.id&&normalize(previous.id).toLowerCase()===normalize(item.id).toLowerCase())||previous.aiEvidence?.assetId===assetId&&identity({...previous,id:previous.aiEvidence.candidateId??previous.id,name:previous.aiEvidence.candidateName||previous.name,description:previous.aiEvidence.quote||previous.description})===identity(item));
  }
  function plan(existing,candidates,assetId){
    const added=[],skipped=[];
    for(const item of candidates){if(duplicate([...existing,...added.map(candidate=>({...candidate,aiEvidence:{assetId}}))],item,assetId))skipped.push(item);else added.push(item);}
    return{added,skipped};
  }
  return{validate,merge,duplicate,plan};
});
