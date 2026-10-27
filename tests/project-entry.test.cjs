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
  focus(){this.focused=true;}
  select(){this.selected=true;}
}
const all=node=>[node,...node.children.flatMap(all)];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function browser({query='',projects=true,restoredDirectory=true,fail=false,holdLogin=false,holdDirectory=false,deleteError=false,renameError=false,role='user'}={}){
  const body=new Element('body'),listeners=new Map(),requests=[],cache=new Map(),sessions=new Map(),held=[],copied=[];let nonce,loginCount=0,directoryError=false;
  const storage={getItem:key=>cache.get(key),setItem:(key,value)=>cache.set(key,value),removeItem:key=>cache.delete(key)};
  const sessionStorage={getItem:key=>sessions.get(key),setItem:(key,value)=>sessions.set(key,value),removeItem:key=>sessions.delete(key)};
  const endpoint='https://script.google.com/macros/s/test/exec';
  if(restoredDirectory)sessions.set('reqly-directory-session-v1',JSON.stringify({directoryToken:'directory-fixture',expiresAt:Date.now()+3600000,endpoint}));
  directory.create(storage).remember({id:'f'.repeat(64),name:'과거 브라우저에만 있던 프로젝트',updatedAt:'2026-10-26T00:00:00Z'});
  const globalProjects=projects?['a','b','c'].map(letter=>({id:letter.repeat(64),name:'프로젝트 '+letter,updatedAt:'2026-10-26T00:00:00Z'})):[];
  const dispatch=(name,event)=>{for(const fn of [...(listeners.get(name)||[])])fn(event);};
  const location=new URL('https://sjk3446.github.io/rfp/'+query);
  const peer={postMessage(message){const r=message.request;requests.push(r);let result;
    if(r.action==='directoryChallenge')result={ok:true,value:{configured:true,salt:'d'.repeat(64)}};
    else if(r.action==='directoryLogin')result={ok:true,value:{directoryToken:'directory-fixture',expiresAt:Date.now()+3600000}};
    else if(r.action==='directoryList')result=directoryError?{ok:false,code:'DIRECTORY_AUTH',error:'목록 관리자 접속이 만료되었습니다.'}:{ok:true,value:{projects:globalProjects.map(item=>({...item})),nextCursor:''}};
    else if(r.action==='challenge')result={ok:true,value:{salt:'0'.repeat(64)}};
    else if(r.action==='login'){
      loginCount++;
      result=fail&&loginCount===1?{ok:false,code:'AUTH',error:'비밀번호가 일치하지 않습니다.'}:{ok:true,value:{project:{id:r.id,name:'프로젝트 '+r.id[0],version:1,workspace:{requirements:[]}},role,token:'fixture'}};
    }else if(r.action==='deleteProject'){
      result=deleteError?{ok:false,code:'AUTH',error:'관리자 비밀번호를 확인해 주세요.'}:{ok:true,value:{deleted:true,id:r.id}};
      if(!deleteError){const index=globalProjects.findIndex(item=>item.id===r.id);if(index>=0)globalProjects.splice(index,1);}
    }else if(r.action==='renameProject'){
      result=renameError?{ok:false,code:'AUTH',error:'이름을 변경할 권한이 없습니다.'}:{ok:true,value:{project:{id:r.id,name:r.name,version:2,updatedAt:'2026-10-27T02:00:00Z',workspace:{requirements:[]}}}};
      if(!renameError){const item=globalProjects.find(item=>item.id===r.id);if(item)Object.assign(item,{name:r.name,updatedAt:result.value.project.updatedAt});}
    }
    else result={ok:false,error:'Unexpected '+r.action};
    const deliver=()=>dispatch('message',{origin:'https://n-test-script.googleusercontent.com',source:peer,data:{channel:'reqly-drive-v1',nonce,requestId:message.requestId,result}});
    if((holdLogin&&r.action==='login')||(holdDirectory&&r.action==='directoryList'))held.push(deliver);else queueMicrotask(deliver);
  }};
  body.appendChild=frame=>{body.append(frame);nonce=new URL(frame.src).searchParams.get('channel');queueMicrotask(()=>dispatch('message',{origin:'https://n-test-script.googleusercontent.com',source:peer,data:{channel:'reqly-drive-v1',nonce,ready:true}}));};
  const context={URL,URLSearchParams,crypto:{randomUUID:webcrypto.randomUUID.bind(webcrypto),getRandomValues:webcrypto.getRandomValues.bind(webcrypto),subtle:{importKey:async()=>({}),deriveBits:async()=>new Uint8Array(32).buffer}},TextEncoder,Uint8Array,CustomEvent,Map,Date,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},location,history:{replaceState(_,__,url){location.href=String(url);}},document:{body,hidden:false,createElement:tag=>new Element(tag)},window:{REQLY_CLOUD:{endpoint},ReqlyProjectDirectory:directory,ReqlySharedCore:require('../shared-core.js'),localStorage:storage,sessionStorage,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},dispatchEvent:event=>dispatch(event.type,event)}};
  context.navigator={clipboard:{writeText:async value=>copied.push(value)}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../project-picker.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(require.resolve('../shared-runtime.js'),'utf8'),context);
  const find=(tag,text)=>all(body).find(node=>node.tag===tag&&node.textContent===text);
  const click=text=>{const button=find('button',text);assert.ok(button,'missing button '+text);return button.onclick();};
  const password=()=>{const form=all(body).find(node=>node.tag==='form'&&all(node).some(n=>n.type==='password'));assert.ok(form);return form;};
  return{api:context.window.ReqlyShared,body,requests,get projectRequests(){return requests.filter(r=>!r.action.startsWith('directory'));},sessions,location,find,click,password,copied,failDirectory:()=>directoryError=true,release:()=>held.splice(0).forEach(fn=>fn()),
    action(letter,label){const row=all(body).find(node=>node.tag==='article'&&all(node).some(n=>n.textContent==='프로젝트 '+letter));assert.ok(row);return all(row).find(node=>node.tag==='button'&&node.textContent===label).onclick();},
    submitDelete(name){const form=password(),inputs=all(form).filter(node=>node.tag==='input');inputs[0].value='fixture-password';inputs[1].value=name;form.onsubmit({preventDefault(){}});},
    submitRename(name){const form=all(body).find(node=>node.tag==='form'&&all(node).some(n=>n.textContent==='프로젝트 이름 변경')),inputs=all(form).filter(node=>node.tag==='input');inputs[0].value=name;if(inputs[1])inputs[1].value='fixture-password';form.onsubmit({preventDefault(){}});},
    select(letter){const row=all(body).find(node=>node.tag==='article'&&all(node).some(n=>n.textContent==='프로젝트 '+letter));assert.ok(row);all(row).find(node=>node.tag==='button').onclick();},
    submitPassword(){const form=password();all(form).find(node=>node.type==='password').value='fixture-password';form.onsubmit({preventDefault(){}});}};
}
test('restored directory access loads remote projects before any project password form',async()=>{
  const b=browser();b.api.start();await tick();
  assert.ok(b.find('h2','프로젝트'));assert.equal(all(b.body).filter(x=>x.tag==='article').length,3);
  assert.equal(all(b.body).filter(x=>x.type==='password').length,0);assert.equal(b.projectRequests.length,0);
  assert.deepEqual(b.requests.map(r=>r.action),['directoryList']);assert.equal(b.requests[0].directoryToken,'directory-fixture');
  assert.equal(all(b.body).some(node=>node.textContent==='과거 브라우저에만 있던 프로젝트'),false);
});

