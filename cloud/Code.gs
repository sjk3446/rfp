/* Reqly Drive backend. The bridge calls only reqlyRpc.
 * Helpers end in _ so google.script.run cannot call them directly.
 * Deploy as owner; keep root folder private. No credentials in client config.
 */
const REQLY_SCHEMA = 1;
const REQLY_MAX_FILE = 30 * 1024 * 1024;

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Bridge');
  template.allowedOrigin = PropertiesService.getScriptProperties().getProperty('APP_ORIGIN') || '';
  template.channelNonce = /^[a-f0-9]{64}$/.test(e?.parameter?.channel || '') ? e.parameter.channel : '';
  return template.evaluate().setTitle('Muhammad 연결')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function reqlyRpc(request) {
  try {
    const actions = ['challenge', 'create', 'login', 'load', 'save', 'password', 'upload', 'download', 'removeFile', 'selectRfp', 'deleteProject', 'renameProject',
      'directoryChallenge', 'directorySetupChallenge', 'directorySetup', 'directoryLogin', 'directoryList', 'directoryOpen', 'directoryChangePassword', 'qaPublish', 'qaUnpublish', 'qaDelete'];
    if (!request || !actions.includes(request.action)) throw new Error('지원하지 않는 요청입니다.');
    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try { return { ok: true, value: dispatch_(request) }; }
    finally { lock.releaseLock(); }
  } catch (error) {
    return { ok: false, error: error.message || '처리하지 못했습니다.', code: error.reqlyCode || 'ERROR' };
  }
}

function settings_() {
  const props = PropertiesService.getScriptProperties();
  const rootId = props.getProperty('ROOT_FOLDER_ID');
  const pepper = props.getProperty('SERVER_SECRET');
  if (!rootId || !pepper) throw new Error('저장소 초기 설정이 필요합니다.');
  return { root: DriveApp.getFolderById(rootId), pepper: pepper };
}

// Owner-only entry point for the editor's function selector.
function initializeStorage() {
  const owner = Session.getEffectiveUser().getEmail();
  if (!owner || Session.getActiveUser().getEmail() !== owner) throw new Error('프로그램 소유자만 초기화할 수 있습니다.');
  setup_();
  return { ready: true };
}

// Run only from the owner's editor. A public visitor cannot claim an unset directory.
function prepareDirectorySetup() {
  const owner = Session.getEffectiveUser().getEmail();
  if (!owner || Session.getActiveUser().getEmail() !== owner) throw new Error('프로그램 소유자만 목록 관리자 설정을 준비할 수 있습니다.');
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    settings_();
    if (directoryAccess_()) fail_('DIRECTORY_CONFIGURED', '전체 목록 관리자 비밀번호가 이미 설정되어 있습니다.');
    const setupToken = random_(), expiresAt = Date.now() + 30 * 60000;
    PropertiesService.getScriptProperties().setProperty('DIRECTORY_SETUP', JSON.stringify({ hash: digest_(setupToken), expiresAt: expiresAt }));
    const url = 'https://sjk3446.github.io/rfp/#directory-setup=' + setupToken;
    console.log('목록 관리자 비밀번호 설정 (30분 이내 1회 사용): ' + url);
    return { url: url, expiresAt: expiresAt };
  } finally { lock.releaseLock(); }
}

// Internal helper, never exposed by RPC.
function setup_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ROOT_FOLDER_ID')) props.setProperty('ROOT_FOLDER_ID', DriveApp.createFolder('Reqly projects').getId());
  if (!props.getProperty('SERVER_SECRET')) props.setProperty('SERVER_SECRET', random_() + random_());
  if (!props.getProperty('APP_ORIGIN')) props.setProperty('APP_ORIGIN', 'https://sjk3446.github.io');
}

