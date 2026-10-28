const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const core=require('../shared-core.js');
function backend(activeUser='owner@example.test'){
  const folders=new Map(), files=new Map(), properties=new Map(), continuations=new Map(), logs=[];let seq=0,clock=Date.now();
  class BackendDate extends Date { constructor(...args){super(...(args.length?args:[clock]));} static now(){return clock;} }
  const blob=(value)=>({getDataAsString:()=>Buffer.from(value).toString('utf8'),getBytes:()=>Array.from(Buffer.from(value))});
  const iterator=(values,start=0)=>{let index=start;return{hasNext:()=>index<values.length,next:()=>values[index++],getContinuationToken:()=>{const token='cursor-'+(++seq);continuations.set(token,{values,index});return token;}};};
  function folder(name){const id=`folder-${++seq}`,children=[],entries=[];let trashed=false;const result={getId:()=>id,getName:()=>name,isTrashed:()=>trashed,setTrashed:value=>{trashed=value;},getFolders:()=>iterator(children.map(x=>x.child)),createFolder:name=>{const child=folder(name);children.push({name,child});return child;},getFoldersByName:name=>iterator(children.filter(x=>x.name===name).map(x=>x.child)),getFilesByName:name=>iterator(entries.filter(x=>x.name===name&&!x.trash)),createFile:(name,content)=>{
    if(typeof name!=='string'){content=name.getBytes();name=name.name;}
    const id=`file-${++seq}`;const entry={name,trash:false,getId:()=>id,getBlob:()=>blob(content),setContent:value=>{content=value;},setTrashed:value=>{entry.trash=value;}};entries.push(entry);files.set(id,entry);return entry;
  }};folders.set(id,result);return result;}
  const ctx=vm.createContext({console:{log:value=>logs.push(value)},Date:BackendDate,Set,Map,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value),deleteProperty:key=>properties.delete(key)})},DriveApp:{createFolder:folder,getFolderById:id=>folders.get(id),getFileById:id=>files.get(id),continueFolderIterator:token=>{const saved=continuations.get(token);if(!saved)throw Error('expired');return iterator(saved.values,saved.index);}},MimeType:{PLAIN_TEXT:'text/plain'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=>crypto.randomUUID(),Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,value)=>crypto.createHash('sha256').update(value).digest(),computeHmacSha256Signature:(value,key)=>crypto.createHmac('sha256',key).update(value).digest(),base64EncodeWebSafe:value=>Buffer.from(value).toString('base64').replace(/\+/g,'-').replace(/\//g,'_'),base64DecodeWebSafe:value=>Buffer.from(value,'base64url'),base64Encode:value=>Buffer.from(value).toString('base64'),base64Decode:value=>Array.from(Buffer.from(value,'base64')),newBlob:(value,type,name)=>({...blob(value),name})}});
  ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'}),getActiveUser:()=>({getEmail:()=>activeUser})};
  vm.runInContext(fs.readFileSync(require.resolve('../cloud/Code.gs'),'utf8'),ctx);ctx.setup_();
  const rpc=request=>JSON.parse(JSON.stringify(ctx.reqlyRpc(request)));
  const create=()=>rpc({action:'create',name:'Test',admin:{salt:'a'.repeat(64),proof:'1'.repeat(64)},user:{salt:'a'.repeat(64),proof:'2'.repeat(64)}}).value;
  const prepare=()=>ctx.prepareDirectorySetup();
  const directory=()=>{const setup=prepare(),setupToken=new URL(setup.url).hash.split('=')[1];const result=rpc({action:'directorySetup',setupToken,salt:'d'.repeat(64),proof:'5'.repeat(64)});assert.equal(result.ok,true);return result.value;};
  return{rpc,create,directory,prepare,properties,logs,advance:ms=>{clock+=ms;},root:()=>folders.get(properties.get('ROOT_FOLDER_ID')),initialize:()=>ctx.initializeStorage(),folderFor:id=>[...folders.values()].find(folder=>folder.getFoldersByName(id).hasNext())?.getFoldersByName(id).next()};
}
test('only the script owner may initialize storage',()=>{assert.equal(backend().initialize().ready,true);assert.throws(()=>backend('').initialize(),/소유자/);assert.throws(()=>backend('other@example.test').initialize(),/소유자/);});

