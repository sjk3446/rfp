/* Opt-in Drive collaboration. An empty endpoint leaves existing local projects untouched. */
(() => {
  'use strict';
  const endpoint = window.REQLY_CLOUD?.endpoint || '';
  const parameters = new URLSearchParams(location.search);
  const useShared = !!endpoint && parameters.get('mode') !== 'local' && (parameters.has('project') || parameters.get('mode') === 'shared' || location.hostname.endsWith('.github.io'));
  let project, token='', role='', peer, peerOrigin, ready, timer, busy=false;
  let saveQueue=Promise.resolve();
  let opening;
  function finishLoading(){opening?.close();opening=null;}
  function beginLoading(title,detail){finishLoading();opening=window.ReqlyProjectPicker?.loading(title,detail);}
  const pending = new Map();
  const hex = bytes => [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const core = window.ReqlySharedCore;
  let directoryStorage;try{directoryStorage=window.localStorage;}catch(_){}
  const directory=window.ReqlyProjectDirectory?.create(directoryStorage);
  const clone = value => JSON.parse(JSON.stringify(value));
  function fields(title, labels, options={}){
    return new Promise(resolve=>{
      const modal=document.createElement('div');modal.className='pages-modal open';
      const dialog=document.createElement('section');dialog.className='pages-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
      const body=document.createElement('form');body.className='pages-body';const heading=document.createElement('h2');heading.textContent=title;heading.id=`form-${crypto.randomUUID()}`;dialog.setAttribute('aria-labelledby',heading.id);body.append(heading);
      if(title==='새 프로젝트')body.className+=' credential-form';
      const intro=document.createElement('p');intro.className='ui-form-intro';intro.textContent=options.description||(title==='새 프로젝트'?'관리자용과 사용자용 비밀번호를 각각 설정해 주세요. 관리자만 비밀번호를 변경할 수 있습니다.':title==='비밀번호 변경'?'변경할 비밀번호를 선택하고 새 비밀번호를 두 번 입력해 주세요.':'프로젝트 비밀번호를 입력하면 문서와 검토 내용을 열 수 있습니다.');body.append(intro);
      const error=document.createElement('p');error.id=`error-${crypto.randomUUID()}`;error.setAttribute('role','alert');error.style.color='#b42335';error.hidden=true;let attempted=false;
      const inputs=labels.map(({label,password,options,autocomplete,value,maxLength})=>{
        const wrap=document.createElement('div');wrap.className='pages-field';
        const caption=document.createElement('label');caption.textContent=label;caption.style.fontWeight='750';
        const input=document.createElement(options?'select':'input');input.id=`field-${crypto.randomUUID()}`;caption.htmlFor=input.id;
        if(options){options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);});}
        else{input.type=password?'password':'text';input.autocomplete=autocomplete||(password?'current-password':'off');}
        if(value!==undefined)input.value=value;if(maxLength)input.maxLength=maxLength;
        input.required=true;input.setAttribute('aria-describedby',error.id);wrap.append(caption);
        if(password){
          const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center';input.style.minWidth='0';
          const toggle=document.createElement('button');toggle.type='button';toggle.className='pages-action';toggle.textContent='보기';toggle.style.cssText='flex-shrink:0;white-space:nowrap';toggle.setAttribute('aria-label',`${label} 보기`);toggle.setAttribute('aria-controls',input.id);toggle.setAttribute('aria-pressed','false');
          toggle.onclick=()=>{const visible=input.type==='password';input.type=visible?'text':'password';toggle.textContent=visible?'숨기기':'보기';toggle.setAttribute('aria-label',`${label} ${visible?'숨기기':'보기'}`);toggle.setAttribute('aria-pressed',String(visible));};
          row.append(input,toggle);wrap.append(row);
        }else wrap.append(input);
        input.oninput=()=>{if(attempted)validate();};body.append(wrap);return input;
      });
      function validate(){
        inputs.forEach(input=>input.setAttribute('aria-invalid','false'));
        for(let i=0;i<labels.length;i++){
          const field=labels[i];let message='';
          if(field.mustMatch!==undefined&&inputs[i].value!==inputs[field.mustMatch].value)message=`${field.label}: 앞서 입력한 비밀번호와 일치하지 않습니다.`;
          else if(field.differentFrom!==undefined&&inputs[i].value===inputs[field.differentFrom].value)message='관리자용 비밀번호와 사용자용 비밀번호는 서로 다르게 입력해 주세요.';
          else if(field.equals!==undefined&&inputs[i].value!==field.equals)message='삭제할 프로젝트 이름을 정확히 입력해 주세요.';
          else if(field.nonBlank&&!inputs[i].value.trim())message='프로젝트 이름을 입력해 주세요.';
          else if(field.maxLength&&inputs[i].value.trim().length>field.maxLength)message=`프로젝트 이름은 ${field.maxLength}자 이하로 입력해 주세요.`;
          if(message){error.textContent=message;error.hidden=false;inputs[i].setAttribute('aria-invalid','true');return inputs[i];}
        }
        error.textContent='';error.hidden=true;return null;
      }
      body.append(error);
      const done=document.createElement('button');done.type='submit';done.className='pages-action primary';done.textContent=title==='새 프로젝트'?'프로젝트 만들기':title==='비밀번호 변경'?'비밀번호 변경':title==='프로젝트 접속'?'프로젝트 열기':'확인';const cancel=document.createElement('button');cancel.type='button';cancel.className='pages-action';cancel.textContent='취소';cancel.setAttribute('data-dialog-cancel','');const actions=document.createElement('div');actions.className='ui-dialog-actions';actions.append(cancel,done);body.append(actions);dialog.append(body);modal.append(dialog);document.body.append(modal);
      const finish=value=>{inputs.forEach((input,index)=>{input.value='';if(labels[index].password)input.type='password';});modal.remove();resolve(value);};
      if(options.cancel)cancel.textContent=options.cancel;
      if(options.submit)done.textContent=options.submit;
      const close=document.createElement('button');close.type='button';close.className='pages-close credential-close';close.textContent='×';close.setAttribute('aria-label',`${title} 닫기`);close.onclick=()=>finish(null);body.append(close);
      body.onsubmit=event=>{event.preventDefault();attempted=true;const invalid=validate();if(invalid){invalid.focus();return;}finish(inputs.map(input=>input.value));};cancel.onclick=()=>finish(null);
    });
  }
  async function proof(password, salt) {
    if (!password) throw new Error('비밀번호를 입력해 주세요.');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bytes=Uint8Array.from(salt.match(/../g),value=>parseInt(value,16));
    return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:600000,hash:'SHA-256'},key,256)));
  }
  function connect() {
    if (ready) return ready;
    ready = new Promise((resolve,reject)=>{
      const url=new URL(endpoint);
      if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw new Error('Google 웹 앱 주소가 올바르지 않습니다.');
      url.searchParams.set('channel',nonce);
      const frame=document.createElement('iframe');frame.hidden=true;frame.src=url.href;
      const timeout=setTimeout(()=>{window.removeEventListener?.('message',onMessage);frame.remove();reject(new Error('저장소 연결을 확인해 주세요.'));},60000);
      const onMessage=event=>{
        const message=event.data;
        if(!message||message.channel!=='reqly-drive-v1'||message.nonce!==nonce)return;
        if(!/^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin))return;
        if(message.ready&&!peer){peer=event.source;peerOrigin=event.origin;clearTimeout(timeout);resolve();return;}
        if(event.source!==peer||event.origin!==peerOrigin)return;
        const job=pending.get(message.requestId);if(!job)return;
        pending.delete(message.requestId);clearTimeout(job.timeout);
        if(message.result?.ok)job.resolve(message.result.value);
        else {const error=new Error(message.result?.error||'저장하지 못했습니다.');error.code=message.result?.code;job.reject(error);}
      };
      window.addEventListener('message',onMessage);
      document.body.appendChild(frame);
    }).catch(error=>{ready=undefined;throw error;});
    return ready;
  }
  async function rpc(action, body={}) {
    await connect();
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const timeout=setTimeout(()=>{pending.delete(requestId);reject(new Error('응답을 확인하지 못했습니다. 최신 저장 상태를 확인해 주세요.'));},120000);
      pending.set(requestId,{resolve,reject,timeout});
      const request=JSON.parse(JSON.stringify({action,id:project?.id,token,...body}));
      peer.postMessage({channel:'reqly-drive-v1',nonce,requestId,request},peerOrigin);
    });
  }
  function accept(result) {
    if(result.token)token=result.token;if(result.role)role=result.role;
    // A load started before a save can finish after it. Never roll back revisions.
    if(result.project&&project?.id===result.project.id&&result.project.version<project.version)return project;
    if(result.project)project=clone(result.project);
    if(result.project&&window.ReqlyPortal?.project?.id===project.id)window.ReqlyPortal.project.name=project.name;
    if(result.project)directory?.remember(project,!!result.token);
    window.dispatchEvent(new CustomEvent('reqly-shared-update',{detail:{project:clone(project),role}}));
    return project;
  }
  async function poll() {
    if(busy||!token||document.hidden)return;
    try {const result=await rpc('load',{version:project.version});if(!result.unchanged)accept(result);}
    catch(error){window.dispatchEvent(new CustomEvent('reqly-shared-error',{detail:{message:error.message,code:error.code}}));}
  }
  window.ReqlyShared = {
    available:!!endpoint,
    enabled:useShared,
    get project(){return project;}, get role(){return role;},
    async start(){
      const id=new URL(location.href).searchParams.get('project');
      let selection=id?{id,name:directory?.list().find(item=>item.id===id)?.name||''}:new URL(location.href).searchParams.get('new')==='1'?{create:true}:null,message='';
      while(!project){
        // Base URL always opens the list. Creation requires its explicit button.
        selection ||= await window.ReqlyProjectPicker.choose({projects:this.knownProjects(),message});message='';
        try{
          if(selection.create){await this.create();}
          else{
            let result;
            while(!result){
              const entry=await fields('프로젝트 접속',[{label:'프로젝트 비밀번호',password:true}],{description:message||(selection.name?`‘${selection.name}’ 프로젝트의 비밀번호를 입력해 주세요.`:'선택한 프로젝트의 비밀번호를 입력해 주세요.'),cancel:'프로젝트 목록으로'});
              if(entry===null){message='';break;}
              try{
                beginLoading(selection.name?`‘${selection.name}’ 여는 중`:'프로젝트를 불러오는 중입니다','저장소에 연결하고 있습니다.');
                const challenge=await rpc('challenge',{id:selection.id});
                opening?.update('비밀번호를 확인하고 있습니다.');const credential=await proof(entry[0],challenge.salt);
                opening?.update('프로젝트와 저장된 내용을 불러오고 있습니다.');result=await rpc('login',{id:selection.id,proof:credential});
              }
              catch(error){finishLoading();if(error.code!=='AUTH')throw error;message=error.message;}
            }
            if(result)accept(result);
          }
        }catch(error){finishLoading();message=error.message||'프로젝트를 열지 못했습니다. 다시 선택해 주세요.';}
        selection=null;
        const url=new URL(location.href);url.searchParams.delete('project');url.searchParams.delete('new');
        if(project)url.searchParams.set('project',project.id);
        history.replaceState(null,'',url);
      }
      opening?.update('요구사항 목록과 화면을 구성하고 있습니다.');
      timer=setInterval(poll,10000);return{workspace:clone(project.workspace)};
    },
    async create(){
      const entry=await fields('새 프로젝트',[{label:'프로젝트 이름'},{label:'관리자용 비밀번호',password:true,autocomplete:'new-password'},{label:'관리자용 비밀번호 확인',password:true,autocomplete:'new-password',mustMatch:1},{label:'사용자용 비밀번호',password:true,autocomplete:'new-password',differentFrom:1},{label:'사용자용 비밀번호 확인',password:true,autocomplete:'new-password',mustMatch:3}],{cancel:'프로젝트 목록으로'});if(!entry)return null;
      const [name,admin,,user]=entry;
      if(admin===user)throw new Error('두 비밀번호는 서로 달라야 합니다.');
      beginLoading('프로젝트를 만들고 있습니다','비밀번호를 설정하고 있습니다.');
      try{
        const salt=hex(crypto.getRandomValues(new Uint8Array(32)));
        const credentials={admin:{salt,proof:await proof(admin,salt)},user:{salt,proof:await proof(user,salt)}};
        opening?.update('새 프로젝트를 저장하고 있습니다.');
        const result=await rpc('create',{name,...credentials});
        accept(result);const url=new URL(location.href);url.searchParams.set('project',project.id);history.replaceState(null,'',url);return project;
      }catch(error){finishLoading();throw error;}
    },
    async deleteProject(target){
      if(!/^[a-f0-9]{64}$/.test(target?.id||'')||!target.name)throw new Error('삭제할 프로젝트를 확인해 주세요.');
      const entry=await fields('프로젝트 삭제',[{label:'관리자용 비밀번호',password:true},{label:'삭제할 프로젝트 이름',equals:target.name}],{
        description:`‘${target.name}’ 프로젝트와 첨부 파일을 삭제합니다. 공유 링크로도 열 수 없게 됩니다. 자료는 Google Drive 휴지통으로 이동합니다. 관리자용 비밀번호와 위 프로젝트 이름을 입력해 주세요.`,submit:'프로젝트 삭제'});
      if(!entry)return false;
      const progress=window.ReqlyProjectPicker?.loading('프로젝트를 삭제하고 있습니다','진행 중인 저장을 마무리하고 있습니다.');
      try{
        await saveQueue;busy=true;progress?.update('관리자 비밀번호를 확인하고 있습니다.');
        const challenge=await rpc('challenge',{id:target.id});
        const credential=await proof(entry[0],challenge.salt);progress?.update('선택한 프로젝트를 휴지통으로 이동하고 있습니다.');
        const result=await rpc('deleteProject',{id:target.id,proof:credential,confirmName:entry[1]});
        if(!result.deleted||result.id!==target.id)throw new Error('삭제 완료를 확인하지 못했습니다. 프로젝트 목록을 다시 확인해 주세요.');
        directory?.forget(target.id);
        if(project?.id===target.id)this.disconnect();
        return true;
      }finally{busy=false;progress?.close();}
    },
    async renameProject(target){
      if(!/^[a-f0-9]{64}$/.test(target?.id||'')||!target.name)throw new Error('변경할 프로젝트를 확인해 주세요.');
      const signedIn=project?.id===target.id&&role==='admin'&&!!token;
      const labels=[{label:'프로젝트 이름',value:target.name,maxLength:200,nonBlank:true}];
      if(!signedIn)labels.push({label:'관리자용 비밀번호',password:true});
      const entry=await fields('프로젝트 이름 변경',labels,{description:signedIn?'새 프로젝트 이름을 입력해 주세요.':'새 이름과 해당 프로젝트의 관리자용 비밀번호를 입력해 주세요.',submit:'이름 저장'});
      if(!entry)return null;const name=entry[0].trim();if(name===target.name)return target;
      const progress=window.ReqlyProjectPicker?.loading('프로젝트 이름을 저장하고 있습니다','변경 내용을 확인하고 있습니다.');
      const operation=saveQueue.then(async()=>{
        busy=true;
        try{
          const auth=signedIn?{}:{proof:await proof(entry[1],(await rpc('challenge',{id:target.id})).salt)};
          const result=await rpc('renameProject',{id:target.id,name,expectedName:target.name,...auth});
          if(result.project?.id!==target.id||result.project?.name!==name)throw new Error('이름 저장을 확인하지 못했습니다. 다시 확인해 주세요.');
          if(project?.id===target.id)accept(result);else directory?.remember(result.project);
          return result.project;
        }finally{busy=false;progress?.close();}
      });
      saveQueue=operation.catch(()=>{});return operation;
    },
    finishLoading,
    async saveItems(items,metadata){
      const original=clone(project),drafts=clone(items),meta=metadata?clone(metadata):undefined;
      const operation=saveQueue.then(async()=>{
        busy=true;
        try{
          if(project.id!==original.id)throw new Error('프로젝트가 변경되어 저장하지 않았습니다.');
          for(let attempt=0;attempt<2;attempt++){
            const rebased=drafts.map(draft=>{
              const base=original.workspace.requirements.find(item=>item.key===draft.key);
              // Unknown stale callers must not be granted the current revision.
              if(base&&(draft.revision||0)!==(base.revision||0))throw core.conflictError();
              const latest=project.workspace.requirements.find(item=>item.key===draft.key);
              const result=core.mergeEdits(base,draft,latest);
              if(result.conflicts.length)throw core.conflictError(result.conflicts);
              return result.item;
            });
            if(meta&&['document','references'].some(field=>core.canonical(original.workspace[field])!==core.canonical(project.workspace[field])))
              throw core.conflictError();
            const changes=core.changesBetween(project.workspace.requirements,rebased);
            if(!changes.length&&!meta)return project;
            try{return accept(await rpc('save',{changes,metadata:meta,expectedVersion:project.version}));}
            catch(error){
              if(error.code!=='CONFLICT')throw error;
              accept(await rpc('load'));
              if(attempt)throw core.conflictError();
            }
          }
        }finally{busy=false;}
      });
      saveQueue=operation.catch(()=>{});
      return operation;
    },
    async upload(file,kind){
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return accept(await rpc('upload',{name:file.name,kind,base64:btoa(binary)}));
    },
    async deleteItems(items){return accept(await rpc('save',{changes:items.map(item=>({key:item.key,expectedRevision:item.revision||0,remove:true}))}));},
    async download(assetId){const result=await rpc('download',{assetId});const bytes=Uint8Array.from(atob(result.base64),char=>char.charCodeAt(0));return new File([bytes],result.name);},
    async removeFile(assetId){return accept(await rpc('removeFile',{assetId}));},
    async selectRfp(assetId){return accept(await rpc('selectRfp',{assetId}));},
    async changePassword(which,currentPassword,newPassword){
      const salt=(await rpc('challenge')).salt;
      const result=await rpc('password',{role:which,currentProof:await proof(currentPassword,salt),newProof:await proof(newPassword,salt)});
      if(result.reconnect)this.disconnect();return result;
    },
    async refresh(){return accept(await rpc('load'));},
    disconnect(){clearInterval(timer);token='';role='';},
    knownProjects(){return directory?.list()||[];},
    shareUrl(){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('project',project.id);return url.href;},
    fields
  };
})();
