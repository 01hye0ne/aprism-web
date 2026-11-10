// 04.1 통합 관제 메인 · 모니터링 — Template ver.2 (Figma UI_00 826:8887)
// screens/dashboard-home.html (body.v2) 에서만 돈다.
//
// 셸의 동작(로봇 선택 · 타임라인 · 모달 · Drawer · AI 패널 · 지도)은 screen.js 와 map.js 가 그대로 한다.
// 여기서는 ver.2 에서 새로 생긴 것만 한다.
//
//   왼쪽 알림 히스토리 — 처리 필요 목록 · 거르기 · 고르기 · 오늘 확인 완료
//   Delta(AI 패널) — 목록 전체를 종합한 판단 · 문구 · 행동 버튼
//   오른쪽 로봇 카드 — 한 대씩 넘겨 보기
//   알림 단계 body[data-level] — normal · warning · critical (알림 정책 UI_99 1016:1055 의 주의 · 위험)
//
// 값은 검토용으로 이 파일 안에 있다. 서버가 없는 퍼블리싱이다.
// 주소 끝에 #normal · #few · #warning · #critical 을 붙이면 그 단계로 열린다. 없으면 Figma 와 같은 위험이다.
//   few — 알림이 있지만 Delta 종합 기준(5건)에 못 미친 판

