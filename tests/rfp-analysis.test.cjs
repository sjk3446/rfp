const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {createService,validateCombined}=require('../rfp-analysis.js');
const overview=require('../overview-core.js');
const clone=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({text='[[PAGE:1]]\n사업기간은 계약일로부터 12개월입니다. 수행자는 보고서를 제출하여야 합니다.\n'.repeat(2),saved,request}={}){
  const counts={read:0,extract:0,ai:0,save:0},events=[],snapshots=[],documents={p:{rfpAnalysisByAsset:saved||{}}};let stamp=0,failSave=false,connected=true;
  const app={projectId:'p',categories:['기능','기타'],get document(){return documents[this.projectId]||{};},async saveRfpAnalysis(assetId,value,projectId,expectedSavedAt){
    assert.equal(projectId,this.projectId);if(failSave)throw Error('저장 연결 오류');
    const previous=this.document.rfpAnalysisByAsset?.[assetId];assert.equal(expectedSavedAt,previous?.savedAt||'');
    counts.save++;const next={...clone(value),savedAt:'2026-10-27T00:00:'+String(++stamp).padStart(2,'0')+'.000Z'};
    this.document.rfpAnalysisByAsset[assetId]=next;snapshots.push(next);return next;
  }};
  const response=payload=>({requirements:payload.units.map(unit=>({id:'',name:'요구사항 '+unit.sourceId,category:'기능',sourceId:unit.sourceId,quote:unit.text.slice(0,80)})),overview:payload.units.map(unit=>({category:'사업기간',title:'기간 '+unit.sourceId,content:'계약 기간과 수행 조건 확인',sourceId:unit.sourceId,quote:unit.text.slice(0,80)}))});
  const env={app:()=>app,crypto:webcrypto,notify:event=>events.push(event),files:()=>({setProject(){},async original(assetId){counts.read++;return{name:assetId+'.pdf',size:text.length,type:'application/pdf'};}}),portal:()=>({async extractFile(){counts.extract++;return{text,pages:2};}}),ai:()=>({async getConnectionInfo(){return{connected,label:'Test model'};},async generate(task,payload){assert.equal(task,'rfpAnalysis');counts.ai++;return request?request(payload,counts.ai,response):response(payload);}})};
  return{service:createService(env),env,app,counts,events,snapshots,setText:value=>{text=value;},failSave:value=>{failSave=value;},connect:value=>{connected=value;}};
}

test('combined response applies both source validators and never invents IDs',()=>{
  const units=[{sourceId:'s1',label:'1페이지',page:1,sheet:'',text:'수행자는 모든 자료를 제출하여야 합니다.'}];
  const value=validateCombined({requirements:[{id:'SFR-999',name:'자료 제출',category:'기능',sourceId:'s1',quote:units[0].text},{name:'근거 없음',sourceId:'s1',quote:'원문에 없는 설명'}],overview:[{category:'제출서류·제출방법',title:'제출 자료',content:'모든 자료 제출',sourceId:'s1',quote:units[0].text},{category:'사업기간',title:'추측',content:'3개월',sourceId:'missing',quote:'없는 근거'}]},units,['기능','기타']);
  assert.equal(value.requirements.items.length,1);assert.equal(value.requirements.items[0].id,'');assert.equal(value.requirements.rejected,1);assert.equal(value.overview.items.length,1);assert.equal(value.overview.rejected,1);
  assert.throws(()=>validateCombined({requirements:[]},units,[]),{code:'INVALID_JSON'});
});

test('one analysis generates both results and concurrent menus share extraction and requests',async()=>{
  const f=fixture();const [a,b]=await Promise.all([f.service.prepare('p','rfp'),f.service.prepare('p','rfp')]);assert.equal(a,b);assert.equal(f.counts.read,1);assert.equal(f.counts.extract,1);
  const [first,second]=await Promise.all([f.service.analyze(a),f.service.analyze(b)]);assert.equal(first,second);assert.equal(f.counts.ai,1);assert.ok(first.requirements.length);assert.ok(first.overview.length);assert.equal(first.complete,true);assert.equal(f.service.progress(first),100);
  assert.ok(first.savedAt);assert.equal(f.counts.save,1);assert.ok(f.events.length);await f.service.analyze(first);assert.equal(f.counts.ai,1);assert.equal(f.counts.save,1);
});