function random_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function digest_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)); }
function mac_(value) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(value), settings_().pepper, Utilities.Charset.UTF_8)); }
function equal_(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function fail_(code, text) { const error = new Error(text); error.reqlyCode = code; throw error; }
function validId_(id) { if (!/^[a-f0-9]{64}$/.test(String(id))) throw new Error('프로젝트 주소가 올바르지 않습니다.'); }
function record_(id) {
  validId_(id);
  const folders = settings_().root.getFoldersByName(id);
  if (!folders.hasNext()) fail_('NOT_FOUND', '프로젝트를 찾을 수 없습니다.');
  const folder = folders.next(), files = folder.getFilesByName('project.json');
  if (folder.isTrashed()) fail_('NOT_FOUND', '삭제되었거나 찾을 수 없는 프로젝트입니다.');
  if (!files.hasNext()) fail_('NOT_FOUND', '프로젝트를 찾을 수 없습니다.');
  const file = files.next();
  return { folder: folder, file: file, data: JSON.parse(file.getBlob().getDataAsString('UTF-8')) };
}
function write_(record) { record.file.setContent(JSON.stringify(record.data)); }
function proof_(value) {
  if (!/^[a-f0-9]{64}$/.test(String(value))) throw new Error('비밀번호 확인 정보가 올바르지 않습니다.');
  return String(value);
}
function credentials_(auth) {
  if (!auth || !/^[a-f0-9]{64}$/.test(auth.salt || '')) throw new Error('비밀번호 설정이 필요합니다.');
  return { salt: auth.salt, hash: mac_(proof_(auth.proof)), epoch: random_() };
}
function token_(data, role, directoryClaim) {
  const claim = { id: data.id, role: role, epoch: data.auth[role].epoch, nonce: random_() };
  if (directoryClaim) { claim.directoryEpoch = directoryClaim.epoch; claim.expiresAt = directoryClaim.expiresAt; }
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(claim), Utilities.Charset.UTF_8);
  return body + '.' + mac_(body);
}
function authorize_(record, token, admin) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !equal_(parts[1], mac_(parts[0]))) fail_('AUTH', '프로젝트 비밀번호로 다시 접속해 주세요.');
  let claim;
  try { claim = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8')); }
  catch (_) { fail_('AUTH', '접속 정보가 올바르지 않습니다.'); }
  if (claim.id !== record.data.id || !['admin', 'user'].includes(claim.role) || claim.epoch !== record.data.auth[claim.role].epoch) fail_('AUTH', '비밀번호가 변경되었습니다. 다시 접속해 주세요.');
  if (claim.directoryEpoch && (claim.directoryEpoch !== directoryAccess_()?.epoch || !Number.isFinite(claim.expiresAt) || claim.expiresAt <= Date.now())) fail_('AUTH', '관리자 접속이 만료되었거나 비밀번호가 변경되었습니다. 다시 접속해 주세요.');
  if (admin && claim.role !== 'admin') fail_('FORBIDDEN', '관리자만 사용할 수 있습니다.');
  return claim.role;
}
function public_(data) {
  return { id: data.id, name: data.name, version: data.version, updatedAt: data.updatedAt,
    workspace: { projectId: data.id, document: data.document, references: data.references, requirements: Object.values(data.items), assets: data.assets.map(file=>{const value=Object.assign({},file);delete value.driveId;return value;}), selectedRfp: data.selectedRfp, questionDeletedIds: Object.keys(data.qaDeleted || {}) } };
}

