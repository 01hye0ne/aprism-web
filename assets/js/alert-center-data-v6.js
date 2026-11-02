/*
 * [11/02 v6] 알림 센터 데이터 — v6 관제 · 안전진단과 같은 알림. alert-center-v6.html 만 싣는다(예전 판은 alert-center.js 안의 데이터 그대로).
 *
 *   미확인 12건 = v6 관제 최신 알림 12건(monitor.js CRITICAL · WARNINGS · R01_MORE · ROUTE_ALERTS, v6 덮어쓰기까지)과 1:1.
 *     정기 순회 점검(Robot 01 · B4) 6 · 발전기실 설비 점검(Robot 05 · B3/B4) 4 · 전기실 열화상 점검(Robot 11 · B3) 2 → 위험 3 · 주의 9.
 *     title 은 관제 데이터의 원문(alert-text-v6.js 표의 열쇠)이다 — 화면에는 "감지 · 측정 항목 + 값"으로 바꿔 보인다.
 *     시각 · 웨이포인트 · 감지 · DELTA 문장 · 조치 · 오탐 가능성은 관제 팝오버 값, 검출 그림도 팝오버와 같은 장(assets/img/alert/).
 *   res   [측정 항목, 값] — 팝오버 · 안전진단 상세의 제목. 값만 단계색이다. ch 는 측정 채널(위치 줄 끝).
 *   why   DELTA 판의 근거 줄(관제 알림 요약 · 안전진단 기준 · 연관 감지에서 뽑았다).
 *   조치 요청됨 14건 = 오늘 5건(관제 "오늘 확인 완료" 기본 기록과 같다) + 지난 이틀(어제 · 8/24) 9건.
 *     어제 09:00 발전기 베어링 기록은 안전진단 상세의 지난 순회 줄(08/25 09:00 주의 · 09:14 부하 감소 요청)과 같다.
 *     미션은 v6 탭 여섯 개, 감지는 안전진단 6종, 제목은 처음부터 "감지 · 측정 항목 + 값"이다. 그림은 안전진단 감지 사진(assets/img/safety/).
 *   날짜는 v6 관제 상태바 시계(2026-08-26 = 오늘)를 따른다 — 어제 08-25 · 그제 08-24.
 */
