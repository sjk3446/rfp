/* On-demand AI extraction. Candidates require source evidence and explicit review. */
(() => {
  'use strict';
  const core=window.ReqlyRequirementAI,analysis=window.ReqlyRfpAnalysis,checkedByAnalysis=new Map();
  let modal,select,status,results,busy=false,stopped=false,activeProject='',aiLabel='',operation='',selectedCount=0,eligibleCount=0,duplicateCache;
  const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
  const key=()=>`${activeProject}|${select.value}`;
  const data=()=>analysis.get(activeProject,select.value);
  const otherRunning=()=>!busy&&!!analysis.isRunning?.(activeProject,select.value);
  const checked=record=>{const id=`${key()}|${record?.analysisId||''}`;if(!checkedByAnalysis.has(id))checkedByAnalysis.set(id,new Set());return checkedByAnalysis.get(id);};
  const message=text=>{status.textContent=text;};
  function candidates(record){return{items:record?.requirements||[],rejected:record?.rejectedRequirements||0};}
  function duplicatesFor(items,existing){
    if(duplicateCache?.items===items&&duplicateCache.existing===existing&&duplicateCache.length===existing.length&&duplicateCache.assetId===select.value)return duplicateCache.values;
    const values=items.map(item=>core.duplicate(existing,item,select.value));duplicateCache={items,existing,length:existing.length,assetId:select.value,values};return values;
  }
  function render(redraw=true){
    const record=data(),elsewhere=otherRunning(),locked=busy||elsewhere;
    const done=record?.completedBatches||0,total=record?.batchCount||0;
    modal.querySelector('[data-ai-step]').textContent=elsewhere?'2 · 다른 분석 화면에서 RFP 통합 분석이 진행 중입니다':busy?(operation==='reading'?'1 · 원본 문서를 읽고 있습니다':operation==='saving'?'3 · 선택한 항목을 목록에 저장하고 있습니다':operation==='connecting'?'2 · AI 연결 상태를 확인하고 있습니다':`2 · ${aiLabel}가 요구사항 후보를 찾고 있습니다`):record?.complete?'3 · 원문을 검토하고 선택한 후보를 추가하세요':record?'2 · AI 분석을 시작하거나 이어서 진행하세요':'1 · RFP를 선택하고 문서 읽기를 누르세요';
    modal.querySelector('[data-ai-progress]').value=record?analysis.progress(record):0;
    modal.querySelector('[data-ai-count]').textContent=record?`${analysis.progress(record)}% · ${done}/${total}구간 완료 · ${record.characters.toLocaleString('ko-KR')}자${record.splitCount?` · ${record.splitCount}회 자동 분할`:''}`:'번호 없는 문단·목록·표에서 요구사항 후보를 찾습니다. AI 분석은 시작 버튼을 누를 때 실행됩니다.';
    select.disabled=locked;
    modal.querySelectorAll('[data-ai-files],[data-ai-settings]').forEach(button=>button.disabled=locked);
    const read=modal.querySelector('[data-ai-read]');read.disabled=locked||!select.value;read.textContent=record?'새로 분석 준비':'문서 읽기';
    const analyze=modal.querySelector('[data-ai-analyze]');analyze.hidden=!record||record.complete;analyze.disabled=locked;analyze.textContent=elsewhere?'통합 분석 진행 중':done?'이어서 통합 분석':'RFP 통합 분석 시작';
    const save=modal.querySelector('[data-ai-save]');save.hidden=!record?.persistError;save.disabled=locked;
    modal.querySelector('[data-ai-stop]').hidden=!busy||operation==='saving';
    const apply=modal.querySelector('[data-ai-apply]'),all=modal.querySelector('[data-ai-all]');results.inert=locked;
    if(!redraw){apply.disabled=locked||!selectedCount;all.disabled=locked||!eligibleCount;return;}
    const summary=candidates(record),existing=window.ReqlyApp.requirements;
    const duplicates=duplicatesFor(summary.items,existing);
    const selected=summary.items.filter((item,index)=>checked(record).has(index)&&!duplicates[index]);
    selectedCount=selected.length;eligibleCount=duplicates.filter(value=>!value).length;
    apply.disabled=locked||!selected.length;apply.textContent=`선택한 ${selected.length}개 목록에 추가`;
    modal.querySelector('[data-ai-summary]').textContent=`요구사항 후보 ${summary.items.length}개 · 이미 등록됨 ${duplicates.filter(Boolean).length}개${summary.rejected?` · 근거 미확인 ${summary.rejected}개 제외`:''}${record&&!record.complete&&summary.items.length?' · 일부 구간 결과':''}`;
    const eligible=eligibleCount;
    all.disabled=locked||!eligible;all.checked=eligible>0&&selected.length===eligible;all.indeterminate=selected.length>0&&selected.length<eligible;
    if(redraw==='selection')return;
    results.replaceChildren();
    if(!summary.items.length)results.append(node('p',record?.complete?'원문 근거가 확인되는 요구사항 후보를 찾지 못했습니다. 요구사항이 없다는 뜻은 아니므로 문서 원문을 확인해 주세요.':'AI 분석 후 각 후보의 원문과 위치를 확인하고 필요한 항목을 선택하세요. 기존 목록에는 선택한 항목만 추가됩니다.','requirement-ai-empty'));
    summary.items.forEach((item,index)=>{
      const card=node('article',undefined,`requirement-ai-candidate${duplicates[index]?' is-duplicate':''}`),label=node('label'),check=node('input');
      check.type='checkbox';check.checked=checked(record).has(index)&&!duplicates[index];check.disabled=locked||duplicates[index];check.setAttribute('aria-label',`${item.name} 선택`);
      check.onchange=()=>{check.checked?checked(record).add(index):checked(record).delete(index);render('selection');};
      label.append(check,node('strong',item.name));card.append(label);
      card.append(node('p',`${item.id?`원문 ID: ${item.id}`:'원문 ID 없음'} · ${item.category} · ${item.sourceLabel}${duplicates[index]?' · 이미 등록된 항목':''}`));
      item.warnings.forEach(warning=>card.append(node('p',warning)));
      const evidence=node('details');evidence.open=true;evidence.append(node('summary','요구사항 상세 원문 · 근거 확인'),node('blockquote',item.quote));card.append(evidence);results.append(card);
    });
  }
  async function read(){
    if(busy||otherRunning())return;
    const project=activeProject,assetId=select.value,previous=data();
    if(previous&&!await(window.ReqlyDesign?.confirm('RFP 새로 분석','저장된 요구사항과 사업정보는 유지하고, 이 RFP의 통합 분석을 새로 준비할까요? AI 분석을 시작하면 두 결과를 함께 생성합니다.')??Promise.resolve(confirm('이 RFP의 통합 분석을 새로 준비할까요?'))))return;
    busy=true;operation='reading';stopped=false;render(false);message('RFP 원본을 준비하고 있습니다.');
    try{
      const record=await analysis.prepare(project,assetId,{force:!!previous,onProgress:progress=>{if(stopped||project!==window.ReqlyApp.projectId)throw new Error('문서 읽기를 중단했습니다.');message(`문서 읽는 중 · ${progress.completed}/${progress.total}페이지`);}});
      if(stopped||project!==window.ReqlyApp.projectId)throw new Error('문서 읽기를 중단했습니다.');
      message(record.complete?'저장된 통합 분석 결과를 불러왔습니다. 사업정보 메뉴에서도 같은 결과를 볼 수 있습니다.':`문서 준비 완료 · AI 요청 ${record.batchCount}회 예정. 요구사항과 사업정보를 한 번에 분석합니다.`);
    }catch(error){message(error.message);}finally{busy=false;operation='';render();}
  }
  async function analyze(){
    if(busy||otherRunning()||!data())return;
    const record=data(),project=activeProject;busy=true;operation='connecting';stopped=false;render(false);
    try{
      const info=await window.ReqlyPersistentAI.getConnectionInfo();if(!info.connected){message('AI 연결 설정에서 API 키를 연결한 뒤 다시 분석해 주세요.');return;}
      aiLabel=info.label;operation='analyzing';render(false);
      const completed=await analysis.analyze(record,{
        shouldStop:()=>stopped||project!==window.ReqlyApp.projectId,
        onEvent:event=>{const progress=data()||record;render(event.type==='completed');message(event.type==='split'?`${event.reason} 해당 구간을 나누어 이어서 분석합니다.`:event.type==='saving'?'요구사항 후보와 사업정보를 함께 저장하고 있습니다.':`${aiLabel} 통합 분석 중 · ${progress.completedBatches}/${progress.batchCount}구간 완료`);}
      });
      message(`${completed.model||aiLabel} 통합 분석 결과를 저장했습니다. 사업정보에서도 추가 분석 없이 볼 수 있습니다. 요구사항은 아래에서 선택한 항목만 추가됩니다.`);
    }catch(error){message(`${error.message} 완료된 결과는 유지됩니다.`);}finally{busy=false;operation='';render();}
  }
  async function retrySave(){
    const record=data();if(busy||otherRunning()||!record)return;busy=true;operation='saving';render(false);
    try{await analysis.save(record);message('통합 분석 결과를 저장했습니다. 추가 AI 호출은 하지 않았습니다.');}
    catch(error){message(error.message);}finally{busy=false;operation='';render();}
  }
  async function apply(){
    if(busy||otherRunning()||!data())return;
    const record=data(),selected=candidates(record).items.filter((item,index)=>checked(record).has(index));
    if(!selected.length)return;busy=true;operation='saving';render();
    try{const result=await window.ReqlyApp.importAiRequirements(select.value,selected,activeProject,record.model);if(!result.cancelled){checked(record).clear();message(`${result.added}개 요구사항을 추가했습니다.${result.skipped?` 기존 항목 또는 중복 후보 ${result.skipped}개는 제외했습니다.`:''}`);}}
    catch(error){message(`${error.message} 후보는 유지되므로 AI를 다시 호출할 필요가 없습니다.`);}finally{busy=false;operation='';render();}
  }
  async function open(assetId){
    if(busy){modal.classList.add('open');return;}
    duplicateCache=null;
    activeProject=window.ReqlyApp.projectId;window.ReqlyFiles.setProject(activeProject);
    const files=(await window.ReqlyFiles.list()).filter(file=>file.kind==='rfp');select.replaceChildren();
    files.forEach(file=>{const option=node('option',file.name);option.value=file.id;select.append(option);});
    if(files.some(file=>file.id===assetId))select.value=assetId;
    else if(files.some(file=>file.id===window.ReqlyApp.document?.assetId))select.value=window.ReqlyApp.document.assetId;
    message(files.length?(data()?.complete?(data().persistError?'통합 분석 결과를 아직 보관하지 못했습니다. 통합 분석 저장 다시 시도로 보관할 수 있습니다.':'저장된 통합 분석의 요구사항 후보입니다. 사업정보 메뉴와 동일한 분석 결과를 사용합니다.'):'한 번의 RFP 통합 분석으로 요구사항 후보와 사업정보를 함께 준비합니다. 원문에 없는 ID는 만들지 않습니다.'):'문서함에서 RFP를 먼저 추가해 주세요.');render();modal.classList.add('open');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    modal=node('div',undefined,'pages-modal');modal.innerHTML=`<section class="pages-dialog requirement-ai-dialog" role="dialog" aria-modal="true" aria-label="AI 요구사항 추출"><header><div><h2>AI 요구사항 추출</h2><p>사업정보와 함께 분석한 요구사항 후보를 원문과 대조하고 선택합니다.</p></div><button class="pages-close" aria-label="AI 요구사항 추출 닫기" type="button">×</button></header><div class="pages-body">
      <div class="requirement-ai-tools"><label class="pages-field"><span>분석할 RFP</span><select data-ai-file aria-label="요구사항 추출할 RFP"></select></label><button class="pages-action" data-ai-files>RFP 추가·관리</button><button class="pages-action" data-ai-settings>AI 연결 설정</button></div>
      <section class="requirement-ai-state"><h3 data-ai-step></h3><progress data-ai-progress max="100" value="0" aria-label="AI 요구사항 분석 진행률"></progress><p data-ai-count></p><div class="requirement-ai-actions"><button class="pages-action" data-ai-read>문서 읽기</button><button class="pages-action primary" data-ai-analyze>AI 분석 시작</button><button class="pages-action" data-ai-stop hidden>중단 요청</button><button class="pages-action" data-ai-save hidden>통합 분석 저장 다시 시도</button></div><p role="status" data-ai-status></p></section>
      <div class="requirement-ai-review"><label><input type="checkbox" data-ai-all>추가 가능한 후보 전체 선택</label><span data-ai-summary></span><button class="pages-action primary" data-ai-apply>선택 항목 목록에 추가</button></div><div data-ai-results></div>
      </div></section>`;document.body.append(modal);
    select=modal.querySelector('[data-ai-file]');status=modal.querySelector('[data-ai-status]');results=modal.querySelector('[data-ai-results]');
    select.onchange=()=>{message('선택한 RFP의 분석 상태와 후보를 표시합니다.');render();};
    modal.querySelector('[data-ai-read]').onclick=read;modal.querySelector('[data-ai-analyze]').onclick=()=>analyze().catch(error=>message(error.message));modal.querySelector('[data-ai-apply]').onclick=apply;modal.querySelector('[data-ai-save]').onclick=retrySave;
    modal.querySelector('[data-ai-stop]').onclick=()=>{stopped=true;message('현재 응답을 받은 뒤 중단합니다. 완료된 구간은 유지됩니다.');};
    modal.querySelector('[data-ai-all]').onchange=event=>{const record=data();if(!record)return;checked(record).clear();if(event.target.checked)candidates(record).items.forEach((item,index)=>{if(!core.duplicate(window.ReqlyApp.requirements,item,select.value))checked(record).add(index);});render();};
    modal.querySelector('[data-ai-settings]').onclick=()=>{modal.classList.remove('open');document.getElementById('aiSettingsButton').click();};
    modal.querySelector('[data-ai-files]').onclick=()=>{modal.classList.remove('open');document.querySelector('.file-manager-button').click();};
    modal.onclick=event=>{if(event.target.closest('.pages-close')){if(busy)stopped=true;modal.classList.remove('open');}};
    const button=node('button','AI 요구사항 추출','button ghost');button.type='button';button.onclick=()=>open().catch(error=>window.ReqlyDesign?.notice('AI 요구사항 추출',error.message));
    const tools=document.querySelector('.workspace-more-body')||document.getElementById('uploadButton')?.parentElement;tools?.append(button);
    window.ReqlyRequirementExtraction={open};
    window.addEventListener('reqly-rfp-analysis-update',event=>{if(modal.classList.contains('open')&&!busy&&activeProject===window.ReqlyApp.projectId&&(!event.detail?.assetId||event.detail.assetId===select.value))render();});
    window.addEventListener('reqly-shared-update',()=>{duplicateCache=null;if(modal.classList.contains('open')&&!busy&&activeProject===window.ReqlyApp.projectId)render();});
  });
})();
