const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../project-qa-core.js');
test('natural-language personnel profile questions retrieve synonymous original conditions and adjacent exceptions',()=>{
  const sources=core.units('[[PAGE:3]]\n개인별 경력사항은 PL급 이상 인원에 한하여 제출한다.\n[[PAGE:4]]\n단, 추가 참여인력 이력은 계약 체결 후 제출한다.',{filename:'rfp.pdf',assetId:'rfp',kind:'rfp'});
  const result=core.retrieve(sources,'인력 프로필은 모두 제출하나 아니면 PL급만 제출하나?');
  assert.ok(result.units.some(unit=>unit.page===3));assert.ok(result.units.some(unit=>unit.page===4));
  assert.equal(result.units[0].filename,'rfp.pdf');
});
test('retrieval enforces a fixed context budget without sending the full RFP',()=>{
  const sources=Array.from({length:100},(_,index)=>({assetId:'rfp',text:`참여인력 이력사항 ${index} `+'내용'.repeat(600)}));
  const result=core.retrieve(sources,'인력 이력 제출');
  assert.ok(result.characters<=6000);assert.ok(result.units.length<=8);assert.ok(result.units.length<100);
  assert.equal(new Set(result.units.map(unit=>unit.sourceId)).size,result.units.length);
});
test('only cited claims with exact quotes survive; unsupported conclusions become uncertain',()=>{
  const sources=[{sourceId:'e1',text:'PL급 이상 인원에 한하여 제출한다.',page:3,filename:'rfp.pdf'}];
  const answer=core.validate({status:'answered',claims:[{text:'PL급 이상 제출',evidence:[{sourceId:'e1',quote:'PL급 이상 인원에 한하여 제출한다.'}]},{text:'전원 면제',evidence:[{sourceId:'e1',quote:'전원 면제한다.'}]},{text:'허구',evidence:[{sourceId:'fake',quote:'가짜 근거'}]}]},sources);
  assert.equal(answer.claims.length,1);assert.equal(answer.rejected,2);assert.equal(answer.status,'uncertain');assert.equal(answer.claims[0].evidence[0].page,3);
});
test('conflicting conditions preserve both source citations',()=>{
  const sources=[{sourceId:'e1',filename:'RFP',text:'PL급 인력만 제출한다.'},{sourceId:'e2',filename:'회의록',text:'참여인력 전원 제출한다.'}];
  const answer=core.validate({status:'conflict',claims:sources.map(source=>({text:source.text,evidence:[{sourceId:source.sourceId,quote:source.text}]}))},sources);
  assert.equal(answer.status,'conflict');assert.equal(answer.claims.length,2);
});
test('plain text and worksheets retain truthful locations instead of made-up PDF pages',()=>{
  assert.equal(core.units('사업 개요입니다.')[0].page,null);
  assert.equal(core.units('[[SHEET:인력]]\n개인별 경력사항 제출')[0].sheet,'인력');
  assert.equal(core.validate({status:'answered',claims:[]},[]).status,'uncertain');
});
