/* On-demand, source-grounded business information for each original RFP. */
(() => {
  'use strict';
  const core=window.ReqlyOverviewCore,prepared=new Map(),drafts=new Map();
  let modal,select,status,resultArea,prepareButton,analyzeButton,saveButton,stopButton,search,busy=false,stopped=false,previewUrl='';
  let operation='',readProgress={},startedAt=0,ticker,aiConnected=false,categoryFilter;
  let aiInfo={connected:false,label:''},activeAiInfo=null;
  async function refreshAiInfo(){aiInfo=await window.ReqlyPersistentAI.getConnectionInfo().catch(()=>({connected:false,label:''}));aiConnected=aiInfo.connected;}
  const errors=new Map();
  const current=()=>select.value;
  const saved=()=>window.ReqlyApp.document?.overviewByAsset?.[current()];
  function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
  function message(text){status.textContent=text;}
  function workflow(){
    const data=prepared.get(current()),record=drafts.get(current())?.result||saved(),error=errors.get(current());
    return core.workflow({hasFile:!!current(),prepared:!!data,draft:drafts.has(current()),saved:!!saved(),completed:data?data.results.filter(Boolean).length:record?.completedBatches||0,total:data?data.batches.length:record?.totalBatches||0,operation,readDone:readProgress.completed||0,readTotal:readProgress.total||0,errorStage:error?.stage||'',stopped:!!error?.stopped});
  }
  function updateFlow(){
    if(!modal)return;const view=workflow(),data=prepared.get(current());
    modal.querySelector('.overview-flow-card').dataset.state=view.phase;
    modal.querySelector('[data-flow-title]').textContent=view.title;modal.querySelector('[data-flow-hint]').textContent=view.hint;
    if(view.phase==='analyzing'){const name=activeAiInfo?.label||aiInfo.label||'AI';modal.querySelector('[data-flow-title]').textContent=`${name}가 사업 정보를 분석하고 있습니다`;modal.querySelector('[data-flow-hint]').textContent=`${name}의 응답을 기다리고 있습니다. 완료된 구간을 기준으로 진행률이 올라갑니다.`;}
    if(view.activeStep===3&&!aiConnected&&!busy){modal.querySelector('[data-flow-title]').textContent='AI 연결을 먼저 완료해 주세요';modal.querySelector('[data-flow-hint]').textContent='AI 연결하기에서 API 키를 설정한 뒤 이 화면을 다시 열면 준비한 문서로 분석을 시작할 수 있습니다.';}
    const steps=modal.querySelector('[data-flow-steps]');steps.replaceChildren();
    ['문서 선택','문서 읽기','AI 분석','검토·저장'].forEach((label,index)=>{
      const done=view.doneSteps[index],active=view.activeStep===index+1&&!done;
      const step=element('li',undefined,done?'is-done':active?'is-current':'');
      if(active)step.setAttribute('aria-current','step');
      step.append(element('span',done?'✓':String(index+1),'overview-step-number'));
      const text=element('div');text.append(element('strong',label),element('small',done?'완료':active?'현재 단계':'대기'));step.append(text);steps.append(step);
    });
    const progress=modal.querySelector('[data-flow-progress]');progress.setAttribute('aria-label',view.progressLabel);
    if(view.percent===null)progress.removeAttribute('value');else progress.value=view.percent;
    modal.querySelector('[data-flow-percent]').textContent=view.percent===null?'처리 중':`${view.percent}%`;
    modal.querySelector('[data-flow-progress-label]').textContent=view.progressLabel;
    let detail=operation==='reading'?(readProgress.total?`${readProgress.completed} / ${readProgress.total}페이지 읽음`:'문서 형식에 따라 완료 후 분량이 표시됩니다.'):operation==='loading'?'원본을 불러오는 동안에는 진행률을 계산할 수 없습니다.':view.total?`${view.completed} / ${view.total}구간 완료${operation==='analyzing'?` · ${Math.min(view.completed+1,view.total)}번째 구간 응답 대기 중`:''}`:'문서를 읽으면 분석 구간 수를 표시합니다.';
    if(busy&&startedAt){const seconds=Math.floor((Date.now()-startedAt)/1000);detail+=` · 경과 ${Math.floor(seconds/60)}분 ${seconds%60}초`;}
    modal.querySelector('[data-flow-detail]').textContent=detail;
    modal.querySelector('[data-flow-volume]').textContent=data?`${data.characters.toLocaleString('ko-KR')}자 · ${data.batches.length}개 분석 구간 · AI 요청 ${view.remaining}회 남음`:current()?'전체 문서를 읽은 후 AI 요청 횟수를 먼저 알려드립니다.':'분석할 원본 RFP가 없습니다.';
    modal.querySelector('[data-flow-ai]').textContent=aiConnected?`${aiInfo.label} 연결됨`:'AI 연결 필요';
    modal.querySelector('[data-flow-ai]').className=aiConnected?'overview-ai-badge connected':'overview-ai-badge';
    modal.querySelector('[data-flow-result-label]').textContent=drafts.has(current())?'분석 결과 · 검토 후 저장해 주세요':saved()?'저장된 사업 정보':'분석 결과가 여기에 표시됩니다';
  }
  function controls(){
    const view=workflow();select.disabled=busy;
    prepareButton.hidden=!([1,2].includes(view.activeStep)||view.phase==='saved');prepareButton.disabled=busy||!current();prepareButton.textContent=view.phase==='saved'?'새로 분석 준비':view.activeStep===2?view.action:'문서 읽기';
    analyzeButton.hidden=view.activeStep!==3;analyzeButton.disabled=busy||!prepared.has(current());analyzeButton.textContent=busy?view.action:!aiConnected?'AI 연결하기':`${view.action} (${view.remaining}회${view.completed?' 남음':''})`;
    saveButton.hidden=view.activeStep!==4||view.phase==='saved';saveButton.disabled=busy||!drafts.has(current());saveButton.textContent=view.action;
    stopButton.hidden=!busy||operation==='saving';stopButton.disabled=stopped;
    modal.querySelector('[data-overview-files]').disabled=busy;modal.querySelector('[data-overview-ai-settings]').disabled=busy;
    updateFlow();
  }
  function begin(name){busy=true;stopped=false;operation=name;startedAt=Date.now();errors.delete(current());clearInterval(ticker);ticker=setInterval(updateFlow,1000);controls();}
  function end(){busy=false;operation='';clearInterval(ticker);controls();}
  function releasePreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';}
  async function viewSource(item){
    const id=current();message('원문을 여는 중입니다.');
    try{
      const file=prepared.get(id)?.file||await window.ReqlyFiles.original(id);
      if(current()!==id||!modal.classList.contains('open'))return;
      const target=modal.querySelector('[data-overview-source]');target.replaceChildren();releasePreview();
      target.append(element('h3',`${file.name} · ${item.sourceLabel}`));
      if(/\.pdf$/i.test(file.name)){
        previewUrl=URL.createObjectURL(new Blob([file],{type:'application/pdf'}));
        const frame=document.createElement('iframe');frame.src=`${previewUrl}${item.page?`#page=${item.page}`:''}`;frame.title='사업 정보 원문';frame.style='width:100%;height:60vh;border:1px solid #d7e0de';target.append(frame);
      }else{
        const data=prepared.get(id)||{batches:core.batches((await window.ReqlyPortal.extractFile(file)).text)};
        const source=data.batches.flat().find(unit=>unit.sourceId===item.sourceId);
        target.append(element('pre',source?.text||item.quote,'overview-original'));
      }
      target.scrollIntoView({behavior:'smooth',block:'start'});message('원문과 정리 내용을 대조해 주세요.');
    }catch(error){message(error.message);}
  }
  function render(){
    resultArea.replaceChildren();const record=drafts.get(current())?.result||saved();
    modal.querySelector('[data-overview-filters]').hidden=!record;
    const stamp=modal.querySelector('[data-overview-saved]');stamp.textContent=record?.savedAt?`마지막 저장: ${new Date(record.savedAt).toLocaleString('ko-KR')}`:drafts.has(current())?'아직 저장하지 않은 분석 결과':'저장된 사업 정보 없음';
    if(!record){resultArea.append(element('p','분석 준비 후 AI 분석을 요청하면 다음 항목을 정리합니다. 요구사항 목록은 변경하지 않습니다.'));const list=element('div',undefined,'overview-controls');for(const category of core.categories)list.append(element('span',category,'reference-chip'));resultArea.append(list);controls();return;}
    if(!drafts.has(current())&&prepared.get(current())?.results.filter(Boolean).length<prepared.get(current())?.batches.length)resultArea.append(element('p','아래는 이전에 저장한 결과입니다. 새 분석이 완료되어도 저장하기 전까지 기존 결과는 유지됩니다.','pages-note'));
    resultArea.append(element('p',`${record.sourceName} · ${record.completedBatches}/${record.totalBatches}구간 분석 · 원문 근거가 확인된 ${record.items.length}개 항목. AI 정리 내용은 원문과 대조해 주세요.`,'pages-note'));
    if(record.rejected)resultArea.append(element('p',`원문 근거 또는 결과 형식을 확인하지 못한 ${record.rejected}개 항목은 제외했습니다.`));
    const query=search.value.trim().toLocaleLowerCase(),filtered=core.filterItems(record.items,{query,category:categoryFilter.value});let shown=0;
    for(const option of categoryFilter.options)option.textContent=option.value?`${option.value} (${filtered.counts[option.value]||0})`:`전체 카테고리 (${filtered.matched})`;
    modal.querySelector('[data-overview-filter-count]').textContent=`전체 ${filtered.total}개 중 ${filtered.items.length}개 표시`;
    for(const category of core.categories){
      const entries=filtered.items.filter(item=>item.category===category);
      if(!entries.length)continue;
      const section=element('section',undefined,'overview-category');section.append(element('h3',`${category} (${entries.length})`));
      for(const item of entries){
        const card=element('article',undefined,'overview-item');card.append(element('h4',item.title),element('p',item.content));
        const details=element('details');details.append(element('summary',`원문 근거 · ${item.sourceLabel}`),element('blockquote',item.quote));
        const view=element('button','해당 원문 보기','pages-action');view.type='button';view.onclick=()=>viewSource(item);details.append(view);card.append(details);section.append(card);shown++;
      }
      resultArea.append(section);
    }
    if(!shown)resultArea.append(element('p',query||categoryFilter.value?'선택한 카테고리와 검색어에 해당하는 결과가 없습니다. 필터를 초기화하거나 원문을 확인해 주세요.':'해당 내용의 원문 근거를 찾지 못했습니다. 문서에 정보가 없다는 뜻은 아니며 원문을 확인해 주세요.'));
    if(!query&&!categoryFilter.value){const absent=core.categories.filter(category=>!record.items.some(item=>item.category===category));if(absent.length)resultArea.append(element('p',`이번 분석에서 확인되지 않은 분류: ${absent.join(', ')}. 원문에서 추가 확인해 주세요.`));}
    controls();
  }
  async function prepare(){
    const id=current(),project=window.ReqlyApp.projectId;readProgress={};begin('loading');message('선택한 RFP 원본을 불러오고 있습니다.');
    try{
      const file=await window.ReqlyFiles.original(id);if(stopped)throw new Error('문서 읽기를 중단했습니다.');
      operation='reading';controls();message('전체 문서에서 텍스트를 읽고 있습니다.');
      const extracted=await window.ReqlyPortal.extractFile(file,{onProgress:progress=>{if(stopped)throw new Error('문서 읽기를 중단했습니다.');readProgress=progress;controls();}}),batches=core.batches(extracted.text);
      if(!batches.length)throw new Error('읽을 수 있는 텍스트가 없습니다. 스캔 문서는 문자 인식(OCR)된 PDF로 올려 주세요.');
      if(project!==window.ReqlyApp.projectId||stopped)throw new Error('분석 준비를 중단했습니다.');
      prepared.set(id,{file,batches,results:[],characters:extracted.text.length,pages:extracted.pages||1,project});
      render();
      message(`준비 완료 · ${extracted.text.length.toLocaleString('ko-KR')}자 · AI 요청 ${batches.length}회 예정. 자동으로 호출하지 않으며, 아래 AI 분석 버튼을 눌러 시작합니다.`);
    }catch(error){errors.set(id,{stage:'prepare',stopped});message(error.message);}finally{end();}
  }
  async function analyze(){
    await refreshAiInfo();
    if(!aiConnected){message('AI 연결 후 사업 정보 메뉴를 다시 열어 주세요. 분석 준비 내용은 유지됩니다.');modal.classList.remove('open');document.getElementById('aiSettingsButton')?.click();return;}
    const id=current(),data=prepared.get(id);if(!data)return;
    activeAiInfo={...aiInfo};begin('analyzing');const expectedSavedAt=saved()?.savedAt||'';
    try{
      for(let i=0;i<data.batches.length;i++){
        if(stopped)throw new Error('분석을 중단했습니다. 버튼을 다시 누르면 완료된 구간 이후부터 이어서 분석합니다.');
        if(data.project!==window.ReqlyApp.projectId)throw new Error('프로젝트가 변경되어 분석을 중단했습니다.');
        if(data.results[i])continue;
        message(`${activeAiInfo.label} 분석 중 · ${i+1}/${data.batches.length}구간. 완료된 구간은 재호출하지 않습니다.`);
        const response=await window.ReqlyPersistentAI.generate('overview',{documentName:data.file.name,categories:core.categories,units:data.batches[i]});
        data.results[i]=core.validate(response,data.batches[i]);
        controls();
      }
      if(stopped)throw new Error('분석을 중단했습니다. 결과는 아직 저장하지 않았습니다.');
      const merged=core.merge(data.results);
      const result={...merged,sourceName:data.file.name,sourceType:data.file.name.split('.').pop().toUpperCase(),sourceSize:data.file.size,pages:data.pages,characters:data.characters,analyzedAt:new Date().toISOString(),completedBatches:data.results.length,totalBatches:data.batches.length};
      drafts.set(id,{result,expectedSavedAt});render();message(`${activeAiInfo.label} 분석이 완료되었습니다. 근거를 검토한 뒤 ‘결과 저장’을 눌러 주세요.`);
    }catch(error){errors.set(id,{stage:'analyze',stopped});message(`${error.message} 기존 저장 결과는 유지됩니다.`);}finally{end();}
  }
  async function save(){
    const id=current(),draft=drafts.get(id);if(!draft)return;begin('saving');message('사업 정보를 저장하고 있습니다.');
    try{await window.ReqlyApp.saveOverview(id,draft.result,draft.expectedSavedAt);drafts.delete(id);render();message('사업 정보를 저장했습니다.');}
    catch(error){errors.set(id,{stage:'save'});message(`${error.message} 분석 결과는 이 창에 남아 있으므로 AI를 다시 호출할 필요가 없습니다.`);}finally{end();}
  }
  async function open(){
    if(busy){modal.classList.add('open');return;}
    window.ReqlyFiles.setProject(window.ReqlyApp.projectId);const files=(await window.ReqlyFiles.list()).filter(file=>file.kind==='rfp');
    const previous=select.value;select.replaceChildren();
    for(const file of files){const option=element('option',file.name);option.value=file.id;select.append(option);}
    const selected=window.ReqlyShared?.enabled?window.ReqlyShared.project?.workspace.selectedRfp:window.ReqlyApp.document?.assetId;
    const preferred=files.some(file=>file.id===previous)?previous:selected;if(files.some(file=>file.id===preferred))select.value=preferred;
    await refreshAiInfo();
    search.value='';categoryFilter.value='';releasePreview();modal.querySelector('[data-overview-source]').replaceChildren();render();
    message(files.length?'RFP별로 분석 결과가 따로 저장됩니다.':'먼저 ‘RFP·자료 관리’에서 원본 RFP를 추가해 주세요.');modal.classList.add('open');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const style=element('style');style.textContent='.overview-dialog{width:min(1180px,100%);max-height:94vh}.overview-category{margin:24px 0}.overview-item{padding:18px;margin:12px 0;border:1px solid #dce5e3;border-radius:12px}.overview-item h4{margin:0 0 9px;font-size:20px}.overview-item p,.overview-item blockquote,.overview-original{white-space:pre-wrap;overflow-wrap:anywhere;font-size:18px;line-height:1.8}.overview-item summary{cursor:pointer;color:#0c756b}.overview-item blockquote{border-left:3px solid #b9dcd6;margin:12px 0;padding:12px;background:#f4faf8}.overview-original{max-height:60vh;overflow:auto}.overview-controls{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.overview-dialog [data-overview-status]{white-space:pre-wrap;line-height:1.6}';document.head.append(style);
    modal=element('div',undefined,'pages-modal');modal.innerHTML=`<section class="pages-dialog overview-dialog" role="dialog" aria-modal="true" aria-label="사업 정보">
      <header><div><h2>사업 정보</h2><p>개요·기간·일정·제출 조건을 정리하고 원문 근거를 확인하세요.</p></div><button type="button" class="pages-close" aria-label="사업 정보 닫기">×</button></header>
      <div class="pages-body">
        <ol class="overview-steps" aria-label="사업 정보 분석 단계" data-flow-steps></ol>
        <div class="overview-document-row"><label class="pages-field"><span class="overview-file-caption">분석할 RFP <span data-flow-ai></span></span><select data-overview-file aria-label="사업 정보 분석할 RFP"></select></label><div class="overview-document-tools"><button class="pages-action" data-overview-files>RFP 추가·관리</button><button class="pages-action" data-overview-ai-settings>AI 연결 설정</button></div></div>
        <section class="overview-flow-card" aria-label="현재 작업 상태">
          <span class="overview-eyebrow">지금 할 일</span><h3 data-flow-title></h3><p data-flow-hint></p>
          <div class="overview-progress-heading"><strong data-flow-progress-label></strong><strong data-flow-percent></strong></div>
          <progress max="100" value="0" data-flow-progress></progress><p class="overview-progress-detail" data-flow-detail></p>
          <p class="overview-volume" data-flow-volume></p>
          <div class="overview-controls"><button class="pages-action primary" data-overview-prepare>문서 읽기</button><button class="pages-action primary" data-overview-analyze hidden>AI 분석 시작</button><button class="pages-action primary" data-overview-save hidden>결과 저장</button><button class="pages-action" data-overview-stop hidden>중단 요청</button></div>
          <p role="status" data-overview-status></p>
        </section>
        <div class="overview-results-heading"><h3 data-flow-result-label></h3><p data-overview-saved></p></div>
        <section class="overview-filter-panel" aria-label="사업 정보 결과 필터" data-overview-filters hidden>
          <div class="overview-filter-row"><label class="pages-field"><span>카테고리</span><select data-overview-category aria-label="사업 정보 카테고리"></select></label>
          <label class="pages-field"><span>사업 정보 검색</span><input type="search" data-overview-search placeholder="사업기간, 예산, 제출기한 등"></label><button type="button" class="pages-action" data-overview-filter-reset>필터 초기화</button></div>
          <p role="status" data-overview-filter-count></p>
        </section>
        <div data-overview-results></div><div data-overview-source></div>
      </div></section>`;document.body.append(modal);
    style.textContent+='.overview-dialog{font-size:18px}.overview-dialog p{font-size:17px;line-height:1.7}.overview-dialog .pages-action{font-size:16px;min-height:44px}.overview-dialog .reference-chip{font-size:15px}.overview-dialog h3{font-size:22px}.overview-dialog .pages-field{font-size:17px}.overview-dialog button:disabled{opacity:.45;cursor:default}';
    select=modal.querySelector('[data-overview-file]');status=modal.querySelector('[data-overview-status]');resultArea=modal.querySelector('[data-overview-results]');prepareButton=modal.querySelector('[data-overview-prepare]');analyzeButton=modal.querySelector('[data-overview-analyze]');saveButton=modal.querySelector('[data-overview-save]');stopButton=modal.querySelector('[data-overview-stop]');search=modal.querySelector('[data-overview-search]');
    categoryFilter=modal.querySelector('[data-overview-category]');
    for(const category of ['',...core.categories]){const option=element('option',category||'전체 카테고리');option.value=category;categoryFilter.append(option);}
    categoryFilter.onchange=render;
    modal.querySelector('[data-overview-filter-reset]').onclick=()=>{categoryFilter.value='';search.value='';render();};
    prepareButton.onclick=prepare;analyzeButton.onclick=()=>analyze().catch(error=>message(error.message));saveButton.onclick=save;stopButton.onclick=()=>{stopped=true;controls();message(operation==='analyzing'?'현재 요청의 응답을 받은 뒤 중단합니다. 완료된 구간은 유지됩니다.':'현재 문서 처리 단위가 끝난 뒤 중단합니다.');};search.oninput=render;select.onchange=()=>{readProgress={};categoryFilter.value='';search.value='';releasePreview();modal.querySelector('[data-overview-source]').replaceChildren();render();message('선택한 RFP의 작업 단계와 저장 결과를 표시합니다.');};
    modal.querySelector('[data-overview-ai-settings]').onclick=()=>{modal.classList.remove('open');document.getElementById('aiSettingsButton')?.click();};
    modal.onclick=event=>{if(event.target===modal||event.target.closest('.pages-close')){modal.classList.remove('open');releasePreview();}};
    modal.querySelector('[data-overview-files]').onclick=()=>{modal.classList.remove('open');document.querySelector('.file-manager-button')?.click();};
    const button=element('button',undefined,'nav-item');button.type='button';button.id='businessInfoButton';button.innerHTML='<svg><use href="#i-file"></use></svg><span>사업 정보</span>';button.onclick=()=>open().then(()=>{document.getElementById('sidebar')?.classList.remove('open');document.getElementById('mobileScrim')?.classList.remove('open');}).catch(error=>{modal.classList.add('open');message(error.message);});document.querySelector('[data-view="documents"]')?.before(button);
    window.addEventListener('reqly-shared-update',()=>{if(modal.classList.contains('open')&&!busy)render();});
  });
})();
