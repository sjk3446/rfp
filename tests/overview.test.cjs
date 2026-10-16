const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../overview-core.js');

test('overview category and text filters combine without modifying saved items',()=>{
  const items=[{category:'사업기간',title:'기간',content:'계약 후 12개월',quote:'사업기간 12개월'}, {category:'예산·대금',title:'대금',content:'12개월 분할 지급',quote:'분할 지급'}, {category:'사업기간',title:'연장',content:'협의 필요',quote:'협의'}];
  const before=JSON.stringify(items);
  const result=core.filterItems(items,{category:'사업기간',query:'12개월'});
  assert.equal(result.items.length,1);assert.equal(result.matched,2);assert.equal(result.total,3);
  assert.equal(result.counts['예산·대금'],1);assert.equal(result.counts['추진일정'],0);
  assert.equal(core.filterItems(items,{category:'추진일정'}).items.length,0);
  assert.equal(core.filterItems(items).items.length,3);assert.equal(JSON.stringify(items),before);
  assert.equal(core.filterItems(items,{query:'분할'}).items[0],items[1]);
});

test('overview batches cover all document pages including content after requirements',()=>{
  const text='[[PAGE:1]]\n사업개요: 통합 시스템 구축\n[[PAGE:2]]\n'+ '요구사항 본문 '.repeat(5000)+'\n[[PAGE:3]]\n제출기한은 2026년 12월 3일 15:00까지이다.';
  const units=core.batches(text).flat();
  assert.ok(units.length>2);assert.ok(units.some(unit=>unit.page===3&&unit.text.includes('15:00')));
  assert.equal(units.filter(unit=>unit.page===2).map(unit=>unit.text).join(''),'요구사항 본문 '.repeat(5000).trim());
  for(const batch of core.batches(text))assert.ok(batch.reduce((sum,unit)=>sum+unit.text.length,0)<=24000);
});

test('overview handles multiple sheets and never invents physical pages for plain text',()=>{
  const sheet=core.batches('[[SHEET:개요]]\n예산은 1억원\n[[SHEET:일정]]\n사업기간 계약 후 12개월').flat();
  assert.equal(sheet[0].sheet,'개요');assert.equal(sheet[1].sheet,'일정');
  assert.equal(core.batches('사업기간 12개월')[0][0].page,null);
});

test('only known categories with exact source evidence survive validation',()=>{
  const units=core.batches('[[PAGE:7]]\n사업기간은 계약일로부터 12개월이다.').flat();
  const valid={category:'사업기간',title:'수행 기간',content:'계약일로부터 12개월',sourceId:'s1',quote:'사업기간은 계약일로부터 12개월이다.'};
  const result=core.validate({items:[valid,{...valid,quote:'계약일로부터 24개월'}, {...valid,sourceId:'made-up'},{...valid,category:'unknown'}]},units);
  assert.equal(result.items.length,1);assert.equal(result.rejected,3);assert.equal(result.items[0].page,7);
  assert.equal(result.items[0].content,'계약일로부터 12개월');
});

test('merge retains conflicting dates with different evidence and deduplicates repeated identical items',()=>{
  const first={category:'추진일정',content:'제출기한 12월 3일',quote:'제출기한 12월 3일'};
  const other={...first,content:'제출기한 12월 4일',quote:'정정공고: 제출기한 12월 4일'};
  const result=core.merge([{items:[first],rejected:1},{items:[first,other],rejected:0}]);
  assert.equal(result.items.length,2);assert.equal(result.rejected,1);
});

test('sample controls, sample dataset and sample-loading handlers are removed',()=>{
  const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  for(const term of ['sampleRequirements','sampleDocument','sampleButton','emptySample','loadSample']){
    assert.equal(app.includes(term),false);assert.equal(html.includes(term),false);
  }
});

test('empty or malformed overview data cannot be treated as a successful extraction',()=>{
  assert.deepEqual(core.batches('[[PAGE:1]]\n'),[]);
  assert.throws(()=>core.validate({text:'plain response'},[]),/형식/);
});

