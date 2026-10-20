const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../shared-core.js'),directory=require('../project-directory.js');
test('an editor opened before own flag/AI save rebases without dropping edits',()=>{
  const base={key:'a',revision:1,status:'검토 전',flag:'',easyExplanation:'',questions:[]};
  const latest={...base,revision:3,flag:'red',easyExplanation:'생성된 설명'};
  const result=core.mergeEdits(base,{...base,status:'확정',questions:[{question:'확인 요청'}]},latest);
  assert.deepEqual(result.conflicts,[]);assert.equal(result.item.revision,3);
  assert.equal(result.item.flag,'red');assert.equal(result.item.easyExplanation,'생성된 설명');
  assert.equal(result.item.status,'확정');assert.equal(result.item.questions[0].question,'확인 요청');
});
test('concurrent identical values are not conflicts, but conflicting lists and deletion are',()=>{
  const base={key:'a',revision:1,questions:[]},draft={...base,questions:[{question:'one'}]};
  assert.deepEqual(core.mergeEdits(base,draft,{...draft,revision:2}).conflicts,[]);
  assert.deepEqual(core.mergeEdits(base,draft,{...base,questions:[{question:'two'}]}).conflicts,['questions']);
  assert.deepEqual(core.mergeEdits(base,draft,undefined).conflicts,['deleted']);
  assert.equal(core.mergeEdits(null,{key:'new',revision:15},null).item.revision,0);
});
test('project directory remembers three projects across reload without storing credentials or content',()=>{
  let data;const storage={getItem:()=>data,setItem:(_,value)=>data=value},d=directory.create(storage);
  for(const id of ['a','b','c'])d.remember({id:id.repeat(64),name:id,updatedAt:'2026-10-20',token:'SECRET',password:'SECRET',workspace:{secret:'content'}},true);
  assert.equal(directory.create(storage).list().length,3);assert.ok(!data.includes('SECRET'));assert.ok(!data.includes('content'));
  d.remember({id:'a'.repeat(64),name:'renamed',updatedAt:'2026-10-21'});
  assert.equal(d.list().length,3);assert.equal(d.list().find(x=>x.id==='a'.repeat(64)).name,'renamed');
});
test('project links stay on the current app and reject invalid IDs, script URLs and credentials',()=>{
  const id='a'.repeat(64);
  assert.equal(directory.projectUrl('https://sjk3446.github.io/rfp/?review=6.5.2&mode=local#old',id),`https://sjk3446.github.io/rfp/?project=${id}`);
  assert.equal(directory.idFromUrl(`https://sjk3446.github.io/rfp/?project=${id}`),id);
  for(const link of ['javascript:alert(1)','https://example.com/?project=bad',''])assert.throws(()=>directory.idFromUrl(link));
  assert.throws(()=>directory.projectUrl('https://example.com','bad'));
});
test('directory corruption or blocked browser storage does not prevent saving',()=>{
  const d=directory.create({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}});
  d.remember({id:'a'.repeat(64),name:'retained'});assert.equal(d.list()[0].name,'retained');
  assert.deepEqual(directory.create({getItem:()=>'{invalid'}).list(),[]);
});
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function editor(save,shared=false){
  const base={key:'a',id:'SFR-001',name:'원문',description:'원문 설명',sourceOrder:1,revision:1,source:'원문',flag:'',questions:[],manualGlossary:[]};
  const button={disabled:false};
  const fields={formId:'SFR-001',formName:'수정한 명칭',formDescription:'원문 설명',formEasyExplanation:'',formCategory:'기능',formPriority:'보통',formStatus:'검토 전',formFlag:'',formTags:'',formSourceInput:'원문',formAcceptance:'미검토',formCompletion:'미완료',formApplicationPlan:'',formOwner:'',formChangeHistory:''};
  const elements=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,{value,disabled:false}]));
  elements.requirementForm={reportValidity:()=>true,querySelector:()=>button,elements:[...Object.values(elements),button]};
  let refreshed=0;const messages=[];
  const ctx={structuredClone,Date,console,elements,editingBase:structuredClone(base),editorSaveInProgress:false,
    state:{projectId:'p',editingKey:'a',editingRevision:1,requirements:[base],draftQuestions:[],draftGlossary:[],draftExplanationSources:[]},
    normalizeRequirement:x=>x,makeKey:()=> 'new',render(){},async refreshSavedEditor(){refreshed++;},
    showToast(...args){messages.push(args);},window:{ReqlySharedCore:core,ReqlyShared:{enabled:shared,saveItems:save},ReqlyPortal:{saveNow:save}}};
  vm.runInNewContext(source.slice(source.indexOf('async function saveRequirement('),source.indexOf('\nasync function deleteRequirement(')),ctx);
  return{ctx,messages,button,get refreshed(){return refreshed;}};
}
test('save and move waits for durable storage, blocks double submits and only then succeeds',async()=>{
  let release,calls=0;const e=editor(()=>{calls++;return new Promise(resolve=>release=resolve);});
  const pending=e.ctx.saveRequirement();assert.equal(e.button.disabled,true);assert.equal(e.refreshed,0);
  assert.equal(await e.ctx.saveRequirement(),false);assert.equal(calls,1);
  release();assert.equal(await pending,true);assert.equal(e.refreshed,1);assert.equal(e.button.disabled,false);
  assert.equal(e.ctx.state.requirements[0].name,'수정한 명칭');
});
test('failed save preserves both the unsaved form and previously stored workspace',async()=>{
  const e=editor(async()=>{throw new Error('연결 실패');});
  assert.equal(await e.ctx.saveRequirement(),false);assert.equal(e.refreshed,0);
  assert.equal(e.ctx.state.requirements[0].name,'원문');assert.equal(e.ctx.elements.formName.value,'수정한 명칭');assert.equal(e.button.disabled,false);
});
test('editor saves use latest own-save revision while preserving an automatically stored flag',async()=>{
  let submitted;const e=editor(async items=>{submitted=items[0];},true);
  e.ctx.state.requirements=[{...e.ctx.state.requirements[0],revision:2,flag:'red'}];
  assert.equal(await e.ctx.saveRequirement(),true);assert.equal(submitted.revision,2);assert.equal(submitted.flag,'red');assert.equal(submitted.name,'수정한 명칭');
});
test('a same-field editor conflict preserves the draft and never calls storage',async()=>{
  let calls=0;const e=editor(async()=>calls++,true);
  e.ctx.state.requirements=[{...e.ctx.state.requirements[0],revision:2,name:'서버에 저장된 명칭'}];
  assert.equal(await e.ctx.saveRequirement(),false);assert.equal(calls,0);
  assert.equal(e.ctx.elements.formName.value,'수정한 명칭');
});
test('IndexedDB request success alone does not count as a committed save',async()=>{
  const code=fs.readFileSync(require.resolve('../pages-runtime.js'),'utf8'),tx={objectStore:()=>({put(){return{};}})};
  const ctx={STORE:'projects',openDatabase:async()=>({transaction:()=>tx})};
  vm.runInNewContext(code.slice(code.indexOf('  async function dbPut('),code.indexOf('  async function dbDelete(')),ctx);
  let done=false;const result=ctx.dbPut({name:'test'}).then(()=>done=true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);
  tx.oncomplete();await result;assert.equal(done,true);
  const failed=ctx.dbPut({name:'abort'});await new Promise(resolve=>setImmediate(resolve));
  tx.onabort();await assert.rejects(failed,/취소/);
});
test('project navigation waits for save confirmation and stays put when saving fails',async()=>{
  const code=fs.readFileSync(require.resolve('../file-runtime.js'),'utf8');let confirm,cleared=0;
  const ctx={switching:false,location:{href:'original'},window:{ReqlyApp:{confirmLeave:()=>new Promise(resolve=>confirm=resolve),allowNavigation(){cleared++;}}}};
  vm.runInNewContext(code.slice(code.indexOf('  async function navigateProject('),code.indexOf('  function renderProjectList(')),ctx);
  const denied=ctx.navigateProject('next');assert.equal(ctx.location.href,'original');confirm(false);await denied;
  assert.equal(ctx.location.href,'original');assert.equal(cleared,0);
  const accepted=ctx.navigateProject('next');assert.equal(ctx.location.href,'original');confirm(true);await accepted;
  assert.equal(ctx.location.href,'next');assert.equal(cleared,1);
});