function questionKey_(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,160}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('질의응답 식별자가 올바르지 않습니다.');
  return value;
}
function questionOwner_(data, secret) {
  if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) return null;
  return { hash: mac_('question-owner:' + data.id + ':' + secret), authorId: digest_('question-author:' + data.id + ':' + secret).replace(/=+$/, '') };
}
function questionMutation_(record, role, r) {
  const data = record.data, history = Array.isArray(data.document?.qaHistory) ? data.document.qaHistory : [];
  const owners = data.qaOwners || {}, deleted = data.qaDeleted || {}, owner = questionOwner_(data, r.authorSecret);
  const publishing = r.action === 'qaPublish', entries = publishing ? r.records : r.questionIds;
  if (!Array.isArray(entries) || !entries.length || entries.length > 100 || JSON.stringify(entries).length > 2000000) throw new Error('한 번에 변경할 질의응답은 1~100개로 선택해 주세요.');
  const ids = entries.map(entry => questionKey_(publishing ? entry?.id : entry));
  if (new Set(ids).size !== ids.length) throw new Error('중복된 질의응답을 확인해 주세요.');
  const records = new Map(history.map(entry => [entry.id, entry]));
  // Validate the entire batch before writes. Existing legacy entries cannot acquire ownership by republication.
  entries.forEach((entry, index) => {
    const id = ids[index], owned = owner && owners[id] && equal_(owners[id], owner.hash);
    if (publishing) {
      if (!owner) fail_('FORBIDDEN', '이 브라우저의 질문 작성자 정보를 확인해 주세요.');
      if (deleted[id]) fail_('QA_DELETED', '이미 삭제한 질의응답은 다시 공유할 수 없습니다.');
      if ((records.has(id) || owners[id]) && !owned) fail_('FORBIDDEN', '다른 작성자의 질의응답은 변경할 수 없습니다.');
      if (typeof entry.question !== 'string' || !entry.question.trim() || !Array.isArray(entry.answer?.claims)) throw new Error('질의응답 저장 내용을 확인해 주세요.');
    } else if (role !== 'admin' && !owned) fail_('FORBIDDEN', '작성자 또는 이 프로젝트의 관리자만 질의응답을 삭제하거나 공유를 해제할 수 있습니다.');
    if (!publishing && !records.has(id) && !owners[id] && !deleted[id]) fail_('NOT_FOUND', '질의응답을 찾을 수 없습니다.');
  });
  let changed = false;
  entries.forEach((entry, index) => {
    const id = ids[index];
    if (publishing) {
      const clean = {};
      ['id', 'question', 'contextQuestion', 'signature', 'model', 'createdAt', 'scope', 'answer'].forEach(key => { if (entry[key] !== undefined) clean[key] = entry[key]; });
      clean.authorId = owner.authorId;
      if (JSON.stringify(records.get(id)) !== JSON.stringify(clean)) { records.set(id, clean); changed = true; }
      owners[id] = owner.hash;
    } else {
      if (records.delete(id)) changed = true;
      if (r.action === 'qaDelete' && !deleted[id]) { deleted[id] = new Date().toISOString(); changed = true; }
    }
  });
  if (changed) {
    data.document = Object.assign({}, data.document || { name: data.name, type: 'PROJECT' }, { qaHistory: Array.from(records.values()) });
    data.qaOwners = owners; data.qaDeleted = deleted; data.version += 1; data.updatedAt = new Date().toISOString(); write_(record);
  }
  return { project: public_(data) };
}

function loginRole_(record, proof) {
  const data = record.data;
  if (data.failures.until > Date.now()) fail_('RATE_LIMIT', '잠시 후 다시 접속해 주세요.');
  const hash = mac_(proof_(proof));
  const role = equal_(hash, data.auth.admin.hash) ? 'admin' : equal_(hash, data.auth.user.hash) ? 'user' : '';
  if (!role) {
    data.failures.count += 1;
    if (data.failures.count >= 20) data.failures = { count: 0, until: Date.now() + 60000 };
    write_(record); fail_('AUTH', '비밀번호가 올바르지 않습니다.');
  }
  data.failures = { count: 0, until: 0 }; write_(record);
  return role;
}

