/* On-demand AI extraction. Candidates require source evidence and explicit review. */
(() => {
  'use strict';
  const queue=window.ReqlyOverviewCore,core=window.ReqlyRequirementAI,cache=new Map();
  let modal,select,status,results,busy=false,stopped=false,activeProject='',aiLabel='',operation='';
  const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
  const key=()=>`${activeProject}|${select.value}`;
  const data=()=>cache.get(key());
  const message=text=>{status.textContent=text;};
  function candidates(record){return core.merge(record?.results||[]);}
  function render(){
    const record=data(),summary=candidates(record),existing=window.ReqlyApp.requirements;
    const duplicates=summary.items.map(item=>core.duplicate(existing,item,select.value));
    const selected=summary.items.filter((item,index)=>record?.checked.has(index)&&!duplicates[index]);
    const done=record?.results.filter(Boolean).length||0,total=record?.batches.length||0;
    modal.querySelector('[data-ai-step]').textContent=busy?(operation==='reading'?'1 · 원본 문서를 읽고 있습니다':operation==='saving'?'3 · 선택한 항목을 목록에 저장하고 있습니다':operation==='connecting'?'2 · AI 연결 상태를 확인하고 있습니다':`2 · ${aiLabel}가 요구사항 후보를 찾고 있습니다`):record?.complete?'3 · 원문을 검토하고 선택한 후보를 추가하세요':record?'2 · AI 분석을 시작하거나 이어서 진행하세요':'1 · RFP를 선택하고 문서 읽기를 누르세요';
    modal.querySelector('[data-ai-progress]').value=record?queue.progress(record):0;
    modal.querySelector('[data-ai-count]').textContent=record?`${queue.progress(record)}% · ${done}/${total}구간 완료 · ${record.characters.toLocaleString('ko-KR')}자${record.splitCount?` · ${record.splitCount}회 자동 분할`:''}`:'번호 없는 문단·목록·표에서 요구사항 후보를 찾습니다. AI 분석은 시작 버튼을 누를 때 실행됩니다.';
    select.disabled=busy;
    modal.querySelectorAll('[data-ai-files],[data-ai-settings]').forEach(button=>button.disabled=busy);
    const read=modal.querySelector('[data-ai-read]');read.disabled=busy||!select.value;read.textContent=record?'문서 다시 읽기':'문서 읽기';
    const analyze=modal.querySelector('[data-ai-analyze]');analyze.hidden=!record||record.complete;analyze.disabled=busy;analyze.textContent=done?'이어서 AI 분석':'AI 분석 시작';
    modal.querySelector('[data-ai-stop]').hidden=!busy||operation==='saving';
    const apply=modal.querySelector('[data-ai-apply]');apply.disabled=busy||!selected.length;apply.textContent=`선택한 ${selected.length}개 목록에 추가`;
    modal.querySelector('[data-ai-summary]').textContent=`요구사항 후보 ${summary.items.length}개 · 이미 등록됨 ${duplicates.filter(Boolean).length}개${summary.rejected?` · 근거 미확인 ${summary.rejected}개 제외`:''}${record&&!record.complete&&summary.items.length?' · 일부 구간 결과':''}`;
    const all=modal.querySelector('[data-ai-all]'),eligible=duplicates.filter(value=>!value).length;
    all.disabled=busy||!eligible;all.checked=eligible>0&&selected.length===eligible;all.indeterminate=selected.length>0&&selected.length<eligible;
    results.replaceChildren();
    if(!summary.items.length)results.append(node('p',record?.complete?'원문 근거가 확인되는 요구사항 후보를 찾지 못했습니다. 요구사항이 없다는 뜻은 아니므로 문서 원문을 확인해 주세요.':'AI 분석 후 각 후보의 원문과 위치를 확인하고 필요한 항목을 선택하세요. 기존 목록에는 선택한 항목만 추가됩니다.','requirement-ai-empty'));
    summary.items.forEach((item,index)=>{
      const card=node('article',undefined,`requirement-ai-candidate${duplicates[index]?' is-duplicate':''}`),label=node('label'),check=node('input');
      check.type='checkbox';check.checked=record.checked.has(index)&&!duplicates[index];check.disabled=busy||duplicates[index];check.setAttribute('aria-label',`${item.name} 선택`);
      check.onchange=()=>{check.checked?record.checked.add(index):record.checked.delete(index);render();};
      label.append(check,node('strong',item.name));card.append(label);
      card.append(node('p',`${item.id?`원문 ID: ${item.id}`:'원문 ID 없음'} · ${item.category} · ${item.sourceLabel}${duplicates[index]?' · 이미 등록된 항목':''}`));
      item.warnings.forEach(warning=>card.append(node('p',warning)));
      const evidence=node('details');evidence.open=true;evidence.append(node('summary','요구사항 상세 원문 · 근거 확인'),node('blockquote',item.quote));card.append(evidence);results.append(card);
    });
  }
  async function read(){
    if(busy)return;
    const cacheKey=key(),project=activeProject,assetId=select.value;
    if(data()&&!await(window.ReqlyDesign?.confirm('문서 다시 읽기','이 문서의 아직 반영하지 않은 AI 후보와 진행 상태를 새로 준비할까요? 저장된 요구사항은 유지됩니다.')??Promise.resolve(confirm('AI 후보와 진행 상태를 새로 준비할까요?'))))return;
    busy=true;operation='reading';stopped=false;render();message('RFP 원본을 불러오고 있습니다.');
    try{
      window.ReqlyFiles.setProject(project);const file=await window.ReqlyFiles.original(assetId);
      const extracted=await window.ReqlyPortal.extractFile(file,{onProgress:progress=>{if(stopped)throw new Error('문서 읽기를 중단했습니다.');message(`문서 읽는 중 · ${progress.completed}/${progress.total}페이지`);}});
      if(stopped||project!==window.ReqlyApp.projectId)throw new Error('문서 읽기를 중단했습니다.');
      const batches=queue.batches(extracted.text);if(!batches.length)throw new Error('읽을 수 있는 텍스트가 없습니다. 스캔 문서는 OCR 처리된 문서로 올려 주세요.');
      cache.set(cacheKey,{file,batches,results:[],checked:new Set(),characters:extracted.text.length,complete:false});
      message(`문서 읽기 완료 · AI 요청 ${batches.length}회 예정. ‘AI 분석 시작’을 눌러 주세요.`);
    }catch(error){message(error.message);}finally{busy=false;operation='';render();}
  }
  async function analyze(){
    if(busy||!data())return;
    const record=data(),project=activeProject;busy=true;operation='connecting';stopped=false;render();
    try{
      const info=await window.ReqlyPersistentAI.getConnectionInfo();if(!info.connected){message('AI 연결 설정에서 API 키를 연결한 뒤 다시 분석해 주세요.');return;}
      record.model=info.label;aiLabel=info.label;operation='analyzing';render();
      await queue.analyze(record,{
        shouldStop:()=>stopped||project!==window.ReqlyApp.projectId,
        request:async units=>{const response=await window.ReqlyPersistentAI.generate('requirements',{documentName:record.file.name,categories:window.ReqlyApp.categories,units});if(project!==window.ReqlyApp.projectId)throw new Error('프로젝트가 변경되었습니다.');return response;},
        validateResult:(response,units)=>core.validate(response,units,window.ReqlyApp.categories),
        onEvent:event=>{render();message(event.type==='split'?`${event.reason} 해당 구간을 나누어 이어서 분석합니다.`:`${aiLabel} 분석 중 · ${record.results.filter(Boolean).length}/${record.batches.length}구간 완료`);}
      });
      record.complete=true;message(`${aiLabel} 분석을 완료했습니다. 후보와 원문을 검토하고 목록에 추가할 항목을 선택해 주세요.`);
    }catch(error){message(`${error.message} 완료된 구간은 유지됩니다.`);}finally{busy=false;operation='';render();}
  }
  async function apply(){
    if(busy||!data())return;
    const record=data(),selected=candidates(record).items.filter((item,index)=>record.checked.has(index));
    if(!selected.length)return;busy=true;operation='saving';render();
    try{const result=await window.ReqlyApp.importAiRequirements(select.value,selected,activeProject,record.model);if(!result.cancelled){record.checked.clear();message(`${result.added}개 요구사항을 추가했습니다.${result.skipped?` 기존 항목 또는 중복 후보 ${result.skipped}개는 제외했습니다.`:''}`);}}
    catch(error){message(`${error.message} 후보는 유지되므로 AI를 다시 호출할 필요가 없습니다.`);}finally{busy=false;operation='';render();}
  }
  async function open(assetId){
    if(busy){modal.classList.add('open');return;}
    activeProject=window.ReqlyApp.projectId;window.ReqlyFiles.setProject(activeProject);
    const files=(await window.ReqlyFiles.list()).filter(file=>file.kind==='rfp');select.replaceChildren();
    files.forEach(file=>{const option=node('option',file.name);option.value=file.id;select.append(option);});
    if(files.some(file=>file.id===assetId))select.value=assetId;
    else if(files.some(file=>file.id===window.ReqlyApp.document?.assetId))select.value=window.ReqlyApp.document.assetId;
    message(files.length?'원문 ID는 있는 경우에만 사용하며, 없는 번호는 만들지 않습니다.':'문서함에서 RFP를 먼저 추가해 주세요.');render();modal.classList.add('open');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    modal=node('div',undefined,'pages-modal');modal.innerHTML=`<section class="pages-dialog requirement-ai-dialog" role="dialog" aria-modal="true" aria-label="AI 요구사항 추출"><header><div><h2>AI 요구사항 추출</h2><p>번호 없는 문서도 원문을 근거로 찾아 검토합니다.</p></div><button class="pages-close" aria-label="AI 요구사항 추출 닫기" type="button">×</button></header><div class="pages-body">
      <div class="requirement-ai-tools"><label class="pages-field"><span>분석할 RFP</span><select data-ai-file aria-label="요구사항 추출할 RFP"></select></label><button class="pages-action" data-ai-files>RFP 추가·관리</button><button class="pages-action" data-ai-settings>AI 연결 설정</button></div>
      <section class="requirement-ai-state"><h3 data-ai-step></h3><progress data-ai-progress max="100" value="0" aria-label="AI 요구사항 분석 진행률"></progress><p data-ai-count></p><div class="requirement-ai-actions"><button class="pages-action" data-ai-read>문서 읽기</button><button class="pages-action primary" data-ai-analyze>AI 분석 시작</button><button class="pages-action" data-ai-stop hidden>중단 요청</button></div><p role="status" data-ai-status></p></section>
      <div class="requirement-ai-review"><label><input type="checkbox" data-ai-all>추가 가능한 후보 전체 선택</label><span data-ai-summary></span><button class="pages-action primary" data-ai-apply>선택 항목 목록에 추가</button></div><div data-ai-results></div>
      </div></section>`;document.body.append(modal);
    select=modal.querySelector('[data-ai-file]');status=modal.querySelector('[data-ai-status]');results=modal.querySelector('[data-ai-results]');
    select.onchange=()=>{message('선택한 RFP의 분석 상태와 후보를 표시합니다.');render();};
    modal.querySelector('[data-ai-read]').onclick=read;modal.querySelector('[data-ai-analyze]').onclick=()=>analyze().catch(error=>message(error.message));modal.querySelector('[data-ai-apply]').onclick=apply;
    modal.querySelector('[data-ai-stop]').onclick=()=>{stopped=true;message('현재 응답을 받은 뒤 중단합니다. 완료된 구간은 유지됩니다.');};
    modal.querySelector('[data-ai-all]').onchange=event=>{const record=data();if(!record)return;record.checked.clear();if(event.target.checked)candidates(record).items.forEach((item,index)=>{if(!core.duplicate(window.ReqlyApp.requirements,item,select.value))record.checked.add(index);});render();};
    modal.querySelector('[data-ai-settings]').onclick=()=>{modal.classList.remove('open');document.getElementById('aiSettingsButton').click();};
    modal.querySelector('[data-ai-files]').onclick=()=>{modal.classList.remove('open');document.querySelector('.file-manager-button').click();};
    modal.onclick=event=>{if(event.target.closest('.pages-close')){if(busy)stopped=true;modal.classList.remove('open');}};
    const button=node('button','AI 요구사항 추출','button ghost');button.type='button';button.onclick=()=>open().catch(error=>window.ReqlyDesign?.notice('AI 요구사항 추출',error.message));
    const tools=document.querySelector('.workspace-more-body')||document.getElementById('uploadButton')?.parentElement;tools?.append(button);
    window.ReqlyRequirementExtraction={open};
    window.addEventListener('reqly-shared-update',()=>{if(modal.classList.contains('open')&&!busy&&activeProject===window.ReqlyApp.projectId)render();});
  });
})();