const qaAnswer=id=>({id,question:'제출 대상은?',answer:{claims:[{text:'PL',evidence:[]}]},createdAt:'2026-10-27T00:00:00.000Z'});
function questionFixture(){const b=backend(),p=b.create(),admin={id:p.project.id,token:p.token},user={id:p.project.id,token:b.rpc({action:'login',id:p.project.id,proof:'2'.repeat(64)}).value.token};return{b,p,admin,user,publish:(id,authorSecret='a'.repeat(64))=>b.rpc({action:'qaPublish',...user,records:[qaAnswer(id)],authorSecret})};}
test('shared question deletion is enforced for original browser author or project administrator only',()=>{
  const {b,admin,user,publish}=questionFixture(),published=publish('own');assert.equal(published.ok,true);const own=published.value.project.workspace.document.qaHistory[0];
  assert.equal(own.authorId,crypto.createHash('sha256').update(`question-author:${user.id}:${'a'.repeat(64)}`).digest('base64url'));
  assert.equal(b.rpc({action:'qaDelete',...user,questionIds:['own'],authorSecret:'b'.repeat(64)}).code,'FORBIDDEN');
  assert.equal(b.rpc({action:'qaDelete',...user,questionIds:['own']}).code,'FORBIDDEN');
  assert.equal(b.rpc({action:'qaDelete',...user,questionIds:['own'],authorSecret:own.authorId}).code,'FORBIDDEN');
  const raw=JSON.parse(b.folderFor(user.id).getFilesByName('project.json').next().getBlob().getDataAsString());assert.equal(JSON.stringify({owners:raw.qaOwners,history:raw.document.qaHistory}).includes('a'.repeat(64)),false);
  assert.notEqual(raw.qaOwners.own,'a'.repeat(64));assert.equal(JSON.stringify(published.value).includes('qaOwners'),false);
  const result=b.rpc({action:'qaDelete',...user,questionIds:['own'],authorSecret:'a'.repeat(64)});assert.equal(result.ok,true);assert.equal(result.value.project.workspace.document.qaHistory.length,0);assert.deepEqual(result.value.project.workspace.questionDeletedIds,['own']);
  assert.equal(b.rpc({action:'qaDelete',...user,questionIds:['own'],authorSecret:'a'.repeat(64)}).ok,true);
  publish('another','b'.repeat(64));assert.equal(b.rpc({action:'qaDelete',...admin,questionIds:['another']}).ok,true);
});
test('legacy shared answers have no claimable author and can be removed only by project administrators',()=>{
  const {b,p,admin,user}=questionFixture(),file=b.folderFor(p.project.id).getFilesByName('project.json').next(),data=JSON.parse(file.getBlob().getDataAsString());data.document={name:'legacy',qaHistory:[qaAnswer('legacy')]};file.setContent(JSON.stringify(data));
  assert.equal(b.rpc({action:'qaDelete',...user,questionIds:['legacy'],authorSecret:'a'.repeat(64)}).code,'FORBIDDEN');
  assert.equal(b.rpc({action:'qaPublish',...user,records:[qaAnswer('legacy')],authorSecret:'a'.repeat(64)}).code,'FORBIDDEN');
  assert.equal(b.rpc({action:'qaUnpublish',...user,questionIds:['legacy'],authorSecret:'a'.repeat(64)}).code,'FORBIDDEN');
  assert.equal(b.rpc({action:'qaDelete',...admin,questionIds:['legacy']}).ok,true);
});
test('shared history cannot be deleted, edited or resurrected through ordinary metadata saves',()=>{
  const {b,admin,user,publish}=questionFixture();let project=publish('stable').value.project;
  project=b.rpc({action:'save',...user,changes:[],expectedVersion:project.version,metadata:{document:{name:'changed',qaHistory:[qaAnswer('injected')]},references:[]}}).value.project;assert.deepEqual(project.workspace.document.qaHistory.map(r=>r.id),['stable']);
  project=b.rpc({action:'save',...user,changes:[],expectedVersion:project.version,metadata:{document:null}}).value.project;assert.equal(project.workspace.document.qaHistory[0].id,'stable');
  project=b.rpc({action:'qaDelete',...admin,questionIds:['stable']}).value.project;
  project=b.rpc({action:'save',...user,changes:[],expectedVersion:project.version,metadata:{document:{qaHistory:[qaAnswer('stable')]}}}).value.project;assert.equal(project.workspace.document.qaHistory.length,0);
  assert.equal(publish('stable').code,'QA_DELETED');assert.deepEqual(project.workspace.questionDeletedIds,['stable']);
});
test('unpublishing retains authorship and republishing cannot steal another author or legacy id',()=>{
  const {b,admin,user,publish}=questionFixture();publish('one');assert.equal(b.rpc({action:'qaUnpublish',...user,questionIds:['one'],authorSecret:'b'.repeat(64)}).code,'FORBIDDEN');
  assert.equal(b.rpc({action:'qaUnpublish',...admin,questionIds:['one']}).ok,true);assert.equal(publish('one','b'.repeat(64)).code,'FORBIDDEN');assert.equal(publish('one').ok,true);
  assert.equal(b.rpc({action:'qaUnpublish',...user,questionIds:['one'],authorSecret:'a'.repeat(64)}).ok,true);assert.equal(publish('one').ok,true);
});
test('question batches validate atomically and reject forged ids and tokens from other projects',()=>{
  const {b,user,publish}=questionFixture();publish('mine');publish('theirs','b'.repeat(64));
  assert.equal(b.rpc({action:'qaDelete',...user,questionIds:['mine','theirs'],authorSecret:'a'.repeat(64)}).code,'FORBIDDEN');assert.equal(b.rpc({action:'load',...user}).value.project.workspace.document.qaHistory.length,2);
  for(const id of ['__proto__','constructor','prototype'])assert.equal(publish(id).ok,false);
  const other=b.create();assert.equal(b.rpc({action:'qaDelete',id:user.id,token:other.token,questionIds:['mine'],authorSecret:'a'.repeat(64)}).code,'AUTH');
  assert.equal(b.rpc({action:'qaPublish',...user,records:[qaAnswer('fresh'),qaAnswer('theirs')],authorSecret:'a'.repeat(64)}).code,'FORBIDDEN');assert.equal(b.rpc({action:'load',...user}).value.project.workspace.document.qaHistory.some(r=>r.id==='fresh'),false);
});

