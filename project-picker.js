/* Project selection is available before any storage connection or password. */
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
  function actions(project,{onOpen,onDelete,current=false}={}){
    const group=node('div',null,'shared-project-actions'),open=node('button',current?'현재 프로젝트':'열기','pages-action primary'),copy=node('button','공유','pages-action'),remove=node('button','삭제','pages-action danger');
    open.disabled=current;let working=false;
    for(const [button,label]of [[open,'열기'],[copy,'공유'],[remove,'삭제']]){button.type='button';button.setAttribute('aria-label',`${project.name} ${label}`);}
    open.onclick=onOpen;copy.onclick=()=>share(project);
    remove.onclick=async()=>{if(working)return;working=true;remove.disabled=copy.disabled=open.disabled=true;try{await onDelete?.();}finally{working=false;remove.disabled=copy.disabled=false;open.disabled=current;}};
    group.append(open,copy,remove);return group;
  }
  function choose({projects=[],message=''}={}){
    return new Promise(resolve=>{
      const modal=node('div',null,'pages-modal open project-picker');
      const dialog=node('section',null,'pages-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','프로젝트 목록');
      const header=node('header'),intro=node('div');intro.append(node('h2','프로젝트 목록'),node('p','작업할 프로젝트를 선택한 다음 비밀번호를 입력해 주세요.'));header.append(intro);
      const body=node('div',null,'pages-body');
      const feedback=node('p',message,'fm-notice');feedback.setAttribute('role','status');feedback.hidden=!message;body.append(feedback);
      const search=node('input');search.type='search';search.placeholder='프로젝트 이름 검색';search.setAttribute('aria-label','프로젝트 이름 검색');search.className='project-picker-search';body.append(search);
      const area=node('div');area.setAttribute('aria-label','저장된 프로젝트');body.append(area);
      const hint=node('p','이 브라우저에서 만들거나 접속한 공유 프로젝트가 표시됩니다. 목록에 없는 기존 프로젝트는 공유 링크로 열어 주세요.','ui-form-intro');body.append(hint);
      const form=node('form',null,'shared-project-link'),label=node('label',null,'pages-field'),input=node('input');input.type='url';input.required=true;input.placeholder='https://…?project=…';input.setAttribute('aria-label','기존 프로젝트 공유 링크');label.append(node('span','기존 프로젝트 공유 링크'),input);
      const link=node('button','링크로 열기','pages-action');link.type='submit';form.append(label,link);body.append(form);
      const footer=node('div',null,'project-picker-footer'),create=node('button','새 프로젝트 만들기','pages-action');create.type='button';footer.append(node('span','새로운 RFP 작업을 시작하시나요?'),create);body.append(footer);
      // No default submit/create action on Escape while a project is not open.
      const finish=value=>{modal.remove();resolve(value);};
      const render=()=>{
        area.replaceChildren();const query=search.value.trim().toLocaleLowerCase('ko');
        const filtered=projects.filter(project=>project.name.toLocaleLowerCase('ko').includes(query));
        if(!filtered.length)area.append(node('p',projects.length?'검색된 프로젝트가 없습니다.':'아직 이 브라우저에 기록된 프로젝트가 없습니다. 기존 공유 링크로 열거나 새 프로젝트를 만들어 주세요.','fm-empty'));
        for(const project of filtered){
          const row=node('article',null,'shared-project-row'),info=node('div'),date=new Date(project.updatedAt);
          info.append(node('h3',project.name),node('p',Number.isNaN(date.getTime())?'저장일 확인 전':`마지막 확인한 저장: ${date.toLocaleString('ko-KR')}`));
          const buttons=actions(project,{onOpen:()=>finish({id:project.id,name:project.name}),onDelete:async()=>{
            try{if(await window.ReqlyShared.deleteProject(project)){projects=projects.filter(item=>item.id!==project.id);render();feedback.hidden=false;feedback.textContent=`‘${project.name}’ 프로젝트를 삭제했습니다.`;}}
            catch(error){feedback.hidden=false;feedback.textContent=error.message;}
          }});row.append(info,buttons);area.append(row);
        }
      };
      search.oninput=render;
      form.onsubmit=event=>{event.preventDefault();try{const id=window.ReqlyProjectDirectory.idFromUrl(input.value);finish({id,name:projects.find(project=>project.id===id)?.name||''});}catch(error){feedback.hidden=false;feedback.textContent=error.message;}};
      create.onclick=()=>finish({create:true});
      dialog.append(header,body);modal.append(dialog);document.body.append(modal);render();
    });
  }
  window.ReqlyProjectPicker={choose,loading,share,actions};
})();
