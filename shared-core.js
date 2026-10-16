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
  return {mergeAnalysis, changesBetween, canonical};
});
