const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loader(){
  const scripts=[],timers=new Map();let timer=0;
  const context={window:{},document:{createElement(){return{remove(){this.removed=true;}};},head:{append(script){scripts.push(script);}}},
    setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../parser-libraries.js'),'utf8'),context);
  return{context,scripts,timers,load:context.window.ReqlyParserLibraries.load};
}
test('parser tools do not download on startup and concurrent requests share one load',async()=>{
  const b=loader();assert.equal(b.scripts.length,0);
  const first=b.load('XLSX'),second=b.load('XLSX');assert.equal(first,second);assert.equal(b.scripts.length,1);
  b.context.window.XLSX={ready:true};b.scripts[0].onload();
  assert.equal(await first,b.context.window.XLSX);await b.load('XLSX');assert.equal(b.scripts.length,1);assert.equal(b.timers.size,0);
});
test('parser load failures and timeouts allow retry without refreshing the page',async()=>{
  const b=loader();const first=b.load('pdfjsLib');b.scripts[0].onerror();await assert.rejects(first,/다시 시도/);
  const second=b.load('pdfjsLib');assert.equal(b.scripts.length,2);[...b.timers.values()][0]();await assert.rejects(second,/다시 시도/);
  const third=b.load('pdfjsLib');b.context.window.pdfjsLib={};b.scripts[2].onload();await third;
  assert.ok(b.scripts[0].removed&&b.scripts[1].removed);
});
test('an unknown parser never creates a script',async()=>{
  const b=loader();await assert.rejects(b.load('__proto__'),/지원하지/);assert.equal(b.scripts.length,0);
});

const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function searchContext(){
  const state={requirements:[],query:'',category:'all',status:'all',priority:'all',flag:'all',sort:'id',sortDirection:1};
  const context={state,FLAG_ORDER:{'':0,red:1,blue:5},matchesIdPath:()=>true};
  vm.runInNewContext(source.slice(source.indexOf('const requirementSearchIndex'),source.indexOf('\nfunction render()')),context);
  return context;
}
test('search skips indexing when empty and reuses full text for later queries',()=>{
  const ctx=searchContext();let reads=0;
  ctx.state.requirements=[{id:'SFR-002',name:'검증',get description(){reads++;return '앞부분 '.repeat(300)+'마지막 근거';},questions:[{question:'인력 프로필',answer:'PL 제출'}],manualGlossary:[{term:'ETL',meaning:'데이터 변환'}]}];
  assert.equal(ctx.filteredRequirements().length,1);assert.equal(reads,0);
  for(const query of ['마지막 근거','pl 제출','etl','데이터 변환']){ctx.state.query=query;assert.equal(ctx.filteredRequirements().length,1);}
  assert.equal(reads,1);
  ctx.state.requirements=[{...ctx.state.requirements[0],description:'수정된 원문',questions:[],manualGlossary:[]}];
  ctx.state.query='마지막 근거';assert.equal(ctx.filteredRequirements().length,0);
  ctx.state.query='수정된 원문';assert.equal(ctx.filteredRequirements().length,1);
});
test('numeric ID ordering, source ordering and flag filters retain their semantics',()=>{
  const ctx=searchContext();ctx.state.requirements=[{id:'SFR-10',sourceOrder:1,flag:'red'},{id:'SFR-2',sourceOrder:2,flag:''}];
  assert.equal(ctx.filteredRequirements()[0].id,'SFR-2');ctx.state.sort='sourceOrder';assert.equal(ctx.filteredRequirements()[0].id,'SFR-10');
  ctx.state.flag='none';assert.equal(ctx.filteredRequirements().length,1);assert.equal(ctx.filteredRequirements()[0].id,'SFR-2');
});
