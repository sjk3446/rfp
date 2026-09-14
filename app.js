const CATEGORIES = [
  { name: '설계', code: 'DER', prefix: 'DER' },
  { name: '기능', code: 'SFR', prefix: 'SFR' },
  { name: '성능', code: 'PER', prefix: 'PER' },
  { name: '시스템장비', code: 'ECR', prefix: 'ECR' },
  { name: '인터페이스', code: 'SIR', prefix: 'SIR' },
  { name: '데이터', code: 'DAR', prefix: 'DAR' },
  { name: '테스트', code: 'TER', prefix: 'TER' },
  { name: '보안', code: 'SER', prefix: 'SER' },
  { name: '품질', code: 'QUR', prefix: 'QUR' },
  { name: '운영', code: 'SOR', prefix: 'SOR' },
  { name: '제약사항', code: 'COR', prefix: 'COR' },
  { name: '프로젝트관리', code: 'PMR', prefix: 'PMR' },
  { name: '프로젝트지원', code: 'PSR', prefix: 'PSR' },
  { name: '기타', code: 'ETC', prefix: 'ETC' },
];

const STORAGE_KEY = 'reqly-agent-workspace-v1';
const STATUS_ORDER = { '검토 전': 0, '검토 중': 1, '확정': 2 };
const FLAG_OPTIONS = [
  { value: 'red', label: '빨강' },
  { value: 'orange', label: '주황' },
  { value: 'yellow', label: '노랑' },
  { value: 'green', label: '초록' },
  { value: 'blue', label: '파랑' },
];
const FLAG_ORDER = { red: 5, orange: 4, yellow: 3, green: 2, blue: 1, '': 0 };
const FLAG_LABELS = Object.fromEntries(FLAG_OPTIONS.map(item => [item.value, item.label]));

const GLOSSARY = [
  { term: 'VMS', full: 'Vessel Management System', meaning: '선박의 운항, 위치, 정비, 안전, 비용 정보를 통합 관리하는 선박 관리 시스템입니다.', aliases: ['선박 관리 시스템', 'Vessel Management System'] },
  { term: 'AIS', full: 'Automatic Identification System', meaning: '선박의 식별정보, 위치, 속력, 항로를 자동 송수신하는 선박자동식별시스템입니다.', aliases: ['선박자동식별시스템'] },
  { term: 'PMS', full: 'Planned Maintenance System', meaning: '선박 장비의 예방정비 일정, 작업, 부품, 이력을 관리하는 계획정비시스템입니다.', aliases: ['계획정비시스템'] },
  { term: 'ECDIS', full: 'Electronic Chart Display and Information System', meaning: '전자해도에 항해 정보를 결합해 안전 운항을 지원하는 전자해도 표시정보시스템입니다.', aliases: ['전자해도'] },
  { term: 'ERP', full: 'Enterprise Resource Planning', meaning: '회계, 구매, 인사, 자산 등 조직의 핵심 자원을 통합 관리하는 전사적 자원관리 시스템입니다.', aliases: ['전사적 자원관리'] },
  { term: 'API', full: 'Application Programming Interface', meaning: '서로 다른 시스템이 정해진 방식으로 기능과 데이터를 주고받기 위한 인터페이스입니다.', aliases: ['Application Programming Interface'] },
  { term: 'REST API', full: 'Representational State Transfer API', meaning: 'HTTP 자원과 메서드를 이용해 시스템 간 데이터를 교환하는 웹 API 설계 방식입니다.', aliases: ['RESTful API'] },
  { term: 'SSO', full: 'Single Sign-On', meaning: '한 번의 로그인으로 여러 시스템을 이용할 수 있게 하는 통합 인증 방식입니다.', aliases: ['통합 인증', 'Single Sign-On'] },
  { term: 'MFA', full: 'Multi-Factor Authentication', meaning: '비밀번호 외에 인증서, OTP, 생체정보 등 두 가지 이상의 요소를 확인하는 다중요소 인증입니다.', aliases: ['다중요소 인증'] },
  { term: 'TPS', full: 'Transactions Per Second', meaning: '시스템이 1초 동안 처리할 수 있는 트랜잭션 수를 나타내는 성능 지표입니다.', aliases: ['초당 처리 건수'] },
  { term: 'RTO', full: 'Recovery Time Objective', meaning: '장애 발생 후 서비스를 복구하기까지 허용되는 목표 시간입니다.', aliases: ['목표복구시간'] },
  { term: 'RPO', full: 'Recovery Point Objective', meaning: '장애 시 허용 가능한 데이터 손실 시점을 나타내는 목표 복구 시점입니다.', aliases: ['목표복구시점'] },
  { term: 'SLA', full: 'Service Level Agreement', meaning: '가용성, 응답시간, 복구시간 등 제공해야 할 서비스 수준을 정의한 약정입니다.', aliases: ['서비스 수준 협약'] },
  { term: 'DR', full: 'Disaster Recovery', meaning: '재해나 대규모 장애가 발생했을 때 시스템과 데이터를 복구하기 위한 체계입니다.', aliases: ['재해복구'] },
  { term: 'HA', full: 'High Availability', meaning: '장애가 발생해도 서비스를 지속할 수 있도록 이중화와 자동 전환을 적용하는 고가용성 구성입니다.', aliases: ['고가용성'] },
  { term: 'ESB', full: 'Enterprise Service Bus', meaning: '여러 시스템 사이의 메시지 변환, 라우팅, 연계를 중개하는 통합 플랫폼입니다.', aliases: ['엔터프라이즈 서비스 버스'] },
  { term: 'IAM', full: 'Identity and Access Management', meaning: '사용자 신원, 계정, 역할과 시스템 접근 권한을 통합 관리하는 체계입니다.', aliases: ['계정 및 접근 관리'] },
  { term: 'PII', full: 'Personally Identifiable Information', meaning: '개인을 직접 또는 간접적으로 식별할 수 있는 개인정보를 뜻합니다.', aliases: ['개인식별정보'] },
  { term: 'TLS', full: 'Transport Layer Security', meaning: '네트워크 전송 구간의 기밀성과 무결성을 보호하는 암호화 통신 프로토콜입니다.', aliases: ['Transport Layer Security'] },
  { term: 'AES', full: 'Advanced Encryption Standard', meaning: '데이터 저장 암호화에 널리 쓰이는 대칭키 암호화 표준입니다.', aliases: ['Advanced Encryption Standard'] },
  { term: 'WBS', full: 'Work Breakdown Structure', meaning: '프로젝트 범위를 관리 가능한 작업 단위로 계층적으로 분해한 작업분류체계입니다.', aliases: ['작업분류체계'] },
  { term: 'PMO', full: 'Project Management Office', meaning: '프로젝트 표준, 일정, 품질, 위험과 의사결정을 지원·통제하는 조직입니다.', aliases: ['프로젝트 관리 조직'] },
  { term: 'APM', full: 'Application Performance Monitoring', meaning: '애플리케이션의 응답시간, 오류, 자원 사용량을 관찰하고 분석하는 성능 모니터링 도구입니다.', aliases: ['애플리케이션 성능 모니터링'] },
  { term: 'RFP', full: 'Request for Proposal', meaning: '발주기관이 사업의 목표, 범위, 요구조건을 적어 제안서를 요청하는 문서입니다.', aliases: ['제안요청서'] },
  { term: 'SDV', full: 'Software Defined Vessel', meaning: '선박의 여러 기능을 하드웨어보다 소프트웨어 중심으로 구성하고 업데이트하는 개념입니다.', aliases: ['소프트웨어 정의 선박'] },
  { term: 'UI/UX', full: 'User Interface / User Experience', meaning: 'UI는 사용자가 보는 화면과 조작 요소이고, UX는 서비스를 이용하면서 겪는 전체 경험을 뜻합니다.', aliases: ['UI', 'UX', '사용자 인터페이스', '사용자 경험'] },
  { term: 'HMI', full: 'Human Machine Interface', meaning: '사람이 기계나 설비의 상태를 보고 명령을 내릴 수 있게 만든 화면이나 조작 장치입니다.', aliases: ['Human Machine Interface'] },
  { term: 'OT', full: 'Operational Technology', meaning: '엔진·센서·제어기처럼 실제 설비를 감시하고 움직이는 운영 기술 영역입니다.', aliases: ['운영기술', '제어망', 'OT망'] },
  { term: 'PKI', full: 'Public Key Infrastructure', meaning: '전자 인증서와 공개키 암호화를 이용해 사용자나 장비의 신원을 확인하고 통신을 보호하는 체계입니다.', aliases: ['공개키 기반구조'] },
  { term: 'OTA', full: 'Over-the-Air', meaning: '장비에 직접 연결하지 않고 네트워크를 통해 소프트웨어나 설정을 원격으로 배포·업데이트하는 방식입니다.', aliases: ['원격 업데이트'] },
  { term: 'SSOT', full: 'Single Source of Truth', meaning: '여러 곳에 흩어진 정보 중 하나를 공식 기준 원본으로 정해 일관되게 사용하는 방식입니다.', aliases: ['단일 기준 정보원', 'Local SSOT'] },
  { term: 'CII', full: 'Carbon Intensity Indicator', meaning: '선박이 화물을 운송하면서 배출한 탄소의 효율을 평가하는 국제 해운 환경 지표입니다.', aliases: ['탄소집약도지수'] },
  { term: 'ENC', full: 'Electronic Navigational Chart', meaning: '선박 항해 시스템에서 사용하는 공식 디지털 해도 데이터입니다.', aliases: ['전자해도'] },
  { term: 'P&ID', full: 'Piping and Instrumentation Diagram', meaning: '배관, 밸브, 펌프, 계측기와 연결 관계를 기호로 나타낸 설비 도면입니다.', aliases: ['배관계장도'] },
  { term: 'API Gateway', full: 'Application Programming Interface Gateway', meaning: '여러 API 요청을 한곳에서 받아 인증, 라우팅, 제한, 기록 등을 처리하는 관문 역할의 시스템입니다.', aliases: ['API 게이트웨이'] },
  { term: '디자인 시스템', full: 'Design System', meaning: '화면을 일관되게 만들기 위한 색상, 글꼴, 버튼, 입력창, 사용 규칙을 묶어 관리하는 체계입니다.', aliases: ['Design System', '디자인시스템'] },
  { term: '컴포넌트', full: 'Component', meaning: '버튼, 표, 경보창처럼 여러 화면에서 반복해서 사용할 수 있게 만든 독립적인 UI 또는 소프트웨어 부품입니다.', aliases: ['Component'] },
  { term: '위젯', full: 'Widget', meaning: '게이지, 차트, 지도처럼 화면에 배치해 특정 정보나 기능을 보여주는 작은 화면 요소입니다.', aliases: ['Widget'] },
  { term: '대시보드', full: 'Dashboard', meaning: '여러 핵심 상태와 지표를 한 화면에서 빠르게 확인할 수 있도록 모아 놓은 화면입니다.', aliases: ['Dashboard'] },
  { term: '툴팁', full: 'Tooltip', meaning: '버튼이나 항목에 마우스를 올리거나 선택했을 때 잠깐 나타나는 짧은 도움말입니다.', aliases: ['Tooltip'] },
  { term: '린팅', full: 'Linting', meaning: '코드나 화면 설정이 정해진 규칙을 어겼는지 자동으로 찾아 알려주는 검사 과정입니다.', aliases: ['Linting', 'Lint'] },
  { term: '테마', full: 'Theme', meaning: '주간·야간 모드처럼 화면 전체의 색상, 글꼴, 밝기 표현을 한꺼번에 바꾸는 디자인 설정입니다.', aliases: ['Theme'] },
  { term: '렌더링', full: 'Rendering', meaning: '데이터와 화면 규칙을 바탕으로 사용자가 실제로 볼 수 있는 화면을 만들어 표시하는 과정입니다.', aliases: ['Rendering'] },
  { term: '레지스트리', full: 'Registry', meaning: '사용 가능한 구성요소, 패키지, 인증 상태 같은 정보를 등록하고 조회하는 목록 저장소입니다.', aliases: ['Registry'] },
  { term: 'Store-and-Forward', full: 'Store-and-Forward', meaning: '통신이 끊겼을 때 데이터를 잠시 저장해 두었다가 연결이 복구되면 다시 보내는 방식입니다.', aliases: ['저장 후 전달'] },
  { term: '데이터 바인딩', full: 'Data Binding', meaning: '화면의 값과 실제 데이터를 연결해 데이터가 바뀌면 화면도 자동으로 바뀌게 하는 방식입니다.', aliases: ['Data Binding', '바인딩'] },
  { term: '디지털 트윈', full: 'Digital Twin', meaning: '현실의 선박이나 장비 상태를 디지털 공간에 비슷하게 재현하여 확인·분석·예측하는 기술입니다.', aliases: ['Digital Twin', '디지털트윈'] },
  { term: '아키텍처', full: 'Architecture', meaning: '시스템을 어떤 구성요소로 나누고 서로 어떻게 연결할지 정한 전체 구조와 설계 원칙입니다.', aliases: ['Architecture'] },
  { term: '토폴로지', full: 'Topology', meaning: '서버, 장비, 네트워크 노드가 서로 어떤 형태로 연결되어 있는지를 나타낸 구조입니다.', aliases: ['Topology'] },
  { term: '미들웨어', full: 'Middleware', meaning: '서로 다른 프로그램이나 장비가 데이터를 주고받고 함께 동작하도록 중간에서 연결해 주는 소프트웨어입니다.', aliases: ['Middleware'] },
  { term: '프로토콜', full: 'Protocol', meaning: '서로 다른 시스템이 통신할 때 따라야 하는 데이터 형식과 순서에 대한 약속입니다.', aliases: ['Protocol'] },
  { term: '플랫폼', full: 'Platform', meaning: '여러 서비스나 기능을 만들고 실행하고 관리할 수 있도록 공통 기반을 제공하는 환경입니다.', aliases: ['Platform'] },
  { term: '클라우드', full: 'Cloud', meaning: '서버와 저장공간 같은 컴퓨팅 자원을 인터넷이나 전용망을 통해 필요할 때 사용하는 방식입니다.', aliases: ['Cloud'] },
  { term: '컨테이너', full: 'Container', meaning: '프로그램과 실행에 필요한 파일을 하나로 묶어 어느 환경에서도 비슷하게 실행할 수 있게 하는 단위입니다.', aliases: ['Container'] },
  { term: '오케스트레이션', full: 'Orchestration', meaning: '여러 서버나 컨테이너의 배포, 확장, 복구를 규칙에 따라 자동으로 관리하는 방식입니다.', aliases: ['Orchestration'] },
  { term: '캐시', full: 'Cache', meaning: '자주 쓰는 데이터를 가까운 곳에 임시 저장해 더 빠르게 읽도록 하는 저장 공간입니다.', aliases: ['Cache', 'Caching', '캐싱', '정책 캐시'] },
  { term: '페일오버', full: 'Failover', meaning: '주 시스템에 장애가 생기면 대기 중인 다른 시스템으로 자동 전환해 서비스를 이어가는 방식입니다.', aliases: ['Failover', '장애 전환'] },
  { term: '이중화', full: 'Redundancy', meaning: '한 장비나 경로가 고장 나도 계속 운영할 수 있도록 같은 역할의 자원을 두 개 이상 준비하는 구성입니다.', aliases: ['Redundancy'] },
  { term: '암호화', full: 'Encryption', meaning: '허가받지 않은 사람이 내용을 읽지 못하도록 데이터를 알아보기 어려운 형태로 바꾸는 처리입니다.', aliases: ['Encryption'] },
  { term: '인증', full: 'Authentication', meaning: '접속하려는 사용자나 장비가 실제로 누구인지 확인하는 과정입니다.', aliases: ['Authentication'] },
  { term: '인가', full: 'Authorization', meaning: '인증된 사용자나 장비가 어떤 정보와 기능을 사용할 수 있는지 권한을 정하는 과정입니다.', aliases: ['Authorization', '권한 부여'] },
  { term: '인증서', full: 'Digital Certificate', meaning: '사용자, 장비, 서버의 신원을 전자적으로 증명하는 디지털 문서입니다.', aliases: ['Certificate', '전자 인증서'] },
  { term: '접근성', full: 'Accessibility', meaning: '장애 여부나 사용 환경과 관계없이 누구나 화면과 기능을 이용할 수 있게 만드는 기준입니다.', aliases: ['Accessibility', '웹 접근성'] },
  { term: '메시지 브로커', full: 'Message Broker', meaning: '시스템 사이에서 메시지를 받아 저장하거나 전달하여 서로 안정적으로 통신하도록 돕는 중간 시스템입니다.', aliases: ['Message Broker'] },
  { term: '마이크로서비스', full: 'Microservice', meaning: '큰 시스템을 독립적으로 개발·배포할 수 있는 작은 서비스 단위로 나누는 설계 방식입니다.', aliases: ['Microservice', 'MSA'] },
  { term: 'Figma', full: 'Figma', meaning: '여러 사람이 웹에서 화면 디자인과 시안을 함께 만들고 검토할 수 있는 디자인 협업 도구입니다.', aliases: ['피그마'] },
  { term: 'Composer', full: 'UI Composer', meaning: '코드를 직접 많이 작성하지 않고 화면 구성요소를 배치해 UI를 만드는 화면 제작 도구를 뜻합니다.', aliases: ['컴포저', 'UI Composer'] },
  { term: 'OpenBridge', full: 'OpenBridge Design System', meaning: '선박 제어 화면을 일관되고 안전하게 설계하기 위해 만든 해양 분야 UI 디자인 지침입니다.', aliases: ['Open Bridge', 'OpenBridge Design System'] },
  { term: 'RPM', full: 'Revolutions Per Minute', meaning: '엔진이나 회전축이 1분 동안 몇 번 회전하는지를 나타내는 단위입니다.', aliases: ['분당 회전수'] },
  { term: 'SAL', full: 'System Abstraction Layer', meaning: '서로 다른 장비와 시스템의 차이를 감추고, 위쪽 프로그램이 같은 방식으로 사용할 수 있게 하는 중간 계층입니다.', aliases: ['시스템 추상화 계층'] },
  { term: 'IACS', full: 'International Association of Classification Societies', meaning: '주요 선급들이 공통 기술 기준을 만들고 협력하는 국제선급연합입니다.', aliases: ['국제선급연합'] },
  { term: 'IEC', full: 'International Electrotechnical Commission', meaning: '전기·전자·통신 분야의 국제 표준을 만드는 국제전기기술위원회입니다.', aliases: ['국제전기기술위원회'] },
  { term: 'Off-boarding', full: 'Off-boarding', meaning: '사람, 사용자 계정, 장비 또는 서비스를 조직이나 시스템에서 안전하게 제외하고 접근 권한과 연결 정보를 정리하는 종료 절차입니다.', aliases: ['off-boarding', 'offboarding', '오프보딩', '오프-보딩'] },
  { term: '선상 에지 노드', full: 'Onboard Edge Node', meaning: '선박 안에서 센서·장비 데이터를 가까운 곳에서 먼저 처리하고, 필요한 결과만 육상이나 클라우드로 보내는 컴퓨터 또는 통신 장치입니다.', aliases: ['선상에지노드', '선상 엣지 노드', '선상엣지노드', 'Onboard Edge Node'] },
  { term: '클라우드 코어', full: 'Cloud Core', meaning: '여러 현장·선박의 데이터와 서비스를 중앙에서 통합 저장·분석·관리하는 클라우드의 중심 시스템 영역입니다.', aliases: ['클라우드코어', 'Cloud Core'] },
];

