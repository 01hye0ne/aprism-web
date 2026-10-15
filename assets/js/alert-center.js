/*
 * 알림 센터 (SD-08) — Figma 1177:15915.
 *
 * 목록 · 상세 · 필터를 여기서 그린다. screen.js 는 쓰지 않는다 — 통합 관제 메인 전용 코드가
 * 대부분이고 이 화면에 없는 요소를 찾으므로, 필요한 조각(Status Bar 드롭다운 · Select)만 여기 둔다.
 *
 * 건수는 데이터에서 센다. Figma 의 숫자는 서로 맞지 않았다 —
 * 제목 "미확인 11건", 탭 "미확인 11건 / 조치 완료 11건", 탭 옆 배지 "위험 3 · 주의 1",
 * 필터 "전체 22 · 위험 8 · 주의 14". 아래 ALERTS 는 그 숫자가 전부 맞아떨어지게 짰다 —
 *   전체 22 = 미확인 11(위험 4 · 주의 7) + 조치 완료 11(위험 4 · 주의 7)
 *   등급 합계 = 위험 8 · 주의 14
 * 배지와 탭 숫자는 데이터를 센 값이라 앞으로도 어긋나지 않는다.
 */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var SEV_LABEL = { critical: "위험", warning: "주의" };
  var SEV_ICON = { critical: "--ic-error", warning: "--ic-warning" };

  // ==================================================================
  // 알림 데이터
  //
  // sev    위험(critical) · 주의(warning). 알림 정책을 따른다 — NG 판정 · 안전 감지는 위험,
  //        기준치를 넘은 이상징후(누출 · 부분방전 · 진동 · 과열 · 압력)는 주의다.
  // day    today · yesterday. [기간] 필터가 본다.
  // live   스냅숏 그림(assets/img/alert-live-*.webp). 디자이너가 준 검출 캡처 세 장이라
  //        알림 내용과 딱 맞는 그림은 아니다 — v2.2 monitor.js 와 같은 사정이다.
  // lead   DELTA 조치 제안 한 줄. why 는 그 근거 세 줄, fp 는 오탐 가능성(%)이다.
  // acts   조치 내용 선택지. delta:true 가 DELTA 추천이다.
  // done   조치 완료된 알림 — 처리 시각 · 처리자 · 고른 조치가 들어 있다.
  // ==================================================================
  var ALERTS = [
    { id: "A-1", sev: "critical", day: "today", time: "10:11:19", stamp: "2026-10-13 10:11:19",
      title: "안전모 미착용 작업자 감지", wp: "WP-07", place: "지하발전소 B3 터빈 2",
      mission: "B3 터빈 정기점검", detect: "안전감지", robot: "R-07", live: "ppe",
      lead: "작업자에게 안전모 착용 안내가 필요합니다.",
      why: ["WP-07에서 최근 7일 NG 3회 (10/08 · 10/11 · 오늘)",
            "지난 2회는 설비 담당 전달로 처리 · 평균 6분",
            "같은 미션 계기판 지침 이탈(WP-05)이 2분 전 발생"],
      fp: 12, fpLabel: "낮음",
      acts: [{ t: "작업 중지 요청", delta: true }, { t: "전화 안내", delta: true },
             { t: "현장 확인" }, { t: "설비 담당 전달" }, { t: "오탐 처리" }] },

    { id: "A-2", sev: "critical", day: "today", time: "10:11:19", stamp: "2026-10-13 10:11:19",
      title: "터빈 2 NG 1건 발견", wp: "WP-07", place: "지하발전소 B3 터빈 2",
      mission: "B3 터빈 정기점검", detect: "계기판독", robot: "R-07", live: "discharge",
      lead: "재측정 뒤 설비 담당에게 전달하는 것이 좋겠습니다.",
      why: ["Spiral Casing Pr. 측정값 90 · 기준값 87 초과",
            "최근 3회 측정이 잇달아 올라 NG 로 판정",
            "같은 웨이포인트에서 안전모 미착용이 함께 올라옴"],
      fp: 18, fpLabel: "낮음",
      acts: [{ t: "재측정 요청", delta: true }, { t: "설비 담당 전달", delta: true },
             { t: "현장 확인" }, { t: "작업 중지 요청" }, { t: "오탐 처리" }] },

    { id: "A-3", sev: "critical", day: "yesterday", time: "어제 21:02", stamp: "2026-10-12 21:02:44",
      title: "탱크 외벽 균열 의심", wp: "WP-02", place: "옥외 저장탱크 T-3 외벽",
      mission: "옥외 저장탱크 순찰", detect: "외관검사", robot: "R-03", live: "deid",
      lead: "날이 밝으면 현장 확인이 필요합니다.",
      why: ["균열 패턴 신뢰도 0.91 · 임계 0.70 초과",
            "지난달 같은 자리에서 0.63 으로 한 번 걸러짐",
            "야간 순찰이라 조도가 낮아 재촬영 권장"],
      fp: 24, fpLabel: "보통",
      acts: [{ t: "현장 확인", delta: true }, { t: "주간 재촬영", delta: true },
             { t: "설비 담당 전달" }, { t: "오탐 처리" }] },

    { id: "A-4", sev: "critical", day: "yesterday", time: "어제 20:47", stamp: "2026-10-12 20:47:03",
      title: "가스 누출 경보 · 농도 기준 초과", wp: "WP-09", place: "옥외 저장탱크 T-3 밸브실",
      mission: "옥외 저장탱크 순찰", detect: "가스감지", robot: "R-03", live: "discharge",
      lead: "밸브실 출입을 막고 환기부터 해야 합니다.",
      why: ["측정 농도 42 ppm · 경보 기준 25 ppm 초과",
            "4분 동안 계속 올라 자연 환기로는 내려가지 않음",
            "밸브실은 밀폐 공간 — 출입 통제가 먼저"],
      fp: 8, fpLabel: "낮음",
      acts: [{ t: "출입 통제", delta: true }, { t: "환기 요청", delta: true },
             { t: "전화 안내" }, { t: "설비 담당 전달" }, { t: "오탐 처리" }] },

    { id: "A-5", sev: "warning", day: "today", time: "10:09:42", stamp: "2026-10-13 10:09:42",
      title: "계기판 지침 정상 범위 이탈", wp: "WP-05", place: "지하발전소 B3 터빈 1",
      mission: "B3 터빈 정기점검", detect: "계기판독", robot: "R-07", live: "discharge",
      lead: "다음 순회에서 재측정하면 되겠습니다.",
      why: ["지침 92 · 정상 범위 84~90 에서 2 벗어남",
            "앞선 2회는 범위 안이라 추이로는 아직 판단 못 함",
            "같은 미션 WP-07 NG 와 설비가 다름"],
      fp: 31, fpLabel: "보통",
      acts: [{ t: "다음 순회 재측정", delta: true }, { t: "추이 관찰", delta: true },
             { t: "현장 확인" }, { t: "오탐 처리" }] },

    { id: "A-6", sev: "warning", day: "today", time: "10:08:15", stamp: "2026-10-13 10:08:15",
      title: "누출감지 · 냉각수 배관 밸브", wp: "WP-03", place: "지하발전소 B3 냉각수 배관",
      mission: "B3 터빈 정기점검", detect: "누출감지", robot: "R-07", live: "discharge",
      lead: "현장 점검을 요청하는 것이 좋겠습니다.",
      why: ["누출 패턴 신뢰도 0.87 · 임계 0.70 초과",
            "연속 2프레임에서 같은 자리에 나옴",
            "같은 배관에서 지난주 체결 작업 기록 있음"],
      fp: 15, fpLabel: "낮음",
      acts: [{ t: "현장 점검 요청", delta: true }, { t: "설비 담당 전달", delta: true },
             { t: "다음 순회 재측정" }, { t: "오탐 처리" }] },

    { id: "A-7", sev: "warning", day: "today", time: "10:06:41", stamp: "2026-10-13 10:06:41",
      title: "부분방전 · 이상 점수 9.41", wp: "WP-06", place: "지하발전소 B3 수배전반",
      mission: "B3 전기실 순회", detect: "부분방전", robot: "R-02", live: "discharge",
      lead: "재진단을 예약해 두는 편이 좋습니다.",
      why: ["이상 점수 9.41 · 임계 9.23 초과",
            "PRPD 패턴이 코로나 방전 유형과 일치",
            "같은 수배전반에서 8월에 같은 유형 1회"],
      fp: 21, fpLabel: "보통",
      acts: [{ t: "재진단 예약", delta: true }, { t: "현장 점검 요청", delta: true },
             { t: "추이 관찰" }, { t: "오탐 처리" }] },

    { id: "A-8", sev: "warning", day: "today", time: "10:04:02", stamp: "2026-10-13 10:04:02",
      title: "진동 상승 · 냉각 펌프 P-2", wp: "WP-12", place: "지하발전소 B3 냉각 펌프",
      mission: "B3 터빈 정기점검", detect: "진동측정", robot: "R-07", live: "discharge",
      lead: "베어링 점검을 요청하는 것이 좋겠습니다.",
      why: ["진동 RMS 4.8 mm/s · 주의 기준 4.5 초과",
            "최근 3회 측정에서 계속 오름",
            "같은 펌프 과열 기록은 없음"],
      fp: 17, fpLabel: "낮음",
      acts: [{ t: "베어링 점검 요청", delta: true }, { t: "다음 순회 재측정", delta: true },
             { t: "추이 관찰" }, { t: "오탐 처리" }] },

    { id: "A-9", sev: "warning", day: "today", time: "10:01:58", stamp: "2026-10-13 10:01:58",
      title: "과열 · 발전기 베어링 68.4℃", wp: "WP-02", place: "지하발전소 B3 발전기",
      mission: "B3 터빈 정기점검", detect: "열화상", robot: "R-07", live: "discharge",
      lead: "윤활 상태 점검을 요청해 주세요.",
      why: ["표면 온도 68.4℃ · 주의 기준 65℃ 초과",
            "주변 온도보다 31℃ 높음",
            "지난 윤활 작업이 6주 전"],
      fp: 13, fpLabel: "낮음",
      acts: [{ t: "윤활 상태 점검 요청", delta: true }, { t: "열화상 재촬영", delta: true },
             { t: "추이 관찰" }, { t: "오탐 처리" }] },

    { id: "A-10", sev: "warning", day: "today", time: "09:58:30", stamp: "2026-10-13 09:58:30",
      title: "압력 편차 · 공기 압축기 C-1", wp: "WP-20", place: "지하발전소 B3 압축기실",
      mission: "B3 설비 순회", detect: "압력측정", robot: "R-05", live: "discharge",
      lead: "흡입 필터 점검을 요청하는 것이 좋겠습니다.",
      why: ["토출 압력 7.9 bar · 정상 범위 8.2~8.8 아래",
            "필터 교체 주기가 2주 지났음",
            "같은 압축기에서 지난달 같은 편차 1회"],
      fp: 19, fpLabel: "낮음",
      acts: [{ t: "필터 점검 요청", delta: true }, { t: "재측정 예약", delta: true },
             { t: "추이 관찰" }, { t: "오탐 처리" }] },

    { id: "A-11", sev: "warning", day: "yesterday", time: "어제 20:12", stamp: "2026-10-12 20:12:19",
      title: "안전난간 개방 감지", wp: "WP-04", place: "옥외 저장탱크 T-3 계단",
      mission: "옥외 저장탱크 순찰", detect: "안전감지", robot: "R-03", live: "deid",
      lead: "난간을 닫아 달라고 전달해 주세요.",
      why: ["난간 개방 상태 신뢰도 0.84 · 임계 0.70 초과",
            "야간이라 작업자 통행은 확인되지 않음",
            "같은 계단에서 9월에 2회 같은 알림"],
      fp: 26, fpLabel: "보통",
      acts: [{ t: "설비 담당 전달", delta: true }, { t: "주간 재촬영", delta: true },
             { t: "현장 확인" }, { t: "오탐 처리" }] },

    /* ---- 조치 완료 11건 (위험 4 · 주의 7) ---- */
    { id: "B-1", sev: "critical", day: "today", time: "09:41:08", stamp: "2026-10-13 09:41:08",
      title: "터빈 1 NG 2건 발견", wp: "WP-05", place: "지하발전소 B3 터빈 1",
      mission: "B3 터빈 정기점검", detect: "계기판독", robot: "R-07", live: "discharge",
      lead: "설비 담당 전달이 필요했습니다.", why: ["측정값 2건이 기준값을 넘음"],
      fp: 11, fpLabel: "낮음", acts: [{ t: "설비 담당 전달" }, { t: "재측정 요청" }],
      done: { at: "09:52", by: "홍길동", picked: ["설비 담당 전달", "재측정 요청"],
              memo: "설비 2팀 김 반장에게 전달. 오후 재측정 예정." } },
    { id: "B-2", sev: "critical", day: "today", time: "09:22:47", stamp: "2026-10-13 09:22:47",
      title: "방호문 개방 상태 지속", wp: "WP-11", place: "지하발전소 B3 방호문",
      mission: "B3 설비 순회", detect: "안전감지", robot: "R-05", live: "ppe",
      lead: "현장 확인이 필요했습니다.", why: ["개방 상태가 9분 이어짐"],
      fp: 9, fpLabel: "낮음", acts: [{ t: "현장 확인" }],
      done: { at: "09:30", by: "홍길동", picked: ["현장 확인"], memo: "" } },
    { id: "B-3", sev: "critical", day: "yesterday", time: "어제 18:35", stamp: "2026-10-12 18:35:12",
      title: "펌프실 침수 의심", wp: "WP-14", place: "지하발전소 B4 펌프실",
      mission: "B3 설비 순회", detect: "외관검사", robot: "R-05", live: "discharge",
      lead: "배수 요청이 필요했습니다.", why: ["바닥 반사 패턴 신뢰도 0.88"],
      fp: 22, fpLabel: "보통", acts: [{ t: "배수 요청" }, { t: "현장 확인" }],
      done: { at: "어제 19:04", by: "이영희", picked: ["배수 요청", "현장 확인"],
              memo: "결로로 확인. 배수 불필요." } },
    { id: "B-4", sev: "critical", day: "yesterday", time: "어제 16:09", stamp: "2026-10-12 16:09:55",
      title: "비상정지 발동 · 로봇 구동 차단", wp: "WP-08", place: "지하발전소 B3 터빈 2",
      mission: "B3 터빈 정기점검", detect: "비상정지", robot: "R-07", live: "ppe",
      lead: "해제 절차가 필요했습니다.", why: ["관제사가 직접 발동"],
      fp: 0, fpLabel: "없음", acts: [{ t: "해제 절차 진행" }],
      done: { at: "어제 16:21", by: "이영희", picked: ["해제 절차 진행"],
              memo: "현장 안전 확인 뒤 해제." } },
    { id: "B-5", sev: "warning", day: "today", time: "09:18:22", stamp: "2026-10-13 09:18:22",
      title: "소음 상승 · 송풍기 F-2", wp: "WP-16", place: "지하발전소 B3 송풍기",
      mission: "B3 설비 순회", detect: "소음측정", robot: "R-05", live: "discharge",
      lead: "추이 관찰로 두면 되겠습니다.", why: ["82 dB · 주의 기준 80 dB 초과"],
      fp: 28, fpLabel: "보통", acts: [{ t: "추이 관찰" }],
      done: { at: "09:24", by: "홍길동", picked: ["추이 관찰"], memo: "" } },
    { id: "B-6", sev: "warning", day: "today", time: "09:05:40", stamp: "2026-10-13 09:05:40",
      title: "절연 저항 하락 · 배전반 D-1", wp: "WP-06", place: "지하발전소 B3 수배전반",
      mission: "B3 전기실 순회", detect: "절연측정", robot: "R-02", live: "discharge",
      lead: "재진단 예약이 필요했습니다.", why: ["저항값이 기준 아래로 내려감"],
      fp: 16, fpLabel: "낮음", acts: [{ t: "재진단 예약" }],
      done: { at: "09:15", by: "홍길동", picked: ["재진단 예약"], memo: "11시 재진단 예약." } },
    { id: "B-7", sev: "warning", day: "today", time: "08:52:11", stamp: "2026-10-13 08:52:11",
      title: "먼지 농도 상승 · 집진기 주변", wp: "WP-18", place: "지하발전소 B3 집진기",
      mission: "B3 설비 순회", detect: "분진감지", robot: "R-05", live: "discharge",
      lead: "필터 점검 요청이 필요했습니다.", why: ["분진 농도가 기준치를 넘음"],
      fp: 23, fpLabel: "보통", acts: [{ t: "필터 점검 요청" }],
      done: { at: "09:01", by: "홍길동", picked: ["필터 점검 요청"], memo: "" } },
    { id: "B-8", sev: "warning", day: "yesterday", time: "어제 22:40", stamp: "2026-10-12 22:40:05",
      title: "조도 부족 · 순찰 구간 T-3", wp: "WP-01", place: "옥외 저장탱크 T-3 입구",
      mission: "옥외 저장탱크 순찰", detect: "외관검사", robot: "R-03", live: "deid",
      lead: "주간 재촬영이 필요했습니다.", why: ["야간 조도로 판독 신뢰도가 낮음"],
      fp: 34, fpLabel: "보통", acts: [{ t: "주간 재촬영" }],
      done: { at: "어제 22:48", by: "이영희", picked: ["주간 재촬영"], memo: "오늘 주간 순찰에 포함." } },
    { id: "B-9", sev: "warning", day: "yesterday", time: "어제 19:55", stamp: "2026-10-12 19:55:31",
      title: "밸브 개도 편차 · V-7", wp: "WP-09", place: "옥외 저장탱크 T-3 밸브실",
      mission: "옥외 저장탱크 순찰", detect: "계기판독", robot: "R-03", live: "discharge",
      lead: "다음 순회 재측정이 필요했습니다.", why: ["개도 지침이 설정값과 6% 차이"],
      fp: 20, fpLabel: "낮음", acts: [{ t: "다음 순회 재측정" }],
      done: { at: "어제 20:03", by: "이영희", picked: ["다음 순회 재측정"], memo: "" } },
    { id: "B-10", sev: "warning", day: "yesterday", time: "어제 17:12", stamp: "2026-10-12 17:12:48",
      title: "온도 상승 · 변압기 TR-2", wp: "WP-07", place: "지하발전소 B3 변압기",
      mission: "B3 전기실 순회", detect: "열화상", robot: "R-02", live: "discharge",
      lead: "열화상 재촬영이 필요했습니다.", why: ["표면 온도가 주의 기준을 넘음"],
      fp: 14, fpLabel: "낮음", acts: [{ t: "열화상 재촬영" }],
      done: { at: "어제 17:25", by: "이영희", picked: ["열화상 재촬영"], memo: "부하 상승 구간으로 확인." } },
    { id: "B-11", sev: "warning", day: "yesterday", time: "어제 15:30", stamp: "2026-10-12 15:30:02",
      title: "누유 흔적 · 감속기 G-3", wp: "WP-13", place: "지하발전소 B4 감속기",
      mission: "B3 설비 순회", detect: "누출감지", robot: "R-05", live: "discharge",
      lead: "현장 점검 요청이 필요했습니다.", why: ["바닥 유막 패턴이 검출됨"],
      fp: 25, fpLabel: "보통", acts: [{ t: "현장 점검 요청" }],
      done: { at: "어제 15:44", by: "이영희", picked: ["현장 점검 요청"], memo: "" } }
  ];

  // ==================================================================
  // 상태
  // ==================================================================
  var state = {
    tab: "open",            // open · done
    mission: "전체 미션",
    period: "전체 기간",
    sort: "위험 우선",
    sev: { all: true, critical: false, warning: false },
    picked: null,           // 고른 알림 id
    chosen: {},             // id -> 고른 조치 목록
    memo: {}                // id -> 메모
  };

  var SORT = {
    "위험 우선": function (a, b) {
      if (a.sev !== b.sev) { return a.sev === "critical" ? -1 : 1; }
      return order(b) - order(a);
    },
    "최신순": function (a, b) { return order(b) - order(a); },
    "오래된순": function (a, b) { return order(a) - order(b); }
  };

  // 정렬 열쇠 — 어제는 오늘보다 작다. 시각은 "어제 21:02" 처럼 접두가 붙으므로 숫자만 뽑는다.
  function order(a) {
    var hhmm = (a.time.match(/(\d{1,2}):(\d{2})/) || [0, 0, 0]);
    return (a.day === "today" ? 1 : 0) * 10000 + Number(hhmm[1]) * 100 + Number(hhmm[2]);
  }

  function inTab(a) { return state.tab === "done" ? !!a.done : !a.done; }

  function visible() {
    var list = ALERTS.filter(function (a) {
      if (!inTab(a)) { return false; }
      if (state.mission !== "전체 미션" && a.mission !== state.mission) { return false; }
      if (state.period === "오늘" && a.day !== "today") { return false; }
      if (!state.sev.all) {
        if (a.sev === "critical" && !state.sev.critical) { return false; }
        if (a.sev === "warning" && !state.sev.warning) { return false; }
      }
      return true;
    });
    list.sort(SORT[state.sort] || SORT["위험 우선"]);
    return list;
  }

  function countBy(sev, done) {
    return ALERTS.filter(function (a) {
      return a.sev === sev && (done ? !!a.done : !a.done);
    }).length;
  }

  // ==================================================================
  // 그리기 — 목록
  // ==================================================================
  var list = $("[data-ac-list]");
  var detail = $("[data-ac-detail]");

  function icon(name, size) {
    return '<span class="i i-' + size + '" style="--i:var(' + name + ')" aria-hidden="true"></span>';
  }

  /*
   * 줄은 role="row" 다. 줄 안에 [보고서] 버튼이 들어가므로 줄 자체를 button 으로 두면
   * button 안에 button 이 된다 — grid 짜임으로 두고 줄에 tabindex 를 준다.
   * 위/아래 화살표로 줄을 옮기고, Enter · Space 로 고른다.
   */
  function renderList() {
    var rows = visible();

    if (!rows.length) {
      list.innerHTML = '<p class="ac-empty t-body-3">조건에 맞는 알림이 없습니다.</p>';
      renderNth(rows);
      return;
    }

    list.innerHTML = rows.map(function (a) {
      var sel = a.id === state.picked;
      return '<div class="ac-row" role="row" data-id="' + a.id + '" data-sev="' + a.sev + '"' +
          ' tabindex="' + (sel ? "0" : "-1") + '" aria-selected="' + (sel ? "true" : "false") + '">' +
          '<span class="ac-stripe" aria-hidden="true"></span>' +
          '<span class="ac-c-sev" role="gridcell">' + icon(SEV_ICON[a.sev], 16) +
            '<span class="ac-sr">' + SEV_LABEL[a.sev] + '</span></span>' +
          '<span class="ac-c-time ac-mono" role="gridcell">' + a.time + '</span>' +
          '<span class="ac-c-title t-label-1" role="gridcell">' + a.title + '</span>' +
          '<span class="ac-c-place" role="gridcell">' +
            '<span class="ac-wp ac-mono-label">' + a.wp + '</span>' +
            '<span class="ac-place t-body-4">' + a.place + '</span>' +
          '</span>' +
          '<span class="ac-c-mission t-caption" role="gridcell">' + a.mission + '</span>' +
          '<span class="ac-c-act" role="gridcell">' +
            '<button type="button" class="btn btn-ghost is-xs" data-report>보고서</button>' +
          '</span>' +
        '</div>';
    }).join("");

    $$("[data-id]", list).forEach(function (row) {
      row.addEventListener("click", function () { pick(row.getAttribute("data-id")); });
      row.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown") { event.preventDefault(); step(1); }
        else if (event.key === "ArrowUp") { event.preventDefault(); step(-1); }
        else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          pick(row.getAttribute("data-id"));
        }
      });
      // 줄의 [보고서] — 줄을 고르는 것과 다른 동작이라 전파를 끊는다.
      $(".btn", row).addEventListener("click", function (event) { event.stopPropagation(); });
    });

    renderNth(rows);
  }

  function renderNth(rows) {
    rows = rows || visible();
    var i = rows.findIndex(function (a) { return a.id === state.picked; });
    $("[data-ac-nth]").textContent = rows.length ? (i + 1) + "/" + rows.length : "0/0";
    $("[data-ac-prev]").disabled = i <= 0;
    $("[data-ac-next]").disabled = i < 0 || i >= rows.length - 1;
  }

  function step(delta) {
    var rows = visible();
    var i = rows.findIndex(function (a) { return a.id === state.picked; });
    var next = rows[i + delta];
    if (next) { pick(next.id); }
  }

  function pick(id) {
    state.picked = id;
    var focus = null;
    $$("[data-id]", list).forEach(function (row) {
      var on = row.getAttribute("data-id") === id;
      row.setAttribute("aria-selected", on ? "true" : "false");
      row.setAttribute("tabindex", on ? "0" : "-1");
      if (on) { focus = row; }
    });
    // 목록 안에 포커스가 있을 때만 따라 옮긴다 — 필터나 탭을 누른 것이면 그 자리에 둔다.
    if (focus && list.contains(document.activeElement)) { focus.focus(); }
    renderNth();
    renderDetail();
  }

  // ==================================================================
  // 그리기 — 선택 상세
  // ==================================================================
  function alertOf(id) {
    return ALERTS.filter(function (a) { return a.id === id; })[0] || null;
  }

  /*
   * 목록이 바뀐 뒤 다시 그린다. 고른 알림이 사라졌으면(필터 · 탭을 바꿨거나 조치를 끝냈거나)
   * 보이는 첫 알림을 고른다 — 오른쪽 칸을 빈 채로 두지 않는다.
   */
  function refresh() {
    var rows = visible();
    if (!state.picked || !rows.some(function (a) { return a.id === state.picked; })) {
      state.picked = rows.length ? rows[0].id : null;
    }
    renderCounts();
    renderList();
    renderDetail();
  }

  function renderDetail() {
    var a = alertOf(state.picked);
    if (!a) {
      // 거르고 나니 목록이 비었을 때와, 목록은 있는데 아직 안 골랐을 때는 할 말이 다르다.
      detail.innerHTML = '<p class="ac-empty t-body-3">' +
        (visible().length ? "왼쪽 목록에서 알림을 고르세요." : "표시할 알림이 없습니다.") + '</p>';
      return;
    }
    var done = a.done;
    var chosen = done ? done.picked.slice() : (state.chosen[a.id] || []);

    detail.innerHTML =
      '<div class="ac-detail-contents">' +
        '<div class="ac-d-title-block">' +
          '<p class="ac-d-age t-caption">' + a.stamp + ' 발생</p>' +
          '<div class="ac-d-title-row">' +
            '<span class="ac-sev-badge t-label-2' + (a.sev === "warning" ? " is-warning" : "") + '">' +
              '<span class="badge-dot" aria-hidden="true"></span>' + SEV_LABEL[a.sev] +
            '</span>' +
            '<h2 class="t-title-1">' + a.title + '</h2>' +
          '</div>' +
        '</div>' +

        '<div class="ac-d-snap-meta">' +
          '<figure class="ac-d-snap">' +
            '<img src="../assets/img/alert-live-' + a.live + '.webp" alt="' + a.title + ' 검출 장면" />' +
          '</figure>' +
          '<dl class="ac-d-meta">' +
            metaRow("미션", '<span class="t-body-4">' + a.mission + '</span>') +
            metaRow("위치",
              '<span class="ac-mono-label">' + a.wp + '</span>' +
              '<span class="t-body-4">' + a.place + '</span>' +
              '<a class="t-caption" href="./main-v2-2.html">지도에서 보기</a>') +
            metaRow("감지", '<span class="ac-d-chip t-caption">' + a.detect + '</span>') +
            metaRow("로봇", '<span class="ac-d-robot ac-mono">' + a.robot + '</span>') +
          '</dl>' +
        '</div>' +

        deltaCard(a) +
        actsBlock(a, chosen, done) +
        memoBlock(a, done) +
      '</div>' +
      actionsRow(a, chosen, done);

    wireDetail(a, done);
  }

  function metaRow(label, value) {
    return '<div class="ac-d-meta-row"><dt class="t-caption">' + label + '</dt>' +
           '<dd>' + value + '</dd></div>';
  }

  function deltaCard(a) {
    return '<section class="ac-delta">' +
      '<div class="ac-delta-mark">' + icon("--ic-cpu", 16) +
        '<span class="t-label-2">DELTA 조치 제안</span></div>' +
      '<h3 class="t-title-2">' + a.lead + '</h3>' +
      '<ul class="ac-delta-reasons">' +
        a.why.map(function (w) { return '<li class="t-body-4">' + w + '</li>'; }).join("") +
      '</ul>' +
      '<div class="ac-fp" style="--ac-fp:' + a.fp + '%">' +
        '<span class="ac-fp-label t-caption">오탐 가능성</span>' +
        '<span class="ac-fp-meter" role="img" aria-label="오탐 가능성 ' + a.fp + '퍼센트"><i></i></span>' +
        '<span class="ac-fp-value"><b class="t-label-2">' + a.fpLabel + '</b>' +
          '<span class="t-caption">' + a.fp + '%</span></span>' +
      '</div>' +
    '</section>';
  }

  function actsBlock(a, chosen, done) {
    var hasDelta = a.acts.some(function (c) { return c.delta; });
    return '<section class="ac-acts">' +
      '<div class="ac-acts-head">' +
        '<h3 class="t-label-1">조치 내용' + (done ? "" : " (여러 개 선택 가능)") + '</h3>' +
        (hasDelta && !done
          ? '<span class="badge t-caption"><span class="badge-dot" aria-hidden="true"></span>DELTA 추천</span>'
          : "") +
      '</div>' +
      '<div class="ac-presets">' +
        a.acts.map(function (c) {
          var on = chosen.indexOf(c.t) > -1;
          return '<button type="button" class="ac-capsule" data-act="' + c.t + '"' +
            (c.delta && !done ? ' data-delta' : "") +
            ' aria-pressed="' + (on ? "true" : "false") + '"' + (done ? " disabled" : "") + '>' +
            c.t + (c.delta && !done ? '<span class="ac-capsule-dot" aria-hidden="true"></span>' : "") +
          '</button>';
        }).join("") +
      '</div>' +
    '</section>';
  }

  function memoBlock(a, done) {
    if (done) {
      return '<section class="ac-memo field">' +
        '<span class="field-label">메모</span>' +
        '<p class="t-body-3' + (done.memo ? "" : " ac-memo-empty") + '">' +
          (done.memo || "남긴 메모가 없습니다.") + '</p>' +
      '</section>';
    }
    return '<section class="ac-memo field">' +
      '<label class="field-label" for="ac-memo">메모 (선택)</label>' +
      '<textarea id="ac-memo" data-ac-memo maxlength="500" ' +
        'placeholder="현장에 전달한 내용을 적어 주세요">' + (state.memo[a.id] || "") + '</textarea>' +
      '<span class="field-helper t-caption">교대 인수인계에 필요한 내용을 남깁니다. 최대 500자.</span>' +
    '</section>';
  }

  /*
   * 아래 동작 줄.
   * 조치 완료는 조치를 하나라도 골라야 켜진다 — v2.2 알림 쪽지와 같은 규칙이다.
   * "임시저장된 상태" 는 Figma 에서 Ghost 버튼이었다. 누를 수 없는 상태 문구라 버튼에서 뺐다.
   */
  function actionsRow(a, chosen, done) {
    if (done) {
      return '<div class="ac-actions">' +
        '<span class="ac-head-spacer"></span>' +
        '<p class="ac-draft t-caption">' + done.at + ' · ' + done.by + ' 조치 완료</p>' +
      '</div>';
    }
    var hasDraft = chosen.length > 0 || !!state.memo[a.id];
    return '<div class="ac-actions">' +
      '<span class="ac-head-spacer"></span>' +
      (hasDraft ? '<p class="ac-draft t-caption">임시저장된 상태</p>' : "") +
      '<button type="button" class="btn btn-accent is-md" data-ac-done' +
        (chosen.length ? "" : " disabled") + '>조치 완료</button>' +
    '</div>';
  }

  function wireDetail(a, done) {
    if (done) { return; }

    $$("[data-act]", detail).forEach(function (cap) {
      cap.addEventListener("click", function () {
        var t = cap.getAttribute("data-act");
        var cur = state.chosen[a.id] || [];
        var i = cur.indexOf(t);
        if (i > -1) { cur.splice(i, 1); } else { cur = cur.concat([t]); }
        state.chosen[a.id] = cur;
        renderDetail();
      });
    });

    var memo = $("[data-ac-memo]", detail);
    if (memo) {
      memo.addEventListener("input", function () { state.memo[a.id] = memo.value; });
      // 임시저장 표시는 포커스를 잃을 때 한 번만 갱신한다 — 글자마다 다시 그리면 커서가 튄다.
      memo.addEventListener("blur", function () { renderDetail(); });
    }

    var doneBtn = $("[data-ac-done]", detail);
    if (doneBtn) {
      doneBtn.addEventListener("click", function () {
        a.done = { at: nowHM(), by: "홍길동",
                   picked: (state.chosen[a.id] || []).slice(),
                   memo: state.memo[a.id] || "" };
        delete state.chosen[a.id];
        delete state.memo[a.id];
        state.picked = null;
        refresh();
      });
    }
  }

  function nowHM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ==================================================================
  // 그리기 — 건수(제목 배지 · 탭 · 탭 옆 배지 · 등급 필터)
  // ==================================================================
  function renderCounts() {
    var openCrit = countBy("critical", false), openWarn = countBy("warning", false);
    var doneCrit = countBy("critical", true), doneWarn = countBy("warning", true);
    var open = openCrit + openWarn, closed = doneCrit + doneWarn;

    $("[data-ac-open-badge]").textContent = "미확인 " + open + "건";
    $("[data-ac-count-open]").textContent = open + "건";
    $("[data-ac-count-done]").textContent = closed + "건";

    var crit = state.tab === "done" ? doneCrit : openCrit;
    var warn = state.tab === "done" ? doneWarn : openWarn;
    $("[data-ac-badge-crit]").textContent = "위험 " + crit;
    $("[data-ac-badge-warn]").textContent = "주의 " + warn;

    $("[data-ac-f-all]").textContent = "전체 " + ALERTS.length;
    $("[data-ac-f-crit]").textContent = "위험 " + (openCrit + doneCrit);
    $("[data-ac-f-warn]").textContent = "주의 " + (openWarn + doneWarn);
  }

  // ==================================================================
  // 조작 걸기
  // ==================================================================
  function wire() {
    // 탭
    $$("[data-ac-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.tab = tab.getAttribute("data-ac-tab");
        state.picked = null;
        $$("[data-ac-tab]").forEach(function (t) {
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        refresh();
      });
    });

    // 등급 필터 — 전체는 나머지의 부모다. 전체를 켜면 나머지가 꺼지고,
    // 나머지를 켜면 전체가 꺼진다. 다 꺼지면 전체로 돌아온다.
    $$("[data-ac-sev]").forEach(function (box) {
      box.addEventListener("click", function () {
        var key = box.getAttribute("data-ac-sev");
        if (key === "all") {
          state.sev = { all: true, critical: false, warning: false };
        } else {
          state.sev[key] = !state.sev[key];
          state.sev.all = !state.sev.critical && !state.sev.warning;
        }
        $$("[data-ac-sev]").forEach(function (b) {
          b.setAttribute("aria-checked", state.sev[b.getAttribute("data-ac-sev")] ? "true" : "false");
        });
        state.picked = null;
        refresh();
      });
    });

    // 이전 · 다음
    $("[data-ac-prev]").addEventListener("click", function () { step(-1); });
    $("[data-ac-next]").addEventListener("click", function () { step(1); });

    // Select 세 개 — 고르면 거르거나 다시 정렬한다.
    selects({
      "ac-f-mission": function (v) { state.mission = v; },
      "ac-f-period": function (v) { state.period = v; },
      "ac-f-sort": function (v) { state.sort = v; }
    });

    statusMenus();
  }

  /*
   * Select 드롭다운 — app-shell.css 의 .field-select 짜임을 그대로 쓴다.
   * screen.js 에도 같은 코드가 있지만 그 파일은 통합 관제 메인 전용이라 여기 작게 다시 뒀다.
   */
  function selects(handlers) {
    var all = $$("[data-select]");

    function closeAll(except) {
      all.forEach(function (sel) {
        if (sel === except) { return; }
        sel.removeAttribute("data-open");
        $("[data-select-trigger]", sel).setAttribute("aria-expanded", "false");
        $(".field-menu", sel).hidden = true;
      });
    }

    all.forEach(function (sel) {
      var trigger = $("[data-select-trigger]", sel);
      var menu = $(".field-menu", sel);
      var value = $("[data-select-value]", sel);
      var onPick = null;
      Object.keys(handlers).forEach(function (cls) {
        if (sel.classList.contains(cls)) { onPick = handlers[cls]; }
      });

      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = sel.hasAttribute("data-open");
        closeAll(sel);
        if (open) { return; }
        sel.setAttribute("data-open", "");
        trigger.setAttribute("aria-expanded", "true");
        menu.hidden = false;
      });

      $$(".field-option", sel).forEach(function (opt) {
        opt.addEventListener("click", function () {
          value.textContent = opt.textContent;
          $$(".field-option", sel).forEach(function (o) { o.removeAttribute("aria-selected"); });
          opt.setAttribute("aria-selected", "true");
          closeAll();
          if (onPick) {
            onPick(opt.textContent);
            state.picked = null;
            refresh();
          }
        });
      });

      sel.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && sel.hasAttribute("data-open")) {
          closeAll();
          trigger.focus();
        }
      });
    });

    document.addEventListener("click", function () { closeAll(); });
  }

  /* Status Bar 의 Account · Signal 드롭다운 — app-shell.css 의 .status-menu 짜임이다. */
  function statusMenus() {
    var menus = $$("[data-status-menu]");

    function close(except) {
      menus.forEach(function (m) {
        if (m === except) { return; }
        $("[data-menu-trigger]", m).setAttribute("aria-expanded", "false");
        $(".dropdown-menu", m).hidden = true;
      });
    }

    menus.forEach(function (m) {
      var trigger = $("[data-menu-trigger]", m);
      var menu = $(".dropdown-menu", m);
      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = trigger.getAttribute("aria-expanded") === "true";
        close(m);
        trigger.setAttribute("aria-expanded", open ? "false" : "true");
        menu.hidden = open;
      });
    });

    document.addEventListener("click", function () { close(); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { close(); }
    });
  }

  // ==================================================================
  wire();
  refresh();
})();
