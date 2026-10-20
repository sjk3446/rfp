/* Pure project reconciliation helpers; never overwrite user edits during analysis. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReqlySharedCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const source = item => ({id:item.id, name:item.name, category:item.category, description:item.description, source:item.source, sourceOrder:item.sourceOrder});
  const canonical = value => JSON.stringify(value, function(key, item) {
    if (key === 'revision' || key === 'savedAt') return undefined;
    if (item && typeof item === 'object' && !Array.isArray(item)) return Object.keys(item).sort().reduce((result, name) => {result[name]=item[name];return result;}, {});
    return item;
  });
  function mergeAnalysis(existing, incoming, assetId) {
    if(!existing.length)return{requirements:copy(incoming).map(item=>({...item,rfpSources:{[assetId]:source(item)},absentInLatest:false})),unresolved:[]};
    const result = copy(existing), groups = new Map(), counts = new Map();
    result.forEach(item => {if(item.id) {const list=groups.get(item.id)||[];list.push(item);groups.set(item.id,list);}});
    incoming.forEach(item => {if(item.id) counts.set(item.id,(counts.get(item.id)||0)+1);});
    const matched = new Set(), unresolved = [];
    incoming.forEach(item => {
      const candidates = groups.get(item.id) || [];
      if (!item.id || counts.get(item.id) !== 1 || candidates.length > 1) {
        unresolved.push(copy(item)); return;
      }
      const original = candidates[0];
      if (original) {
        const previousSource=original.latestSource||Object.values(original.rfpSources||{}).at(-1)||source(original);
        original.rfpSources = {...(original.rfpSources||{}), [assetId]:source(item)};
        original.latestSource = source(item);
        original.sourceChanged = canonical(previousSource) !== canonical(source(item));
        original.absentInLatest = false; matched.add(original.key);
      } else {
        const added = {...copy(item), rfpSources:{[assetId]:source(item)}, absentInLatest:false};
        result.push(added); matched.add(added.key);
      }
    });
    result.forEach(item => {if(!matched.has(item.key))item.absentInLatest=true;});
    return {requirements:result, unresolved};
  }
  function changesBetween(base, next) {
    const byKey = new Map((base||[]).map(item=>[item.key,item]));
    return (next||[]).filter(item=>canonical(byKey.get(item.key))!==canonical(item)).map(item=>({key:item.key, expectedRevision:item.revision || 0, item:copy(item)}));
  }
  // Rebase only fields actually edited. Arrays remain atomic to avoid guessing
  // how two independently edited question/glossary lists should be combined.
  function mergeEdits(base, draft, latest) {
    if (!base) return latest
      ? {item:copy(latest),conflicts:canonical(draft)===canonical(latest)?[]:['key']}
      : {item:{...copy(draft),revision:0},conflicts:[]};
    if (!latest) return {item:null,conflicts:['deleted']};
    const item=copy(latest),conflicts=[];
    for (const field of new Set([...Object.keys(base),...Object.keys(draft)])) {
      if (['key','revision','savedAt'].includes(field) || canonical(base[field])===canonical(draft[field])) continue;
      if (canonical(latest[field])!==canonical(base[field]) && canonical(latest[field])!==canonical(draft[field])) {
        conflicts.push(field);continue;
      }
      if (Object.hasOwn(draft,field) && draft[field]!==undefined) item[field]=copy(draft[field]);
      else delete item[field];
    }
    return {item,conflicts};
  }
  function conflictError(fields=[]) {
    const labels={name:'요구사항 명칭',description:'상세 설명',priority:'우선순위',status:'상태',flag:'플래그',questions:'질의사항',manualGlossary:'용어사전',easyExplanation:'쉬운 설명',applicationPlan:'적용 방안',acceptance:'수용 여부',completion:'완료 여부',changeHistory:'변경 이력',tags:'태그',id:'고유번호',category:'분류'};
    const names=[...new Set(fields.map(field=>labels[field]||'요구사항 내용'))].join(', ');
    const error=new Error(fields.includes('deleted')
      ? '이 요구사항이 삭제되어 저장하지 않았습니다. 작성 중인 내용은 화면에 유지됩니다.'
      : `최신 저장 내용과 ${names||'수정 내용'}이 겹칩니다. 작성 중인 내용은 유지됩니다. 내용을 복사해 둔 뒤 ‘최신 내용 다시 열기’로 확인해 주세요.`);
    error.code='CONFLICT';return error;
  }
  return {mergeAnalysis, changesBetween, canonical, mergeEdits, conflictError};
});