// 동일한 약자라도 프로젝트 분야에 따라 뜻이 달라질 수 있다. 주변 문맥의
// 핵심어 점수가 가장 높은 후보를 실제 뜻으로 표시한다.
const GLOSSARY_VARIANTS = {
  PMS: [
    { full: 'Planned Maintenance System', meaning: '선박이나 설비의 예방정비 일정, 작업, 부품과 이력을 관리하는 계획정비시스템입니다.', keywords: ['선박', '정비', '설비', '장비', 'maintenance', 'vessel'] },
    { full: 'Power Management System', meaning: '발전기와 전력 부하를 감시·제어하여 전력을 안정적으로 공급하는 전력관리시스템입니다.', keywords: ['전력', '발전기', '배전', '부하', 'power', '전기'] },
  ],
  VMS: [
    { full: 'Vessel Management System', meaning: '선박의 운항, 위치, 정비, 안전과 비용 정보를 통합 관리하는 선박관리시스템입니다.', keywords: ['선박', '항해', '운항', 'vessel', '해양'] },
    { full: 'Video Management System', meaning: '여러 CCTV 영상의 수집, 저장, 검색과 관제를 관리하는 영상관리시스템입니다.', keywords: ['영상', 'CCTV', '카메라', '관제', 'video'] },
  ],
  CMS: [
    { full: 'Condition Monitoring System', meaning: '센서 데이터를 이용해 장비 상태와 이상 징후를 감시하는 상태감시시스템입니다.', keywords: ['센서', '장비', '진동', '상태', '선박', 'condition'] },
    { full: 'Content Management System', meaning: '웹사이트나 서비스의 문서, 이미지 등 콘텐츠를 작성하고 배포하는 콘텐츠관리시스템입니다.', keywords: ['웹', '콘텐츠', '게시', '페이지', 'content'] },
  ],
  ECR: [
    { full: 'Engine Control Room', meaning: '선박의 주기관과 보조기기 상태를 감시하고 제어하는 기관제어실입니다.', keywords: ['선박', '엔진', '기관', '운항', 'engine'] },
    { full: 'Engineering Change Request', meaning: '설계, 사양 또는 구현 내용을 변경하기 위해 검토와 승인을 요청하는 기술변경요청입니다.', keywords: ['변경', '설계', '승인', '사양', 'change'] },
  ],
  DCS: [
    { full: 'Distributed Control System', meaning: '공정이나 설비의 제어 기능을 여러 제어기에 분산하여 운영하는 분산제어시스템입니다.', keywords: ['제어', '설비', '공정', '플랜트', 'distributed'] },
    { full: 'Data Collection System', meaning: '여러 장비나 시스템에서 데이터를 모아 저장·전달하는 데이터수집시스템입니다.', keywords: ['데이터', '수집', '센서', 'collection'] },
  ],
  ABS: [
    { full: 'American Bureau of Shipping', meaning: '선박과 해양 구조물의 안전·기술 기준을 제정하고 검사·인증하는 미국선급협회입니다.', keywords: ['선박', '해양', '선급', '조선', 'vessel', 'ship'] },
    { full: 'Anti-lock Braking System', meaning: '급제동 시 바퀴가 잠기는 것을 방지하여 조향 가능성을 유지하는 제동장치입니다.', keywords: ['차량', '자동차', '브레이크', '제동', 'wheel'] },
  ],
  PM: [
    { full: 'Project Manager', meaning: '프로젝트의 범위, 일정, 비용, 품질, 위험과 이해관계자를 총괄 관리하는 책임자입니다.', keywords: ['프로젝트', '일정', '사업', '관리', 'project'] },
    { full: 'Preventive Maintenance', meaning: '고장이 발생하기 전에 점검과 부품 교체를 계획적으로 수행하는 예방정비입니다.', keywords: ['정비', '장비', '설비', '고장', 'maintenance'] },
  ],
  FAT: [
    { full: 'Factory Acceptance Test', meaning: '장비나 시스템을 현장에 반입하기 전 제작사 공장에서 발주 기준 충족 여부를 확인하는 공장인수시험입니다.', keywords: ['장비', '제작', '공장', '인수', '시험', 'factory'] },
    { full: 'File Allocation Table', meaning: '저장장치에서 파일이 어느 위치에 저장되었는지 관리하는 파일시스템 구조입니다.', keywords: ['파일', '디스크', '저장장치', 'filesystem'] },
  ],
  'OFF-BOARDING': [
    { full: 'User / Employee Off-boarding', meaning: '퇴사·계약 종료·역할 변경 시 계정과 접근 권한을 회수하고 자료와 인수인계를 정리하는 절차입니다.', keywords: ['사용자', '계정', '권한', '퇴사', '인사', '직원', 'user', 'employee'] },
    { full: 'Device / Service Off-boarding', meaning: '장비나 서비스를 시스템에서 등록 해제하고 인증서, 연결 정보와 남은 데이터를 안전하게 정리하는 절차입니다.', keywords: ['장비', '노드', '선박', '서비스', '인증서', '등록', 'device', 'node'] },
  ],
};

const COMMON_TERM_DEFINITIONS = [
  { term: 'DB', full: 'Database', meaning: '업무에 필요한 데이터를 구조적으로 저장하고 조회·수정할 수 있게 만든 데이터 저장소입니다.' },
  { term: 'DBMS', full: 'Database Management System', meaning: '데이터베이스를 생성하고 조회·수정·백업하도록 관리하는 소프트웨어입니다.' },
  { term: 'HTTP', full: 'Hypertext Transfer Protocol', meaning: '웹브라우저와 서버가 요청과 응답을 주고받을 때 사용하는 통신 규칙입니다.' },
  { term: 'HTTPS', full: 'Hypertext Transfer Protocol Secure', meaning: 'HTTP 통신을 TLS로 암호화하여 도청과 변조를 막는 웹 통신 방식입니다.' },
  { term: 'JSON', full: 'JavaScript Object Notation', meaning: '시스템 사이에서 구조화된 데이터를 주고받을 때 널리 사용하는 텍스트 형식입니다.' },
  { term: 'XML', full: 'Extensible Markup Language', meaning: '태그를 사용해 데이터의 구조와 의미를 표현하는 문서·데이터 교환 형식입니다.' },
  { term: 'CSV', full: 'Comma-Separated Values', meaning: '표 데이터를 각 행과 쉼표로 구분해 저장하는 단순한 텍스트 파일 형식입니다.' },
  { term: 'VPN', full: 'Virtual Private Network', meaning: '인터넷을 통해 접속하더라도 사설망처럼 암호화된 통신 경로를 만드는 기술입니다.' },
  { term: 'DNS', full: 'Domain Name System', meaning: '사람이 읽는 인터넷 주소를 서버의 IP 주소로 찾아 연결해 주는 체계입니다.' },
  { term: 'IP', full: 'Internet Protocol', meaning: '네트워크에서 장치를 식별하고 데이터가 목적지까지 전달되게 하는 주소·통신 규칙입니다.' },
  { term: 'TCP', full: 'Transmission Control Protocol', meaning: '데이터가 순서대로 빠짐없이 도착하도록 연결 상태와 재전송을 관리하는 통신 방식입니다.' },
  { term: 'UDP', full: 'User Datagram Protocol', meaning: '도착 확인보다 빠른 전송을 우선하는 비연결형 통신 방식입니다.' },
  { term: 'SDK', full: 'Software Development Kit', meaning: '특정 서비스나 플랫폼용 프로그램을 만들 때 필요한 라이브러리, 도구와 문서를 묶은 개발도구입니다.' },
  { term: 'CI/CD', full: 'Continuous Integration / Continuous Delivery', meaning: '코드의 빌드·시험·배포를 반복적으로 자동화하는 개발 운영 방식입니다.' },
  { term: 'KPI', full: 'Key Performance Indicator', meaning: '목표 달성 정도를 측정하기 위해 정한 핵심 성과 지표입니다.' },
  { term: 'PoC', full: 'Proof of Concept', meaning: '아이디어나 기술이 실제로 가능한지 작은 범위에서 먼저 검증하는 개념검증입니다.' },
  { term: 'CRUD', full: 'Create, Read, Update, Delete', meaning: '데이터를 생성하고 조회하고 수정하고 삭제하는 네 가지 기본 처리 기능입니다.' },
  { term: 'RBAC', full: 'Role-Based Access Control', meaning: '사용자에게 직접 권한을 하나씩 주지 않고 역할에 권한을 묶어 부여하는 접근통제 방식입니다.' },
  { term: 'NFR', full: 'Non-Functional Requirement', meaning: '기능 자체가 아니라 성능, 보안, 가용성, 운영성처럼 시스템의 품질 조건을 정한 비기능 요구사항입니다.' },
];

const DOMAIN_TERM_DEFINITIONS = [
  { term: 'IMO', full: 'International Maritime Organization', meaning: '선박 안전, 해양 환경보호와 국제 해운 규칙을 다루는 국제연합 전문기구인 국제해사기구입니다.' },
  { term: 'SOLAS', full: 'International Convention for the Safety of Life at Sea', meaning: '선박의 구조, 설비와 운항에 필요한 국제 안전 기준을 정한 해상인명안전협약입니다.' },
  { term: 'MARPOL', full: 'International Convention for the Prevention of Pollution from Ships', meaning: '선박에서 발생하는 기름, 오수, 폐기물과 대기오염 등을 방지하기 위한 국제협약입니다.' },
  { term: 'EEXI', full: 'Energy Efficiency Existing Ship Index', meaning: '기존 선박의 설계상 에너지 효율과 이산화탄소 배출 성능을 평가하는 국제 지표입니다.' },
  { term: 'SEEMP', full: 'Ship Energy Efficiency Management Plan', meaning: '선박의 연료 사용과 에너지 효율을 지속적으로 개선하기 위한 선박에너지효율관리계획입니다.' },
  { term: 'DNV', full: 'Det Norske Veritas', meaning: '선박, 해양·에너지 설비 등의 안전성과 품질을 검사하고 인증하는 국제 선급·인증기관입니다.' },
  { term: 'KR', full: 'Korean Register', meaning: '선박과 해양 구조물의 검사, 선급 등록과 기술 인증을 수행하는 한국선급입니다.' },
  { term: 'ABS', full: 'American Bureau of Shipping', meaning: '선박과 해양 구조물의 안전·기술 기준을 제정하고 검사·인증하는 미국선급협회입니다.' },
  { term: 'PLC', full: 'Programmable Logic Controller', meaning: '공장이나 선박 설비의 센서 신호를 받아 정해진 논리에 따라 장비를 자동 제어하는 산업용 제어기입니다.' },
  { term: 'SCADA', full: 'Supervisory Control and Data Acquisition', meaning: '여러 설비의 상태 데이터를 원격으로 수집하고 감시·제어하는 산업용 통합 감시제어시스템입니다.' },
  { term: 'HVAC', full: 'Heating, Ventilation, and Air Conditioning', meaning: '건물이나 선박 내부의 온도, 습도와 공기질을 관리하는 냉난방·환기·공조 설비입니다.' },
  { term: 'BOM', full: 'Bill of Materials', meaning: '제품이나 설비를 만들 때 필요한 부품, 원재료, 수량과 계층 관계를 정리한 자재명세서입니다.' },
  { term: 'CAD', full: 'Computer-Aided Design', meaning: '컴퓨터를 이용해 제품, 기계, 배관이나 건축 도면을 작성하고 수정하는 설계 방식과 도구입니다.' },
  { term: 'CAE', full: 'Computer-Aided Engineering', meaning: '컴퓨터 해석과 시뮬레이션으로 구조, 열, 유체 등의 설계 성능을 검토하는 공학 지원 기술입니다.' },
  { term: 'FMEA', full: 'Failure Mode and Effects Analysis', meaning: '제품이나 공정에서 발생할 수 있는 고장 형태와 영향, 원인을 미리 분석해 위험을 줄이는 기법입니다.' },
  { term: 'FAT', full: 'Factory Acceptance Test', meaning: '장비나 시스템을 현장에 반입하기 전 제작사 공장에서 발주 기준 충족 여부를 확인하는 공장인수시험입니다.' },
  { term: 'SAT', full: 'Site Acceptance Test', meaning: '설치가 완료된 실제 현장에서 장비나 시스템이 계약 기준대로 작동하는지 확인하는 현장인수시험입니다.' },
  { term: 'QA', full: 'Quality Assurance', meaning: '결과물의 품질이 일정 수준을 만족하도록 절차와 체계를 계획하고 예방적으로 관리하는 품질보증 활동입니다.' },
  { term: 'QC', full: 'Quality Control', meaning: '검사와 시험을 통해 제품이나 결과물이 정해진 품질 기준을 만족하는지 확인하는 품질관리 활동입니다.' },
  { term: 'HSE', full: 'Health, Safety, and Environment', meaning: '사업과 작업 현장의 보건, 안전과 환경 영향을 통합하여 관리하는 체계입니다.' },
  { term: 'ESG', full: 'Environmental, Social, and Governance', meaning: '조직의 환경, 사회적 책임과 지배구조 측면의 지속가능성을 평가·관리하는 기준입니다.' },
  { term: 'RFI', full: 'Request for Information', meaning: '사업 추진 전 시장의 기술, 제품과 수행 가능 정보를 파악하기 위해 공급자에게 정보를 요청하는 문서입니다.' },
  { term: 'RFQ', full: 'Request for Quotation', meaning: '정해진 제품이나 업무 범위에 대한 가격과 거래 조건을 공급자에게 요청하는 견적요청서입니다.' },
  { term: 'SOW', full: 'Statement of Work', meaning: '수행할 업무 범위, 산출물, 일정, 책임과 완료 기준을 구체적으로 정리한 과업기술서입니다.' },
  { term: 'TOR', full: 'Terms of Reference', meaning: '과업의 목적, 범위, 수행 방법, 역할, 산출물과 보고 체계를 정한 과업지시 조건입니다.' },
  { term: 'ROI', full: 'Return on Investment', meaning: '투자한 비용에 비해 어느 정도의 이익이나 효과를 얻었는지를 나타내는 투자수익률입니다.' },
  { term: 'TCO', full: 'Total Cost of Ownership', meaning: '구매비뿐 아니라 운영, 유지보수, 교육과 폐기까지 포함한 전체 소유 비용입니다.' },
  { term: 'CAPEX', full: 'Capital Expenditure', meaning: '설비, 건물, 시스템처럼 장기간 사용하는 자산을 취득하거나 개선하기 위한 자본적 지출입니다.' },
  { term: 'OPEX', full: 'Operating Expenditure', meaning: '서비스 운영, 인건비, 유지보수와 소모품 등에 반복적으로 들어가는 운영비용입니다.' },
  { term: 'ISO', full: 'International Organization for Standardization', meaning: '산업과 서비스 전반의 국제 표준을 개발·발행하는 국제표준화기구입니다.' },
  { term: 'KS', full: 'Korean Industrial Standards', meaning: '제품, 시험방법, 서비스와 생산방식 등에 대해 국가가 정한 한국산업표준입니다.' },
];

