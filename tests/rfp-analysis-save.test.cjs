const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../app.js'),'utf8'),method=code.slice(code.indexOf('  async saveRfpAnalysis('),code.indexOf('  async importAiRequirements('));
function fixture(mode='normal'){
 const state={projectId:'p',references:['ref'],document:{name:'RFP',qaHistory:[{id:'q'}],overviewByAsset:{old:'keep'}}},asset={id:'a',kind:'rfp'},sent=[];
 const ctx={state,structuredClone,saveWorkspace(){},window:{ReqlyFiles:{setProject(){},async list(){return[asset];}},ReqlyShared:{enabled:true,project:{workspace:{assets:[asset]}},async refresh(){if(mode==='deleted')this.project.workspace.assets=[];else state.document.other='new';},async saveItems(items,meta){sent.push(meta);if(mode!=='normal'&&sent.length===1)throw Object.assign(Error('conflict'),{code:'CONFLICT'});state.document=meta.document;}}}};
 return{app:vm.runInNewContext(`({${method}})`,ctx),state,sent,ctx};
}
const snapshot={schemaVersion:1,projectId:'p',assetId:'a',sourceName:'RFP',complete:true,requirements:[],overview:[]};
test('analysis checkpoint preserves current questions, overview, references and other fields',async()=>{const f=fixture();const saved=await f.app.saveRfpAnalysis('a',snapshot,'p','');assert.ok(saved.savedAt);assert.equal(f.state.document.qaHistory[0].id,'q');assert.equal(f.state.document.overviewByAsset.old,'keep');assert.deepEqual(f.sent[0].references,['ref']);assert.equal(f.sent.length,1);});
test('metadata conflict refresh keeps unrelated concurrent fields, but removed source prevents retry',async()=>{const f=fixture('conflict');await f.app.saveRfpAnalysis('a',snapshot,'p','');assert.equal(f.state.document.other,'new');assert.equal(f.sent.length,2);const gone=fixture('deleted');await assert.rejects(()=>gone.app.saveRfpAnalysis('a',snapshot,'p',''),/삭제/);assert.equal(gone.sent.length,1);});
test('different analysis revision and wrong project are rejected without writes',async()=>{const f=fixture();f.state.document.rfpAnalysisByAsset={a:{savedAt:'other'}};await assert.rejects(()=>f.app.saveRfpAnalysis('a',snapshot,'p',''),/먼저 저장/);await assert.rejects(()=>f.app.saveRfpAnalysis('a',snapshot,'other',''),/프로젝트/);assert.equal(f.sent.length,0);});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function localFixture(){
 const f=fixture();f.ctx.window.ReqlyShared.enabled=false;f.state.requirements=[{key:'existing',name:'기존 요구사항'}];
 const writes=[];let complete,reject;
 f.ctx.window.ReqlyPortal={saveNow(workspace){writes.push(structuredClone(workspace));return new Promise((resolve,fail)=>{complete=resolve;reject=fail;});}};
 return{...f,writes,complete:()=>complete(),fail:()=>reject(new Error('로컬 저장 실패'))};
}

test('local analysis saving awaits durable storage and preserves all existing workspace fields',async()=>{
 const f=localFixture(),before=structuredClone(f.state.document);let finished=false;
 const work=f.app.saveRfpAnalysis('a',snapshot,'p','').then(value=>{finished=true;return value;});await tick();
 assert.equal(finished,false);assert.deepEqual(f.state.document,before);assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].projectId,'p');assert.deepEqual(f.writes[0].requirements,[{key:'existing',name:'기존 요구사항'}]);assert.deepEqual(f.writes[0].references,['ref']);assert.equal(f.writes[0].document.qaHistory[0].id,'q');
 f.complete();const saved=await work;assert.ok(saved.savedAt);assert.equal(f.state.document.rfpAnalysisByAsset.a.savedAt,saved.savedAt);assert.equal(f.state.document.overviewByAsset.old,'keep');
});

test('a failed local write cannot mark analysis saved or replace the previous document',async()=>{
 const f=localFixture(),previous=f.state.document,work=f.app.saveRfpAnalysis('a',snapshot,'p','');const rejection=assert.rejects(work,/로컬 저장 실패/);await tick();f.fail();await rejection;
 assert.equal(f.state.document,previous);assert.equal(f.state.document.rfpAnalysisByAsset,undefined);assert.equal(f.writes.length,1);
});

test('switching projects during local analysis storage never contaminates the new project state',async()=>{
 const f=localFixture(),work=f.app.saveRfpAnalysis('a',snapshot,'p','');const rejection=assert.rejects(work,/프로젝트가 변경/);await tick();
 const next={name:'다른 프로젝트',rfpAnalysisByAsset:{b:{analysisId:'keep'}}};f.state.projectId='other';f.state.document=next;f.state.requirements=[{key:'other'}];f.state.references=['other-ref'];f.complete();await rejection;
 assert.equal(f.state.projectId,'other');assert.equal(f.state.document,next);assert.deepEqual(f.state.requirements,[{key:'other'}]);assert.deepEqual(f.state.references,['other-ref']);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].projectId,'p');assert.equal(f.writes[0].document.rfpAnalysisByAsset.a.assetId,'a');
});
