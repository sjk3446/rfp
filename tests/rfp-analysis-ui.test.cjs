const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

class Element {
  constructor(tag, doc) { this.tag = tag; this.doc = doc; this.children = []; this.attributes = {}; this.refs = new Map(); this.dataset = {}; this.style = {}; this.value = ''; this.textContent = ''; this.hidden = false; this.className = ''; }
  get classList() { const self=this;return {add(...values){self.className=[...new Set([...self.className.split(' '),...values])].join(' ');},remove(...values){self.className=self.className.split(' ').filter(v=>!values.includes(v)).join(' ');},contains(value){return self.className.split(' ').includes(value);}}; }
  set innerHTML(value) { this.markup=value;this.children=[];this.refs.clear(); }
  get innerHTML() { return this.markup||''; }
  append(...nodes) { for(const node of nodes){node.parent=this;this.children.push(node);if(this.tag==='select'&&!this.value)this.value=node.value;} }
  appendChild(node) { this.append(node);return node; }
  replaceChildren(...nodes) { this.children=[];if(this.tag==='select')this.value='';this.append(...nodes); }
  setAttribute(key,value) { this.attributes[key]=value; }
  removeAttribute(key) { delete this.attributes[key]; }
  get options() { return this.children.filter(node=>node.tag==='option'); }
  before(node) { this.parent?.append(node); }
  remove() { if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this); }
  scrollIntoView() {}
  querySelector(selector) {
    if(this.refs.has(selector))return this.refs.get(selector);
    const attribute=selector.match(/^\[([^=\]]+)/)?.[1];
    const tag=attribute?this.innerHTML.match(new RegExp('<(\\w+)[^>]*\\s'+attribute+'(?:[\\s=>])'))?.[1]:null;
    const node=new Element(tag||(selector.startsWith('.')?'section':'div'),this.doc);
    if(attribute)node.attributes[attribute]='';if(selector.startsWith('.'))node.className=selector.slice(1);
    this.refs.set(selector,node);this.append(node);return node;
  }
  querySelectorAll(selector) { return selector.split(',').map(item=>this.querySelector(item)); }
}
const all=node=>[node,...node.children.flatMap(all)];
const candidate={id:'',name:'기록 보관',category:'보안',quote:'접속 기록을 12개월 보관해야 한다.',description:'접속 기록을 12개월 보관해야 한다.',sourceId:'s1',sourceLabel:'1페이지',page:1,warnings:[]};
const business={category:'사업기간',title:'사업 수행기간',content:'계약일부터 12개월입니다.',quote:'사업기간은 계약일로부터 12개월이다.',sourceId:'s2',sourceLabel:'2페이지',page:2};
function fixture({complete=true,oldOverview=false,persistError='',confirm=true,connected=true,running=false}={}) {
  const doc={initializers:[],addEventListener(type,fn){if(type==='DOMContentLoaded')this.initializers.push(fn);}};
  doc.body=new Element('body',doc);doc.head=new Element('head',doc);doc.createElement=tag=>new Element(tag,doc);
  doc.querySelector=selector=>doc.body.querySelector(selector);doc.getElementById=id=>all(doc.body).find(node=>node.id===id)||doc.body.querySelector('#'+id);
  const listeners=new Map(),counters={prepare:0,analyze:0,save:0,original:0,import:0,confirm:0,saveOverview:0};
  const app={projectId:'project-a',requirements:[],categories:['보안','기타'],document:{assetId:'asset-a',overviewByAsset:{}},async importAiRequirements(assetId,items){counters.import++;this.requirements.push(...items);return{added:items.length,skipped:0};},async saveOverview(id,result,expected){counters.saveOverview++;assert.equal(expected,this.document.overviewByAsset[id]?.savedAt||'');this.document.overviewByAsset[id]={...result,savedAt:'2026-10-27T03:00:00Z'};}};
  if(oldOverview)app.document.overviewByAsset['asset-a']={items:[business],sourceName:'legacy.pdf',completedBatches:1,totalBatches:1,savedAt:'2026-10-26T03:00:00Z'};
  let record=complete===null?null:{projectId:'project-a',assetId:'asset-a',file:{name:'rfp.pdf',size:100},analysisId:'analysis-a',characters:100,pages:2,batchCount:2,completedBatches:complete?2:0,complete,requirements:complete?[candidate]:[],overview:complete?[business]:[],rejectedRequirements:0,rejectedOverview:0,model:'Gemini test',analyzedAt:'2026-10-27T02:00:00Z',savedAt:persistError?'':'2026-10-27T02:00:00Z',persistError};
  const service={get:()=>record,isRunning:()=>running,progress:value=>value.complete?100:0,async prepare(projectId,assetId,options){counters.prepare++;assert.equal(options.force,!!record);record={...record,projectId,assetId,file:{name:'rfp.pdf',size:100},analysisId:'analysis-new',characters:100,pages:2,batchCount:2,completedBatches:0,complete:false,requirements:[],overview:[]};options.onProgress?.({completed:2,total:2});return record;},async analyze(value,options){counters.analyze++;options.onEvent?.({type:'request',index:0});Object.assign(value,{complete:true,completedBatches:2,requirements:[candidate],overview:[business],model:'Gemini test',savedAt:'2026-10-27T02:00:00Z',analyzedAt:'2026-10-27T02:00:00Z',persistError:''});options.onEvent?.({type:'completed',index:1});return value;},async save(value){counters.save++;value.persistError='';value.savedAt='2026-10-27T02:00:00Z';return value;}};
  const window={ReqlyApp:app,ReqlyOverviewCore:require('../overview-core.js'),ReqlyRequirementAI:require('../requirement-ai-core.js'),ReqlyRfpAnalysis:service,ReqlyPersistentAI:{getConnectionInfo:async()=>({connected,label:connected?'Gemini test':''}),generate(){throw new Error('UI must use the shared analysis service');}},ReqlyDesign:{confirm:async()=>{counters.confirm++;return confirm;}},ReqlyFiles:{setProject(){},list:async()=>[{id:'asset-a',name:'rfp.pdf',kind:'rfp',size:100}],original:async()=>{counters.original++;throw new Error('Reopening saved results must not load the original');}},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);}};
  const context={window,document:doc,URL,Blob,Date,Map,Set,setInterval:()=>1,clearInterval(){},confirm:()=>confirm};
  for(const file of ['overview-runtime.js','requirement-ai-runtime.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
  for(const init of doc.initializers)init();
  const overview=all(doc.body).find(node=>node.markup?.includes('aria-label="사업 정보"'));
  const requirements=all(doc.body).find(node=>node.markup?.includes('aria-label="AI 요구사항 추출"'));
  return{app,window,counters,overview,requirements,record:()=>record,setRunning(value){running=value;for(const fn of listeners.get('reqly-rfp-analysis-update')||[])fn({detail:{projectId:'project-a',assetId:'asset-a'}});},async openOverview(){await doc.getElementById('businessInfoButton').onclick();},async openRequirements(){await window.ReqlyRequirementExtraction.open('asset-a');}};
}

test('both menus reopen one saved analysis without reading the original or invoking AI',async()=>{
  const f=fixture({connected:false});await f.openRequirements();await f.openOverview();await f.openRequirements();
  assert.equal(f.counters.prepare,0);assert.equal(f.counters.original,0);assert.equal(f.counters.analyze,0);
  assert.ok(all(f.requirements.querySelector('[data-ai-results]')).some(node=>node.textContent==='기록 보관'));
  assert.ok(all(f.overview.querySelector('[data-overview-results]')).some(node=>node.textContent==='사업 수행기간'));
  assert.equal(f.app.requirements.length,0);assert.equal(f.counters.saveOverview,0);
  assert.equal(f.overview.querySelector('[data-flow-ai]').textContent,'저장된 결과 열람 가능');
});

test('analysis from requirements prepares business information and only selected candidates are imported',async()=>{
  const f=fixture({complete:false});await f.openRequirements();await f.requirements.querySelector('[data-ai-analyze]').onclick();
  await f.openOverview();assert.equal(f.counters.analyze,1);assert.equal(f.counters.prepare,0);assert.equal(f.app.requirements.length,0);
  f.requirements.querySelector('[data-ai-all]').onchange({target:{checked:true}});await f.requirements.querySelector('[data-ai-apply]').onclick();
  assert.equal(f.counters.import,1);assert.equal(f.app.requirements.length,1);assert.equal(f.counters.analyze,1);
});

test('analysis from business information prepares requirement candidates and retains explicit overview save',async()=>{
  const f=fixture({complete:false});await f.openOverview();await f.overview.querySelector('[data-overview-analyze]').onclick();await f.openRequirements();
  assert.equal(f.counters.analyze,1);assert.equal(f.app.requirements.length,0);assert.equal(f.counters.saveOverview,0);
  await f.overview.querySelector('[data-overview-save]').onclick();assert.equal(f.counters.saveOverview,1);
  assert.equal(f.app.document.overviewByAsset['asset-a'].analysisId,'analysis-a');await f.openOverview();
  assert.equal(f.overview.querySelector('[data-overview-save]').hidden,true);assert.equal(f.counters.analyze,1);
});

test('declining explicit reanalysis preserves the shared completed result',async()=>{
  const f=fixture({confirm:false});await f.openRequirements();await f.requirements.querySelector('[data-ai-read]').onclick();await f.openOverview();await f.overview.querySelector('[data-overview-prepare]').onclick();
  assert.equal(f.counters.confirm,2);assert.equal(f.counters.prepare,0);assert.equal(f.record().complete,true);assert.equal(f.counters.analyze,0);
});

test('explicit reanalysis preparation preserves the published overview until another save',async()=>{
  const f=fixture({oldOverview:true});const before=JSON.stringify(f.app.document.overviewByAsset);
  await f.openOverview();await f.overview.querySelector('[data-overview-prepare]').onclick();
  assert.equal(f.counters.confirm,1);assert.equal(f.counters.prepare,1);assert.equal(f.counters.analyze,0);
  assert.equal(JSON.stringify(f.app.document.overviewByAsset),before);assert.equal(f.record().complete,false);
  assert.equal(f.overview.querySelector('[data-flow-percent]').textContent,'0%');
});

test('legacy standalone business information remains visible without creating a new analysis',async()=>{
  const f=fixture({complete:null,oldOverview:true});await f.openOverview();
  assert.ok(all(f.overview.querySelector('[data-overview-results]')).some(node=>node.textContent==='사업 수행기간'));
  assert.equal(f.counters.analyze,0);assert.equal(f.counters.original,0);assert.equal(f.overview.querySelector('[data-overview-save]').hidden,true);
});

test('failed shared-result persistence can be retried without another AI analysis',async()=>{
  const f=fixture({persistError:'저장 실패'});await f.openRequirements();assert.equal(f.requirements.querySelector('[data-ai-save]').hidden,false);
  await f.requirements.querySelector('[data-ai-save]').onclick();assert.equal(f.counters.save,1);assert.equal(f.counters.analyze,0);assert.equal(f.requirements.querySelector('[data-ai-save]').hidden,true);
});


test('the other analysis menu cannot start or reset the same in-flight analysis',async()=>{
  const f=fixture({complete:false,running:true});await f.openRequirements();await f.openOverview();
  assert.equal(f.requirements.querySelector('[data-ai-analyze]').disabled,true);
  assert.equal(f.overview.querySelector('[data-overview-analyze]').disabled,true);
  await f.requirements.querySelector('[data-ai-analyze]').onclick();await f.overview.querySelector('[data-overview-prepare]').onclick();
  assert.equal(f.counters.analyze,0);assert.equal(f.counters.prepare,0);assert.equal(f.counters.confirm,0);
  f.setRunning(false);assert.equal(f.requirements.querySelector('[data-ai-analyze]').disabled,false);
  assert.equal(f.overview.querySelector('[data-overview-analyze]').disabled,false);
});

test('changing a candidate checkbox retains rendered cards and updates the import action',async()=>{
  const f=fixture();await f.openRequirements();const area=f.requirements.querySelector('[data-ai-results]');
  const card=area.children[0],checkbox=all(card).find(node=>node.type==='checkbox');checkbox.checked=true;checkbox.onchange();
  assert.equal(area.children[0],card);assert.equal(f.requirements.querySelector('[data-ai-apply]').textContent,'선택한 1개 목록에 추가');
  assert.equal(f.requirements.querySelector('[data-ai-apply]').disabled,false);assert.equal(f.counters.analyze,0);
});