test('global directory cannot be listed or claimed publicly before owner setup',()=>{
  const b=backend(),p=b.create();
  assert.deepEqual(b.rpc({action:'directoryChallenge'}).value,{configured:false});
  assert.equal(b.rpc({action:'directoryList',token:p.token}).code,'DIRECTORY_UNCONFIGURED');
  assert.equal(b.rpc({action:'directorySetup',setupToken:'a'.repeat(64),salt:'d'.repeat(64),proof:'5'.repeat(64)}).code,'DIRECTORY_SETUP_INVALID');
  assert.equal(b.rpc({action:'prepareDirectorySetup'}).ok,false);
  assert.throws(()=>backend('').prepare(),/소유자/);assert.throws(()=>backend('another@example.test').prepare(),/소유자/);
});

test('owner setup link is one-time, private, expiring and reissuing revokes the previous link',()=>{
  const b=backend(),first=b.prepare(),firstToken=new URL(first.url).hash.split('=')[1];
  const second=b.prepare(),setupToken=new URL(second.url).hash.split('=')[1];
  assert.equal(b.rpc({action:'directorySetupChallenge',setupToken:firstToken}).code,'DIRECTORY_SETUP_INVALID');
  assert.deepEqual(b.rpc({action:'directorySetupChallenge',setupToken}).value,{ready:true});
  assert.equal(JSON.stringify([...b.properties]).includes(setupToken),false);
  b.advance(30*60000+1);assert.equal(b.rpc({action:'directorySetupChallenge',setupToken}).code,'DIRECTORY_SETUP_INVALID');
  const fresh=new URL(b.prepare().url).hash.split('=')[1];
  const result=b.rpc({action:'directorySetup',setupToken:fresh,salt:'d'.repeat(64),proof:'5'.repeat(64)});
  assert.ok(result.value.directoryToken);assert.equal(b.properties.has('DIRECTORY_SETUP'),false);
  assert.equal(b.rpc({action:'directorySetup',setupToken:fresh,salt:'d'.repeat(64),proof:'5'.repeat(64)}).code,'DIRECTORY_CONFIGURED');
  assert.throws(()=>b.prepare(),/이미 설정/);assert.equal(b.rpc({action:'directoryChallenge'}).value.configured,true);
});