test('saved completed result loads on another device without AI, source reading or API connection',async()=>{
  const f=fixture();await f.service.analyze(await f.service.prepare('p','rfp'));
  const other=fixture({saved:clone(f.app.document.rfpAnalysisByAsset)});other.connect(false);const loaded=other.service.get('p','rfp');assert.equal(loaded.complete,true);assert.equal(loaded.requirements.length,f.service.get('p','rfp').requirements.length);assert.ok(loaded.overview.length);
  await other.service.analyze(loaded);assert.deepEqual(other.counts,{read:0,extract:0,ai:0,save:0});
  const snapshot=other.service.snapshot(loaded);assert.equal(JSON.stringify(snapshot).includes('"text":'),false);assert.equal(snapshot.file,undefined);assert.equal(snapshot.checked,undefined);assert.equal(snapshot.batchResults,undefined);
});

test('same immutable asset reuses verified results, changed content or another asset starts a separate analysis',async()=>{
  const f=fixture();const initial=await f.service.analyze(await f.service.prepare('p','rfp'));
  const other=fixture({saved:clone(f.app.document.rfpAnalysisByAsset)});const same=await other.service.prepare('p','rfp');assert.equal(same.analysisId,initial.analysisId);assert.equal(same.complete,true);assert.equal(other.counts.ai,0);
  other.setText('[[PAGE:1]]\n수행자는 새로운 보안자료를 제출하여야 합니다.');const changed=await other.service.prepare('p','rfp',{force:true});assert.notEqual(changed.contentHash,initial.contentHash);assert.notEqual(changed.analysisId,initial.analysisId);assert.equal(changed.complete,false);assert.equal(changed.requirements.length,0);
  assert.equal(other.app.document.rfpAnalysisByAsset.rfp.analysisId,initial.analysisId,'old snapshot retained until new save');
  const second=await other.service.prepare('p','rfp2');assert.notEqual(second.analysisId,changed.analysisId);assert.equal(second.assetId,'rfp2');
});

test('different content under the same asset cannot hydrate an old saved result',async()=>{
  const f=fixture();await f.service.analyze(await f.service.prepare('p','rfp'));
  const other=fixture({saved:clone(f.app.document.rfpAnalysisByAsset),text:'[[PAGE:2]]\n완전히 새로운 문서이며 기존 사업기간은 적용하지 않습니다.'});const prepared=await other.service.prepare('p','rfp');assert.equal(prepared.complete,false);assert.equal(prepared.requirements.length,0);assert.notEqual(prepared.contentHash,f.service.get('p','rfp').contentHash);
});

test('output limit splits preserve all source characters and already completed batch results',async()=>{
  const text='[[PAGE:1]]\n'+'첫째 페이지 의무 자료 제출. '.repeat(400)+'\n[[PAGE:2]]\n'+'둘째 페이지 사업기간 조건. '.repeat(400);
  const f=fixture({text,request:(payload,attempt,response)=>{if(attempt===2)throw Object.assign(Error('output limit'),{code:'OUTPUT_LIMIT'});return response(payload);}});
  const record=await f.service.prepare('p','rfp'),original=record.batches.flat().map(unit=>unit.text).join('');await f.service.analyze(record);
  assert.equal(record.splitCount,1);assert.equal(record.batches.flat().map(unit=>unit.text).join(''),original);assert.equal(record.complete,true);assert.equal(f.counts.ai,record.batchCount+1);assert.equal(record.results[0].requirements.items[0].name,'요구사항 s1');assert.equal(record.completedBatches,record.batchCount);
});

