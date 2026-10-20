/* Layout and shared interactions. Parsing, storage and AI contracts stay in their modules. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
  const button=(text,className='button ghost')=>{const node=element('button',className,text);node.type='button';return node;};
  let initialized=false, activeDialog=null, returnFocus=null;

  function section(title,nodes,{open=true,className=''}={}) {
    const details=element('details',`detail-section ${className}`);details.open=open;
    const summary=element('summary','',title),body=element('div','detail-section-body');
    details.append(summary,body);nodes.filter(Boolean).forEach(node=>body.append(node));return details;
  }
  function buildLayout(){
    if(initialized)return;initialized=true;
    const top= document.querySelector('.topbar'), heading=top.querySelector('.heading-wrap');
    const brand=document.querySelector('.brand');
    const logo=element('img','muhammad-portrait');logo.src='./assets/muhammad-portrait-02.png';logo.alt='';logo.width=56;logo.height=56;
    const portrait=element('span','portrait-frame');portrait.append(logo);
    const title=top.querySelector('h1');title.id='workspaceProjectName';
    title.className='workspace-project-name';
    const identity=element('span','brand-identity');identity.append(element('span','brand-wordmark','Muhammad'));
    brand.replaceChildren(portrait,identity);heading.prepend(brand);
    const bar=element('div','workspace-bar');bar.append(document.querySelector('.nav-list'));
    const progress=element('div','workspace-progress');progress.innerHTML='<span>검토 진행</span><progress max="100" value="0" aria-label="요구사항 검토 진행률"></progress><span data-progress-label>0%</span>';bar.append(progress);(document.querySelector('.kasbah-masthead')||top).after(bar);
    document.querySelector('.nav-label').textContent='프로젝트';
    document.querySelector('[data-view="requirements"] span').textContent='요구사항';
    const documents=document.querySelector('[data-view="documents"]');documents.querySelector('span').textContent='문서함';
    const dashboard=document.querySelector('[data-view="dashboard"]');dashboard.querySelector('span').textContent='검토 현황';
    // Menu actions are attached once the file manager is installed, including shared startup.
    documents.addEventListener('click',event=>{event.stopImmediatePropagation();document.querySelector('.file-manager-button')?.click();},{capture:true});
    const classifications=element('section','classification-bar');classifications.setAttribute('aria-label','요구사항 분류');
    classifications.append(byId('categoryStrip'),byId('idHierarchyFilter'));
    document.querySelector('.breadcrumb').textContent='현재 프로젝트';
    const reference=byId('referencePanel'),details=element('details','reference-panel');details.id=reference.id;
    details.append(element('summary','','연결된 관련자료 보기'));while(reference.firstChild)details.append(reference.firstChild);reference.replaceWith(details);
    const context=element('details','project-context');context.id='projectContext';context.append(element('summary','','문서·검토 현황'));
    const page=document.querySelector('.page-content');page.prepend(context);context.append(byId('documentBanner'),details,document.querySelector('.metric-grid'));
    dashboard.addEventListener('click',()=>{
      const modal=element('div','pages-modal open'),shell=element('section','pages-dialog'),header=element('header'),close=button('×','pages-close');
      shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','문서·검토 현황');close.setAttribute('aria-label','현황 닫기');
      header.append(element('h2','','문서·검토 현황'),close);const body=element('div','pages-body');context.hidden=false;context.open=true;body.append(context);shell.append(header,body);modal.append(shell);document.body.append(modal);
      close.onclick=()=>{context.hidden=true;page.prepend(context);modal.remove();};
    });
    // Re-cache is unnecessary: existing reference controls are moved, not recreated.
    const card=document.querySelector('.content-card'),workbench=element('div','workbench');
    card.querySelector('.card-header').after(classifications);
    const list=element('section','requirement-list-panel');list.setAttribute('aria-label','요구사항 목록');
    const editor=element('div','workbench-editor');
    workbench.append(list,editor);card.append(workbench);
    const toolbar=document.querySelector('.toolbar');list.append(toolbar);
    const filters=element('div','filter-popover');filters.id='workbenchFilters';filters.hidden=true;
    const toggle=button('필터','button ghost filter-toggle');toggle.id='workbenchFilterToggle';toggle.setAttribute('aria-controls',filters.id);toggle.setAttribute('aria-expanded','false');
    toolbar.querySelector('.filter-group').append(toggle);
    for(const id of ['categoryFilter','statusFilter','priorityFilter','flagFilter']){
      const select=byId(id),label=select.closest('label');label.className='';label.querySelector('span').classList.remove('sr-only');filters.append(label);
    }
    const reset=button('필터 초기화');reset.onclick=()=>byId('filterReset').click();filters.append(reset);list.append(filters);
    toggle.onclick=()=>{filters.hidden=!filters.hidden;toggle.setAttribute('aria-expanded',String(!filters.hidden));};
    const caption=element('div','list-caption');caption.innerHTML='<label><input type="checkbox" id="compactSelectAll" aria-label="검색 결과 전체 선택"><span>전체 선택</span></label><span id="compactListCount">0개</span>';
    list.append(caption,byId('bulkBar'));
    const compact=element('div','compact-list');compact.id='workbenchList';list.append(compact);
    list.append(document.querySelector('.table-wrap'),byId('mobileList'),byId('emptyState'),document.querySelector('.table-footer'));
    const idle=element('section','editor-idle');idle.id='editorIdle';idle.innerHTML='<h2>검토할 요구사항을 선택하세요</h2><p>목록에서 항목을 선택하면 이곳에서 원문을 읽고 검토 상태, 질의사항과 적용 방안을 함께 편집할 수 있습니다.</p>';
    const create=button('요구사항 직접 추가','button primary');create.onclick=()=>byId('addButton').click();idle.append(create);
    editor.append(idle,byId('detailDrawer'));workbench.append(list,editor);card.append(workbench);
    const full=button('전체 표 보기');full.id='listViewToggle';document.querySelector('.card-actions').prepend(full);
    full.onclick=()=>{const on=card.classList.toggle('full-list');full.textContent=on?'목록·편집 보기':'전체 표 보기';more.open=false;window.ReqlyApp?.refreshList();};
    byId('compactSelectAll').onchange=event=>{byId('selectAll').checked=event.target.checked;byId('selectAll').dispatchEvent(new Event('change',{bubbles:true}));};
    compact.onclick=event=>{
      const flag=event.target.closest('[data-flag-key]');if(flag){window.ReqlyApp?.setFlag(flag.dataset.flagKey);return;}
      const open=event.target.closest('[data-open]');if(open)window.ReqlyApp?.openRequirement(open.dataset.open);
    };
    compact.onchange=event=>{if(event.target.matches('.row-check'))window.ReqlyApp?.selectRequirement(event.target.dataset.key,event.target.checked);};
    // Keep primary fields visible; fold supporting work to reduce scrolling.
    const scroll=document.querySelector('.drawer-scroll'),meta=byId('formPriority').closest('.form-row');meta.classList.add('editor-meta-row');scroll.prepend(meta);
    const description=byId('formDescription');
    const growDescription=()=>{if(!description.readOnly){description.style.height='auto';description.style.height=Math.max(180,description.scrollHeight)+'px';}};
    description.addEventListener('input',growDescription);
    const source=document.querySelector('.source-panel');
    const question=document.querySelector('.question-builder');
    const qSection=section('질의사항',[question]);qSection.id='questionSection';
    const implNodes=[document.querySelector('.form-section-title'),byId('formAcceptance').closest('.form-row'),byId('formApplicationPlan').closest('label'),byId('formChangeHistory').closest('.form-row')];
    const implSection=section('이행 관리·적용 방안',implNodes);implSection.id='implementationSection';
    const sourceSection=section('원문 정보·ID·분류·태그',[byId('formId').closest('.form-row'),source,byId('formTags').closest('label'),byId('formSourceInput').closest('label')]);
    const mobileActions=element('div','mobile-editor-actions');
    for(const [target,label] of [['duplicateButton','이 요구사항 복제'],['deleteButton','이 요구사항 삭제']]){const action=button(label,target==='deleteButton'?'button danger-ghost':'button ghost');action.dataset.editorAction=target;action.onclick=()=>byId(target).click();mobileActions.append(action);}sourceSection.lastElementChild.append(mobileActions);
    byId('glossaryPanel').after(qSection,implSection,sourceSection);
    for(const [panelId,toggleId] of [['easyExplanationPanel','toggleEasyExplanation'],['glossaryPanel','toggleGlossary']]){
      const header=byId(panelId).querySelector('header'),toggle=byId(toggleId);
      toggle.classList.add('detail-section-trigger');header.replaceChildren(toggle);
    }
    const nav=element('div','editor-navigation');
    for(const [direction,label] of [[-1,'이전 요구사항'],[1,'다음 요구사항']]){
      const control=button('','icon-button '+(direction===-1?'previous':'next'));control.setAttribute('aria-label',label);control.innerHTML='<svg aria-hidden="true"><use href="#i-chevron"></use></svg>';control.onclick=()=>window.ReqlyApp?.stepRequirement(direction);nav.append(control);
    }
    const close=byId('drawerClose');close.setAttribute('aria-label','목록으로 돌아가기');close.title='목록으로 돌아가기';nav.append(close);document.querySelector('.drawer-header').append(nav);
    // Edit the title in place instead of repeating it above the description.
    const nameLabel=byId('formName').closest('label');nameLabel.classList.add('editor-name');byId('formName').setAttribute('form','requirementForm');byId('formName').setAttribute('aria-label','요구사항 명칭');
    byId('drawerTitle').classList.add('sr-only');byId('drawerTitle').after(nameLabel);
    byId('cancelButton').textContent='닫기';
    // Three compact rows: identity/navigation, tools, then horizontal categories.
    document.body.classList.add('compact-shell');context.hidden=true;
    top.insertBefore(bar,document.querySelector('.top-actions'));
    const projectHeading=element('div','header-project');projectHeading.append(element('span','header-project-label','현재 프로젝트'),title);top.insertBefore(projectHeading,document.querySelector('.top-actions'));
    card.prepend(toolbar);toolbar.classList.add('workspace-tools');
    filters.append(byId('idHierarchyFilter'));toolbar.after(filters);
    const actions=document.querySelector('.card-actions');toolbar.append(actions);
    const more=element('details','workspace-more'),moreBody=element('div','workspace-more-body');more.append(element('summary','','목록 도구'),moreBody);
    moreBody.append(full,byId('qaExportButton'),byId('exportButton').closest('.export-wrap'));actions.prepend(more);
    actions.append(byId('uploadButton'));
    const sort=toolbar.querySelector('.sort-wrap');if(sort)list.prepend(sort);
    window.addEventListener('reqly-shared-update',()=>sync());
    document.addEventListener('input',event=>{if(event.target.form===byId('requirementForm')||event.target.closest('#requirementForm')){markDirty();if(event.target.id==='formName')byId('drawerTitle').textContent=event.target.value||'새 요구사항 추가';}});
    document.addEventListener('change',event=>{if(event.target.form===byId('requirementForm')||event.target.closest('#requirementForm'))markDirty();});
    // Watch modal shells, not every row, keystroke and progress update in the app.
    const modalObservers=new Map();
    const watchDialogs=()=>{
      for(const [modal,observer] of modalObservers)if(!modal.isConnected){observer.disconnect();modalObservers.delete(modal);}
      document.querySelectorAll('.pages-modal').forEach(modal=>{
        if(modalObservers.has(modal))return;
        const observer=new MutationObserver(syncDialogs);observer.observe(modal,{attributes:true,attributeFilter:['class']});modalObservers.set(modal,observer);
      });
      syncDialogs();
    };
    new MutationObserver(watchDialogs).observe(document.body,{childList:true});watchDialogs();
    let measureFrame=0,lastOffset='';
    const measure=()=>{
      cancelAnimationFrame(measureFrame);measureFrame=requestAnimationFrame(()=>{
        const offset=`${Math.round(workbench.getBoundingClientRect().top+window.scrollY)}px`;
        if(offset!==lastOffset){lastOffset=offset;workbench.style.setProperty('--workbench-offset',offset);}
      });
    };
    new ResizeObserver(measure).observe(document.querySelector('.main-area'));
    new ResizeObserver(measure).observe(classifications);
    window.addEventListener('resize',measure);window.ReqlyApp?.refreshView();measure();sync();syncDialogs();
  }
  function markDirty(){const stamp=byId('lastSavedAt');if(stamp){const dirty=window.ReqlyApp?.isEditorDirty()||false;stamp.classList.toggle('unsaved-state',dirty);stamp.textContent=dirty?'작성 중 · 저장하기를 눌러 반영해 주세요':stamp.dataset.savedLabel||stamp.textContent;}}
  function sync(){
    if(!initialized)return;
    const open=byId('detailDrawer').classList.contains('open');document.querySelector('.content-card').classList.toggle('editor-open',open);byId('editorIdle').hidden=open;
    const project=window.ReqlyShared?.project?.name||window.ReqlyPortal?.project?.name||byId('sidebarProject').textContent;
    byId('workspaceProjectName').textContent=project;byId('workspaceProjectName').title=project;document.querySelector('.brand').setAttribute('aria-label',`Muhammad 홈 · ${project}`);
    const percent=parseInt(byId('reviewProgressText').textContent)||0;document.querySelector('.workspace-progress progress').value=percent;document.querySelector('[data-progress-label]').textContent=percent+'%';
    byId('projectButton').querySelector('span').textContent='프로젝트';
    if(open){
      const id=byId('formId').value||(byId('deleteButton').style.display==='none'?'새 요구사항':'ID 없는 요구사항'),category=byId('formCategory').value;
      document.querySelector('.drawer-header .eyebrow').textContent=`${id} / ${category}`;
      byId('drawerTitle').textContent=byId('formName').value||'새 요구사항 추가';
      document.querySelectorAll('[data-editor-action]').forEach(button=>button.hidden=byId(button.dataset.editorAction).style.display==='none');
    }
    const active=window.ReqlyApp?.filterCount||0;
    byId('workbenchFilterToggle').textContent=active?`필터 ${active}`:'필터';
  }
  function topModal(){return [...document.querySelectorAll('.pages-modal.open')].at(-1);}
  function focusables(modal){return [...modal.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);}
  function syncDialogs(){
    const modal=topModal();if(modal===activeDialog)return;
    if(modal){
      if(!activeDialog)returnFocus=document.activeElement;
      const previous=activeDialog;activeDialog=modal;
      const dialog=modal.querySelector('[role=dialog]');if(dialog&&!dialog.hasAttribute('aria-label')&&!dialog.hasAttribute('aria-labelledby')){const h=dialog.querySelector('h2');if(h){h.id||=`dialog-${crypto.randomUUID()}`;dialog.setAttribute('aria-labelledby',h.id);}}
      modal.style.zIndex='2000';document.querySelectorAll('.pages-modal.open').forEach(el=>{if(el!==modal)el.style.zIndex='1999';});
      // Do not steal focus when a dialog opens during an input composition.
      if(!modal.contains(document.activeElement))focusables(modal)[0]?.focus({preventScroll:true});
      document.body.classList.add('dialog-open');document.body.style.overflow='hidden';
      if(previous)previous.setAttribute('aria-hidden','true');modal.removeAttribute('aria-hidden');
    }else if(activeDialog){activeDialog=null;document.body.classList.remove('dialog-open');document.body.style.overflow='';if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
  }
  function dialog({title,copy,fields=[],confirm='확인',danger=false,save}){
    return new Promise(resolve=>{
      const modal=element('div','pages-modal open ui-prompt');const shell=element('section','pages-dialog');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label',title);
      const header=element('header'),heading=element('h2','',title),close=button('×','pages-close');close.setAttribute('aria-label','닫기');header.append(heading,close);
      const form=element('form','pages-body');if(copy)form.append(element('p','ui-confirm-copy',copy));
      const inputs=fields.map(field=>{const label=element('label','pages-field');label.append(element('span','',field.label));const input=element('input');input.value=field.value||'';input.required=field.required!==false;input.maxLength=field.maxLength||120;label.append(input);form.append(label);return input;});
      const feedback=element('p','ui-save-feedback');feedback.setAttribute('role','status');feedback.hidden=true;
      const actions=element('div','ui-dialog-actions'),cancel=button('취소','pages-action'),done=button(confirm,save?'pages-action':'pages-action primary');done.type='submit';if(danger)done.style.background='var(--danger)';actions.append(cancel,done);form.append(feedback,actions);shell.append(header,form);modal.append(shell);document.body.append(modal);
      let busy=false;
      const finish=result=>{if(busy)return;modal.remove();resolve(result);};cancel.onclick=close.onclick=()=>finish(null);modal.onclick=event=>{if(event.target===modal)finish(null);};form.onsubmit=event=>{event.preventDefault();if(form.reportValidity())finish(inputs.length?inputs.map(input=>input.value):true);};
      if(save){
        const saveButton=button('저장하고 이동','pages-action primary');actions.append(saveButton);
        saveButton.onclick=async()=>{
          if(busy)return;busy=true;modal.setAttribute('aria-busy','true');feedback.hidden=false;feedback.textContent='저장 중입니다. 완료되면 이동합니다.';
          [cancel,done,close,saveButton].forEach(control=>control.disabled=true);saveButton.textContent='저장 중…';
          let saved=false;
          try{saved=await save()===true;}catch(error){feedback.textContent=error.message||'저장하지 못했습니다.';}
          finally{busy=false;modal.setAttribute('aria-busy','false');[cancel,done,close,saveButton].forEach(control=>control.disabled=false);saveButton.textContent='저장하고 이동';}
          if(saved)finish(true);
          else feedback.textContent='저장하지 못해 이동하지 않았습니다. 오류 안내를 확인하거나 ‘취소’를 눌러 입력 내용을 확인해 주세요.';
        };
      }
    });
  }
  // A single keyboard policy for all dialogs; the editor remains behind the active dialog.
  document.addEventListener('keydown',event=>{
    const modal=topModal();if(!modal)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();if(modal.getAttribute('aria-busy')==='true')return;
      const close=modal.querySelector('.pages-close');if(close)close.click();else modal.querySelector('[data-dialog-cancel],.ui-dialog-actions button')?.click();
    }else if(event.key==='Tab'){
      const targets=focusables(modal),first=targets[0],last=targets.at(-1);if(!first)return;
      if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
    }
  },true);
  window.addEventListener('beforeunload',event=>{if(window.ReqlyApp?.isEditorDirty()){event.preventDefault();event.returnValue='';}});
  window.ReqlyDesign={sync,markDirty,
    unsavedChanges:async save=>!!(await dialog({title:'작성 중인 내용이 있습니다',copy:'변경사항을 저장하고 이동하시겠습니까?',confirm:'저장하지 않고 이동',save})),
    confirm:async(title,copy)=>!!(await dialog({title,copy,confirm:title.includes('삭제')?'삭제':title.includes('작성 중')?'저장하지 않고 이동':'계속',danger:true})),prompt:async(title,label,value='')=>{const result=await dialog({title,fields:[{label,value}],confirm:'만들기'});return result?result[0]:null;},notice:async(title,copy)=>dialog({title,copy,confirm:'확인'})};
  document.addEventListener('DOMContentLoaded',buildLayout);
})();
