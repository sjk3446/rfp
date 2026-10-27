const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync(require.resolve('../shared-runtime.js'),'utf8');
function client(address,endpoint='https://script.google.com/macros/s/example/exec',respond){
  const listeners={},sent=[];let nonce;
  const origin='https://n-example-script.googleusercontent.com';
  const peer={postMessage(message,target){sent.push({message,target});Promise.resolve().then(()=>respond?respond(message.request):{ok:true,value:{project:{id:'a'.repeat(64),version:0,workspace:{requirements:[]}},role:'user'}}).then(result=>listeners.message({origin,source:peer,data:{channel:'reqly-drive-v1',nonce,requestId:message.requestId,result}}));}};
  const context={File,atob,URL,URLSearchParams,crypto:webcrypto,TextEncoder,Uint8Array,CustomEvent,setTimeout,clearTimeout,setInterval,clearInterval,Map,location:new URL(address),document:{hidden:false,createElement(){return{};},body:{appendChild(frame){nonce=new URL(frame.src).searchParams.get('channel');queueMicrotask(()=>{
    listeners.message({origin:'https://evil.example',source:{},data:{channel:'reqly-drive-v1',nonce,ready:true}});
    listeners.message({origin,source:peer,data:{channel:'reqly-drive-v1',nonce,ready:true}});
  });}}},window:{REQLY_CLOUD:{endpoint},ReqlySharedCore:require('../shared-core.js'),addEventListener(name,handler){listeners[name]=handler;},dispatchEvent(){}}};
  vm.runInNewContext(code,context);return{api:context.window.ReqlyShared,sent};
}
test('local review keeps existing browser projects unless sharing is explicitly opened',()=>{const c=client('http://127.0.0.1:8876/index.html?review=5.0.2');assert.equal(c.api.available,true);assert.equal(c.api.enabled,false);});
test('shared URLs enable collaboration while explicit local mode remains available on Pages',()=>{assert.equal(client('http://127.0.0.1:8876/?mode=shared').api.enabled,true);assert.equal(client('http://127.0.0.1:8876/?project=example').api.enabled,true);assert.equal(client('https://sjk3446.github.io/rfp/').api.enabled,true);assert.equal(client('https://sjk3446.github.io/rfp/?mode=local').api.enabled,false);});
test('bridge accepts Google sandbox origin, ignores other origins, and omits undefined RPC fields',async()=>{const c=client('http://127.0.0.1:8876/?mode=shared');const result=await c.api.refresh();assert.equal(result.id,'a'.repeat(64));assert.equal(c.sent.length,1);assert.equal(c.sent[0].target,'https://n-example-script.googleusercontent.com');assert.equal(Object.hasOwn(c.sent[0].message.request,'id'),false);assert.equal(c.sent[0].message.request.action,'load');});

