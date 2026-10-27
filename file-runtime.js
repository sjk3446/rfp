/* Originals are kept separately from requirement edits and JSON backups. */
(() => {
  'use strict';
  let database, modal, settingsModal, settingsPanel, currentId='', working=false, switching=false;
  const shared=()=>!!window.ReqlyShared?.enabled;
  function db(){return database||=(new Promise((resolve,reject)=>{const r=indexedDB.open('reqly-original-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
  async function operation(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('files',mode),r=fn(tx.objectStore('files'));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function list(){if(shared())return window.ReqlyShared.project.workspace.assets||[];return(await operation('readonly',s=>s.getAll())).filter(file=>file.projectId===currentId);}
  async function add(file,kind){
    if(file.size>30*1024*1024)throw new Error('파일은 30MB 이하로 올려 주세요.');
    if(shared())return window.ReqlyShared.upload(file,kind);
    const value={id:crypto.randomUUID(),projectId:currentId,kind,name:file.name,size:file.size,uploadedAt:new Date().toISOString(),blob:file};
    await operation('readwrite',s=>s.put(value));return value;
  }
  function typedOriginal(file){
    // Drive stores bytes generically; restore the type so PDFs open in the viewer.
    const extension=file.name.split('.').pop().toLowerCase();
    const types={pdf:'application/pdf',txt:'text/plain',md:'text/plain',csv:'text/csv',tsv:'text/tab-separated-values'};
    const type=types[extension]||file.type||'application/octet-stream';
    return new File([file],file.name,{type,lastModified:file.lastModified});
  }
  async function original(id){if(shared())return typedOriginal(await window.ReqlyShared.download(id));const stored=await operation('readonly',s=>s.get(id));if(!stored||stored.projectId!==currentId)throw new Error('원본 파일이 없습니다. 다시 업로드해 주세요.');return typedOriginal(new File([stored.blob],stored.name));}
  async function remove(id){
    if(shared())return window.ReqlyShared.removeFile(id);
    const files=await list(),file=files.find(item=>item.id===id);
    if(!file)throw new Error('파일이 없습니다.');
    if(file.kind==='rfp'&&files.filter(item=>item.kind==='rfp').length<=1)throw new Error('마지막 RFP는 삭제할 수 없습니다.');
    if(localStorage.getItem(`reqly-rfp-${currentId}`)===id)throw new Error('다른 RFP를 먼저 선택해 주세요.');
    await operation('readwrite',s=>s.delete(id));
    window.dispatchEvent(new CustomEvent('reqly-file-removed',{detail:{id}}));
  }
  function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function notice(text,error=false){const el=modal.querySelector('[data-message]');el.textContent=text;el.dataset.error=String(error);}
  function deletionReason(file,files,selected){
    if(shared()&&window.ReqlyShared.role!=='admin')return '파일 삭제는 관리자만 가능합니다.';
    if(file.kind==='rfp'&&files.filter(item=>item.kind==='rfp').length<=1)return '마지막 RFP는 삭제할 수 없습니다.';
    if(file.kind==='rfp'&&selected===file.id)return '다른 RFP를 기본으로 지정한 뒤 삭제해 주세요.';
    return '';
  }
  function settingsNotice(text){settingsModal.querySelector('[data-settings-message]').textContent=text;}
  async function navigateProject(url){
    if(switching)return;switching=true;
    try{
      if(window.ReqlyApp?.confirmLeave&&!(await window.ReqlyApp.confirmLeave()))return;
      window.ReqlyApp?.allowNavigation?.();
      location.href=url;
    }finally{switching=false;}
  }
  function renderProjectList(){
    const section=settingsPanel.querySelector('[data-known-projects]');
    section.hidden=!window.ReqlyShared?.available;
    const area=section.querySelector('[data-shared-project-list]');area.replaceChildren();
    const projects=window.ReqlyShared?.knownProjects?.()||[];
    if(!projects.length)area.append(node('p','아직 기록된 공유 프로젝트가 없습니다. 아래에 기존 공유 링크를 붙여 넣어 열 수 있습니다.','fm-empty'));
    for(const project of projects){
      const row=node('article',undefined,'shared-project-row'),info=node('div'),name=node('h4',project.name);
      const current=shared()&&project.id===window.ReqlyShared.project.id;
      const date=new Date(project.updatedAt),stamp=Number.isNaN(date.getTime())?'마지막 저장일 확인 전':`마지막 확인한 저장: ${date.toLocaleString('ko-KR')}`;
      info.append(name,node('p',stamp));row.append(info);
      const actions=window.ReqlyProjectPicker.actions(project,{current,onOpen:()=>navigateProject(window.ReqlyProjectDirectory.projectUrl(location.href,project.id)),onDelete:async()=>{
        try{
          if(current&&window.ReqlyApp?.confirmLeave&&!(await window.ReqlyApp.confirmLeave()))return;
          if(!(await window.ReqlyShared.deleteProject(project)))return;
          if(current){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('mode','shared');window.ReqlyApp?.allowNavigation?.();location.href=url.href;}
          else{renderProjectList();settingsNotice(`‘${project.name}’ 프로젝트를 삭제했습니다.`);}
        }catch(error){settingsNotice(error.message);}
      }});
      row.append(actions);area.append(row);
    }
  }
  function renderSettings(){
    const role=shared()?window.ReqlyShared.role:'';
    settingsPanel.querySelector('[data-share]').hidden=!shared();settingsPanel.querySelector('[data-new]').hidden=!window.ReqlyShared?.available;
    settingsPanel.querySelector('.fm-setting-note').hidden=!shared();
    settingsPanel.querySelector('[data-password]').hidden=!shared()||role!=='admin';
    settingsPanel.querySelector('[data-password]').closest('.fm-setting').hidden=!shared();
    settingsPanel.querySelector('[data-password-note]').textContent=role==='admin'?'관리자용·사용자용 비밀번호를 변경할 수 있습니다. 현재 관리자용 비밀번호를 입력해 주세요.':'관리자용 비밀번호로 접속하면 비밀번호를 변경할 수 있습니다.';
    settingsPanel.querySelector('[data-share-intro]').textContent=shared()?'아래 링크와 사용자용 비밀번호를 전달하면 함께 조회·편집할 수 있습니다.':'현재는 브라우저 프로젝트입니다. 다른 사람과 함께 작업하려면 새 공유 프로젝트를 만들어 주세요.';
    const url=settingsPanel.querySelector('[data-project-url]');url.closest('label').hidden=!shared();url.value=shared()?window.ReqlyShared.shareUrl():'';
    const title=settingsModal.querySelector('h2');if(shared())title.textContent=window.ReqlyShared.project.name;
    renderProjectList();
  }
  async function run(button,fn){
    if(working)return;working=true;notice('처리 중입니다…');modal.setAttribute('aria-busy','true');
    const old=button.textContent;button.disabled=true;button.textContent='처리 중…';
    try{await fn();await render();}catch(error){notice(error.message,true);}finally{working=false;modal.setAttribute('aria-busy','false');button.textContent=old;button.disabled=false;}
  }
  async function choose(id){if(shared())await window.ReqlyShared.selectRfp(id);else localStorage.setItem(`reqly-rfp-${currentId}`,id);}
  async function render(){
    const files=await list(),selected=shared()?window.ReqlyShared.project.workspace.selectedRfp:localStorage.getItem(`reqly-rfp-${currentId}`);
    const role=shared()?window.ReqlyShared.role:'';
    modal.querySelector('[data-project-name]').textContent=shared()?window.ReqlyShared.project.name:window.ReqlyPortal?.project?.name||'현재 프로젝트';
    modal.querySelector('[data-project-role]').textContent=shared()?(role==='admin'?'관리자 접속':'사용자 접속'):'브라우저 프로젝트';
    for(const kind of ['rfp','reference']){
      const subset=files.filter(file=>file.kind===kind),area=modal.querySelector(`[data-files="${kind}"]`);area.replaceChildren();
      modal.querySelector(`[data-count="${kind}"]`).textContent=`${subset.length}개`;
      if(!subset.length){area.append(node('p',kind==='rfp'?'아직 RFP가 없습니다. 분석할 제안요청서를 추가해 주세요.':'회의록·녹취록·참고자료를 추가해 주세요.','fm-empty'));continue;}
      for(const file of subset){
        const row=node('article',undefined,'fm-file'),info=node('div',undefined,'fm-file-info'),name=node('h4',file.name),meta=node('p',undefined,'fm-file-meta');
        row.setAttribute('aria-label',file.name);info.append(name);
        if(kind==='rfp'&&selected===file.id)info.append(node('span','기본 RFP','fm-selected'));
        const date=new Date(file.uploadedAt),size=Number(file.size)||0;
        meta.textContent=`${file.name.split('.').pop().toUpperCase()} · ${size>=1048576?(size/1048576).toFixed(1)+' MB':Math.ceil(size/1024)+' KB'}${Number.isNaN(date.getTime())?'':` · ${date.toLocaleDateString('ko-KR')} 등록`}`;info.append(meta);row.append(info);
        const actions=node('div',undefined,'fm-file-actions');
        const button=(label,fn,className='')=>{const b=node('button',label,`fm-action ${className}`);b.type='button';b.onclick=()=>run(b,fn);actions.append(b);return b;};
        if(kind==='rfp'){
          const select=button(selected===file.id?'기본 RFP':'기본 RFP로 지정',async()=>{await choose(file.id);notice('기본 RFP를 변경했습니다. 요구사항 추출은 실행하지 않았습니다.');});select.disabled=selected===file.id;
          button('규칙 기반 추출',async()=>{const blob=await original(file.id);await choose(file.id);modal.classList.remove('open');await window.ReqlyApp.analyzeRfp(blob,file.id);notice('요구사항 추출을 요청했습니다.');},'fm-action-primary');
          button('AI 요구사항 추출',async()=>{await window.ReqlyRequirementExtraction.open(file.id);modal.classList.remove('open');});
        }
        button('다운로드',async()=>{const blob=await original(file.id),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=blob.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('다운로드를 요청했습니다.');});
        const reason=deletionReason(file,files,selected),del=button('삭제',async()=>{if(await(window.ReqlyDesign?.confirm('파일 삭제',`‘${file.name}’ 파일을 삭제할까요? 작성한 요구사항은 유지됩니다.`)??confirm(`‘${file.name}’ 파일을 삭제할까요? 작성한 요구사항은 유지됩니다.`))){await remove(file.id);notice('파일을 삭제했습니다. 작성한 요구사항은 유지됩니다.');}else notice('삭제를 취소했습니다.');},'fm-action-danger');
        del.disabled=!!reason;del.title=reason;
        row.append(actions);if(reason)row.append(node('small',reason,'fm-file-protection'));area.append(row);
      }
    }
  }
  function installUi(){
    if(modal)return;
    modal=document.createElement('div');modal.className='pages-modal fm-modal';modal.innerHTML=`<section class="pages-dialog fm-dialog" role="dialog" aria-modal="true" aria-label="파일 관리">
      <header><div><p class="fm-eyebrow">프로젝트 문서함</p><h2>RFP·관련자료 관리</h2><div class="fm-project"><span data-project-name></span><span data-project-role></span></div></div><button type="button" class="pages-close" aria-label="파일 관리 닫기">×</button></header>
      <div class="fm-tabs" role="tablist" aria-label="프로젝트 관리 메뉴"><button type="button" role="tab" id="fm-documents-tab" aria-controls="fm-documents" data-file-tab="documents" aria-selected="true">문서 관리</button><button type="button" role="tab" id="fm-settings-tab" aria-controls="fm-settings" data-file-tab="settings" aria-selected="false" tabindex="-1">공유·비밀번호</button></div>
      <div class="pages-body"><p data-message role="status" class="fm-notice"></p>
      <div role="tabpanel" id="fm-documents" aria-labelledby="fm-documents-tab" data-file-panel="documents">
        <section class="fm-section"><div class="fm-section-heading"><div><h3>제안요청서 <span data-count="rfp"></span></h3><p>버전이 다른 RFP도 함께 보관할 수 있습니다.</p></div><button type="button" class="fm-action fm-action-primary" data-rfp>+ RFP 추가</button></div>
        <details class="fm-help"><summary>기본 RFP 지정과 분석 방식 안내</summary><p><strong>기본 RFP로 지정</strong> 기본으로 사용할 문서만 바꿉니다. 요구사항을 추출하지 않습니다.</p><p><strong>규칙 기반 추출</strong> ID·표·요구 문장을 기준으로 추출하며 AI를 호출하지 않습니다.</p><p><strong>AI 요구사항 추출</strong> ID가 없거나 서술형인 문서에 사용합니다. API 연결 후 후보와 원문을 검토하고 선택한 항목을 추가합니다. 기존 작성 내용은 유지됩니다.</p><p>사업개요·기간·일정의 AI 분석은 상단 메뉴의 ‘사업 정보’에서 실행합니다.</p></details><div data-files="rfp"></div></section>
        <section class="fm-section"><div class="fm-section-heading"><div><h3>관련자료 <span data-count="reference"></span></h3><p>회의록·녹취록·참고자료를 한곳에서 관리합니다.</p></div><button type="button" class="fm-action" data-reference>+ 관련자료 추가</button></div><div data-files="reference"></div></section>
      </div>
      <div role="tabpanel" id="fm-settings" aria-labelledby="fm-settings-tab" data-file-panel="settings" hidden>
        <section class="fm-setting" data-known-projects><h3>프로젝트 목록</h3><p>이 브라우저에서 만들거나 접속한 공유 프로젝트입니다. 다른 프로젝트를 열 때는 해당 비밀번호를 입력합니다.</p><div data-shared-project-list></div><form data-open-shared-form class="shared-project-link"><label class="pages-field"><span>기존 프로젝트 공유 링크</span><input type="url" data-open-shared-url required placeholder="https://…?project=…" aria-label="기존 프로젝트 공유 링크"></label><button type="submit" class="fm-action">링크로 열기</button></form></section>
        <section class="fm-setting"><h3>프로젝트 공유</h3><p data-share-intro></p><label class="pages-field"><span>공유 링크</span><input readonly data-project-url aria-label="프로젝트 공유 링크"></label><button type="button" class="fm-action fm-action-primary" data-share>공유 URL 복사</button><p class="fm-setting-note">관리자용 비밀번호는 프로젝트를 관리하는 사람만 사용해 주세요.</p></section>
        <section class="fm-setting"><h3>비밀번호 변경</h3><p data-password-note></p><button type="button" class="fm-action" data-password>비밀번호 변경</button></section>
        <section class="fm-setting"><h3>다른 프로젝트 시작</h3><p>현재 프로젝트와 별개의 새 공유 프로젝트를 만듭니다.</p><button type="button" class="fm-action" data-new>새 공유 프로젝트</button></section>
      </div><input type="file" hidden multiple data-input></div></section>`;
    document.body.append(modal);
    // Sharing/passwords belong exclusively to Project; the cabinet keeps documents only.
    settingsPanel=modal.querySelector('#fm-settings');settingsPanel.hidden=false;settingsPanel.removeAttribute('role');settingsPanel.removeAttribute('aria-labelledby');settingsPanel.removeAttribute('data-file-panel');
    settingsModal=document.getElementById('projectModal');
    if(!settingsModal){settingsModal=node('div',undefined,'pages-modal fm-modal');settingsModal.id='projectSettingsModal';settingsModal.innerHTML='<section class="pages-dialog" role="dialog" aria-modal="true" aria-label="프로젝트 설정"><header><div><h2>프로젝트</h2><p>프로젝트 목록 · 공유 · 비밀번호</p></div><button class="pages-close" type="button" aria-label="프로젝트 설정 닫기">×</button></header><div class="pages-body"></div></section>';document.body.append(settingsModal);settingsModal.onclick=event=>{if(event.target.closest('.pages-close'))settingsModal.classList.remove('open');};}
    const settingsMessage=node('p',undefined,'fm-notice');settingsMessage.dataset.settingsMessage='';settingsMessage.setAttribute('role','status');settingsModal.querySelector('.pages-body').prepend(settingsMessage,settingsPanel);
    modal.querySelector('.fm-tabs').remove();const documentsPanel=modal.querySelector('#fm-documents');documentsPanel.removeAttribute('role');documentsPanel.removeAttribute('aria-labelledby');
    modal.onclick=event=>{if(!working&&event.target.closest('.pages-close'))modal.classList.remove('open');};
    const button=document.createElement('button');button.className='button ghost file-manager-button';button.textContent='RFP·자료 관리';button.type='button';document.getElementById('projectButton')?.parentElement.append(button);
    const open=async()=>{
      if(working)return;
      currentId=window.ReqlyApp?.projectId||window.ReqlyPortal.project.id;
      modal.querySelectorAll('[data-files]').forEach(area=>area.replaceChildren(node('p','문서 목록을 불러오고 있습니다…','fm-empty')));
      modal.classList.add('open');notice('문서 목록을 불러오는 중입니다…');
      working=true;modal.setAttribute('aria-busy','true');
      try{await render();notice('');}catch(error){notice(error.message,true);}
      finally{working=false;modal.setAttribute('aria-busy','false');}
    };button.onclick=()=>open().catch(error=>window.ReqlyDesign?.notice('문서함을 열지 못했습니다',error.message)||alert(error.message));
    for(const id of ['projectButton','projectManagerButton'])document.getElementById(id)?.addEventListener('click',()=>{renderSettings();settingsNotice('');settingsModal.classList.add('open');});
    let kind='rfp';const input=modal.querySelector('[data-input]');for(const type of ['rfp','reference'])modal.querySelector(`[data-${type}]`).onclick=()=>{if(working)return;kind=type;input.click();};
    input.onchange=async()=>{await run(modal.querySelector(`[data-${kind}]`),async()=>{const files=Array.from(input.files);for(const file of files)await add(file,kind);if(kind==='reference')await window.ReqlyApp.addReferences(files);notice(kind==='rfp'?'RFP를 추가했습니다. 아래에서 기본 지정 또는 요구사항 추출을 선택해 주세요.':'관련자료를 추가했습니다.');});input.value='';};
    settingsPanel.querySelector('[data-share]').onclick=()=>navigator.clipboard.writeText(window.ReqlyShared.shareUrl()).then(()=>settingsNotice('공유 URL을 복사했습니다. 사용자용 비밀번호를 함께 전달해 주세요.')).catch(()=>settingsNotice(window.ReqlyShared.shareUrl()));
    settingsPanel.querySelector('[data-new]').onclick=()=>{const url=new URL(location.href);url.searchParams.delete('project');url.searchParams.set('mode','shared');url.searchParams.set('new','1');navigateProject(url.href);};
    settingsPanel.querySelector('[data-open-shared-form]').onsubmit=event=>{
      event.preventDefault();
      try{const id=window.ReqlyProjectDirectory.idFromUrl(settingsPanel.querySelector('[data-open-shared-url]').value);navigateProject(window.ReqlyProjectDirectory.projectUrl(location.href,id));}
      catch(error){settingsNotice(error.message);}
    };
    settingsPanel.querySelector('[data-password]').onclick=async()=>{
      if(working||!shared()||window.ReqlyShared.role!=='admin')return;
      const entry=await window.ReqlyShared.fields('비밀번호 변경',[{label:'변경 대상',options:[['user','사용자용'],['admin','관리자용']]},{label:'현재 관리자용 비밀번호',password:true},{label:'새 비밀번호',password:true,autocomplete:'new-password'},{label:'새 비밀번호 확인',password:true,autocomplete:'new-password',mustMatch:2}]);if(!entry)return;
      try{if(entry[2]!==entry[3])throw new Error('새 비밀번호가 서로 다릅니다.');const result=await window.ReqlyShared.changePassword(entry[0],entry[1],entry[2]);settingsNotice('비밀번호를 변경했습니다.');if(result.reconnect)location.reload();}catch(error){settingsNotice(error.message);}
    };
  }
  window.ReqlyFiles={installUi,add,original,list,setProject(id){currentId=id;}};
})();
