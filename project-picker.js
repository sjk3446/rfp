/* Project links stay available; the complete directory requires its own access. */
(() => {
  'use strict';
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  function loading(title='프로젝트를 불러오는 중입니다',detail='저장소에 연결하고 있습니다.'){
    const modal=node('div',null,'pages-modal open project-loading'),panel=node('section',null,'pages-dialog'),body=node('div',null,'pages-body');
    modal.setAttribute('aria-busy','true');panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
    const spinner=node('span',null,'project-spinner');spinner.setAttribute('aria-hidden','true');
    const phase=node('p',detail,'project-loading-phase'),elapsed=node('p','잠시만 기다려 주세요.','ui-form-intro'),started=Date.now();
    body.append(spinner,node('h2',title),phase,elapsed);panel.append(body);modal.append(panel);document.body.append(modal);
    const clock=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);elapsed.textContent=seconds<10?`${seconds}초 경과`:`${seconds}초 경과 · 응답을 기다리고 있습니다. 완료되면 자동으로 이어집니다.`;},1000);
    return{update(text){phase.textContent=text;},close(){clearInterval(clock);modal.remove();}};
  }
  function share(project){
    const modal=node('div',null,'pages-modal open'),panel=node('section',null,'pages-dialog'),body=node('div',null,'pages-body');
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','프로젝트 공유');
    const input=node('input');input.type='text';input.readOnly=true;input.value=window.ReqlyProjectDirectory.projectUrl(location.href,project.id);input.setAttribute('aria-label','프로젝트 공유 링크');input.className='project-picker-search';
    const feedback=node('p','링크와 사용자용 비밀번호를 함께 전달해 주세요.','ui-form-intro');feedback.setAttribute('role','status');
    const actions=node('div',null,'ui-dialog-actions'),copy=node('button','링크 복사','pages-action primary'),close=node('button','×','pages-close credential-close');copy.type=close.type='button';close.setAttribute('aria-label','프로젝트 공유 닫기');
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(input.value);feedback.textContent='공유 링크를 복사했습니다. 사용자용 비밀번호를 함께 전달해 주세요.';}catch(_){feedback.textContent='아래 링크를 선택하여 복사해 주세요.';input.focus();input.select();}};
    close.onclick=()=>modal.remove();actions.append(copy);body.append(node('h2','프로젝트 공유'),node('p',project.name,'ui-form-intro'),input,feedback,actions,close);panel.append(body);modal.append(panel);document.body.append(modal);
  }
  function actions(project,{onOpen,onDelete,onRename,current=false}={}){
    const group=node('div',null,'shared-project-actions'),open=node('button',current?'현재 프로젝트':'열기','pages-action primary'),copy=node('button','공유','pages-action'),remove=node('button','삭제','pages-action danger');
    const rename=node('button','이름 변경','pages-action');
    open.disabled=current;let working=false;
    for(const [button,label]of [[open,'열기'],[copy,'공유'],[rename,'이름 변경'],[remove,'삭제']]){button.type='button';button.setAttribute('aria-label',`${project.name} ${label}`);}
    open.onclick=onOpen;copy.onclick=()=>share(project);
    const run=async fn=>{if(working)return;working=true;remove.disabled=rename.disabled=copy.disabled=open.disabled=true;try{await fn?.();}finally{working=false;remove.disabled=rename.disabled=copy.disabled=false;open.disabled=current;}};
    remove.onclick=()=>run(onDelete);rename.onclick=()=>run(onRename);
    group.append(open,copy,rename,remove);return group;
  }
  function directoryPanel({onOpen,onRename,onDelete,currentId=''}={}){
    const element=node('section',null,'directory-panel');
    const gate=node('div',null,'directory-gate'),unlock=node('button','관리자로 접속','pages-action primary'),setup=node('button','목록 관리자 비밀번호 설정','pages-action');unlock.type=setup.type='button';
    gate.append(node('h3','전체 프로젝트 목록'),node('p','전체 프로젝트 목록은 목록 관리자 비밀번호로 열 수 있습니다.'),unlock,setup);
    const tools=node('div',null,'directory-tools'),count=node('span',null,'directory-count');
    const refresh=node('button','새로고침','pages-action'),password=node('button','목록 비밀번호 변경','pages-action'),lock=node('button','목록 잠금','pages-action');
    for(const button of [refresh,password,lock])button.type='button';tools.append(count,refresh,password,lock);
    const search=node('input');search.type='search';search.placeholder='프로젝트 이름 검색';search.setAttribute('aria-label','프로젝트 이름 검색');search.className='project-picker-search';
    const area=node('div');area.setAttribute('aria-label','전체 프로젝트 목록');
    const feedback=node('p',null,'fm-notice');feedback.setAttribute('role','status');feedback.hidden=true;
    element.append(gate,tools,search,feedback,area);let working=false,destroyed=false;
    const notify=text=>{feedback.textContent=text||'';feedback.hidden=!text;};
    const setWorking=value=>{working=value;for(const button of [unlock,setup,refresh,password,lock])button.disabled=value;};
    const perform=async(fn,message)=>{
      if(working)return;setWorking(true);notify('');
      try{const result=await fn();if(result&&message)notify(message);}
      catch(error){notify(error.message||'프로젝트 목록을 불러오지 못했습니다.');}
      finally{setWorking(false);render();}
    };
    const render=()=>{
      if(destroyed)return;
      const unlocked=!!window.ReqlyShared?.directoryUnlocked;
      gate.hidden=unlocked;setup.hidden=!window.ReqlyShared?.canSetupDirectory;tools.hidden=search.hidden=!unlocked;area.replaceChildren();
      if(!unlocked){search.value='';count.textContent='';return;}
      const projects=window.ReqlyShared.knownProjects(),query=search.value.trim().toLocaleLowerCase('ko');
      count.textContent=`전체 ${projects.length}개`;
      const filtered=projects.filter(project=>project.name.toLocaleLowerCase('ko').includes(query));
      if(!filtered.length)area.append(node('p',projects.length?'검색된 프로젝트가 없습니다.':'저장된 공유 프로젝트가 없습니다. 새 프로젝트를 만들어 주세요.','fm-empty'));
      for(const project of filtered){
        const row=node('article',null,'shared-project-row'),info=node('div'),date=new Date(project.updatedAt);
        info.append(node('h3',project.name),node('p',Number.isNaN(date.getTime())?'저장일 확인 전':`마지막 저장: ${date.toLocaleString('ko-KR')}`));
        row.append(info,actions(project,{current:project.id===currentId,onOpen:()=>onOpen?.(project),onRename:async()=>{
          try{if(await(onRename?onRename(project):window.ReqlyShared.renameProject(project))){render();notify('프로젝트 이름을 변경했습니다.');}}
          catch(error){notify(error.message);}
        },onDelete:async()=>{
          try{if(await(onDelete?onDelete(project):window.ReqlyShared.deleteProject(project))){render();notify('프로젝트를 삭제했습니다.');}}
          catch(error){notify(error.message);}
        }}));area.append(row);
      }
    };
    unlock.onclick=()=>perform(()=>window.ReqlyShared.unlockDirectory());
    setup.onclick=()=>perform(()=>window.ReqlyShared.setupDirectory());
    refresh.onclick=()=>perform(()=>window.ReqlyShared.refreshDirectory(),'프로젝트 목록을 새로 불러왔습니다.');
    password.onclick=()=>perform(()=>window.ReqlyShared.changeDirectoryPassword(),'목록 관리자 비밀번호를 변경했습니다.');
    lock.onclick=()=>{window.ReqlyShared.lockDirectory();notify('전체 프로젝트 목록을 잠갔습니다.');render();};
    search.oninput=render;
    const onUpdate=event=>{if(!window.ReqlyShared?.directoryUnlocked)notify('');render();if(event.detail?.message)notify(event.detail.message);};
    window.addEventListener('reqly-directory-update',onUpdate);render();
    if(window.ReqlyShared?.directoryUnlocked&&window.ReqlyShared.directoryLoaded===false)perform(()=>window.ReqlyShared.refreshDirectory());
    return{element,render,destroy(){destroyed=true;area.replaceChildren();search.value='';window.removeEventListener?.('reqly-directory-update',onUpdate);}};
  }
  function choose({message=''}={}){
    return new Promise(resolve=>{
      const modal=node('div',null,'pages-modal open project-picker');
      const dialog=node('section',null,'pages-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','프로젝트 목록');
      const header=node('header'),intro=node('div');intro.append(node('h2','프로젝트'),node('p','공유받은 링크로 접속하거나 관리자 전용 목록에서 프로젝트를 선택하세요.'));header.append(intro);
      const body=node('div',null,'pages-body');
      const feedback=node('p',message,'fm-notice');feedback.setAttribute('role','status');feedback.hidden=!message;body.append(feedback);
      let directoryView;
      const finish=value=>{directoryView?.destroy();modal.remove();resolve(value);};
      directoryView=directoryPanel({onOpen:project=>finish({id:project.id,name:project.name})});body.append(directoryView.element);
      const form=node('form',null,'shared-project-link'),label=node('label',null,'pages-field'),input=node('input');input.type='url';input.required=true;input.placeholder='https://…?project=…';input.setAttribute('aria-label','기존 프로젝트 공유 링크');label.append(node('span','기존 프로젝트 공유 링크'),input);
      const link=node('button','링크로 열기','pages-action');link.type='submit';form.append(label,link);body.append(form);
      const footer=node('div',null,'project-picker-footer'),create=node('button','새 프로젝트 만들기','pages-action');create.type='button';footer.append(node('span','새로운 RFP 작업을 시작하시나요?'),create);body.append(footer);
      form.onsubmit=event=>{event.preventDefault();try{const id=window.ReqlyProjectDirectory.idFromUrl(input.value);finish({id,name:''});}catch(error){feedback.hidden=false;feedback.textContent=error.message;}};
      create.onclick=()=>finish({create:true});
      dialog.append(header,body);modal.append(dialog);document.body.append(modal);
    });
  }
  window.ReqlyProjectPicker={choose,loading,share,actions,directoryPanel};
})();