const copy=value=>JSON.parse(JSON.stringify(value));
function mockStore(){
  let project={id:'a'.repeat(64),version:1,workspace:{document:null,references:[],requirements:[{key:'req-a',name:'원문',flag:'',status:'검토 전',revision:1}]}};
  const respond=request=>{
    if(request.action==='save'){
      for(const change of request.changes){
        const old=project.workspace.requirements.find(item=>item.key===change.key);
        if((old?.revision||0)!==change.expectedRevision)return{ok:false,code:'CONFLICT',error:'stale'};
      }
      project.version++;
      for(const change of request.changes){
        const index=project.workspace.requirements.findIndex(item=>item.key===change.key);
        const next={...change.item,revision:change.expectedRevision+1};
        if(index>=0)project.workspace.requirements[index]=next;else project.workspace.requirements.push(next);
      }
    }
    return{ok:true,value:{project:copy(project)}};
  };
  return{respond,get project(){return copy(project);},change(fields){project.version++;Object.assign(project.workspace.requirements[0],fields);project.workspace.requirements[0].revision++;}};
}
const connectStore=respond=>client('http://localhost/?mode=shared',undefined,respond);
test('a late load cannot roll back a successful save',async()=>{
  const store=mockStore();let release,loads=0;
  const c=connectStore(request=>{
    if(request.action==='load'&&++loads===2){const old=store.respond(request);return new Promise(resolve=>release=()=>resolve(old));}
    return store.respond(request);
  });
  await c.api.refresh();const stale=c.api.refresh();
  await new Promise(resolve=>setImmediate(resolve));
  await c.api.saveItems([{...c.api.project.workspace.requirements[0],flag:'red'}]);
  release();await stale;
  assert.equal(c.api.project.version,2);assert.equal(c.api.project.workspace.requirements[0].flag,'red');
});
test('queued saves preserve independent changes instead of failing busy or reverting a flag',async()=>{
  const store=mockStore(),c=connectStore(store.respond);await c.api.refresh();
  const base=copy(c.api.project.workspace.requirements[0]);
  await Promise.all([c.api.saveItems([{...base,flag:'red'}]),c.api.saveItems([{...base,status:'확정'}])]);
  assert.equal(store.project.workspace.requirements[0].flag,'red');assert.equal(store.project.workspace.requirements[0].status,'확정');
});
test('stale server revisions refresh and retry independent edits once',async()=>{
  const store=mockStore(),c=connectStore(store.respond);await c.api.refresh();
  const draft={...c.api.project.workspace.requirements[0],status:'확정'};store.change({flag:'blue'});
  await c.api.saveItems([draft]);
  assert.equal(store.project.workspace.requirements[0].flag,'blue');assert.equal(store.project.workspace.requirements[0].status,'확정');
  assert.equal(c.sent.filter(x=>x.message.request.action==='save').length,2);
});
test('same-field conflicts never overwrite the latest value and the queue remains usable',async()=>{
  const store=mockStore(),c=connectStore(store.respond);await c.api.refresh();
  const draft={...c.api.project.workspace.requirements[0],status:'확정'};store.change({status:'검토 중'});
  await assert.rejects(c.api.saveItems([draft]),/상태/);
  assert.equal(store.project.workspace.requirements[0].status,'검토 중');
  assert.equal(c.sent.filter(x=>x.message.request.action==='save').length,1);
  await c.api.saveItems([{...c.api.project.workspace.requirements[0],flag:'blue'}]);
  assert.equal(store.project.workspace.requirements[0].flag,'blue');
});
test('an unknown stale draft is not silently assigned a fresh revision',async()=>{
  const store=mockStore(),c=connectStore(store.respond);await c.api.refresh();
  await assert.rejects(c.api.saveItems([{...c.api.project.workspace.requirements[0],revision:0,name:'stale'}]),/겹칩니다/);
  assert.equal(c.sent.filter(x=>x.message.request.action==='save').length,0);
});


test('repeated and concurrent original reads share one download; failures retry and disconnect clears cache',async()=>{
  let downloads=0,fail=false;
  const c=client('https://sjk3446.github.io/rfp/',undefined,request=>{
    if(request.action==='load')return{ok:true,value:{token:'project-session',project:{id:'a'.repeat(64),version:1,workspace:{requirements:[]}}}};
    if(request.action==='download'){downloads++;return fail?{ok:false,error:'download failed'}:{ok:true,value:{name:'original.txt',base64:btoa('source bytes')}};}
    throw new Error('unexpected');
  });
  await c.api.refresh();
  const start=downloads,values=await Promise.all([c.api.download('file'),c.api.download('file'),c.api.download('file')]);
  assert.equal(downloads-start,1);assert.equal(await values[0].text(),'source bytes');assert.equal(values[0],values[1]);
  await c.api.download('file');assert.equal(downloads-start,1);
  fail=true;await assert.rejects(()=>c.api.download('other'),/failed/);fail=false;await c.api.download('other');assert.equal(downloads,3);
  c.api.disconnect();await assert.rejects(()=>c.api.download('file'),/다시 접속/);assert.equal(downloads,3);await c.api.refresh();await c.api.download('file');assert.equal(downloads,4);
});
test('a late original response cannot repopulate the cache after disconnect',async()=>{
  let release,downloads=0;
  const c=client('https://sjk3446.github.io/rfp/',undefined,request=>request.action==='load'?{ok:true,value:{token:'project-session',project:{id:'a'.repeat(64),version:1,workspace:{requirements:[]}}}}:new Promise(resolve=>{downloads++;release=()=>resolve({ok:true,value:{name:'source.txt',base64:btoa('source')}});}));
  await c.api.refresh();const pending=c.api.download('file');await new Promise(resolve=>setImmediate(resolve));c.api.disconnect();release();await assert.rejects(pending,/변경/);assert.equal(downloads,1);
});

test('known expired project access clears originals and rejects cached downloads',async()=>{
  let revoked=false,downloads=0;
  const c=client('https://sjk3446.github.io/rfp/',undefined,request=>{
    if(revoked)return{ok:false,code:'AUTH',error:'session revoked'};
    if(request.action==='load')return{ok:true,value:{token:'project-token',project:{id:'a'.repeat(64),version:1,workspace:{requirements:[]}}}};
    downloads++;return{ok:true,value:{name:'original.txt',base64:btoa('original')}};
  });
  await c.api.refresh();await c.api.download('asset');revoked=true;await assert.rejects(()=>c.api.refresh(),/revoked/);await assert.rejects(()=>c.api.download('asset'),/다시 접속/);assert.equal(downloads,1);
});
