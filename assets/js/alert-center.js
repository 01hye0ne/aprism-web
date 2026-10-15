/*
 * 알림 센터 (SD-08).
 *
 *   미확인 탭      Figma 1177:15915 "B안 · 미확인 선택 상세"
 *   조치 완료 탭   Figma 1202:16151 "B안 · 조치 완료 기록 상세"
 *
 * 두 탭은 줄 모양도 오른쪽 칸도 다르다 —
 *   미확인은 "무엇이 났나"(단계 · 발생 · 위치 · 미션)를 보여 주고 조치를 입력받는다.
 *   조치 완료는 "무엇을 했나"(조치 시각 · 조치 내용 · 원 등급 · 담당)를 보여 주고 입력이 없다.
 * 조치 완료 목록은 조치한 날짜로 묶이고(오늘 · 어제 · 날짜), 탭마다 마지막으로 고른 항목을 따로 기억한다.
 *
 * screen.js 는 쓰지 않는다 — 통합 관제 메인 전용 코드가 대부분이고 이 화면에 없는 요소를 찾는다.
 * 필요한 조각(Status Bar 드롭다운 · Select)만 아래에 작게 두었다.
 *
 * 건수는 모두 데이터에서 센다. 1202 판이 적어 둔 숫자와 맞아떨어진다 —
 *   전체 22 = 미확인 11(위험 3 · 주의 8) + 조치 완료 11(위험 5 · 주의 6)
 *   등급 합계 = 위험 8 · 주의 14
 */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var SEV_LABEL = { critical: "위험", warning: "주의" };
  var SEV_ICON = { critical: "--ic-error", warning: "--ic-warning" };

  // 조치 완료 목록을 묶는 날짜. rank 가 큰 쪽이 위다.
  var DAYS = {
    today: { label: "오늘", rank: 3 },
    yesterday: { label: "어제", rank: 2 },
    "d-1011": { label: "10월 11일 (일)", rank: 1 }
  };

  // ==================================================================
  // 알림 데이터
  //
  // sev    위험(critical) · 주의(warning). 알림 정책을 따른다 — NG 판정 · 안전 감지는 위험,
  //        기준치를 넘은 이상징후(누출 · 농도 · 진동 · 과열 · 압력)는 주의다.
  // day    발생한 날. time 은 발생 시각이다.
  // live   스냅숏 그림(assets/img/alert-live-*.webp). 디자이너가 준 검출 캡처 세 장이라
  //        알림 내용과 딱 맞는 그림은 아니다 — v2.2 monitor.js 와 같은 사정이다.
  // lead   DELTA 조치 제안 한 줄. why 는 근거, fp 는 오탐 가능성(%)이다.
  // acts   조치 내용 선택지. delta:true 가 DELTA 추천이다.
  // done   조치가 끝난 알림. done.day 는 "조치한" 날이라 발생한 날과 다를 수 있다
  //        (어제 23:51 에 난 알림을 오늘 08:33 에 조치한 B-3 이 그렇다).
  // ==================================================================
  var ALERTS = [
    /* ---- 미확인 11건 (위험 3 · 주의 8) ---- */
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

    /* 농도가 기준을 넘은 이상징후다 — 알림 정책상 주의다(NG 판정만 위험).
       1177 판에서는 "가스 누출 경보"(위험)였는데, 1202 판의 등급 합계(미확인 위험 3)에 맞추면서
       정책에도 맞는 쪽으로 돌렸다. */
    { id: "A-4", sev: "warning", day: "yesterday", time: "어제 20:47", stamp: "2026-10-12 20:47:03",
      title: "가스 농도 기준 초과", wp: "WP-09", place: "옥외 저장탱크 T-3 밸브실",
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

    /* ---- 조치 완료 11건 (위험 5 · 주의 6) — Figma 1202:16199 Done List ---- */
    { id: "B-1", sev: "critical", day: "today", time: "09:48:12", stamp: "2026-10-13 09:48:12",
      title: "안전모 미착용 작업자 감지", wp: "WP-10", place: "지하발전소 B3 작업구역",
      mission: "B3 터빈 정기점검", detect: "안전감지", robot: "R-07 · CAM-13", live: "ppe",
      done: { day: "today", at: "09:54", by: "김현대", took: "발생 후 6분",
              picked: ["전화 안내", "안전모 착용 확인"], memo: "작업반장 통화 · 즉시 착용 확인",
              delta: "AI 추천 그대로 사용 (전화 안내 · 안전모 착용 확인)" } },

    { id: "B-2", sev: "critical", day: "today", time: "09:36:40", stamp: "2026-10-13 09:36:40",
      title: "위험 구역 내 작업자 체류", wp: "WP-11", place: "지하발전소 B3 방호문 안쪽",
      mission: "B3 설비 순회", detect: "안전감지", robot: "R-05 · CAM-04", live: "ppe",
      done: { day: "today", at: "09:41", by: "홍길동", took: "발생 후 5분",
              picked: ["작업 중지 요청", "현장 확인"], memo: "설비 2팀 자재 반입 중 · 통제선 재설치",
              delta: "AI 추천 그대로 사용 (작업 중지 요청 · 현장 확인)" } },

    { id: "B-3", sev: "critical", day: "yesterday", time: "어제 23:51", stamp: "2026-10-12 23:51:07",
      title: "작업자 쓰러짐 의심", wp: "WP-15", place: "지하발전소 B4 펌프실",
      mission: "B3 설비 순회", detect: "안전감지", robot: "R-05 · CAM-09", live: "deid",
      done: { day: "today", at: "08:33", by: "김현대", took: "발생 후 8시간 42분",
              picked: ["현장 확인", "전화 안내"],
              memo: "야간 무인 구간 · 교대 인수 뒤 현장 확인. 쪼그려 작업으로 확인됨",
              delta: "AI 추천 가운데 일부만 사용 (현장 확인)" } },

    { id: "B-4", sev: "warning", day: "today", time: "09:20:11", stamp: "2026-10-13 09:20:11",
      title: "안전화 미착용 감지", wp: "WP-10", place: "지하발전소 B3 작업구역",
      mission: "B3 터빈 정기점검", detect: "안전감지", robot: "R-07 · CAM-13", live: "ppe",
      done: { day: "today", at: "09:26", by: "이수진", took: "발생 후 6분",
              picked: ["전화 안내", "보호구 착용 확인"], memo: "",
              delta: "AI 추천 그대로 사용 (전화 안내 · 보호구 착용 확인)" } },

    { id: "B-5", sev: "warning", day: "today", time: "09:19:35", stamp: "2026-10-13 09:19:35",
      title: "소화기 지정 위치 이탈", wp: "WP-13", place: "지하발전소 B3 계단참",
      mission: "B3 설비 순회", detect: "외관검사", robot: "R-05 · CAM-02", live: "discharge",
      done: { day: "today", at: "09:26", by: "이수진", took: "발생 후 7분",
              picked: ["현장 확인", "설비 담당 전달"], memo: "청소 중 이동 · 원위치 완료",
              delta: "AI 추천 그대로 사용 (현장 확인 · 설비 담당 전달)" } },

    { id: "B-6", sev: "warning", day: "today", time: "08:52:49", stamp: "2026-10-13 08:52:49",
      title: "배관 결로 과다", wp: "WP-03", place: "지하발전소 B3 냉각수 배관",
      mission: "B3 터빈 정기점검", detect: "누출감지", robot: "R-07 · CAM-06", live: "discharge",
      done: { day: "today", at: "09:02", by: "홍길동", took: "발생 후 10분",
              picked: ["오탐 처리"], memo: "누출 아님 · 결로로 확인",
              delta: "AI 추천을 쓰지 않음 (추천: 현장 점검 요청)" } },

    { id: "B-7", sev: "critical", day: "yesterday", time: "어제 16:05", stamp: "2026-10-12 16:05:22",
      title: "출입 제한구역 무단 진입 감지", wp: "WP-17", place: "지하발전소 B4 고압반실",
      mission: "B3 전기실 순회", detect: "안전감지", robot: "R-02 · CAM-11", live: "ppe",
      done: { day: "yesterday", at: "16:07", by: "홍길동", took: "발생 후 2분",
              picked: ["작업 중지 요청"], memo: "협력사 인원 · 출입 교육 재안내",
              delta: "AI 추천 그대로 사용 (작업 중지 요청)" } },

    { id: "B-8", sev: "warning", day: "yesterday", time: "어제 18:40", stamp: "2026-10-12 18:40:16",
      title: "진동 센서 값 상승", wp: "WP-12", place: "지하발전소 B3 냉각 펌프",
      mission: "B3 터빈 정기점검", detect: "진동측정", robot: "R-07 · CAM-08", live: "discharge",
      done: { day: "yesterday", at: "18:52", by: "이수진", took: "발생 후 12분",
              picked: ["설비 담당 전달"], memo: "",
              delta: "AI 추천 그대로 사용 (설비 담당 전달)" } },

    { id: "B-9", sev: "warning", day: "yesterday", time: "어제 14:27", stamp: "2026-10-12 14:27:58",
      title: "바닥 물고임 감지", wp: "WP-15", place: "지하발전소 B4 펌프실",
      mission: "B3 설비 순회", detect: "외관검사", robot: "R-05 · CAM-09", live: "discharge",
      done: { day: "yesterday", at: "14:40", by: "김현대", took: "발생 후 13분",
              picked: ["현장 확인"], memo: "배수구 막힘 · 청소 요청",
              delta: "AI 추천 가운데 일부만 사용 (현장 확인)" } },

    { id: "B-10", sev: "critical", day: "d-1011", time: "09:02:31", stamp: "2026-10-11 09:02:31",
      title: "가스 농도 경보 연동", wp: "WP-09", place: "옥외 저장탱크 T-3 밸브실",
      mission: "옥외 저장탱크 순찰", detect: "가스감지", robot: "R-03 · CAM-01", live: "discharge",
      done: { day: "d-1011", at: "09:05", by: "홍길동", took: "발생 후 3분",
              picked: ["현장 확인", "작업 중지 요청"], memo: "고정식 감지기 경보와 동시 · 환기 뒤 정상",
              delta: "AI 추천 그대로 사용 (현장 확인 · 작업 중지 요청)" } },

    { id: "B-11", sev: "warning", day: "d-1011", time: "11:13:04", stamp: "2026-10-11 11:13:04",
      title: "안전모 미착용 작업자 감지", wp: "WP-04", place: "옥외 저장탱크 T-3 계단",
      mission: "옥외 저장탱크 순찰", detect: "안전감지", robot: "R-03 · CAM-05", live: "ppe",
      done: { day: "d-1011", at: "11:15", by: "이수진", took: "발생 후 2분",
              picked: ["전화 안내", "보호구 착용 확인"], memo: "",
              delta: "AI 추천 그대로 사용 (전화 안내 · 보호구 착용 확인)" } }
  ];

  /*
   * DELTA 인수인계 요약 — Figma 1202:16192. 조치 완료 탭에서만 뜬다.
   * 숫자와 웨이포인트는 위 데이터와 맞아떨어진다 —
   * 오늘 조치 6건(위험 3), 보호구 미착용 3회, 미확인 위험 3건(WP-07 2건 · WP-02).
   */
  var HANDOVER = {
    when: "오늘 08:00–10:15 · 조치 6건 기준",
    items: [
      ["조치", "오늘 6건 조치 · 위험 3건 · 평균 6분"],
      ["반복", "보호구 미착용 3회 (B3 작업구역 · T-3 계단). 작업 전 안내가 필요해 보여요"],
      ["남은 위험", "미확인 위험 3건: WP-07 2건 · WP-02. 탱크 T-3 외벽 균열은 어제부터 남아 있어요"],
      ["다음 근무", "옥외 저장탱크 순찰(가스 농도 · 난간 개방) 묶음을 먼저 확인해 주세요"]
    ]
  };

  // ==================================================================
  // 상태 — 고른 항목은 탭마다 따로 기억한다
  // (Figma 설명: "탭마다 마지막으로 선택한 항목을 따로 기억한다").
  // ==================================================================
  var state = {
    tab: "open",
    mission: "전체 미션",
    period: "전체 기간",
    sort: "위험 우선",
    sev: { all: true, critical: false, warning: false },
    picked: { open: null, done: null },
    chosen: {},
    memo: {},
    handover: true
  };

  function isDone(a) { return !!a.done; }
  function inTab(a) { return state.tab === "done" ? isDone(a) : !isDone(a); }
  function dayOf(a) { return a.done ? a.done.day : a.day; }
  function picked() { return state.picked[state.tab]; }
  function setPicked(id) { state.picked[state.tab] = id; }

  // 정렬 열쇠 — 미확인은 발생 시각, 조치 완료는 조치 시각으로 센다.
  function order(a) {
    var t = a.done ? a.done.at : a.time;
    var m = t.match(/(\d{1,2}):(\d{2})/) || [0, 0, 0];
    return (dayOf(a) === "today" ? 10000 : 0) + Number(m[1]) * 100 + Number(m[2]);
  }

  function dayRank(a) { return (DAYS[dayOf(a)] || { rank: 0 }).rank; }

  var SORT = {
    "위험 우선": function (a, b) {
      if (a.sev !== b.sev) { return a.sev === "critical" ? -1 : 1; }
      return order(b) - order(a);
    },
    "최신순": function (a, b) { return order(b) - order(a); },
    "오래된순": function (a, b) { return order(a) - order(b); }
  };

  function visible() {
    var rule = SORT[state.sort] || SORT["위험 우선"];
    var list = ALERTS.filter(function (a) {
      if (!inTab(a)) { return false; }
      if (state.mission !== "전체 미션" && a.mission !== state.mission) { return false; }
      if (state.period === "오늘" && dayOf(a) !== "today") { return false; }
      if (!state.sev.all) {
        if (a.sev === "critical" && !state.sev.critical) { return false; }
        if (a.sev === "warning" && !state.sev.warning) { return false; }
      }
      return true;
    });
    // 조치 완료는 조치한 날짜로 먼저 묶고 그 안에서 정렬한다. 미확인은 날짜 구분 없이 한 줄기다.
    list.sort(function (a, b) {
      if (state.tab === "done") {
        var d = dayRank(b) - dayRank(a);
        if (d) { return d; }
      }
      return rule(a, b);
    });
    return list;
  }

  function countBy(sev, done) {
    return ALERTS.filter(function (a) { return a.sev === sev && isDone(a) === done; }).length;
  }

  function icon(name, size) {
    return '<span class="i i-' + size + '" style="--i:var(' + name + ')" aria-hidden="true"></span>';
  }

  // ==================================================================
  // 그리기 — 열 머리 · 목록
  // ==================================================================
  var colHead = $("[data-ac-colhead]");
  var list = $("[data-ac-list]");
  var detail = $("[data-ac-detail]");
  var slot = $("[data-ac-handover]");

  // 두 탭은 열이 다르다 — 미확인은 "무엇이 났나", 조치 완료는 "무엇을 했나" 쪽이다.
  function renderColHead() {
    colHead.innerHTML = state.tab === "done"
      ? '<span class="ac-dc-check" role="columnheader"><span class="ac-sr">상태</span></span>' +
        '<span class="ac-dc-time" role="columnheader">조치</span>' +
        '<span class="ac-dc-body" role="columnheader">알림 · 조치 내용</span>' +
        '<span class="ac-dc-sev" role="columnheader">원 등급 · 발생</span>' +
        '<span class="ac-dc-who" role="columnheader">담당</span>'
      : '<span class="ac-c-sev" role="columnheader"><span class="ac-sr">단계</span></span>' +
        '<span class="ac-c-time" role="columnheader">발생</span>' +
        '<span class="ac-c-title" role="columnheader">알림</span>' +
        '<span class="ac-c-place" role="columnheader">웨이포인트 · 위치</span>' +
        '<span class="ac-c-mission" role="columnheader">미션</span>' +
        '<span class="ac-c-act" role="columnheader"><span class="ac-sr">동작</span></span>';
  }

  /*
   * 줄은 role="row" 다. 줄 안에 버튼이 들어가므로 줄 자체를 button 으로 두면
   * button 안에 button 이 된다 — grid 짜임으로 두고 줄에 tabindex 를 준다.
   */
  function openRow(a, sel) {
    return '<div class="ac-row" role="row" data-id="' + a.id + '" data-sev="' + a.sev + '"' +
        ' tabindex="' + (sel ? "0" : "-1") + '" aria-selected="' + (sel ? "true" : "false") + '">' +
        '<span class="ac-stripe" aria-hidden="true"></span>' +
        '<span class="ac-c-sev" role="gridcell">' + icon(SEV_ICON[a.sev], 16) +
          '<span class="ac-sr">' + SEV_LABEL[a.sev] + '</span></span>' +
        '<span class="ac-c-time ac-mono" role="gridcell">' + esc(a.time) + '</span>' +
        '<span class="ac-c-title t-label-1" role="gridcell">' + esc(a.title) + '</span>' +
        '<span class="ac-c-place" role="gridcell">' +
          '<span class="ac-wp ac-mono-label">' + esc(a.wp) + '</span>' +
          '<span class="ac-place t-body-4">' + esc(a.place) + '</span>' +
        '</span>' +
        '<span class="ac-c-mission t-caption" role="gridcell">' + esc(a.mission) + '</span>' +
        '<span class="ac-c-act" role="gridcell">' +
          '<button type="button" class="btn btn-ghost is-xs" data-report>보고서</button>' +
        '</span>' +
      '</div>';
  }

  /*
   * 조치 완료 줄 — Figma 1202:16057. 왼쪽 단계 띠가 없다(끝난 일이라 목록에서 단계로 외칠 까닭이 없다).
   * 대신 체크 표시가 서고, 단계는 "원 등급 · 발생" 칸에 점 + 글자로 조용히 남는다.
   */
  /*
   * "원 등급 · 발생" 칸에는 초를 떼고 적는다. 끝 두 자리만 떼면 "어제 23:51" 이 "어제 23" 이 되므로
   * HH:MM:SS 꼴일 때만 떼고, "어제 23:51" 처럼 이미 짧은 것은 그대로 둔다.
   */
  function shortTime(t) { return t.replace(/^(\d{1,2}:\d{2}):\d{2}$/, "$1"); }

  function doneRow(a, sel) {
    var d = a.done;
    return '<div class="ac-done-row" role="row" data-id="' + a.id + '" data-sev="' + a.sev + '"' +
        ' tabindex="' + (sel ? "0" : "-1") + '" aria-selected="' + (sel ? "true" : "false") + '">' +
        '<span class="ac-dc-check" role="gridcell">' + icon("--ic-check", 16) +
          '<span class="ac-sr">조치 완료</span></span>' +
        '<span class="ac-dc-time ac-mono" role="gridcell">' + esc(d.at) + '</span>' +
        '<span class="ac-dc-body" role="gridcell">' +
          '<span class="ac-dc-title t-label-2">' + esc(a.title) + '</span>' +
          '<span class="ac-dc-act t-caption">' + esc(d.picked.join(", ")) + '</span>' +
        '</span>' +
        '<span class="ac-dc-sev t-caption" role="gridcell">' +
          '<span class="ac-sev-dot" aria-hidden="true"></span>' +
          '<span>' + SEV_LABEL[a.sev] + " " + esc(shortTime(a.time)) + '</span>' +
        '</span>' +
        '<span class="ac-dc-who t-caption" role="gridcell">' + esc(d.by) + '</span>' +
      '</div>';
  }

  function renderList() {
    var rows = visible();
    renderColHead();
    slot.hidden = !(state.tab === "done" && state.handover);

    if (!rows.length) {
      list.innerHTML = '<p class="ac-empty t-body-3">조건에 맞는 알림이 없습니다.</p>';
      renderNth(rows);
      return;
    }

    var html = "";
    var day = null;
    rows.forEach(function (a) {
      // 조치 완료는 날짜가 바뀌는 자리마다 날짜 머리가 들어간다(Figma Date 1202:16048).
      if (state.tab === "done" && dayOf(a) !== day) {
        day = dayOf(a);
        var n = rows.filter(function (x) { return dayOf(x) === day; }).length;
        html += '<div class="ac-date-row" role="row">' +
          '<span class="t-label-2" role="gridcell">' + esc(DAYS[day].label) + '</span>' +
          '<span class="ac-date-count ac-mono" role="gridcell">' + n + '</span>' +
        '</div>';
      }
      html += state.tab === "done" ? doneRow(a, a.id === picked()) : openRow(a, a.id === picked());
    });
    list.innerHTML = html;

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
      var report = $(".btn", row);
      if (report) { report.addEventListener("click", function (e) { e.stopPropagation(); }); }
    });

    renderNth(rows);
  }

  function renderNth(rows) {
    rows = rows || visible();
    var i = rows.findIndex(function (a) { return a.id === shown(); });
    $("[data-ac-nth]").textContent = rows.length ? (i + 1) + " / " + rows.length : "0 / 0";
    $("[data-ac-prev]").disabled = i <= 0;
    $("[data-ac-next]").disabled = i < 0 || i >= rows.length - 1;
  }

  function step(delta) {
    var rows = visible();
    var i = rows.findIndex(function (a) { return a.id === picked(); });
    var next = rows[i + delta];
    if (next) { pick(next.id); }
  }

  /*
   * 손을 얹은 줄 — 고른 줄과 다른 것이다. 미리 보여 주기만 하고 고르지는 않는다.
   * 그래서 왼쪽의 선택 표시(aria-selected)와 state.picked 는 건드리지 않는다.
   * 오른쪽 칸이 지금 무엇을 그리는지는 늘 shown() 하나로 답한다.
   */
  var hoverId = null;
  var hoverTimer = null;

  function shown() { return hoverId || picked(); }

  function preview(id) {
    clearTimeout(hoverTimer);
    if (id === shown()) { return; }
    // 오른쪽 칸 안에 포커스가 있으면(메모를 치는 중) 지우지 않는다.
    if (detail.contains(document.activeElement)) { return; }
    // 목록을 빠르게 훑고 지나갈 때 줄마다 다시 그리지 않도록 조금 기다린다.
    hoverTimer = setTimeout(function () {
      hoverId = id;
      renderNth();
      renderDetail();
    }, 60);
  }

  function previewOff() {
    clearTimeout(hoverTimer);
    if (hoverId === null) { return; }
    hoverId = null;
    renderNth();
    renderDetail();
  }

  function pick(id) {
    clearTimeout(hoverTimer);
    hoverId = null;
    setPicked(id);
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
  // 그리기 — 오른쪽 칸
  // ==================================================================
  function alertOf(id) {
    return ALERTS.filter(function (a) { return a.id === id; })[0] || null;
  }

  function refresh() {
    clearTimeout(hoverTimer);
    hoverId = null;
    var rows = visible();
    if (!picked() || !rows.some(function (a) { return a.id === picked(); })) {
      setPicked(rows.length ? rows[0].id : null);
    }
    renderCounts();
    renderList();
    renderDetail();
  }

  function renderDetail() {
    var a = alertOf(shown());
    if (!a) {
      detail.innerHTML = '<p class="ac-empty t-body-3">' +
        (visible().length ? "왼쪽 목록에서 알림을 고르세요." : "표시할 알림이 없습니다.") + '</p>';
      return;
    }
    detail.innerHTML = a.done ? recordHtml(a) : openHtml(a);
    if (!a.done) { wireDetail(a); }
    watchFade($(a.done ? ".ac-record" : ".ac-detail-contents", detail));
  }

  /*
   * 스크롤 칸 아래쪽 흐림을 붙이고 상태를 따라간다 — 끝까지 내려가면 .is-end 로 지운다.
   * 창 크기가 바뀌면 넘침 여부도 바뀌므로 지금 칸의 갱신 함수를 들고 있다가 다시 부른다.
   */
  var fadeUpdate = null;

  function watchFade(box) {
    fadeUpdate = null;
    if (!box) { return; }
    var fade = document.createElement("div");
    fade.className = "ac-scroll-fade";
    fade.setAttribute("aria-hidden", "true");
    box.appendChild(fade);

    fadeUpdate = function () {
      box.classList.toggle("is-end", box.scrollTop + box.clientHeight >= box.scrollHeight - 1);
    };
    box.addEventListener("scroll", fadeUpdate, { passive: true });
    fadeUpdate();
  }

  window.addEventListener("resize", function () { if (fadeUpdate) { fadeUpdate(); } });

  function metaRow(label, value) {
    return '<div class="ac-d-meta-row"><dt class="t-caption">' + label + '</dt>' +
           '<dd>' + value + '</dd></div>';
  }

  function snapMeta(a, rows) {
    return '<div class="ac-d-snap-meta">' +
      '<figure class="ac-d-snap">' +
        '<img src="../assets/img/alert-live-' + a.live + '.webp" alt="' + esc(a.title) + ' 검출 장면" />' +
      '</figure>' +
      '<dl class="ac-d-meta">' + rows + '</dl>' +
    '</div>';
  }

  function sevBadge(a, prefix) {
    return '<span class="ac-sev-badge t-label-2' + (a.sev === "warning" ? " is-warning" : "") + '">' +
      '<span class="badge-dot" aria-hidden="true"></span>' + prefix + SEV_LABEL[a.sev] + '</span>';
  }

  /* ── 미확인 — 조치를 입력받는 판 (Figma 1177:15981) ───────── */
  function openHtml(a) {
    var chosen = state.chosen[a.id] || [];
    return '<div class="ac-detail-contents">' +
        '<div class="ac-d-title-block">' +
          '<p class="ac-d-age t-caption">' + esc(a.stamp) + ' 발생</p>' +
          '<div class="ac-d-title-row">' + sevBadge(a, "") +
            '<h2 class="t-title-1">' + esc(a.title) + '</h2>' +
          '</div>' +
        '</div>' +
        snapMeta(a,
          metaRow("미션", '<span class="t-body-4">' + esc(a.mission) + '</span>') +
          metaRow("위치",
            '<span class="ac-mono-label">' + esc(a.wp) + '</span>' +
            '<span class="t-body-4">' + esc(a.place) + '</span>' +
            '<a class="t-caption" href="./main-v2-2.html">지도에서 보기</a>') +
          metaRow("감지", '<span class="ac-d-chip t-caption">' + esc(a.detect) + '</span>') +
          metaRow("로봇", '<span class="ac-d-robot ac-mono">' + esc(a.robot) + '</span>')) +
        deltaCard(a) +
        actsBlock(a, chosen) +
        memoBlock(a) +
      '</div>' +
      actionsRow(a, chosen);
  }

  function deltaCard(a) {
    return '<section class="ac-delta">' +
      '<div class="ac-delta-mark">' + icon("--ic-cpu", 16) +
        '<span class="t-label-2">DELTA 조치 제안</span></div>' +
      '<h3 class="t-title-2">' + esc(a.lead) + '</h3>' +
      '<ul class="ac-delta-reasons">' +
        a.why.map(function (w) { return '<li class="t-body-4">' + esc(w) + '</li>'; }).join("") +
      '</ul>' +
      '<div class="ac-fp" style="--ac-fp:' + a.fp + '%">' +
        '<span class="ac-fp-label t-caption">오탐 가능성</span>' +
        '<span class="ac-fp-meter" role="img" aria-label="오탐 가능성 ' + a.fp + '퍼센트"><i></i></span>' +
        '<span class="ac-fp-value"><b class="t-label-2">' + a.fpLabel + '</b>' +
          '<span class="t-caption">' + a.fp + '%</span></span>' +
      '</div>' +
    '</section>';
  }

  function actsBlock(a, chosen) {
    var hasDelta = a.acts.some(function (c) { return c.delta; });
    return '<section class="ac-acts">' +
      '<div class="ac-acts-head">' +
        '<h3 class="t-label-1">조치 내용 (여러 개 선택 가능)</h3>' +
        (hasDelta ? '<span class="badge t-caption"><span class="badge-dot" aria-hidden="true"></span>DELTA 추천</span>' : "") +
      '</div>' +
      '<div class="ac-presets">' +
        a.acts.map(function (c) {
          var on = chosen.indexOf(c.t) > -1;
          return '<button type="button" class="ac-capsule" data-act="' + esc(c.t) + '"' +
            (c.delta ? ' data-delta' : "") + ' aria-pressed="' + (on ? "true" : "false") + '">' +
            esc(c.t) +
          '</button>';
        }).join("") +
      '</div>' +
    '</section>';
  }

  function memoBlock(a) {
    return '<section class="ac-memo field">' +
      '<label class="field-label" for="ac-memo">메모 (선택)</label>' +
      '<textarea id="ac-memo" data-ac-memo maxlength="500" ' +
        'placeholder="현장에 전달한 내용을 적어 주세요">' + esc(state.memo[a.id] || "") + '</textarea>' +
      '<span class="field-helper t-caption">교대 인수인계에 필요한 내용을 남깁니다. 최대 500자.</span>' +
    '</section>';
  }

  function actionsRow(a, chosen) {
    var hasDraft = chosen.length > 0 || !!state.memo[a.id];
    return '<div class="ac-actions">' +
      '<span class="ac-head-spacer"></span>' +
      '<p class="ac-draft t-caption" data-ac-draft' + (hasDraft ? "" : " hidden") + '>임시저장된 상태</p>' +
      '<button type="button" class="btn btn-accent is-md" data-ac-done' +
        (chosen.length ? "" : " disabled") + '>조치 완료</button>' +
    '</div>';
  }

  /* ── 조치 완료 — 기록만 읽는 판 (Figma 1202:16214) ────────── */
  /*
   * 입력이 없다. 끝난 일이라 조치 시각 · 담당 · 소요가 제목 바로 아래 오고(미확인 판은 발생 시각이
   * 제목 위에 온다 — 거기서는 "언제 났나"가, 여기서는 "언제 끝냈나"가 먼저다),
   * 아래로 조치 내용 · 메모 · 처리 정보가 쌓인다. 아래 동작 줄이 없다.
   */
  function recordHtml(a) {
    var d = a.done;
    return '<div class="ac-record">' +
      '<div class="ac-record-title">' +
        '<div class="ac-record-title-row">' + sevBadge(a, "원 등급 ") +
          '<h2 class="t-title-1">' + esc(a.title) + '</h2>' +
        '</div>' +
        '<p class="ac-record-age">' +
          '<span class="ac-record-at t-label-1">' + esc(DAYS[d.day].label) + ' ' + esc(d.at) + '</span>' +
          '<span class="ac-record-by t-caption">조치 · ' + esc(d.by) + ' · ' + esc(d.took) + '</span>' +
        '</p>' +
      '</div>' +
      snapMeta(a,
        metaRow("발생", '<span class="ac-mono">' + esc(a.stamp) + '</span>') +
        metaRow("미션", '<span class="t-body-4">' + esc(a.mission) + '</span>') +
        metaRow("위치",
          '<span class="ac-mono-label">' + esc(a.wp) + '</span>' +
          '<span class="t-body-4">' + esc(a.place) + '</span>') +
        metaRow("감지", '<span class="ac-d-chip t-caption">' + esc(a.detect) + '</span>') +
        metaRow("로봇", '<span class="ac-d-robot ac-mono">' + esc(a.robot) + '</span>')) +

      '<section class="ac-record-section">' +
        '<h3 class="t-caption">조치 내용</h3>' +
        '<div class="ac-chips">' +
          d.picked.map(function (t) {
            return '<span class="ac-chip-done t-label-2">' + esc(t) + '</span>';
          }).join("") +
        '</div>' +
      '</section>' +

      '<section class="ac-record-section">' +
        '<h3 class="t-caption">메모</h3>' +
        '<p class="ac-memo-box t-body-4' + (d.memo ? "" : " ac-memo-empty") + '">' +
          (d.memo ? esc(d.memo) : "남긴 메모가 없습니다.") + '</p>' +
      '</section>' +

      '<section class="ac-record-section">' +
        '<h3 class="t-caption">처리 정보</h3>' +
        '<dl class="ac-info">' +
          infoRow("담당", '<span class="t-body-4">' + esc(d.by) + '</span>') +
          infoRow("소요", '<span class="t-body-4">' + esc(d.took) + '</span>') +
          infoRow("DELTA", '<span class="ac-info-delta t-body-4">' + esc(d.delta) + '</span>') +
        '</dl>' +
      '</section>' +
    '</div>';
  }

  function infoRow(label, value) {
    return '<div class="ac-info-row"><dt class="t-caption">' + label + '</dt><dd>' + value + '</dd></div>';
  }

  /*
   * 조치를 고르거나 메모를 칠 때 바뀌는 것은 둘뿐이다 — 임시저장 표시와 [조치 완료] 의 켜짐.
   * 그 둘만 손댄다. 판을 통째로 다시 그리면 상세 칸이 새 DOM 이 되면서 스크롤이 맨 위로 튀고
   * 누른 캡슐에서 포커스가 빠진다.
   */
  function syncActions(a) {
    var chosen = state.chosen[a.id] || [];
    var draft = $("[data-ac-draft]", detail);
    var btn = $("[data-ac-done]", detail);
    if (draft) { draft.hidden = !(chosen.length || state.memo[a.id]); }
    if (btn) { btn.disabled = !chosen.length; }
  }

  function wireDetail(a) {
    $$("[data-act]", detail).forEach(function (cap) {
      cap.addEventListener("click", function () {
        var t = cap.getAttribute("data-act");
        var cur = state.chosen[a.id] || [];
        var i = cur.indexOf(t);
        if (i > -1) { cur.splice(i, 1); } else { cur = cur.concat([t]); }
        state.chosen[a.id] = cur;
        cap.setAttribute("aria-pressed", i > -1 ? "false" : "true");
        syncActions(a);
      });
    });

    var memo = $("[data-ac-memo]", detail);
    if (memo) {
      memo.addEventListener("input", function () {
        state.memo[a.id] = memo.value;
        syncActions(a);
      });
    }

    var btn = $("[data-ac-done]", detail);
    if (btn) {
      btn.addEventListener("click", function () {
        var acts = (state.chosen[a.id] || []).slice();
        a.done = { day: "today", at: nowHM(), by: "홍길동", took: "방금",
                   picked: acts, memo: state.memo[a.id] || "", delta: deltaUse(a, acts) };
        delete state.chosen[a.id];
        delete state.memo[a.id];
        setPicked(null);
        refresh();
      });
    }
  }

  // 처리 정보의 "DELTA" 줄 — 고른 조치가 추천과 얼마나 겹치는지로 적는다.
  function deltaUse(a, acts) {
    var rec = a.acts.filter(function (c) { return c.delta; }).map(function (c) { return c.t; });
    var used = rec.filter(function (t) { return acts.indexOf(t) > -1; });
    if (!used.length) { return "AI 추천을 쓰지 않음 (추천: " + rec.join(" · ") + ")"; }
    if (used.length === rec.length) { return "AI 추천 그대로 사용 (" + rec.join(" · ") + ")"; }
    return "AI 추천 가운데 일부만 사용 (" + used.join(" · ") + ")";
  }

  function nowHM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ==================================================================
  // 그리기 — 건수 · 인수인계 요약
  // ==================================================================
  function renderCounts() {
    var openCrit = countBy("critical", false), openWarn = countBy("warning", false);
    var doneCrit = countBy("critical", true), doneWarn = countBy("warning", true);
    var open = openCrit + openWarn, closed = doneCrit + doneWarn;

    $("[data-ac-open-badge]").textContent = "미확인 " + open + "건";
    $("[data-ac-count-open]").textContent = open + "건";
    $("[data-ac-count-done]").textContent = closed + "건";

    // 탭 옆 배지는 그 탭의 단계별 건수다.
    $("[data-ac-badge-crit]").textContent = "위험 " + (state.tab === "done" ? doneCrit : openCrit);
    $("[data-ac-badge-warn]").textContent = "주의 " + (state.tab === "done" ? doneWarn : openWarn);

    // 등급 필터는 두 탭을 합친 전체 건수다.
    $("[data-ac-f-all]").textContent = "전체 " + ALERTS.length;
    $("[data-ac-f-crit]").textContent = "위험 " + (openCrit + doneCrit);
    $("[data-ac-f-warn]").textContent = "주의 " + (openWarn + doneWarn);

    // [오늘 조치 요약 만들기] 는 조치 완료 탭에만 선다 — 끝난 조치를 묶는 일이다.
    $("[data-ac-summary]").hidden = state.tab !== "done";
  }

  function renderHandover() {
    slot.innerHTML = '<section class="ac-handover">' +
      '<div class="ac-handover-head">' +
        '<span class="ac-handover-mark">' + icon("--ic-cpu", 16) +
          '<span class="t-label-2">DELTA 인수인계 요약</span></span>' +
        '<span class="ac-handover-when t-caption">' + esc(HANDOVER.when) + '</span>' +
        '<span class="ac-head-spacer"></span>' +
        '<button type="button" class="btn btn-ghost is-xs" data-ac-handover-close>닫기</button>' +
      '</div>' +
      '<dl class="ac-handover-list">' +
        HANDOVER.items.map(function (it) {
          return '<div class="ac-handover-row">' +
            '<dt class="t-label-2">' + esc(it[0]) + '</dt>' +
            '<dd class="t-body-4">' + esc(it[1]) + '</dd></div>';
        }).join("") +
      '</dl>' +
      '<div class="ac-handover-actions">' +
        '<button type="button" class="btn btn-secondary is-xs">초안 수정</button>' +
        '<button type="button" class="btn btn-primary is-xs">보고서에 넣기</button>' +
      '</div>' +
    '</section>';

    $("[data-ac-handover-close]", slot).addEventListener("click", function () {
      state.handover = false;
      slot.hidden = true;
    });
  }

  // ==================================================================
  // 조작 걸기
  // ==================================================================
  function wire() {
    $$("[data-ac-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.tab = tab.getAttribute("data-ac-tab");
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
        setPicked(null);
        refresh();
      });
    });

    /*
     * 줄에 손을 얹으면 오른쪽 칸이 먼저 바뀐다. 줄마다 거는 대신 목록에 한 번만 걸어
     * 다시 그려도 살아 있게 한다. 날짜 머리(data-id 가 없다) 위를 지날 때는 직전에
     * 보던 것을 그대로 둔다 — 지나가다 한 번 깜빡이는 쪽이 더 거슬린다.
     */
    list.addEventListener("mouseover", function (event) {
      var row = event.target.closest("[data-id]");
      if (row) { preview(row.getAttribute("data-id")); }
    });
    list.addEventListener("mouseleave", previewOff);

    $("[data-ac-prev]").addEventListener("click", function () { step(-1); });
    $("[data-ac-next]").addEventListener("click", function () { step(1); });

    $("[data-ac-summary]").addEventListener("click", function () {
      state.handover = true;
      renderHandover();
      slot.hidden = false;
    });

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
        // 자기 것까지 모두 닫는다. closeAll(sel) 로 자기를 빼면 열려 있던 것이 안 닫혀
        // 한 번 연 뒤에는 다시 눌러도 접히지 않는다.
        closeAll();
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
            setPicked(null);
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
  renderHandover();
  refresh();
})();
