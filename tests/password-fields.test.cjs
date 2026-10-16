const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');

function formClient(){
  const nodes=[];
  function element(tag){const node={tag,style:{},children:[],attributes:{},value:'',hidden:false,append(...children){this.children.push(...children);},setAttribute(name,value){this.attributes[name]=value;},remove(){this.removed=true;},focus(){this.focused=true;}};nodes.push(node);return node;}
  const body=element('body');
  const context={crypto:webcrypto,URLSearchParams,location:{search:''},window:{REQLY_CLOUD:{},ReqlySharedCore:{}},document:{createElement:element,body}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../shared-runtime.js'),'utf8'),context);
  return{api:context.window.ReqlyShared,nodes,inputs:()=>nodes.filter(node=>node.tag==='input'),form:()=>nodes.find(node=>node.tag==='form'),error:()=>nodes.find(node=>node.attributes.role==='alert'),submit(){this.form().onsubmit({preventDefault(){}});}};
}
const definitions=[{label:'이름'},{label:'관리자용 비밀번호',password:true},{label:'관리자용 비밀번호 확인',password:true,mustMatch:1},{label:'사용자용 비밀번호',password:true,differentFrom:1},{label:'사용자용 비밀번호 확인',password:true,mustMatch:3}];

test('all password fields are initially masked and each has its own non-submit visibility toggle',async()=>{
  const c=formClient(),pending=c.api.fields('새 프로젝트',definitions);
  const passwords=c.inputs().slice(1),toggles=c.nodes.filter(node=>node.tag==='button'&&node.attributes['aria-controls']);
  assert.equal(toggles.length,4);passwords.forEach(input=>assert.equal(input.type,'password'));
  assert.equal(toggles[0].type,'button');toggles[0].onclick();assert.equal(passwords[0].type,'text');assert.equal(toggles[0].attributes['aria-pressed'],'true');assert.equal(passwords[1].type,'password');
  toggles[0].onclick();assert.equal(passwords[0].type,'password');assert.equal(toggles[0].textContent,'보기');
  c.nodes.find(node=>node.tag==='button'&&node.textContent==='취소').onclick();assert.equal(await pending,null);
});

test('admin or user confirmation mismatch keeps the form open and preserves entered values',async()=>{
  const c=formClient(),pending=c.api.fields('새 프로젝트',definitions),inputs=c.inputs();
  ['테스트','admin-value','typo','user-value','user-value'].forEach((value,index)=>inputs[index].value=value);
  c.submit();assert.equal(c.error().hidden,false);assert.match(c.error().textContent,/관리자용 비밀번호 확인/);assert.equal(inputs[2].focused,true);assert.equal(inputs[1].value,'admin-value');
  inputs[2].value='admin-value';inputs[4].value='another-typo';inputs[2].oninput();c.submit();assert.match(c.error().textContent,/사용자용 비밀번호 확인/);
  inputs[4].value='user-value';inputs[4].oninput();assert.equal(c.error().hidden,true);c.submit();
  assert.deepEqual(Array.from(await pending),['테스트','admin-value','admin-value','user-value','user-value']);assert.ok(inputs.every(input=>input.value===''));
});

test('identical admin and user passwords are rejected without clearing the form',async()=>{
  const c=formClient(),pending=c.api.fields('새 프로젝트',definitions),inputs=c.inputs();
  ['테스트','same','same','same','same'].forEach((value,index)=>inputs[index].value=value);c.submit();assert.match(c.error().textContent,/서로 다르게/);assert.equal(inputs[3].value,'same');
  c.nodes.find(node=>node.tag==='button'&&node.textContent==='취소').onclick();await pending;
});

test('password changes validate the new password pair and cancel clears revealed text',async()=>{
  const c=formClient(),pending=c.api.fields('비밀번호 변경',[{label:'현재 비밀번호',password:true},{label:'새 비밀번호',password:true},{label:'새 비밀번호 확인',password:true,mustMatch:1}]),inputs=c.inputs();
  ['old-value','new-value','typo'].forEach((value,index)=>inputs[index].value=value);c.submit();assert.match(c.error().textContent,/새 비밀번호 확인/);
  c.nodes.find(node=>node.attributes['aria-controls']===inputs[1].id).onclick();assert.equal(inputs[1].type,'text');
  c.nodes.find(node=>node.tag==='button'&&node.textContent==='취소').onclick();assert.equal(await pending,null);assert.ok(inputs.every(input=>input.value===''&&input.type==='password'));
});

test('project creation renders both confirmation fields before any server request',async()=>{
  const c=formClient(),pending=c.api.create(),inputs=c.inputs();
  assert.equal(inputs.length,5);assert.equal(inputs[1].autocomplete,'new-password');assert.equal(inputs[4].autocomplete,'new-password');
  c.nodes.find(node=>node.tag==='button'&&node.textContent==='취소').onclick();await assert.rejects(pending,/취소/);
});
