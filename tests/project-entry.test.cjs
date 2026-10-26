const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const directory=require('../project-directory.js');
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};this.value='';this.textContent='';}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  appendChild(node){this.append(node);return node;}
  setAttribute(key,value){this.attributes[key]=value;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
}
const all=node=>[node,...node.children.flatMap(all)];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function browser({query='',projects=true,fail=false}={}){
  const body=new Element('body'),listeners={},requests=[],cache=new Map();let nonce,loginCount=0;
  const storage={getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value)};
  if(projects)for(const letter of ['a','b','c'])directory.create(storage).remember({id:letter.repeat(64),name:'프로젝트 '+letter,updatedAt:'2026-10-26T00:00:00Z'});
  const location=new URL('https://sjk3446.github.io/rfp/'+query);
  const peer={postMessage(message){const r=message.request;requests.push(r);let result;
    if(r.action==='challenge')result={ok:true,value:{salt:'0'.repeat(64)}};
    else if(r.action==='login'){
      loginCount++;
      result=fail&&loginCount===1?{ok:false,code:'AUTH',error:'비밀번호가 일치하지 않습니다.'}:{ok:true,value:{project:{id:r.id,name:'프로젝트 '+r.id[0],version:1,workspace:{requirements:[]}},role:'user',token:'fixture'}};
    }else result={ok:false,error:'Unexpected '+r.action};
    queueMicrotask(()=>listeners.message({origin:'https://n-test-script.googleusercontent.com',source:peer,data:{channel:'reqly-drive-v1',nonce,requestId:message.requestId,result}}));
  }};
  body.appendChild=frame=>{body.append(frame);nonce=new URL(frame.src).searchParams.get('channel');queueMicrotask(()=>listeners.message({origin:'https://n-test-script.googleusercontent.com',source:peer,data:{channel:'reqly-drive-v1',nonce,ready:true}}));};
  const context={URL,URLSearchParams,crypto:{randomUUID:webcrypto.randomUUID.bind(webcrypto),getRandomValues:webcrypto.getRandomValues.bind(webcrypto),subtle:{importKey:async()=>({}),deriveBits:async()=>new Uint8Array(32).buffer}},TextEncoder,Uint8Array,CustomEvent,Map,Date,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},location,history:{replaceState(_,__,url){location.href=String(url);}},document:{body,hidden:false,createElement:tag=>new Element(tag)},window:{REQLY_CLOUD:{endpoint:'https://script.google.com/macros/s/test/exec'},ReqlyProjectDirectory:directory,ReqlySharedCore:require('../shared-core.js'),localStorage:storage,addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent(){}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../project-picker.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(require.resolve('../shared-runtime.js'),'utf8'),context);
  const find=(tag,text)=>all(body).find(node=>node.tag===tag&&node.textContent===text);
  const click=text=>{const button=find('button',text);assert.ok(button,'missing button '+text);button.onclick();};
  const password=()=>{const form=all(body).find(node=>node.tag==='form'&&all(node).some(n=>n.type==='password'));assert.ok(form);return form;};
  return{api:context.window.ReqlyShared,body,requests,location,find,click,password,
    select(letter){const row=all(body).find(node=>node.tag==='article'&&all(node).some(n=>n.textContent==='프로젝트 '+letter));assert.ok(row);all(row).find(node=>node.tag==='button').onclick();},
    submitPassword(){const form=password();all(form).find(node=>node.type==='password').value='fixture-password';form.onsubmit({preventDefault(){}});}};
}
test('base URL shows all known projects before creating a connection or password form',async()=>{
  const b=browser();b.api.start();await tick();
  assert.ok(b.find('h2','프로젝트 목록'));assert.equal(all(b.body).filter(x=>x.tag==='article').length,3);
  assert.equal(all(b.body).filter(x=>x.type==='password').length,0);assert.equal(b.requests.length,0);
});
test('select existing project, cancel password, select another and open without creating anything',async()=>{
  const b=browser(),boot=b.api.start();await tick();b.select('b');await tick();
  assert.ok(b.password());assert.equal(b.requests.length,0);b.click('프로젝트 목록으로');await tick();
  assert.ok(b.find('h2','프로젝트 목록'));b.select('c');await tick();b.submitPassword();await boot;
  assert.equal(b.api.project.id,'c'.repeat(64));assert.equal(b.location.searchParams.get('project'),'c'.repeat(64));
  assert.deepEqual(b.requests.map(r=>r.action),['challenge','login']);
});
test('create appears only after explicit click and cancel returns to the existing list',async()=>{
  const b=browser();b.api.start();await tick();b.click('새 프로젝트 만들기');await tick();assert.ok(b.find('h2','새 프로젝트'));
  b.click('프로젝트 목록으로');await tick();assert.ok(b.find('h2','프로젝트 목록'));assert.equal(b.requests.length,0);
});
test('empty directory stays a list with a link option instead of forcing creation',async()=>{
  const b=browser({projects:false});b.api.start();await tick();assert.ok(b.find('h2','프로젝트 목록'));assert.ok(b.find('button','링크로 열기'));assert.equal(b.requests.length,0);
});
test('password failure allows retry and never exposes project contents until login succeeds',async()=>{
  const b=browser({fail:true}),boot=b.api.start();await tick();b.select('a');await tick();b.submitPassword();await tick();
  assert.equal(b.api.project,undefined);assert.ok(b.find('p','비밀번호가 일치하지 않습니다.'));b.submitPassword();await boot;assert.equal(b.api.project.id,'a'.repeat(64));
});
test('a direct project link still asks its password and cancellation opens the list',async()=>{
  const b=browser({query:'?project='+'b'.repeat(64)});b.api.start();await tick();assert.ok(b.password());
  b.click('프로젝트 목록으로');await tick();assert.ok(b.find('h2','프로젝트 목록'));assert.equal(b.location.searchParams.has('project'),false);
});
test('search filters the initial list and names are rendered as text',async()=>{
  const b=browser();b.api.start();await tick();const input=all(b.body).find(node=>node.type==='search');input.value='프로젝트 b';input.oninput();assert.equal(all(b.body).filter(node=>node.tag==='article').length,1);assert.ok(b.find('h3','프로젝트 b'));
});
test('explicit new-project navigation preserves creation and cancel returns to list',async()=>{
  const b=browser({query:'?mode=shared&new=1'});b.api.start();await tick();assert.ok(b.find('h2','새 프로젝트'));
  b.click('프로젝트 목록으로');await tick();assert.ok(b.find('h2','프로젝트 목록'));assert.equal(b.location.searchParams.has('new'),false);assert.equal(b.requests.length,0);
});