(function () {
  "use strict";
  var T = "2026-08-26 ", Y = "2026-08-25 ", D24 = "2026-08-24 ";

  var DAYS = {
    today: { label: "오늘", rank: 3 },
    yesterday: { label: "어제", rank: 2 },
    "d-0824": { label: "8월 24일 (월)", rank: 1 }
  };

  var ALERTS = [
    /* ---- 미확인 12건 (위험 3 · 주의 9) — v6 관제 최신 알림 ---- */
    { id: "A-1", sev: "critical", day: "today", time: "10:12:40", stamp: T + "10:12:40",
      title: "지하발전소 터빈 2 NG 1건 발견", res: ["압력", "0.86 MPa"], floor: "B4", wp: "WP-04", place: "N₂ 배관 압력계",
      mission: "정기 순회 점검", detect: "계기인식", robot: "Robot 01", img: "alert/wp04-gauge-spiral.webp",
      why: ["압력 0.86 MPa · 정상 범위 0.60 ~ 0.80 초과", "최근 3회 측정 0.78 → 0.82 → 0.86 으로 계속 오름", "감압 밸브 설정 이상 가능성이 가장 높음"],
      lead: "현장에 무전으로 작업 중지를 요청하세요.", fp: 8, fpLabel: "낮음",
      acts: [{ t: "현장 무전 연락 · 작업 중지 요청", delta: true }, { t: "로봇 정지 · 현장 점검 요청", delta: true }, { t: "재측정 후 판단" }] },

    { id: "A-2", sev: "critical", day: "today", time: "10:16:48", stamp: T + "10:16:48",
      title: "안전감지 · 안전벨트 미착용 1명", res: ["안전벨트 미착용", "1명"], floor: "B4", wp: "WP-07", place: "고소 작업 발판",
      mission: "정기 순회 점검", detect: "안전감지", robot: "Robot 01", img: "safety/safety_crit.jpg",
      why: ["고소 작업 발판에서 안전벨트 미착용 1명 · 신뢰도 0.91", "연속 2프레임에서 검출", "고소 작업 중 — 착용 확인 전까지 작업을 멈추는 편이 안전함"],
      lead: "작업자에게 즉시 착용을 안내하세요.", fp: 6, fpLabel: "낮음",
      acts: [{ t: "작업자 즉시 착용 안내", delta: true }, { t: "고소 작업 일시 중지", delta: true }, { t: "안전관리팀 전달" }] },

    { id: "A-3", sev: "critical", day: "today", time: "09:44:18", stamp: T + "09:44:18",
      title: "차압 NG · HEPA Filter 차압계", res: ["차압", "312 Pa"], floor: "B3", wp: "WP-02", place: "HEPA Filter 차압계",
      mission: "전기실 열화상 점검", detect: "계기인식", robot: "Robot 11", img: "alert/wp02-gauge-hepa.webp",
      why: ["차압 312 Pa · 교체 기준 250 Pa 초과", "최근 3회 측정 268 → 291 → 312 Pa 로 계속 오름", "필터 막힘 가능성이 가장 높음"],
      lead: "필터 교체와 현장 점검을 요청하세요.", fp: 9, fpLabel: "낮음",
      acts: [{ t: "필터 교체 요청", delta: true }, { t: "현장 점검 요청", delta: true }, { t: "재측정 후 판단" }] },

    { id: "A-4", sev: "warning", day: "today", time: "10:11:19", stamp: T + "10:11:19",
      title: "누출감지 · 냉각수 배관 밸브", res: ["누출 확률", "62%"], floor: "B4", wp: "WP-03", place: "냉각수 배관 밸브",
      mission: "정기 순회 점검", detect: "누출감지", robot: "Robot 01", img: "alert/wp03-leak.webp",
      why: ["누출 확률 62% · 기준 55% 초과", "밸브 이음부 같은 자리에서 연속 2프레임 검출", "같은 냉각수 계통 WP-05 펌프 온도도 기준을 넘음"],
      lead: "구역 출입을 통제하고 설비팀에 밸브 확인을 요청하세요.", fp: 15, fpLabel: "낮음",
      acts: [{ t: "구역 출입 통제", delta: true }, { t: "설비팀 밸브 확인 요청", delta: true }, { t: "현장 확인" }] },

    { id: "A-5", sev: "warning", day: "today", time: "10:13:52", stamp: T + "10:13:52",
      title: "이상음향 · 냉각 펌프 P-2", res: ["이상 점수", "20.4"], floor: "B4", wp: "WP-05", place: "냉각 펌프 P-2",
      mission: "정기 순회 점검", detect: "이상음향", robot: "Robot 01", img: "alert/wp05-sound.webp",
      why: ["이상 점수 20.4 · 기준 19.0 초과", "저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷함", "같은 펌프 P-2 하우징 온도도 기준 초과(48.6 ℃)"],
      lead: "진동 정밀 측정을 요청하세요.", fp: 20, fpLabel: "낮음",
      acts: [{ t: "진동 정밀 측정 요청", delta: true }, { t: "설비 정지 검토 요청" }] },

    { id: "A-6", sev: "warning", day: "today", time: "10:14:10", stamp: T + "10:14:10",
      title: "온도감지 · 냉각 펌프 P-2 48.6℃", res: ["최고 온도", "48.6 ℃"], floor: "B4", wp: "WP-05", place: "냉각 펌프 P-2",
      mission: "정기 순회 점검", detect: "온도감지", robot: "Robot 01", img: "alert/wp05-temp-486.webp",
      why: ["최고 48.6 ℃ · 기준 40 ℃ 초과", "평소 36.2 ℃ 보다 12.4 ℃ 높음", "같은 펌프 P-2 에서 이상음향이 함께 검출됨"],
      lead: "부하를 줄이고 점검을 요청하세요.", fp: 18, fpLabel: "낮음",
      acts: [{ t: "부하 감소 요청", delta: true }, { t: "설비 점검 요청", delta: true }, { t: "현장 확인" }] },

    { id: "A-7", sev: "warning", day: "today", time: "10:15:31", stamp: T + "10:15:31",
      title: "부분방전 · CH1 이상 점수 9.05", res: ["이상 점수", "9.05"], ch: "CH1", floor: "B4", wp: "WP-06", place: "수배전반 MCC-1",
      mission: "정기 순회 점검", detect: "부분방전", robot: "Robot 01", img: "alert/wp06-pd-905.webp",
      why: ["CH1 이상 점수 9.05 · 기준 8.60 초과", "CH2 · CH3 은 정상 범위", "WP-05 펌프 전원 계통 — 모터 발열로 이어질 수 있음"],
      lead: "절연 진단을 요청하세요.", fp: 22, fpLabel: "보통",
      acts: [{ t: "절연 진단 요청", delta: true }, { t: "감시 강화", delta: true }] },

    { id: "A-8", sev: "warning", day: "today", time: "09:20:14", stamp: T + "09:20:14",
      title: "과열 · 발전기 베어링 68.4℃", res: ["최고 온도", "68.4 ℃"], floor: "B3", wp: "WP-02", place: "발전기 베어링",
      mission: "발전기실 설비 점검", detect: "온도감지", robot: "Robot 05", img: "alert/wp02-temp-684.webp",
      why: ["표면 온도 68.4 ℃ · 주의 기준 65 ℃ 초과", "주변 온도보다 31 ℃ 높음", "어제 09:00 에도 주의(66.1 ℃) — 부하 감소 뒤에도 다시 오름"],
      lead: "윤활 상태 점검을 요청하세요.", fp: 25, fpLabel: "보통",
      acts: [{ t: "윤활 상태 점검 요청", delta: true }, { t: "열화상 재촬영" }, { t: "추이 관찰" }] },

    { id: "A-9", sev: "warning", day: "today", time: "09:36:42", stamp: T + "09:36:42",
      title: "부분방전 · 이상 점수 9.41", res: ["이상 점수", "9.41"], floor: "B3", wp: "WP-06", place: "수배전반",
      mission: "발전기실 설비 점검", detect: "부분방전", robot: "Robot 05", img: "alert/wp06-pd-941.webp",
      why: ["이상 점수 9.41 · 주의 기준 8.60 초과", "PRPD 패턴이 코로나 방전 유형과 일치", "같은 발전기 계통 WP-02 베어링 과열과 함께 나타날 수 있음"],
      lead: "재진단을 예약해 PRPD 패턴을 다시 확인하세요.", fp: 22, fpLabel: "보통",
      acts: [{ t: "재진단 예약", delta: true }, { t: "현장 점검 요청" }, { t: "추이 관찰" }] },

    { id: "A-10", sev: "warning", day: "today", time: "09:56:05", stamp: T + "09:56:05",
      title: "이상음향 · 이상 점수 21.6", res: ["이상 점수", "21.6"], floor: "B3", wp: "WP-12", place: "냉각 펌프 P-2",
      mission: "발전기실 설비 점검", detect: "이상음향", robot: "Robot 05", img: "alert/wp12-sound-216.webp",
      why: ["이상 점수 21.6 · 기준 19.0 초과", "저주파 대역 에너지가 늘어 베어링 마모 패턴과 비슷함", "위험 기준 22.8 에 가까움"],
      lead: "진동 정밀 측정을 요청하세요.", fp: 18, fpLabel: "낮음",
      acts: [{ t: "진동 정밀 측정 요청", delta: true }, { t: "설비 정지 검토 요청" }, { t: "추이 관찰" }] },

    { id: "A-11", sev: "warning", day: "today", time: "10:01:12", stamp: T + "10:01:12",
      title: "압력 편차 · 공기 압축기 C-1", res: ["압력", "7.9 bar"], floor: "B4", wp: "WP-13", place: "공기 압축기 C-1",
      mission: "발전기실 설비 점검", detect: "계기인식", robot: "Robot 05", img: "alert/wp13-gauge-comp.webp",
      why: ["토출 압력 7.9 bar · 정상 범위 8.2 ~ 8.8 아래", "흡입 필터가 막혔을 가능성이 있음", "같은 압축기에서 오늘 다른 이상은 없음"],
      lead: "흡입 필터 점검을 요청하세요.", fp: 30, fpLabel: "보통",
      acts: [{ t: "필터 점검 요청", delta: true }, { t: "재측정 예약" }, { t: "추이 관찰" }] },

    { id: "A-12", sev: "warning", day: "today", time: "10:15:52", stamp: T + "10:15:52",
      title: "압력 편차 · N₂ 배관 압력계", res: ["압력", "0.62 MPa"], floor: "B3", wp: "WP-04", place: "N₂ 배관 압력계",
      mission: "전기실 열화상 점검", detect: "계기인식", robot: "Robot 11", img: "alert/wp04-gauge-n2.webp",
      why: ["압력 0.62 MPa · 정상 범위 0.65 ~ 0.75 아래", "최근 2회 측정에서 조금씩 내려감", "배관 연결부 누설 가능성"],
      lead: "배관 연결부 누설 점검을 요청하세요.", fp: 20, fpLabel: "낮음",
      acts: [{ t: "누설 점검 요청", delta: true }, { t: "다음 순회 재측정" }, { t: "추이 관찰" }] },

    /* ---- 오늘 5건 (모두 주의) — 관제 "오늘 확인 완료" 기본 기록(monitor.js DONE_BASE · DONE6 · WP6)과 같은 제목 · 지점 · 처리 · 담당 · 확인 시각 ---- */
    { id: "C-1", sev: "warning", day: "today", time: "09:58:12", stamp: T + "09:58:12",
      title: "온도감지 · 최고 온도 44.2 ℃", res: ["최고 온도", "44.2 ℃"], floor: "B4", wp: "WP-03", place: "냉각수 배관 밸브",
      mission: "정기 순회 점검", detect: "온도감지", robot: "Robot 01", img: "safety/temp_warn.jpg",
      done: { day: "today", at: "10:29", by: "김현대", took: "발생 후 31분",
              picked: ["추이 관찰", "다음 순회 재측정"], memo: "",
              delta: "AI 추천 그대로 사용 (추이 관찰 · 다음 순회 재측정)" } },

    { id: "C-2", sev: "warning", day: "today", time: "09:53:20", stamp: T + "09:53:20",
      title: "부분방전 · 이상 점수 8.92", res: ["이상 점수", "8.92"], floor: "B3", wp: "WP-11", place: "변압기 TR-1",
      mission: "발전기실 설비 점검", detect: "부분방전", robot: "Robot 05", img: "safety/pd_warn.png",
      done: { day: "today", at: "10:18", by: "김현대", took: "발생 후 25분",
              picked: ["현장 점검 요청"], memo: "현장 점검 · 이상 없음",
              delta: "AI 추천 그대로 사용 (현장 점검 요청)" } },

    { id: "C-3", sev: "warning", day: "today", time: "09:19:02", stamp: T + "09:19:02",
      title: "이상음향 · 이상 점수 19.6", res: ["이상 점수", "19.6"], floor: "B3", wp: "WP-02", place: "발전기 베어링",
      mission: "발전기실 설비 점검", detect: "이상음향", robot: "Robot 05", img: "safety/sound_warn.jpg",
      done: { day: "today", at: "10:02", by: "홍길동", took: "발생 후 43분",
              picked: ["추이 관찰", "다음 순회 재측정"], memo: "",
              delta: "AI 추천 그대로 사용 (추이 관찰 · 다음 순회 재측정)" } },

    { id: "C-4", sev: "warning", day: "today", time: "09:24:10", stamp: T + "09:24:10",
      title: "온도감지 · 최고 온도 41.5 ℃", res: ["최고 온도", "41.5 ℃"], floor: "B3", wp: "WP-03", place: "펌프 하우징",
      mission: "발전기실 설비 점검", detect: "온도감지", robot: "Robot 05", img: "safety/m2_temp_warn.jpg",
      done: { day: "today", at: "09:47", by: "홍길동", took: "발생 후 23분",
              picked: ["현장 점검 요청"], memo: "현장 점검 · 이상 없음",
              delta: "AI 추천 그대로 사용 (현장 점검 요청)" } },

    { id: "C-5", sev: "warning", day: "today", time: "09:12:44", stamp: T + "09:12:44",
      title: "누출감지 · 누출 확률 58%", res: ["누출 확률", "58%"], floor: "B4", wp: "WP-09", place: "유압 유닛 HU-2",
      mission: "유틸리티 순회", detect: "누출감지", robot: "Robot 09", img: "safety/leak_warn.jpg",
      done: { day: "today", at: "09:30", by: "김현대", took: "발생 후 18분",
              picked: ["청소 후 재측정"], memo: "누유 흔적 청소 · 재측정 정상",
              delta: "AI 추천 그대로 사용 (청소 후 재측정)" } },

    /* ---- 지난 이틀 9건 (위험 3 · 주의 6) ---- */
    { id: "B-1", sev: "critical", day: "yesterday", time: "어제 22:41", stamp: Y + "22:41:05",
      title: "안전감지 · 안전모 미착용 1명", res: ["안전모 미착용", "1명"], floor: "B4", wp: "WP-09", place: "배전반실 출입문",
      mission: "야간 순회 점검", detect: "안전감지", robot: "Robot 04", img: "safety/safety_crit.jpg",
      done: { day: "yesterday", at: "22:44", by: "홍길동", took: "발생 후 3분",
              picked: ["작업자 즉시 착용 안내", "안전관리팀 전달"], memo: "협력사 야간 작업자 · 착용 확인",
              delta: "AI 추천 그대로 사용 (작업자 즉시 착용 안내)" } },

    { id: "B-2", sev: "warning", day: "yesterday", time: "어제 21:15", stamp: Y + "21:15:37",
      title: "누출감지 · 누출 확률 57%", res: ["누출 확률", "57%"], floor: "B4", wp: "WP-14", place: "급수 배관 분기부",
      mission: "야간 순회 점검", detect: "누출감지", robot: "Robot 04", img: "safety/leak_warn.jpg",
      done: { day: "yesterday", at: "21:27", by: "홍길동", took: "발생 후 12분",
              picked: ["현장 확인"], memo: "결로로 확인 · 누출 아님",
              delta: "AI 추천 가운데 일부만 사용 (현장 확인)" } },

    { id: "B-3", sev: "critical", day: "yesterday", time: "어제 16:32", stamp: Y + "16:32:10",
      title: "계기인식 · 차압 298 Pa", res: ["차압", "298 Pa"], floor: "B3", wp: "WP-08", place: "AHU-2 필터 차압계",
      mission: "공조 설비 순회", detect: "계기인식", robot: "Robot 07", img: "safety/gauge_crit.jpg",
      done: { day: "yesterday", at: "16:40", by: "김현대", took: "발생 후 8분",
              picked: ["필터 교체 요청", "현장 점검 요청"], memo: "필터 교체 완료 · 차압 180 Pa 로 내려감",
              delta: "AI 추천 그대로 사용 (필터 교체 요청 · 현장 점검 요청)" } },

    { id: "B-4", sev: "warning", day: "yesterday", time: "어제 15:05", stamp: Y + "15:05:48",
      title: "이상음향 · 이상 점수 19.8", res: ["이상 점수", "19.8"], floor: "B3", wp: "WP-11", place: "송풍기 FAN-3",
      mission: "공조 설비 순회", detect: "이상음향", robot: "Robot 07", img: "safety/sound_warn.jpg",
      done: { day: "yesterday", at: "15:20", by: "김현대", took: "발생 후 15분",
              picked: ["진동 정밀 측정 요청"], memo: "",
              delta: "AI 추천 그대로 사용 (진동 정밀 측정 요청)" } },

    { id: "B-5", sev: "warning", day: "yesterday", time: "어제 11:42", stamp: Y + "11:42:26",
      title: "온도감지 · 최고 온도 46.2 ℃", res: ["최고 온도", "46.2 ℃"], floor: "B4", wp: "WP-06", place: "변압기 TR-2",
      mission: "유틸리티 순회", detect: "온도감지", robot: "Robot 09", img: "safety/temp_warn.jpg",
      done: { day: "yesterday", at: "11:50", by: "이수진", took: "발생 후 8분",
              picked: ["부하 감소 요청", "설비 점검 요청"], memo: "오후 부하 분산 · 다음 순회 재측정",
              delta: "AI 추천 그대로 사용 (부하 감소 요청 · 설비 점검 요청)" } },

    { id: "B-6", sev: "warning", day: "yesterday", time: "어제 10:18", stamp: Y + "10:18:03",
      title: "부분방전 · 이상 점수 8.82", res: ["이상 점수", "8.82"], ch: "CH2", floor: "B4", wp: "WP-06", place: "수배전반 MCC-1",
      mission: "정기 순회 점검", detect: "부분방전", robot: "Robot 01", img: "safety/pd_warn.png",
      done: { day: "yesterday", at: "10:31", by: "홍길동", took: "발생 후 13분",
              picked: ["감시 강화"], memo: "",
              delta: "AI 추천 가운데 일부만 사용 (감시 강화)" } },

    { id: "B-7", sev: "critical", day: "d-0824", time: "14:07:22", stamp: D24 + "14:07:22",
      title: "온도감지 · 최고 온도 71.2 ℃", res: ["최고 온도", "71.2 ℃"], floor: "B3", wp: "WP-09", place: "변압기 TR-1",
      mission: "전기실 열화상 점검", detect: "온도감지", robot: "Robot 11", img: "safety/temp_crit.jpg",
      done: { day: "d-0824", at: "14:10", by: "이수진", took: "발생 후 3분",
              picked: ["부하 감소 요청", "설비 점검 요청", "현장 확인"], memo: "냉각팬 정지 확인 · 재기동 뒤 정상",
              delta: "AI 추천 그대로 사용 (부하 감소 요청 · 설비 점검 요청)" } },

    // 안전진단 상세의 지난 순회 줄(08/25 09:00 주의 · 09:14 부하 감소 요청)과 같은 기록
    { id: "B-8", sev: "warning", day: "yesterday", time: "어제 09:00", stamp: Y + "09:00:12",
      title: "온도감지 · 최고 온도 66.1 ℃", res: ["최고 온도", "66.1 ℃"], floor: "B3", wp: "WP-02", place: "발전기 베어링",
      mission: "발전기실 설비 점검", detect: "온도감지", robot: "Robot 05", img: "safety/m2_temp_warn.jpg",
      done: { day: "yesterday", at: "09:14", by: "김현대", took: "발생 후 14분",
              picked: ["부하 감소 요청"], memo: "부하 감소 뒤 다음 순회 재측정",
              delta: "AI 추천 가운데 일부만 사용 (부하 감소 요청)" } },

    { id: "B-9", sev: "warning", day: "d-0824", time: "09:37:15", stamp: D24 + "09:37:15",
      title: "계기인식 · 압력 0.41 MPa", res: ["압력", "0.41 MPa"], floor: "B4", wp: "WP-12", place: "냉각수 공급 압력계",
      mission: "유틸리티 순회", detect: "계기인식", robot: "Robot 09", img: "safety/gauge_warn.jpg",
      done: { day: "d-0824", at: "09:48", by: "홍길동", took: "발생 후 11분",
              picked: ["오탐 처리"], memo: "계기 유리면 반사 · 수동 판독 정상",
              delta: "AI 추천을 쓰지 않음 (추천: 계기 교정 요청)" } }
  ];

  // 오늘 조치 요약 — 숫자는 위 데이터와 맞아떨어진다. 오늘 5건(모두 주의, 소요 31 · 25 · 43 · 23 · 18분 → 평균 28분), 미확인 위험 3건.
  var HANDOVER = {
    when: "오늘 09:30–10:29 · 조치 5건 기준",
    items: [
      ["조치", "오늘 5건 조치 · 모두 주의 · 평균 28분"],
      ["반복", "발전기 베어링(WP-02) 과열이 어제 66.1 ℃ 에 이어 오늘 68.4 ℃ 로 다시 났어요. 어제 부하 감소 뒤에도 오르고 있어요"],
      ["남은 위험", "미확인 위험 3건: 정기 순회 WP-04 · WP-07, 전기실 WP-02. N₂ 압력계(WP-04)부터 확인해 주세요"],
      ["다음 근무", "정기 순회 점검 냉각 펌프 P-2(WP-05) 이상음향 · 온도 두 건을 함께 확인해 주세요"]
    ]
  };

  window.APRISM_AC6 = { DAYS: DAYS, ALERTS: ALERTS, HANDOVER: HANDOVER };
})();
