/* Reqly GitHub Pages runtime: browser-only storage and document parsing. */
(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const DB_NAME = 'reqly-pages-v1';
  const STORE = 'projects';
  const ACTIVE_KEY = 'reqly-active-project';
  const HELPER_URL = 'http://127.0.0.1:8766';
  const MAX_PROJECTS = 10;
  let database;
  let saveTimer;
  let currentProject = null;
  let helperToken = sessionStorage.getItem('reqly-helper-token') || '';

  const now = () => new Date().toISOString();
  const uid = () => `project-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const parser = window.ReqlyDocumentParser;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function openDatabase() {
    if (database) return Promise.resolve(database);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => { database = request.result; resolve(database); };
      request.onerror = () => reject(request.error);
    });
  }

  async function dbAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbGet(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(value);
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || new Error('프로젝트를 저장하지 못했습니다.'));
      transaction.onabort = () => reject(transaction.error || new Error('프로젝트 저장이 취소되었습니다.'));
    });
  }

  async function dbDelete(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  function emptyWorkspace(id) {
    return { projectId: id, document: null, references: [], requirements: [] };
  }

  async function newProject(name = '새 RFP 프로젝트') {
    const projects = await dbAll();
    if (projects.length >= MAX_PROJECTS) throw new Error(`프로젝트는 이 브라우저에 최대 ${MAX_PROJECTS}개까지 만들 수 있습니다.`);
    const id = uid();
    const project = { id, name: clean(name) || '새 RFP 프로젝트', createdAt: now(), updatedAt: now(), workspace: emptyWorkspace(id) };
    await dbPut(project);
    return project;
  }

  function scheduleSave(workspace) {
    clearTimeout(saveTimer);
    const snapshot = typeof structuredClone === 'function' ? structuredClone(workspace) : JSON.parse(JSON.stringify(workspace));
    saveTimer = setTimeout(async () => {
      if (!currentProject || snapshot.projectId !== currentProject.id) return;
      const name = currentProject.name === '새 RFP 프로젝트' && snapshot.document?.name
        ? snapshot.document.name.replace(/\.[^.]+$/, '') : currentProject.name;
      currentProject = { ...currentProject, name, updatedAt: now(), workspace: snapshot };
      if (window.ReqlyPortal?.project) window.ReqlyPortal.project.name = name;
      await dbPut(currentProject);
      const label = document.getElementById('sidebarProject');
      if (label) label.textContent = name;
      window.ReqlyDesign?.sync();
    }, 180);
  }

  function download(name, blob) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function installUiStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .pages-modal{position:fixed;inset:0;z-index:2000;display:none;place-items:center;padding:24px;background:rgba(15,23,42,.56);backdrop-filter:blur(5px)}
      .pages-modal.open{display:grid}.pages-dialog{width:min(680px,100%);max-height:min(760px,92vh);overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 90px rgba(15,23,42,.28)}
      .pages-dialog>header{display:flex;align-items:flex-start;justify-content:space-between;padding:24px 26px 18px;border-bottom:1px solid #e7eceb}.pages-dialog h2{margin:0 0 6px;font-size:22px}.pages-dialog header p{margin:0;color:#64748b}
      .pages-close{border:0;background:#f1f5f4;border-radius:10px;width:38px;height:38px;font-size:22px;cursor:pointer}.pages-body{padding:22px 26px 26px}.pages-note{padding:14px 16px;border-radius:12px;background:#effaf7;color:#315c54;line-height:1.55;margin:0 0 18px}
      .project-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:15px 0;border-bottom:1px solid #edf1f0}.project-row strong{display:block;font-size:16px}.project-row small{color:#718096}.project-actions{display:flex;gap:7px;align-items:center}.project-actions button,.pages-action{border:1px solid #d7e0de;background:#fff;border-radius:9px;padding:9px 12px;cursor:pointer;font-weight:700;text-decoration:none;color:inherit;display:inline-flex;align-items:center}.project-actions button.primary,.pages-action.primary{background:#0f8275;color:#fff;border-color:#0f8275}.project-actions button.danger{color:#c2414b}
      .pages-footer-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.pages-field{display:grid;gap:7px;margin:16px 0}.pages-field span{font-weight:750}.pages-field input,.pages-field select{width:100%;padding:12px 13px;border:1px solid #ccd8d5;border-radius:10px;font:inherit}.helper-status{display:flex;align-items:center;gap:9px;margin-bottom:15px;font-weight:750}.helper-dot{width:10px;height:10px;border-radius:50%;background:#94a3b8}.helper-dot.on{background:#16a36a;box-shadow:0 0 0 5px #dff7ec}.helper-grid{display:grid;grid-template-columns:1fr auto;gap:9px}.privacy-warning{background:#fff7e8;color:#7a4b00;padding:13px 15px;border-radius:11px;line-height:1.55}.pages-hidden-input{display:none}
      @media(max-width:680px){.pages-dialog{border-radius:16px}.pages-body{padding:18px}.helper-grid{grid-template-columns:1fr}.project-row{grid-template-columns:1fr}.project-actions{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function modalShell(id, title, intro, body) {
    const modal = document.createElement('div');
    modal.className = 'pages-modal'; modal.id = id;
    modal.innerHTML = `<section class="pages-dialog" role="dialog" aria-modal="true"><header><div><h2>${title}</h2><p>${intro}</p></div><button class="pages-close" type="button" aria-label="닫기">×</button></header><div class="pages-body">${body}</div></section>`;
    modal.addEventListener('click', event => { if (event.target.closest('.pages-close')) modal.classList.remove('open'); });
    document.body.appendChild(modal);
    return modal;
  }

  async function renderProjects(modal) {
    const projects = (await dbAll()).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const list = modal.querySelector('[data-project-list]');
    list.innerHTML = projects.map(project => `<div class="project-row"><div><strong>${escapeHtml(project.name)}</strong><small>${project.id === currentProject?.id ? '현재 열림 · ' : ''}${new Date(project.updatedAt).toLocaleString('ko-KR')} · 요구사항 ${project.workspace?.requirements?.length || 0}개</small></div><div class="project-actions"><button class="primary" data-open-project="${project.id}" ${project.id === currentProject?.id ? 'disabled' : ''}>열기</button><button data-export-project="${project.id}">백업</button><button class="danger" data-delete-project="${project.id}" ${projects.length === 1 ? 'disabled' : ''}>삭제</button></div></div>`).join('');
    modal.querySelector('[data-new-project]').disabled = projects.length >= MAX_PROJECTS;
    modal.querySelector('[data-project-limit]').textContent = `${projects.length} / ${MAX_PROJECTS}개 사용 중`;
  }

  function installProjectUi() {
    const modal = modalShell('projectModal', '프로젝트 관리', `프로젝트는 이 브라우저에 최대 ${MAX_PROJECTS}개까지 저장됩니다.`, `
      <p class="pages-note">브라우저 데이터 삭제 또는 기기 변경에 대비해 중요한 프로젝트는 JSON 백업을 내려받아 보관하세요. 다른 브라우저와 자동 동기화되지는 않습니다.</p>
      <div data-project-list></div><div class="pages-footer-actions"><button class="pages-action primary" data-new-project>새 프로젝트</button><button class="pages-action" data-import-project>백업 가져오기</button><span data-project-limit></span></div><input class="pages-hidden-input" data-import-input type="file" accept=".json,application/json">
    `);
    const open = async () => { await renderProjects(modal); modal.classList.add('open'); };
    document.getElementById('projectButton')?.addEventListener('click', open);
    document.getElementById('projectManagerButton')?.addEventListener('click', open);
    modal.addEventListener('click', async event => {
      const openButton = event.target.closest('[data-open-project]');
      const exportButton = event.target.closest('[data-export-project]');
      const deleteButton = event.target.closest('[data-delete-project]');
      if (openButton) {
        if(window.ReqlyApp?.confirmLeave&&!(await window.ReqlyApp.confirmLeave()))return;
        localStorage.setItem(ACTIVE_KEY, openButton.dataset.openProject);window.ReqlyApp?.allowNavigation?.();location.reload();
      }
      if (exportButton) {
        const project = await dbGet(exportButton.dataset.exportProject);
        download(`${project.name.replace(/[\\/:*?"<>|]/g,'_')}_Muhammad백업.json`, new Blob([JSON.stringify({format:'reqly-pages-project',version:1,project}, null, 2)], {type:'application/json'}));
      }
      if (deleteButton) {
        const project = await dbGet(deleteButton.dataset.deleteProject);
        if (!(await(window.ReqlyDesign?.confirm('프로젝트 삭제',`‘${project.name}’ 프로젝트를 이 브라우저에서 삭제할까요?\n백업하지 않았다면 복구할 수 없습니다.`)??confirm(`‘${project.name}’ 프로젝트를 이 브라우저에서 삭제할까요?\n백업하지 않았다면 복구할 수 없습니다.`)))) return;
        await dbDelete(project.id);
        if (project.id === currentProject?.id) {
          const remaining = await dbAll();
          localStorage.setItem(ACTIVE_KEY, remaining[0].id);
          location.reload();
          return;
        }
        await renderProjects(modal);
      }
      if (event.target.closest('[data-new-project]')) {
        if(window.ReqlyApp?.confirmLeave&&!(await window.ReqlyApp.confirmLeave()))return;
        const name = await(window.ReqlyDesign?.prompt('새 프로젝트','프로젝트 이름','새 RFP 프로젝트')??prompt('새 프로젝트 이름을 입력하세요.', '새 RFP 프로젝트'));
        if (name === null) return;
        const project = await newProject(name); localStorage.setItem(ACTIVE_KEY, project.id);window.ReqlyApp?.allowNavigation?.();location.reload();
      }
      if (event.target.closest('[data-import-project]')) modal.querySelector('[data-import-input]').click();
    });
    modal.querySelector('[data-import-input]').addEventListener('change', async event => {
      try {
        const payload = JSON.parse(await event.target.files[0].text());
        if (payload.format !== 'reqly-pages-project' || !payload.project?.workspace) throw new Error('Muhammad 프로젝트 백업 파일이 아닙니다.');
        const projects = await dbAll();
        if (projects.length >= MAX_PROJECTS) throw new Error(`프로젝트 ${MAX_PROJECTS}개를 사용 중입니다. 하나를 삭제한 뒤 가져오세요.`);
        const id = uid();
        const imported = {...payload.project,id,name:`${payload.project.name} (가져옴)`,updatedAt:now(),workspace:{...payload.project.workspace,projectId:id}};
        await dbPut(imported); localStorage.setItem(ACTIVE_KEY,id); location.reload();
      } catch (error) { if(window.ReqlyDesign)await window.ReqlyDesign.notice('백업을 가져오지 못했습니다',error.message);else alert(error.message); }
    });
  }

  async function helperFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (helperToken) headers.set('X-Reqly-Token', helperToken);
    const requestOptions = {...options, headers};
    try { requestOptions.targetAddressSpace = 'loopback'; } catch (_) {}
    try { return await nativeFetch(`${HELPER_URL}${path}`, requestOptions); }
    catch (_) { throw new Error('AI 도우미에 연결할 수 없습니다. 다운로드한 도우미를 실행하고, ‘AI 연결’에서 연결 상태와 브라우저의 로컬 네트워크 접근 허용 여부를 확인해 주세요.'); }
  }

  async function helperJson(path, options = {}) {
    const response = await helperFetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `로컬 보안 도우미 오류 (${response.status})`);
    return payload;
  }

  function installAiUi() {
    const modal = modalShell('aiModal', 'AI 도우미 연결', 'AI와 모델을 선택해 주세요.', `
      <div class="helper-status"><i class="helper-dot" data-helper-dot></i><span data-helper-status>연결 확인 전</span></div>
      <p class="privacy-warning">사용할 AI와 모델을 선택하고 본인의 API 키를 연결해 주세요.</p>
      <p class="pages-note">처음 사용하는 PC라면 <a class="pages-action" href="./local-helper/Reqly-AI-도우미.zip" download>AI 도우미 다운로드</a> 후 압축을 풀고 <b>Reqly-AI-도우미.bat</b>를 실행하세요.</p>
      <label class="pages-field"><span>도우미 창에 표시된 6자리 연결 번호</span><div class="helper-grid"><input data-pair-code inputmode="numeric" maxlength="6" placeholder="예: 123456"><button class="pages-action primary" data-pair>연결</button></div></label>
      <label class="pages-field"><span>사용할 AI</span><select data-provider><option value="gemini">Google Gemini</option><option value="openai">OpenAI GPT</option></select></label>
      <label class="pages-field"><span>사용 모델</span><select data-model></select></label>
      <p class="pages-note" data-provider-note></p>
      <label class="pages-field"><span data-key-label>Gemini API 키</span><input data-api-key type="password" autocomplete="off" placeholder="Google AI Studio에서 발급받은 API 키"></label>
      <p class="pages-note" data-saved-key-note>선택한 AI의 키를 입력해 저장해 주세요.</p>
      <div class="pages-footer-actions"><button class="pages-action primary" data-save-key>암호화 저장 / 적용</button><button class="pages-action" data-delete-key>선택한 AI 키 삭제</button><button class="pages-action" data-test-helper>상태 확인</button></div>
    `);
    const providers = {
      gemini: {label:'Gemini',models:[['gemini-3.1-flash-lite','Gemini 3.1 Flash-Lite (기본·절약형)'],['gemini-3.8-flash','Gemini 3.8 Flash (상세 해설용)']]},
      openai: {label:'GPT',models:[['gpt-5-mini','gpt-5-mini (절약형)'],['gpt-5','gpt-5']]}
    };
    const providerSelect = modal.querySelector('[data-provider]');
    const modelSelect = modal.querySelector('[data-model]');
    const keyInput = modal.querySelector('[data-api-key]');
    let lastHealth = null;
    let selectionDirty = false;
    const renderSelection = model => {
      const provider = providerSelect.value;
      const info = providers[provider];
      modelSelect.innerHTML = info.models.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
      if(info.models.some(([value])=>value===model)) modelSelect.value=model;
      modal.querySelector('[data-key-label]').textContent = `${provider === 'gemini' ? 'Gemini' : 'OpenAI'} API 키`;
      keyInput.placeholder = provider === 'gemini' ? 'Google AI Studio에서 발급받은 API 키' : 'sk-로 시작하는 OpenAI API 키';
      modal.querySelector('[data-provider-note]').innerHTML = provider === 'gemini'
        ? '무료 한도를 지원하는 모델입니다. 실제 무료 여부와 한도는 Google 프로젝트의 결제 설정에 따릅니다. 무료 이용 시 입력 내용이 Google 제품 개선에 사용될 수 있습니다. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Gemini API 키 발급</a> · <a href="https://ai.google.dev/gemini-api/docs/pricing?hl=ko" target="_blank" rel="noopener noreferrer">요금 확인</a>'
        : 'GPT API는 ChatGPT 구독과 별도로 과금됩니다. 기존 GPT 키는 Gemini 키와 따로 보관합니다.';
      modal.querySelector('[data-saved-key-note]').textContent = lastHealth?.savedKeys?.[provider]
        ? `${info.label} 키가 이 PC에 암호화되어 있습니다. 키를 비워 두고 ‘암호화 저장 / 적용’을 누르면 기존 키로 이 AI와 모델을 사용합니다.`
        : `${info.label} 키를 입력하고 ‘암호화 저장 / 적용’을 눌러 주세요. 키를 저장할 때 AI를 호출하지는 않습니다.`;
    };
    renderSelection();
    const status = modal.querySelector('[data-helper-status]');
    const dot = modal.querySelector('[data-helper-dot]');
    const setStatus = (text, on=false) => { status.textContent=text; dot.classList.toggle('on',on); };
    const test = async () => {
      try {
        const data=await helperJson('/health');
        lastHealth=data;
        const updated=data.providerVersion===1 && data.explanationVersion===2;
        if(!selectionDirty && providers[data.provider]) providerSelect.value=data.provider;
        renderSelection(selectionDirty ? modelSelect.value : data.model);
        const label=providers[data.provider]?.label || 'AI';
        setStatus(!updated ? 'Gemini 지원 도우미 업데이트 필요 · 최신 ZIP을 받아 다시 실행해 주세요.' : !data.paired ? '도우미 실행 중 · 아래 6자리 코드로 연결해 주세요.' : !data.hasKey ? `${label} API 키가 없습니다. 아래에서 AI를 선택하고 저장해 주세요.` : `현재 사용 AI: ${label} · ${data.model} · 암호화된 키 저장됨`, Boolean(updated && data.paired && data.hasKey));
      }
      catch (_) { setStatus('도우미가 꺼져 있거나 브라우저의 로컬 네트워크 권한이 필요합니다.'); }
    };
    providerSelect.addEventListener('change', () => {
      selectionDirty=true;
      keyInput.value='';
      renderSelection(lastHealth?.models?.[providerSelect.value]);
      setStatus('AI와 모델을 선택한 뒤 ‘암호화 저장 / 적용’을 눌러 주세요.');
    });
    modelSelect.addEventListener('change', () => { selectionDirty=true; setStatus('새 모델은 ‘암호화 저장 / 적용’을 누른 뒤 사용됩니다.'); });
    document.getElementById('aiSettingsButton')?.addEventListener('click', () => { modal.classList.add('open'); test(); });
    modal.querySelector('[data-test-helper]').addEventListener('click', test);
    modal.querySelector('[data-pair]').addEventListener('click', async () => {
      try {
        const code=modal.querySelector('[data-pair-code]').value.trim();
        const data=await helperJson('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
        helperToken=data.token; sessionStorage.setItem('reqly-helper-token',helperToken); await test();
      } catch(error) { setStatus(error.message); }
    });
    modal.querySelector('[data-save-key]').addEventListener('click', async () => {
      try {
        const apiKey=keyInput.value.trim(); const model=modelSelect.value; const provider=providerSelect.value;
        const data=await helperJson('/health');
        if(data.providerVersion!==1) throw new Error('Gemini 지원 도우미가 필요합니다. 최신 ZIP을 받아 기존 도우미를 종료하고 다시 실행해 주세요.');
        if(!apiKey && !data.savedKeys?.[provider]) throw new Error(`${providers[provider].label} API 키를 입력하세요.`);
        await helperJson('/key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey,model,provider})});
        keyInput.value=''; selectionDirty=false; await test();
      } catch(error) { setStatus(error.message); }
    });
    modal.querySelector('[data-delete-key]').addEventListener('click', async () => {
      const provider=providerSelect.value;
      if(!confirm(`이 PC에 저장된 ${providers[provider].label} API 키를 삭제할까요? 다른 AI의 키는 유지됩니다.`)) return;
      try {
        const data=await helperJson('/health');
        if(data.providerVersion!==1) throw new Error('최신 도우미를 다운로드해 다시 실행한 뒤 키를 삭제해 주세요.');
        await helperJson(`/key?provider=${provider}`,{method:'DELETE'}); keyInput.value=''; await test();
      } catch(error){ setStatus(error.message); }
    });
  }

  const HEADER_ALIASES = {
    id:['요구사항id','요구사항번호','요구사항고유번호','요건id','요건번호','항목번호','관리번호','식별번호','고유번호','reqid','reqno','requirementid','requirementno','itemid','id','no','번호'],
    category:['요구사항분류','요구사항유형','요건분류','요건유형','분류','유형','구분','category','type'],
    name:['요구사항명','요구사항제목','요건명','항목명','명칭','제목','requirementname','requirementtitle','name','title'],
    description:['상세설명','상세내용','요구사항내용','요건내용','세부내용','세부요건','요구내용','설명','description','detail','details','내용'],
    priority:['우선순위','중요도','priority'], status:['상태','검토상태','status'], acceptance:['수용여부','수용','acceptance'],
    applicationPlan:['적용방안','조치방안','applicationplan'], owner:['담당자','담당자소속','담당','owner'], changeHistory:['변경이력','변경사항','changehistory'], completion:['완료여부','완료상태','completion'],
    level1:['lvl1대분류','대분류','1차분류'],level2:['lvl2중분류','중분류','2차분류'],level3:['lvl3소분류','소분류','3차분류'],level4:['lvl4요구사항유형','4차분류']
  };
  const hkey = value => clean(value).toLowerCase().replace(/[\s_\-./()]/g,'');
  function matchHeader(value){const key=hkey(value);if(!key)return null;for(const [field,aliases] of Object.entries(HEADER_ALIASES)){if(aliases.includes(key))return field;}let best=null;for(const [field,aliases] of Object.entries(HEADER_ALIASES)){for(const alias of aliases){if(alias.length>=3&&(key.includes(alias)||alias.includes(key))&&(!best||alias.length>best.length))best={field,length:alias.length};}}return best?.field||null;}

  const OBLIGATION_RE=/(하여야\s*한다|해야\s*한다|하여야\s*하며|해야\s*하며|필수|반드시|제공한다|제공해야|구축한다|구축해야|지원한다|지원해야|준수한다|준수해야|보장한다|보장해야|가능해야|관리한다|관리해야|처리한다|처리해야|수행한다|수행해야|적용한다|적용해야|한다\.?$)/i;
  const SOFT_RE=/(할\s*것|해야\s*함|하여야\s*함|필요(?:하다|함|하며)|요구(?:된다|함|한다)|(?:제공|지원|구현|적용|정의|확보|유지|연계|관리|처리|수행|준수|보장|구성|포함|제출|설치|운영|저장|전송|표시|검증|기록)(?:한다|함|해야|하여야|할\s*것|되어야)|(?:가능|허용|금지|제한)(?:해야|하여야|하다|함|된다))/i;
  const CATEGORY_RULES=[['보안',/(보안|인증|권한|암호|취약|접근통제|개인정보|로그인)/i],['인터페이스',/(인터페이스|연계|API|통신|프로토콜|메시지)/i],['데이터',/(데이터|DB|데이터베이스|백업|이관|저장|메타데이터)/i],['성능',/(성능|응답시간|처리량|동시|TPS|가용성)/i],['품질',/(품질|테스트|검증|결함|감리|표준)/i],['운영',/(운영|모니터링|장애|유지보수|교육|매뉴얼)/i],['제약사항',/(제약|준수|법률|법령|규정|라이선스|환경)/i],['시스템장비',/(장비|서버|스토리지|네트워크|하드웨어|단말)/i],['기능',/.*/]];
  function classify(text){
    const explicit=[['프로젝트관리',/프로젝트\s*관리/],['프로젝트지원',/프로젝트\s*지원/],['아키텍처',/아키텍처/],['테스트',/^테스트\s*(?:요구사항|요건)?$/]];
    return explicit.find(([,re])=>re.test(text))?.[0]||CATEGORY_RULES.find(([,re])=>re.test(text))?.[0]||'기타';
  }
  function priority(text){return /(필수|반드시|중요|핵심|긴급)/i.test(text)?'높음':/(선택|권고|가능하면)/i.test(text)?'낮음':'보통';}
  function titleFrom(text,id=''){return parser.titleFrom(text,id);}
  function requirement(base,index){const text=parser.multiline(base.description||base.text);const id=clean(base.id);const category=clean(base.category);return {key:`req-${index}`,sourceOrder:index,id,name:clean(base.name)||titleFrom(text,id),description:text,category:category?classify(category):classify(`${base.name||''} ${text} ${id}`),priority:['높음','보통','낮음'].includes(base.priority)?base.priority:priority(text),status:['검토 전','검토 중','확정'].includes(base.status)?base.status:'검토 전',confidence:id?90:65,source:base.source||'브라우저 분석',section:base.section||'본문',basis:base.basis||(id?'명시 ID':'문장 분석'),tags:[],acceptance:base.acceptance||'미검토',applicationPlan:base.applicationPlan||'',owner:base.owner||'',changeHistory:base.changeHistory||'',completion:base.completion||'미완료',easyExplanation:'',explanationSources:[],questions:[],manualGlossary:[],flag:''};}

  function buildTextRequirements(text){
    const candidates=parser.buildTextRequirements(text,{obligation:OBLIGATION_RE,soft:SOFT_RE});
    const result=[],seen=new Map();for(const item of candidates){const req=requirement(item,result.length+1);if(req.id&&seen.has(req.id.toLowerCase())){const idx=seen.get(req.id.toLowerCase());if(req.description.length>result[idx].description.length){req.key=result[idx].key;req.sourceOrder=result[idx].sourceOrder;result[idx]=req;}continue;}if(req.id)seen.set(req.id.toLowerCase(),result.length);result.push(req);}return result.slice(0,5000);
  }

  async function extractExcel(file){
    if(!window.XLSX)await window.ReqlyParserLibraries.load('XLSX');
    if(!window.XLSX)throw new Error('Excel 분석 도구를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.');
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const structured=[];const fallback=[],fullText=[];
    for(const sheetName of workbook.SheetNames){const rows=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:'',raw:false});let headerIndex=-1,map={};for(let i=0;i<Math.min(rows.length,80);i++){const found={};rows[i].forEach((cell,col)=>{const field=matchHeader(cell);if(field&&!Object.hasOwn(found,field))found[field]=col;});if((found.name!==undefined||found.description!==undefined)&&(found.id!==undefined||(found.name!==undefined&&found.description!==undefined))){headerIndex=i;map=found;break;}}
      fullText.push(`[[SHEET:${sheetName}]]`,...rows.map((row,i)=>`[[ROW:${i+1}]]\n${row.map(value=>String(value??'')).join(' | ')}`));
      if(headerIndex>=0){const carried={level1:'',level2:'',level3:'',level4:'',category:''};for(let i=headerIndex+1;i<rows.length;i++){const values={};for(const [field,col] of Object.entries(map))values[field]=['description','applicationPlan','changeHistory'].includes(field)?parser.multiline(rows[i][col]):clean(rows[i][col]);for(const field of Object.keys(carried)){if(values[field])carried[field]=values[field];else values[field]=carried[field];}if(!values.name&&!values.description)continue;structured.push({...values,description:values.description||values.name,section:[values.level1,values.level2,values.level3,values.level4].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' > ')||sheetName,source:`${sheetName} 시트 · ${i+1}행`});}}
      else {for(let i=0;i<rows.length;i++){const cells=rows[i].map(clean).filter(Boolean);if(cells.length)fallback.push(`[[SHEET:${sheetName}]]\n[[ROW:${i+1}]]\n${cells.join(' | ')}`);}}
    }
    const source=structured.length?structured.map((row,i)=>requirement(row,i+1)):buildTextRequirements(fallback.join('\n'));
    const result=[],seen=new Map();for(const req of source){if(req.id&&seen.has(req.id.toLowerCase())){const idx=seen.get(req.id.toLowerCase());if(req.description.length>result[idx].description.length){req.key=result[idx].key;req.sourceOrder=result[idx].sourceOrder;result[idx]=req;}continue;}if(req.id)seen.set(req.id.toLowerCase(),result.length);result.push(req);}return {text:fullText.join('\n'),requirements:result,pages:workbook.SheetNames.length};
  }

  async function extractZipXml(file,kind){
    if(!window.JSZip)await window.ReqlyParserLibraries.load('JSZip');
    if(!window.JSZip)throw new Error('압축 문서 분석 도구를 불러오지 못했습니다.');const zip=await JSZip.loadAsync(await file.arrayBuffer());const lines=[];let pages=1;
    if(kind==='pptx'){const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/i.test(n)).sort((a,b)=>(Number(a.match(/\d+/)?.[0]))-(Number(b.match(/\d+/)?.[0])));pages=Math.max(1,names.length);for(let i=0;i<names.length;i++){const xml=await zip.file(names[i]).async('text');const doc=new DOMParser().parseFromString(xml,'application/xml');lines.push(`[[PAGE:${i+1}]]`,...[...doc.getElementsByTagNameNS('*','t')].map(n=>n.textContent).filter(Boolean));}}
    else {const names=Object.keys(zip.files).filter(n=>/^Contents\/section\d+\.xml$/i.test(n)).sort();pages=Math.max(1,names.length);for(const name of names){const xml=await zip.file(name).async('text');const doc=new DOMParser().parseFromString(xml,'application/xml');lines.push(...[...doc.getElementsByTagNameNS('*','t')].map(n=>n.textContent).filter(Boolean));}}
    return {text:lines.join('\n'),pages};
  }

  async function extractFile(file, {onProgress}={}){
    const ext=file.name.split('.').pop().toLowerCase();
    if(['xlsx','xlsm','xls','csv','tsv'].includes(ext))return extractExcel(file);
    if(ext==='pdf'){
      if(!window.pdfjsLib)await window.ReqlyParserLibraries.load('pdfjsLib');
      if(!window.pdfjsLib)throw new Error('PDF 분석 도구를 불러오지 못했습니다.');
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      const count=pdf.numPages, pages=[];onProgress?.({completed:0,total:count,unit:'페이지'});
      let previousLayout=null;
      try {
        for(let i=1;i<=count;i++){
          const page=await pdf.getPage(i), content=await page.getTextContent();
          const layout=parser.pdfPageText(content.items,previousLayout);
          previousLayout=layout;
          pages.push(`[[PAGE:${i}]]\n${layout.tableLayout?'[[TABLE_LAYOUT]]\n':''}${layout.text}`);
          page.cleanup();
          onProgress?.({completed:i,total:count,unit:'페이지'});
        }
      } finally {await pdf.destroy();}
      return{text:pages.join('\n'),pages:count};
    }
    if(ext==='docx'){await window.ReqlyParserLibraries.load('mammoth');if(!window.mammoth)throw new Error('Word 분석 도구를 불러오지 못했습니다.');const out=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return{text:out.value,pages:1};}
    if(ext==='pptx'||ext==='hwpx')return extractZipXml(file,ext);
    if(ext==='hwp')throw new Error('구형 HWP는 브라우저에서 직접 읽을 수 없습니다. HWPX, PDF 또는 DOCX로 저장한 뒤 올려 주세요.');
    const buffer=await file.arrayBuffer();let text;for(const encoding of ['utf-8','euc-kr']){try{text=new TextDecoder(encoding,{fatal:true}).decode(buffer);break;}catch(_){}}return{text:text||new TextDecoder().decode(buffer),pages:1};
  }

  function jsonResponse(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json;charset=utf-8'}});}

  async function aiGenerate(task,payload){
    if(window.ReqlyPersistentAI) return window.ReqlyPersistentAI.generate(task,payload);
    if(!helperToken)throw new Error('AI 보안 연결이 필요합니다. 화면 위쪽의 ‘AI 연결’에서 로컬 도우미와 연결해 주세요.');
    {
      const health = await helperJson('/health');
      if(!health.paired) throw new Error('AI 연결이 만료되었습니다. ‘AI 연결’에서 도우미의 6자리 코드를 다시 입력해 주세요.');
      if(health.providerVersion!==1 || health.explanationVersion!==2) throw new Error('AI 도우미 업데이트가 필요합니다. ‘AI 연결’에서 최신 ZIP을 받아 압축을 풀고, 기존 도우미를 종료한 뒤 새 도우미를 실행해 주세요.');
      if(!health.hasKey) throw new Error('API 키가 없습니다. ‘AI 연결’에서 사용할 AI를 선택하고 본인의 API 키를 저장해 주세요.');
    }
    return helperJson('/v1/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,...payload})});
  }

  async function handleApi(url,options){
    const path=new URL(url,location.href).pathname;
    try{
      if(path.endsWith('/api/analyze')){const file=options.body;const extracted=await extractFile(file);const requirements=extracted.requirements||buildTextRequirements(extracted.text);if(!requirements.length)throw new Error('요구사항으로 판단할 문장을 찾지 못했습니다. 표의 머리글이나 요구 문장을 확인해 주세요.');return jsonResponse({document:{name:file.name,type:file.name.split('.').pop().toUpperCase(),size:file.size,pages:extracted.pages||1,characters:extracted.text.length},requirements});}
      if(path.endsWith('/api/enrich')){const files=options.body.getAll('references');const references=[];for(const file of files){const out=await extractFile(file);references.push({name:file.name,type:file.name.split('.').pop().toUpperCase(),size:file.size,pages:out.pages||1,characters:out.text.length,text:out.text.slice(0,250000)});}return jsonResponse({references});}
      if(path.endsWith('/api/explain')) {
        const body=JSON.parse(options.body||'{}');
        const project=window.ReqlyShared?.enabled ? window.ReqlyShared.project : await dbGet(body.projectId);
        const req=body.requirement||{};
        const result=await aiGenerate('explain',{
          requirement:{id:req.id,name:req.name,category:req.category,description:req.description},
          references:(project?.workspace?.references||[]).slice(0,5).map(r=>({name:r.name,text:String(r.text||'').slice(0,8000)}))
        });
        if(!String(result.text||'').trim()) throw new Error('AI가 빈 설명을 반환했습니다. 기존 설명은 변경하지 않았습니다.');
        return jsonResponse({easyExplanation:result.text,explanationSources:result.sources||[]});
      }
      if(path.endsWith('/api/glossary')){const body=JSON.parse(options.body||'{}');try{const result=await aiGenerate('glossary',{terms:body.terms,context:String(body.context||'').slice(0,10000)});return jsonResponse({results:result.results||[]});}catch(error){if(helperToken || window.ReqlyPersistentAI)throw error;const results=[];for(const term of (body.terms||[]).slice(0,10)){try{const api=`https://ko.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*`;const data=await nativeFetch(api).then(r=>r.json());const pages=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));results.push({term,candidates:pages.map((p,i)=>({full:p.title,meaning:clean(p.extract).slice(0,650)||'설명이 없습니다.',source:'위키백과',sourceUrl:p.fullurl,score:100-i}))});}catch(_e){results.push({term,candidates:[]});}}return jsonResponse({results});}}
if(path.endsWith('/api/export-questions')){await window.ReqlyParserLibraries.load('XLSX');if(!window.XLSX)throw new Error('Excel 생성 도구를 불러오지 못했습니다.');const body=JSON.parse(options.body||'{}');const rows=[['RFP 원문 순서','요구사항 ID','요구사항 명칭','분류','관점','질의사항','답변']];for(const req of body.requirements||[])for(const q of req.questions||[])rows.push([req.sourceOrder,req.id,req.name,req.category,q.perspective,q.question,q.answer]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'질의응답');const data=XLSX.write(wb,{type:'array',bookType:'xlsx'});return new Response(data,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});}
      return jsonResponse({error:'지원하지 않는 로컬 API입니다.'},404);
    }catch(error){return jsonResponse({error:error.message||String(error)},400);}
  }

  window.fetch = function(input, options={}) {
    const url=typeof input==='string'?input:input.url;
    return /^\/api\//.test(url)||new URL(url,location.href).pathname.includes('/api/') ? handleApi(url,options) : nativeFetch(input,options);
  };

  window.ReqlyPortal = {
    extractFile,
    project:null,
    async start(){
      installUiStyles();
      if(!window.ReqlyShared?.enabled) installProjectUi();
      if(window.ReqlyPersistentAI) window.ReqlyPersistentAI.installUi(); else installAiUi();
      if(window.ReqlyShared?.enabled){
        const boot=await window.ReqlyShared.start();
        this.project={id:window.ReqlyShared.project.id,name:window.ReqlyShared.project.name};
        window.ReqlyFiles?.installUi();
        return boot;
      }
      const projects=await dbAll();let id=localStorage.getItem(ACTIVE_KEY);currentProject=projects.find(p=>p.id===id)||projects[0]||await newProject();
      localStorage.setItem(ACTIVE_KEY,currentProject.id);this.project={id:currentProject.id,name:currentProject.name};return{workspace:currentProject.workspace||emptyWorkspace(currentProject.id)};
    },
    saveWorkspace(workspace){
      if(window.ReqlyShared?.enabled) return window.ReqlyShared.saveItems(workspace.requirements);
      scheduleSave(workspace);
    },
    async saveNow(workspace){
      if(!currentProject||workspace.projectId!==currentProject.id)throw new Error('프로젝트가 변경되어 저장하지 못했습니다.');
      clearTimeout(saveTimer);
      const next={...currentProject,updatedAt:now(),workspace:structuredClone(workspace)};
      await dbPut(next);currentProject=next;
    }
  };
})();
