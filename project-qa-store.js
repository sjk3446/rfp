/* Private answers are deliberately separate from project snapshots and sharing. */
(() => {
  'use strict';
  let database;
  const db=()=>database||=(new Promise((resolve,reject)=>{const request=indexedDB.open('muhammad-private-questions',1);request.onupgradeneeded=()=>request.result.createObjectStore('answers');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}));
  async function list(projectId){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction('answers').objectStore('answers').getAll();request.onsuccess=()=>resolve(request.result.filter(entry=>entry.projectId===projectId).map(entry=>entry.record));request.onerror=()=>reject(request.error);});}
  async function save(projectId,records){if(!projectId||records.some(record=>!record.id||!record.question||!Array.isArray(record.answer?.claims)))throw new Error('질의응답 저장 내용을 확인해 주세요.');if(!records.length)return;const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('answers','readwrite'),store=tx.objectStore('answers');records.forEach(record=>store.put({projectId,record:structuredClone(record)},`${projectId}:${record.id}`));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function remove(projectId,ids){if(!projectId||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id))throw new Error('삭제할 질의응답을 확인해 주세요.');if(!ids.length)return;const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('answers','readwrite'),store=tx.objectStore('answers');ids.forEach(id=>store.delete(`${projectId}:${id}`));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function owner(projectId){
    const key='muhammad-question-author-v1';let authorSecret;
    try{authorSecret=localStorage.getItem(key);if(!/^[a-f0-9]{64}$/.test(authorSecret||'')){authorSecret=Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('');localStorage.setItem(key,authorSecret);}}
    catch(_){throw new Error('이 브라우저에 질문 작성자 정보를 저장할 수 없습니다. 브라우저 저장 설정을 확인해 주세요.');}
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`question-author:${projectId}:${authorSecret}`)));
    const authorId=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return{authorSecret,authorId};
  }
  function merge(privateRecords,sharedRecords,deletedIds=[]){const deleted=new Set(deletedIds),records=new Map(privateRecords.filter(record=>!deleted.has(record.id)).map(record=>[record.id,{...record,visibility:'private'}]));sharedRecords.filter(record=>!deleted.has(record.id)).forEach(record=>records.set(record.id,{...record,visibility:'shared'}));return [...records.values()];}
  function canManage(record,authorId,role){return record.visibility!=='shared'||role==='admin'||Boolean(authorId&&record.authorId===authorId);}
  window.ReqlyQuestionStore={list,save,remove,owner,merge,canManage};
})();
