/* Opt-in Drive collaboration. An empty endpoint leaves existing local projects untouched. */
(() => {
  'use strict';
  const endpoint = window.REQLY_CLOUD?.endpoint || '';
  const parameters = new URLSearchParams(location.search);
  const useShared = !!endpoint && parameters.get('mode') !== 'local' && (parameters.has('project') || parameters.get('mode') === 'shared' || location.hostname.endsWith('.github.io'));
  let project, token='', role='', peer, peerOrigin, ready, timer, busy=false;
  const pending = new Map();
  const hex = bytes => [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const core = window.ReqlySharedCore;
  const clone = value => JSON.parse(JSON.stringify(value));
  function fields(title, labels){
    return new Promise(resolve=>{
      const modal=document.createElement('div');modal.className='pages-modal open';
      const dialog=document.createElement('section');dialog.className='pages-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
      const body=document.createElement('form');body.className='pages-body';const heading=document.createElement('h2');heading.textContent=title;heading.id=`form-${crypto.randomUUID()}`;dialog.setAttribute('aria-labelledby',heading.id);body.append(heading);
      if(title==='새 프로젝트')body.className+=' credential-form';
      const intro=document.createElement('p');intro.className='ui-form-intro';intro.textContent=title==='새 프로젝트'?'관리자용과 사용자용 비밀번호를 각각 설정해 주세요. 관리자만 비밀번호를 변경할 수 있습니다.':title==='비밀번호 변경'?'변경할 비밀번호를 선택하고 새 비밀번호를 두 번 입력해 주세요.':'프로젝트 비밀번호를 입력하면 문서와 검토 내용을 열 수 있습니다.';body.append(intro);
      const error=document.createElement('p');error.id=`error-${crypto.randomUUID()}`;error.setAttribute('role','alert');error.style.color='#b42335';error.hidden=true;let attempted=false;
      const inputs=labels.map(({label,password,options,autocomplete})=>{
        const wrap=document.createElement('div');wrap.className='pages-field';
        const caption=document.createElement('label');caption.textContent=label;caption.style.fontWeight='750';
        const input=document.createElement(options?'select':'input');input.id=`field-${crypto.randomUUID()}`;caption.htmlFor=input.id;
        if(options){options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);});}
        else{input.type=password?'password':'text';input.autocomplete=autocomplete||(password?'current-password':'off');}
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
          if(message){error.textContent=message;error.hidden=false;inputs[i].setAttribute('aria-invalid','true');return inputs[i];}
        }
        error.textContent='';error.hidden=true;return null;
      }
      body.append(error);
      const done=document.createElement('button');done.type='submit';done.className='pages-action primary';done.textContent=title==='새 프로젝트'?'프로젝트 만들기':title==='비밀번호 변경'?'비밀번호 변경':title==='프로젝트 접속'?'프로젝트 열기':'확인';const cancel=document.createElement('button');cancel.type='button';cancel.className='pages-action';cancel.textContent='취소';cancel.setAttribute('data-dialog-cancel','');const actions=document.createElement('div');actions.className='ui-dialog-actions';actions.append(cancel,done);body.append(actions);dialog.append(body);modal.append(dialog);document.body.append(modal);
      const finish=value=>{inputs.forEach((input,index)=>{input.value='';if(labels[index].password)input.type='password';});modal.remove();resolve(value);};
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
      const timeout=setTimeout(()=>reject(new Error('저장소 연결을 확인해 주세요.')),60000);
      window.addEventListener('message',event=>{
        const message=event.data;
        if(!message||message.channel!=='reqly-drive-v1'||message.nonce!==nonce)return;
        if(!/^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin))return;
        if(message.ready&&!peer){peer=event.source;peerOrigin=event.origin;clearTimeout(timeout);resolve();return;}
        if(event.source!==peer||event.origin!==peerOrigin)return;
        const job=pending.get(message.requestId);if(!job)return;
        pending.delete(message.requestId);clearTimeout(job.timeout);
        if(message.result?.ok)job.resolve(message.result.value);
        else {const error=new Error(message.result?.error||'저장하지 못했습니다.');error.code=message.result?.code;job.reject(error);}
      });
      document.body.appendChild(frame);
    });
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
    if(result.project)project=clone(result.project);
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
      await connect();
      const id=new URL(location.href).searchParams.get('project');
      if(id){
        const challenge=await rpc('challenge',{id});
        let result;
        while(!result){const entry=await fields('프로젝트 접속',[{label:'프로젝트 비밀번호',password:true}]);if(entry===null)throw new Error('프로젝트 접속을 취소했습니다.');const password=entry[0];
          try{result=await rpc('login',{id,proof:await proof(password,challenge.salt)});}catch(error){if(error.code!=='AUTH')throw error;if(window.ReqlyDesign)await window.ReqlyDesign.notice('프로젝트 접속',error.message);else alert(error.message);}}
        accept(result);
      }else await this.create();
      timer=setInterval(poll,10000);return{workspace:clone(project.workspace)};
    },
    async create(){
      const entry=await fields('새 프로젝트',[{label:'프로젝트 이름'},{label:'관리자용 비밀번호',password:true,autocomplete:'new-password'},{label:'관리자용 비밀번호 확인',password:true,autocomplete:'new-password',mustMatch:1},{label:'사용자용 비밀번호',password:true,autocomplete:'new-password',differentFrom:1},{label:'사용자용 비밀번호 확인',password:true,autocomplete:'new-password',mustMatch:3}]);if(!entry)throw new Error('취소했습니다.');
      const [name,admin,,user]=entry;
      if(admin===user)throw new Error('두 비밀번호는 서로 달라야 합니다.');
      const salt=hex(crypto.getRandomValues(new Uint8Array(32)));
      const result=await rpc('create',{name,admin:{salt,proof:await proof(admin,salt)},user:{salt,proof:await proof(user,salt)}});
      accept(result);const url=new URL(location.href);url.searchParams.set('project',project.id);history.replaceState(null,'',url);return project;
    },
    async saveItems(items,metadata){
      if(busy)throw new Error('저장 중입니다. 잠시 기다려 주세요.');busy=true;
      try{const changes=core.changesBetween(project.workspace.requirements,items);if(!changes.length&&!metadata)return project;
        return accept(await rpc('save',{changes,metadata,expectedVersion:project.version}));}finally{busy=false;}
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
    shareUrl(){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('project',project.id);return url.href;},
    fields
  };
})();
