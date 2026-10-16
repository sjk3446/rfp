const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync(require.resolve('../shared-runtime.js'),'utf8');
function client(address,endpoint='https://script.google.com/macros/s/example/exec'){
  const listeners={},sent=[];let nonce;
  const origin='https://n-example-script.googleusercontent.com';
  const peer={postMessage(message,target){sent.push({message,target});queueMicrotask(()=>listeners.message({origin,source:peer,data:{channel:'reqly-drive-v1',nonce,requestId:message.requestId,result:{ok:true,value:{project:{id:'a'.repeat(64),version:0,workspace:{requirements:[]}},role:'user'}}}}));}};
  const context={URL,URLSearchParams,crypto:webcrypto,TextEncoder,Uint8Array,CustomEvent,setTimeout,clearTimeout,setInterval,clearInterval,Map,location:new URL(address),document:{hidden:false,createElement(){return{};},body:{appendChild(frame){nonce=new URL(frame.src).searchParams.get('channel');queueMicrotask(()=>{
    listeners.message({origin:'https://evil.example',source:{},data:{channel:'reqly-drive-v1',nonce,ready:true}});
    listeners.message({origin,source:peer,data:{channel:'reqly-drive-v1',nonce,ready:true}});
  });}}},window:{REQLY_CLOUD:{endpoint},ReqlySharedCore:{},addEventListener(name,handler){listeners[name]=handler;},dispatchEvent(){}}};
  vm.runInNewContext(code,context);return{api:context.window.ReqlyShared,sent};
}
test('local review keeps existing browser projects unless sharing is explicitly opened',()=>{const c=client('http://127.0.0.1:8876/index.html?review=5.0.2');assert.equal(c.api.available,true);assert.equal(c.api.enabled,false);});
test('shared URLs enable collaboration while explicit local mode remains available on Pages',()=>{assert.equal(client('http://127.0.0.1:8876/?mode=shared').api.enabled,true);assert.equal(client('http://127.0.0.1:8876/?project=example').api.enabled,true);assert.equal(client('https://sjk3446.github.io/rfp/').api.enabled,true);assert.equal(client('https://sjk3446.github.io/rfp/?mode=local').api.enabled,false);});
test('bridge accepts Google sandbox origin, ignores other origins, and omits undefined RPC fields',async()=>{const c=client('http://127.0.0.1:8876/?mode=shared');const result=await c.api.refresh();assert.equal(result.id,'a'.repeat(64));assert.equal(c.sent.length,1);assert.equal(c.sent[0].target,'https://n-example-script.googleusercontent.com');assert.equal(Object.hasOwn(c.sent[0].message.request,'id'),false);assert.equal(c.sent[0].message.request.action,'load');});
