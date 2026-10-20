const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('../requirement-ai-core.js');
const queue=require('../overview-core.js');
const categories=['기능','보안','기타'];
const unit={sourceId:'s1',label:'12페이지',page:12,sheet:'',text:'사업 배경: 고객 지원을 개선한다.\nUXG-SFR-001 사용자는 모바일에서 신청할 수 있어야 한다.\n접속 기록을 12개월 보관해야 한다.'};
const raw={id:'',name:'접속 기록 보관',category:'보안',sourceId:'s1',quote:'접속 기록을 12개월 보관해야 한다.'};
test('ID-less requirements retain exact evidence, conditions and location without an invented ID',()=>{
  const result=core.validate({items:[raw]},[unit],categories);
  assert.equal(result.items[0].id,'');assert.equal(result.items[0].page,12);
  assert.equal(result.items[0].description,raw.quote);assert.equal(result.rejected,0);
});
test('explicit source IDs are retained; ungrounded IDs are cleared and flagged',()=>{
  const result=core.validate({items:[{...raw,id:'UXG-SFR-001'},{...raw,id:'AI-001'}]},[unit],categories);
  assert.equal(result.items[0].id,'UXG-SFR-001');assert.equal(result.items[1].id,'');assert.equal(result.items[1].warnings.length,1);
});
test('outline numbers are not requirement IDs; explicitly labelled numeric IDs are preserved',()=>{
  const numbered={...unit,text:`1.2 ${raw.quote}\n요구사항 번호: 003`};
  const result=core.validate({items:[{...raw,id:'1.2'},{...raw,id:'003'}]},[numbered],categories);
  assert.equal(result.items[0].id,'');assert.equal(result.items[1].id,'003');
});
test('user renaming and assigning an ID do not duplicate a previously imported ID-less item',()=>{
  const candidate=core.validate({items:[raw]},[unit],categories).items[0];
  const existing=[{...candidate,id:'수동ID',name:'사용자가 바꾼 명칭',aiEvidence:{assetId:'rfp-a',candidateId:'',candidateName:candidate.name,quote:candidate.quote}}];
  assert.equal(core.plan(existing,[candidate],'rfp-a').added.length,0);
});
test('hallucinated evidence, unknown sources and unusable names are excluded',()=>{
  const result=core.validate({items:[{...raw,quote:'接속 기록을 24개월 보관해야 한다.'},{...raw,sourceId:'fake'},{...raw,name:''}]},[unit],categories);
  assert.equal(result.items.length,0);assert.equal(result.rejected,3);
});
test('append-only import plan never changes existing notes or guesses ID-less matches across files',()=>{
  const candidate=core.validate({items:[raw]},[unit],categories).items[0];
  const existing=[{id:'SFR-001',status:'확정',questions:[{question:'질의'}],applicationPlan:'작성한 메모'}, {...candidate,aiEvidence:{assetId:'rfp-a'}}];
  const before=JSON.stringify(existing);
  const plan=core.plan(existing,[{...candidate,id:'SFR-001'},candidate], 'rfp-a');
  assert.equal(plan.added.length,0);assert.equal(plan.skipped.length,2);assert.equal(JSON.stringify(existing),before);
  assert.equal(core.plan(existing,[candidate],'rfp-b').added.length,1);
  assert.equal(core.plan([],[candidate,candidate],'rfp-a').added.length,1);
});
test('requirement extraction reuses bounded adaptive recovery and validates each successful portion',async()=>{
  const data={batches:queue.batches('접속 기록 보관 '.repeat(800)),results:[]};let calls=0;
  await queue.analyze(data,{request:async units=>{calls++;if(units[0].text.length>4000)throw Object.assign(new Error('limit'),{code:'OUTPUT_LIMIT'});return{items:[{...raw,sourceId:units[0].sourceId,quote:'접속 기록 보관'}]};},validateResult:(response,units)=>core.validate(response,units,categories)});
  assert.equal(queue.progress(data),100);assert.ok(calls>1);assert.ok(core.merge(data.results).items.length>0);
});
function app(existing=[],shared=false){
  const requests=[],ctx={structuredClone,document:{addEventListener(){}},window:{addEventListener(){},ReqlyRequirementAI:core,ReqlyFiles:{setProject(){},list:async()=>[{id:'rfp-a',kind:'rfp',name:'rfp.txt',size:100}]}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),ctx);
  ctx.fixture=existing;
  vm.runInContext("state.projectId='test';state.requirements=structuredClone(fixture);confirmEditorLeave=async()=>true;closeDrawer=async()=>{};saveWorkspace=()=>{};resetFilters=()=>{};render=()=>{};",ctx);
  if(shared)ctx.window.ReqlyShared={enabled:true,saveItems:async(...args)=>requests.push(args)};
  return{api:ctx.window.ReqlyApp,ctx,requests};
}
test('app stores ID-less items with durable evidence and preserves existing user work',async()=>{
  const existing={key:'user-1',id:'SFR-001',name:'기존',description:'기존 원문',sourceOrder:1,status:'확정',questions:[{question:'질의'}],flag:'red'};
  const {api}=app([existing]),candidate=core.validate({items:[raw]},[unit],categories).items[0];
  assert.deepEqual(JSON.parse(JSON.stringify(await api.importAiRequirements('rfp-a',[candidate],'test','Claude'))),{added:1,skipped:0});
  const stored=api.requirements;assert.deepEqual(JSON.parse(JSON.stringify(stored[0])),existing);
  assert.equal(stored[1].id,'');assert.ok(stored[1].key);assert.equal(stored[1].aiEvidence.page,12);assert.equal(stored[1].aiEvidence.assetId,'rfp-a');
  assert.equal((await api.importAiRequirements('rfp-a',[candidate],'test','Claude')).added,0);
});
test('shared import sends only added items and rejects a stale project or missing source',async()=>{
  const candidate=core.validate({items:[raw]},[unit],categories).items[0],{api,requests}=app([],true);
  await assert.rejects(()=>api.importAiRequirements('rfp-a',[candidate],'other','Claude'),/프로젝트/);
  await assert.rejects(()=>api.importAiRequirements('missing',[candidate],'test','Claude'),/RFP/);assert.equal(requests.length,0);
  await api.importAiRequirements('rfp-a',[candidate],'test','Claude');
  assert.equal(requests.length,1);assert.equal(requests[0][0][0].id,'');assert.equal(requests[0][1].document.assetId,'rfp-a');
});
