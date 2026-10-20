/* Project questions: local retrieval first, one answer call, explicit query expansion. */
(() => {
  'use strict';
  const core=window.ReqlyProjectQA,filesCache=new Map(),answers=new Map();
  let modal,input,status,result,scope,busy=false,stopped=false,project='',previousQuestion='',previousContext='',pendingRecord=null,historyLimit=8,historyRecords=[],historyRevision=0;
  const selectedHistory=new Set(),store=window.ReqlyQuestionStore;
  const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
  const message=text=>{status.textContent=text;};
  const guard=id=>{if(stopped||id!==window.ReqlyApp.projectId)throw new Error('질문을 중단했습니다.');};
  function controls(){modal.querySelectorAll('[data-qa-ask],[data-qa-expand],[data-qa-settings],[data-qa-save]').forEach(button=>button.disabled=busy);input.disabled=busy;modal.querySelector('[data-qa-stop]').hidden=!busy;modal.querySelector('[data-qa-save]').hidden=!pendingRecord;visibilityControls();}
  function visibilityControls(){modal.querySelector('[data-qa-private]').disabled=busy||!selectedHistory.size;modal.querySelector('[data-qa-share]').disabled=busy||!selectedHistory.size||!window.ReqlyShared?.enabled;modal.querySelector('[data-qa-selected]').textContent=`${selectedHistory.size}개 선택`;}
  async function records(id){return store.merge(await store.list(id),window.ReqlyApp.projectId===id?window.ReqlyApp.questionHistory||[]:[]);}
  async function renderHistory(){
    const revision=++historyRevision,id=project;let all;
    try{all=await records(id);}catch(error){message(`개인 히스토리를 읽지 못했습니다: ${error.message}`);return;}
    if(revision!==historyRevision||project!==id)return;historyRecords=all;
    for(const key of selectedHistory)if(!all.some(record=>record.id===key))selectedHistory.delete(key);
    const query=core.normalized(modal.querySelector('[data-qa-history-search]').value);
    const list=all.filter(record=>record?.question&&Array.isArray(record.answer?.claims)).filter(record=>!query||core.normalized(record.question+' '+record.answer.claims.map(claim=>claim.text).join(' ')).includes(query)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    modal.querySelector('[data-qa-history-count]').textContent=`${all.length}개`;
    const area=modal.querySelector('[data-qa-history-list]');area.replaceChildren();
    if(!list.length)area.append(node('p',query?'검색된 질문이 없습니다.':'저장된 질의응답이 없습니다.','qa-model'));
    list.slice(0,historyLimit).forEach(record=>{
      const row=node('div',undefined,'qa-history-row'),check=node('input');check.type='checkbox';check.checked=selectedHistory.has(record.id);check.setAttribute('aria-label',`${record.question} 선택`);check.onchange=()=>{check.checked?selectedHistory.add(record.id):selectedHistory.delete(record.id);visibilityControls();};
      const button=node('button',undefined,'qa-history-item');button.type='button';button.append(node('strong',record.question),node('small',`${record.visibility==='shared'?'프로젝트 공유':'나만 보기'} · ${new Date(record.createdAt).toLocaleString('ko-KR')} · ${record.model||'문서 검색'}`));
      button.onclick=()=>{if(busy)return;input.value=record.question;scope.textContent=record.scope||'저장 당시의 문서 근거';show(record.answer,record.question,record.model||'문서 검색',true);message(`히스토리 열람 · ${new Date(record.createdAt).toLocaleString('ko-KR')} 저장 당시 자료를 기준으로 한 답변입니다.`);};row.append(check,button);area.append(row);
    });
    const more=modal.querySelector('[data-qa-history-more]');more.hidden=list.length<=historyLimit;more.textContent=`더 보기 (${Math.max(0,list.length-historyLimit)}개 남음)`;visibilityControls();
  }
  async function setVisibility(shared){
    if(busy||!selectedHistory.size)return;const id=project,chosen=historyRecords.filter(record=>selectedHistory.has(record.id));busy=true;controls();
    try{
      if(shared&&!window.ReqlyShared?.enabled)throw new Error('프로젝트 메뉴에서 공유 프로젝트를 먼저 열어 주세요.');
      if(id!==window.ReqlyApp.projectId)throw new Error('프로젝트가 변경되었습니다.');await store.save(id,chosen);
      const add=shared?chosen:[],remove=shared?[]:chosen.filter(record=>record.visibility==='shared').map(record=>record.id);
      if(add.length||remove.length)await window.ReqlyApp.updateProjectQuestions(add,remove,id);
      selectedHistory.clear();await renderHistory();message(shared?'선택한 답변을 프로젝트에 공유했습니다. 프로젝트 URL과 비밀번호로 접속한 분들이 읽을 수 있습니다.':'선택한 답변을 나만 보기로 저장했습니다. 이미 다른 사람이 보관한 사본은 회수되지 않습니다.');
    }catch(error){message(`공개 범위를 변경하지 못했습니다: ${error.message}`);}finally{busy=false;controls();}
  }
  function historyRecord(answer,question,model,signature,contextQuestion){
    return{id:crypto.randomUUID(),question,contextQuestion,signature,model,createdAt:new Date().toISOString(),scope:scope.textContent,answer:{status:answer.status,followUp:answer.followUp,rejected:answer.rejected,claims:answer.claims.map(claim=>({text:claim.text,evidence:claim.evidence.map(evidence=>({sourceId:evidence.sourceId,filename:evidence.filename,page:evidence.page,sheet:evidence.sheet,title:evidence.title,requirementKey:evidence.requirementKey,assetId:evidence.assetId,kind:evidence.kind,location:evidence.location,quote:evidence.quote}))}))}};
  }
  async function persist(record,id){
    pendingRecord=record;controls();
    try{await store.save(id,[record]);pendingRecord=null;await renderHistory();message('답변과 근거를 ‘나만 보기’ 히스토리에 저장했습니다. 목록에서 선택하면 프로젝트에 공유할 수 있습니다.');}
    catch(error){message(`답변은 표시했으나 히스토리에 저장하지 못했습니다: ${error.message} ‘히스토리 저장 다시 시도’를 누르면 AI 호출 없이 저장합니다.`);}finally{controls();}
  }
  async function collect(id){
    window.ReqlyFiles.setProject(id);const files=await window.ReqlyFiles.list();guard(id);
    const app=window.ReqlyApp,requirements=app.requirements,references=app.references||[],document=app.document;
    const selected=window.ReqlyShared?.enabled?window.ReqlyShared.project?.workspace.selectedRfp:localStorage.getItem(`reqly-rfp-${id}`);
    const primary=files.find(file=>file.id===(selected||document?.assetId)&&file.kind==='rfp')||files.find(file=>file.kind==='rfp');
    const included=files.filter(file=>file.kind!=='rfp'||file.id===primary?.id),units=[],failures=[];
    requirements.forEach(item=>{
      if(primary&&item.aiEvidence?.assetId&&item.aiEvidence.assetId!==primary.id)return;
      const provenance=Object.keys(item.rfpSources||{});if(primary&&provenance.length&&!provenance.includes(primary.id))return;
      units.push(...core.units(`${item.id?item.id+'\n':''}${item.name}\n${item.description}`,{kind:'requirement',requirementKey:item.key,title:item.name,filename:item.aiEvidence?files.find(file=>file.id===item.aiEvidence.assetId)?.name||item.source:document?.name||item.source,assetId:item.aiEvidence?.assetId||'',page:item.aiEvidence?.page||Number(item.source?.match(/^(\d+)페이지/)?.[1])||null,sheet:item.aiEvidence?.sheet||'',location:item.source}));
    });
    for(let index=0;index<included.length;index++){
      guard(id);const file=included[index],cacheKey=`${id}|${file.id}|${file.size}|${file.uploadedAt}`;
      message(`원문 검색 준비 · ${index+1}/${included.length}개 문서 · ${file.name}`);
      try{
        let saved=filesCache.get(cacheKey);
        if(!saved){const original=await window.ReqlyFiles.original(file.id);guard(id);const extracted=await window.ReqlyPortal.extractFile(original,{onProgress:()=>guard(id)});guard(id);saved=core.units(extracted.text,{kind:file.kind,assetId:file.id,filename:file.name});filesCache.set(cacheKey,saved);}
        if(!saved.length)failures.push(file.name);else units.push(...saved);
      }catch(error){guard(id);failures.push(file.name);}
    }
    for(const reference of references)if(reference.text&&!included.some(file=>file.id===reference.assetId))units.push(...core.units(reference.text,{kind:'reference',filename:reference.name,assetId:reference.assetId||`reference-${reference.name}`}));
    const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({primary:primary?.id,units,failures})));
    const signature=[...new Uint8Array(fingerprint)].map(value=>value.toString(16).padStart(2,'0')).join('');
    scope.textContent=`검색 범위: ${primary?`기본 RFP ‘${primary.name}’`:'등록된 요구사항'} · 관련자료 · 요구사항${failures.length?` / 원문을 읽지 못한 자료: ${failures.join(', ')} (해당 자료를 제외한 답변)` : ''}`;
    return{units,signature,failures};
  }
  function show(answer,question,label,cached=false){
    result.replaceChildren();result.append(node('p',question,'qa-question'));
    const titles={answered:'근거가 확인된 답변',uncertain:'원문 추가 확인이 필요합니다',conflict:'서로 다른 조건이 확인되었습니다'};
    result.append(node('h3',titles[answer.status]||titles.uncertain));
    result.append(node('p',`${label}${cached?' · 이전 답변 재사용 · 추가 AI 호출 없음':''}`,'qa-model'));
    if(!answer.claims.length)result.append(node('p','검색된 원문에서 답을 뒷받침하는 근거를 확인하지 못했습니다. 다른 표현으로 질문하거나 아래의 추가 검색을 이용해 주세요.'));
    answer.claims.forEach((claim,index)=>{
      const card=node('article',undefined,'qa-claim');card.append(node('p',claim.text));
      const heading=node('h4',`근거 ${index+1}`);card.append(heading);
      claim.evidence.forEach(evidence=>{
        const location=[evidence.filename,evidence.page?`${evidence.page}페이지`:evidence.sheet?`${evidence.sheet} 시트`:evidence.location||'본문',evidence.kind==='requirement'?`요구사항: ${evidence.title}`:''].filter(Boolean).join(' · ');
        card.append(node('p',location,'qa-citation-location'),node('blockquote',evidence.quote));
        if(evidence.requirementKey){const open=node('button','해당 요구사항 열기','pages-action');open.type='button';open.onclick=()=>{modal.classList.remove('open');window.ReqlyApp.openRequirement(evidence.requirementKey);};card.append(open);}
      });result.append(card);
    });
    if(answer.followUp)result.append(node('p',`추가 확인할 점: ${answer.followUp}`,'qa-follow-up'));
    modal.querySelector('[data-qa-expand]').hidden=answer.status==='answered';
  }
  async function ask(expand=false){
    const question=input.value.trim();if(busy||!question)return;if(pendingRecord){message('이전 답변이 아직 저장되지 않았습니다. 먼저 히스토리 저장을 다시 시도해 주세요.');return;}
    const id=project;if(id!==window.ReqlyApp.projectId){message('프로젝트가 변경되었습니다. 검색창에서 다시 질문해 주세요.');return;}
    busy=true;stopped=false;controls();message('프로젝트에서 관련 근거를 찾고 있습니다.');
    try{
      const corpus=await collect(id);guard(id);
      const contextQuestion=question===previousQuestion?previousContext:/^(그럼|그러면|그것|그\s|이\s*경우|해당|그때|앞서|나머지)/.test(question)?previousQuestion:'';
      const cacheKey=`${id}|${corpus.signature}|${core.normalized(question)}|${core.normalized(contextQuestion)}`;
      const sharedHistory=(await records(id)).find(record=>record.signature===corpus.signature&&core.normalized(record.question)===core.normalized(question)&&core.normalized(record.contextQuestion)===core.normalized(contextQuestion));guard(id);
      if(!expand&&(answers.has(cacheKey)||sharedHistory)){const cached=answers.get(cacheKey)||sharedHistory;show(cached.answer,question,cached.model,true);previousQuestion=question;previousContext=contextQuestion;message('현재 자료에 대한 이전 답변을 다시 표시했습니다.');return;}
      let queries=[];const info=await window.ReqlyPersistentAI.getConnectionInfo();guard(id);
      if(expand){if(!info.connected)throw new Error('AI 연결 설정에서 API 키를 연결해 주세요.');message(`${info.label}로 다른 검색 표현을 찾고 있습니다. (추가 AI 요청)`);queries=(await window.ReqlyPersistentAI.generate('projectQuery',{question,previousQuestion:contextQuestion})).queries;guard(id);}
      const found=core.retrieve(corpus.units,`${question}${contextQuestion?`\n이전 질문: ${contextQuestion}`:''}`,queries,expand?{maxChars:12000,maxUnits:12}:{});
      if(!found.units.length){const answer={status:'uncertain',claims:[],followUp:''};show(answer,question,'원문 검색 결과');await persist(historyRecord(answer,question,'원문 검색 · AI 호출 없음',corpus.signature,contextQuestion),id);return;}
      if(!info.connected)throw new Error('AI 연결 설정에서 API 키를 연결해 주세요.');
      message(`${info.label}가 관련 근거 ${found.units.length}개로 답변하고 있습니다.`);
      const response=await window.ReqlyPersistentAI.generate('projectAnswer',{question,previousQuestion:contextQuestion,sources:found.units.map(unit=>({sourceId:unit.sourceId,filename:unit.filename,page:unit.page,sheet:unit.sheet,title:unit.title||'',text:unit.text}))});guard(id);
      const answer=core.validate(response,found.units);if(corpus.failures.length)answer.status='uncertain';
      answers.set(cacheKey,{answer,model:info.label});if(answers.size>20)answers.delete(answers.keys().next().value);
      show(answer,question,info.label);previousQuestion=question;previousContext=contextQuestion;message(answer.rejected?'원문으로 검증되지 않은 답변은 제외했습니다.':'답변과 원문 근거를 함께 확인해 주세요.');
      await persist(historyRecord(answer,question,info.label,corpus.signature,contextQuestion),id);
    }catch(error){message(error.message);}finally{busy=false;controls();}
  }
  function open(question=''){
    const id=window.ReqlyApp.projectId;if(busy&&id!==project){stopped=true;return;}
    if(project!==id){project=id;previousQuestion='';previousContext='';pendingRecord=null;selectedHistory.clear();historyLimit=8;result.replaceChildren();scope.textContent='';message('프로젝트 문서를 근거로 답합니다.');}
    if(question)input.value=question;renderHistory();controls();modal.classList.add('open');if(!busy)input.focus();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    modal=node('div',undefined,'pages-modal');modal.innerHTML=`<section class="pages-dialog project-qa-dialog" role="dialog" aria-modal="true" aria-label="프로젝트 AI 질문"><header><div><h2>프로젝트 AI 질문</h2><p>관련 원문을 찾아 답하고 근거를 함께 보여드립니다.</p></div><button type="button" class="pages-close" aria-label="프로젝트 AI 질문 닫기">×</button></header><div class="pages-body"><details class="qa-history" open><summary>질의응답 히스토리 <span data-qa-history-count></span></summary><input data-qa-history-search type="search" placeholder="저장된 질문·답변 검색" aria-label="질의응답 히스토리 검색"><div data-qa-history-list></div><button class="pages-action" type="button" data-qa-history-more hidden>더 보기</button></details><form data-qa-form><label class="pages-field"><span>이 프로젝트에 궁금한 점</span><textarea rows="2" maxlength="1500" data-qa-question placeholder="예: 인력 프로필은 전원 제출인가요, PL급만 제출인가요?"></textarea></label><div class="qa-actions"><button class="pages-action primary" type="submit" data-qa-ask>근거 찾아 답변</button><button class="pages-action" type="button" data-qa-settings>AI 연결 설정</button><button class="pages-action" type="button" data-qa-stop hidden>중단 요청</button></div></form><p data-qa-scope class="qa-scope"></p><p role="status" data-qa-status></p><button class="pages-action" type="button" data-qa-save hidden>히스토리 저장 다시 시도</button><div data-qa-result></div><button class="pages-action" type="button" data-qa-expand hidden>AI로 검색어를 넓혀 다시 찾기 · 추가 요청</button><p class="qa-cost-note">새 질문에 답변을 생성할 때 질문한 사람의 AI 연결을 사용합니다. 저장된 히스토리는 AI 연결 없이 함께 읽을 수 있습니다.</p></div></section>`;document.body.append(modal);
    input=modal.querySelector('[data-qa-question]');status=modal.querySelector('[data-qa-status]');scope=modal.querySelector('[data-qa-scope]');result=modal.querySelector('[data-qa-result]');
    const tools=node('div',undefined,'qa-visibility-tools');tools.innerHTML='<span data-qa-selected>0개 선택</span><button type="button" class="pages-action" data-qa-private disabled>나만 보기</button><button type="button" class="pages-action" data-qa-share disabled>프로젝트 공유</button>';modal.querySelector('[data-qa-history-list]').before(tools);
    const note=node('p','새 답변은 나만 보기로 저장됩니다. 나만 보기는 현재 브라우저 기준이며, 프로젝트 공유 답변은 URL과 프로젝트 비밀번호로 접속한 분들이 함께 읽습니다.','qa-model');tools.before(note);
    modal.querySelector('[data-qa-private]').onclick=()=>setVisibility(false);modal.querySelector('[data-qa-share]').onclick=()=>setVisibility(true);
    modal.querySelector('[data-qa-form]').onsubmit=event=>{event.preventDefault();ask();};
    modal.querySelector('[data-qa-expand]').onclick=()=>ask(true);
    modal.querySelector('[data-qa-save]').onclick=async()=>{if(busy||!pendingRecord)return;busy=true;controls();try{await persist(pendingRecord,project);}finally{busy=false;controls();}};
    modal.querySelector('[data-qa-history-search]').oninput=()=>{historyLimit=8;renderHistory();};modal.querySelector('[data-qa-history-more]').onclick=()=>{historyLimit+=8;renderHistory();};
    modal.querySelector('[data-qa-stop]').onclick=()=>{stopped=true;message('현재 응답이 도착해도 적용하지 않고 중단합니다.');};
    modal.querySelector('[data-qa-settings]').onclick=()=>{modal.classList.remove('open');document.getElementById('aiSettingsButton').click();};
    modal.onclick=event=>{if(event.target===modal||event.target.closest('.pages-close')){if(busy)stopped=true;modal.classList.remove('open');}};
    const search=document.getElementById('searchInput'),button=node('button','AI 질문','search-ai-button');button.type='button';button.title='입력한 질문을 프로젝트 원문에서 찾아 답변 (Ctrl+Enter)';
    const launch=()=>{const question=search.value;open(question);if(question.trim()){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));ask();}};
    button.onclick=event=>{event.preventDefault();launch();};search.closest('.search-box').append(button);
    search.placeholder='고유번호·명칭 검색 / 질문은 AI 질문';search.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();launch();}});
    window.addEventListener('reqly-shared-update',()=>{if(modal.classList.contains('open')&&project===window.ReqlyApp.projectId)renderHistory();});
  });
})();
