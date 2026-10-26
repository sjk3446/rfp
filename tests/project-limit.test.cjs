const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../pages-runtime.js'),'utf8');
function localProjects(count){
  const records=new Map(Array.from({length:count},(_,i)=>['existing-'+i,{id:'existing-'+i,name:'기존 '+i,workspace:{requirements:[{id:'SFR-'+i,description:'보존할 원문',status:'검토완료'}]}}]));
  const original=JSON.stringify([...records]);
  const store={getAll(){const request={};queueMicrotask(()=>{request.result=[...records.values()];request.onsuccess();});return request;},put(value){records.set(value.id,value);}};
  const database={transaction(){const tx={objectStore:()=>store};queueMicrotask(()=>tx.oncomplete?.());return tx;}};
  const context={window:{fetch:async()=>{}},sessionStorage:{getItem:()=>null},indexedDB:{open(name,version){assert.equal(name,'reqly-pages-v1');assert.equal(version,1);const request={result:database};queueMicrotask(()=>request.onsuccess());return request;}}};
  // Execute the real storage and creation functions without booting unrelated UI.
  vm.runInNewContext(source.slice(0,source.indexOf('  function scheduleSave('))+'window.createProject = newProject;})();',context);
  return{records,original,create:context.window.createProject,oldRecords:()=>JSON.stringify([...records].filter(([key])=>key.startsWith('existing-')))};
}
test('existing three projects remain intact when a fourth project is created',async()=>{
  const db=localProjects(3);await db.create('네 번째');assert.equal(db.records.size,4);assert.equal(db.oldRecords(),db.original);
});
test('the tenth local project can be created without modifying the first nine',async()=>{
  const db=localProjects(9),created=await db.create('열 번째');assert.equal(db.records.size,10);assert.equal(created.name,'열 번째');assert.equal(db.oldRecords(),db.original);
});
test('the eleventh local project is rejected and all ten projects are preserved',async()=>{
  const db=localProjects(10);await assert.rejects(db.create('열한 번째'),/최대 10개/);assert.equal(db.records.size,10);assert.equal(db.oldRecords(),db.original);
});