(function () {
  "use strict";

  var body = document.body;
  if (!body.classList.contains("v2")) { return; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function icon(name) {
    var node = el("span", "i i-16");
    node.style.setProperty("--i", "var(--ic-" + name + ")");
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function clock(date) {
    var d = date || new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
  }

  // ==================================================================
  // 알림 데이터 — 최근 24시간.
  // 목록은 설비 이상만 채운다(디자이너 요청) — 로봇 상태(통신 · 경로 · 배터리)는 넣지 않는다.
  // 위험도는 알림 정책을 따른다 — 기준치를 넘은 이상징후(누출 · 부분방전 · 진동 · 과열 · 압력)는 주의,
  // NG 판정은 위험. 비상정지(E-STOP)는 사람이 누른 것이라 그대로 목록에 쌓인다.
  // ==================================================================
  // robot 은 우측 로봇 카드 번호(data-robot), wp 는 그 로봇 미션의 웨이포인트다 — 고르면 지도의
  // 그 자리 위에 쪽지가 선다. sum 은 쪽지의 원인 요약(두 줄), acts 는 "상황 조치" 선택지다.
  // live 는 쪽지 라이브 뷰에 까는 임시 그림(assets/img/alert-live-*.webp) — 디자이너가 준 검출 캡처 두 장을
  // 배관 · 펌프 계열(discharge)과 나머지(ppe)로 나눠 붙였다. 알림 내용과 딱 맞는 그림은 아니다.
  /*
   * acts — 조치 내용 칩. ai:true 는 DELTA 가 미는 것이고 칩에 [AI 추천] 꼬리표가 붙는다.
   * 여러 개 고를 수 있다: 현장에서는 "무전 연락 + 작업 중지" 처럼 둘을 같이 하는 일이 흔하다.
   */
  // floor — 알림이 난 웨이포인트의 층(v2.2, 10/19). 미션 하나가 B3 · B4 를 지나므로 줄마다 층 꼬리표가 붙는다.
  //   Robot 05 는 B3 를 돌고 B4 로 내려온 로봇이다 — WP-02 · 06 · 12 는 B3, WP-13 은 B4(10/20, 예전 Robot 02).
  var WARNINGS = [
    { sev: "warning", robot: 0, floor: "B4", wp: "WP-03", live: "discharge", where: "APRO 4F · WP-03 냉각수 배관 밸브", time: "10:11:19",
      title: "누출감지 · 냉각수 배관 밸브", detect: "누출감지",
      sum: "밸브 이음부에서 누출 패턴이 신뢰도 0.87 로 검출됐습니다. 임계 0.70 을 넘었고 연속 2프레임에서 나왔습니다.",
      lead: "밸브 이음부 현장 점검을 요청하세요.", fp: 15, fpLabel: "낮음",
      acts: [{ t: "현장 점검 요청", ai: true }, { t: "다음 순회 재측정" }, { t: "추이 관찰" }] },
    { sev: "warning", robot: 4, floor: "B3", wp: "WP-06", live: "discharge", where: "Robot 05 · WP-06 수배전반", time: "10:09:42",
      title: "부분방전 · 이상 점수 9.41", detect: "부분방전",
      sum: "이상 점수 9.41 로 임계 9.23 을 넘었습니다. PRPD 패턴이 코로나 방전 유형과 일치합니다.",
      lead: "재진단을 예약해 PRPD 패턴을 다시 확인하세요.", fp: 22, fpLabel: "보통",
      acts: [{ t: "재진단 예약", ai: true }, { t: "현장 점검 요청" }, { t: "추이 관찰" }] },
    { sev: "warning", robot: 4, floor: "B3", wp: "WP-12", live: "discharge", where: "Robot 05 · WP-12 냉각 펌프 P-2", time: "10:06:05",
      title: "진동 상승 · 냉각 펌프 P-2", detect: "진동감지",
      sum: "진동 RMS 4.8 mm/s 로 주의 기준 4.5 를 넘었습니다. 최근 3회 측정에서 계속 오르고 있습니다.",
      lead: "베어링 점검을 요청하세요.", fp: 18, fpLabel: "낮음",
      acts: [{ t: "베어링 점검 요청", ai: true }, { t: "다음 순회 재측정" }, { t: "추이 관찰" }] },
    { sev: "warning", robot: 4, floor: "B3", wp: "WP-02", live: "ppe", where: "Robot 05 · WP-02 발전기 베어링", time: "10:03:27",
      title: "과열 · 발전기 베어링 68.4℃", detect: "온도감지",
      sum: "베어링 표면 온도 68.4℃ 로 주의 기준 65℃ 를 넘었습니다. 주변 온도보다 31℃ 높습니다.",
      lead: "윤활 상태 점검을 요청하세요.", fp: 25, fpLabel: "보통",
      acts: [{ t: "윤활 상태 점검 요청", ai: true }, { t: "열화상 재촬영" }, { t: "추이 관찰" }] },
    { sev: "warning", robot: 4, floor: "B4", wp: "WP-13", live: "discharge", where: "Robot 05 · WP-13 공기 압축기 C-1", time: "10:01:12",
      title: "압력 편차 · 공기 압축기 C-1", detect: "계기인식",
      sum: "토출 압력 7.9 bar 로 정상 범위(8.2~8.8) 아래입니다. 흡입 필터가 막혔을 가능성이 있습니다.",
      lead: "흡입 필터 점검을 요청하세요.", fp: 30, fpLabel: "보통",
      acts: [{ t: "필터 점검 요청", ai: true }, { t: "재측정 예약" }, { t: "추이 관찰" }] }
  ];

  var CRITICAL = { sev: "critical", robot: 0, floor: "B4", wp: "WP-04", live: "ppe", where: "터빈 2 / Unit 03 · WP-04 N₂ 배관 압력계", time: "10:12:40",
    title: "지하발전소 B3 터빈 2 NG 1건 발견", detect: "계기인식",
    sum: "Spiral Casing Pr. 측정값 90 이 기준값 87 을 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.",
    lead: "현장에 무전으로 작업 중지를 요청하세요.", fp: 8, fpLabel: "낮음", brief: ["WP-04 압력계가 NG예요.", "작업 중지부터 요청하세요."],
    acts: [{ t: "현장 무전 연락 · 작업 중지 요청", ai: true }, { t: "로봇 정지 · 현장 점검 요청", ai: true }, { t: "재측정 후 판단" }] };

  // v2.2 — 제목의 층(B3)이 층 꼬리표(B4)와 어긋나 뺐다(10/19 디자이너). 예전 판(v2 · v2.1)은 그대로다.
  if (body.classList.contains("v2-2")) { CRITICAL.title = "지하발전소 터빈 2 NG 1건 발견"; }

  // v5(10/30 디자이너 "데이터 맞춰야 해") — 정기 순회 점검(Robot 01 · B4)의 알림을 안전진단(safety.js) 감지 6종 카드와 1:1 로 맞춘다.
  //   웨이포인트 · 층 · 로봇 이름은 관제 기준(WP-01~20 · 지하 4층 · Robot 01), 판정값 · 조치는 안전진단 기준(SUG).
  //   WP-03 누출 · WP-04 계기 · WP-05 이상음향 · 온도 · WP-06 부분방전 · WP-07 안전감지. 웨이포인트 이름은 screen.js Robot 01 steps 와 같다.
  //   예전 판(v2.2 · v4)은 그대로다.
  var V5 = body.classList.contains("ver-5");
  var R01_MORE = [];
  if (V5) {
    CRITICAL.sum = "N₂ 배관 압력 0.86 MPa 로 정상 범위(0.60 ~ 0.80)를 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.";
    // [11/06 v6] 결론을 Delta("현장 점검부터 요청하세요") · 안전진단 상세와 하나로 — 현장 점검이 첫 줄, 작업 중지는 함께 고르는 두 번째 추천
    if (body.classList.contains("ver-6")) {
      CRITICAL.lead = "현장 점검부터 요청하세요."; CRITICAL.brief = ["WP-04 압력계가 NG예요.", "현장 점검부터 요청하세요."];
      CRITICAL.acts = [{ t: "로봇 정지 · 현장 점검 요청", ai: true }, { t: "현장 무전 연락 · 작업 중지 요청", ai: true }, { t: "재측정 후 판단" }];
    }
    WARNINGS[0].sum = "밸브 이음부에서 누출 의심도 62% 로 기준 55% 를 넘었습니다. 연속 2프레임에서 나왔습니다.";
    WARNINGS[0].lead = "구역 출입을 통제하고 설비팀에 밸브 확인을 요청하세요.";
    WARNINGS[0].acts = [{ t: "구역 출입 통제", ai: true }, { t: "설비팀 밸브 확인 요청", ai: true }, { t: "현장 확인" }];
    R01_MORE = [
      { sev: "warning", robot: 0, floor: "B4", wp: "WP-05", live: "discharge", where: "APRO 4F · WP-05 냉각 펌프 P-2", time: "10:13:52",
        title: "이상음향 · 냉각 펌프 P-2", detect: "이상음향",
        sum: "이상 점수 20.4 로 기준 19.0 을 넘었습니다. 저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷합니다.",
        lead: "진동 정밀 측정을 요청하세요.", fp: 20, fpLabel: "낮음",
        acts: [{ t: "진동 정밀 측정 요청", ai: true }, { t: "설비 정지 검토 요청" }] },
      { sev: "warning", robot: 0, floor: "B4", wp: "WP-05", live: "discharge", where: "APRO 4F · WP-05 냉각 펌프 P-2", time: "10:14:10",
        title: "온도감지 · 냉각 펌프 P-2 48.6℃", detect: "온도감지",
        sum: "펌프 하우징 최고 48.6℃ 로 기준 40℃ 를 넘었습니다. 평소 36.2℃ 보다 12.4℃ 높습니다.",
        lead: "부하를 줄이고 점검을 요청하세요.", fp: 18, fpLabel: "낮음",
        acts: [{ t: "부하 감소 요청", ai: true }, { t: "설비 점검 요청", ai: true }, { t: "현장 확인" }] },
      { sev: "warning", robot: 0, floor: "B4", wp: "WP-06", live: "discharge", where: "APRO 4F · WP-06 수배전반 MCC-1", time: "10:15:31",
        title: "부분방전 · CH1 이상 점수 9.05", detect: "부분방전",
        sum: "CH1 이상 점수 9.05 로 기준 8.60 을 넘었습니다. CH2 · CH3 은 정상 범위입니다.",
        lead: "절연 진단을 요청하세요.", fp: 22, fpLabel: "보통",
        acts: [{ t: "절연 진단 요청", ai: true }, { t: "감시 강화", ai: true }] },
      { sev: "critical", robot: 0, floor: "B4", wp: "WP-07", live: "ppe", where: "APRO 4F · WP-07 고소 작업 발판", time: "10:16:48",
        title: "안전감지 · 안전벨트 미착용 1명", detect: "안전감지",
        sum: "고소 작업 발판에서 안전벨트를 매지 않은 작업자 1명이 신뢰도 0.91 로 검출됐습니다.",
        lead: "작업자에게 즉시 착용을 안내하세요.", fp: 6, fpLabel: "낮음", brief: ["WP-07 작업자가 안전벨트 미착용이에요.", "즉시 착용부터 안내하세요."],
        acts: [{ t: "작업자 즉시 착용 안내", ai: true }, { t: "고소 작업 일시 중지", ai: true }, { t: "안전관리팀 전달" }] }
    ];
  }

  // v4 지도 경로 표현(10/28 디자이너) — 전기실 열화상 점검(Robot 11 · B3)에 실제 알림 두 건. 지도 · 우측 목록의 세모(WP-02 위험 · WP-04 주의)와 1:1 이다.
  //   예전에는 세모만 고정으로 그려 최신 알림이 비어 있었다. body[data-route-rules](main-v3.html)에서만 쓴다 — 통합 순회 현황(building.js v3)에도 같은 두 건이 있다.
  var ROUTE_ALERTS = body.hasAttribute("data-route-rules") ? [
    { sev: "critical", robot: 10, floor: "B3", wp: "WP-02", live: "ppe", where: "Robot 11 · WP-02 HEPA Filter 차압계", time: "09:44:18",
      title: "차압 NG · HEPA Filter 차압계", detect: "계기인식",
      sum: "차압 312 Pa 로 교체 기준 250 Pa 를 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.",
      lead: "필터 교체와 현장 점검을 요청하세요.", fp: 9, fpLabel: "낮음", brief: ["WP-02 차압계가 NG예요.", "필터 교체부터 요청하세요."],
      acts: [{ t: "필터 교체 요청", ai: true }, { t: "현장 점검 요청", ai: true }, { t: "재측정 후 판단" }] },
    { sev: "warning", robot: 10, floor: "B3", wp: "WP-04", live: "discharge", where: "Robot 11 · WP-04 N₂ 배관 압력계", time: "10:15:52",
      title: "압력 편차 · N₂ 배관 압력계", detect: "계기인식",
      sum: "압력 0.62 MPa 로 정상 범위(0.65~0.75) 아래입니다. 최근 2회 측정에서 조금씩 내려가고 있습니다.",
      lead: "배관 연결부 누설 점검을 요청하세요.", fp: 20, fpLabel: "낮음",
      acts: [{ t: "누설 점검 요청", ai: true }, { t: "다음 순회 재측정" }, { t: "추이 관찰" }] }
  ] : [];

  // v5(10/30 "Delta 라이팅 시스템") — Delta 가 쓰는 낱말. 장소는 WP 번호 대신 설비 짧은 이름(eq · 8자 이내),
  //   현상(phen)은 무엇이 어떻게 됐는지(NG · 이상 대신 기준 초과 · 누출 · 과열 · 압력 낮음). 위험은 값 · 기준(val · std, 측정 이름 mname),
  //   다음 행동(next · "~부터 하세요"), 추천 조치 단추(btn), 추세(trend)까지 — 접힘 근거 줄 · 펼침 답이 여기서 읽는다.
  //   [10/30 라이팅 시스템 11] 측정 기록(hist), 원인 후보(cause · 현장 확인 전 추정), 점검 순서(fix · fixFirst) — 대화의 왜 · 어떻게 답. 초안 값이라 감지 종류별 목록이 정해지면 바꾼다.
  if (V5) {
    [
      [CRITICAL, "N₂ 압력계", "기준 초과", { mname: "압력", val: "0.86", std: "0.80", next: "현장 점검부터 요청하세요.", btn: "현장 점검 요청", trend: "최근 3회 측정 계속 오름",
        hist: ["0.77", "0.79", "0.86"], cause: ["감압 밸브 설정 이상", "하류 밸브 닫힘", "주변 온도 상승"],
        fixFirst: "감압 밸브 설정부터 보는 게 가장 빨라요.", fix: ["감압 밸브 설정값 확인(기준 0.80)", "하류 밸브 열림 확인", "계속 오르면 공급 밸브 잠금"] }],
      [WARNINGS[0], "냉각수 밸브", "누출", { btn: "구역 출입 통제" }],
      [WARNINGS[1], "수배전반", "부분방전", { btn: "재진단 예약" }],
      [WARNINGS[2], "냉각 펌프", "진동 상승", { btn: "베어링 점검 요청" }],
      [WARNINGS[3], "발전기 베어링", "과열", { btn: "윤활 상태 점검 요청" }],
      [WARNINGS[4], "공기 압축기", "압력 낮음", { btn: "필터 점검 요청" }],
      [R01_MORE[0], "냉각 펌프", "이상음", { btn: "진동 정밀 측정 요청" }],
      [R01_MORE[1], "냉각 펌프", "과열", { btn: "부하 감소 요청" }],
      [R01_MORE[2], "수배전반", "부분방전", { btn: "절연 진단 요청" }],
      [R01_MORE[3], "작업 발판", "벨트 미착용", { mname: "미착용", val: "1명", std: "0명", next: "즉시 착용부터 안내하세요.", btn: "작업자 착용 안내", trend: "연속 2프레임에서 검출",
        cause: ["고소 작업 중 벨트 미체결", "착용 안내 누락"],
        fixFirst: "작업자 위치부터 확인하는 게 가장 빨라요.", fix: ["작업자 위치 확인", "벨트 착용 안내", "착용 확인 뒤 작업 재개"] }],
      [ROUTE_ALERTS[0], "HEPA 차압계", "기준 초과", { mname: "차압", val: "312 Pa", std: "250 Pa", next: "필터 교체부터 요청하세요.", btn: "필터 교체 요청", trend: "최근 3회 측정 계속 오름",
        hist: ["268 Pa", "291 Pa", "312 Pa"], cause: ["필터 막힘", "흡입구 이물질", "팬 풍량 설정 변경"],
        fixFirst: "필터 오염 상태부터 보는 게 가장 빨라요.", fix: ["필터 오염 상태 확인", "흡입구 이물질 제거", "기준을 넘으면 필터 교체"] }],
      [ROUTE_ALERTS[1], "N₂ 압력계", "압력 낮음", { btn: "누설 점검 요청" }]
    ].forEach(function (r) {
      if (!r[0]) { return; }
      r[0].eq = r[1]; r[0].phen = r[2];
      Object.keys(r[3]).forEach(function (k) { r[0][k] = r[3][k]; });
    });
  }

  // [10/30 v6] Robot 05 · WP-12 "진동 상승"(진동감지)은 안전진단 감지 6종에 없다 — 6종의 이상음향으로 바꾼다(디자이너). 안전진단 발전기실 카드와 1:1.
  //   이상 점수 21.6 = 이상음향 주의 구간(19.0 ~ 22.8). v5 화면은 그대로다.
  if (body.classList.contains("ver-6")) {
    var w12 = WARNINGS[2];
    w12.title = "이상음향 · 이상 점수 21.6"; w12.detect = "이상음향";
    w12.sum = "이상 점수 21.6 으로 기준 19.0 을 넘었습니다. 저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷합니다.";
    w12.lead = "진동 정밀 측정을 요청하세요.";
    w12.acts = [{ t: "진동 정밀 측정 요청", ai: true }, { t: "설비 정지 검토 요청" }, { t: "추이 관찰" }];
    w12.phen = "이상음"; w12.btn = "진동 정밀 측정 요청";
    // [10/30 v6] Robot 05 알림 시각을 경로 차례(WP-02 → 06 → 12 → 13, 지하 3층을 돌고 지하 4층으로)로 — 예전엔 WP-13 이 가장 이르렀다. 안전진단 표 시각과 같다
    WARNINGS[3].time = "09:20:14"; WARNINGS[1].time = "09:36:42"; WARNINGS[2].time = "09:56:05";
  }

  // 검토용 단계 — 주소 끝 #… 로 고른다. few 는 알림은 있지만 Delta 종합 기준에 못 미친 판이다.
  var SETS = {
    normal: function () { return []; },
    few: function () { return [CRITICAL, WARNINGS[0], WARNINGS[1]]; },
    warning: function () { return WARNINGS.concat(R01_MORE, ROUTE_ALERTS).filter(function (a) { return a.sev === "warning"; }); },
    critical: function () { return [CRITICAL].concat(WARNINGS, R01_MORE, ROUTE_ALERTS); }
  };

  // ==================================================================
  // Delta — 알림 하나가 아니라 목록 전체를 종합해서 판단한다(2026-09-21 디자이너 정의).
  //
  //   주의 + 위험이 DELTA_MIN 건 이상 쌓이면 그 전체를 보고 주의 또는 위험으로 표시한다.
  //   그 아래에서는 종합 판단을 하지 않는다 — Delta 는 정상(파랑) 색으로 건수만 알린다.
  //
  // ※ 기준은 아직 정해지지 않았다. 아래 judge() 는 임시 규칙이다 —
  //    DELTA_MIN 건 이상일 때 위험이 한 건이라도 있으면 위험, 아니면 주의.
  //    기준이 정해지면 judge() 만 바꾸면 된다.
  //
  // 화면의 경고 색은 하나다(2026-09-21 정책 보완 — 델타는 파랑인데 테두리는 노랑이던 어색함).
  //   색(엣지 글로우 · Delta) = max(목록에서 가장 높은 단계, Delta 종합 판단 단계)
  //   파랑은 주의 · 위험이 하나도 없을 때만이다.
  // Delta 의 종합 판단은 색이 아니라 내용으로 드러난다 — 5건 이상이면 태그에 "종합" 이 붙고 행동 버튼이 뜬다.
  // 기준이 정해져 종합 판단이 단계를 올리면(예: 주의 5건 → 위험) 테두리와 Delta 가 함께 올라간다.
  // ==================================================================
  var DELTA_MIN = 5;

  // ==================================================================
  // 미션 — v2.2(2026-10-06 회의)부터 화면 전체가 미션 하나를 본다(mission-scope.js).
  // 알림은 로봇에서 나므로 그 로봇이 맡은 미션으로 묶는다. 이름은 screen.js 로봇 데이터에서 온다.
  // body[data-mission-scope] 가 없는 판(v2 · v2.1)은 예전처럼 미션과 상관없이 다 보인다.
  // ==================================================================
  function missionOf(a) { return (window.APRISM_ROBOT_MISSIONS || [])[a.robot] || null; }

  function judge(all) {
    var crit = all.filter(function (a) { return a.sev === "critical"; }).length;
    var warn = all.length - crit;
    var level = all.length < DELTA_MIN ? "normal" : (crit ? "critical" : "warning");
    return { level: level, total: all.length, crit: crit, warn: warn, all: all };
  }

  /*
   * Delta 가 하는 말. 두 벌이다 — 화면이 body[data-delta-copy] 로 고른다.
   *
   *   sentence  (기본) 말을 거는 문장체. ver.2 · 시안 1 · 2 가 쓴다.
   *   keyword   제목은 명사구, 아래 한 줄은 요지만 남긴 키워드체(디자이너 요청 — 토스증권 이슈 리스트 투).
   *             시안 3 처럼 창이 좁고 한눈에 읽어야 하는 판에 쓴다.
   *
   * 두 벌 다 line1 이 제목, line2 가 요지다. 닫힘은 둘째 줄이 한 줄 말줄임이라 앞쪽에 요지를 둔다.
   */
  var COPY = {
    sentence: function (j) {
      if (!j.total) {
        return { tag: "정기 순회 진행 중", line1: "안녕하세요. 홍길동 님",
          line2: "Robot 01 이 정기 순회를 진행하고 있어요. 지금은 특이사항이 없습니다." };
      }
      var mix = "위험 " + j.crit + " · 주의 " + j.warn;
      if (j.level === "normal") {
        return { tag: "알림 " + j.total + "건 관찰 중", line1: "안녕하세요. 홍길동 님",
          line2: "확인할 알림이 " + j.total + "건 있어요(" + mix + "). 왼쪽 목록에서 하나씩 살펴봐 주세요." };
      }
      if (j.level === "warning") {
        return { tag: "알림 " + j.total + "건 종합 · 주의", line1: "주의 알림이 " + j.total + "건 쌓였습니다.",
          line2: "여러 설비에서 이상징후가 겹칩니다. 개별 대응보다 전체 추세를 함께 보고 점검 순서를 정하는 것을 권합니다." };
      }
      return { tag: "알림 " + j.total + "건 종합 · 위험", line1: "위험 " + j.crit + "건을 포함해 알림이 " + j.total + "건 쌓였습니다.",
        line2: "위험 알림부터 조치하고, 겹치는 주의 알림은 한꺼번에 점검 계획을 세우는 것을 권합니다." };
    },

    /*
     * 제목만 키워드다 — 무슨 일인지 명사구 한 호흡으로 줄인다.
     * 본문은 문장체 그대로 둔다(디자이너 요청). 제목에서 상황을 집고 본문에서 왜 · 무엇부터 인지를 읽는다.
     */
    keyword: function (j) {
      var copy = COPY.sentence(j);
      if (!j.total) { copy.line1 = "정기 순회 진행 중"; }
      else if (j.level === "normal") { copy.line1 = "알림 " + j.total + "건 관찰 중"; }
      else if (j.level === "warning") { copy.line1 = "주의 알림 " + j.total + "건 누적"; }
      else { copy.line1 = "위험 " + j.crit + "건 포함 " + j.total + "건 누적"; }
      return copy;
    },

    /*
     * 대화체(v3 · 10/21 디자이너 — "AI 가 말하는 느낌이 안 난다").
     * 보고서 투("…을 권합니다")를 걷고, 관제사에게 말을 건다 — 이름을 부르고, 본 것을 말하고, 다음 걸음을 묻는다.
     * 끝은 되도록 질문으로 닫아 대화로 이어지게 한다. 묻는 내용은 조치 버튼과 같은 일이라 눌러서 답할 수 있다.
     * 할 수 없는 일(자동 처리 · 보고 등)은 약속하지 않는다. 제목(line1)은 키워드체 그대로다.
     */
    chat: function (j) {
      var copy = COPY.keyword(j);
      if (!j.total) {
        copy.line2 = "홍길동 님, Robot 01 과 정기 순회를 함께 보고 있어요. 지금까지는 특이사항이 없어요. 궁금한 게 있으면 편하게 물어보세요.";
      } else if (j.level === "normal") {
        copy.line2 = "알림이 " + j.total + "건 들어와 있어요. 아직 묶어서 볼 만큼은 아니라서, 왼쪽 목록에서 하나씩 확인해 보시면 돼요. 어떤 알림인지 같이 볼까요?";
      } else if (j.level === "warning") {
        copy.line2 = "주의 알림이 " + j.total + "건 쌓였어요. 여러 설비에서 비슷한 이상징후가 겹치고 있어서, 하나씩 보기보다 추세를 같이 보는 게 좋겠어요. 묶어서 한 번에 확인해 볼까요?";
      } else {
        copy.line2 = "위험 알림이 " + j.crit + "건 들어왔어요. 이것부터 먼저 보시는 게 좋겠어요." +
          (j.warn ? " 겹치는 주의 알림 " + j.warn + "건은 묶어서 한 번에 확인해 볼까요?" : " 어떤 알림인지 바로 설명해 드릴까요?");
      }
      return copy;
    }
  };

  /*
   * 두 줄(v5 · 10/29 디자이너 시안 "Delta 두 줄 알림", B 대화체).
   * 접힘 요약 칸에 두 줄만 둔다 — 1줄(굵게)은 가장 급한 알림의 지점과 판정, 2줄은 그 알림의 AI 추천 조치.
   * 새 말을 짓지 않고 알림 데이터(brief)에서 가져온다. 2줄은 펼침 첫 버튼 · 알림 상세 AI 추천과 같은 일이다.
   * 나머지 알림은 근거 줄 아이콘(+N)과 왼쪽 목록이 맡는다. 질문 · 인사 · "~게 좋겠어요" 같은 완충 문구는 없다.
   * 두 줄은 줄바꿈(\n)으로 잇고, 굵기 · 한 줄 말줄임은 CSS(v5.css)가 맡는다.
   */
  /*
   * 처리 순서(10/30 디자이너 — "지금 위험 · 주의가 몇 개, 어디서, 어떤 순서로"). 보는 미션의 위험을 먼저 끝내게 한다.
   *   이 미션 위험 → 다른 미션 위험 → 이 미션 주의 → 다른 미션 주의. 같은 칸 안은 items() 순서(오래된 순) 그대로.
   *   delta-chat.js 의 "처리 순서" 답도 같은 순서다.
   */
  function handleOrder(all, mine) {
    var here = function (a) { return mine.indexOf(a) >= 0; };
    var crit = function (a) { return a.sev === "critical"; };
    // [11/06] 같은 칸 안은 늘 오래된 알림부터 — 왼쪽 최신 알림 목록의 정렬([오래된 순 | 최신 순])을 바꿔도 Delta 가 먼저 말하는 알림은 바뀌지 않는다
    all = all.slice().sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    return all.filter(function (a) { return here(a) && crit(a); })
      .concat(all.filter(function (a) { return !here(a) && crit(a); }))
      .concat(all.filter(function (a) { return here(a) && !crit(a); }))
      .concat(all.filter(function (a) { return !here(a) && !crit(a); }));
  }
  /*
   * [10/30 디자이너 "Delta 라이팅 시스템"(artifact XjCvTz2qd9YPJmBpfheUCk)] 접힘 위젯 세 줄.
   *   1줄 상황(굵게) · 2줄 다음 행동 · 근거 줄 범위나 원인. Delta 가 빨강 · 노랑이면 셋 중 하나는 그 색의 이유를 말한다.
   *   위에서부터 묻고 처음 "예"인 문형을 쓴다 — 교대 직후 → 비상정지 → 알림 안내 → 평상시.
   *   알림 안내는 처리 순서(handleOrder)의 첫 알림을 본다. 보는 미션에 있으면 1줄 건수, 2줄 그 설비부터, 근거 줄 이 미션 · 다른 미션 나눔,
   *   올리면 "처리 순서 보기"가 대화 창을 열어 순서를 답한다. 다른 미션에 있으면(그쪽이 더 높은 등급) 그때만 옮기자고 묻는다.
   *   장소는 WP 번호를 쓰지 않는다 — 다른 미션은 미션 이름만(10/30 디자이너, 층 · "미션" 낱말 뺌), 이 미션은 설비 짧은 이름(eq).
   *   2줄 질문("~해 드릴까요?")은 Delta 가 화면 안에서 할 수 있는 일만 — 올리면 근거 줄이 답 단추(yes)가 되고 누르면 그 일(act)을 한다.
   *   문체는 ~요 하나, 가운뎃점 없음. 두 줄은 줄바꿈(\n)으로 잇고 v3-panel.js 가 줄마다 감싼다.
   */
  // 으로 / 로 — 받침 없거나 ㄹ 받침이면 "로"
  function euro(w) { var c = w.charCodeAt(w.length - 1), b = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; return b && b !== 8 ? "으로" : "로"; }
  function operatorName() {
    var slot = document.querySelector(".account-chip .t-label-2");
    return slot ? slot.textContent.trim() : "관제사";
  }
  /*
   * [11/05 v6] 접힌 위젯에 지시어(이 미션 · 다음 미션 · 다른 미션 · 지금 미션)를 쓰지 않는다 — 미션 이름을 적는다(디자이너, 문형표 5).
   *   근거 줄은 문형 대신 하는 일("위험 N건 원인 분석 중..." · "순회 경로 지켜보는 중...", v3-panel.js say()).
   *   미션 · waypoint 가 끼는 문형은 조각(parts)으로도 준다 — { m: 미션 } [M번호 이름], { wp: 번호 } waypoint 번호, { wpName: 이름 } waypoint 이름.
   *   한글판(ko) · 영문판(en)은 말 차례가 달라 조각을 따로 둔다. 영문판의 한글 조각(미션 · waypoint 이름)은 i18n-en.js 가 사전으로 옮긴다.
   */
  var V6 = body.classList.contains("ver-6");
  COPY.brief = function (j) {
    var copy = COPY.keyword(j);
    var all = j.all || [], mine = j.mine || all;
    var es = all.filter(function (a) { return a.estop; })[0];
    var say;
    if (j.handover !== null && j.handover !== undefined && j.total) {
      say = { l: ["어서오세요 " + j.handover + "님", (j.crit ? "위험 " + j.crit : "알림 " + j.total) + "건부터 보여 드릴까요?"],
        clue: "인계 알림 " + j.total + "건", yes: "네, 보여 주세요", act: "shift" };
    } else if (es) {
      say = { l: es.brief, clue: "구동 차단됨" };
    } else if (body.classList.contains("ver-6") && $(".robot-strip .robot-card[aria-pressed='true'] .badge-normal")) {
      // [11/05 v6] 보는 미션이 끝나면 알림이 남아 있어도 완료 인사 — Delta 는 파랑(calm), 엣지 글로우는 알림 단계 그대로(tellAi)
      say = { l: ["미션 완료.", "다음 미션 전에 잠깐 스트레칭 어떠세요?"], clue: "수고하셨습니다.", calm: true };
    } else if (j.total) {
      // 처리 순서의 첫 알림이 어디 있는지로 가른다 — 다른 미션 알림이 더 높은 등급일 때만 옮기자고 묻는다(10/30 디자이너)
      var ord = handleOrder(all, mine), first = ord[0];
      var inMine = function (a) { return mine.indexOf(a) >= 0; };
      var sev = first.sev, word = sev === "critical" ? "위험" : "주의";
      if (!inMine(first)) {
        var om = missionOf(first);
        say = { l: ["다른 미션에 " + word + " 단계 알림이 있어요!", "먼저 확인하는 것을 추천드릴게요."],
          clue: om, scope: sev, yes: word + " 단계 미션으로 이동하기", act: { go: om } };
        // 단추는 "미션 이동하기" — 미션 이름은 바로 위 1줄에 있다(이름을 넣으면 단추가 너무 길다, 11/05)
        if (V6 && om) {
          say.l[0] = om + "에 " + word + " 단계 알림이 있어요!";
          say.yes = "미션 이동하기";
          say.parts = {
            ko: [[{ m: om }, "에 " + word + " 단계 알림이 있어요!"], [say.l[1]]],
            en: [[{ m: om }, " has " + (sev === "critical" ? "critical" : "warning") + "-level alerts!"], [say.l[1]]]
          };
        }
      } else {
        var mc = all.filter(function (a) { return a.sev === sev && inMine(a); }).length;
        var oc = all.filter(function (a) { return a.sev === sev && !inMine(a); }).length;
        if (sev === "critical") {
          say = { l: ["위험 " + j.crit + "건" + (j.warn ? ", 주의 " + j.warn + "건" : "") + "이 있어요.", (first.eq || first.title) + "부터 확인하세요."],
            clue: ["이 미션 위험 " + mc, oc ? "다른 미션 위험 " + oc : ""].filter(Boolean).join(", "),
            scope: oc ? sev : "", yes: "처리 순서 보기", act: "order", open: "처리 순서 알려 줘" };
          // [11/05 v6] 2줄 = {waypoint 번호}{waypoint 이름}부터 확인하세요. 번호는 경로 목록 번호 모양, 이름만 흰색 굵게(나머지는 2줄 회색) — 문형표 5
          if (V6) {
            var wpn = /\d+/.exec(first.wp || ""), wpName = first.eq || first.title;
            var wpTok = wpn ? [{ wp: parseInt(wpn[0], 10), sev: first.sev }] : [];
            say.parts = {
              ko: [[say.l[0]], wpTok.concat([{ wpName: wpName }, "부터 확인하세요."])],
              en: [[say.l[0]], ["Check "].concat(wpTok, [{ wpName: wpName }, " first."])]
            };
          }
        } else {
          // 주의만 있을 때 — v5 이하는 한 문장(10/30 디자이너 문구), v6 은 아래에서 위험과 같은 두 줄로
          say = { l: ["지금 미션에서 " + mc + "건" + (oc ? ", 다른 미션에서 " + oc + "건" : "") + "의 확인해야 할 주의 단계 알림이 있어요."],
            clue: "먼저: " + (first.eq || first.title), yes: "처리 순서 보기", act: "order", open: "처리 순서 알려 줘" };
          if (V6) {
            // [11/06 v6] 위험(F4)과 같은 짜임 — 1줄 "주의 n건이 있어요.", 2줄 {waypoint 번호}{waypoint 이름}부터 확인하세요(디자이너).
            //   미션별 건수 한 문장(예전 F5)은 길고 위험 문형과 짜임이 달랐다. 미션별 나눔은 펼친 Delta 가 맡는다.
            var wn = /\d+/.exec(first.wp || ""), wName = first.eq || first.title;
            var wTok = wn ? [{ wp: parseInt(wn[0], 10), sev: first.sev }] : [];
            say.l = ["주의 " + j.warn + "건이 있어요.", wName + "부터 확인하세요."];
            say.parts = {
              ko: [[say.l[0]], wTok.concat([{ wpName: wName }, "부터 확인하세요."])],
              en: [[say.l[0]], ["Check "].concat(wTok, [{ wpName: wName }, " first."])]
            };
          }
        }
      }
    } else {
      var card = $(".robot-strip .robot-card[aria-pressed='true']");
      var rn = card && card.querySelector(".robot-id") ? card.querySelector(".robot-id").textContent.trim() : "Robot 01";
      var done = !!(card && card.querySelector(".badge-normal"));
      say = { l: [operatorName() + "님!", rn + josa(rn) + (done ? " 미션을 완료했어요!" : " 순회 중이에요.")],
        clue: done ? "미션 완료" : "순회 경로 지켜보는 중" };
    }
    copy.line2 = say.l.join("\n");
    copy.say = say;
    return copy;
  };

  // [11/05 v6] 움직임 시뮬레이션이 상태를 바꾸면(map-v6.js) 다시 그린다 — 미션 완료 인사가 들고 난다
  document.addEventListener("aprism:rr-mode", function () { render(); });

  // 받침 따라 이/가 — "Robot 01이", "Robot 05가"
  function josa(word) {
    var c = word.charCodeAt(word.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) { return (c - 0xac00) % 28 ? "이" : "가"; }
    return /[013678LMNR]$/i.test(word) ? "이" : "가";
  }

  function deltaCopy(j) {
    var mode = body.getAttribute("data-delta-copy");
    return (COPY[mode] || COPY.sentence)(j);
  }

  // Delta 를 펼쳤을 때의 행동 버튼 — 알림 여러 건을 한꺼번에 다룬다.
  // ※ 문구는 모두 임시다(10/20 디자이너 — 이름은 아직 정해진 게 없다). 누르면 하는 일은 아래 deltaAct.
  function deltaActions(j) {
    if (j.level === "critical") {
      return ["위험 " + j.crit + "건부터 조치", "주의 " + j.warn + "건 묶어서 확인", "현장 점검 한꺼번에 요청"];
    }
    if (j.level === "warning") {
      return ["주의 " + j.warn + "건 묶어서 확인", "추세 한 번에 보기", "현장 점검 한꺼번에 요청"];
    }
    return [];
  }

  var DONE_BASE = [
    { time: "10:29:10", title: "온도감지 · WP-03 펌프 하우징", how: "추이 관찰 · 다음 순회 재측정", who: "김현대" },
    { time: "10:18:52", title: "소음 이상 · 변압기 TR-1", how: "현장 점검 요청 · 이상 없음", who: "김현대" },
    { time: "10:02:31", title: "진동감지 · WP-02 터빈1 베어링", how: "추이 관찰 · 다음 순회 재측정", who: "홍길동" },
    { time: "09:47:15", title: "온도감지 · WP-03 펌프 하우징", how: "현장 점검 요청 · 이상 없음", who: "홍길동" },
    { time: "09:30:08", title: "누유 흔적 · 유압 유닛 HU-2", how: "청소 후 재측정 · 정상", who: "김현대" }
  ];
  /*
   * [11/02 v6] 오늘 확인 완료 기본 기록도 감지 6종 · "감지 · 측정 항목 + 값"(alert-text-v6.js 규칙). 위치 줄은 아직 넣지 않는다(디자이너 — 정보가 많다).
   *   소음 이상(변압기) → 부분방전 · 진동(터빈 베어링) → 이상음향 · 누유 흔적 → 누출감지. 값은 주의 기준을 조금 넘은 임시 값.
   */
  if (body.classList.contains("ver-6")) {
    var DONE6 = ["온도감지 · 최고 온도 44.2 ℃", "부분방전 · 이상 점수 8.92", "이상음향 · 이상 점수 19.6", "온도감지 · 최고 온도 41.5 ℃", "누출감지 · 누출 의심도 58%"];
    var WP6 = ["WP-03", "WP-11", "WP-02", "WP-03", "WP-09"];   // 어디서 — 처리 내용 줄 끝에 지점 번호만(디자이너, 위치 줄 대신)
    DONE_BASE.forEach(function (d, i) { if (DONE6[i]) { d.title = DONE6[i]; d.wp = WP6[i]; } });
    DONE_BASE[0].time = "10:19:10";   // [11/02 v6] 10:29 는 상태바 시계(10:20)보다 뒤였다 — 지금 바로 앞으로(알림 센터 조치 요청됨 오늘 첫 줄과 같다)
  }
  var DONE = DONE_BASE.slice();

  var RANK = { critical: 0, warning: 1 };

  // ==================================================================
  // 알림 히스토리
  // ==================================================================
  var list = $("[data-ah-list]");
  var doneList = $("[data-done-list]");
  var doneCount = $("[data-done-count]");
  var filters = $$("[data-ah-filter]");
  if (!list) { return; }

  var aiActions = $("[data-ai-actions]");

  /*
   * Delta 조치 버튼 — 문구의 첫 낱말로 할 일을 고른다(10/20 디자이너).
   *   위험 n건부터 조치   → 가장 오래된 위험 알림의 팝오버를 연다. Delta 창은 펼친 채 둔다(10/30 디자이너).
   *   주의 n건 묶어서 확인 → 목록을 주의로 거르고, Delta 가 주의 n건을 묶어 답한다(대화).
   *   추세 한 번에 보기    → Delta 가 추세를 답한다(대화).
   *   현장 점검 한꺼번에 요청 → Delta 가 요청을 정리해 답한다(대화). 실제 전송은 아직 없다.
   * 대화는 delta-chat.js 의 APRISM_DELTA.ask 로 보낸다.
   */
  function askDelta(text) { if (window.APRISM_DELTA) { window.APRISM_DELTA.ask(text); } }
  function setFilter(sev) {
    var b = $("[data-ah-filter='" + sev + "']");
    if (b && b.getAttribute("aria-pressed") !== "true") { b.click(); }
  }
  function deltaAct(label) {
    if (/^위험/.test(label)) {
      var crit = items().filter(function (a) { return a.sev === "critical" && (!scoped || missionOf(a) === mission); });
      if (!crit.length) { crit = items().filter(function (a) { return a.sev === "critical"; }); }
      if (!crit.length) { return; }
      setFilter("all");
      if (picked !== crit[0]) { note.open(crit[0]); }
      return;
    }
    if (/^주의/.test(label)) { setFilter("warning"); askDelta(label); return; }
    askDelta(label);
  }
  // 접힘 위젯 답 단추(라이팅 시스템 "네, ~해 주세요") — 2줄 질문의 일을 한다. v3-panel.js 가 부른다.
  window.APRISM_DELTA_DO = function () {
    var s = window.APRISM_DELTA_SAY;
    if (!s || !s.act) { return false; }
    // 창은 접힌 채 그 일만 한다 — 주고받음은 대화 기록에 남는다(라이팅 시스템 6, delta-chat.js APRISM_DELTA.log)
    var said = null;
    var mineNow = function () { return items().filter(function (a) { return !scoped || missionOf(a) === mission; }); };
    if (s.act.go) {
      if (window.APRISM_SCOPE_TO) { window.APRISM_SCOPE_TO(s.act.go); }
      var here = mineNow(), hc = here.filter(function (a) { return a.sev === "critical"; }).length;
      said = { text: s.clue + euro(s.clue) + " 옮겼어요. " + (hc ? "위험이 " + hc + "건 있어요." : here.length ? "주의가 " + here.length + "건 있어요." : "확인할 알림은 없어요."),
        btn: here[0] ? { label: "알림 열기", act: function () { window.APRISM_OPEN_ALERT(here[0]); } } : null };
    } else if (s.act === "shift") {
      var anyCrit = items().some(function (a) { return a.sev === "critical"; });
      setFilter(anyCrit ? "critical" : "all");
      said = { text: anyCrit ? "위험 알림만 목록에 걸렀어요." : "인계 알림을 목록에 펼쳤어요." };
    }
    if (said && window.APRISM_DELTA && window.APRISM_DELTA.log) { window.APRISM_DELTA.log(s.yes, said.text, said.btn); }
    return true;
  };
  // 펼침 대화(delta-chat.js)가 알림 줄을 누르면 그 알림 쪽지를 연다 — 대화 창은 펼친 채 둔다(10/30 디자이너, 라이팅 시스템 6 · 8)
  window.APRISM_OPEN_ALERT = function (a) {
    setFilter("all");
    if (picked !== a) { note.open(a); }
  };
  if (aiActions) {
    aiActions.addEventListener("click", function (event) {
      var b = event.target.closest && event.target.closest("button");
      if (b) { deltaAct(b.textContent.trim()); }
    });
  }
  var scoped = body.hasAttribute("data-mission-scope");   // v2.2 — 미션 범위
  var withReport = list.hasAttribute("data-ah-report");   // v2.2 — 알림마다 [안전진단](10/19 · 예전 [보고서])
  var mission = scoped ? missionOf({ robot: 0 }) : null;

  var level = "critical";
  var extra = [];          // E-STOP 처럼 화면에서 생긴 알림
  var filter = "all";
  var picked = null;       // 고른 알림(객체) — 지도에 쪽지가 열려 있는 알림
  var pickedDone = null;   // [11/06 v6] 고른 확인된 알림(객체) — 알림을 고르면 놓는다
  var resolved = [];       // 확인 처리한 알림 — 목록에서 빠지고 오늘 확인 완료로 간다
  var cleared = [];        // [11/05] 확인 처리한 알림 전부(화면에서 생긴 것 포함) — 지도 번호를 회색으로 남긴다(markWaypoints)

  function items() {
    var base = (SETS[level] || SETS.critical)().filter(function (a) { return resolved.indexOf(a) < 0; });
    // 위험이 먼저, 같은 단계 안에서는 고른 시간 순서([오래된 순 | 최신 순], ah-sort.js — 기본 오래된 순)
    var SORT = window.APRISM_AH_SORT;
    return extra.concat(base).sort(function (a, b) {
      return (RANK[a.sev] - RANK[b.sev]) || (SORT ? SORT.time(a, b) : (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    });
  }

  function highest(all) {
    if (all.some(function (a) { return a.sev === "critical"; })) { return "critical"; }
    return all.length ? "warning" : "normal";
  }

  function wpPlace(a) {
    var m = /WP-\d+.*$/.exec(a.where || "");
    return m ? m[0] : a.where;
  }

  function item(a) {
    var node = el("button", "ah-item is-" + a.sev);
    node.type = "button";
    node.setAttribute("role", "listitem");
    node.setAttribute("aria-pressed", a === picked ? "true" : "false");
    if (a.wp) { node.setAttribute("data-wp", a.wp); }   // [11/06] 지도가 호버한 알림의 지점을 짚는다(map-v6.js rrHot)

    var where = el("span", "ah-where t-caption");
    // v2.2 — 위치 줄 앞 표적 아이콘은 뺐다(10/19 디자이너). 층 꼬리표가 이미 "위치" 신호다.
    if (!scoped) { where.appendChild(icon("target")); }
    // v2.2 — 층 꼬리표는 웨이포인트 이름 앞(10/19 디자이너). 미션이 여러 층을 지나므로 줄마다 층을 말한다.
    if (scoped && a.floor) { where.appendChild(el("span", "floor-tag num", a.floor)); }
    // [11/10 v7 디자이너 · UT 개선 사용성 1b] 층 꼬리표와 지점 이름 사이에 웨이포인트 번호 원(기본 지점 모양 — 지도 팝오버 .mbt-pin.is-plain 과 같다).
    //   목록 · 지도 · 우측 지점 목록이 같은 번호로 이어진다(UT P01 "목록에도 지도처럼 번호를"). 단계색은 앞 아이콘 · 왼쪽 띠가 말하므로 번호는 기본색
    var wpNo = scoped && document.body.classList.contains("ver-7") && /WP-(\d+)/.exec((a.wp || "") + " " + (a.where || ""));
    if (wpNo) {
      var wpPin = el("span", "mbt-pin is-plain ah-wp-pin");
      wpPin.setAttribute("data-n", String(parseInt(wpNo[1], 10)));
      wpPin.setAttribute("role", "img");
      wpPin.setAttribute("aria-label", "WP-" + wpNo[1]);
      where.appendChild(wpPin);
    }
    // v2.2 — 위치는 웨이포인트만 "WP-nn 웨이포인트명"(10/19 디자이너). 로봇 · 설비 단위 앞말은 뺀다.
    // [11/06 v6] 번호(WP-nn)는 뺐다(디자이너) — 층 꼬리표 + 지점 이름만. 줄을 누르면 지도가 그 지점을 가리킨다.
    var place = scoped ? wpPlace(a) : a.where;
    if (scoped && body.classList.contains("ver-6")) { place = String(place || "").replace(/^WP-\d+\s*/, ""); }
    where.appendChild(el("span", "ah-wp", place));
    if (!scoped) { where.appendChild(el("span", "num", a.time)); }

    // 알림 제목은 Label/2(13/500) 다 — 한 단계 내렸다(디자이너 요청).
    // 화면의 Label/1(14/800)이 목록마다 깔려 "다 중요해 보이는" 것을 푸는 쪽이다.
    var title = el("span", "ah-title t-label-2");
    title.appendChild(icon(a.sev === "critical" ? "error" : "warning"));
    var A6 = body.classList.contains("ver-6") && window.APRISM_ALERT6, r6 = A6 && A6.of(a.title);
    title.appendChild(el("span", null, A6 ? A6.title(a.title) : a.title));   // [11/02 v6] 제목 = 감지 · 측정 항목 + 값(alert-text-v6.js)
    // [11/05 논의] 측정 채널(CH1)은 목록 줄에서 뺐다 — 6종 중 부분방전만 있어 이 줄만 낯선 꼬리가 붙고, 목록에선 뜻이 안 읽힌다.
    //   채널은 상세(쪽지 요약 "CH1 … CH2 · CH3 은 정상", 안전진단 메모)가 말한다. 예전: where 끝에 "· " + r6.ch

    if (scoped) {
      // v2.2 — 무슨 일(위험도 + 알림명)이 첫 줄, 어디서가 둘째 줄(10/19 디자이너). 타임라인 · 오늘 확인 완료처럼 이름이 먼저다.
      // 시각은 첫 줄 오른쪽 — 목록이 "오래된 순" 이라 정렬 기준이 위에 보이게.
      // [11/06 v6] 시 · 분만 늘 보이고 초는 줄에 올라가거나 고를 때 붙는다(v6.css .ah-time-s) — 처리 필요 목록은 얼마나 지났는지가 한눈에 보여야 한다.
      var tm = el("span", "ah-time t-caption num");
      var hm = /^(\d{1,2}:\d{2})(:\d{2})$/.exec(a.time || "");
      if (hm && body.classList.contains("ver-6")) {
        tm.appendChild(document.createTextNode(hm[1]));
        tm.appendChild(el("span", "ah-time-s", hm[2]));
        tm.title = a.time;
      } else { tm.textContent = a.time; }
      title.appendChild(tm);
      node.appendChild(title);
      node.appendChild(where);
    } else {
      node.appendChild(where);
      node.appendChild(title);
    }
    // 고르면 그 알림이 난 웨이포인트 위에 쪽지가 선다. 같은 것을 다시 누르면 닫는다.
    // Delta 문구는 목록 전체를 종합한 것이라 바뀌지 않는다.
    node.addEventListener("click", function () {
      if (picked === a) { note.close(); } else { note.open(a); }
    });
    if (!withReport) { return node; }

    // [안전진단] 은 알림 버튼 안에 넣을 수 없다(버튼 안 버튼) — 한 줄을 감싸고 오른쪽 아래에 얹는다.
    // 10/19 디자이너 — [보고서] 를 [안전진단] 으로 바꿨다. v5 만 안전진단 화면으로 이어진다(아래), 예전 판은 자리만.
    var row = el("div", "ah-row");
    row.setAttribute("role", "listitem");
    node.removeAttribute("role");
    // 평소엔 아이콘만, 그 줄에 올라가면 글자가 붙는다 — 알림마다 반복돼 글자까지 늘 서 있으면 목록이 시끄럽다.
    // v5(10/30) — 안전진단(safety-v5.html)으로 간다. 이 알림의 미션 · 감지 종류를 주소에 실어 그 카드의 자세히 보기를 바로 연다.
    var v5 = body.classList.contains("ver-5"), report;
    if (v5) {
      report = el("a", "btn btn-ghost is-xs ah-report");
      var q = new URLSearchParams();
      var mis = missionOf(a);
      if (mis) { q.set("mission", mis); }
      if (a.detect) { q.set("detect", a.detect); }
      report.href = (body.classList.contains("ver-6") ? "./safety-v6.html?" : "./safety-v5.html?") + q.toString();
      report.title = "안전진단에서 이 알림의 감지 결과 보기";   // 툴팁은 풀어 쓴다 — 짧은 이름(진단 상세)을 보완
    } else {
      report = el("button", "btn btn-ghost is-xs ah-report");
      report.type = "button";
      report.title = "안전진단 화면 준비 중";
    }
    // [10/30 v6] 이름을 하나로 — 목록 버튼 · 팝오버 버튼 모두 "진단 상세"(디자이너, 예전 "진단 상세"은 길었다). 왼쪽 메뉴 [안전진단]과 달리 이 알림의 자세히 보기로 간다
    report.setAttribute("aria-label", (body.classList.contains("ver-6") ? "진단 상세" : "안전진단"));
    report.appendChild(icon("shield"));
    report.appendChild(el("span", "ah-report-label", (body.classList.contains("ver-6") ? "진단 상세" : "안전진단")));
    row.appendChild(node);
    row.appendChild(report);
    return row;
  }

  function doneItem(d) {
    var V6 = body.classList.contains("ver-6");
    // [11/06 v6] 확인된 알림도 고를 수 있다 — 누르면 그 줄이 골라지고 지도가 그 지점으로 간다(쪽지는 열지 않는다, 이미 처리된 것).
    var node = el(V6 ? "button" : "div", "done-item");
    if (V6) {
      node.type = "button";
      node.setAttribute("aria-pressed", d === pickedDone ? "true" : "false");
      node.addEventListener("click", function () {
        if (pickedDone === d) { pickedDone = null; render(); return; }
        note.close();
        pickedDone = d;
        if (d.wp) { document.dispatchEvent(new CustomEvent("aprism:waypoint", { detail: { id: d.wp, from: "panel", done: true } })); }
        render();
      });
    }
    node.setAttribute("role", "listitem");
    if (d.fresh) { node.classList.add("is-new"); }

    var head = el("span", "done-title");
    // 확인 완료 제목도 알림 제목과 같은 Label/2 다 — 처리 끝난 것이 처리할 것보다 크면 위계가 뒤집힌다.
    head.appendChild(el("span", "t-label-2", window.APRISM_ALERT6 ? window.APRISM_ALERT6.title(d.title) : d.title));   // [11/10 v7] 이름 규칙(alert-text-v6.js — v7 은 감지 이름 뺌). v6 이하는 그대로
    // [11/06 v6] 시각은 줄에 올라가거나 고를 때만 보인다(v6.css .done-time) — 확인된 기록은 시각보다 무엇을 어떻게 처리했는지가 먼저다.
    head.appendChild(el("span", "t-caption num done-time", d.time));

    var how = el("span", "done-how t-caption");
    how.appendChild(icon("check"));
    if (V6) {
      // [11/06 v6] 처리 줄은 문구 하나 — "조치 · 결과" 중 결과(이상 없음 · 정상 · 다음 순회 재측정)만 늘 보이고,
      //   조치(현장 점검 요청 · 추이 관찰)는 호버 · 초점 · 고를 때 앞에 붙는다(v6.css .done-act).
      //   지점 번호(WP-03)는 줄에서 뺐다(11/06 디자이너) — 줄을 누르면 지도가 그 지점으로 간다(d.wp 는 그대로 쓴다).
      var parts = String(d.how || "").split(/\s*·\s*/);
      var txt = el("span", "done-res");
      if (parts.length > 1) { txt.appendChild(el("span", "done-act", parts[0])); }
      txt.appendChild(document.createTextNode(parts[parts.length - 1]));
      how.appendChild(txt);
    } else {
      how.appendChild(el("span", null, d.how));
    }
    how.appendChild(el("span", null, d.who));

    node.appendChild(head);
    node.appendChild(how);
    return node;
  }

  var TONE = { normal: 0, warning: 1, critical: 2 };

  /*
   * 관제사 교대 — 사람이 바뀌어도 로봇은 돈다(UI_99 1319:89664).
   * 교대 직후 Delta 는 종합 판단 대신 새 관제사에게 인계 상황부터 말한다.
   * 새 관제사가 목록을 한 번이라도 건드리면 평소 문구로 돌아간다 — 인사는 한 번이면 된다.
   */
  var handover = null;

  // [11/05 논의] 거르기 줄 오른쪽 정렬 글을 [오래된 순 | 최신 순] 고르기로(ah-sort.js). 바꾸면 목록을 다시 그린다.
  if (window.APRISM_AH_SORT) { window.APRISM_AH_SORT.mount(function () { render(); }); }

  document.addEventListener("aprism:shift", function (event) {
    handover = (event.detail && event.detail.name) || "";
    render();
  });

  function tellAi(j, top) {
    // Delta 대화(delta-chat.js)가 답에 쓰는 건수 — 조치 버튼과 같은 판단(전체 미션)이다.
    window.APRISM_DELTA_COUNT = { crit: j.crit, warn: j.warn, total: j.total };
    var brief = body.getAttribute("data-delta-copy") === "brief";
    if (brief) { j.handover = handover; }
    var copy = brief ? COPY.brief(j) : handover === null ? deltaCopy(j) : {
      tag: "관제사 교대 · 인계",
      line1: "안녕하세요. " + handover + " 님",
      line2: body.getAttribute("data-delta-copy") === "brief"
        ? "인계 알림이 " + j.total + "건이에요.\n" + (j.crit ? "위험 " + j.crit + "건부터 보세요." : "목록에서 하나씩 보세요.")
        : "인계된 알림 " + j.total + "건과 진행 예정인 미션 1건이 있어요. 먼저 살펴볼까요?"
    };
    // 근거 줄 · 답 단추(v3-panel.js)가 읽는다 — 라이팅 시스템 문형(brief)일 때만 있다.
    window.APRISM_DELTA_SAY = copy.say || null;
    // 테두리와 Delta 가 같은 색을 입는다 — 목록 최고 단계와 종합 판단 중 높은 쪽.
    var tone = TONE[j.level] > TONE[top] ? j.level : top;
    var calm = !!(copy.say && copy.say.calm);   // [11/05 v6] 미션 완료 인사 — Delta 만 파랑, 테두리는 알림 단계
    document.dispatchEvent(new CustomEvent("aprism:severity", {
      detail: {
        level: tone === "normal" || calm ? null : tone,
        glow: tone === "normal" ? null : tone,
        line1: copy.line1,
        line2: copy.line2,
        tag: copy.tag
      }
    }));

    if (!aiActions) { return; }
    var labels = deltaActions(j);
    aiActions.textContent = "";
    aiActions.hidden = !labels.length;
    labels.forEach(function (label, i) {
      var b = el("button", "btn is-md " + (i === 0 ? "btn-primary" : "btn-secondary"), label);
      b.type = "button";
      aiActions.appendChild(b);
    });
  }

  function render() {
    var all = items();
    if (picked && all.indexOf(picked) < 0) { picked = null; }

    // 목록 · 건수는 고른 미션만 센다. Delta · 테두리 색은 아래에서 여전히 전체(all)를 본다 —
    // 다른 미션에서 난 위험을 미션을 바꿔야만 알게 되면 안 된다.
    var mine = all;
    if (scoped) {
      mine = all.filter(function (a) { return missionOf(a) === mission; });
      tellLevels(all);
    }

    var crit = mine.filter(function (a) { return a.sev === "critical"; }).length;
    var warn = mine.length - crit;
    var shown = mine.filter(function (a) { return filter === "all" || a.sev === filter; });

    list.textContent = "";
    shown.forEach(function (a) { list.appendChild(item(a)); });
    $("[data-ah-count='all']").textContent = mine.length;
    $("[data-ah-count='critical']").textContent = crit;
    $("[data-ah-count='warning']").textContent = warn;

    // 층별 알림 건수 — v3 지도 층 판이 버튼마다 단다(v3-panel.js, 10/21). 다른 화면은 듣지 않는다.
    window.APRISM_FLOOR_COUNTS = (function (list) {
      var c = { all: list.length };
      list.forEach(function (a) { if (a.floor) { c[a.floor] = (c[a.floor] || 0) + 1; } });
      return c;
    })(mine);
    document.dispatchEvent(new CustomEvent("aprism:floor-counts", { detail: window.APRISM_FLOOR_COUNTS }));

    doneList.textContent = "";
    DONE.forEach(function (d) {
      doneList.appendChild(doneItem(d));
      /*
       * 한 번 빛나면 끝이다. fresh 를 켜 둔 채로 두었더니, 이 목록은 알림을 고를 때마다
       * 통째로 다시 그려지는 탓에 그때마다 줄이 처음 들어온 것처럼 또 초록으로 빛났다.
       * 지우는 자리는 여기여야 한다 — doneItem() 은 빈 칸 높이를 재는 분신(measureDone)도
       * 만들기 때문에, 거기서 지우면 분신이 표시를 먹고 진짜 줄이 못 빛난다.
       */
      d.fresh = false;
    });
    doneCount.textContent = DONE.length + "건";
    // 다시 그리면 내용 길이가 바뀌어 스크롤 자리도 바뀔 수 있다 — 그림자를 다시 맞춘다.
    $$(".ah-box").forEach(shade);

    // Delta 는 목록 전체를 종합한다 — 목록에서 무엇을 골랐는지와는 상관없다.
    // 화면 테두리(엣지 글로우)는 목록에서 가장 높은 단계를 따른다.
    var top = highest(all);
    body.setAttribute("data-level", top);
    // v3 Delta 근거 줄 — 판단에 들어간 알림의 감지 종류(위험 먼저). v3-panel.js 가 아이콘으로 단다(10/21).
    window.APRISM_DELTA_DETECTS = all.slice().sort(function (a, b) { return (a.sev === "critical" ? 0 : 1) - (b.sev === "critical" ? 0 : 1); })
      .map(function (a) { return a.detect || a.title || ""; });
    var jd = judge(all);
    jd.mine = mine;
    // 펼침 대화가 답에 쓰는 알림(라이팅 시스템 8 — 이 미션 먼저, 다른 미션은 미션 이름을 붙여)
    window.APRISM_DELTA_ALERTS = { all: all, mine: mine, mission: mission, missionOf: missionOf, order: handleOrder(all, mine) };   // Delta 두 줄(brief)과 대화의 처리 순서
    tellAi(jd, top);
    markWaypoints();
  }

  /*
   * 알림이 걸린 웨이포인트에 그 단계를 적는다 — 우측 타임라인 표식과 지도의 점이 이 값을 읽는다.
   * 알림 목록이 원본이다. 미션 더미(screen.js)의 검사 결과는 여기서 덮는다 — 알림이 없는 칸은 정상이다.
   * 확인 처리해서 목록에서 빠지면 표식도 정상으로 돌아간다.
   */
  var WP_ALERT = { warning: "caution", critical: "danger" };

  function markWaypoints() {
    var rail = $("[data-timeline]");
    if (!rail) { return; }
    var robot = activeRobot();
    var hits = {};
    items().forEach(function (a) {
      if (a.robot !== robot || !a.wp) { return; }
      if (!hits[a.wp] || TONE[a.sev] > TONE[hits[a.wp]]) { hits[a.wp] = a.sev; }
    });
    var was = {};   // [11/05] 해결한 알림이 있던 지점 — 지도 번호가 회색으로 남는다(map-v6.js)
    cleared.forEach(function (a) { if (a.robot === robot && a.wp) { was[a.wp] = true; } });
    $$("[data-waypoint]", rail).forEach(function (node) {
      var sev = hits[node.getAttribute("data-waypoint")];
      if (!sev && was[node.getAttribute("data-waypoint")]) { node.setAttribute("data-wp-cleared", ""); } else { node.removeAttribute("data-wp-cleared"); }
      if (sev) { node.setAttribute("data-wp-alert", WP_ALERT[sev]); } else { node.removeAttribute("data-wp-alert"); }
      var done = node.getAttribute("data-wp-state") === "completed";
      if (done) { node.setAttribute("data-wp-result", sev ? WP_ALERT[sev] : "safe"); }
    });
    document.dispatchEvent(new CustomEvent("aprism:wp-marks"));
  }

  // 로봇을 바꾸면 타임라인이 새로 그려진다 — 그 로봇의 알림을 다시 적는다.
  document.addEventListener("aprism:mission", markWaypoints);

  // 목록을 내렸을 때만 상자 위쪽 안쪽 그림자를 켠다 — 맨 위에서는 가려진 것이 없다.
  function shade(box) {
    var inner = box && box.querySelector(".ah-list");
    if (!inner) { return; }
    box.classList.toggle("is-scrolled", inner.scrollTop > 0);
    // 아래로 더 남았을 때만 바닥에 페이드를 깐다 — 없으면 목록이 그냥 잘린 것처럼 보인다.
    // 규칙은 monitor.css 에 있었는데 켜 주는 곳이 없었다.
    box.classList.toggle("has-fade", inner.scrollHeight - inner.scrollTop - inner.clientHeight > 1);
  }

  $$(".ah-box").forEach(function (box) {
    var inner = box.querySelector(".ah-list");
    if (inner) { inner.addEventListener("scroll", function () { shade(box); }, { passive: true }); }
  });

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      handover = null;
      filter = btn.getAttribute("data-ah-filter");
      filters.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      render();
    });
  });

  /*
   * [11/05 v6] 전체 미션 최신 알림을 누르고 들어오면 그 알림의 팝오버까지 연다(디자이너).
   * 주소 ?alert=시각&wp=WP-nn, 관제 껍데기는 APRISM_OPEN_ALERT 를 부른다. 두 화면의 알림 데이터가 따로라 시각으로 찾고, 없으면 지점으로 찾는다.
   * 미션이 바뀌고 지도 번호가 깔린 뒤라야 쪽지가 제자리를 찾으므로 그때까지 기다린다.
   */
  var openAlert = window.APRISM_OPEN_ALERT;
  window.APRISM_OPEN_ALERT = function (mission, time, wp) {
    // [11/06] 알림 자체를 넘기는 쪽(펼친 Delta 의 [위치 보기] · [위험 상세 확인], 접힘 답 단추)은 위 정의 그대로 — 이 정의가 덮어써 눌러도 열리지 않았다
    if (mission && typeof mission === "object") { openAlert(mission); return; }
    var tries = 0;
    (function go() {
      var d = window.APRISM_DELTA_ALERTS;
      if ((!d || d.mission !== mission || !document.querySelector(".rr-pin")) && tries++ < 50) { setTimeout(go, 200); return; }
      var list = (d && d.mine) || [];
      var a = list.filter(function (x) { return x.time === time; })[0] || list.filter(function (x) { return x.wp === wp; })[0];
      if (!a) { return; }
      if (filter !== "all") { var f = filters.filter(function (b) { return b.getAttribute("data-ah-filter") === "all"; })[0]; if (f) { f.click(); } }
      if (picked !== a) { note.open(a); }
    })();
  };
  var askedAlert = /[?&]alert=([^&#]+)/.exec(location.search), askedMission = /[?&]mission=([^&#]+)/.exec(location.search);
  if (askedAlert && askedMission) {
    window.APRISM_OPEN_ALERT(decodeURIComponent(askedMission[1].replace(/\+/g, " ")), decodeURIComponent(askedAlert[1]), (/[?&]wp=(WP-\d+)/.exec(location.search) || [])[1]);
  }

  // 미션 고르기에 미션마다 가장 높은 알림 단계를 알린다 — 다른 미션의 위험이 메뉴에 점으로 찍힌다.
  function tellLevels(all) {
    var lv = {};
    all.forEach(function (a) {
      var m = missionOf(a);
      if (m && (!lv[m] || TONE[a.sev] > TONE[lv[m]])) { lv[m] = a.sev; }
    });
    window.APRISM_ALERT_LEVELS = lv;
    document.dispatchEvent(new CustomEvent("aprism:alert-levels", { detail: lv }));
  }

  document.addEventListener("aprism:scope", function (event) {
    mission = event.detail.mission;
    if (picked && missionOf(picked) !== mission) { note.close(); }
    render();
  });

  /*
   * [전체보기] — 알림 전체보기(알림 센터) 화면을 연다(v2.2).
   * 듀얼 모니터면 지금 모니터가 아닌 쪽에 꽉 차게 띄운다(2026-10-06 회의 — 한 화면은 늘 알림 센터).
   * 다른 모니터 자리를 알려면 브라우저의 창 관리(Window Management) 권한이 필요하다 — 처음 한 번 묻는다.
   * 권한이 없거나 모니터가 하나면 새 탭으로 연다. 같은 이름의 창이 있으면 그 창을 다시 쓴다.
   */
  // [11/06 v6] 오늘 확인된 알림 머리에도 [전체보기](data-ah-all="done") — 알림 센터를 조치 요청됨 탭으로 연다(?tab=done).
  $$("[data-ah-all]").forEach(function (allBtn) {
    allBtn.addEventListener("click", function (event) {
      event.stopPropagation();   // 확인된 알림 머리 줄은 누르면 접힌다(v3-panel.js) — 이 버튼만 예외
      var tab = allBtn.getAttribute("data-ah-all") === "done" ? "?tab=done" : "";
      var url = (window.aprismHref || String)((document.body.classList.contains("ver-6") ? "./alert-center-v6.html" : document.body.classList.contains("ver-5") ? "./alert-center-v5.html" : document.body.classList.contains("ver-3") ? "./alert-center-v3.html" : "./alert-center.html") + tab);
      var name = "aprism-alert-center";
      if (!window.screen.isExtended || !window.getScreenDetails) {
        window.open(url, name);
        return;
      }
      window.getScreenDetails().then(function (details) {
        var other = details.screens.filter(function (s) { return s !== details.currentScreen; })[0];
        if (!other) { window.open(url, name); return; }
        window.open(url, name, "popup,left=" + other.availLeft + ",top=" + other.availTop +
          ",width=" + other.availWidth + ",height=" + other.availHeight);
      }).catch(function () { window.open(url, name); });
    });
  });

  // 비상정지는 위험 알림이다(알림 정책) — 목록에 쌓고 그것을 고른다.
  document.addEventListener("aprism:estop", function () {
    var chosen = $(".robot-strip .robot-card[aria-pressed='true'] .robot-id");
    var name = chosen ? chosen.textContent : "로봇";
    var a = { sev: "critical", where: name + " · 현재 위치", time: clock(),
      title: "비상정지 발동 · 로봇 구동 차단",
      robot: activeRobot(), wp: currentWp(),
      sum: "모터 전원이 차단되었습니다. 현장 안전을 확인한 뒤 해제 절차를 진행하세요.",
      acts: ["현장 무전 연락 · 안전 확인", "해제 절차 진행", "로봇 회수 요청"],
      brief: [name + josa(name) + " 멈췄어요.", "현장 안전부터 확인하세요."], estop: true };
    extra.unshift(a);
    render();
  });

  /*
   * [11/05] 델타 시뮬레이션(route-sim.js 접기 화살표 옆) — 주의 판(#warning) 또는 기본 판(#normal)으로 되돌린 뒤
   * detail.after 밀리초 뒤 위험 알림 1건(N₂ 압력계 기준 초과)이 지금 시각으로 새로 들어온다. 주소의 #… 는 건드리지 않는다.
   */
  var simTimer = null;
  document.addEventListener("aprism:delta-sim", function (event) {
    var d = event.detail || {};
    clearTimeout(simTimer);
    level = SETS[d.from] ? d.from : "warning";
    extra = [];
    resolved = []; cleared = [];
    DONE = DONE_BASE.slice();
    note.close();
    document.dispatchEvent(new CustomEvent("aprism:monitor-reset"));
    render();
    simTimer = setTimeout(function () {
      var a = {};
      Object.keys(CRITICAL).forEach(function (k) { a[k] = CRITICAL[k]; });
      a.time = clock();
      // [11/05] 듣는 화면(map-v6.js)이 알림을 지도에 맞춘다 — 지금 보는 로봇 · 막 지나온 지점으로 고쳐 쓰고 지도를 위험 감지로 돌린다
      document.dispatchEvent(new CustomEvent("aprism:delta-sim-alert", { detail: { alert: a } }));
      extra.unshift(a);
      render();
    }, d.after || 2000);
  });

  // ==================================================================
  // 알림 쪽지 — Figma Messages(948:31737)
  //
  // 고르면: 그 알림의 로봇으로 카드를 넘기고(지도 · 타임라인이 그 로봇 미션으로 바뀐다),
  //        타임라인에서 그 웨이포인트를 골라 지도가 그리로 가게 한 뒤 쪽지를 세운다.
  // 닫기:  같은 알림을 다시 누르거나 Esc. 지도나 타임라인에서 다른 곳을 골라도 닫힌다(map.js).
  // 확인 처리: 상황 조치를 골라야 켜진다. 고른 조치와 함께 오늘 확인 완료로 옮긴다
  //           — 위험은 조치를 적어야 풀린다(알림 정책). 고르기와 확정이 두 번에 나뉜다.
  // ==================================================================
  function activeRobot() {
    var on = $(".robot-strip .robot-card[aria-pressed='true'][data-robot]");
    return on ? Number(on.getAttribute("data-robot")) : 0;
  }

  function currentWp() {
    var t = $("[data-timeline]");
    return (t && t.getAttribute("data-current-waypoint")) || "WP-01";
  }

  var note = (function () {
    var box = $("[data-map-alert]");
    var timeline = $("[data-timeline]");
    if (!box) { return { open: function () {}, close: function () {} }; }

    var sev = $("[data-ma-sev]", box);
    var title = $("[data-ma-title]", box);
    var stamp = $("[data-ma-stamp]", box);
    var snap = $(".ma-snap", box);
    var img = $("[data-ma-img]", box);
    var options = $("[data-ma-options]", box);
    // [11/10 v7 디자이너] 가로 팝오버(Figma UI_00 1233:16459) — 위치 · 시각은 사진 아래 띠로 내린다(머리는 배지 · 제목 한 줄)
    var V7 = body.classList.contains("ver-7");
    if (V7 && stamp && snap) { snap.appendChild(stamp); }
    var confirm = $("[data-ma-confirm]", box);
    var opening = false;
    // v2.2 팝오버 v3(Figma 1233:16460) — 조치는 체크리스트, [더보기] 메뉴 · 도킹 · 정보 hover · 접힌 메모.
    var V3 = box.classList.contains("ma-v3");
    var docked = false;   // 패널에 고정 — 알림을 바꿔 열어도 유지한다

    /*
     * 위치 이름 — where 는 "터빈 2 / Unit 03 · WP-04 N₂ 배관 압력계" 꼴이다.
     * 웨이포인트 번호는 따로 칸이 있으니, 그 뒤만 떼어 이름으로 쓴다.
     */
    function placeOf(a) {
      var i = a.where.indexOf(a.wp);
      return i < 0 ? a.where : a.where.slice(i + a.wp.length).trim();
    }

    // 발생 일시 — 날짜는 상태 바 시계에서 읽는다. 이 화면은 하루를 통째로 흉내 내므로 둘이 같은 날이어야 한다.
    function stampOf(a) {
      // [11/02 v6] 제목 아래 = 어디서 · 언제(목록 둘째 줄과 같은 차례) — "WP-07 고소 작업 발판 · 10:16:48". 날짜 · "발생"은 뺀다
      if (body.classList.contains("ver-6")) { var wpm = /WP-\d+.*$/.exec(a.where || ""); return (wpm ? wpm[0] : (a.where || "")) + " · " + a.time; }
      var utc = $(".utc-clock .num");
      var day = (utc && (utc.textContent.match(/^\d{4}-\d{2}-\d{2}/) || [])[0]) || "";
      return (day ? day + " " : "") + a.time + " 발생";
    }

    // 고른 조치. 알림을 새로 열 때마다 비운다 — 하나 이상 골라야 [조치 완료] 가 켜진다.
    function chosen() {
      return $$("[aria-pressed='true'], [aria-checked='true']", options).map(function (chip) {
        return chip.getAttribute("data-act");
      });
    }

    function syncConfirm() { confirm.disabled = !chosen().length; }

    /*
     * [11/02 v6] 알림 결과 → [측정 항목, 값] — 안전진단 상세(safety.js 판정 카드)와 같은 규칙.
     *   항목: 누출 의심도 · 최고 온도 · 이상 점수(음향 · 부분방전)는 고정, 계기는 숫자 앞 말(압력 · 차압), 안전은 위반 항목. 위치 · 채널(CH1)은 뺀다.
     *   알림 문구에 값이 없는 것은 안전진단과 같은 값을 쓴다(RES6).
     */
    var RES6 = {
      "누출감지 · 냉각수 배관 밸브": ["누출 의심도", "62%"],
      "이상음향 · 냉각 펌프 P-2": ["이상 점수", "20.4"],
      "지하발전소 B3 터빈 2 NG 1건 발견": ["압력", "0.86 MPa"],
      "지하발전소 터빈 2 NG 1건 발견": ["압력", "0.86 MPa"],
      "차압 NG · HEPA Filter 차압계": ["차압", "312 Pa"],
      "압력 편차 · N₂ 배관 압력계": ["압력", "0.62 MPa"],
      "압력 편차 · 공기 압축기 C-1": ["압력", "7.9 bar"]
    };
    var LAB6 = { "누출감지": "누출 의심도", "온도감지": "최고 온도", "이상음향": "이상 점수", "부분방전": "이상 점수" };
    function maResult(a) {
      var r6 = window.APRISM_ALERT6 && window.APRISM_ALERT6.of(a.title); if (r6) { return [r6.label, r6.value]; }   // [11/02] 목록과 같은 표(alert-text-v6.js)
      if (RES6[a.title]) { return RES6[a.title]; }
      var tail = String(a.title || "").split(" · ").slice(1).join(" · ");
      // 값은 마지막 숫자(+단위) — "CH1 이상 점수 9.05" · "냉각 펌프 P-2 48.6℃" 처럼 앞에 이름 속 숫자가 있다
      var all = tail.match(/(\d+(?:\.\d+)?)\s*(℃|%|MPa|kPa|Pa|bar|명|곳|건)?/g);
      if (!all) { return null; }
      var m = all[all.length - 1].match(/(\d+(?:\.\d+)?)\s*(℃|%|MPa|kPa|Pa|bar|명|곳|건)?/);
      var val = m[1] + (m[2] ? (/^(%|명|곳|건)$/.test(m[2]) ? m[2] : " " + m[2]) : "");   // %·명·곳·건은 붙이고 ℃·압력 단위는 띄운다(안전진단과 같다)
      var lab = LAB6[a.detect] || (a.detect === "계기인식" ? (tail.split(/\s*-?\d/)[0].trim() || "측정값") : tail.replace(m[0], "").trim());
      return [lab, val];
    }

    function fill(a) {
      box.classList.toggle("is-critical", a.sev === "critical");
      // [11/10] 판정 칩은 공통 .verdict-chip — 단계를 칩 자신이 갖는다(예전 .ma-badge 는 팝오버 .is-critical 을 보고 색을 바꿨다)
      var sevChip = $("[data-ma-badge]", box);
      if (sevChip) { sevChip.classList.toggle("is-crit", a.sev === "critical"); sevChip.classList.toggle("is-warn", a.sev !== "critical"); }
      sev.textContent = a.sev === "critical" ? "위험" : "주의";
      title.textContent = a.title;
      title.title = a.title;
      var kind = $("[data-ma-kind]", box);
      if (kind && body.classList.contains("ver-6")) {
        // [11/02 v6] 안전진단 상세와 같은 글 — 배지 옆 감지 이름, 제목은 "측정 항목 + 값(단계색)"
        var rs = maResult(a);
        var r6k = window.APRISM_ALERT6 && window.APRISM_ALERT6.of(a.title);
        kind.textContent = (r6k && r6k.detect) || a.detect || "";
        if (rs) {
          title.textContent = "";
          title.appendChild(document.createTextNode(rs[0] + " "));
          var vb = document.createElement("b"); vb.className = "ma-val"; vb.textContent = rs[1];
          title.appendChild(vb);
          // [11/06 디자이너] 값 뒤 판정 — 안전진단 상세와 같은 글(verdict-v6.js)
          var vd = window.APRISM_VERDICT && window.APRISM_VERDICT(kind.textContent, rs[1]);
          if (vd) { var vs = document.createElement("span"); vs.className = "ma-vd"; vs.textContent = vd; title.appendChild(document.createTextNode(" ")); title.appendChild(vs); }
          title.title = a.title;
        }
      }
      stamp.textContent = stampOf(a);
      // [11/06 디자이너] v6 — 지점은 글(WP-05) 대신 지도 핀 머리와 같은 번호 원, 시각은 오른쪽 끝. 설비 이름이 길면 이름만 줄인다
      if (body.classList.contains("ver-6") && a.wp) {
        var wn = parseInt(String(a.wp).replace(/\D+/g, ""), 10), ph = !isNaN(wn) && document.querySelector('.rr-pin-head[data-n="' + wn + '"]');
        var st6 = stampOf(a), cut = st6.lastIndexOf(" · "), where6 = cut < 0 ? st6 : st6.slice(0, cut), when6 = cut < 0 ? "" : st6.slice(cut + 3);
        if (where6.indexOf(a.wp) === 0) { where6 = where6.slice(a.wp.length).trim(); }
        stamp.textContent = "";
        stamp.classList.add("ma-stamp6");
        var pin6 = document.createElement("span"); pin6.className = "mbt-pin"; pin6.setAttribute("data-n", isNaN(wn) ? "" : String(wn));
        pin6.setAttribute("role", "img"); pin6.setAttribute("aria-label", a.wp);
        // [11/06 디자이너] 번호 원은 세 팝오버 · Delta 와 같은 꼴(지도 핀 색, 16px · 1px 테 — v6.css .mbt-pin). 지도 핀이 없으면(다른 층) 회색 기본 꼴
        if (ph) { pin6.setAttribute("style", ph.getAttribute("style") || ""); } else { pin6.classList.add("is-plain"); }
        var pl6 = document.createElement("span"); pl6.className = "ma-st-place"; pl6.textContent = where6;
        var tm6 = document.createElement("span"); tm6.className = "ma-st-time num"; tm6.textContent = when6;
        stamp.appendChild(pin6); stamp.appendChild(pl6); stamp.appendChild(tm6);
      }

      $("[data-ma-wp]", box).textContent = a.wp || "";
      $("[data-ma-place]", box).textContent = placeOf(a);
      $("[data-ma-detect]", box).textContent = a.detect || "";
      // v6(10/30) — [안전진단에서 확인] 도 알림 목록의 [안전진단]처럼 이 알림의 미션 · 감지 종류를 실어 자세히 보기로 바로 간다(미션 카드 화면에서 멈추지 않게)
      var more = $("[data-ma-more]", box);
      if (more && body.classList.contains("ver-6")) {
        var mq = new URLSearchParams(), mm = missionOf(a);
        if (mm) { mq.set("mission", mm); }
        if (a.detect) { mq.set("detect", a.detect); }
        more.href = "./safety-v6.html" + (mq.toString() ? "?" + mq.toString() : "");
      }

      // 그림이 없는 알림(E-STOP 등)은 사진 칸과 [크게보기] 를 함께 접는다.
      if (V3) { box.classList.toggle("no-snap", !a.live); img.hidden = !a.live; } else { snap.hidden = !a.live; }
      $("[data-ma-zoom]", box).hidden = !a.live;
      var robotEl = $("[data-ma-robot]", box);
      if (robotEl) { robotEl.textContent = "R-" + ("0" + ((a.robot || 0) + 1)).slice(-2); }
      if (a.live) {
        img.src = liveSrc(a);
        img.alt = a.title + " — 검출 장면";
      }

      $("[data-ma-lead]", box).textContent = a.lead || a.sum;
      var fp = $("[data-ma-fp]", box);
      fp.style.setProperty("--ma-fp", (a.fp || 0) + "%");
      var meter = $("[data-ma-fp-meter]", box);
      if (meter) { meter.setAttribute("aria-label", "오탐 가능성 " + (a.fp || 0) + "퍼센트"); }
      var fpVal = $(".ma-fp-value", box);
      if (fpVal) {
        fpVal.classList.toggle("is-mid", (a.fp || 0) >= 20 && (a.fp || 0) < 40);
        fpVal.classList.toggle("is-high", (a.fp || 0) >= 40);
      }
      $("[data-ma-fp-label]", box).textContent = a.fpLabel || "";
      $("[data-ma-fp-pct]", box).textContent = (a.fp || 0) + "%";

      options.textContent = "";
      if (V3) {
        // 체크리스트 — 조치를 모두 세우고, DELTA 가 미는 것은 [AI 추천] 을 달고 미리 체크해 둔다(Figma Default).
        // [11/10 v7] AI 추천은 1순위 하나만 — 추천이 둘이면 무엇이 먼저인지 흐려진다. 나머지는 대안(체크 안 함)
        var aiLeft = V7 ? 1 : Infinity;
        a.acts.slice().sort(function (x, y) { return (y.ai ? 1 : 0) - (x.ai ? 1 : 0); }).forEach(function (src) {
          var act = src;
          if (src.ai) { if (aiLeft > 0) { aiLeft--; } else { act = { t: src.t }; } }
          var row = el("button", "ma-check");
          row.type = "button";
          row.setAttribute("role", "checkbox");
          row.setAttribute("data-act", act.t);
          row.setAttribute("aria-checked", act.ai ? "true" : "false");
          var boxEl = el("span", "ma-check-box");
          var mark = el("span", "i");
          mark.style.setProperty("--i", "var(--ic-check)");
          mark.setAttribute("aria-hidden", "true");
          boxEl.appendChild(mark);
          row.appendChild(boxEl);
          row.appendChild(el("span", "ma-check-label", act.t));
          if (act.ai) { row.appendChild(el("span", "ma-check-tag", "AI 추천")); }
          options.appendChild(row);
        });
        memoReset();
        menuClose();
        syncConfirm();
        return;
      }
      // 쪽지에는 DELTA 가 미는 칩만 세운다 — 나머지는 "다른 조치는 크게보기에서" 가 안내한다.
      a.acts.filter(function (act) { return act.ai; }).forEach(function (act) {
        var chip = el("button", "preset-chip");
        chip.type = "button";
        chip.setAttribute("data-act", act.t);
        chip.setAttribute("aria-pressed", "false");
        chip.appendChild(el("span", null, act.t));
        // 추천은 테두리가 맡는다(app-shell .preset-chip[data-delta]) — 칸 이름이 "AI 추천 조치" 라
        // 꼬리표를 따로 달 까닭이 없다. 알림 센터와 같은 표시다.
        if (act.ai) { chip.setAttribute("data-delta", ""); }
        options.appendChild(chip);
      });
      confirm.disabled = true;
    }

    options.addEventListener("click", function (event) {
      var row = event.target.closest(".ma-check");
      if (row) {
        row.setAttribute("aria-checked", row.getAttribute("aria-checked") === "true" ? "false" : "true");
        syncConfirm();
        return;
      }
      var chip = event.target.closest(".preset-chip");
      if (!chip) { return; }
      chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
      syncConfirm();
    });

    /*
     * v2.2 — 사람이 찍힌 검출 캡처(ppe) 자리에 비식별화가 적용된 현장 그림을 쓴다. 실제로는 서버가 이미 가린 영상을 보낸다는 뜻이다.
     * 10/19 디자이너 — 줄무늬(alert-live-deid.webp)에서 격자 모자이크로 바꿨다. 비교판 screens/deid-lab.html 의
     * "격자 모자이크 · 감지 라벨" 을 팝오버 폭(370)에서 칸 12(10/19 디자이너 — 팝오버에선 18 보다 잘게) · 틈 2 · 모서리 16% 로 뽑은 그림이다.
     */
    var useDeid = body.classList.contains("v2-2");
    /*
     * [10/30] 알림마다 제 검출 장면 — 감지 · 설비 · 값에 맞춘 프로토타입 그림(assets/img/alert/, 960x672).
     * 상자 · 라벨 · 열화상 최고점 · 음향 얼룩 · PRPD 표가 그림에 들어 있다. 주의는 노랑, 위험은 빨강.
     * 안전감지는 안전진단 사진(사람 격자 모자이크)을 그대로 쓴다. 표에 없는 알림은 예전 그림(alert-live-*).
     */
    var SHOT = {
      "누출감지 · 냉각수 배관 밸브": "alert/wp03-leak.webp",
      "부분방전 · 이상 점수 9.41": "alert/wp06-pd-941.webp",
      "진동 상승 · 냉각 펌프 P-2": "alert/wp12-vib.webp",
      "이상음향 · 이상 점수 21.6": "alert/wp12-sound-216.webp",   // v6 — WP-12 진동 상승을 이상음향으로(10/30)
      "과열 · 발전기 베어링 68.4℃": "alert/wp02-temp-684.webp",
      "압력 편차 · 공기 압축기 C-1": "alert/wp13-gauge-comp.webp",
      "지하발전소 B3 터빈 2 NG 1건 발견": "alert/wp04-gauge-spiral.webp",
      "지하발전소 터빈 2 NG 1건 발견": "alert/wp04-gauge-spiral.webp",   // v2.2 부터 쓰는 제목(CRITICAL.title)
      "이상음향 · 냉각 펌프 P-2": "alert/wp05-sound.webp",
      "온도감지 · 냉각 펌프 P-2 48.6℃": "alert/wp05-temp-486.webp",
      "부분방전 · CH1 이상 점수 9.05": "alert/wp06-pd-905.webp",
      "안전감지 · 안전벨트 미착용 1명": "safety/safety_crit.jpg",
      "차압 NG · HEPA Filter 차압계": "alert/wp02-gauge-hepa.webp",
      "압력 편차 · N₂ 배관 압력계": "alert/wp04-gauge-n2.webp"
    };
    // [11/06 v6] WP-04 N₂ 압력계 위험은 안전진단 상세와 같은 사진(N₂ 배관 · MPa 계기 · "gauge 0.86 MPa") — 예전 그림은 Spiral Casing psi 계기에 "NG 90, 기준 87" 라벨이라 제목(0.86 MPa)과 어긋났다
    if (body.classList.contains("ver-6")) { SHOT["지하발전소 B3 터빈 2 NG 1건 발견"] = SHOT["지하발전소 터빈 2 NG 1건 발견"] = "safety/gauge_crit.jpg"; }
    function liveSrc(a) {
      if (SHOT[a.title]) { return "../assets/img/" + SHOT[a.title]; }
      if (useDeid && a.live === "ppe") { return "../assets/img/alert-live-deid-grid.webp?v=12"; }   // 그림을 바꾸면 v 를 올린다(캐시)
      return "../assets/img/alert-live-" + a.live + ".webp";
    }

    // ---------- v3: [더보기] 메뉴 · 도킹 · 정보 hover · 메모 ----------
    var menuBtn = $("[data-ma-menu-btn]", box);
    var menu = $("[data-ma-menu]", box);
    var dockBtn = $("[data-ma-dock]", box);
    var infoBtn = $("[data-ma-info]", box);
    var memoBox = $("[data-ma-memo]", box);
    var memoBtn = $("[data-ma-memo-btn]", box);
    var memoField = $("[data-ma-memo-field]", box);

    function menuClose() {
      if (!menu || menu.hidden) { return; }
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
    }
    function setDock(on) {
      docked = on;
      box.classList.toggle("is-docked", on);
      if (dockBtn) { dockBtn.textContent = on ? "고정 풀기" : "패널에 고정"; }
    }
    if (menuBtn && menu) {
      menuBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = menu.hidden;
        menu.hidden = !open;
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) { var first = $("button:not([hidden])", menu); if (first) { first.focus(); } }
      });
      menu.addEventListener("click", function () { menuClose(); });
      document.addEventListener("click", function (event) { if (!event.target.closest || !event.target.closest(".ma-more-box")) { menuClose(); } });
      menu.addEventListener("keydown", function (event) {
        if (event.key === "Escape") { event.stopPropagation(); menuClose(); menuBtn.focus(); }
      });
    }
    if (dockBtn) { dockBtn.addEventListener("click", function () { setDock(!docked); }); }
    if (infoBtn) {
      var infoOn = function () { box.classList.add("is-info"); };
      var infoOff = function () { box.classList.remove("is-info"); };
      infoBtn.addEventListener("mouseenter", infoOn);
      infoBtn.addEventListener("mouseleave", infoOff);
      infoBtn.addEventListener("focus", infoOn);
      infoBtn.addEventListener("blur", infoOff);
    }
    function memoSet(open) {
      if (!memoBox) { return; }
      memoBox.classList.toggle("is-open", open);
      memoField.hidden = !open;
      memoBtn.setAttribute("aria-expanded", open ? "true" : "false");
      memoBtn.setAttribute("aria-label", open ? "메모 접기" : "메모 펼치기");
    }
    function memoReset() { if (memoField) { memoField.value = ""; } memoSet(false); }
    if (memoBtn) {
      memoBtn.addEventListener("click", function () {
        var open = memoField.hidden;
        memoSet(open);
        if (open) { memoField.focus(); }
      });
    }

    // ---------- 크게보기 ----------
    var zoomBox = $("[data-ma-zoom-box]");
    var zoomBtn = $("[data-ma-zoom]", box);
    var zoomImg = zoomBox && $("[data-ma-zoom-img]", zoomBox);
    var zoomClose = zoomBox && $("[data-ma-zoom-close]", zoomBox);

    function openZoom() {
      var a = picked;
      if (!zoomBox || !a || !a.live) { return; }
      zoomBox.classList.toggle("is-critical", a.sev === "critical");
      var zoomChip = $("[data-ma-zoom-badge]", zoomBox);
      if (zoomChip) { zoomChip.classList.toggle("is-crit", a.sev === "critical"); zoomChip.classList.toggle("is-warn", a.sev !== "critical"); }
      $("[data-ma-zoom-sev]", zoomBox).textContent = a.sev === "critical" ? "위험" : "주의";
      $("[data-ma-zoom-title]", zoomBox).textContent = a.title;
      $("[data-ma-zoom-time]", zoomBox).textContent = a.time;
      zoomImg.src = liveSrc(a);
      zoomImg.alt = a.title + " — 라이브 뷰";
      zoomBox.hidden = false;
      zoomClose.focus();
    }

    function closeZoom() {
      if (!zoomBox || zoomBox.hidden) { return false; }
      zoomBox.hidden = true;
      if (!box.hidden) { (V3 && menuBtn ? menuBtn : zoomBtn) && (V3 && menuBtn ? menuBtn : zoomBtn).focus(); }
      return true;
    }

    if (zoomBox) {
      zoomBtn.addEventListener("click", openZoom);
      zoomClose.addEventListener("click", closeZoom);
      // 카드 바깥(어두운 면)을 누르면 닫힌다.
      zoomBox.addEventListener("click", function (event) { if (event.target === zoomBox) { closeZoom(); } });
      // [11/10 v7] [더보기] 메뉴를 걷어서 크게 보기는 사진을 누르면 열린다
      if (V7 && img) { img.addEventListener("click", openZoom); img.title = "크게 보기"; }
    }

    // 타임라인에서 그 칸을 고른다 — 타임라인이 지도에 알리고, 지도가 카메라를 데려간다.
    // 이미 골라져 있으면 누르지 않는다(누르면 놓아 버린다). 그때는 지도에 직접 다시 알린다.
    function pointAt(wp) {
      var item = timeline && timeline.querySelector("[data-waypoint='" + wp + "']");
      if (item && timeline.getAttribute("data-selected-waypoint") !== wp) {
        item.click();
      } else {
        document.dispatchEvent(new CustomEvent("aprism:waypoint", { detail: { id: wp, from: "panel" } }));
      }
      if (item && item.scrollIntoView) { item.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    }

    function open(a) {
      opening = true;
      if (a.robot !== activeRobot()) {
        var card = $(".robot-strip .robot-card[data-robot='" + a.robot + "']");
        if (card) { card.click(); }
      }
      picked = a;
      pickedDone = null;   // [11/06 v6] 알림을 고르면 확인된 알림 고름은 놓는다
      fill(a);
      box.setAttribute("data-wp", a.wp);
      box.hidden = false;
      pointAt(a.wp);
      opening = false;
      render();
    }

    function close() {
      closeZoom();
      if (box.hidden) { picked = null; return; }
      var wp = box.getAttribute("data-wp");
      box.hidden = true;
      picked = null;
      // 타임라인 · 지도의 고른 칸도 놓는다.
      if (timeline && timeline.getAttribute("data-selected-waypoint") === wp) {
        var item = timeline.querySelector("[data-waypoint='" + wp + "']");
        if (item) { item.click(); }
      }
      render();
    }

    /* ================================================================
     * 조치 완료 — 쪽지가 "오늘 확인 완료" 로 빨려 들어간다 (UI_99 1610:54101)
     *
     * 처리한 알림이 어디로 갔는지 눈으로 따라갈 수 있게 한다. 전체 660ms.
     *   ① 완료 목록 맨 위에 빈 칸이 열린다            180ms
     *   ② 쪽지가 그 칸으로 접히며 날아간다            480ms · ease-in
     *   ③ 닿으면 목록에서 빠지고 새 항목이 초록으로 반짝인다 · 토스트 5초
     *
     * 날아가는 것은 분신이다 — 진짜 쪽지는 --x/--y 로 웨이포인트에 매달려 있어서
     * 거기에 이동 transform 을 겹치면 기준점이 꼬인다(monitor.css .ma-flyer).
     * 되돌리기를 5초간 주므로 확인 대화상자는 두지 않는다.
     * ================================================================ */
    var slow = window.matchMedia("(prefers-reduced-motion: reduce)");
    var toast = $("[data-ma-toast]");
    var toastMsg = $("[data-ma-toast-msg]");
    var undoBtn = $("[data-ma-undo]");
    var toastTimer = null;
    var lastDone = null;   // 되돌릴 거리 — 토스트가 떠 있는 동안만 들고 있다
    var busy = false;

    function showToast(a) {
      if (!toast) { return; }
      toastMsg.textContent = (window.APRISM_ALERT6 ? window.APRISM_ALERT6.title(a.title) : a.title) + " 조치를 요청했어요";   // [10/30] 버튼이 [조치 요청] 으로 바뀜   // 가운뎃점 구분 대신 문장으로(10/29 피드백)
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, 5000);
    }

    function hideToast() {
      clearTimeout(toastTimer);
      if (toast) { toast.hidden = true; }
      lastDone = null;
    }

    // 완료 목록 맨 위에 들어갈 칸의 높이를 미리 잰다 — 빈 칸을 그만큼 열어야 자리가 안 튄다.
    function measureDone(rec) {
      var ghost = doneItem(rec);
      ghost.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
      doneList.appendChild(ghost);
      var h = ghost.getBoundingClientRect().height;
      ghost.remove();
      return h;
    }

    function flyTo(from, to) {
      var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      var sx = to.width / from.width;
      var sy = to.height / from.height;
      // 가로로 더 많이 움직이면 세로로 접고, 세로로 더 움직이면 가로로 접는다.
      var horiz = Math.abs(dx) > Math.abs(dy);
      var mid = horiz ? "polygon(0% 34%,100% 0%,100% 100%,0% 66%)"
                      : "polygon(0% 0%,100% 0%,64% 100%,36% 100%)";
      var end = horiz ? "polygon(0% 44%,100% 20%,100% 80%,0% 56%)"
                      : "polygon(20% 0%,80% 0%,56% 100%,44% 100%)";
      return [
        { transform: "none", clipPath: "polygon(0% 0%,100% 0%,100% 100%,0% 100%)", opacity: 1, offset: 0 },
        { transform: "translate(" + dx * 0.25 + "px," + dy * 0.25 + "px) scale(.9,.9)", clipPath: mid, opacity: 1, offset: 0.45 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")", clipPath: end, opacity: 0.2, offset: 1 }
      ];
    }

    function commit(a, rec) {
      // fresh 를 내리는 일은 render() 한 곳이 맡는다 — 두 곳에서 손대면 어느 쪽이 늦는지에 따라 달라진다.
      DONE.unshift(rec);
      if (extra.indexOf(a) >= 0) { extra.splice(extra.indexOf(a), 1); } else { resolved.push(a); }
      cleared.push(a);
      lastDone = { a: a, rec: rec };
      render();
      showToast(a);
      busy = false;
    }

    confirm.addEventListener("click", function () {
      var a = picked;
      var picks = chosen();
      if (busy || !a || !picks.length) { return; }
      busy = true;
      hideToast();

      var rec = { wp: a.wp || "", time: clock(), title: window.APRISM_ALERT6 ? window.APRISM_ALERT6.title(a.title) : a.title, how: picks.join(" · "), who: "홍길동", fresh: true,
                  memo: memoField ? memoField.value.trim() : "" };
      var from = box.getBoundingClientRect();
      // 분신을 먼저 띄우고 진짜 쪽지를 닫는다 — 순서가 바뀌면 잴 자리가 사라진다.
      var flyer = box.cloneNode(true);
      flyer.removeAttribute("data-map-alert");
      flyer.removeAttribute("id");
      flyer.classList.add("ma-flyer");
      flyer.hidden = false;
      flyer.setAttribute("aria-hidden", "true");
      flyer.style.cssText = "left:" + from.left + "px;top:" + from.top + "px;" +
                            "width:" + from.width + "px;height:" + from.height + "px;transform:none";
      document.body.appendChild(flyer);
      close();

      // 동작 줄이기 — 날아가는 대신 150ms 페이드다(UI_99 STEP 4).
      if (slow.matches) {
        flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished
          .catch(function () {})
          .then(function () { flyer.remove(); commit(a, rec); });
        return;
      }

      // v3 — 오늘 확인 완료가 접혀 있으면(v3-panel.js) 펼치지 않는다. 쪽지는 머리 줄 건수로 빨려 들어가고,
      // 닿으면 건수가 튀고 머리 줄이 잠깐 밝아진다(10/21 디자이너). 사람이 접어 둔 것을 매번 뒤집지 않고,
      // 최신 알림 칸 높이도 출렁이지 않는다 — 알림을 연달아 처리할 때 다음 알림 자리가 움직이지 않는다.
      var doneSec = doneList.closest("[data-done-sec]");
      if (doneSec && doneSec.classList.contains("is-folded")) {
        var badge = doneSec.querySelector(".done-count") || doneSec.querySelector("[data-done-head]");
        flyer.animate(flyTo(from, badge.getBoundingClientRect()),
          { duration: 480, easing: "cubic-bezier(.55,0,.75,.2)", fill: "forwards" }).finished
          .catch(function () {})
          .then(function () {
            flyer.remove();
            commit(a, rec);
            doneSec.classList.remove("is-landed");
            void doneSec.offsetWidth;          // 연달아 처리해도 다시 돈다
            doneSec.classList.add("is-landed");
            setTimeout(function () { doneSec.classList.remove("is-landed"); }, 700);
          });
        return;
      }

      var slot = el("div", "done-slot");
      slot.setAttribute("aria-hidden", "true");
      doneList.insertBefore(slot, doneList.firstChild);
      var h = measureDone(rec);

      slot.animate([{ height: "0px" }, { height: h + "px" }], { duration: 180, easing: "ease-out", fill: "forwards" })
        .finished.catch(function () {}).then(function () {
          var to = slot.isConnected ? slot.getBoundingClientRect() : doneList.getBoundingClientRect();
          return flyer.animate(flyTo(from, to),
            { duration: 480, easing: "cubic-bezier(.55,0,.75,.2)", fill: "forwards" }).finished;
        })
        .catch(function () {})
        .then(function () {
          flyer.remove();
          slot.remove();
          commit(a, rec);
        });
    });

    if (undoBtn) {
      undoBtn.addEventListener("click", function () {
        if (!lastDone || busy) { return; }
        var a = lastDone.a, rec = lastDone.rec;
        var i = DONE.indexOf(rec);
        if (i >= 0) { DONE.splice(i, 1); }
        var r = resolved.indexOf(a);
        if (r >= 0) { resolved.splice(r, 1); } else { extra.unshift(a); }
        hideToast();
        render();
      });
    }

    // 단계를 바꾸면(주소 #…) 들고 있던 되돌리기도 버린다.
    document.addEventListener("aprism:monitor-reset", hideToast);

    var closeBtn = $("[data-ma-close]", box);
    if (closeBtn) { closeBtn.addEventListener("click", close); }

    // 지도가 다른 웨이포인트로 옮겨 가며 쪽지를 닫았다 — 목록의 고른 표시도 놓는다.
    document.addEventListener("aprism:map-alert", function (event) {
      if (opening || (event.detail && event.detail.open)) { return; }
      picked = null;
      render();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") { return; }
      // 크게보기가 떠 있으면 그것만 닫는다 — 쪽지는 남긴다.
      if (closeZoom()) { return; }
      if (box.hidden) { return; }
      close();
    });

    /*
     * 쪽지가 떠 있는 동안 Delta(AI 패널)는 잠시 비킨다 — 쪽지와 겹친다.
     * 쪽지는 목록 · Esc · 확인 처리 · 지도(다른 웨이포인트를 고름) 여러 곳에서 여닫히므로
     * 여닫는 자리마다 챙기지 않고 쪽지의 hidden 을 지켜본다.
     */
    function syncDelta() { body.classList.toggle("has-map-alert", !box.hidden); }
    new MutationObserver(syncDelta).observe(box, { attributes: true, attributeFilter: ["hidden"] });
    syncDelta();

    return { open: open, close: close };
  })();

  /*
   * 지도 · 우측 지점 목록에서 웨이포인트를 직접 눌렀다(11/06 목록도) — 그 자리에 남은 알림이 있으면 알림 목록에서 누른 것과 같은
   * 팝오버(조치 제안 · 조치 완료)를 연다. 알림이 없는 웨이포인트는 지금처럼 웨이포인트 쪽지(10/19 디자이너).
   * 한 자리에 여럿이면 위험 먼저, 같은 단계면 먼저 난 것.
   */
  document.addEventListener("aprism:waypoint", function (event) {
    var d = event.detail || {};
    if ((d.from !== "map" && d.from !== "panel") || !d.id) { return; }
    if (d.done) { return; }   // [11/06 v6] 확인된 알림을 고른 것 — 지도만 그 지점으로, 그 자리 남은 알림 쪽지는 열지 않는다
    if (d.from === "panel" && picked && picked.wp === d.id) { return; }   // 쪽지가 열리며 우측 줄을 누른 것이다 — 다시 열지 않는다
    var robot = activeRobot();
    var here = items().filter(function (a) { return a.wp === d.id && a.robot === robot; });
    if (!here.length) { return; }
    here.sort(function (x, y) {
      return (x.sev === "critical" ? 0 : 1) - (y.sev === "critical" ? 0 : 1) || (x.time < y.time ? -1 : x.time > y.time ? 1 : 0);
    });
    note.open(here[0]);
  });

  /*
   * 검토용 — 주소의 #normal · #few · #warning · #critical 로 단계를 고른다.
   * 주소에 아무것도 없으면 화면이 정한 기본값을 쓴다(body[data-monitor-default]).
   * ver.2 는 위험 판을 기본으로 보여 주고, 시안 3 은 Figma 기본 상태(알림 없음)로 연다.
   */
  function fromHash() {
    var h = (location.hash || "").replace("#", "");
    var base = body.getAttribute("data-monitor-default");
    level = SETS[h] ? h : (SETS[base] ? base : "critical");
    extra = [];
    resolved = []; cleared = [];
    DONE = DONE_BASE.slice();
    note.close();
    document.dispatchEvent(new CustomEvent("aprism:monitor-reset"));
    render();
  }

  window.addEventListener("hashchange", fromHash);

  // ==================================================================
  // 로봇 카드 넘겨 보기
  // 화살표는 옆 카드를 누른 것과 같다 — 선택 · 타임라인 · 지도는 screen.js / map.js 가 따라온다.
  // 연결이 끊긴 로봇은 건너뛴다.
  // ==================================================================
  (function () {
    var box = $("[data-robot-carousel]");
    if (!box) { return; }
    var cards = $$(".robot-card[data-robot]", box);

    $$("[data-rc-step]", box).forEach(function (arrow) {
      arrow.addEventListener("click", function () {
        var dir = Number(arrow.getAttribute("data-rc-step"));
        var now = cards.findIndex(function (c) { return c.getAttribute("aria-pressed") === "true"; });
        for (var n = 1; n <= cards.length; n++) {
          var next = cards[(now + dir * n + cards.length * n) % cards.length];
          // 숨은 카드(v2.2 — 다른 미션 로봇)도 건너뛴다.
          if (!next.hasAttribute("data-robot-offline") && !next.hidden) { next.click(); break; }
        }
      });
    });
  })();

  // ==================================================================
  // Delta 묻기 칸 — 펼친 판의 행동 버튼 줄 맨 오른쪽 [돋보기] 로 열고 닫는다. 열면 바로 적을 수 있게 초점을 준다.
  // ==================================================================
  (function () {
    var open = $("[data-ai-ask-open]");
    var box = $("#ai-ask");
    if (!open || !box) { return; }
    var input = $("[data-ai-ask]", box);
    open.addEventListener("click", function () {
      var on = box.hidden;
      box.hidden = !on;
      open.setAttribute("aria-expanded", on ? "true" : "false");
      open.setAttribute("aria-label", on ? "Delta 에게 묻기 닫기" : "Delta 에게 묻기 열기");
      if (on && input) { input.focus(); }
    });
  })();

  // screen.js 의 AI 패널 IIFE 가 먼저 돈 뒤에 첫 단계를 알린다(같은 틱에 스크립트 순서로 돈다).
  fromHash();
})();