test('directory and project tokens are isolated and directory responses reveal metadata only',()=>{
  const b=backend(),p=b.create(),session=b.directory(),auth={id:p.project.id,token:p.token};
  b.rpc({action:'save',...auth,changes:[{key:'secret-item',expectedRevision:0,item:{key:'secret-item',description:'private body'}}]});
  for(const directoryToken of ['',p.token,p.token+'x'])assert.equal(b.rpc({action:'directoryList',directoryToken}).code,'DIRECTORY_AUTH');
  assert.equal(b.rpc({action:'load',id:p.project.id,token:session.directoryToken}).code,'AUTH');
  const list=b.rpc({action:'directoryList',directoryToken:session.directoryToken}).value;
  assert.equal(list.projects.length,1);assert.deepEqual(Object.keys(list.projects[0]).sort(),['id','name','updatedAt']);assert.equal(list.projects[0].id,p.project.id);
  for(const secret of ['private body','secret-item','auth','hash','token','workspace'])assert.equal(JSON.stringify(list).includes(secret),false);
  const challenge=b.rpc({action:'directoryChallenge'}).value;assert.deepEqual(Object.keys(challenge).sort(),['configured','iterations','salt']);
  b.advance(12*60*60000+1);assert.equal(b.rpc({action:'directoryList',directoryToken:session.directoryToken}).code,'DIRECTORY_AUTH');
});

test('global directory paginates existing projects, skips trashed/unrelated folders and preserves contents',()=>{
  const b=backend(),originals=Array.from({length:43},()=>b.create()),before=JSON.stringify(originals),session=b.directory();
  const removed=b.create();b.folderFor(removed.project.id).setTrashed(true);
  b.root().createFolder('unrelated').createFile('private.txt','unrelated');
  b.root().createFolder('e'.repeat(64)).createFile('project.json','broken');
  let cursor='',skipped=0;const rows=[],pageSizes=[];
  do{const response=b.rpc({action:'directoryList',directoryToken:session.directoryToken,cursor});assert.equal(response.ok,true);const page=response.value;rows.push(...page.projects);pageSizes.push(page.projects.length);skipped+=page.skipped;cursor=page.nextCursor;}while(cursor);
  assert.deepEqual(pageSizes,[20,20,3]);assert.equal(skipped,1);assert.deepEqual(rows.map(p=>p.id).sort(),originals.map(p=>p.project.id).sort());assert.equal(JSON.stringify(originals),before);
  for(const p of originals)assert.deepEqual(b.rpc({action:'load',id:p.project.id,token:p.token}).value.project,p.project);
  const first=b.rpc({action:'directoryList',directoryToken:session.directoryToken}).value;
  assert.equal(b.rpc({action:'directoryList',directoryToken:session.directoryToken,cursor:first.nextCursor+'x'}).code,'DIRECTORY_CURSOR');
  assert.equal(b.rpc({action:'directoryList',directoryToken:session.directoryToken,cursor:session.directoryToken}).code,'DIRECTORY_CURSOR');
  assert.equal(b.rpc({action:'directoryList',directoryToken:session.directoryToken,cursor:'cursor-1'}).code,'DIRECTORY_CURSOR');
  b.advance(30*60000+1);assert.equal(b.rpc({action:'directoryList',directoryToken:session.directoryToken,cursor:first.nextCursor}).code,'DIRECTORY_CURSOR');
});

test('directory password changes revoke directory sessions and cursors without affecting project access',()=>{
  const b=backend(),projects=Array.from({length:21},()=>b.create()),session=b.directory();
  const cursor=b.rpc({action:'directoryList',directoryToken:session.directoryToken}).value.nextCursor;
  assert.equal(b.rpc({action:'directoryChangePassword',directoryToken:session.directoryToken,currentProof:'1'.repeat(64),newProof:'6'.repeat(64)}).code,'DIRECTORY_AUTH');
  const changed=b.rpc({action:'directoryChangePassword',directoryToken:session.directoryToken,currentProof:'5'.repeat(64),newProof:'6'.repeat(64)}).value;
  assert.ok(changed.directoryToken);assert.equal(b.rpc({action:'directoryList',directoryToken:session.directoryToken}).code,'DIRECTORY_AUTH');
  assert.equal(b.rpc({action:'directoryList',directoryToken:changed.directoryToken,cursor}).code,'DIRECTORY_CURSOR');
  assert.equal(b.rpc({action:'directoryLogin',proof:'5'.repeat(64)}).code,'DIRECTORY_AUTH');
  const again=b.rpc({action:'directoryLogin',proof:'6'.repeat(64)}).value;assert.ok(again.directoryToken);
  assert.equal(b.rpc({action:'load',id:projects[0].project.id,token:projects[0].token}).ok,true);
});