const PLAIN_LANGUAGE_TERM_DEFINITIONS = [
  { term: '상호운용성', full: 'Interoperability', meaning: '서로 다른 장비나 시스템이 별도 변환 작업을 최소화하면서 정보와 기능을 주고받아 함께 작동할 수 있는 성질입니다.', aliases: ['상호 운용성'] },
  { term: '가용성', full: 'Availability', meaning: '사용자가 필요할 때 시스템이나 기능을 정상적으로 이용할 수 있는 정도입니다.' },
  { term: '확장성', full: 'Scalability', meaning: '사용자나 데이터가 늘어날 때 서버 등의 자원을 추가해 처리 능력을 키울 수 있는 성질입니다.' },
  { term: '무결성', full: 'Integrity', meaning: '데이터가 허가 없이 바뀌거나 훼손되지 않고 정확한 상태를 유지하는 성질입니다.' },
  { term: '추적성', full: 'Traceability', meaning: '요구사항이 어떤 설계·개발·시험 결과로 이어졌는지 앞뒤 관계와 변경 이력을 따라가 확인할 수 있는 성질입니다.' },
  { term: '데이터 거버넌스', full: 'Data Governance', meaning: '데이터의 소유자, 품질, 보안, 표준과 사용 규칙을 조직 차원에서 정하고 관리하는 체계입니다.', aliases: ['데이터거버넌스'] },
  { term: '라이프사이클', full: 'Lifecycle', meaning: '대상이 만들어지고 사용·변경되다가 폐기되기까지 거치는 전체 단계를 뜻합니다.', aliases: ['수명주기', '생명주기'] },
  { term: '레거시', full: 'Legacy System', meaning: '오래전부터 사용해 왔으며 새 시스템과 함께 유지하거나 전환해야 하는 기존 시스템을 뜻합니다.', aliases: ['레거시 시스템'] },
  { term: '마이그레이션', full: 'Migration', meaning: '데이터나 프로그램을 기존 환경에서 새 환경으로 옮기고 정상 작동을 확인하는 작업입니다.', aliases: ['이관'] },
  { term: '롤백', full: 'Rollback', meaning: '배포나 변경에 문제가 생겼을 때 직전의 정상 상태로 되돌리는 조치입니다.' },
  { term: '엔드포인트', full: 'Endpoint', meaning: '다른 시스템이 기능이나 데이터를 요청할 수 있도록 공개한 구체적인 접속 주소 또는 통신 지점입니다.', aliases: ['Endpoint'] },
  { term: '페이로드', full: 'Payload', meaning: '통신 메시지에서 실제로 전달하려는 업무 데이터 부분입니다.', aliases: ['Payload'] },
  { term: '스키마', full: 'Schema', meaning: '데이터에 어떤 항목이 있고 각 항목의 형식과 관계가 무엇인지 정한 구조 규칙입니다.', aliases: ['Schema'] },
  { term: '웹훅', full: 'Webhook', meaning: '특정 사건이 발생했을 때 한 시스템이 미리 등록된 다른 시스템 주소로 자동 알림을 보내는 방식입니다.', aliases: ['Webhook'] },
  { term: '스로틀링', full: 'Throttling', meaning: '짧은 시간에 요청이 지나치게 몰리지 않도록 처리 속도나 호출 횟수를 제한하는 방식입니다.', aliases: ['Throttling', '호출 제한'] },
  { term: '서비스 메시', full: 'Service Mesh', meaning: '여러 작은 서비스 사이의 통신, 보안, 장애 처리와 관찰 기능을 공통으로 관리하는 기반 구조입니다.', aliases: ['Service Mesh'] },
];

const GLOSSARY_DICTIONARY = [...GLOSSARY, ...COMMON_TERM_DEFINITIONS, ...DOMAIN_TERM_DEFINITIONS, ...PLAIN_LANGUAGE_TERM_DEFINITIONS];

const QUESTION_TEMPLATES = {
  'UI/UX': {
    기능: ['{name}의 주요 사용자 유형과 권한별 이용 흐름은 어떻게 정의되어 있나요?', '{name} 수행 중 입력 오류·취소·재시도 상황의 화면 처리 기준이 있나요?'],
    성능: ['응답시간이 목표를 초과할 때 사용자에게 제공할 로딩·지연 안내 기준이 있나요?'],
    인터페이스: ['외부 연계가 지연되거나 실패했을 때 사용자 화면에 표시할 상태와 재시도 방식은 무엇인가요?'],
    데이터: ['데이터가 없거나 일부만 조회될 때 사용할 빈 상태와 안내 메시지가 정의되어 있나요?'],
    보안: ['인증 실패, 세션 만료, 접근 거부 상황별 사용자 안내와 복구 흐름은 무엇인가요?'],
    시스템장비: ['장비 장애 또는 전환 중 사용자에게 서비스 상태를 어떻게 안내해야 하나요?'],
    테스트: ['사용자 인수시험에 포함할 핵심 사용자 여정과 접근성 기준은 무엇인가요?'],
    기타: ['{name}의 대상 사용자, 주요 화면, 완료 조건과 예외 흐름을 구체적으로 확인해 주세요.'],
  },
  개발: {
    기능: ['{name}의 상세 업무 규칙, 입력값 검증, 예외 처리와 완료 조건은 무엇인가요?', '{name}에 필요한 권한 체계와 감사 로그 범위를 확인해 주세요.'],
    성능: ['성능 목표의 측정 구간, 부하 조건, 데이터 규모와 합격 기준을 구체적으로 확인해 주세요.'],
    인터페이스: ['연계 대상의 API 명세, 인증 방식, 호출 주기, 타임아웃과 실패 재처리 정책을 제공할 수 있나요?'],
    데이터: ['데이터 항목 정의, 소유 시스템, 정합성 규칙, 보존 기간과 이관 범위는 무엇인가요?'],
    보안: ['적용할 암호화 알고리즘, 키 관리, 접근통제, 로그 보존과 취약점 조치 기준은 무엇인가요?'],
    시스템장비: ['요구 사양의 산정 근거, 이중화 방식, 증설 기준과 장애 전환 조건은 무엇인가요?'],
    테스트: ['시험 환경, 테스트 데이터, 결함 등급, 재시험과 최종 승인 기준은 무엇인가요?'],
    제약사항: ['준수 대상 법령·지침의 버전과 적용 범위, 예외 승인 절차를 확인해 주세요.'],
    운영: ['모니터링 대상, 알림 임계치, 장애 등급, 대응 시간과 에스컬레이션 절차는 무엇인가요?'],
    프로젝트관리: ['산출물 양식, 제출 주기, 승인권자와 변경관리 절차를 확인해 주세요.'],
    기타: ['{name}의 입력·처리·출력, 연계 대상, 비기능 조건과 검수 기준을 구체적으로 확인해 주세요.'],
  },
};

const sampleRequirements = [
  {
    key: 'sample-1', id: 'COR-001', category: '제약사항', name: '개발 표준 준수',
    description: '시스템 개발 표준 정의서를 작성하고 이를 준수하여 서비스 구현 과정을 관리하여야 한다.',
    priority: '높음', status: '확정', confidence: 97, source: '18페이지 · 3.1절', section: '제약사항 요구사항', basis: '명시 ID',
    tags: ['개발표준', '준수'], acceptance: '수용', applicationPlan: '착수 단계에서 개발 표준서를 작성하고 형상관리 저장소에 등록한다.', owner: '김서준 (개발팀)', changeHistory: 'v1.0 최초 등록', completion: '진행 중',
    questions: [{ key: 'q-sample-1', perspective: '개발', question: '준수 대상 개발 표준의 최신 버전과 예외 승인 절차를 확인해 주세요.', answer: '착수 후 발주기관이 최신 표준서를 제공합니다.' }],
  },
  {
    key: 'sample-2', id: 'COR-002', category: '제약사항', name: '정보시스템 구축 규정 및 표준 준수',
    description: '행정기관 및 공공기관 정보시스템 구축·운영 지침과 관련 법령을 준수하여야 한다.',
    priority: '높음', status: '검토 중', confidence: 96, source: '19페이지 · 3.1절', section: '제약사항 요구사항', basis: '명시 ID',
    tags: ['법령', '공공'], acceptance: '수용', applicationPlan: '준수 대상 체크리스트를 품질계획서에 포함한다.', owner: '이하은 (품질팀)', changeHistory: '', completion: '미완료',
  },
  {
    key: 'sample-3', id: 'SFR-001', category: '기능', name: '통합 사용자 인증',
    description: '사용자는 하나의 계정으로 포털과 업무 시스템에 로그인할 수 있어야 하며 관리자는 계정 상태를 관리할 수 있어야 한다.',
    priority: '높음', status: '확정', confidence: 95, source: '24페이지 · 4.2절', section: '기능 요구사항', basis: '명시 ID',
    tags: ['로그인', '사용자'], acceptance: '수용', applicationPlan: 'SSO 기반 통합 인증 모듈과 관리자 화면을 구축한다.', owner: '박지호 (플랫폼팀)', changeHistory: 'v1.1 MFA 범위 추가', completion: '완료',
  },
  {
    key: 'sample-4', id: 'SFR-002', category: '기능', name: '사용자 권한별 메뉴 제공',
    description: '사용자의 역할과 권한에 따라 접근 가능한 메뉴와 기능을 차등 제공하여야 한다.',
    priority: '보통', status: '검토 전', confidence: 91, source: '25페이지 · 4.2절', section: '기능 요구사항', basis: '명시 ID',
    tags: ['권한', '메뉴'], acceptance: '미검토', applicationPlan: '', owner: '', changeHistory: '', completion: '미완료',
  },
  {
    key: 'sample-5', id: 'PER-001', category: '성능', name: '주요 화면 응답시간 보장',
    description: '동시 사용자 1,000명 환경에서 주요 화면의 95%는 3초 이내에 응답하여야 한다.',
    priority: '높음', status: '검토 중', confidence: 98, source: '37페이지 · 5.1절', section: '성능 요구사항', basis: '명시 ID',
    tags: ['응답시간', '부하'], acceptance: '조건부 수용', applicationPlan: '부하 테스트 시나리오와 성능 튜닝 기준을 수립한다.', owner: '최윤아 (인프라팀)', changeHistory: '동시 사용자 800→1,000명', completion: '진행 중',
  },
  {
    key: 'sample-6', id: 'ECR-001', category: '시스템장비', name: '애플리케이션 서버 이중화',
    description: '서비스 연속성을 위해 애플리케이션 서버는 이중화로 구성하고 장애 시 자동 전환되어야 한다.',
    priority: '높음', status: '검토 전', confidence: 94, source: '41페이지 · 5.3절', section: '시스템장비 구성 요구사항', basis: '명시 ID',
    tags: ['서버', '이중화'], acceptance: '미검토', applicationPlan: '', owner: '정민준 (인프라팀)', changeHistory: '', completion: '미완료',
  },
  {
    key: 'sample-7', id: 'SIR-001', category: '인터페이스', name: '외부 행정정보 시스템 연계',
    description: '외부 행정정보 시스템과 표준 REST API 방식으로 데이터를 송수신하고 연계 오류 내역을 기록하여야 한다.',
    priority: '높음', status: '검토 중', confidence: 97, source: '44페이지 · 6.1절', section: '인터페이스 요구사항', basis: '명시 ID',
    tags: ['REST API', '연계'], acceptance: '수용', applicationPlan: 'API Gateway와 연계 모니터링 로그를 적용한다.', owner: '한도윤 (연계팀)', changeHistory: '', completion: '진행 중',
    questions: [{ key: 'q-sample-2', perspective: 'UI/UX', question: '외부 연계 실패 시 사용자에게 표시할 오류 메시지와 재시도 방식은 무엇인가요?', answer: '' }, { key: 'q-sample-3', perspective: '개발', question: '연계 API의 인증 방식, 타임아웃, 재처리 정책을 제공할 수 있나요?', answer: '' }],
  },
  {
    key: 'sample-8', id: 'DAR-001', category: '데이터', name: '기준정보 데이터 표준화',
    description: '기준정보를 관리하기 위한 코드관리 체계와 데이터 표준화 방안을 수립하고 데이터 정합성을 검증하여야 한다.',
    priority: '보통', status: '검토 전', confidence: 93, source: '48페이지 · 7.1절', section: '데이터 요구사항', basis: '명시 ID',
    tags: ['기준정보', '표준화'], acceptance: '미검토', applicationPlan: '', owner: '', changeHistory: '', completion: '미완료',
  },
  {
    key: 'sample-9', id: 'SER-001', category: '보안', name: '개인정보 암호화 및 접근통제',
    description: '개인정보는 저장 및 전송 시 안전한 알고리즘으로 암호화하고 권한 없는 사용자의 접근을 차단하여야 한다.',
    priority: '높음', status: '확정', confidence: 99, source: '53페이지 · 8.2절', section: '보안 요구사항', basis: '명시 ID',
    tags: ['개인정보', '암호화'], acceptance: '수용', applicationPlan: 'AES-256 저장 암호화와 TLS 1.3 전송 암호화를 적용한다.', owner: '서예린 (보안팀)', changeHistory: '', completion: '완료',
  },
  {
    key: 'sample-10', id: 'TER-001', category: '테스트', name: '통합 및 인수시험 수행',
    description: '기능·성능·보안 요구사항을 기준으로 통합시험과 사용자 인수시험을 수행하고 결함 조치 결과를 제출하여야 한다.',
    priority: '보통', status: '검토 전', confidence: 94, source: '61페이지 · 9.1절', section: '테스트 요구사항', basis: '명시 ID',
    tags: ['통합시험', '인수시험'], acceptance: '미검토', applicationPlan: '', owner: '이하은 (품질팀)', changeHistory: '', completion: '미완료',
  },
  {
    key: 'sample-11', id: 'SOR-001', category: '운영', name: '장애 모니터링 및 통보',
    description: '시스템 주요 자원의 상태를 실시간 모니터링하고 장애 발생 시 담당자에게 즉시 통보하여야 한다.',
    priority: '높음', status: '검토 중', confidence: 93, source: '66페이지 · 10.1절', section: '운영 요구사항', basis: '명시 ID',
    tags: ['모니터링', '장애'], acceptance: '수용', applicationPlan: 'APM과 통합 알림 채널을 구성한다.', owner: '정민준 (인프라팀)', changeHistory: '', completion: '진행 중',
  },
  {
    key: 'sample-12', id: 'PMR-001', category: '프로젝트관리', name: '주간 진도 및 위험 보고',
    description: '사업자는 주간 단위로 진도, 이슈, 위험, 변경 사항을 정리하여 발주기관에 보고하여야 한다.',
    priority: '보통', status: '검토 전', confidence: 90, source: '72페이지 · 11.2절', section: '프로젝트관리 요구사항', basis: '명시 ID',
    tags: ['진도', '위험관리'], acceptance: '미검토', applicationPlan: '', owner: '오수빈 (PMO)', changeHistory: '', completion: '미완료',
  },
];

const sampleDocument = {
  name: '공공 서비스 통합 플랫폼 구축 RFP.pdf', type: 'PDF', size: 4289012,
  pages: 86, characters: 48392, demo: true,
};

const elements = {};
let state = {
  projectId: makeProjectId(),
  document: null,
  references: [],
  requirements: [],
  selected: new Set(),
  editingKey: null,
  query: '', category: 'all', status: 'all', priority: 'all', flag: 'all',
  idPath: [], sort: 'sourceOrder', sortDirection: 1,
  draftQuestions: [],
  draftGlossary: [], visibleGlossary: [], remoteGlossary: [], draftExplanationSources: [], currentGlossaryTerm: null,
  glossaryDetectionRequested: false,
  relationMap: new Map(),
};