test('locked entry never exposes old browser history or contacts the directory before administrator login',async()=>{
  const b=browser({restoredDirectory:false});b.api.start();await tick();
  assert.ok(b.find('button','관리자로 접속'));assert.ok(b.find('button','링크로 열기'));assert.ok(b.find('button','새 프로젝트 만들기'));
  assert.equal(b.api.knownProjects().length,0);assert.equal(all(b.body).filter(node=>node.tag==='article').length,0);
  assert.equal(all(b.body).some(node=>node.textContent==='과거 브라우저에만 있던 프로젝트'),false);assert.equal(b.requests.length,0);
  const login=b.click('관리자로 접속');await tick();assert.ok(b.find('h2','전체 프로젝트 목록 열기'));
  assert.equal(b.requests.length,0);b.submitPassword();await login;
  assert.deepEqual(b.requests.map(r=>r.action),['directoryChallenge','directoryLogin','directoryList']);
  assert.equal(all(b.body).filter(node=>node.tag==='article').length,3);assert.equal(b.api.project,undefined);
  assert.equal(all(b.body).some(node=>node.textContent==='과거 브라우저에만 있던 프로젝트'),false);
});

test('locking removes rendered names and search text while leaving project-link and creation access',async()=>{
  const b=browser();b.api.start();await tick();const input=all(b.body).find(node=>node.type==='search');
  input.value='프로젝트 b';input.oninput();assert.ok(b.find('h3','프로젝트 b'));b.click('목록 잠금');
  assert.equal(b.api.directoryUnlocked,false);assert.equal(b.sessions.has('reqly-directory-session-v1'),false);
  assert.equal(input.value,'');assert.equal(input.hidden,true);assert.equal(all(b.body).filter(node=>node.tag==='article').length,0);
  assert.equal(all(b.body).some(node=>/^프로젝트 [abc]$/.test(node.textContent)),false);
  assert.ok(b.find('button','링크로 열기'));assert.ok(b.find('button','새 프로젝트 만들기'));assert.ok(b.find('button','관리자로 접속'));
});