test('Excel source text retains business rows on structured requirement sheets and other sheets',async()=>{
  const vm=require('node:vm');
  const workbook={SheetNames:['요구사항','사업정보'],Sheets:{'요구사항':[['사업기간','계약 후 12개월'],['요구사항 ID','요구사항 명칭','상세 설명'],['DER-001','화면 설계','화면을 설계해야 한다.']],'사업정보':[['제출기한','2026년 12월 3일 15:00']]}};
  const XLSX={read:()=>workbook,utils:{sheet_to_json:sheet=>sheet}};
  const context={window:{fetch:async()=>{},XLSX,ReqlyDocumentParser:require('../document-parser.js')},XLSX,sessionStorage:{getItem:()=>''},URL,location:{href:'http://localhost/'}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../pages-runtime.js'),'utf8'),context);
  const out=await context.window.ReqlyPortal.extractFile({name:'rfp.xlsx',arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(out.requirements[0].id,'DER-001');assert.match(out.text,/계약 후 12개월/);assert.match(out.text,/2026년 12월 3일 15:00/);assert.match(out.text,/\[\[SHEET:사업정보\]\]/);
});

test('workflow presents one next step and separates analysis completion from saving',()=>{
  assert.equal(core.workflow().activeStep,1);
  assert.equal(core.workflow({hasFile:true}).activeStep,2);
  const ready=core.workflow({hasFile:true,prepared:true,total:5});assert.equal(ready.activeStep,3);assert.equal(ready.remaining,5);
  const review=core.workflow({hasFile:true,prepared:true,draft:true,completed:5,total:5});assert.equal(review.percent,100);assert.equal(review.activeStep,4);assert.equal(review.doneSteps[3],false);assert.match(review.title,/저장 전/);
  const saved=core.workflow({hasFile:true,saved:true,completed:5,total:5});assert.equal(saved.phase,'saved');assert.ok(saved.doneSteps.every(Boolean));
});

test('progress follows completed units only and stays zero while first AI response is pending',()=>{
  assert.equal(core.workflow({hasFile:true,prepared:true,operation:'analyzing',completed:0,total:5}).percent,0);
  assert.equal(core.workflow({hasFile:true,prepared:true,operation:'analyzing',completed:2,total:5}).percent,40);
  assert.equal(core.workflow({hasFile:true,operation:'loading'}).percent,null);
  assert.equal(core.workflow({hasFile:true,operation:'reading',readDone:3,readTotal:10}).percent,30);
  assert.equal(core.workflow({hasFile:true,operation:'saving',total:5,completed:5}).percent,null);
});

test('resume and save failure keep the correct next action without asking for a new AI call',()=>{
  const paused=core.workflow({hasFile:true,prepared:true,completed:2,total:5,errorStage:'analyze',stopped:true});assert.equal(paused.phase,'paused');assert.equal(paused.remaining,3);assert.equal(paused.percent,40);
  const readPaused=core.workflow({hasFile:true,errorStage:'prepare',stopped:true,readDone:3,readTotal:10});assert.equal(readPaused.activeStep,2);assert.equal(readPaused.percent,30);
  const saveFailed=core.workflow({hasFile:true,draft:true,errorStage:'save',completed:5,total:5});assert.equal(saveFailed.activeStep,4);assert.equal(saveFailed.action,'저장 다시 시도');
  const reanalyze=core.workflow({hasFile:true,saved:true,prepared:true,completed:0,total:5});assert.equal(reanalyze.phase,'ready');assert.equal(reanalyze.doneSteps[3],false);
});

test('PDF reader reports actual page completion and cleans up when interrupted',async()=>{
  const vm=require('node:vm');let destroyed=0;
  const pdf={numPages:3,getPage:async()=>({getTextContent:async()=>({items:[]}),cleanup(){}}),destroy:async()=>{destroyed++;}};
  const pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(pdf)})};
  const context={window:{fetch:async()=>{},pdfjsLib,ReqlyDocumentParser:{pdfPageText:()=>({text:'문서 본문'})}},pdfjsLib,sessionStorage:{getItem:()=>''},URL,location:{href:'http://localhost/'}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../pages-runtime.js'),'utf8'),context);
  const progress=[],file={name:'rfp.pdf',arrayBuffer:async()=>new ArrayBuffer(0)};
  await context.window.ReqlyPortal.extractFile(file,{onProgress:step=>progress.push([step.completed,step.total])});
  assert.deepEqual(progress,[[0,3],[1,3],[2,3],[3,3]]);assert.equal(destroyed,1);
  await assert.rejects(()=>context.window.ReqlyPortal.extractFile(file,{onProgress:step=>{if(step.completed===1)throw new Error('중단');}}),/중단/);assert.equal(destroyed,2);
});

test('requirement extraction and classification do not call AI or the native network',async()=>{
  const vm=require('node:vm');let calls=0;
  const context={window:{fetch:async()=>{calls++;throw new Error('network prohibited');},ReqlyPersistentAI:{generate:async()=>{calls++;throw new Error('AI prohibited');}},ReqlyDocumentParser:require('../document-parser.js')},sessionStorage:{getItem:()=>''},URL,Response,TextDecoder,location:{href:'http://localhost/'}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../pages-runtime.js'),'utf8'),context);
  const file=new File(['요구사항 ID: SER-001\n요구사항 명칭: 개인정보 암호화\n상세 설명: 개인정보를 암호화하여야 한다.'],'rfp.txt');
  const response=await context.window.fetch('/api/analyze',{body:file});const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.requirements[0].id,'SER-001');assert.equal(result.requirements[0].category,'보안');assert.equal(calls,0);
});