test('partial checkpoint resumes on another device without replaying completed requests',async()=>{
  const text='[[PAGE:1]]\n'+'첫째 의무 설명과 사업기간. '.repeat(350)+'\n[[PAGE:2]]\n'+'둘째 의무 설명과 수행조건. '.repeat(350);
  const first=fixture({text,request:(payload,attempt,response)=>{if(attempt===2)throw Object.assign(Error('quota'),{code:'QUOTA'});return response(payload);}}),record=await first.service.prepare('p','rfp');
  await assert.rejects(first.service.analyze(record),/quota/);assert.equal(record.completedBatches,1);assert.ok(record.savedAt);assert.equal(record.complete,false);assert.ok(first.snapshots[0].batchResults);assert.equal(JSON.stringify(first.snapshots[0]).includes('"text":'),false);
  const second=fixture({text,saved:clone(first.app.document.rfpAnalysisByAsset)}),restored=second.service.get('p','rfp');assert.equal(restored.completedBatches,1);await second.service.analyze(restored);
  assert.equal(second.counts.ai,restored.batchCount-1);assert.equal(restored.complete,true);assert.ok(restored.requirements.length);assert.ok(restored.overview.length);
});

test('save failures preserve completed results and retry storage with zero extra AI requests',async()=>{
  const f=fixture(),record=await f.service.prepare('p','rfp');f.failSave(true);await assert.rejects(f.service.analyze(record),/저장 연결 오류/);assert.equal(record.complete,true);assert.ok(record.persistError);assert.ok(record.requirements.length);assert.equal(f.counts.ai,1);
  f.failSave(false);await f.service.save(record);assert.ok(record.savedAt);assert.equal(record.persistError,'');assert.equal(f.counts.ai,1);assert.equal(f.counts.save,1);
});

test('project switching while AI responds cannot accept or save the stale response',async()=>{
  let release;const f=fixture({request:(payload,attempt,response)=>new Promise(resolve=>{release=()=>resolve(response(payload));})});const record=await f.service.prepare('p','rfp'),work=f.service.analyze(record);while(!release)await tick();
  f.app.projectId='other';release();await assert.rejects(work,{code:'STALE_PROJECT'});assert.equal(record.results.filter(Boolean).length,0);assert.equal(f.counts.save,0);assert.equal(f.service.get('p','rfp'),null);
});

test('stop after a successful response saves it and resumes only the remaining batches',async()=>{
  const text='[[PAGE:1]]\n'+'원문에서 수행자가 제출하는 자료와 기간. '.repeat(600);let stopped=false;
  const f=fixture({text}),record=await f.service.prepare('p','rfp');await assert.rejects(f.service.analyze(record,{shouldStop:()=>stopped,onEvent:event=>{if(event.type==='completed')stopped=true;}}),{code:'AI_STOPPED'});
  assert.equal(record.completedBatches,1);assert.ok(record.savedAt);stopped=false;await f.service.analyze(record);assert.equal(f.counts.ai,record.batchCount);assert.equal(record.complete,true);
});

test('operation status and events cover analysis start, completion and failure for both menus',async()=>{
  let release,shouldFail=false;const states=[];
  const f=fixture({request:(payload,attempt,response)=>new Promise((resolve,reject)=>{release=()=>shouldFail?reject(Error('network failure')):resolve(response(payload));})});
  const service=createService({...f.env,notify:event=>states.push({projectId:event.projectId,assetId:event.assetId,running:service.isRunning(event.projectId,event.assetId)})});
  const reading=service.prepare('p','rfp');assert.equal(service.isRunning('p','rfp'),true);const record=await reading;assert.equal(service.isRunning('p','rfp'),false);
  assert.ok(states.some(event=>event.running));assert.equal(states.at(-1).running,false);
  states.length=0;const work=service.analyze(record);assert.equal(service.isRunning('p','rfp'),true);assert.equal(service.isRunning('p','different'),false);while(!release)await tick();
  release();await work;assert.equal(service.isRunning('p','rfp'),false);assert.equal(states[0].running,true);assert.equal(states.at(-1).running,false);
  const next=await service.prepare('p','rfp',{force:true});release=undefined;shouldFail=true;states.length=0;const failure=service.analyze(next);while(!release)await tick();release();await assert.rejects(failure,/network failure/);
  assert.equal(service.isRunning('p','rfp'),false);assert.equal(states.at(-1).running,false);
});