test('directory authentication expiry clears visible metadata and reports the retry action',async()=>{
  const b=browser();b.api.start();await tick();b.failDirectory();await b.click('새로고침');
  assert.equal(b.api.directoryUnlocked,false);assert.equal(b.api.knownProjects().length,0);
  assert.equal(all(b.body).filter(node=>node.tag==='article').length,0);assert.ok(b.find('p','목록 관리자 접속이 만료되었습니다.'));
  assert.ok(b.find('button','관리자로 접속'));
});

test('restored directory loading has a visible progress state until remote metadata arrives',async()=>{
  const b=browser({holdDirectory:true});b.api.start();await tick();
  assert.ok(b.find('h2','전체 프로젝트 목록을 불러오고 있습니다'));assert.equal(all(b.body).filter(node=>node.tag==='article').length,0);
  b.release();await tick();assert.equal(all(b.body).filter(node=>node.tag==='article').length,3);
  assert.equal(all(b.body).some(node=>node.className?.includes('project-loading')),false);
});
test('select existing project, cancel password, select another and open without creating anything',async()=>{
  const b=browser(),boot=b.api.start();await tick();b.select('b');await tick();
  assert.ok(b.password());assert.equal(b.projectRequests.length,0);b.click('프로젝트 목록으로');await tick();
  assert.ok(b.find('h2','프로젝트'));b.select('c');await tick();b.submitPassword();await boot;
  assert.equal(b.api.project.id,'c'.repeat(64));assert.equal(b.location.searchParams.get('project'),'c'.repeat(64));
  assert.deepEqual(b.projectRequests.map(r=>r.action),['challenge','login']);
});
test('create appears only after explicit click and cancel returns to the existing list',async()=>{
  const b=browser();b.api.start();await tick();b.click('새 프로젝트 만들기');await tick();assert.ok(b.find('h2','새 프로젝트'));
  b.click('프로젝트 목록으로');await tick();assert.ok(b.find('h2','프로젝트'));assert.equal(b.projectRequests.length,0);
});
test('empty directory stays a list with a link option instead of forcing creation',async()=>{
  const b=browser({projects:false});b.api.start();await tick();assert.ok(b.find('h2','프로젝트'));assert.ok(b.find('button','링크로 열기'));assert.equal(b.projectRequests.length,0);
});
test('password failure allows retry and never exposes project contents until login succeeds',async()=>{
  const b=browser({fail:true}),boot=b.api.start();await tick();b.select('a');await tick();b.submitPassword();await tick();
  assert.equal(b.api.project,undefined);assert.ok(b.find('p','비밀번호가 일치하지 않습니다.'));b.submitPassword();await boot;assert.equal(b.api.project.id,'a'.repeat(64));
});
test('a direct project link still asks its password and cancellation opens the list',async()=>{
  const b=browser({query:'?project='+'b'.repeat(64),restoredDirectory:false});b.api.start();await tick();assert.ok(b.password());
  b.click('프로젝트 목록으로');await tick();assert.ok(b.find('h2','프로젝트'));assert.equal(b.location.searchParams.has('project'),false);
});