function directoryAccess_() {
  const raw = PropertiesService.getScriptProperties().getProperty('DIRECTORY_ACCESS');
  if (!raw) return null;
  const access = JSON.parse(raw);
  if (!/^[a-f0-9]{64}$/.test(access.salt || '') || !access.hash || !access.epoch) throw new Error('전체 목록 관리자 설정을 확인해 주세요.');
  return access;
}
function directorySaveAccess_(access) {
  PropertiesService.getScriptProperties().setProperty('DIRECTORY_ACCESS', JSON.stringify(access));
}
function directoryProofHash_(proof) { return mac_('directory-password:' + proof_(proof)); }
function directorySign_(purpose, claim) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(claim), Utilities.Charset.UTF_8);
  return body + '.' + mac_('directory:' + purpose + ':' + body);
}
function directoryReadSigned_(purpose, token, code) {
  const parts = typeof token === 'string' && token.length < 20000 ? token.split('.') : [];
  if (parts.length !== 2 || !equal_(parts[1], mac_('directory:' + purpose + ':' + parts[0]))) fail_(code, '전체 목록 관리자 비밀번호로 다시 접속해 주세요.');
  let claim;
  try { claim = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8')); }
  catch (_) { fail_(code, '전체 목록 접속 정보가 올바르지 않습니다.'); }
  if (!claim || claim.purpose !== purpose || !Number.isFinite(claim.expiresAt) || claim.expiresAt <= Date.now()) fail_(code, '전체 목록 접속 시간이 만료되었습니다. 다시 접속해 주세요.');
  return claim;
}
function directorySession_(access, remember) {
  const expiresAt = Date.now() + (remember === true ? 90 * 24 : 12) * 60 * 60000;
  return { directoryToken: directorySign_('session', { purpose: 'session', epoch: access.epoch, nonce: random_(), expiresAt: expiresAt }), expiresAt: expiresAt };
}
function directoryAuthorize_(token, access) {
  if (!access) fail_('DIRECTORY_UNCONFIGURED', '전체 목록 관리자 비밀번호 설정이 필요합니다.');
  const claim = directoryReadSigned_('session', token, 'DIRECTORY_AUTH');
  if (claim.epoch !== access.epoch) fail_('DIRECTORY_AUTH', '전체 목록 관리자 비밀번호가 변경되었습니다. 다시 접속해 주세요.');
  return claim;
}
function directoryCheckProof_(access, proof) {
  const failures = access.failures || { count: 0, until: 0 };
  if (failures.until > Date.now()) fail_('RATE_LIMIT', '잠시 후 다시 접속해 주세요.');
  const valid = typeof proof === 'string' && /^[a-f0-9]{64}$/.test(proof) && equal_(access.hash, directoryProofHash_(proof));
  if (!valid) {
    failures.count += 1;
    access.failures = failures.count >= 20 ? { count: 0, until: Date.now() + 60000 } : failures;
    directorySaveAccess_(access); fail_('DIRECTORY_AUTH', '전체 목록 관리자 비밀번호가 올바르지 않습니다.');
  }
  access.failures = { count: 0, until: 0 }; directorySaveAccess_(access);
}
function directorySetupCheck_(setupToken) {
  if (directoryAccess_()) fail_('DIRECTORY_CONFIGURED', '전체 목록 관리자 비밀번호가 이미 설정되어 있습니다.');
  const raw = PropertiesService.getScriptProperties().getProperty('DIRECTORY_SETUP');
  let setup; try { setup = raw ? JSON.parse(raw) : null; } catch (_) { setup = null; }
  if (typeof setupToken !== 'string' || !/^[a-f0-9]{64}$/.test(setupToken) || !setup || setup.expiresAt <= Date.now() || !equal_(setup.hash, digest_(setupToken)))
    fail_('DIRECTORY_SETUP_INVALID', '목록 관리자 설정 링크가 올바르지 않거나 만료되었습니다. 소유자에게 확인해 주세요.');
}
function directoryList_(r, access) {
  const session = directoryAuthorize_(r.directoryToken, access), root = settings_().root;
  let folders;
  if (r.cursor) {
    const cursor = directoryReadSigned_('page', r.cursor, 'DIRECTORY_CURSOR');
    if (cursor.epoch !== access.epoch || cursor.root !== root.getId() || typeof cursor.continuation !== 'string') fail_('DIRECTORY_CURSOR', '목록을 처음부터 다시 불러와 주세요.');
    try { folders = DriveApp.continueFolderIterator(cursor.continuation); }
    catch (_) { fail_('DIRECTORY_CURSOR', '목록을 처음부터 다시 불러와 주세요.'); }
  } else folders = root.getFolders();
  const projects = []; let scanned = 0, read = 0, skipped = 0;
  // Bound both JSON reads and unrelated folder scans. The caller follows nextCursor.
  while (folders.hasNext() && projects.length < 20 && read < 20 && scanned < 40) {
    const folder = folders.next(); scanned += 1;
    if (folder.isTrashed() || !/^[a-f0-9]{64}$/.test(folder.getName())) continue;
    try {
      const files = folder.getFilesByName('project.json');
      if (!files.hasNext()) { skipped += 1; continue; }
      read += 1;
      const data = JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
      if (data.id !== folder.getName() || typeof data.name !== 'string' || !data.auth || !data.items) { skipped += 1; continue; }
      projects.push({ id: data.id, name: data.name, updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '' });
    } catch (_) { skipped += 1; }
  }
  const nextCursor = folders.hasNext() ? directorySign_('page', { purpose: 'page', epoch: access.epoch, root: root.getId(), continuation: folders.getContinuationToken(), expiresAt: Math.min(session.expiresAt, Date.now() + 30 * 60000) }) : '';
  return { projects: projects, nextCursor: nextCursor, skipped: skipped };
}
function directoryDispatch_(r) {
  const access = directoryAccess_();
  if (r.action === 'directoryChallenge') return access ? { configured: true, salt: access.salt, iterations: 600000 } : { configured: false };
  if (r.action === 'directorySetupChallenge') { directorySetupCheck_(r.setupToken); return { ready: true }; }
  if (r.action === 'directorySetup') {
    directorySetupCheck_(r.setupToken);
    if (!/^[a-f0-9]{64}$/.test(r.salt || '')) throw new Error('목록 관리자 비밀번호 설정을 다시 진행해 주세요.');
    const next = { salt: r.salt, hash: directoryProofHash_(r.proof), epoch: random_(), failures: { count: 0, until: 0 } };
    directorySaveAccess_(next);
    PropertiesService.getScriptProperties().deleteProperty('DIRECTORY_SETUP');
    return directorySession_(next);
  }
  if (!access) fail_('DIRECTORY_UNCONFIGURED', '전체 목록 관리자 비밀번호 설정이 필요합니다.');
  if (r.action === 'directoryLogin') { directoryCheckProof_(access, r.proof); return directorySession_(access, r.remember); }
  if (r.action === 'directoryList') return directoryList_(r, access);
  if (r.action === 'directoryOpen') {
    const claim = directoryAuthorize_(r.directoryToken, access), record = record_(r.id);
    return { project: public_(record.data), role: 'admin', token: token_(record.data, 'admin', claim) };
  }
  if (r.action === 'directoryChangePassword') {
    directoryAuthorize_(r.directoryToken, access); directoryCheckProof_(access, r.currentProof);
    access.hash = directoryProofHash_(r.newProof); access.epoch = random_(); directorySaveAccess_(access);
    return directorySession_(access, r.remember);
  }
  throw new Error('지원하지 않는 요청입니다.');
}

function dispatch_(r) {
  if (r.action.indexOf('directory') === 0) return directoryDispatch_(r);
  if (r.action === 'create') {
    if (!String(r.name || '').trim()) throw new Error('프로젝트 이름을 입력해 주세요.');
    // Same salt permits checking that the two passwords differ without receiving them.
    if (r.admin?.salt !== r.user?.salt || equal_(r.admin?.proof, r.user?.proof)) throw new Error('관리자와 사용자 비밀번호는 서로 달라야 합니다.');
    const auth = { admin: credentials_(r.admin), user: credentials_(r.user) };
    const id = random_(), now = new Date().toISOString();
    const data = { schema: REQLY_SCHEMA, id: id, name: String(r.name).trim().slice(0, 200), auth: auth,
      version: 0, updatedAt: now, document: null, references: [], assets: [], selectedRfp: '', items: {}, failures: { count: 0, until: 0 } };
    const folder = settings_().root.createFolder(id);
    folder.createFile('project.json', JSON.stringify(data), MimeType.PLAIN_TEXT);
    return { project: public_(data), token: token_(data, 'admin'), role: 'admin' };
  }
  const record = record_(r.id), data = record.data;
  if (r.action === 'challenge') return { salt: data.auth.admin.salt, iterations: 600000 };
  if (r.action === 'login') {
    const role = loginRole_(record, r.proof);
    return { project: public_(data), role: role, token: token_(data, role) };
  }
  if (r.action === 'deleteProject') {
    if (r.directoryToken) directoryAuthorize_(r.directoryToken, directoryAccess_());
    else if (r.proof) {
      if (loginRole_(record, r.proof) !== 'admin') fail_('FORBIDDEN', '해당 프로젝트의 관리자만 삭제할 수 있습니다.');
    } else authorize_(record, r.token, true);
    // Keep old clients compatible while new clients submit explicit confirmation.
    if (r.confirmed !== true && r.confirmName !== data.name) fail_('CONFIRM', '프로젝트 삭제 여부를 확인해 주세요.');
    // Preserve project.json and attachments together for the Drive owner's recovery.
    record.folder.setTrashed(true);
    return { deleted: true, id: data.id };
  }
  if (r.action === 'renameProject') {
    if (r.proof) {
      if (loginRole_(record, r.proof) !== 'admin') fail_('FORBIDDEN', '프로젝트 이름은 관리자만 변경할 수 있습니다.');
    } else authorize_(record, r.token, true);
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name || name.length > 200) throw new Error('프로젝트 이름은 1~200자로 입력해 주세요.');
    if (data.name !== name) {
      if (r.expectedName !== data.name) fail_('CONFLICT', '프로젝트 이름이 변경되었습니다. 프로젝트를 다시 연 뒤 수정해 주세요.');
      data.name = name; data.version += 1; data.updatedAt = new Date().toISOString(); write_(record);
    }
    return { project: public_(data) };
  }
  const role = authorize_(record, r.token, ['password', 'removeFile'].includes(r.action));
  if (['qaPublish', 'qaUnpublish', 'qaDelete'].includes(r.action)) return questionMutation_(record, role, r);
  if (r.action === 'load') {
    if (r.version === data.version) return { unchanged: true, version: data.version };
    return { project: public_(data), role: role };
  }
  if (r.action === 'save') {
    const changes = r.changes || [], keys = new Set();
    if (!Array.isArray(changes) || changes.length > 5000) throw new Error('저장 항목이 올바르지 않습니다.');
    if (r.metadata && r.expectedVersion !== data.version) fail_('CONFLICT', '프로젝트 자료가 변경되었습니다. 최신 상태를 확인해 주세요.');
    // Validate the whole batch before mutating anything.
    changes.forEach(change => {
      if (!change || !/^[\w-]{1,160}$/.test(change.key || '') || ['__proto__', 'constructor', 'prototype'].includes(change.key) || keys.has(change.key)) throw new Error('항목 식별자가 올바르지 않습니다.');
      keys.add(change.key);
      const existing = data.items[change.key];
      if ((existing?.revision || 0) !== change.expectedRevision) fail_('CONFLICT', '다른 사람이 먼저 저장했습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.');
      if (!change.remove && (!change.item || change.item.key !== change.key)) throw new Error('저장 내용이 올바르지 않습니다.');
    });
    const savedAt = new Date().toISOString();
    if (r.metadata) {
      const history = data.document?.qaHistory;
      data.document = r.metadata.document ? Object.assign({}, r.metadata.document) : null;
      // Shared history is writable only through the permission-checked question RPCs.
      if (data.document) delete data.document.qaHistory;
      if (Array.isArray(history)) data.document = Object.assign({}, data.document || { name: data.name, type: 'PROJECT' }, { qaHistory: history });
      data.references = Array.isArray(r.metadata.references) ? r.metadata.references : data.references;
    }
    changes.forEach(change => {
      if(change.remove){
        if(data.items[change.key]){data.archived=data.archived||[];data.archived.push(Object.assign({},data.items[change.key],{deletedAt:savedAt}));delete data.items[change.key];}
      }else data.items[change.key] = Object.assign({}, change.item, { revision: (data.items[change.key]?.revision || 0) + 1, savedAt: savedAt });
    });
    data.version += 1; data.updatedAt = savedAt; write_(record);
    return { project: public_(data) };
  }
  if (r.action === 'password') {
    if (!['admin', 'user'].includes(r.role)) throw new Error('권한 종류가 올바르지 않습니다.');
    if (!equal_(mac_(proof_(r.currentProof)), data.auth.admin.hash)) fail_('AUTH', '현재 관리자 비밀번호가 올바르지 않습니다.');
    const hash = mac_(proof_(r.newProof));
    if (equal_(hash, data.auth[r.role === 'admin' ? 'user' : 'admin'].hash)) throw new Error('관리자와 사용자 비밀번호는 서로 달라야 합니다.');
    data.auth[r.role].hash = hash; data.auth[r.role].epoch = random_(); write_(record);
    return { changed: true, reconnect: r.role === 'admin' };
  }
  if (r.action === 'upload') {
    if (!['rfp', 'reference'].includes(r.kind)) throw new Error('파일 종류가 올바르지 않습니다.');
    const bytes = Utilities.base64Decode(String(r.base64 || ''));
    if (!bytes.length || bytes.length > REQLY_MAX_FILE) throw new Error('파일은 30MB 이하로 올려 주세요.');
    const name = String(r.name || 'file').slice(0, 200);
    const file = record.folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', 'asset-' + random_()));
    const asset = { id: random_(), driveId: file.getId(), name: name, size: bytes.length, kind: r.kind, uploadedAt: new Date().toISOString() };
    data.assets.push(asset);
    if (!data.selectedRfp && r.kind === 'rfp') data.selectedRfp = asset.id;
    data.version += 1; write_(record);
    return { project: public_(data) };
  }
  if (r.action === 'download' || r.action === 'removeFile') {
    const asset = data.assets.find(file => file.id === r.assetId);
    if (!asset) throw new Error('파일을 찾을 수 없습니다.');
    if (r.action === 'download') return { name: asset.name, base64: Utilities.base64Encode(DriveApp.getFileById(asset.driveId).getBlob().getBytes()) };
    if (asset.kind === 'rfp') {
      if (data.assets.filter(file => file.kind === 'rfp').length <= 1) throw new Error('마지막 RFP는 삭제할 수 없습니다.');
      if (data.selectedRfp === asset.id) throw new Error('다른 RFP를 먼저 분석 대상으로 선택해 주세요.');
    }
    // Write metadata first; a failed trash operation leaves recoverable orphan, not a broken project.
    data.assets = data.assets.filter(file => file.id !== asset.id);
    if(asset.kind==='reference')data.references=data.references.filter(reference=>reference.assetId!==asset.id);
    data.version += 1; write_(record);
    DriveApp.getFileById(asset.driveId).setTrashed(true);
    return { project: public_(data) };
  }
  if (r.action === 'selectRfp') {
    if (!data.assets.some(file => file.id === r.assetId && file.kind === 'rfp')) throw new Error('RFP 파일을 선택해 주세요.');
    data.selectedRfp = r.assetId; data.version += 1; write_(record);
    return { project: public_(data) };
  }
  throw new Error('지원하지 않는 요청입니다.');
}
