/* Private answers are deliberately separate from project snapshots and sharing. */
(() => {
  'use strict';
  let database;
  const db=()=>database||=(new Promise((resolve,reject)=>{const request=indexedDB.open('muhammad-private-questions',1);request.onupgradeneeded=()=>request.result.createObjectStore('answers');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}));
  async function list(projectId){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction('answers').objectStore('answers').getAll();request.onsuccess=()=>resolve(request.result.filter(entry=>entry.projectId===projectId).map(entry=>entry.record));request.onerror=()=>reject(request.error);});}
  async function save(projectId,records){if(!projectId||records.some(record=>!record.id||!record.question||!Array.isArray(record.answer?.claims)))throw new Error('질의응답 저장 내용을 확인해 주세요.');const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('answers','readwrite'),store=tx.objectStore('answers');records.forEach(record=>store.put({projectId,record:structuredClone(record)},`${projectId}:${record.id}`));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function merge(privateRecords,sharedRecords){const records=new Map(privateRecords.map(record=>[record.id,{...record,visibility:'private'}]));sharedRecords.forEach(record=>records.set(record.id,{...record,visibility:'shared'}));return [...records.values()];}
  window.ReqlyQuestionStore={list,save,merge};
})();
