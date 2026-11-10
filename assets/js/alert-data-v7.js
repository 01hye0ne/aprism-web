/*
 * [11/10 v7] 알림 데이터 한 곳 — 관제 · 안전진단 · 알림 센터 · 전체 미션이 같은 알림 12건을 여기서 읽는다(디자이너 "동기화 안 됨").
 *   예전에는 네 화면이 같은 알림을 제각각 적어(monitor.js · safety.js · alert-center-data-v6.js · building.js) 한 곳만 고치면 어긋났다.
 *   v7 화면(*-v7.html)만 싣는다. 이 파일이 없는 화면(v6 · 영문판 · v5 이하)은 각 JS 안의 예전 데이터를 그대로 쓴다.
 *
 *   문장은 관제 메인 기준 — "측정 항목 + 값"(label + value). 예) 이상음향 점수 20.4 · 누출 의심도 62% · 최고 온도 48.6 ℃
 *
 *   한 건의 짜임
 *     공통     id(알림 센터 번호) · sev · mission · robot(관제 로봇 번호, 0부터) · floor · wp · place(설비) · detect(감지 6종)
 *              label · value(관제 문장) · ch(측정 채널) · time · uv(전체 미션 층 위 표식 자리) · slot(monitor.js 변수 자리 — 번호로 부르는 곳이 있다)
 *     monitor  관제 팝오버 · Delta 가 쓰는 것(where · title · 요약 · 조치 · Delta 낱말). title 은 예전 열쇠라 그대로 둔다(alert-text-v6.js)
 *     center   알림 센터에만 있는 것(검출 그림 · 근거 줄, 관제와 다른 조치)
 */