test('directory password failures are rate limited and expiry permits a correct retry',()=>{
  const b=backend();b.directory();
  for(let i=0;i<20;i++)assert.equal(b.rpc({action:'directoryLogin',proof:i===0?'invalid':'7'.repeat(64)}).code,'DIRECTORY_AUTH');
  assert.equal(b.rpc({action:'directoryLogin',proof:'5'.repeat(64)}).code,'RATE_LIMIT');
  b.advance(60001);assert.ok(b.rpc({action:'directoryLogin',proof:'5'.repeat(64)}).value.directoryToken);
});

test('renaming requires administrator credentials and rejects blank, long and stale names',()=>{
  const {rpc,create}=backend(),p=create(),id=p.project.id;
  const user=rpc({action:'login',id,proof:'2'.repeat(64)}).value;
  for(const auth of [{},{token:user.token},{proof:'2'.repeat(64)}])assert.equal(rpc({action:'renameProject',id,name:'새 이름',expectedName:'Test',...auth}).ok,false);
  for(const name of ['   ','a'.repeat(201),{}])assert.equal(rpc({action:'renameProject',id,token:p.token,name,expectedName:'Test'}).ok,false);
  assert.equal(rpc({action:'renameProject',id,token:p.token,name:'새 이름',expectedName:'stale'}).code,'CONFLICT');
  assert.equal(rpc({action:'load',id,token:p.token}).value.project.name,'Test');
});

test('rename preserves project ID, workspace, passwords and other projects; polling sees it',()=>{
  const {rpc,create}=backend(),p=create(),other=create(),auth={id:p.project.id,token:p.token};
  rpc({action:'save',...auth,changes:[{key:'r1',expectedRevision:0,item:{key:'r1',description:'보존할 원문',questions:[{question:'보존할 질문'}]}}]});
  const before=rpc({action:'upload',...auth,kind:'rfp',name:'original.pdf',base64:'YQ=='}).value.project;
  const renamed=rpc({action:'renameProject',...auth,name:'  변경한 프로젝트  ',expectedName:'Test'}).value.project;
  assert.equal(renamed.name,'변경한 프로젝트');assert.equal(renamed.id,before.id);assert.deepEqual(renamed.workspace,before.workspace);assert.equal(renamed.version,before.version+1);
  assert.equal(rpc({action:'load',...auth,version:before.version}).value.project.name,renamed.name);
  assert.equal(rpc({action:'login',id:p.project.id,proof:'2'.repeat(64)}).value.project.name,renamed.name);
  assert.equal(rpc({action:'load',id:other.project.id,token:other.token}).value.project.name,'Test');
  assert.equal(rpc({action:'renameProject',id:p.project.id,proof:'1'.repeat(64),name:'다시 변경',expectedName:renamed.name}).value.project.name,'다시 변경');
});
test('create returns project-scoped administrator token and no password hashes',()=>{const{create}=backend(),p=create();assert.equal(p.role,'admin');assert.equal(p.project.workspace.requirements.length,0);assert.equal(JSON.stringify(p.project).includes('auth'),false);});

test('project deletion requires administrator authorization and confirmation',()=>{
  const {rpc,create,folderFor}=backend(),p=create(),id=p.project.id;
  for(const [proof,confirmName,code]of [['3'.repeat(64),'Test','AUTH'],['2'.repeat(64),'Test','FORBIDDEN'],['1'.repeat(64),'wrong','CONFIRM']]){
    assert.equal(rpc({action:'deleteProject',id,token:p.token,proof,confirmName}).code,code);assert.equal(folderFor(id).isTrashed(),false);
  }
  assert.equal(rpc({action:'deleteProject',id,token:p.token}).code,'CONFIRM');
  assert.equal(rpc({action:'load',id,token:p.token}).ok,true);
});

test('deletion trashes only selected project; old sessions fail and restoring retains all content',()=>{
  const {rpc,create,folderFor}=backend(),a=create(),b=create(),auth={id:a.project.id,token:a.token};
  rpc({action:'save',...auth,changes:[{key:'r1',expectedRevision:0,item:{key:'r1',description:'keep',questions:[{question:'keep question'}]}}]});
  const upload=rpc({action:'upload',...auth,kind:'rfp',name:'original.pdf',base64:'YQ=='}).value.project;
  assert.deepEqual(rpc({action:'deleteProject',id:a.project.id,proof:'1'.repeat(64),confirmName:'Test'}).value,{deleted:true,id:a.project.id});
  assert.equal(rpc({action:'load',...auth}).code,'NOT_FOUND');assert.equal(rpc({action:'challenge',id:a.project.id}).code,'NOT_FOUND');
  assert.equal(rpc({action:'load',id:b.project.id,token:b.token}).ok,true);
  folderFor(a.project.id).setTrashed(false);
  assert.deepEqual(rpc({action:'load',...auth}).value.project,upload);
  assert.equal(rpc({action:'download',...auth,assetId:upload.workspace.assets[0].id}).value.base64,'YQ==');
});

