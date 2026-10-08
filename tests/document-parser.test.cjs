const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../document-parser.js');

test('explicit IDs retain different families, numeric IDs and separators', () => {
  for (const id of ['UXG-DER-001', 'ECR-067', 'CUSTOM.ABC/067', '12345', '기능-001']) {
    assert.equal(parser.declaredId(`요구사항 ID ${id}`), id);
  }
  assert.equal(parser.declaredId('ECR-요구사항ID 67개'), '');
  for (const line of ['제시한다-1', '신규-2', 'RAID-10', 'UTF-8', 'V3', 'QSFP-100']) {
    assert.equal(parser.headingIdFrom(line), '');
  }
});

test('forms keep original IDs, wrapped titles, multiline content and continuations', () => {
  const text = `[[PAGE:1]]
[[TABLE_LAYOUT]]
요구사항 분류 시스템 장비 구성 요구사항 요구사항 ID ECR-066
요구사항 명칭
장비 구성
정의
장비를 구성해야 함
□ 항목 하나
⚪ RAID-10 구성
산출물
※ 설정 결과서
요구사항 분류 프로젝트 관리 요구사항 요구사항 ID PMR-019
요구사항 명칭
산출물 제출 준수
[[PAGE:2]]
[[TABLE_LAYOUT]]
정의
계획된 산출물을 제출 관리
□ 주요 산출물
⚪ 정의된 산출물 등
[[PAGE:3]]
전체 폭 첨부 표
첨부 표의 마지막 행
산출물
※ 결과서
요구사항 분류 시스템 장비 요구사항 요구사항 ID ECR-067
요구사항 명칭
폐기 장비
처리
[[PAGE:4]]
[[TABLE_LAYOUT]]
정의
안전하게 장비를 폐기해야 함
□ 파기 방법
⚪ 데이터 완전삭제
산출물
※ 완료 보고서
8. 품 질 요 구 사 항 (QUR)
[[PAGE:5]]
이후 부록은 마지막 요구사항이 아님`;
  const reqs = parser.buildTextRequirements(text);
  assert.deepEqual(reqs.map(r => r.id), ['ECR-066', 'PMR-019', 'ECR-067']);
  assert.equal(reqs[1].name, '산출물 제출 준수');
  assert.match(reqs[1].description, /정의된 산출물 등\n전체 폭 첨부 표\n첨부/);
  assert.equal(reqs[2].name, '폐기 장비 처리');
  assert.match(reqs[2].description, /□ 파기 방법\n⚪ 데이터 완전삭제/);
  assert.doesNotMatch(reqs[2].description, /품 질|이후 부록/);
});

test('centred PDF labels precede wrapped cell contents, not their middle', () => {
  const span = (str, x, y, width = str.length * 6, height = 12) => ({str, width, height, transform:[height,0,0,height,x,y]});
  const first = parser.pdfPageText([
    span('요구사항 분류', 30, 730), span('장비 요구사항', 178, 730),
    span('요구사항 ID', 320, 730), span('XYZ-067', 450, 730),
    span('요구사항 명칭', 30, 687), span('폐기 장비', 178, 696), span('처리', 178, 678),
    span('정의', 131, 634), span('안전한 장비', 178, 643), span('폐기 작업', 178, 625),
    span('요구', 76, 560), span('사항',76,544), span('상세',76,528),
    span('□ 데이터 파기',178,596), span('⚪ 완전삭제',178,580), span('- 10 -',279,44)
  ]);
  const next = parser.pdfPageText([span('⚪ 다음 페이지 조건',178,750)],first);
  assert.equal(next.tableLayout,true);
  assert.match(first.text, /요구사항 명칭\n폐기 장비\n처리/);
  assert.match(first.text, /정의\n안전한 장비\n폐기 작업/);
  assert.doesNotMatch(first.text, /- 10 -|\n사항\n/);
});

test('plain ID blocks are not split at bullets or technical references', () => {
  const reqs = parser.buildTextRequirements(`UXG-DER-001 데이터 관리
□ 입력 기능
- UTF-8 문자를 지원해야 한다.
[[PAGE:2]]
- RAID-10을 사용한다.
UXG-SFR-002 조회 기능
- 검색해야 한다.`);
  assert.deepEqual(reqs.map(r=>r.id), ['UXG-DER-001','UXG-SFR-002']);
  assert.match(reqs[0].description, /UTF-8.*\n- RAID-10/);
});

test('fragmented PDF words reassemble into centred labels and omit split page footers', () => {
  const span=(str,x,y,width)=>({str,width,height:12,transform:[12,0,0,12,x,y]});
  const layout=parser.pdfPageText([
    span('요구사항',79,518,48),span('명칭',133,518,24),
    span('긴',178,528,12),span('명칭',196,528,24),span('둘째 줄',178,508,40),
    span('정의',131,475,24),span('요구사항의 정의',178,475,85),
    span('-',270,44,5),span('42',280,44,12),span('-',306,44,5)
  ]);
  assert.match(layout.text,/요구사항 명칭\n긴 명칭\n둘째 줄/);
  assert.doesNotMatch(layout.text,/- -|42/);
});

test('prose without requirement IDs does not fabricate IDs from its contents', () => {
  const reqs = parser.buildTextRequirements('서버는 RAID-10을 지원해야 한다.\n운영체제는 UTF-8을 지원해야 한다.', {obligation:/해야/});
  assert.equal(reqs.length,2);
  assert.ok(reqs.every(r=>r.id===''));
  assert.equal(parser.multiline('첫 줄\r\n둘째 줄\n\n□ 항목'), '첫 줄\n둘째 줄\n\n□ 항목');
});
