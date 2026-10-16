const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../file-runtime.js'),'utf8');

function files(file){
  const window={ReqlyShared:{enabled:true,download:async()=>file}};
  vm.runInNewContext(code,{window,File});
  return window.ReqlyFiles;
}

test('shared PDF original has a viewable MIME type with identical bytes and name',async()=>{
  const input=new File(['%PDF-1.7\nfixture'],'review.PDF');
  const output=await files(input).original('asset');
  assert.equal(output.type,'application/pdf');
  assert.equal(output.name,input.name);
  assert.deepEqual(Buffer.from(await output.arrayBuffer()),Buffer.from(await input.arrayBuffer()));
});

test('original download preserves unknown file types and content',async()=>{
  const input=new File(['fixture'],'review.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const output=await files(input).original('asset');
  assert.equal(output.type,input.type);
  assert.equal(await output.text(),'fixture');
});

test('document cabinet separates documents from sharing and passwords, with no inline original viewer',()=>{
  assert.match(code,/data-file-tab="documents"/);assert.match(code,/data-file-tab="settings"/);
  assert.match(code,/role="tabpanel"/);assert.match(code,/aria-controls="fm-settings"/);
  assert.match(code,/data-files="rfp"/);assert.match(code,/data-files="reference"/);
  assert.match(code,/기본 RFP로 지정/);assert.match(code,/요구사항 추출/);
  assert.match(code,/요구사항을 추출하지 않습니다/);
  assert.equal(code.includes('원문 보기'),false);assert.equal(code.includes('data-preview'),false);assert.equal(code.includes("createElement('iframe')"),false);
});

test('file protections explain admin-only, last RFP and current default restrictions',()=>{
  assert.match(code,/파일 삭제는 관리자만 가능합니다/);
  assert.match(code,/마지막 RFP는 삭제할 수 없습니다/);
  assert.match(code,/다른 RFP를 기본으로 지정한 뒤 삭제/);
  assert.match(code,/del.disabled=!!reason/);
  assert.match(code,/window.ReqlyShared.role!=='admin'\)return/);
});