test('repeated incorrect delete passwords are rate limited without deleting any data',()=>{
  const {rpc,create,folderFor}=backend(),p=create(),id=p.project.id;
  for(let i=0;i<20;i++)assert.equal(rpc({action:'deleteProject',id,proof:'3'.repeat(64),confirmName:'Test'}).code,'AUTH');
  assert.equal(rpc({action:'deleteProject',id,proof:'1'.repeat(64),confirmName:'Test'}).code,'RATE_LIMIT');assert.equal(folderFor(id).isTrashed(),false);
});
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


test('remembered directory sessions last 90 days and password change revokes old sessions and their project access',()=>{
 const b=backend(),p=b.create(),initial=b.directory();
 const remembered=b.rpc({action:'directoryLogin',proof:'5'.repeat(64),remember:true}).value;
 assert.equal(remembered.expiresAt-initial.expiresAt,(90*24-12)*3600000);
 const opened=b.rpc({action:'directoryOpen',id:p.project.id,directoryToken:remembered.directoryToken});assert.equal(opened.ok,true);assert.equal(opened.value.role,'admin');
 b.advance(13*3600000);assert.equal(b.rpc({action:'directoryList',directoryToken:initial.directoryToken}).code,'DIRECTORY_AUTH');
 assert.equal(b.rpc({action:'directoryList',directoryToken:remembered.directoryToken}).ok,true);
 const changed=b.rpc({action:'directoryChangePassword',directoryToken:remembered.directoryToken,currentProof:'5'.repeat(64),newProof:'6'.repeat(64),remember:true});assert.equal(changed.ok,true);
 assert.equal(b.rpc({action:'directoryOpen',id:p.project.id,directoryToken:remembered.directoryToken}).code,'DIRECTORY_AUTH');
 assert.equal(b.rpc({action:'load',id:p.project.id,token:opened.value.token}).code,'AUTH');
 assert.equal(b.rpc({action:'login',id:p.project.id,proof:'1'.repeat(64)}).ok,true);
 assert.equal(b.rpc({action:'directoryOpen',id:p.project.id,directoryToken:changed.value.directoryToken}).ok,true);
});
test('directory administrator deletion needs confirmation, preserves other projects and supports trash recovery',()=>{
 const b=backend(),p=b.create(),other=b.create(),d=b.directory(),auth={action:'deleteProject',id:p.project.id,directoryToken:d.directoryToken};
 assert.equal(b.rpc(auth).code,'CONFIRM');assert.equal(b.folderFor(p.project.id).isTrashed(),false);
 assert.equal(b.rpc({...auth,directoryToken:'forged',confirmed:true}).code,'DIRECTORY_AUTH');
 assert.equal(b.rpc({...auth,confirmed:true}).ok,true);assert.equal(b.folderFor(p.project.id).isTrashed(),true);
 assert.equal(b.rpc({action:'load',id:other.project.id,token:other.token}).ok,true);
 b.folderFor(p.project.id).setTrashed(false);assert.equal(b.rpc({action:'load',id:p.project.id,token:p.token}).ok,true);
});
test('ordinary project administrator can delete with its own session but a user or other project cannot',()=>{
 const b=backend(),p=b.create(),other=b.create(),user=b.rpc({action:'login',id:p.project.id,proof:'2'.repeat(64)}).value;
 assert.equal(b.rpc({action:'deleteProject',id:p.project.id,token:user.token,confirmed:true}).code,'FORBIDDEN');
 assert.equal(b.rpc({action:'deleteProject',id:p.project.id,token:other.token,confirmed:true}).code,'AUTH');
 assert.equal(b.rpc({action:'directoryOpen',id:p.project.id,directoryToken:p.token}).ok,false);
 assert.equal(b.rpc({action:'deleteProject',id:p.project.id,token:p.token,confirmed:true}).ok,true);
});