test('shared-link entry opens one project while the complete directory remains locked',async()=>{
  const b=browser({restoredDirectory:false}),boot=b.api.start();await tick();
  const input=all(b.body).find(node=>node.attributes['aria-label']==='기존 프로젝트 공유 링크');
  input.value='https://sjk3446.github.io/rfp/?project='+'b'.repeat(64);
  all(b.body).find(node=>node.tag==='form').onsubmit({preventDefault(){}});await tick();b.submitPassword();await boot;
  assert.equal(b.api.project.id,'b'.repeat(64));assert.equal(b.api.directoryUnlocked,false);assert.equal(b.api.knownProjects().length,0);
  assert.deepEqual(b.requests.map(r=>r.action),['challenge','login']);
});
test('search filters the initial list and names are rendered as text',async()=>{
  const b=browser();b.api.start();await tick();const input=all(b.body).find(node=>node.type==='search');input.value='프로젝트 b';input.oninput();assert.equal(all(b.body).filter(node=>node.tag==='article').length,1);assert.ok(b.find('h3','프로젝트 b'));
});
test('explicit new-project navigation preserves creation and cancel returns to list',async()=>{
  const b=browser({query:'?mode=shared&new=1',restoredDirectory:false});b.api.start();await tick();assert.ok(b.find('h2','새 프로젝트'));
  b.click('프로젝트 목록으로');await tick();assert.ok(b.find('h2','프로젝트'));assert.equal(b.location.searchParams.has('new'),false);assert.equal(b.projectRequests.length,0);
});

test('loading is visible through delayed login and remains until the rendered screen is ready',async()=>{
  const b=browser({holdLogin:true}),boot=b.api.start();await tick();b.select('a');await tick();b.submitPassword();await tick();
  assert.ok(b.find('p','프로젝트와 저장된 내용을 불러오고 있습니다.'));assert.equal(b.api.project,undefined);
  b.release();await boot;assert.ok(b.find('p','요구사항 목록과 화면을 구성하고 있습니다.'));b.api.finishLoading();
  assert.equal(all(b.body).some(node=>node.className?.includes('project-loading')),false);
});

test('a failed login removes the loading overlay and allows a retry',async()=>{
  const b=browser({fail:true});b.api.start();await tick();b.select('a');await tick();b.submitPassword();await tick();
  assert.equal(all(b.body).some(node=>node.className?.includes('project-loading')),false);assert.ok(b.password());
});

test('directory sharing copies only the selected project URL without project login',async()=>{
  const b=browser();b.api.start();await tick();await b.action('b','공유');b.click('링크 복사');await tick();
  assert.deepEqual(b.copied,['https://sjk3446.github.io/rfp/?project='+'b'.repeat(64)]);assert.equal(b.projectRequests.length,0);
  all(b.body).find(node=>node.attributes['aria-label']==='프로젝트 공유 닫기').onclick();assert.ok(b.find('h2','프로젝트'));
});

test('delete cancellation and mismatched name never send a deletion request',async()=>{
  const b=browser();b.api.start();await tick();const task=b.action('a','삭제');await tick();b.submitDelete('wrong');await tick();
  assert.ok(b.find('p','삭제할 프로젝트 이름을 정확히 입력해 주세요.'));assert.equal(b.projectRequests.length,0);
  b.click('취소');await task;assert.equal(b.api.knownProjects().length,3);
});

