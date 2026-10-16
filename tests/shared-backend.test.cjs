const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const core=require('../shared-core.js');
function backend(activeUser='owner@example.test'){
  const folders=new Map(), files=new Map(), properties=new Map();let seq=0;
  const blob=(value)=>({getDataAsString:()=>Buffer.from(value).toString('utf8'),getBytes:()=>Array.from(Buffer.from(value))});
  const iterator=values=>{let index=0;return{hasNext:()=>index<values.length,next:()=>values[index++]};};
  function folder(name){const id=`folder-${++seq}`,children=[],entries=[];const result={getId:()=>id,createFolder:name=>{const child=folder(name);children.push({name,child});return child;},getFoldersByName:name=>iterator(children.filter(x=>x.name===name).map(x=>x.child)),getFilesByName:name=>iterator(entries.filter(x=>x.name===name&&!x.trash)),createFile:(name,content)=>{
    if(typeof name!=='string'){content=name.getBytes();name=name.name;}
    const id=`file-${++seq}`;const entry={name,trash:false,getId:()=>id,getBlob:()=>blob(content),setContent:value=>{content=value;},setTrashed:value=>{entry.trash=value;}};entries.push(entry);files.set(id,entry);return entry;
  }};folders.set(id,result);return result;}
  const ctx=vm.createContext({console,Date,Set,Map,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)})},DriveApp:{createFolder:folder,getFolderById:id=>folders.get(id),getFileById:id=>files.get(id)},MimeType:{PLAIN_TEXT:'text/plain'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=>crypto.randomUUID(),Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>crypto.createHash('sha256').update(value).digest(),computeHmacSha256Signature:(value,key)=>crypto.createHmac('sha256',key).update(value).digest(),base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url'),base64DecodeWebSafe:value=>Buffer.from(value,'base64url'),base64Encode:value=>Buffer.from(value).toString('base64'),base64Decode:value=>Array.from(Buffer.from(value,'base64')),newBlob:(value,type,name)=>({...blob(value),name})}});
  ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'}),getActiveUser:()=>({getEmail:()=>activeUser})};
  vm.runInContext(fs.readFileSync(require.resolve('../cloud/Code.gs'),'utf8'),ctx);ctx.setup_();
  const rpc=request=>JSON.parse(JSON.stringify(ctx.reqlyRpc(request)));
  const create=()=>rpc({action:'create',name:'Test',admin:{salt:'a'.repeat(64),proof:'1'.repeat(64)},user:{salt:'a'.repeat(64),proof:'2'.repeat(64)}}).value;
  return{rpc,create,initialize:()=>ctx.initializeStorage()};
}
test('only the script owner may initialize storage',()=>{assert.equal(backend().initialize().ready,true);assert.throws(()=>backend('').initialize(),/소유자/);assert.throws(()=>backend('other@example.test').initialize(),/소유자/);});
test('create returns project-scoped administrator token and no password hashes',()=>{const{create}=backend(),p=create();assert.equal(p.role,'admin');assert.equal(p.project.workspace.requirements.length,0);assert.equal(JSON.stringify(p.project).includes('auth'),false);});
test('user login cannot change passwords or delete files',()=>{const{rpc,create}=backend(),p=create(),id=p.project.id;const u=rpc({action:'login',id,proof:'2'.repeat(64)}).value;for(const action of ['password','removeFile'])assert.equal(rpc({action,id,token:u.token}).code,'FORBIDDEN');});
test('token cannot access a different project or be forged',()=>{const{rpc,create}=backend(),a=create(),b=create();assert.equal(rpc({action:'load',id:b.project.id,token:a.token}).code,'AUTH');assert.equal(rpc({action:'load',id:a.project.id,token:a.token+'x'}).code,'AUTH');});
test('same-item stale save rejected and different-item saves preserved',()=>{const{rpc,create}=backend(),p=create(),auth={id:p.project.id,token:p.token};const change=(key,name,revision)=>({key,expectedRevision:revision,item:{key,id:key,name}});assert.equal(rpc({action:'save',...auth,changes:[change('req-a','first',0)]}).ok,true);assert.equal(rpc({action:'save',...auth,changes:[change('req-a','stale',0)]}).code,'CONFLICT');assert.equal(rpc({action:'save',...auth,changes:[change('req-b','other',0)]}).ok,true);const items=rpc({action:'load',...auth}).value.project.workspace.requirements;assert.equal(items.length,2);assert.equal(items.find(x=>x.key==='req-a').name,'first');assert.ok(items[0].savedAt);});
test('batch validation is atomic and reserved keys are rejected',()=>{const{rpc,create}=backend(),p=create(),auth={id:p.project.id,token:p.token};assert.equal(rpc({action:'save',...auth,changes:[{key:'req-a',expectedRevision:0,item:{key:'req-a'}},{key:'__proto__',expectedRevision:0,item:{key:'__proto__'}}]}).ok,false);assert.equal(rpc({action:'load',...auth}).value.project.workspace.requirements.length,0);});
test('password change requires current administrator proof and invalidates only affected role',()=>{const{rpc,create}=backend(),p=create(),auth={id:p.project.id,token:p.token};const u=rpc({action:'login',id:p.project.id,proof:'2'.repeat(64)}).value;assert.equal(rpc({action:'password',...auth,role:'user',currentProof:'3'.repeat(64),newProof:'4'.repeat(64)}).code,'AUTH');assert.equal(rpc({action:'password',...auth,role:'user',currentProof:'1'.repeat(64),newProof:'4'.repeat(64)}).ok,true);assert.equal(rpc({action:'load',id:p.project.id,token:u.token}).code,'AUTH');assert.equal(rpc({action:'load',...auth}).ok,true);assert.equal(rpc({action:'login',id:p.project.id,proof:'4'.repeat(64)}).ok,true);});
test('RFP original downloads byte-for-byte and last/selected RFP cannot be deleted',()=>{const{rpc,create}=backend(),p=create(),auth={id:p.project.id,token:p.token};const upload=name=>rpc({action:'upload',...auth,kind:'rfp',name,base64:Buffer.from('original bytes').toString('base64')}).value.project.workspace;
  const first=upload('one.pdf').assets[0];assert.equal(rpc({action:'removeFile',...auth,assetId:first.id}).ok,false);
  const second=upload('two.pdf').assets[1];assert.equal(rpc({action:'removeFile',...auth,assetId:first.id}).ok,false);
  assert.equal(rpc({action:'selectRfp',...auth,assetId:second.id}).ok,true);
  assert.equal(rpc({action:'download',...auth,assetId:first.id}).value.base64,Buffer.from('original bytes').toString('base64'));
  assert.equal(rpc({action:'removeFile',...auth,assetId:first.id}).ok,true);
});
test('file deletion does not remove authored requirements',()=>{const{rpc,create}=backend(),p=create(),auth={id:p.project.id,token:p.token};rpc({action:'save',...auth,changes:[{key:'req-a',expectedRevision:0,item:{key:'req-a',description:'my edits',questions:[{question:'my question'}]}}]});const w=rpc({action:'upload',...auth,kind:'reference',name:'notes.txt',base64:'YQ=='}).value.project.workspace;assert.equal(rpc({action:'removeFile',...auth,assetId:w.assets[0].id}).ok,true);assert.equal(rpc({action:'load',...auth}).value.project.workspace.requirements[0].description,'my edits');});
test('project cannot have identical credentials',()=>{const{rpc}=backend();assert.equal(rpc({action:'create',name:'test',admin:{salt:'a'.repeat(64),proof:'1'.repeat(64)},user:{salt:'a'.repeat(64),proof:'1'.repeat(64)}}).ok,false);});
test('reanalysis preserves edits, questions, flags and removed requirements',()=>{const existing=[{key:'req-a',id:'DER-001',name:'edited',description:'user edit',flag:'red',questions:[{question:'keep'}]},{key:'req-b',id:'DER-002',description:'old'}];const result=core.mergeAnalysis(existing,[{key:'new-a',id:'DER-001',name:'source',description:'new source'},{key:'new-c',id:'DER-003',description:'added'}],'version-2');assert.equal(result.requirements[0].description,'user edit');assert.equal(result.requirements[0].latestSource.description,'new source');assert.equal(result.requirements[0].flag,'red');assert.equal(result.requirements[0].questions[0].question,'keep');assert.equal(result.requirements[1].absentInLatest,true);assert.equal(result.requirements.length,3);assert.equal(existing[0].latestSource,undefined);});
test('ambiguous IDs are held for review instead of overwriting edits',()=>{const result=core.mergeAnalysis([{key:'a',id:'X',description:'keep'},{key:'b',id:'X',description:'also keep'}],[{key:'c',id:'X',description:'new'}],'v');assert.equal(result.unresolved.length,1);assert.equal(result.requirements.length,2);assert.equal(result.requirements[0].description,'keep');});

test('business overview metadata is shared without modifying requirements and stale metadata saves fail',()=>{
  const {rpc,create}=backend(),project=create(),auth={id:project.project.id,token:project.token};
  const saved=rpc({action:'save',...auth,changes:[{key:'req-a',expectedRevision:0,item:{key:'req-a',description:'keep my work'}}]}).value.project;
  const document={name:'rfp.pdf',overviewByAsset:{source:{savedAt:'2026-10-15T03:00:00Z',items:[{category:'사업기간',content:'계약 후 12개월',quote:'계약 후 12개월'}]}}};
  assert.equal(rpc({action:'save',...auth,changes:[],metadata:{document,references:[]},expectedVersion:saved.version}).ok,true);
  const loaded=rpc({action:'load',...auth}).value.project.workspace;
  assert.equal(loaded.document.overviewByAsset.source.items[0].content,'계약 후 12개월');assert.equal(loaded.requirements[0].description,'keep my work');
  assert.equal(rpc({action:'save',...auth,changes:[],metadata:{document:null,references:[]},expectedVersion:saved.version}).code,'CONFLICT');
});
