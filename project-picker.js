/* Project selection is available before any storage connection or password. */
(() => {
  'use strict';
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
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
          const open=node('button','열기','pages-action primary');open.type='button';open.setAttribute('aria-label',`${project.name} 열기`);open.onclick=()=>finish({id:project.id,name:project.name});row.append(info,open);area.append(row);
        }
      };
      search.oninput=render;
      form.onsubmit=event=>{event.preventDefault();try{const id=window.ReqlyProjectDirectory.idFromUrl(input.value);finish({id,name:projects.find(project=>project.id===id)?.name||''});}catch(error){feedback.hidden=false;feedback.textContent=error.message;}};
      create.onclick=()=>finish({create:true});
      dialog.append(header,body);modal.append(dialog);document.body.append(modal);render();
    });
  }
  window.ReqlyProjectPicker={choose};
})();