test('successful deletion forgets only selected project after server confirmation',async()=>{
  const b=browser();b.api.start();await tick();const task=b.action('b','삭제');await tick();b.submitDelete('프로젝트 b');await task;
  assert.deepEqual(Array.from(b.api.knownProjects(),item=>item.id).sort(),['a'.repeat(64),'c'.repeat(64)]);
  assert.deepEqual(b.projectRequests.map(r=>r.action),['challenge','deleteProject']);assert.equal(b.projectRequests[1].confirmName,'프로젝트 b');
  assert.equal(all(b.body).filter(x=>x.tag==='article').length,2);
});

test('failed deletion preserves every project in the directory and reports the failure',async()=>{
  const b=browser({deleteError:true});b.api.start();await tick();const task=b.action('a','삭제');await tick();b.submitDelete('프로젝트 a');await task;
  assert.equal(b.api.knownProjects().length,3);assert.equal(all(b.body).filter(x=>x.tag==='article').length,3);assert.ok(b.find('p','관리자 비밀번호를 확인해 주세요.'));
});

test('rename from the list updates only the selected name after confirmation and keeps the URL',async()=>{
  const b=browser();b.api.start();await tick();const task=b.action('b','이름 변경');await tick();
  assert.ok(all(b.body).some(node=>node.tag==='input'&&node.value==='프로젝트 b'));b.submitRename('  변경한 이름  ');await task;
  assert.equal(b.api.project,undefined);assert.ok(b.find('h3','변경한 이름'));assert.equal(b.api.knownProjects().length,3);
  assert.equal(b.api.knownProjects().find(p=>p.id==='b'.repeat(64)).name,'변경한 이름');assert.deepEqual(b.projectRequests.map(r=>r.action),['challenge','renameProject']);
});

test('blank name and cancel keep the old name without sending a request',async()=>{
  const b=browser();b.api.start();await tick();const task=b.action('a','이름 변경');await tick();b.submitRename('   ');
  assert.ok(b.find('p','프로젝트 이름을 입력해 주세요.'));assert.equal(b.projectRequests.length,0);b.click('취소');await task;assert.ok(b.find('h3','프로젝트 a'));
});

test('failed rename leaves the directory unchanged and reports failure',async()=>{
  const b=browser({renameError:true});b.api.start();await tick();const task=b.action('c','이름 변경');await tick();b.submitRename('실패한 이름');await task;
  assert.ok(b.find('h3','프로젝트 c'));assert.ok(b.find('p','이름을 변경할 권한이 없습니다.'));assert.equal(b.api.knownProjects().find(p=>p.id==='c'.repeat(64)).name,'프로젝트 c');
});

test('current administrator renames without entering a password again or switching projects',async()=>{
  const b=browser({role:'admin'}),boot=b.api.start();await tick();b.select('a');await tick();b.submitPassword();await boot;b.api.finishLoading();const address=b.location.href;
  const task=b.api.renameProject(b.api.project);await tick();assert.equal(all(b.body).some(n=>n.type==='password'),false);b.submitRename('현재 프로젝트 새 이름');await task;
  assert.equal(b.api.project.name,'현재 프로젝트 새 이름');assert.equal(b.api.project.id,'a'.repeat(64));assert.equal(b.location.href,address);assert.deepEqual(b.projectRequests.map(r=>r.action),['challenge','login','renameProject']);
});

test('renaming another project preserves the active project and its connection',async()=>{
  const b=browser({role:'admin'}),boot=b.api.start();await tick();b.select('a');await tick();b.submitPassword();await boot;b.api.finishLoading();
  const original=JSON.stringify(b.api.project),address=b.location.href,target=b.api.knownProjects().find(p=>p.id==='b'.repeat(64));
  const task=b.api.renameProject(target);await tick();assert.ok(b.password());b.submitRename('다른 프로젝트 새 이름');await task;
  assert.equal(JSON.stringify(b.api.project),original);assert.equal(b.location.href,address);assert.equal(b.api.role,'admin');assert.equal(b.api.knownProjects().find(p=>p.id===target.id).name,'다른 프로젝트 새 이름');
  assert.equal(b.requests.at(-1).id,target.id);assert.ok(b.requests.at(-1).proof);
});