function $(id) { return document.getElementById(id); }
function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function makeKey() { return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function makeProjectId() { return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function normalizeRequirement(item, index = 0) {
  const keyOrder = Number(String(item.key || '').match(/^(?:req|sample)-(\d+)$/)?.[1]);
  const sourceOrder = Number.isFinite(Number(item.sourceOrder)) ? Number(item.sourceOrder)
    : Number.isFinite(keyOrder) ? keyOrder : Number.MAX_SAFE_INTEGER - 100000 + index;
  return {
    key: item.key || makeKey(), id: item.id || '', name: item.name || '요구사항', description: item.description || '',
    sourceOrder,
    category: CATEGORIES.some(c => c.name === item.category) ? item.category : '기타',
    priority: ['높음', '보통', '낮음'].includes(item.priority) ? item.priority : '보통',
    status: ['검토 전', '검토 중', '확정'].includes(item.status) ? item.status : '검토 전',
    flag: FLAG_OPTIONS.some(option => option.value === item.flag) ? item.flag : '',
    confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 100,
    source: item.source || '수동 추가', section: item.section || '수동 등록', basis: item.basis || '수동 등록',
    tags: Array.isArray(item.tags) ? item.tags : [],
    acceptance: item.acceptance || '미검토', applicationPlan: item.applicationPlan || '', owner: item.owner || '',
    changeHistory: item.changeHistory || '', completion: item.completion || '미완료',
    easyExplanation: item.easyExplanation === '원문 내용을 쉬운 말로 설명할 정보가 아직 없습니다.' ? '' : (item.easyExplanation || ''),
    explanationSources: Array.isArray(item.explanationSources) ? item.explanationSources : [],
    manualGlossary: Array.isArray(item.manualGlossary) ? item.manualGlossary.filter(entry => entry && entry.term && entry.meaning).map(entry => ({
      term: String(entry.term), full: String(entry.full || ''), meaning: String(entry.meaning), manual: true,
    })) : [],
    questions: Array.isArray(item.questions) ? item.questions.map(question => ({
      key: question.key || `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      perspective: ['UI/UX', '개발', '직접'].includes(question.perspective) ? question.perspective : '직접',
      question: question.question || '', answer: question.answer || '',
    })) : [],
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

function cacheElements() {
  [
    'navCount', 'sidebarProject', 'sidebar', 'mobileScrim', 'menuButton', 'clearProject', 'sampleButton', 'uploadButton', 'fileInput',
    'documentType', 'documentName', 'documentBadge', 'documentMeta', 'documentBanner', 'reviewProgressText', 'reviewProgressBar',
    'referencePanel', 'referenceButton', 'referenceInput', 'referenceList', 'referenceCount',
    'metricTotal', 'metricNew', 'metricConfirmed', 'metricConfirmedRate', 'metricCompleted', 'listDescription',
    'exportButton', 'exportMenu', 'qaExportButton', 'qaCount', 'addButton', 'searchInput', 'categoryFilter', 'statusFilter', 'priorityFilter', 'flagFilter', 'sortFilter', 'filterReset',
    'categoryStrip', 'idHierarchyFilter', 'idHierarchyPath', 'idHierarchyReset', 'idHierarchyLevels', 'bulkBar', 'selectedCount', 'bulkPriority', 'bulkStatus', 'bulkFlag', 'bulkApply', 'bulkDelete', 'selectAll', 'requirementsBody', 'mobileList', 'emptyState',
    'emptyUpload', 'emptySample', 'resultCount', 'drawerBackdrop', 'detailDrawer', 'drawerClose', 'drawerTitle', 'requirementForm',
    'formConfidence', 'formSource', 'formId', 'idError', 'formCategory', 'formName', 'nameCount', 'formDescription',
    'descriptionCount', 'relationPanel', 'relationBody', 'relationCount', 'relationList', 'toggleRelations', 'easyExplanationPanel', 'easyExplanationBody', 'toggleEasyExplanation', 'easyExplanationRequest', 'easyExplanationContent', 'generateEasyExplanation', 'regenerateEasyExplanation', 'formEasyExplanation', 'easyExplanationCount', 'easyExplanationBasis', 'formPriority', 'formStatus', 'formFlag', 'formTags', 'formSourceInput', 'formAcceptance', 'formCompletion',
    'formApplicationPlan', 'formOwner', 'formChangeHistory', 'glossaryPanel', 'glossaryBody', 'toggleGlossary', 'formGlossaryTerms', 'termDefinition', 'termAcronym', 'termName', 'termMeaning', 'termContextNote', 'termCandidates', 'termSource', 'glossarySearchInput', 'glossarySearchButton', 'glossarySearchGuide', 'detectGlossaryButton', 'manualGlossaryToggle', 'manualGlossaryEditor', 'manualTerm', 'manualFull', 'manualMeaning', 'manualGlossaryCancel', 'manualGlossarySave', 'manualGlossaryRemove',
    'formQuestionCount', 'formQuestionList', 'addDirectQuestion', 'deleteButton', 'duplicateButton', 'cancelButton',
    'relationCompareModal', 'compareType', 'compareTitle', 'compareReason', 'compareHighlightLegend', 'compareCurrentCard', 'compareTargetCard', 'compareClose', 'compareDone',
    'analysisOverlay', 'analysisTitle', 'analysisSubtitle', 'analysisProgress', 'toastStack',
  ].forEach(id => { elements[id] = $(id); });
}

function saveWorkspace() {
  window.ReqlyPortal?.saveWorkspace({ projectId: state.projectId, document: state.document, references: state.references, requirements: state.requirements });
}

function restoreWorkspace(saved) {
  state.projectId = saved?.projectId || window.ReqlyPortal?.project?.id || makeProjectId();
  state.document = saved?.document || null;
  state.references = Array.isArray(saved?.references) ? saved.references : [];
  state.requirements = Array.isArray(saved?.requirements) ? saved.requirements.map(normalizeRequirement) : [];
}

function loadSample(notify = true) {
  state.projectId = window.ReqlyPortal?.project?.id || state.projectId;
  state.document = { ...sampleDocument };
  state.references = [];
  state.requirements = sampleRequirements.map(item => normalizeRequirement({
    ...item, tags: [...item.tags], questions: (item.questions || []).map(question => ({ ...question })),
  }));
  state.selected.clear();
  resetFilters(false);
  saveWorkspace();
  render();
  if (notify) showToast('샘플 RFP를 불러왔습니다', '요구사항 편집, 필터, 내보내기를 바로 체험할 수 있습니다.');
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function categoryCode(name) { return CATEGORIES.find(item => item.name === name)?.code || 'ETC'; }
function requirementIdHierarchy(id) {
  const parts = String(id || '').trim().split(/[-_./\s]+/).map(part => part.trim().toUpperCase()).filter(Boolean);
  if (parts.length && /^\d+$/.test(parts.at(-1))) parts.pop();
  else if (parts.length === 1) {
    const contiguous = parts[0].match(/^(.+?)(\d+)$/);
    if (contiguous) parts[0] = contiguous[1];
  }
  return parts;
}
function matchesIdPath(item, path = state.idPath) {
  const hierarchy = requirementIdHierarchy(item.id);
  return path.every((part, index) => hierarchy[index] === part);
}

const RELATION_STOPWORDS = new Set([
  '요구사항', '시스템', '기능', '관련', '대한', '위한', '통해', '해야', '하여야', '한다', '있다', '있는',
  '지원', '제공', '적용', '구축', '관리', '기준', '경우', '해당', '모든', '수행', '사용', '이용', '그리고',
  '또는', '포함', '필요', '가능', '내용', '정보', '데이터', '서비스', 'shall', 'must', 'with', 'from', 'that',
]);

function relationTokens(item) {
  const source = `${item.name || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
  return new Set((source.match(/[a-z가-힣0-9]{2,}/g) || []).map(token => token
    .replace(/(?:으로|에서|까지|부터|에게|에는|에도|이며|하고|하는|하도록|해야|하여|한다|됩니다|으로써)$/u, '')
    .replace(/(?:을|를|이|가|은|는|의|에|와|과|도)$/u, ''))
    .filter(token => token.length >= 2 && !RELATION_STOPWORDS.has(token) && !/^\d+$/.test(token)));
}

function numericConstraints(text) {
  const constraints = [];
  const pattern = /(최소|최대)?\s*(\d+(?:\.\d+)?)\s*(ms|밀리초|초|분|시간|%|퍼센트|건|명|개|회)\s*(이상|이하|미만|초과|이내)?/gi;
  for (const match of String(text || '').matchAll(pattern)) {
    const marker = `${match[1] || ''} ${match[4] || ''}`;
    const direction = /최소|이상|초과/.test(marker) ? 'min' : /최대|이하|미만|이내/.test(marker) ? 'max' : '';
    if (direction) constraints.push({ direction, value: Number(match[2]), unit: match[3].toLowerCase(), raw: match[0].trim() });
  }
  return constraints;
}

function conflictReason(left, right, commonTokens = [], similarity = 0) {
  const leftText = `${left.name} ${left.description}`;
  const rightText = `${right.name} ${right.description}`;
  // A shared broad category such as "보안" is not enough evidence of a
  // contradiction. Require several shared subject words before comparing
  // opposite constraints.
  const sameSubject = commonTokens.length >= 2 && similarity >= 0.25;
  if (!sameSubject) return '';
  const leftConstraints = numericConstraints(leftText);
  const rightConstraints = numericConstraints(rightText);
  for (const first of leftConstraints) {
    for (const second of rightConstraints) {
      if (first.unit !== second.unit || first.direction === second.direction) continue;
      const minimum = first.direction === 'min' ? first : second;
      const maximum = first.direction === 'max' ? first : second;
      if (minimum.value > maximum.value) return `수치 조건이 맞지 않을 수 있음: ${minimum.raw} ↔ ${maximum.raw}`;
    }
  }

  // “금지”와 “허용”, “필수”와 “선택” 같은 단어만으로는 두 요구사항이
  // 실제로 충돌하는지 확정할 수 없다. 예를 들어 “취약 알고리즘 금지”와
  // “승인 알고리즘 사용”은 반대말을 포함하지만 서로 보완적이다. 브라우저의
  // 자동 판정은 명확한 수치 범위 충돌에만 한정하여 오탐을 줄인다.
  return '';
}

function analyzeRequirementRelations() {
  const relations = new Map(state.requirements.map(item => [item.key, []]));
  const tokenSets = new Map(state.requirements.map(item => [item.key, relationTokens(item)]));
  const tokenIndex = new Map();
  state.requirements.forEach(item => tokenSets.get(item.key).forEach(token => {
    if (!tokenIndex.has(token)) tokenIndex.set(token, []);
    tokenIndex.get(token).push(item.key);
  }));

  const overlaps = new Map();
  tokenIndex.forEach((keys, token) => {
    if (keys.length > 80) return;
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const pair = [keys[i], keys[j]].sort();
        const pairKey = pair.join('\u0000');
        if (!overlaps.has(pairKey)) overlaps.set(pairKey, { keys: pair, tokens: [] });
        overlaps.get(pairKey).tokens.push(token);
      }
    }
  });

  const byKey = new Map(state.requirements.map(item => [item.key, item]));
  overlaps.forEach(candidate => {
    const [leftKey, rightKey] = candidate.keys;
    const left = byKey.get(leftKey); const right = byKey.get(rightKey);
    if (!left || !right) return;
    const minimumSize = Math.max(1, Math.min(tokenSets.get(leftKey).size, tokenSets.get(rightKey).size));
    const similarity = candidate.tokens.length / minimumSize;
    const sameCategory = left.category === right.category;
    if (candidate.tokens.length < 3 && !(candidate.tokens.length >= 2 && (similarity >= 0.25 || sameCategory))) return;
    const conflict = conflictReason(left, right, candidate.tokens, similarity);
    const type = conflict ? 'conflict' : 'related';
    const reason = conflict || `공통 핵심어: ${candidate.tokens.slice(0, 4).join(', ')}`;
    const score = candidate.tokens.length + similarity + (type === 'conflict' ? 10 : 0);
    const topics = candidate.tokens.slice(0, 6);
    relations.get(leftKey).push({ key: rightKey, type, reason, score, topics });
    relations.get(rightKey).push({ key: leftKey, type, reason, score, topics });
  });
  relations.forEach(items => items.sort((a, b) => b.score - a.score).splice(8));
  state.relationMap = relations;
}

function relationsFor(key) { return state.relationMap.get(key) || []; }

function nextFlag(flag) {
  const values = ['', ...FLAG_OPTIONS.map(option => option.value)];
  return values[(values.indexOf(flag) + 1) % values.length];
}

function updateRequirementFlag(key, flag = null) {
  const item = state.requirements.find(requirement => requirement.key === key);
  if (!item) return;
  const next = flag === null ? nextFlag(item.flag) : flag;
  state.requirements = state.requirements.map(requirement => requirement.key === key ? { ...requirement, flag: next } : requirement);
  saveWorkspace(); renderRequirements();
  showToast(next ? `${FLAG_LABELS[next]} 플래그를 지정했습니다` : '플래그를 해제했습니다', `${item.id || item.name} 요구사항`);
}

function filteredRequirements() {
  const query = state.query.trim().toLowerCase();
  const list = state.requirements.filter(item => {
    const questionText = (item.questions || []).flatMap(question => [question.question, question.answer]);
    const glossaryText = (item.manualGlossary || []).flatMap(entry => [entry.term, entry.full, entry.meaning]);
    const matchesQuery = !query || [item.id, item.name, item.description, item.owner, ...(item.tags || []), ...glossaryText, ...questionText].join(' ').toLowerCase().includes(query);
    return matchesQuery && (state.category === 'all' || item.category === state.category)
      && (state.status === 'all' || item.status === state.status)
      && (state.priority === 'all' || item.priority === state.priority)
      && (state.flag === 'all' || (state.flag === 'flagged' ? Boolean(item.flag) : state.flag === 'none' ? !item.flag : item.flag === state.flag))
      && matchesIdPath(item);
  });
  return list.sort((a, b) => {
    let left = a[state.sort]; let right = b[state.sort];
    let comparison = 0;
    if (state.sort === 'flag') comparison = (FLAG_ORDER[left || ''] || 0) - (FLAG_ORDER[right || ''] || 0);
    else if (state.sort === 'confidence' || state.sort === 'sourceOrder') comparison = Number(left) - Number(right);
    else comparison = String(left || '').localeCompare(String(right || ''), 'ko', { numeric: true, sensitivity: 'base' });
    return (comparison * state.sortDirection) || (Number(a.sourceOrder) - Number(b.sourceOrder));
  });
}

function render() {
  analyzeRequirementRelations();
  renderDocument();
  renderReferences();
  renderMetrics();
  renderCategoryControls();
  renderIdHierarchyControls();
  renderRequirements();
  renderBulkBar();
}

function renderDocument() {
  const doc = state.document;
  if (!doc) {
    elements.documentType.textContent = 'RFP';
    elements.documentName.textContent = '분석할 RFP를 업로드해 주세요';
    elements.documentMeta.textContent = 'RFP 1개를 선택하거나 RFP와 관련 자료를 함께 선택하세요 · 파일당 최대 30MB';
    elements.documentBadge.textContent = '준비됨';
    elements.documentBadge.className = 'badge neutral';
    elements.sidebarProject.textContent = window.ReqlyPortal?.project?.name || '새 RFP 프로젝트';
    return;
  }
  elements.documentType.textContent = doc.type || 'RFP';
  elements.documentName.textContent = doc.name;
  const unit = ['XLSX', 'XLSM', 'XLS', 'CSV', 'TSV'].includes(doc.type) ? '시트' : '페이지';
  const referenceCopy = state.references.length ? ` · 관련 자료 ${state.references.length}개 반영` : '';
  elements.documentMeta.textContent = `${formatBytes(doc.size)} · ${doc.pages || 1}${unit} · ${Number(doc.characters || 0).toLocaleString('ko-KR')}자 분석${referenceCopy}`;
  elements.documentBadge.textContent = doc.demo ? '데모 데이터' : '분석 완료';
  elements.documentBadge.className = `badge ${doc.demo ? 'demo' : 'live'}`;
  elements.sidebarProject.textContent = window.ReqlyPortal?.project?.name || doc.name.replace(/\.[^.]+$/, '');
}

function renderReferences() {
  const references = state.references || [];
  elements.referenceCount.textContent = references.length;
  elements.referenceList.innerHTML = references.length
    ? references.map(reference => `<span class="reference-chip" title="${escapeHtml(reference.name)}">${icon('file')}<b>${escapeHtml(reference.name)}</b><small>${escapeHtml(reference.type || '')}</small></span>`).join('')
    : '<span class="reference-empty">회의록, 녹취록 문서, 제안 설명자료 등을 추가하면 쉬운 설명에 함께 반영합니다.</span>';
}

function renderMetrics() {
  const total = state.requirements.length;
  const fresh = state.requirements.filter(item => item.status === '검토 전').length;
  const confirmed = state.requirements.filter(item => item.status === '확정').length;
  const completed = state.requirements.filter(item => item.completion === '완료').length;
  const questionCount = state.requirements.reduce((sum, item) => sum + (item.questions || []).length, 0);
  const progress = total ? Math.round(((state.requirements.filter(item => item.status !== '검토 전').length) / total) * 100) : 0;
  elements.metricTotal.textContent = total.toLocaleString('ko-KR');
  elements.metricNew.textContent = fresh.toLocaleString('ko-KR');
  elements.metricConfirmed.textContent = confirmed.toLocaleString('ko-KR');
  elements.metricConfirmedRate.textContent = `${total ? Math.round((confirmed / total) * 100) : 0}%`;
  elements.metricCompleted.textContent = completed.toLocaleString('ko-KR');
  elements.qaCount.textContent = questionCount;
  elements.reviewProgressText.textContent = `${progress}%`;
  elements.reviewProgressBar.style.width = `${progress}%`;
  elements.navCount.textContent = total;
}

function renderCategoryControls() {
  const counts = new Map(CATEGORIES.map(category => [category.name, 0]));
  state.requirements.forEach(item => counts.set(item.category, (counts.get(item.category) || 0) + 1));
  const options = ['<option value="all">전체 분류</option>'].concat(
    CATEGORIES.filter(item => counts.get(item.name) > 0).map(item => `<option value="${item.name}">${item.name} (${counts.get(item.name)})</option>`)
  );
  elements.categoryFilter.innerHTML = options.join('');
  elements.categoryFilter.value = state.category;
  const tabs = [{ name: 'all', code: '', label: '전체', count: state.requirements.length }]
    .concat(CATEGORIES.filter(item => counts.get(item.name) > 0).map(item => ({ ...item, label: item.name, count: counts.get(item.name) })));
  elements.categoryStrip.innerHTML = tabs.map(item => `
    <button class="category-tab ${state.category === item.name ? 'active' : ''}" data-category="${item.name}">
      <span>${escapeHtml(item.label)}${item.code ? ` <small>${item.code}</small>` : ''}</span><b>${item.count}</b>
    </button>`).join('');
}

function renderIdHierarchyControls() {
  const withHierarchy = state.requirements.map(item => ({ item, hierarchy: requirementIdHierarchy(item.id) })).filter(entry => entry.hierarchy.length);
  while (state.idPath.length && !withHierarchy.some(entry => state.idPath.every((part, index) => entry.hierarchy[index] === part))) state.idPath.pop();
  const hasHierarchy = withHierarchy.length > 0;
  elements.idHierarchyFilter.style.display = hasHierarchy ? '' : 'none';
  if (!hasHierarchy) return;
  elements.idHierarchyPath.textContent = state.idPath.length ? state.idPath.join(' > ') : '전체';
  const maxDepth = Math.max(...withHierarchy.map(entry => entry.hierarchy.length));
  const rows = [];
  for (let level = 0; level <= state.idPath.length && level < maxDepth; level += 1) {
    const parent = state.idPath.slice(0, level);
    const counts = new Map();
    withHierarchy.forEach(entry => {
      if (!parent.every((part, index) => entry.hierarchy[index] === part)) return;
      const value = entry.hierarchy[level];
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    if (!counts.size) break;
    const parentValue = encodeURIComponent(JSON.stringify(parent));
    const buttons = [`<button type="button" class="hierarchy-chip ${state.idPath.length === level ? 'active' : ''}" data-id-path="${parentValue}">${level === 0 ? '전체' : '이 단계 전체'}</button>`]
      .concat([...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'ko', { numeric: true })).map(([value, count]) => {
        const path = [...parent, value];
        const active = state.idPath[level] === value;
        return `<button type="button" class="hierarchy-chip ${active ? 'active' : ''}" data-id-path="${encodeURIComponent(JSON.stringify(path))}"><span>${escapeHtml(value)}</span><b>${count}</b></button>`;
      }));
    rows.push(`<div class="id-hierarchy-row"><span class="hierarchy-level-label">${level + 1}단계</span><div>${buttons.join('')}</div></div>`);
  }
  elements.idHierarchyLevels.innerHTML = rows.join('');
}

function renderRequirements() {
  const items = filteredRequirements();
  const hasRequirements = state.requirements.length > 0;
  elements.requirementsBody.closest('.table-wrap').style.display = hasRequirements ? '' : 'none';
  elements.mobileList.style.display = hasRequirements ? '' : 'none';
  elements.emptyState.classList.toggle('visible', !hasRequirements);
  elements.categoryStrip.style.display = hasRequirements ? '' : 'none';
  elements.resultCount.textContent = state.requirements.length === items.length
    ? `총 ${items.length.toLocaleString('ko-KR')}개 요구사항`
    : `검색 결과 ${items.length.toLocaleString('ko-KR')}개 / 전체 ${state.requirements.length.toLocaleString('ko-KR')}개`;
  elements.listDescription.textContent = hasRequirements
    ? `${new Set(state.requirements.map(item => item.category)).size}개 분류의 요구사항을 검토하고 관리하세요.`
    : '업로드한 RFP에서 추출한 요구사항을 검토하고 관리하세요.';

  if (!items.length && hasRequirements) {
    elements.requirementsBody.innerHTML = `<tr><td colspan="9"><div class="no-results">검색 조건에 맞는 요구사항이 없습니다.</div></td></tr>`;
    elements.mobileList.innerHTML = '<div class="no-results">검색 조건에 맞는 요구사항이 없습니다.</div>';
  } else {
    elements.requirementsBody.innerHTML = items.map(item => requirementRow(item)).join('');
    elements.mobileList.innerHTML = items.map(item => mobileRequirement(item)).join('');
  }
  const visibleKeys = items.map(item => item.key);
  elements.selectAll.checked = visibleKeys.length > 0 && visibleKeys.every(key => state.selected.has(key));
  elements.selectAll.indeterminate = visibleKeys.some(key => state.selected.has(key)) && !elements.selectAll.checked;
  document.querySelectorAll('.sort-button').forEach(button => button.classList.toggle('active', button.dataset.sort === state.sort));
  if (elements.sortFilter) elements.sortFilter.value = `${state.sort}:${state.sortDirection}`;
}

function requirementRow(item) {
  const statusClass = item.status.replaceAll(' ', '-');
  const displayId = item.id || 'ID 없음';
  const relations = relationsFor(item.key);
  const conflicts = relations.filter(relation => relation.type === 'conflict').length;
  const related = relations.length - conflicts;
  const relationBadges = `${conflicts ? `<span class="relation-badge conflict">상충 가능 ${conflicts}</span>` : ''}${related ? `<span class="relation-badge related">관련 ${related}</span>` : ''}`;
  return `<tr data-key="${escapeHtml(item.key)}" class="${state.selected.has(item.key) ? 'selected' : ''}">
    <td class="check-cell"><input class="row-check" type="checkbox" data-key="${escapeHtml(item.key)}" ${state.selected.has(item.key) ? 'checked' : ''} aria-label="${escapeHtml(displayId)} 선택"></td>
    <td><span class="requirement-id ${item.id ? '' : 'missing'}">${escapeHtml(displayId)}</span></td>
    <td><button class="name-button" data-open="${escapeHtml(item.key)}"><span class="requirement-name">${escapeHtml(item.name)}</span><span class="requirement-description">${escapeHtml(item.description)}</span>${relationBadges ? `<span class="relation-badges">${relationBadges}</span>` : ''}</button></td>
    <td><span class="category-chip cat-${escapeHtml(item.category)}">${escapeHtml(item.category)} <small>${categoryCode(item.category)}</small></span></td>
    <td><span class="priority-chip priority-${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span></td>
    <td><span class="status-chip status-${statusClass}">${escapeHtml(item.status)}</span></td>
    <td class="flag-cell"><button type="button" class="flag-button ${item.flag ? `flag-${escapeHtml(item.flag)}` : ''}" data-flag-key="${escapeHtml(item.key)}" title="${item.flag ? `${FLAG_LABELS[item.flag]} 플래그 · 클릭하여 변경` : '플래그 지정'}" aria-label="${escapeHtml(displayId)} 플래그 변경">${icon('flag')}</button></td>
    <td><span class="confidence-cell"><i class="mini-progress"><span style="width:${Math.max(0, Math.min(100, item.confidence))}%"></span></i><b>${item.confidence}%</b></span></td>
    <td><button class="row-action" data-open="${escapeHtml(item.key)}" aria-label="${escapeHtml(displayId)} 관리">${icon('chevron')}</button></td>
  </tr>`;
}

function mobileRequirement(item) {
  const relations = relationsFor(item.key);
  const conflicts = relations.filter(relation => relation.type === 'conflict').length;
  return `<article class="mobile-requirement" data-open="${escapeHtml(item.key)}">
    <div class="mobile-head"><span class="requirement-id ${item.id ? '' : 'missing'}">${escapeHtml(item.id || 'ID 없음')}</span><span><button type="button" class="flag-button ${item.flag ? `flag-${escapeHtml(item.flag)}` : ''}" data-flag-key="${escapeHtml(item.key)}" aria-label="플래그 변경">${icon('flag')}</button><span class="status-chip status-${item.status.replaceAll(' ', '-')}">${escapeHtml(item.status)}</span></span></div>
    <h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p>
    <div class="mobile-meta"><span class="category-chip cat-${escapeHtml(item.category)}">${escapeHtml(item.category)} <small>${categoryCode(item.category)}</small></span><span class="priority-chip priority-${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>${conflicts ? `<span class="relation-badge conflict">상충 가능 ${conflicts}</span>` : relations.length ? `<span class="relation-badge related">관련 ${relations.length}</span>` : ''}</div>
  </article>`;
}

function renderBulkBar() {
  const count = state.selected.size;
  elements.bulkBar.classList.toggle('visible', count > 0);
  elements.selectedCount.textContent = count;
}

function resetFilters(shouldRender = true) {
  state.query = ''; state.category = 'all'; state.status = 'all'; state.priority = 'all'; state.flag = 'all'; state.idPath = [];
  state.sort = 'sourceOrder'; state.sortDirection = 1;
  if (elements.searchInput) {
    elements.searchInput.value = '';
    elements.categoryFilter.value = 'all'; elements.statusFilter.value = 'all'; elements.priorityFilter.value = 'all'; elements.flagFilter.value = 'all';
    elements.sortFilter.value = 'sourceOrder:1';
  }
  if (shouldRender) render();
}

function setDetailSectionExpanded(name, expanded) {
  const sections = {
    easy: { panel: elements.easyExplanationPanel, toggle: elements.toggleEasyExplanation, label: '쉽게 풀어보면' },
    glossary: { panel: elements.glossaryPanel, toggle: elements.toggleGlossary, label: '쉬운 용어 도우미' },
    relations: { panel: elements.relationPanel, toggle: elements.toggleRelations, label: '관련·상충 요구사항' },
  };
  const section = sections[name];
  if (!section?.panel || !section.toggle) return;
  section.panel.classList.toggle('collapsed', !expanded);
  section.toggle.textContent = expanded ? '−' : '+';
  section.toggle.setAttribute('aria-expanded', String(expanded));
  section.toggle.title = `${section.label} ${expanded ? '닫기' : '열기'}`;
}

function collapseDetailSections() {
  ['easy', 'glossary', 'relations'].forEach(name => setDetailSectionExpanded(name, false));
}

function detectUnfamiliarPhrases(text) {
  const source = String(text || '');
  const patterns = [
    /\b[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+\b/g,
    /(?:^|[\s(])((?:(?:선상|육상|클라우드|데이터|서비스|보안|제로트러스트|분산|중앙|원격|엣지|에지)\s*)?(?:에지|엣지)?\s*(?:노드|코어|게이트웨이|브로커|클러스터|파이프라인|워크플로우|프로비저닝|온보딩|오프보딩|오케스트레이션|데이터\s*레이크|디지털\s*트윈))(?=$|[\s,.;:)]|은|는|이|가|을|를|와|과|도|의|에서|로)/gi,
    /\b(?:onboard|cloud|edge|data|service|security|zero[- ]trust)\s+(?:node|core|gateway|broker|cluster|pipeline|workflow|mesh|lake)\b/gi,
  ];
  const generalJargon = [
    '상호운용성', '상호 운용성', '가용성', '확장성', '무결성', '추적성', '데이터 거버넌스',
    '라이프사이클', '레거시', '마이그레이션', '롤백', '엔드포인트', '페이로드', '스키마',
    '웹훅', '스로틀링', '서비스 메시', '이중화', '페일오버', '캐시', '바인딩', '레지스트리',
  ];
  const results = [];
  patterns.forEach(pattern => {
    for (const match of source.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const value = (match[1] || match[0]).replace(/\s+/g, ' ').trim();
      if (value.length >= 3 && value.length <= 60 && !results.some(item => item.toLowerCase() === value.toLowerCase())) results.push(value);
    }
  });
  generalJargon.forEach(term => {
    if (source.toLowerCase().includes(term.toLowerCase()) && !results.some(item => item.toLowerCase() === term.toLowerCase())) results.push(term);
  });
  return results.slice(0, 30);
}

function detectGlossaryTerms(text) {
  const source = String(text || '');
  const lowerSource = source.toLowerCase();
  const dictionary = GLOSSARY_DICTIONARY;
  const known = dictionary.filter(entry => {
    const candidates = [entry.term, entry.full, ...(entry.aliases || [])];
    return candidates.some(candidate => {
      if (/^[A-Za-z0-9 /-]+$/.test(candidate)) {
        const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(source);
      }
      return source.includes(candidate);
    });
  }).map(entry => resolveGlossaryVariant(entry, source));
  const withoutRequirementIds = source.replace(/\b[A-Z가-힣][A-Z0-9가-힣]*(?:[-_./][A-Z0-9가-힣]+)+[-_./]\d{1,6}\b/gi, ' ');
  const acronyms = [...new Set(withoutRequirementIds.match(/\b[A-Z][A-Z0-9&./-]{1,14}\b/g) || [])]
    .filter(term => !/^\d+$/.test(term) && !known.some(entry => [entry.term, entry.full, ...(entry.aliases || [])].filter(Boolean).some(candidate => {
      const words = candidate.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      return candidate.toLowerCase() === term.toLowerCase() || words.includes(term.toLowerCase());
    })))
    .slice(0, 50)
    .map(term => contextualGlossaryEntry(term, source));
  const unfamiliar = detectUnfamiliarPhrases(withoutRequirementIds)
    .filter(term => ![...known, ...acronyms].some(entry => {
      const candidates = [entry.term, entry.full, ...(entry.aliases || [])].filter(Boolean).map(candidate => candidate.toLowerCase());
      return candidates.some(candidate => candidate === term.toLowerCase() || candidate.includes(term.toLowerCase()) || term.toLowerCase().includes(candidate));
    }))
    .map(term => contextualGlossaryEntry(term, source));
  const unique = [];
  [...known, ...acronyms, ...unfamiliar]
    .sort((left, right) => {
      const leftCandidates = [left.term, ...(left.aliases || [])].filter(Boolean).map(value => lowerSource.indexOf(String(value).toLowerCase())).filter(index => index >= 0);
      const rightCandidates = [right.term, ...(right.aliases || [])].filter(Boolean).map(value => lowerSource.indexOf(String(value).toLowerCase())).filter(index => index >= 0);
      return Math.min(...leftCandidates, Number.MAX_SAFE_INTEGER) - Math.min(...rightCandidates, Number.MAX_SAFE_INTEGER);
    })
    .forEach(entry => {
      const key = String(entry.term || '').trim().toLowerCase();
      if (key && !unique.some(item => String(item.term).trim().toLowerCase() === key)) unique.push(entry);
    });
  return unique.slice(0, 80);
}

function resolveGlossaryVariant(entry, sourceText = '') {
  const variants = GLOSSARY_VARIANTS[String(entry?.term || '').toUpperCase()];
  if (!variants?.length) return entry;
  const source = String(sourceText || '').toLowerCase();
  const ranked = variants.map(variant => ({
    variant,
    score: variant.keywords.reduce((score, keyword) => score + (source.includes(keyword.toLowerCase()) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const selected = ranked[0].variant;
  const ambiguous = ranked.length > 1 && (ranked[0].score === 0 || ranked[0].score - ranked[1].score <= 1);
  return {
    ...entry, full: selected.full, meaning: selected.meaning, contextResolved: true,
    contextNote: ambiguous ? '문맥만으로 하나를 확정하기 어려워 가능성이 높은 뜻을 함께 표시합니다.'
      : '프로젝트 문맥에서 가장 가능성이 높은 뜻',
    alternatives: ambiguous ? ranked.slice(0, 3).map(({ variant, score }) => ({ ...variant, score, source: '내장 문맥 사전' })) : [],
  };
}

function contextualGlossaryEntry(term, sourceText = '') {
  const source = String(sourceText || '');
  const upper = String(term).trim().toUpperCase();
  const variantSeed = GLOSSARY_DICTIONARY.find(entry => String(entry.term).toUpperCase() === upper);
  if (variantSeed) return resolveGlossaryVariant(variantSeed, source);
  const domain = /선박|항해|해양|엔진|기관|vessel|ship/i.test(source) ? '선박·해양'
    : /설비|기계|전기|배관|공정|플랜트|제어기|plc|scada|hvac/i.test(source) ? '기계·전기·설비'
      : /품질|시험|검사|인수|결함|quality|test/i.test(source) ? '품질·시험'
        : /안전|환경|보건|탄소|오염|safety|environment/i.test(source) ? '안전·환경'
          : /제안|계약|입찰|조달|과업|프로젝트|일정|산출물|procurement|project/i.test(source) ? '조달·사업관리'
            : /비용|투자|예산|수익|재무|cost|investment/i.test(source) ? '재무·투자'
    : /보안|인증|암호|접근|security/i.test(source) ? '정보보안'
      : /화면|사용자|ui|ux|디자인/i.test(source) ? 'UI/UX' : '현재 프로젝트';
  return {
    term: String(term).trim(), full: '정확한 전체 이름 확인 필요', contextual: true,
    meaning: `‘${term}’은(는) ${domain} 문맥에서 감지된 용어이지만, 현재 내장 사전만으로 실제 뜻을 하나로 확정할 수 없습니다. 상세 설명을 되풀이해 뜻처럼 표시하지 않으며, RFP 용어정의 또는 작성자에게 전체 이름과 적용 의미를 확인해 주세요.`,
  };
}

function lookupGlossaryTerm(selectedText, sourceText = '') {
  const selected = String(selectedText || '').trim().replace(/[.,;:()[\]{}'"“”‘’]/g, '');
  if (!selected || selected.length > 120) return null;
  const lower = selected.toLowerCase();
  const entries = [...state.draftGlossary, ...state.visibleGlossary, ...GLOSSARY_DICTIONARY];
  const matches = entries.map(entry => {
    const candidates = [entry.term, entry.full, ...(entry.aliases || [])].filter(Boolean).map(candidate => candidate.toLowerCase());
    const exact = candidates.some(candidate => candidate === lower);
    const partial = lower.length > 3 && candidates.some(candidate => candidate.length >= 3 && lower.includes(candidate));
    return { entry, exact, partial };
  }).filter(match => match.exact || match.partial);
  const entry = matches.sort((a, b) => Number(b.exact) - Number(a.exact)
    || Number(Boolean(b.entry.manual)) - Number(Boolean(a.entry.manual))
    || String(b.entry.term).length - String(a.entry.term).length)[0]?.entry || null;
  return entry ? resolveGlossaryVariant(entry, sourceText) : null;
}

function externalGlossaryEntry(result) {
  const candidates = (result?.candidates || []).slice(0, 3).map(candidate => ({
    full: candidate.full || result.term,
    meaning: candidate.meaning || '검색 결과의 설명이 없습니다.',
    source: candidate.source || '외부 검색',
    sourceUrl: candidate.sourceUrl || '',
    score: Number(candidate.score) || 0,
  }));
  if (!candidates.length) return null;
  const first = candidates[0];
  return {
    term: result.term, full: first.full, meaning: first.meaning, external: true, contextual: true,
    contextResolved: candidates.length === 1,
    contextNote: candidates.length > 1
      ? '검색 결과와 RFP 문맥만으로 하나를 확정하기 어려워 가능성이 높은 뜻을 순서대로 표시합니다.'
      : '내장 사전에 없어 외부 검색 결과로 보완했습니다.',
    alternatives: candidates,
    source: first.source,
    sourceUrl: first.sourceUrl,
  };
}

async function fetchExternalGlossary(terms, context) {
  const uniqueTerms = [...new Set(terms.map(term => String(term || '').trim()).filter(Boolean))].slice(0, 10);
  if (!uniqueTerms.length) return [];
  const response = await fetch('/api/glossary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms: uniqueTerms, context }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '외부 용어 검색에 실패했습니다.');
  return (payload.results || []).map(externalGlossaryEntry).filter(Boolean);
}

function glossaryCandidateMarkup(candidate, index) {
  const sourceLink = candidate.sourceUrl
    ? `<a href="${escapeHtml(candidate.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(candidate.source || '검색 출처')} 확인</a>`
    : candidate.source ? `<span>${escapeHtml(candidate.source)}</span>` : '';
  return `<li><div><b>${index + 1}순위</b><strong>${escapeHtml(candidate.full || '이름 확인 필요')}</strong>${sourceLink}</div><p>${escapeHtml(candidate.meaning || '설명이 없습니다.')}</p></li>`;
}

function showGlossaryTerm(entry) {
  if (!entry) return;
  state.currentGlossaryTerm = entry.term;
  elements.termAcronym.textContent = entry.term;
  elements.termName.textContent = entry.full || '직접 입력한 용어';
  const alternatives = (entry.alternatives || []).slice(0, 3);
  const showCandidates = alternatives.length > 1;
  elements.termMeaning.textContent = showCandidates
    ? '뜻을 하나로 단정하기 어려운 용어입니다. 아래 후보를 RFP 문맥에 맞는 가능성 순서로 확인해 주세요.'
    : entry.meaning;
  elements.termContextNote.textContent = entry.manual ? '사용자가 직접 등록한 설명을 우선 표시합니다.' : (entry.contextNote || '');
  elements.termContextNote.style.display = elements.termContextNote.textContent ? 'block' : 'none';
  elements.termCandidates.innerHTML = showCandidates ? `<ol>${alternatives.map(glossaryCandidateMarkup).join('')}</ol>` : '';
  elements.termCandidates.classList.toggle('visible', showCandidates);
  elements.termSource.innerHTML = !showCandidates && entry.sourceUrl
    ? `<a href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.source || '검색 출처')}에서 확인</a>` : '';
  elements.termSource.style.display = elements.termSource.innerHTML ? 'block' : 'none';
  elements.termDefinition.dataset.contextResolved = entry.contextResolved ? 'true' : 'false';
  elements.termDefinition.dataset.external = entry.external ? 'true' : 'false';
  elements.termDefinition.classList.add('visible');
  elements.manualGlossaryRemove.style.display = entry.manual ? 'inline-block' : 'none';
  elements.formGlossaryTerms.querySelectorAll('.term-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.term === entry.term));
}

function renderGlossary() {
  const detected = state.glossaryDetectionRequested
    ? detectGlossaryTerms(`${elements.formName.value} ${elements.formDescription.value} ${elements.formApplicationPlan.value}`)
    : [];
  const manualByTerm = new Map(state.draftGlossary.map(entry => [entry.term.toLowerCase(), entry]));
  const remoteByTerm = new Map(state.remoteGlossary.map(entry => [entry.term.toLowerCase(), entry]));
  const detectedWithOverrides = detected.map(entry => manualByTerm.get(entry.term.toLowerCase()) || remoteByTerm.get(entry.term.toLowerCase()) || entry);
  const terms = [...detectedWithOverrides, ...state.draftGlossary.filter(manual => !detected.some(entry => entry.term.toLowerCase() === manual.term.toLowerCase()))];
  state.visibleGlossary = terms;
  elements.formGlossaryTerms.innerHTML = terms.map(entry => {
    const candidateCount = entry.alternatives?.length || 0;
    const fullName = entry.full && !entry.contextual && candidateCount < 2 ? ` · ${escapeHtml(entry.full)}` : '';
    const badge = entry.manual ? '<small>직접</small>' : candidateCount > 1 ? `<small>후보 ${candidateCount}</small>`
      : entry.external ? '<small>검색 보완</small>' : entry.contextual ? '<small>문맥 감지</small>' : '';
    return `<button type="button" class="term-chip ${entry.manual ? 'manual' : ''} ${entry.contextual ? 'contextual' : ''} ${entry.external ? 'external' : ''}" data-term="${escapeHtml(entry.term)}">${escapeHtml(entry.term)}${fullName}${badge}</button>`;
  }).join('');
  elements.termDefinition.classList.remove('visible');
  elements.termCandidates.classList.remove('visible');
  elements.termCandidates.innerHTML = '';
  elements.termContextNote.textContent = '';
  elements.termSource.innerHTML = '';
  elements.manualGlossaryRemove.style.display = 'none';
  state.currentGlossaryTerm = null;
}

async function searchGlossaryTerm() {
  const query = elements.glossarySearchInput.value.trim();
  if (!query) {
    elements.glossarySearchGuide.textContent = '상세 설명에서 궁금한 단어나 문구를 복사해 붙여 넣어 주세요.';
    elements.glossarySearchInput.focus();
    return;
  }
  const source = `${elements.formName.value} ${elements.formDescription.value} ${elements.formApplicationPlan.value}`;
  let entry = lookupGlossaryTerm(query, source);
  const originalText = elements.glossarySearchButton.innerHTML;
  if (!entry) {
    elements.glossarySearchButton.disabled = true;
    elements.glossarySearchButton.textContent = '검색 중…';
    elements.glossarySearchGuide.textContent = '내장 사전에 없어 외부 자료를 검색하고 RFP 문맥에 맞는 뜻을 고르는 중입니다.';
    try {
      [entry] = await fetchExternalGlossary([query], source);
    } catch (error) {
      elements.glossarySearchGuide.textContent = `외부 검색을 사용할 수 없어 문맥 감지 결과만 표시합니다. (${error.message})`;
    } finally {
      elements.glossarySearchButton.disabled = false;
      elements.glossarySearchButton.innerHTML = originalText;
    }
  }
  entry ||= contextualGlossaryEntry(query, source);
  if (!state.visibleGlossary.some(item => item.term.toLowerCase() === entry.term.toLowerCase())) state.visibleGlossary.push(entry);
  showGlossaryTerm(entry);
  elements.glossarySearchGuide.textContent = entry.external
    ? entry.alternatives?.length > 1
      ? `‘${entry.term}’의 뜻을 하나로 확정하기 어려워 외부 검색 후보 ${entry.alternatives.length}개를 표시했습니다.`
      : `‘${entry.term}’을(를) 외부 검색으로 보완했습니다.`
    : entry.contextual
      ? '내장 사전과 문맥만으로 실제 뜻을 특정할 수 없어 확인 필요로 표시했습니다.'
      : entry.alternatives?.length > 1
        ? `‘${entry.term}’의 가능성 높은 뜻 ${entry.alternatives.length}개를 표시했습니다.`
        : entry.contextResolved ? `‘${entry.term}’은(는) 프로젝트 문맥에서 가장 가능성이 높은 뜻을 표시했습니다.` : `‘${entry.term}’ 용어의 실제 뜻을 찾았습니다.`;
}

async function requestGlossaryDetection() {
  state.glossaryDetectionRequested = true;
  state.remoteGlossary = [];
  renderGlossary();
  const source = `${elements.formName.value} ${elements.formDescription.value} ${elements.formApplicationPlan.value}`;
  const unknownTerms = state.visibleGlossary.filter(entry => entry.contextual && !entry.manual).map(entry => entry.term).slice(0, 10);
  const originalText = elements.detectGlossaryButton.innerHTML;
  if (unknownTerms.length) {
    elements.detectGlossaryButton.disabled = true;
    elements.detectGlossaryButton.textContent = '검색 보완 중…';
    elements.glossarySearchGuide.textContent = `내장 사전에 없는 용어 ${unknownTerms.length}개를 외부 검색으로 보완하고 있습니다.`;
    try {
      state.remoteGlossary = await fetchExternalGlossary(unknownTerms, source);
      renderGlossary();
    } catch (error) {
      elements.glossarySearchGuide.textContent = `내장 사전 감지는 완료했지만 외부 검색을 사용할 수 없습니다. (${error.message})`;
    } finally {
      elements.detectGlossaryButton.disabled = false;
      elements.detectGlossaryButton.innerHTML = originalText;
    }
  }
  const count = state.visibleGlossary.filter(entry => !entry.manual).length;
  const remoteCount = state.visibleGlossary.filter(entry => entry.external).length;
  elements.glossarySearchGuide.textContent = count
    ? `일반인에게 생소할 수 있는 용어 ${count}개를 감지했습니다.${remoteCount ? ` 이 중 ${remoteCount}개는 외부 검색으로 보완했습니다.` : ''} 용어를 선택하면 뜻 후보를 확인할 수 있습니다.`
    : '감지된 용어가 없습니다. 궁금한 단어나 약자를 직접 검색해 주세요.';
  showToast('용어 감지를 완료했습니다', count ? `${count}개 용어 후보를 찾았습니다.${remoteCount ? ` 검색 보완 ${remoteCount}개.` : ''}` : '자동 감지 후보가 없습니다.');
}

function invalidateGlossaryDetection() {
  if (!state.glossaryDetectionRequested) return;
  state.glossaryDetectionRequested = false;
  state.visibleGlossary = [];
  state.remoteGlossary = [];
  renderGlossary();
  elements.glossarySearchGuide.textContent = '내용이 변경되었습니다. 필요하면 다시 용어 감지를 요청해 주세요.';
}

function toggleManualGlossaryEditor(show) {
  elements.manualGlossaryEditor.classList.toggle('visible', show);
  if (show) setTimeout(() => elements.manualTerm.focus(), 0);
  else {
    elements.manualTerm.value = '';
    elements.manualFull.value = '';
    elements.manualMeaning.value = '';
  }
}

function saveManualGlossaryTerm() {
  const term = elements.manualTerm.value.trim();
  const full = elements.manualFull.value.trim();
  const meaning = elements.manualMeaning.value.trim();
  if (!term || !meaning) {
    showToast('입력 내용을 확인해 주세요', '용어/약자와 쉬운 뜻은 반드시 입력해야 합니다.', true);
    (!term ? elements.manualTerm : elements.manualMeaning).focus();
    return;
  }
  const entry = { term, full, meaning, manual: true };
  const existingIndex = state.draftGlossary.findIndex(item => item.term.toLowerCase() === term.toLowerCase());
  if (existingIndex >= 0) state.draftGlossary[existingIndex] = entry;
  else state.draftGlossary.push(entry);
  toggleManualGlossaryEditor(false);
  renderGlossary();
  showGlossaryTerm(entry);
  showToast('용어를 직접 등록했습니다', `${term} 용어가 이 요구사항의 전문용어 도우미에 추가되었습니다.`);
}

function removeManualGlossaryTerm() {
  if (!state.currentGlossaryTerm) return;
  const removed = state.currentGlossaryTerm;
  state.draftGlossary = state.draftGlossary.filter(entry => entry.term !== removed);
  renderGlossary();
  showToast('직접 입력 용어를 삭제했습니다', `${removed} 용어가 제거되었습니다.`);
}

function renderQuestions() {
  elements.formQuestionCount.textContent = state.draftQuestions.length;
  elements.formQuestionList.innerHTML = state.draftQuestions.map(question => {
    const answered = question.answer.trim().length > 0;
    return `<article class="question-item" data-question-key="${escapeHtml(question.key)}">
      <div class="question-item-head"><span class="perspective-chip ${question.perspective === '개발' ? 'dev' : question.perspective === '직접' ? 'direct' : ''}">${escapeHtml(question.perspective)}</span><button type="button" class="question-remove" data-remove-question="${escapeHtml(question.key)}" aria-label="질의 삭제">${icon('x')}</button></div>
      <textarea data-question-text="${escapeHtml(question.key)}" maxlength="1000" aria-label="${escapeHtml(question.perspective)} 질의사항">${escapeHtml(question.question)}</textarea>
      <input data-question-answer="${escapeHtml(question.key)}" maxlength="2000" value="${escapeHtml(question.answer)}" placeholder="답변을 입력하세요 (선택)">
      <span class="question-status ${answered ? 'answered' : ''}">${answered ? '답변완료' : '미답변'}</span>
    </article>`;
  }).join('');
}

function addGeneratedQuestion(perspective) {
  const category = elements.formCategory.value;
  const name = elements.formName.value.trim() || '해당 요구사항';
  const templates = QUESTION_TEMPLATES[perspective][category] || QUESTION_TEMPLATES[perspective].기타;
  const candidates = templates.map(template => template.replaceAll('{name}', name));
  let question = candidates.find(candidate => !state.draftQuestions.some(item => item.question === candidate));
  if (!question) question = `${name}에 대한 ${perspective} 관점의 추가 확인 기준과 의사결정 담당자를 알려주세요.`;
  state.draftQuestions.push({ key: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, perspective, question, answer: '' });
  renderQuestions();
  elements.formQuestionList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast(`${perspective} 질의를 추가했습니다`, '자동 생성된 문장을 검토한 뒤 필요하면 직접 수정하세요.');
}

function addDirectQuestion() {
  const question = { key: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, perspective: '직접', question: '', answer: '' };
  state.draftQuestions.push(question);
  renderQuestions();
  const field = elements.formQuestionList.querySelector(`[data-question-text="${question.key}"]`);
  field?.focus();
  field?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resizeEasyExplanation() {
  const field = elements.formEasyExplanation;
  elements.easyExplanationCount.textContent = field.value.length.toLocaleString('ko-KR');
  field.style.height = 'auto';
  field.style.height = `${Math.max(190, field.scrollHeight + 2)}px`;
}

function renderEasyExplanation() {
  const hasExplanation = Boolean(elements.formEasyExplanation.value.trim());
  elements.easyExplanationRequest.style.display = hasExplanation ? 'none' : '';
  elements.easyExplanationContent.classList.toggle('visible', hasExplanation);
  elements.easyExplanationBasis.textContent = state.draftExplanationSources.length
    ? `관련 자료 반영: ${state.draftExplanationSources.join(', ')}`
    : 'RFP 원문을 기준으로 생성했습니다. 필요하면 직접 수정하거나 다시 생성할 수 있습니다.';
  requestAnimationFrame(resizeEasyExplanation);
}

async function requestEasyExplanation() {
  const name = elements.formName.value.trim();
  const description = elements.formDescription.value.trim();
  if (!name || !description) {
    showToast('먼저 요구사항 내용을 입력해 주세요', '요구사항 명칭과 상세 설명이 있어야 쉬운 설명을 만들 수 있습니다.', true);
    (!name ? elements.formName : elements.formDescription).focus();
    return;
  }
  const buttons = [elements.generateEasyExplanation, elements.regenerateEasyExplanation];
  buttons.forEach(button => { button.disabled = true; });
  const originalRequestText = elements.generateEasyExplanation.innerHTML;
  const originalRegenerateText = elements.regenerateEasyExplanation.textContent;
  elements.generateEasyExplanation.textContent = '설명 생성 중…';
  elements.regenerateEasyExplanation.textContent = '생성 중…';
  try {
    const previous = state.requirements.find(item => item.key === state.editingKey);
    const response = await fetch('/api/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: state.projectId,
        requirement: { ...(previous || {}), id: elements.formId.value.trim(), name, description, category: elements.formCategory.value },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || '쉬운 설명을 생성할 수 없습니다.');
    elements.formEasyExplanation.value = payload.easyExplanation || '';
    state.draftExplanationSources = Array.isArray(payload.explanationSources) ? payload.explanationSources : [];
    renderEasyExplanation();
    if (previous) {
      state.requirements = state.requirements.map(item => item.key === previous.key ? normalizeRequirement({
        ...item, easyExplanation: elements.formEasyExplanation.value, explanationSources: state.draftExplanationSources,
      }) : item);
      saveWorkspace();
    }
    const contextCopy = state.draftExplanationSources.length ? `${state.draftExplanationSources.length}개 관련 자료도 반영했습니다.` : 'RFP 원문을 기준으로 정리했습니다.';
    showToast('쉬운 설명을 생성했습니다', contextCopy);
  } catch (error) {
    showToast('쉬운 설명 생성에 실패했습니다', error.message, true);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    elements.generateEasyExplanation.innerHTML = originalRequestText;
    elements.regenerateEasyExplanation.textContent = originalRegenerateText;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueMatches(text, patterns) {
  const matches = [];
  patterns.forEach(pattern => {
    for (const match of String(text || '').matchAll(new RegExp(pattern.source, pattern.flags))) {
      const value = match[0].trim();
      if (value && !matches.some(existing => existing.toLowerCase() === value.toLowerCase())) matches.push(value);
    }
  });
  return matches;
}

function comparisonHighlights(left, right, relation) {
  const result = {
    left: { topic: [], conflict: [] },
    right: { topic: [], conflict: [] },
  };
  if (relation?.type !== 'conflict') return result;

  const rightTokens = relationTokens(right);
  const fallbackTopics = [...relationTokens(left)].filter(token => rightTokens.has(token)).slice(0, 6);
  const topics = (relation.topics?.length ? relation.topics : fallbackTopics).filter(Boolean);
  result.left.topic.push(...topics);
  result.right.topic.push(...topics);

  const leftText = `${left.name || ''} ${left.description || ''}`;
  const rightText = `${right.name || ''} ${right.description || ''}`;
  const leftConstraints = numericConstraints(leftText);
  const rightConstraints = numericConstraints(rightText);
  leftConstraints.forEach(first => rightConstraints.forEach(second => {
    if (first.unit !== second.unit || first.direction === second.direction) return;
    const minimum = first.direction === 'min' ? first : second;
    const maximum = first.direction === 'max' ? first : second;
    if (minimum.value <= maximum.value) return;
    result.left.conflict.push(first.raw);
    result.right.conflict.push(second.raw);
  }));

  const negativePatterns = [
    /(?:허용|사용|저장|제공|지원|수집)하지\s*않아야(?:\s*한다)?/gi,
    /접근할\s*수\s*없(?:다|어야|음)?/gi,
    /(?:허용|사용|저장|제공|지원|수집)하지/gi,
    /하지\s*않아야(?:\s*한다)?/gi,
    /금지|불가|제외/gi,
  ];
  const positivePatterns = [
    /필수|반드시/gi,
    /허용(?!하지)|사용(?!하지)|저장(?!하지)|제공(?!하지)|지원(?!하지)|수집(?!하지)/gi,
    /접근\s*가능|포함/gi,
  ];
  const optionalPatterns = [/선택|권고|필요\s*시/gi];
  const leftNegative = uniqueMatches(leftText, negativePatterns);
  const rightNegative = uniqueMatches(rightText, negativePatterns);
  const leftPositive = uniqueMatches(leftText, positivePatterns);
  const rightPositive = uniqueMatches(rightText, positivePatterns);
  if (leftNegative.length && rightPositive.length) {
    result.left.conflict.push(...leftNegative);
    result.right.conflict.push(...rightPositive);
  }
  if (rightNegative.length && leftPositive.length) {
    result.right.conflict.push(...rightNegative);
    result.left.conflict.push(...leftPositive);
  }

  const leftRequired = uniqueMatches(leftText, [/필수|반드시/gi]);
  const rightRequired = uniqueMatches(rightText, [/필수|반드시/gi]);
  const leftOptional = uniqueMatches(leftText, optionalPatterns);
  const rightOptional = uniqueMatches(rightText, optionalPatterns);
  if (leftRequired.length && rightOptional.length) {
    result.left.conflict.push(...leftRequired);
    result.right.conflict.push(...rightOptional);
  }
  if (rightRequired.length && leftOptional.length) {
    result.right.conflict.push(...rightRequired);
    result.left.conflict.push(...leftOptional);
  }

  ['left', 'right'].forEach(side => ['topic', 'conflict'].forEach(type => {
    result[side][type] = [...new Set(result[side][type].filter(Boolean))];
  }));
  return result;
}

function highlightComparisonText(value, highlights = {}) {
  const types = new Map();
  (highlights.topic || []).forEach(term => types.set(String(term).toLowerCase(), 'topic-mark'));
  (highlights.conflict || []).forEach(term => types.set(String(term).toLowerCase(), 'conflict-mark'));
  const terms = [...types.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!terms.length) return escapeHtml(value || '');
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  return String(value || '').split(pattern).map(part => {
    const className = types.get(part.toLowerCase());
    return className ? `<mark class="${className}">${escapeHtml(part)}</mark>` : escapeHtml(part);
  }).join('');
}

function comparisonCardMarkup(item, role, highlights = {}) {
  return `<header><span class="compare-role">${role}</span><span class="category-chip cat-${escapeHtml(item.category)}">${escapeHtml(item.category)} <small>${categoryCode(item.category)}</small></span></header>
    <dl>
      <div><dt>요구사항 ID</dt><dd><span class="requirement-id ${item.id ? '' : 'missing'}">${escapeHtml(item.id || 'ID 없음')}</span></dd></div>
      <div class="compare-wide"><dt>요구사항 명칭</dt><dd class="compare-name">${highlightComparisonText(item.name, highlights)}</dd></div>
      <div class="compare-wide"><dt>상세 설명</dt><dd class="compare-description">${highlightComparisonText(item.description || '상세 설명이 없습니다.', highlights)}</dd></div>
    </dl>`;
}

function openRelationComparison(targetKey) {
  const current = state.requirements.find(item => item.key === state.editingKey);
  const target = state.requirements.find(item => item.key === targetKey);
  if (!current || !target) return;
  const relation = relationsFor(current.key).find(item => item.key === target.key);
  const isConflict = relation?.type === 'conflict';
  elements.compareType.textContent = isConflict ? '상충 가능 요구사항' : '관련 요구사항';
  elements.compareType.className = `compare-type ${isConflict ? 'conflict' : 'related'}`;
  elements.relationCompareModal.classList.toggle('conflict', isConflict);
  elements.compareTitle.textContent = `${current.id || '현재 항목'} ↔ ${target.id || '비교 항목'}`;
  elements.compareReason.textContent = relation?.reason || '두 요구사항의 조건과 상세 내용을 직접 비교해 주세요.';
  const highlights = comparisonHighlights(current, target, relation);
  elements.compareHighlightLegend.setAttribute('aria-hidden', isConflict ? 'false' : 'true');
  elements.compareCurrentCard.innerHTML = comparisonCardMarkup(current, '현재 요구사항', highlights.left);
  elements.compareTargetCard.innerHTML = comparisonCardMarkup(target, isConflict ? '상충 가능 요구사항' : '관련 요구사항', highlights.right);
  elements.relationCompareModal.classList.add('open');
  elements.relationCompareModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => elements.compareClose.focus(), 0);
}

function closeRelationComparison() {
  elements.relationCompareModal.classList.remove('open');
  elements.relationCompareModal.setAttribute('aria-hidden', 'true');
}

function renderRelations(key) {
  const relations = key ? relationsFor(key) : [];
  elements.relationPanel.classList.toggle('visible', relations.length > 0);
  elements.relationCount.textContent = relations.length;
  if (!relations.length) {
    elements.relationList.innerHTML = '<p class="relation-empty">현재 내용에서 뚜렷한 관련·상충 후보를 찾지 못했습니다.</p>';
    return;
  }
  const byKey = new Map(state.requirements.map(item => [item.key, item]));
  elements.relationList.innerHTML = relations.map(relation => {
    const target = byKey.get(relation.key);
    if (!target) return '';
    const label = relation.type === 'conflict' ? '상충 가능' : '관련';
    return `<button type="button" class="relation-item ${relation.type}" data-compare-related="${escapeHtml(target.key)}">
      <span class="relation-type">${label}</span>
      <span class="relation-copy"><strong>${escapeHtml(target.id || 'ID 없음')} · ${escapeHtml(target.name)}</strong><small>${escapeHtml(relation.reason)}</small></span>
      <span class="relation-compare-action">직접 비교</span>${icon('copy')}
    </button>`;
  }).join('');
}

function openDrawer(key = null) {
  state.editingKey = key;
  const item = key ? state.requirements.find(req => req.key === key) : normalizeRequirement({
    id: '', category: '기능', name: '', description: '', priority: '보통', status: '검토 전',
    confidence: 100, source: '수동 추가', acceptance: '미검토', completion: '미완료', tags: [],
  });
  if (!item) return;
  state.draftQuestions = (item.questions || []).map(question => ({ ...question }));
  state.draftGlossary = (item.manualGlossary || []).map(entry => ({ ...entry, manual: true }));
  state.draftExplanationSources = [...(item.explanationSources || [])];
  elements.drawerTitle.textContent = key ? '요구사항 편집' : '새 요구사항 추가';
  elements.formConfidence.textContent = key ? `${item.confidence}%` : '직접';
  elements.formSource.textContent = key ? `${item.source} · ${item.basis}` : '수동으로 추가하는 요구사항입니다.';
  elements.formId.value = item.id;
  elements.formCategory.value = item.category;
  elements.formName.value = item.name;
  elements.formDescription.value = item.description;
  elements.formEasyExplanation.value = item.easyExplanation;
  elements.formPriority.value = item.priority;
  elements.formStatus.value = item.status;
  elements.formFlag.value = item.flag || '';
  elements.formTags.value = (item.tags || []).join(', ');
  elements.formSourceInput.value = item.source === '수동 추가' ? '' : item.source;
  elements.formAcceptance.value = item.acceptance;
  elements.formCompletion.value = item.completion;
  elements.formApplicationPlan.value = item.applicationPlan;
  elements.formOwner.value = item.owner;
  elements.formChangeHistory.value = item.changeHistory;
  elements.glossarySearchInput.value = '';
  elements.glossarySearchGuide.textContent = '궁금한 용어를 직접 검색하거나 ‘용어 감지 요청’을 눌러 주세요. AI 도우미가 연결된 경우에는 정확한 뜻을 고르기 위해 현재 요구사항 문맥도 함께 전송될 수 있습니다.';
  state.glossaryDetectionRequested = false;
  state.visibleGlossary = [];
  state.remoteGlossary = [];
  elements.idError.textContent = '';
  elements.deleteButton.style.display = key ? '' : 'none';
  elements.duplicateButton.style.display = key ? '' : 'none';
  updateCounts();
  toggleManualGlossaryEditor(false);
  renderEasyExplanation();
  renderGlossary();
  renderQuestions();
  renderRelations(key);
  collapseDetailSections();
  elements.drawerBackdrop.classList.add('open');
  elements.detailDrawer.classList.add('open');
  elements.detailDrawer.setAttribute('aria-hidden', 'false');
  // Do not force focus after the drawer animation. In Korean IME environments,
  // moving focus asynchronously can commit a pending composition twice.
}

function closeDrawer() {
  closeRelationComparison();
  elements.drawerBackdrop.classList.remove('open');
  elements.detailDrawer.classList.remove('open');
  elements.detailDrawer.setAttribute('aria-hidden', 'true');
  state.editingKey = null;
  state.draftQuestions = [];
  state.draftGlossary = [];
  state.visibleGlossary = [];
  state.remoteGlossary = [];
  state.draftExplanationSources = [];
  state.glossaryDetectionRequested = false;
}

function updateCounts() {
  elements.nameCount.textContent = elements.formName.value.length;
  elements.descriptionCount.textContent = elements.formDescription.value.length;
}

function saveRequirement(event) {
  event.preventDefault();
  const id = elements.formId.value.trim();
  const duplicate = id && state.requirements.some(item => item.id.toLocaleLowerCase('ko') === id.toLocaleLowerCase('ko') && item.key !== state.editingKey);
  if (duplicate) {
    elements.idError.textContent = '이미 사용 중인 고유번호입니다.';
    elements.formId.focus();
    return;
  }
  if (!elements.requirementForm.reportValidity()) return;
  const previous = state.requirements.find(item => item.key === state.editingKey);
  const nextSourceOrder = state.requirements.reduce((max, item) => Math.max(max, Number(item.sourceOrder) || 0), 0) + 1;
  const requirement = normalizeRequirement({
    ...(previous || {}), key: previous?.key || makeKey(), id,
    sourceOrder: previous?.sourceOrder ?? nextSourceOrder,
    name: elements.formName.value.trim(), description: elements.formDescription.value.trim(),
    easyExplanation: elements.formEasyExplanation.value.trim(),
    explanationSources: state.draftExplanationSources,
    category: elements.formCategory.value, priority: elements.formPriority.value, status: elements.formStatus.value, flag: elements.formFlag.value,
    tags: elements.formTags.value.split(',').map(tag => tag.trim()).filter(Boolean),
    source: elements.formSourceInput.value.trim() || previous?.source || '수동 추가',
    acceptance: elements.formAcceptance.value, completion: elements.formCompletion.value,
    applicationPlan: elements.formApplicationPlan.value.trim(), owner: elements.formOwner.value.trim(),
    changeHistory: elements.formChangeHistory.value.trim(), confidence: previous?.confidence ?? 100,
    manualGlossary: state.draftGlossary,
    questions: state.draftQuestions.filter(question => question.question.trim()).map(question => ({ ...question, question: question.question.trim(), answer: question.answer.trim() })),
  });
  if (previous) state.requirements = state.requirements.map(item => item.key === previous.key ? requirement : item);
  else state.requirements.push(requirement);
  saveWorkspace(); render(); closeDrawer();
  showToast(previous ? '요구사항을 수정했습니다' : '요구사항을 추가했습니다', `${requirement.id || 'ID 없음'} · ${requirement.name}`);
}

function deleteRequirement(key = state.editingKey) {
  const item = state.requirements.find(req => req.key === key);
  if (!item || !window.confirm(`${item.id || item.name} 요구사항을 삭제할까요?`)) return;
  state.requirements = state.requirements.filter(req => req.key !== key);
  state.selected.delete(key); saveWorkspace(); render(); closeDrawer();
  showToast('요구사항을 삭제했습니다', `${item.id || item.name} 항목이 목록에서 제거되었습니다.`);
}

function duplicateRequirement() {
  const item = state.requirements.find(req => req.key === state.editingKey);
  if (!item) return;
  const nextSourceOrder = state.requirements.reduce((max, requirement) => Math.max(max, Number(requirement.sourceOrder) || 0), 0) + 1;
  const copy = normalizeRequirement({ ...item, key: makeKey(), sourceOrder: nextSourceOrder, id: '', name: `${item.name} (복사본)`, status: '검토 전', flag: '', completion: '미완료', createdAt: new Date().toISOString() });
  state.requirements.push(copy); saveWorkspace(); render(); closeDrawer(); openDrawer(copy.key);
  showToast('요구사항을 복제했습니다', '원문에 없는 ID는 만들지 않았습니다. 필요하면 RFP의 ID를 직접 입력하세요.');
}

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'hwpx', 'hwp', 'xlsx', 'xlsm', 'xls', 'txt', 'md', 'csv', 'tsv', 'json', 'xml'];

function validateFiles(files) {
  for (const file of files) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      showToast('지원하지 않는 파일입니다', `${file.name}: PDF, DOCX, PPTX, HWPX, XLSX, TXT, MD, CSV 파일을 사용해 주세요.`, true);
      return false;
    }
    if (file.size > 30 * 1024 * 1024) {
      showToast('파일이 너무 큽니다', `${file.name}: 파일당 30MB 이하만 업로드할 수 있습니다.`, true);
      return false;
    }
  }
  return true;
}

async function enrichWithReferences(files, notify = true) {
  const list = Array.from(files || []);
  if (!list.length || !validateFiles(list)) return false;
  if (!state.requirements.length) {
    showToast('먼저 RFP를 업로드해 주세요', 'RFP 요구사항을 분석한 뒤 관련 자료를 연결할 수 있습니다.', true);
    return false;
  }
  const formData = new FormData();
  formData.append('projectId', state.projectId);
  list.forEach(file => formData.append('references', file, file.name));
  const response = await fetch('/api/enrich', { method: 'POST', body: formData });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '관련 자료를 분석할 수 없습니다.');

  const merged = [...state.references, ...(payload.references || [])];
  state.references = merged.filter((item, index) => merged.findIndex(other => other.name === item.name && other.size === item.size) === index);
  saveWorkspace(); render();
  if (notify) showToast('관련 자료를 연결했습니다', `${list.length}개 자료는 쉬운 설명을 요청할 때 필요한 항목에만 반영됩니다.`);
  return true;
}

async function analyzeFiles(files) {
  const list = Array.from(files || []);
  if (!list.length || !validateFiles(list)) return;
  const [file, ...references] = list;
  const extension = file.name.split('.').pop().toLowerCase();
  showAnalysis(references.length ? `${file.name} 외 ${references.length}개 자료` : file.name);
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), 'X-Project-Id': state.projectId }, body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || '문서를 분석할 수 없습니다.');
    state.document = { ...payload.document, demo: false };
    state.requirements = (payload.requirements || []).map(normalizeRequirement);
    state.references = [];
    state.selected.clear(); resetFilters(false); saveWorkspace();
    if (references.length) {
      elements.analysisTitle.textContent = '관련 자료를 연결하고 있습니다';
      elements.analysisSubtitle.textContent = '회의록·녹취록·참고자료에서 요구사항과 연관된 내용을 찾는 중입니다.';
      await enrichWithReferences(references, false);
    }
    finishAnalysis(payload.requirements?.length || 0);
    setTimeout(() => {
      elements.analysisOverlay.classList.remove('open'); render();
      const referenceCopy = state.references.length ? ` 관련 자료 ${state.references.length}개는 요청형 쉬운 설명에 연결했습니다.` : '';
      showToast('RFP 분석을 완료했습니다', `${state.requirements.length.toLocaleString('ko-KR')}개 요구사항을 추출했습니다.${referenceCopy}`);
    }, 650);
  } catch (error) {
    elements.analysisOverlay.classList.remove('open');
    showToast('문서 분석에 실패했습니다', error.message, true);
  } finally {
    elements.fileInput.value = '';
  }
}

async function analyzeReferenceFiles(files) {
  showAnalysis(`${files.length}개 관련 자료`);
  try {
    elements.analysisTitle.textContent = '관련 자료를 분석하고 있습니다';
    await enrichWithReferences(files, false);
    finishAnalysis(state.requirements.length);
    setTimeout(() => {
      elements.analysisOverlay.classList.remove('open');
      showToast('관련 자료를 연결했습니다', `${files.length}개 자료는 쉬운 설명 요청 시 필요한 내용만 찾아 반영합니다.`);
    }, 450);
  } catch (error) {
    elements.analysisOverlay.classList.remove('open');
    showToast('관련 자료 분석에 실패했습니다', error.message, true);
  } finally {
    elements.referenceInput.value = '';
  }
}

let analysisTimer = null;
function showAnalysis(filename) {
  elements.analysisTitle.textContent = '문서를 읽고 있습니다';
  elements.analysisSubtitle.textContent = `${filename}의 구조와 텍스트를 안전하게 확인하는 중입니다.`;
  elements.analysisProgress.style.width = '7%';
  document.querySelectorAll('.analysis-steps span').forEach((step, index) => step.classList.toggle('active', index === 0));
  elements.analysisOverlay.classList.add('open');
  let progress = 7;
  clearInterval(analysisTimer);
  analysisTimer = setInterval(() => {
    progress = Math.min(88, progress + Math.ceil(Math.random() * 9));
    elements.analysisProgress.style.width = `${progress}%`;
    const activeIndex = progress < 28 ? 0 : progress < 53 ? 1 : progress < 76 ? 2 : 3;
    document.querySelectorAll('.analysis-steps span').forEach((step, index) => step.classList.toggle('active', index <= activeIndex));
    const titles = ['문서를 읽고 있습니다', '요구사항을 추출하고 있습니다', '유형별로 분류하고 있습니다', '분석 결과를 정리하고 있습니다'];
    elements.analysisTitle.textContent = titles[activeIndex];
  }, 420);
}
function finishAnalysis(count) {
  clearInterval(analysisTimer);
  elements.analysisProgress.style.width = '100%';
  elements.analysisTitle.textContent = '분석이 완료되었습니다';
  elements.analysisSubtitle.textContent = `${count.toLocaleString('ko-KR')}개 요구사항을 찾아 관리 목록으로 정리했습니다.`;
  document.querySelectorAll('.analysis-steps span').forEach(step => step.classList.add('active'));
}

function exportRequirements(format) {
  if (!state.requirements.length) { showToast('내보낼 요구사항이 없습니다', '먼저 RFP를 분석하거나 요구사항을 추가해 주세요.', true); return; }
  const filename = (state.document?.name || 'rfp_requirements').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
  let content, mime, extension;
  if (format === 'json') {
    const requirements = state.requirements.map(item => ({
      ...item,
      relationCandidates: relationsFor(item.key).map(relation => ({
        ...relation,
        targetId: state.requirements.find(target => target.key === relation.key)?.id || '',
        targetName: state.requirements.find(target => target.key === relation.key)?.name || '',
      })),
    }));
    content = JSON.stringify({ document: state.document, references: state.references, exportedAt: new Date().toISOString(), requirements }, null, 2);
    mime = 'application/json;charset=utf-8'; extension = 'json';
  } else {
    const headers = ['RFP 원문 순서', '요구사항 ID', '요구사항 분류', '분류코드', '요구사항 명칭', '상세설명', '쉬운 설명', '설명 참고자료', '수동 용어사전', '우선순위', '검토상태', '플래그', '관련·상충 후보', '수용여부', '적용방안', '담당자(소속)', '변경이력', '완료여부', '원문위치', '분류신뢰도', '태그'];
    const rows = state.requirements.slice().sort((a, b) => a.sourceOrder - b.sourceOrder).map(item => {
      const related = relationsFor(item.key).map(relation => {
        const target = state.requirements.find(candidate => candidate.key === relation.key);
        return `${relation.type === 'conflict' ? '상충 가능' : '관련'}: ${target?.id || target?.name || relation.key} (${relation.reason})`;
      }).join('|');
      return [item.sourceOrder, item.id, item.category, categoryCode(item.category), item.name, item.description, item.easyExplanation, (item.explanationSources || []).join('|'), (item.manualGlossary || []).map(entry => `${entry.term}: ${entry.meaning}`).join('|'), item.priority, item.status, FLAG_LABELS[item.flag] || '', related, item.acceptance, item.applicationPlan, item.owner, item.changeHistory, item.completion, item.source, `${item.confidence}%`, (item.tags || []).join('|')];
    });
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    content = '\ufeff' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
    mime = 'text/csv;charset=utf-8'; extension = 'csv';
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `${filename}_요구사항.${extension}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  elements.exportMenu.classList.remove('open');
  showToast('파일을 생성했습니다', `${state.requirements.length}개 요구사항을 ${extension.toUpperCase()}로 내보냈습니다.`);
}

async function exportQuestionWorkbook() {
  const count = state.requirements.reduce((sum, item) => sum + (item.questions || []).length, 0);
  if (!count) {
    showToast('등록된 질의사항이 없습니다', '요구사항을 열고 자동 제안 또는 직접 입력으로 질의를 먼저 추가해 주세요.', true);
    return;
  }
  elements.qaExportButton.disabled = true;
  try {
    const response = await fetch('/api/export-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: state.document, requirements: state.requirements }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || '질의응답서를 생성할 수 없습니다.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const project = (state.document?.name || 'RFP').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
    const link = document.createElement('a');
    link.href = url; link.download = `${project}_질의응답서.xlsx`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('질의응답서를 생성했습니다', `${count}개 질의를 Excel 파일로 정리했습니다.`);
  } catch (error) {
    showToast('질의응답서 생성에 실패했습니다', error.message, true);
  } finally {
    elements.qaExportButton.disabled = false;
  }
}

function showToast(title, message, error = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${error ? 'error' : ''}`;
  toast.innerHTML = `<span class="toast-icon">${icon(error ? 'x' : 'check')}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  elements.toastStack.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)'; }, 3800);
  setTimeout(() => toast.remove(), 4150);
}

function bindEvents() {
  const triggerUpload = () => elements.fileInput.click();
  elements.uploadButton.addEventListener('click', triggerUpload);
  elements.emptyUpload.addEventListener('click', triggerUpload);
  elements.fileInput.addEventListener('change', event => event.target.files.length && analyzeFiles(event.target.files));
  elements.referenceButton.addEventListener('click', () => elements.referenceInput.click());
  elements.referenceInput.addEventListener('change', event => event.target.files.length && analyzeReferenceFiles(event.target.files));
  elements.sampleButton.addEventListener('click', () => loadSample(true));
  elements.emptySample.addEventListener('click', () => loadSample(true));
  elements.addButton.addEventListener('click', () => openDrawer());
  elements.drawerClose.addEventListener('click', closeDrawer);
  elements.drawerBackdrop.addEventListener('click', closeDrawer);
  elements.cancelButton.addEventListener('click', closeDrawer);
  elements.requirementForm.addEventListener('submit', saveRequirement);
  elements.deleteButton.addEventListener('click', () => deleteRequirement());
  elements.duplicateButton.addEventListener('click', duplicateRequirement);
  elements.formName.addEventListener('input', () => { updateCounts(); invalidateGlossaryDetection(); });
  elements.formDescription.addEventListener('input', () => { updateCounts(); invalidateGlossaryDetection(); });
  elements.formEasyExplanation.addEventListener('input', resizeEasyExplanation);
  elements.formApplicationPlan.addEventListener('input', invalidateGlossaryDetection);
  elements.formGlossaryTerms.addEventListener('click', event => {
    const chip = event.target.closest('[data-term]');
    if (chip) showGlossaryTerm([...state.visibleGlossary, ...GLOSSARY, ...state.draftGlossary].find(entry => entry.term === chip.dataset.term));
  });
  elements.glossarySearchButton.addEventListener('click', searchGlossaryTerm);
  elements.glossarySearchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); searchGlossaryTerm(); }
  });
  elements.detectGlossaryButton.addEventListener('click', requestGlossaryDetection);
  elements.manualGlossaryToggle.addEventListener('click', () => toggleManualGlossaryEditor(!elements.manualGlossaryEditor.classList.contains('visible')));
  elements.manualGlossaryCancel.addEventListener('click', () => toggleManualGlossaryEditor(false));
  elements.manualGlossarySave.addEventListener('click', saveManualGlossaryTerm);
  elements.manualGlossaryRemove.addEventListener('click', removeManualGlossaryTerm);
  elements.generateEasyExplanation.addEventListener('click', requestEasyExplanation);
  elements.regenerateEasyExplanation.addEventListener('click', requestEasyExplanation);
  elements.toggleEasyExplanation.addEventListener('click', () => setDetailSectionExpanded('easy', elements.easyExplanationPanel.classList.contains('collapsed')));
  elements.toggleGlossary.addEventListener('click', () => setDetailSectionExpanded('glossary', elements.glossaryPanel.classList.contains('collapsed')));
  elements.toggleRelations.addEventListener('click', () => setDetailSectionExpanded('relations', elements.relationPanel.classList.contains('collapsed')));
  elements.addDirectQuestion.addEventListener('click', addDirectQuestion);
  document.querySelector('.question-actions').addEventListener('click', event => {
    const button = event.target.closest('[data-add-question]');
    if (button) addGeneratedQuestion(button.dataset.addQuestion);
  });
  elements.formQuestionList.addEventListener('input', event => {
    const questionKey = event.target.dataset.questionText || event.target.dataset.questionAnswer;
    const item = state.draftQuestions.find(question => question.key === questionKey);
    if (!item) return;
    if (event.target.dataset.questionText) item.question = event.target.value;
    if (event.target.dataset.questionAnswer) item.answer = event.target.value;
    if (event.target.dataset.questionAnswer) {
      const status = event.target.closest('.question-item').querySelector('.question-status');
      status.textContent = item.answer.trim() ? '답변완료' : '미답변';
      status.classList.toggle('answered', Boolean(item.answer.trim()));
    }
  });
  elements.formQuestionList.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-question]');
    if (!button) return;
    state.draftQuestions = state.draftQuestions.filter(question => question.key !== button.dataset.removeQuestion);
    renderQuestions();
  });
  elements.formId.addEventListener('input', () => { elements.idError.textContent = ''; });
  elements.searchInput.addEventListener('input', event => { state.query = event.target.value; renderRequirements(); });
  elements.categoryFilter.addEventListener('change', event => { state.category = event.target.value; render(); });
  elements.statusFilter.addEventListener('change', event => { state.status = event.target.value; renderRequirements(); });
  elements.priorityFilter.addEventListener('change', event => { state.priority = event.target.value; renderRequirements(); });
  elements.flagFilter.addEventListener('change', event => { state.flag = event.target.value; renderRequirements(); });
  elements.sortFilter.addEventListener('change', event => {
    const [sort, direction] = event.target.value.split(':');
    state.sort = sort; state.sortDirection = Number(direction) || 1; renderRequirements();
  });
  elements.filterReset.addEventListener('click', () => resetFilters());
  elements.categoryStrip.addEventListener('click', event => {
    const button = event.target.closest('[data-category]'); if (!button) return;
    state.category = button.dataset.category; elements.categoryFilter.value = state.category; render();
  });
  elements.idHierarchyLevels.addEventListener('click', event => {
    const button = event.target.closest('[data-id-path]');
    if (!button) return;
    try { state.idPath = JSON.parse(decodeURIComponent(button.dataset.idPath)); } catch (_) { state.idPath = []; }
    renderIdHierarchyControls(); renderRequirements();
  });
  elements.idHierarchyReset.addEventListener('click', () => { state.idPath = []; renderIdHierarchyControls(); renderRequirements(); });
  elements.requirementsBody.addEventListener('click', event => {
    const flagButton = event.target.closest('[data-flag-key]');
    if (flagButton) { updateRequirementFlag(flagButton.dataset.flagKey); return; }
    const opener = event.target.closest('[data-open]'); if (opener) openDrawer(opener.dataset.open);
  });
  elements.mobileList.addEventListener('click', event => {
    const flagButton = event.target.closest('[data-flag-key]');
    if (flagButton) { updateRequirementFlag(flagButton.dataset.flagKey); return; }
    const opener = event.target.closest('[data-open]'); if (opener) openDrawer(opener.dataset.open);
  });
  elements.relationList.addEventListener('click', event => {
    const button = event.target.closest('[data-compare-related]');
    if (!button) return;
    openRelationComparison(button.dataset.compareRelated);
  });
  elements.compareClose.addEventListener('click', closeRelationComparison);
  elements.compareDone.addEventListener('click', closeRelationComparison);
  elements.relationCompareModal.addEventListener('click', event => {
    if (event.target === elements.relationCompareModal) closeRelationComparison();
  });
  elements.requirementsBody.addEventListener('change', event => {
    const checkbox = event.target.closest('.row-check'); if (!checkbox) return;
    checkbox.checked ? state.selected.add(checkbox.dataset.key) : state.selected.delete(checkbox.dataset.key); renderRequirements(); renderBulkBar();
  });
  elements.selectAll.addEventListener('change', event => {
    filteredRequirements().forEach(item => event.target.checked ? state.selected.add(item.key) : state.selected.delete(item.key)); renderRequirements(); renderBulkBar();
  });
  elements.bulkApply.addEventListener('click', () => {
    const priority = elements.bulkPriority.value;
    const status = elements.bulkStatus.value;
    const flagValue = elements.bulkFlag.value;
    if (!priority && !status && !flagValue) {
      showToast('변경할 값을 선택해 주세요', '우선순위, 상태 또는 플래그 중 하나 이상을 선택해야 합니다.', true);
      return;
    }
    const count = state.selected.size;
    state.requirements = state.requirements.map(item => {
      if (!state.selected.has(item.key)) return item;
      return {
        ...item,
        priority: priority || item.priority,
        status: status || item.status,
        flag: flagValue ? (flagValue === 'none' ? '' : flagValue) : item.flag,
      };
    });
    elements.bulkPriority.value = ''; elements.bulkStatus.value = ''; elements.bulkFlag.value = '';
    saveWorkspace(); render(); showToast('선택 항목을 일괄 변경했습니다', `${count}개 요구사항에 선택한 값을 적용했습니다.`);
  });
  elements.bulkDelete.addEventListener('click', () => {
    if (!state.selected.size || !window.confirm(`선택한 ${state.selected.size}개 요구사항을 삭제할까요?`)) return;
    const count = state.selected.size; state.requirements = state.requirements.filter(item => !state.selected.has(item.key)); state.selected.clear();
    saveWorkspace(); render(); showToast('선택 항목을 삭제했습니다', `${count}개 요구사항이 제거되었습니다.`);
  });
  document.querySelectorAll('.sort-button').forEach(button => button.addEventListener('click', () => {
    const sort = button.dataset.sort; state.sortDirection = state.sort === sort ? state.sortDirection * -1 : 1; state.sort = sort; renderRequirements();
  }));
  elements.exportButton.addEventListener('click', event => { event.stopPropagation(); elements.exportMenu.classList.toggle('open'); });
  elements.qaExportButton.addEventListener('click', exportQuestionWorkbook);
  elements.exportMenu.addEventListener('click', event => { const button = event.target.closest('[data-export]'); if (button) exportRequirements(button.dataset.export); });
  document.addEventListener('click', event => { if (!event.target.closest('.export-wrap')) elements.exportMenu.classList.remove('open'); });
  elements.clearProject?.addEventListener('click', () => {
    if (!window.confirm('현재 문서와 요구사항을 모두 초기화할까요?')) return;
    state.document = null; state.references = []; state.requirements = []; state.selected.clear(); resetFilters(false); saveWorkspace(); render();
    showToast('프로젝트를 초기화했습니다', '새 RFP 문서를 업로드할 수 있습니다.');
  });
  elements.menuButton.addEventListener('click', () => { elements.sidebar.classList.add('open'); elements.mobileScrim.classList.add('open'); });
  elements.mobileScrim.addEventListener('click', () => { elements.sidebar.classList.remove('open'); elements.mobileScrim.classList.remove('open'); });
  document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
    const view = button.dataset.view;
    const target = view === 'dashboard' ? document.querySelector('.metric-grid') : view === 'documents' ? elements.documentBanner : document.querySelector('.content-card');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elements.sidebar.classList.remove('open'); elements.mobileScrim.classList.remove('open');
  }));
  ['dragenter', 'dragover'].forEach(type => elements.documentBanner.addEventListener(type, event => { event.preventDefault(); elements.documentBanner.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(type => elements.documentBanner.addEventListener(type, event => { event.preventDefault(); elements.documentBanner.classList.remove('dragging'); }));
  elements.documentBanner.addEventListener('drop', event => {
    if (!event.dataTransfer.files.length) return;
    if (state.document) analyzeReferenceFiles(event.dataTransfer.files);
    else analyzeFiles(event.dataTransfer.files);
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); elements.searchInput.focus(); }
    if (event.key === 'Escape') {
      if (elements.relationCompareModal.classList.contains('open')) closeRelationComparison();
      else closeDrawer();
    }
  });
}

async function init() {
  cacheElements();
  elements.formCategory.innerHTML = CATEGORIES.map(item => `<option value="${item.name}">${item.name} (${item.code})</option>`).join('');
  bindEvents();
  try {
    const boot = await window.ReqlyPortal.start();
    restoreWorkspace(boot.workspace);
    render();
  } catch (error) {
    console.error(error);
    window.alert(`앱을 시작하지 못했습니다: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', init);