(function () {
  "use strict";
  var ALERTS = [
    { id: "A-1", slot: "CRITICAL.0", sev: "critical", mission: "정기 순회 점검", robot: 0, floor: "B4", wp: "WP-04", place: "N₂ 배관 압력계", detect: "계기인식", label: "압력", value: "0.86 MPa", ch: "", time: "10:12:40", uv: [0.38, 0.34],
      monitor: {
        live: "ppe",
        where: "터빈 2 / Unit 03 · WP-04 N₂ 배관 압력계",
        title: "지하발전소 터빈 2 NG 1건 발견",
        sum: "N₂ 배관 압력 0.86 MPa 로 정상 범위(0.60 ~ 0.80)를 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.",
        lead: "현장 점검부터 요청하세요.",
        fp: 8,
        fpLabel: "낮음",
        brief: ["WP-04 압력계가 NG예요.", "현장 점검부터 요청하세요."],
        acts: [{ t: "로봇 정지 · 현장 점검 요청", ai: true }, { t: "현장 무전 연락 · 작업 중지 요청", ai: true }, { t: "재측정 후 판단" }],
        eq: "N₂ 압력계",
        phen: "기준 초과",
        mname: "압력",
        val: "0.86",
        std: "0.80",
        next: "현장 점검부터 요청하세요.",
        btn: "현장 점검 요청",
        trend: "최근 3회 측정 계속 오름",
        hist: ["0.77", "0.79", "0.86"],
        cause: ["감압 밸브 설정 이상", "하류 밸브 닫힘", "주변 온도 상승"],
        fixFirst: "감압 밸브 설정부터 보는 게 가장 빨라요.",
        fix: ["감압 밸브 설정값 확인(기준 0.80)", "하류 밸브 열림 확인", "계속 오르면 공급 밸브 잠금"]
      },
      center: {
        img: "safety/gauge_crit.jpg",
        why: ["압력 0.86 MPa · 정상 범위 0.60 ~ 0.80 초과", "최근 3회 측정 0.77 → 0.79 → 0.86 으로 계속 오름", "감압 밸브 설정 이상 가능성이 가장 높음"]
      } },
    { id: "A-4", slot: "WARNINGS.0", sev: "warning", mission: "정기 순회 점검", robot: 0, floor: "B4", wp: "WP-03", place: "냉각수 배관 밸브", detect: "누출감지", label: "누출 의심도", value: "62%", ch: "", time: "10:11:19", uv: [0.3, 0.52],
      monitor: {
        live: "discharge",
        where: "APRO 4F · WP-03 냉각수 배관 밸브",
        title: "누출감지 · 냉각수 배관 밸브",
        sum: "밸브 이음부에서 누출 의심도 62% 로 기준 55% 를 넘었습니다. 연속 2프레임에서 나왔습니다.",
        lead: "구역 출입을 통제하고 설비팀에 밸브 확인을 요청하세요.",
        fp: 15,
        fpLabel: "낮음",
        acts: [{ t: "구역 출입 통제", ai: true }, { t: "설비팀 밸브 확인 요청", ai: true }, { t: "현장 확인" }],
        eq: "냉각수 밸브",
        phen: "누출",
        btn: "구역 출입 통제"
      },
      center: {
        img: "alert/wp03-leak.webp",
        why: ["누출 의심도 62% · 기준 55% 초과", "밸브 이음부 같은 자리에서 연속 2프레임 검출", "같은 냉각수 계통 WP-05 펌프 온도도 기준을 넘음"]
      } },
    { id: "A-9", slot: "WARNINGS.1", sev: "warning", mission: "발전기실 설비 점검", robot: 4, floor: "B3", wp: "WP-06", place: "수배전반", detect: "부분방전", label: "부분방전 점수", value: "9.41", ch: "", time: "09:36:42", uv: [0.62, 0.22],
      monitor: {
        live: "discharge",
        where: "Robot 05 · WP-06 수배전반",
        title: "부분방전 · 이상 점수 9.41",
        sum: "이상 점수 9.41 로 임계 9.23 을 넘었습니다. PRPD 패턴이 코로나 방전 유형과 일치합니다.",
        lead: "재진단을 예약해 PRPD 패턴을 다시 확인하세요.",
        fp: 22,
        fpLabel: "보통",
        acts: [{ t: "재진단 예약", ai: true }, { t: "현장 점검 요청" }, { t: "추이 관찰" }],
        eq: "수배전반",
        phen: "부분방전",
        btn: "재진단 예약"
      },
      center: {
        img: "alert/wp06-pd-941.webp",
        why: ["이상 점수 9.41 · 주의 기준 8.60 초과", "PRPD 패턴이 코로나 방전 유형과 일치", "같은 발전기 계통 WP-02 베어링 과열과 함께 나타날 수 있음"]
      } },
    { id: "A-10", slot: "WARNINGS.2", sev: "warning", mission: "발전기실 설비 점검", robot: 4, floor: "B3", wp: "WP-12", place: "냉각 펌프 P-2", detect: "이상음향", label: "이상음향 점수", value: "21.6", ch: "", time: "09:56:05", uv: [0.64, 0.46],
      monitor: {
        live: "discharge",
        where: "Robot 05 · WP-12 냉각 펌프 P-2",
        title: "이상음향 · 이상 점수 21.6",
        sum: "이상 점수 21.6 으로 기준 19.0 을 넘었습니다. 저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷합니다.",
        lead: "진동 정밀 측정을 요청하세요.",
        fp: 18,
        fpLabel: "낮음",
        acts: [{ t: "진동 정밀 측정 요청", ai: true }, { t: "설비 정지 검토 요청" }, { t: "추이 관찰" }],
        eq: "냉각 펌프",
        phen: "이상음",
        btn: "진동 정밀 측정 요청"
      },
      center: {
        img: "alert/wp12-sound-216.webp",
        why: ["이상 점수 21.6 · 기준 19.0 초과", "저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷함", "위험 기준 22.8 에 가까움"]
      } },
    { id: "A-8", slot: "WARNINGS.3", sev: "warning", mission: "발전기실 설비 점검", robot: 4, floor: "B3", wp: "WP-02", place: "발전기 베어링", detect: "온도감지", label: "최고 온도", value: "68.4 ℃", ch: "", time: "09:20:14", uv: [0.56, 0.24],
      monitor: {
        live: "ppe",
        where: "Robot 05 · WP-02 발전기 베어링",
        title: "과열 · 발전기 베어링 68.4℃",
        sum: "베어링 표면 온도 68.4℃ 로 주의 기준 65℃ 를 넘었습니다. 주변 온도보다 31℃ 높습니다.",
        lead: "윤활 상태 점검을 요청하세요.",
        fp: 25,
        fpLabel: "보통",
        acts: [{ t: "윤활 상태 점검 요청", ai: true }, { t: "열화상 재촬영" }, { t: "추이 관찰" }],
        eq: "발전기 베어링",
        phen: "과열",
        btn: "윤활 상태 점검 요청"
      },
      center: {
        img: "alert/wp02-temp-684.webp",
        why: ["표면 온도 68.4 ℃ · 주의 기준 65 ℃ 초과", "주변 온도보다 31 ℃ 높음", "어제 09:00 에도 주의(66.1 ℃) — 부하 감소 뒤에도 다시 오름"]
      } },
    { id: "A-11", slot: "WARNINGS.4", sev: "warning", mission: "발전기실 설비 점검", robot: 4, floor: "B4", wp: "WP-13", place: "공기 압축기 C-1", detect: "계기인식", label: "압력", value: "7.9 bar", ch: "", time: "10:01:12", uv: [0.5, 0.74],
      monitor: {
        live: "discharge",
        where: "Robot 05 · WP-13 공기 압축기 C-1",
        title: "압력 편차 · 공기 압축기 C-1",
        sum: "토출 압력 7.9 bar 로 정상 범위(8.2~8.8) 아래입니다. 흡입 필터가 막혔을 가능성이 있습니다.",
        lead: "흡입 필터 점검을 요청하세요.",
        fp: 30,
        fpLabel: "보통",
        acts: [{ t: "필터 점검 요청", ai: true }, { t: "재측정 예약" }, { t: "추이 관찰" }],
        eq: "공기 압축기",
        phen: "압력 낮음",
        btn: "필터 점검 요청"
      },
      center: {
        img: "alert/wp13-gauge-comp.webp",
        why: ["토출 압력 7.9 bar · 정상 범위 8.2 ~ 8.8 아래", "흡입 필터가 막혔을 가능성이 있음", "같은 압축기에서 오늘 다른 이상은 없음"]
      } },
    { id: "A-5", slot: "R01_MORE.0", sev: "warning", mission: "정기 순회 점검", robot: 0, floor: "B4", wp: "WP-05", place: "냉각 펌프 P-2", detect: "이상음향", label: "이상음향 점수", value: "20.4", ch: "", time: "10:13:52", uv: [0.24, 0.66],
      monitor: {
        live: "discharge",
        where: "APRO 4F · WP-05 냉각 펌프 P-2",
        title: "이상음향 · 냉각 펌프 P-2",
        sum: "이상 점수 20.4 로 기준 19.0 을 넘었습니다. 저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷합니다.",
        lead: "진동 정밀 측정을 요청하세요.",
        fp: 20,
        fpLabel: "낮음",
        acts: [{ t: "진동 정밀 측정 요청", ai: true }, { t: "설비 정지 검토 요청" }],
        eq: "냉각 펌프",
        phen: "이상음",
        btn: "진동 정밀 측정 요청"
      },
      center: {
        img: "alert/wp05-sound.webp",
        why: ["이상 점수 20.4 · 기준 19.0 초과", "저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷함", "같은 펌프 P-2 하우징 온도도 기준 초과(48.6 ℃)"]
      } },
    { id: "A-6", slot: "R01_MORE.1", sev: "warning", mission: "정기 순회 점검", robot: 0, floor: "B4", wp: "WP-05", place: "냉각 펌프 P-2", detect: "온도감지", label: "최고 온도", value: "48.6 ℃", ch: "", time: "10:14:10", uv: [0.24, 0.66],
      monitor: {
        live: "discharge",
        where: "APRO 4F · WP-05 냉각 펌프 P-2",
        title: "온도감지 · 냉각 펌프 P-2 48.6℃",
        sum: "펌프 하우징 최고 48.6℃ 로 기준 40℃ 를 넘었습니다. 평소 36.2℃ 보다 12.4℃ 높습니다.",
        lead: "부하를 줄이고 점검을 요청하세요.",
        fp: 18,
        fpLabel: "낮음",
        acts: [{ t: "부하 감소 요청", ai: true }, { t: "설비 점검 요청", ai: true }, { t: "현장 확인" }],
        eq: "냉각 펌프",
        phen: "과열",
        btn: "부하 감소 요청"
      },
      center: {
        img: "alert/wp05-temp-486.webp",
        why: ["최고 48.6 ℃ · 기준 40 ℃ 초과", "평소 36.2 ℃ 보다 12.4 ℃ 높음", "같은 펌프 P-2 에서 이상음향이 함께 검출됨"]
      } },
    { id: "A-7", slot: "R01_MORE.2", sev: "warning", mission: "정기 순회 점검", robot: 0, floor: "B4", wp: "WP-06", place: "수배전반 MCC-1", detect: "부분방전", label: "부분방전 점수", value: "9.05", ch: "CH1", time: "10:15:31", uv: [0.3, 0.78],
      monitor: {
        live: "discharge",
        where: "APRO 4F · WP-06 수배전반 MCC-1",
        title: "부분방전 · CH1 이상 점수 9.05",
        sum: "CH1 이상 점수 9.05 로 기준 8.60 을 넘었습니다. CH2 · CH3 은 정상 범위입니다.",
        lead: "절연 진단을 요청하세요.",
        fp: 22,
        fpLabel: "보통",
        acts: [{ t: "절연 진단 요청", ai: true }, { t: "감시 강화", ai: true }],
        eq: "수배전반",
        phen: "부분방전",
        btn: "절연 진단 요청"
      },
      center: {
        img: "alert/wp06-pd-905.webp",
        why: ["CH1 이상 점수 9.05 · 기준 8.60 초과", "CH2 · CH3 은 정상 범위", "WP-05 펌프 전원 계통 — 모터 발열로 이어질 수 있음"]
      } },
    { id: "A-2", slot: "R01_MORE.3", sev: "critical", mission: "정기 순회 점검", robot: 0, floor: "B4", wp: "WP-07", place: "고소 작업 발판", detect: "안전감지", label: "안전벨트 미착용", value: "1명", ch: "", time: "10:16:48", uv: [0.4, 0.62],
      monitor: {
        live: "ppe",
        where: "APRO 4F · WP-07 고소 작업 발판",
        title: "안전감지 · 안전벨트 미착용 1명",
        sum: "고소 작업 발판에서 안전벨트를 매지 않은 작업자 1명이 신뢰도 0.91 로 검출됐습니다.",
        lead: "작업자에게 즉시 착용을 안내하세요.",
        fp: 6,
        fpLabel: "낮음",
        brief: ["WP-07 작업자가 안전벨트 미착용이에요.", "즉시 착용부터 안내하세요."],
        acts: [{ t: "작업자 즉시 착용 안내", ai: true }, { t: "고소 작업 일시 중지", ai: true }, { t: "안전관리팀 전달" }],
        eq: "작업 발판",
        phen: "벨트 미착용",
        mname: "미착용",
        val: "1명",
        std: "0명",
        next: "즉시 착용부터 안내하세요.",
        btn: "작업자 착용 안내",
        trend: "연속 2프레임에서 검출",
        cause: ["고소 작업 중 벨트 미체결", "착용 안내 누락"],
        fixFirst: "작업자 위치부터 확인하는 게 가장 빨라요.",
        fix: ["작업자 위치 확인", "벨트 착용 안내", "착용 확인 뒤 작업 재개"]
      },
      center: {
        img: "safety/safety_crit.jpg",
        why: ["고소 작업 발판에서 안전벨트 미착용 1명 · 신뢰도 0.91", "연속 2프레임에서 검출", "고소 작업 중 — 착용 확인 전까지 작업을 멈추는 편이 안전함"]
      } },
    { id: "A-3", slot: "ROUTE_ALERTS.0", sev: "critical", mission: "전기실 열화상 점검", robot: 10, floor: "B3", wp: "WP-02", place: "HEPA Filter 차압계", detect: "계기인식", label: "차압", value: "312 Pa", ch: "", time: "09:44:18", uv: [0.6, 0.5],
      monitor: {
        live: "ppe",
        where: "Robot 11 · WP-02 HEPA Filter 차압계",
        title: "차압 NG · HEPA Filter 차압계",
        sum: "차압 312 Pa 로 교체 기준 250 Pa 를 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.",
        lead: "필터 교체와 현장 점검을 요청하세요.",
        fp: 9,
        fpLabel: "낮음",
        brief: ["WP-02 차압계가 NG예요.", "필터 교체부터 요청하세요."],
        acts: [{ t: "필터 교체 요청", ai: true }, { t: "현장 점검 요청", ai: true }, { t: "재측정 후 판단" }],
        eq: "HEPA 차압계",
        phen: "기준 초과",
        mname: "차압",
        val: "312 Pa",
        std: "250 Pa",
        next: "필터 교체부터 요청하세요.",
        btn: "필터 교체 요청",
        trend: "최근 3회 측정 계속 오름",
        hist: ["268 Pa", "291 Pa", "312 Pa"],
        cause: ["필터 막힘", "흡입구 이물질", "팬 풍량 설정 변경"],
        fixFirst: "필터 오염 상태부터 보는 게 가장 빨라요.",
        fix: ["필터 오염 상태 확인", "흡입구 이물질 제거", "기준을 넘으면 필터 교체"]
      },
      center: {
        img: "alert/wp02-gauge-hepa.webp",
        why: ["차압 312 Pa · 교체 기준 250 Pa 초과", "최근 3회 측정 268 → 291 → 312 Pa 로 계속 오름", "필터 막힘 가능성이 가장 높음"]
      } },
    { id: "A-12", slot: "ROUTE_ALERTS.1", sev: "warning", mission: "전기실 열화상 점검", robot: 10, floor: "B3", wp: "WP-04", place: "N₂ 배관 압력계", detect: "계기인식", label: "압력", value: "0.62 MPa", ch: "", time: "10:15:52", uv: [0.7, 0.64],
      monitor: {
        live: "discharge",
        where: "Robot 11 · WP-04 N₂ 배관 압력계",
        title: "압력 편차 · N₂ 배관 압력계",
        sum: "압력 0.62 MPa 로 정상 범위(0.65~0.75) 아래입니다. 최근 2회 측정에서 조금씩 내려가고 있습니다.",
        lead: "배관 연결부 누설 점검을 요청하세요.",
        fp: 20,
        fpLabel: "낮음",
        acts: [{ t: "누설 점검 요청", ai: true }, { t: "다음 순회 재측정" }, { t: "추이 관찰" }],
        eq: "N₂ 압력계",
        phen: "압력 낮음",
        btn: "누설 점검 요청"
      },
      center: {
        img: "alert/wp04-gauge-n2.webp",
        why: ["압력 0.62 MPa · 정상 범위 0.65 ~ 0.75 아래", "최근 2회 측정에서 조금씩 내려감", "배관 연결부 누설 가능성"]
      } }
  ];

  var DAY = "2026-11-02 ";   // v6 · v7 상태바 시계의 오늘(alert-center-data-v6.js 와 같다)
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function robotName(i) { return "Robot " + (i < 9 ? "0" : "") + (i + 1); }
  // 예전 판 항목 이름 — "이상음향 점수" · "부분방전 점수" 는 v7 에서 붙인 이름이다(alert-text-v6.js lab7). 예전 열쇠 · 알림 센터 제목은 "이상 점수"
  function label6(a) { return a.label === a.detect + " 점수" ? "이상 점수" : a.label; }
  function text(a) { return a.label + " " + a.value; }

  // 관제(monitor.js) — 예전 CRITICAL · WARNINGS · R01_MORE · ROUTE_ALERTS 와 같은 꼴
  function monitorObj(a) {
    var o = { sev: a.sev, robot: a.robot, floor: a.floor, wp: a.wp }, m = copy(a.monitor);
    Object.keys(m).forEach(function (k) {
      if (k === "title") { o.time = a.time; o.title = m.title; o.detect = a.detect; } else { o[k] = m[k]; }
    });
    return o;
  }
  function forMonitor(routeRules) {
    var s = { CRITICAL: null, WARNINGS: [], R01_MORE: [], ROUTE_ALERTS: [] };
    ALERTS.forEach(function (a) {
      var p = a.slot.split("."), o = monitorObj(a);
      if (p[0] === "CRITICAL") { s.CRITICAL = o; } else { s[p[0]][+p[1]] = o; }
    });
    if (!routeRules) { s.ROUTE_ALERTS = []; }
    return s;
  }

  // 알림 센터(alert-center.js) — alert-center-data-v6.js 미확인 12건과 같은 꼴
  function centerObj(a) {
    var c = a.center, m = a.monitor;
    var acts = c.acts || (m.acts || []).map(function (x) { return x.ai ? { t: x.t, delta: true } : { t: x.t }; });
    var o = { id: a.id, sev: a.sev, day: c.day || "today", time: a.time, stamp: c.stamp || DAY + a.time,
      title: c.title || a.detect + " · " + label6(a) + " " + a.value, res: [label6(a), a.value],
      floor: a.floor, wp: a.wp, place: a.place, mission: a.mission, detect: a.detect, robot: robotName(a.robot),
      img: c.img, why: copy(c.why), lead: c.lead !== undefined ? c.lead : m.lead, fp: c.fp !== undefined ? c.fp : m.fp,
      fpLabel: c.fpLabel !== undefined ? c.fpLabel : m.fpLabel, acts: copy(acts) };
    if (a.ch) { o.ch = a.ch; }
    return o;
  }

  // 전체 미션(building.js) — robot 은 그 화면의 로봇 번호(1부터)
  function buildingObj(a) {
    return { sev: a.sev, robot: a.robot + 1, floor: a.floor, where: a.monitor.where, time: a.time, title: a.monitor.title, uv: a.uv.slice() };
  }

  // 안전진단(safety.js) — 감지 카드 한 칸 [판정, 문장, "지점 설비", 시:분]
  function safetyCell(a) {
    return [a.sev === "critical" ? "crit" : "warn", text(a), a.wp + " " + a.place, a.time.slice(0, 5)];
  }

  // 알림 글(alert-text-v6.js) — 관제 제목 · 알림 센터 제목으로 찾는다. [감지, 예전 항목 이름, 값, 채널]
  function of(title) {
    var t = String(title || "");
    for (var i = 0; i < ALERTS.length; i++) {
      var a = ALERTS[i];
      if (a.monitor.title === t || centerObj(a).title === t) { return [a.detect, label6(a), a.value, a.ch]; }
    }
    return null;
  }

  window.APRISM_ALERTS7 = {
    list: ALERTS,
    text: text,
    of: of,
    forMonitor: forMonitor,
    forCenter: function () { return ALERTS.map(centerObj); },
    forBuilding: function () { return ALERTS.map(buildingObj); },
    forSafety: function () { return ALERTS.map(function (a) { return { mission: a.mission, detect: a.detect, label: a.label, value: a.value, cell: safetyCell(a) }; }); }
  };
})();
