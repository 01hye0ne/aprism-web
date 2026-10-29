/*
 * 보고서(GNB [보고서]) — v5 · 10/29 디자이너 시안 "UI_전주기 보고서 탭"을 옮겼다(동작 · 데이터는 시안 그대로, 겉모양은 디자인 시스템).
 *
 *   왼쪽   보고서 목록 — 달 이동 · [월 보고서 생성] · 날짜 줄(= 그날 일일 보고서) + └ 미션 보고서
 *          (10/29 2차 Figma 1432:40952 — 달력은 Figma 에서 빠져 지웠다. 오늘처럼 근무가 안 끝난 날은 "작성 중")
 *   오른쪽 보고서 — 머리(종류 · 제목 · 문서 번호 · 내려받기) + 뷰어(목차 | A4 관제 양식 문서)
 *   다른 화면(관제)에서 여는 경우 — 같은 뷰어를 모달로(window.APRISM_REPORT.open(id), 주소 #modal 로 시연)
 *
 * 시안에서 연결된 문서는 10월 13일 일일 보고서(d1013) · 10:17 미션 보고서(m1017) · 10월 월 보고서(mo10) 셋이다. 나머지 줄은 예시다.
 * 시안의 "시안 진입 경로" · "화면 테마" 조작은 뺐다 — 테마는 상단 바 테마 단추(theme.js)를 따른다.
 */
(function () {
  "use strict";

  var body = document.querySelector("[data-report]");
  if (!body) { return; }
  var IMG = "../assets/img/report/";

  /* ---------- 데이터(시안 그대로) ---------- */
  var NAME = "{미션이름}";
  var DAYS = [
    { d: "10월 22일 (목)", day: 22, live: true, dayRpt: { n: 1 }, missions: [{ t: "09:10 ~ 09:32" }] },
    { d: "10월 21일 (수)", day: 21, dayRpt: { n: 2 }, missions: [{ t: "16:20 ~ 16:51" }, { t: "09:40 ~ 09:58" }] },
    { d: "10월 16일 (금)", day: 16, dayRpt: { n: 1 }, missions: [{ t: "13:10 ~ 13:34" }] },
    { d: "10월 13일 (화)", day: 13, dayRpt: { n: 2, id: "d1013" }, missions: [{ t: "10:17 ~ 10:46", id: "m1017" }, { t: "08:02 ~ 08:14" }] },
    { d: "10월 12일 (월)", day: 12, dayRpt: { n: 1 }, missions: [{ t: "15:30 ~ 15:50" }] }
  ];
  var EV = [["10:18:14", "134.8"], ["10:18:40", "106.8"], ["10:18:56", "99.2"], ["10:19:20", "75.7"], ["10:19:37", "79.7"], ["10:20:17", "80.8"], ["10:21:06", "98.8"], ["10:21:32", "82.0"], ["10:21:42", "79.2"], ["10:36:31", "70.8"]]
    .map(function (e, i) { return { t: e[0], v: "최고 " + e[1] + "°C", img: IMG + "ev" + (i + 1) + ".webp", type: "온도감지", alt: "열화상" }; });
  // 사진은 알림 시각 순서로 번호를 매긴다(알림 표의 '사진' 칸과 같은 번호)
  EV.splice(9, 0, { t: "10:24:40", v: "안전모 미착용 1명", img: IMG + "safe1.webp", type: "안전감지", alt: "안전감지" });
  function photoNo(t) { for (var i = 0; i < EV.length; i++) { if (EV[i].t === t) { return i; } } return null; }
  var GD = [["#1 GoV. Sump Tank Level", "digital", "520.3 mm", "355 ~ 765 mm", "정상"], ["#1 Inlet Valve Oil Pr. Tank Pr.", "digital", "64.0 kg/cm²", "58 ~ 68 kg/cm²", "정상"], ["#1 Gov. Oil Pr. Circuit Pr.", "analog", "0 kg/cm²", "58 ~ 100 kg/cm²", "비정상"], ["#1 Gov. Oil Pr. Circuit Temp.", "analog", "29.77 °C", "0 ~ 55 °C", "정상"], ["#1 Gov. Sump Tank Oil Level", "bar", "59.01 %", "—", "판독 없음"], ["#1 Gov. Oil Pr. Tank Level", "bar", "—", "—", "판독 없음"], ["#1 Gov. Oil Pr. Tank Pr.", "digital", "64.1 kg/cm²", "58 ~ 68 kg/cm²", "비정상"], ["#1 Gov. Air Tank Pr.", "digital", "7.3 kg/cm²", "74 ~ 76 kg/cm²", "비정상"], ["#1 Upper Guide BRG Cooling Water Flow", "digital", "0.0 m³/h", "6 ~ 9999 m³/h", "비정상"], ["#1 Inlet Valve Oil Pr. Tank Level", "bar", "—", "—", "판독 없음"], ["#1 Spiral Casing Pr.", "digital", "6.093 kg/cm²", "40 ~ 9999 kg/cm²", "비정상"], ["#1 U1 THB BRG Cooling Water Flow", "digital", "0.00 m³/h", "—", "판독 없음"]];
  // 알림과 조치: 시각, 등급, 감지 유형, 위치와 현상, 조치 내용(null = 미조치), 처리
  var AL = [["10:18:14", "위험", "온도감지", "WP-02 표면 최고 134.8°C", "냉각 계통 점검 요청", "홍길동 10:21"], ["10:18:40", "위험", "온도감지", "WP-02 표면 최고 106.8°C", "재측정 후 판단", "홍길동 10:22"], ["10:18:56", "위험", "온도감지", "WP-03 표면 최고 99.2°C", "재측정 후 판단", "홍길동 10:22"], ["10:19:20", "위험", "온도감지", "WP-03 표면 최고 75.7°C", "오탐으로 종료 (조명 반사)", "홍길동 10:23"], ["10:19:37", "위험", "온도감지", "WP-03 표면 최고 79.7°C", "재측정 후 판단", "홍길동 10:23"], ["10:20:17", "위험", "온도감지", "WP-04 표면 최고 80.8°C", "냉각 계통 점검 요청", "홍길동 10:25"], ["10:21:06", "위험", "온도감지", "WP-05 표면 최고 98.8°C", "냉각 계통 점검 요청", "홍길동 10:25"], ["10:21:32", "위험", "온도감지", "WP-05 표면 최고 82.0°C", "재측정 후 판단", "김현대 10:28"], ["10:21:42", "위험", "온도감지", "WP-05 표면 최고 79.2°C", "오탐으로 종료 (중복 감지)", "김현대 10:28"], ["10:24:40", "위험", "안전감지", "WP-06 안전모 미착용 1명", "현장 근무자에게 착용 지시", "홍길동 10:26"], ["10:36:31", "위험", "온도감지", "WP-10 표면 최고 70.8°C", null, null]];
  var OPEN = AL.filter(function (a) { return !a[4]; });
  var TYPES6 = ["안전감지", "누출감지", "온도감지", "계기인식", "이상음향", "부분방전"];
  var DOCS = {
    m1017: { kind: "m", no: "mission-20261013-1017", title: "순시 점검 결과 보고서", head: NAME, meta: [["날짜 및 시간", "2026.10.13 (화) 10:17 ~ 10:46"], ["유형", "수동"]], file: "순시점검결과보고서",
      counts: { 안전감지: ["1", "0", "1", "0", "0"], 온도감지: ["10", "0", "7", "2", "1"] }, sum: ["11", "0", "8", "2", "1"],
      flow: [["a", "위험 이벤트와 조치"], ["c", "주의 이벤트와 조치"], ["p", "이벤트 사진"], ["g", "게이지 판독 결과"], ["th", "열화상 분석 결과"], ["o", "종합 소견"]] },
    d1013: { kind: "d", no: "day-20261013-1800", title: "로봇 관제 일일 보고서", head: "10월 13일 (화)", meta: [["날짜", "2026.10.13 (화)"], ["미션", "2건"]], file: "로봇관제일일보고서",
      counts: { 안전감지: ["1", "0", "1", "0", "0"], 온도감지: ["11", "0", "7", "3", "1"] }, sum: ["12", "0", "8", "3", "1"],
      flow: [["th", "열화상 분석 결과"], ["o", "종합 소견"], ["n", "특이 사항"]] },
    mo10: { kind: "mo", no: "month-202610", title: "로봇 관제 월간 보고서", head: "10월 월 보고서", part: true, meta: [["기간", "2026.10.01 ~ 10.21"], ["미션", "6건"]], file: "로봇관제월간보고서",
      counts: { 안전감지: ["1", "0", "1", "0", "0"], 누출감지: ["0", "2", "2", "0", "0"], 온도감지: ["13", "0", "9", "3", "1"], 계기인식: ["0", "7", "5", "1", "1"] }, sum: ["14", "9", "17", "4", "2"],
      flow: [["th", "열화상 분석 결과"], ["o", "종합 소견"], ["n", "특이 사항"], ["tr", "설비별 추이"], ["ab", "비정상 감지 추이"]] }
  };
  var MDAYS = [["10.12 (월)", "1", "2", "0", "2", "0", "day-20261012-1800", ""], ["10.13 (화)", "2", "12", "12", "0", "1", "day-20261013-1800", "d1013"], ["10.16 (금)", "1", "3", "0", "3", "0", "day-20261016-1800", ""], ["10.21 (수)", "2", "6", "2", "4", "1", "day-20261021-1800", ""]];
  var MOPEN = OPEN.map(function (a) { return ["10.13 " + a[0].slice(0, 5)].concat(a.slice(1)); }).concat([["10.21 16:42", "주의", "계기인식", "#1 Gov. Air Tank Pr. 7.2 kg/cm² (기준 74 ~ 76)", null, null]]);
  var opt = { m1017: new Set(["a", "c", "g", "th", "p", "o"]), d1013: new Set(["th", "o", "n"]), mo10: new Set(["th", "o", "n", "tr", "ab"]) };
  var moState = "none";   // 월 보고서: none(아직) · busy(만드는 중) · made(만듦)
  var THERM = { m1017: ["134.85°C", "21건"], d1013: ["134.85°C (10:17 미션)", "22건"], mo10: ["134.85°C (10.13)", "26건"] };
  var OPINION = {
    m1017: "본 순시에서 위험 이벤트 11건이 감지되었다(온도감지 10건, 안전감지 1건). 게이지 판독 결과 비정상 231건이 확인되어 점검이 필요하다. 열화상 분석에서 고온 21건이 감지되었다(최고 134.85°C).",
    d1013: "미션 2건 중 1건(08:02)은 중단 종료되었다. 알림 12건 중 11건을 처리했고 미조치 1건은 다음 근무자에게 인계한다. 열화상 고온 22건 중 21건이 10:17 미션에서 나왔다(최고 134.85°C).",
    mo10: "10월 1일부터 21일까지 미션 6건, 알림 23건(위험 14, 주의 9)이 발생했다. 미조치 2건은 온도감지 1건(10.13), 계기인식 1건(10.21)이다. 10.13 열화상 최고 134.85°C 구간은 재점검이 필요하다." };
  var NOTE = {};
  var cur = "m1017";

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
  function ic(name, size) { return '<span class="i i-' + (size || 16) + '" style="--i:var(--ic-' + name + ')" aria-hidden="true"></span>'; }

  /* ---------- 문서 블록(관제 양식 — 시안 그대로) ---------- */
  function head(no) { return '<div class="p-hd"><span class="lg"><svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true"><path d="M20 4 L34 28 L20 21 L6 28 Z" fill="currentColor"/><path d="M20 21 L34 28 L20 35 L6 28Z" fill="currentColor" opacity=".45"/></svg><small>APRISM</small></span><span class="no">문서 번호 ' + no + "</span></div>"; }
  function secH(k, t) { return '<div class="f-sec" data-sec="' + k + '"><div class="f-h">' + t + "</div>"; }
  function f2(a, b, c, d, red) { return '<div class="fr f2"><span class="l">' + a + "</span><span>" + b + '</span><span class="l">' + c + "</span><span" + (red ? ' class="red"' : "") + ">" + d + "</span></div>"; }
  function f1(a, b) { return '<div class="fr f1"><span class="l">' + a + "</span><span>" + b + "</span></div>"; }
  function fl(a, b) { return '<div class="fr fl"><span class="l">' + a + "</span><span>" + (b || "") + "</span></div>"; }
  function countTable(doc) {
    var rows = TYPES6.map(function (t) {
      var v = doc.counts[t] || ["0", "0", "0", "0", "0"];
      return '<div class="fr cnt6"><span class="l">' + t + "</span>" + v.map(function (x, i) { return '<span class="c' + (i === 4 && x !== "0" ? " red" : "") + '">' + x + "</span>"; }).join("") + "</div>";
    }).join("");
    return '<div class="ft"><div class="fr cnt6 hd"><span>구분</span><span>위험</span><span>주의</span><span>조치 완료</span><span>오탐 종료</span><span>미조치</span></div>' + rows +
      '<div class="fr cnt6 sum"><span class="c">합계</span>' + doc.sum.map(function (x, i) { return '<span class="c' + (i === 4 && x !== "0" ? " red" : "") + '">' + x + "</span>"; }).join("") + "</div>";
  }
  function alertHd(ph) { return '<div class="fr alr' + (ph ? " wph" : "") + ' hd"><span>시각</span><span>등급</span><span>감지 유형</span><span>위치와 현상</span><span>조치 내용</span><span>처리</span>' + (ph ? "<span>사진</span>" : "") + "</div>"; }
  function alertRow(a, ph) {
    var n = photoNo(a[0]);
    return '<div class="fr alr' + (ph ? " wph" : "") + '"><span class="c">' + a[0] + '</span><span class="c">' + a[1] + '</span><span class="c">' + a[2] + "</span><span>" + a[3] + "</span><span" + (a[4] ? "" : ' class="q"') + ">" + (a[4] || "—") + '</span><span class="c' + (a[4] ? "" : " red") + '">' + (a[5] || "미조치") + "</span>" +
      (ph ? '<span class="c">' + (n === null ? '<span class="q">—</span>' : '<button class="lk" data-ev="' + n + '" aria-label="사진 ' + (n + 1) + ' 보기">' + String(n + 1).padStart(2, "0") + "</button>") + "</span>" : "") + "</div>";
  }
  function evCard(a) {
    var i = photoNo(a[0]), x = i === null ? null : EV[i];
    function r(l, v, c) { return '<div class="fr f1"><span class="l">' + l + "</span><span" + (c ? ' class="' + c + '"' : "") + ">" + v + "</span></div>"; }
    return '<div class="evc">' + (x ? '<button class="ph" data-ev="' + i + '" aria-label="' + a[0] + ' 사진 크게 보기"><img src="' + x.img + '" alt="' + x.alt + " " + a[0] + '"></button>' : '<div class="ph none"></div>') +
      '<div class="evf">' + r("감지", "<b>" + a[0] + "</b><i>" + a[1] + "</i><i>" + a[2] + "</i>", "ev-h") + r("감지 데이터", a[3]) + r("조치 내용", a[4] || "—", a[4] ? "" : "q") + r("처리", a[5] || "미조치", a[5] ? "" : "red") + "</div></div>";
  }
  function firstPage(doc) {
    var h = '<div class="f-title">' + doc.title + "</div>";
    if (doc.kind === "m") {
      h += secH("b", "기본 정보") + '<div class="ft">' + f2("사업장", "{사업장명}", "일시", "2026.10.13 (화) 10:17 ~ 10:46") + f2("미션 이름", NAME, "근무자", "{관제사}") + f2("로봇", "{로봇 ID}", "미션 유형", "수동") + f2("완료 상태", "정상 완료", "배터리", "99.0% / 62.0%") + "</div></div>";
      h += secH("s", "점검 결과 요약") + '<div class="ft">' + f2("점검 구간", "WP-01 ~ WP-12 (12곳)", "소요 시간", "29분 0초") + f2("알림", "11건 (위험 11, 주의 0)", "미조치", OPEN.length + "건", true) + "</div></div>";
      h += secH("t", "감지 유형별 처리 현황") + countTable(doc) + fl("참고 사항", "AI 감지 원본 수치: 게이지 비정상 231건, 읽기 실패 1807건. 안전(PPE) 총 인원 802명, 안전모 위반 40건. 오디오 분석 1710건.") + "</div></div>";
    } else if (doc.kind === "mo") {
      h += secH("b", "기본 정보") + '<div class="ft">' + f2("사업장", "{사업장명}", "기간", "2026.10.01 ~ 2026.10.21") + f2("로봇", "{로봇 ID}", "작성 일시", "2026.10.22 14:12") + f2("작성자", "{관제사}", "점검일 수", "4일") + "</div></div>";
      h += secH("s", "처리 결과 요약") + '<div class="ft">' + f2("미션", "6건 (정상 완료 5, 중단 종료 1)", "점검 시간", "2시간 14분") + f2("알림", "23건 (위험 14, 주의 9)", "미조치", "2건", true) + "</div></div>";
      h += secH("y", "일자별 결과") + '<div class="ft"><div class="fr dyt hd"><span>일자</span><span>미션</span><span>알림</span><span>위험</span><span>주의</span><span>미조치</span><span>일일 보고서</span></div>' +
        MDAYS.map(function (r) { return '<div class="fr dyt"><span class="c">' + r[0] + "</span>" + r.slice(1, 6).map(function (x, i) { return '<span class="c' + (i === 4 && x !== "0" ? " red" : "") + '">' + x + "건</span>"; }).join("") + '<span class="c"><button class="lk" data-doc="' + (r[7] || "x") + '">' + r[6] + "</button></span></div>"; }).join("") +
        '<div class="fr dyt sum"><span class="c">합계</span><span class="c">6건</span><span class="c">23건</span><span class="c">14건</span><span class="c">9건</span><span class="c red">2건</span><span></span></div></div></div>';
      h += secH("t", "감지 유형별 처리 현황") + countTable(doc) + "</div></div>";
    } else {
      h += secH("b", "기본 정보") + '<div class="ft">' + f2("사업장", "{사업장명}", "일자", "2026.10.13 (화)") + f2("근무자", "{관제사}", "근무 시간", "{근무 시간}") + f2("로봇", "{로봇 ID}", "미션 수", "2건") + "</div></div>";
      h += secH("s", "처리 결과 요약") + '<div class="ft">' + f2("미션", "2건 (정상 완료 1, 중단 종료 1)", "점검 시간", "41분") + f2("알림", "12건 (위험 12, 주의 0)", "미조치", OPEN.length + "건", true) + "</div></div>";
      h += secH("m", "미션별 결과") + '<div class="ft"><div class="fr mst hd"><span>시작</span><span>미션 이름</span><span>유형</span><span>소요</span><span>완료 상태</span><span>알림</span><span>미조치</span><span>문서 번호</span></div>' +
        '<div class="fr mst"><span class="c">08:02</span><span>' + NAME + '</span><span class="c">자동</span><span class="c">12분</span><span class="c">중단 종료</span><span class="c">1건</span><span class="c">0건</span><span class="c"><button class="lk" data-doc="x">mission-20261013-0802</button></span></div>' +
        '<div class="fr mst"><span class="c">10:17</span><span>' + NAME + '</span><span class="c">수동</span><span class="c">29분</span><span class="c">정상 완료</span><span class="c">11건</span><span class="c red">1건</span><span class="c"><button class="lk" data-doc="m1017">mission-20261013-1017</button></span></div></div></div>';
      h += secH("t", "감지 유형별 처리 현황") + countTable(doc) + "</div></div>";
    }
    return h;
  }
  // 흐름 블록: {h} 통째, {open,rows,close} 표 시작, {row,cOpen,cClose} 쪽이 바뀌면 cOpen 으로 다시 연다, {brk} 새 쪽
  function blocks(id) {
    var doc = DOCS[id], b = [];
    function on(k) { return opt[id].has(k); }
    if (doc.kind === "m") {
      var evSec = function (k, grade) {
        var list = AL.filter(function (a) { return a[1] === grade; }), title = secH(k, grade + " 이벤트와 조치");
        if (!list.length) { b.push({ h: title + '<div class="ft"><div class="fr ev0"><span>' + grade + " 이벤트 없음</span></div></div></div>" }); return; }
        if (on("p")) {
          for (var i = 0; i < list.length; i += 2) {
            var r = '<div class="evp">' + evCard(list[i]) + (list[i + 1] ? evCard(list[i + 1]) : '<div class="evc"></div>') + "</div>";
            b.push(i === 0 ? { open: title + '<div class="ft">', rows: [r], close: "</div></div>" } : { row: r, cOpen: '<div class="ft">', cClose: "</div>" });
          }
        } else {
          list.forEach(function (a, j) { b.push(j === 0 ? { open: title + '<div class="ft">' + alertHd(false), rows: [alertRow(a, false)], close: "</div></div>" } : { row: alertRow(a, false), cOpen: '<div class="ft">' + alertHd(false), cClose: "</div>" }); });
        }
      };
      if (on("a")) { evSec("a", "위험"); }
      if (on("c")) { evSec("c", "주의"); }
      if (on("g")) {
        b.push({ h: secH("g", "게이지 판독 결과") + '<div class="ft"><div class="fr gau hd"><span>No</span><span>Waypoint</span><span>유형</span><span>최종 값</span><span>정상 범위</span><span>판정</span></div>' +
          GD.map(function (g, i) { var bad = g[4] === "비정상", na = g[4] === "판독 없음"; return '<div class="fr gau"><span class="c">' + String(i + 1).padStart(2, "0") + "</span><span>" + g[0] + '</span><span class="c' + (na ? " q" : "") + '">' + g[1] + '</span><span class="c' + (bad ? " red" : na ? " q" : "") + '">' + g[2] + '</span><span class="c' + (na ? " q" : "") + '">' + g[3] + '</span><span class="c' + (bad ? " red" : na ? " q" : "") + '">' + g[4] + "</span></div>"; }).join("") + "</div></div>" });
      }
      if (on("th")) { b.push(thermBlk(id)); }
      if (on("o")) { b.push(opinionBlk(id)); }
    } else {
      if (on("th")) { b.push(thermBlk(id)); }
      if (on("o")) { b.push(opinionBlk(id)); }
      if (on("n")) { b.push({ h: secH("n", "특이 사항") + '<div class="ft">' + fl("특이 사항", NOTE[id] ? esc(NOTE[id]).split("\n").join("<br>") : '<button class="note-add" data-note>+ 특이 사항 입력</button>') + "</div></div>" }); }
      if (doc.kind === "mo" && (on("tr") || on("ab"))) { b.push({ brk: true }); }
      if (doc.kind === "mo" && on("tr")) { b.push({ h: secH("tr", "설비별 추이") + '<div class="ft chs">' + TREND.map(trendChart).join("") + "</div></div>" }); }
      if (doc.kind === "mo" && on("ab")) { b.push({ h: secH("ab", "비정상 감지 추이") + '<div class="ft chs">' + abChart() + "</div></div>" }); }
    }
    return b;
  }
  // 추이(시안용 예시). 점검일 = 로봇이 해당 지점을 측정한 날
  var MDAY = [12, 13, 16, 21];
  var TREND = [
    { name: "WP-02 표면 최고 온도", type: "온도감지", unit: "°C", thr: 70, dir: "max", thrLabel: "기준 70°C 이하", v: [58.4, 134.8, 66.2, 61.0], lo: 40, hi: 140 },
    { name: "WP-10 표면 최고 온도", type: "온도감지", unit: "°C", thr: 70, dir: "max", thrLabel: "기준 70°C 이하", v: [55.1, 70.8, 63.5, 72.4], lo: 40, hi: 80 },
    { name: "#1 Upper Guide BRG 냉각수 유량", type: "계기인식", unit: "m³/h", thr: 6, dir: "min", thrLabel: "기준 6 m³/h 이상", v: [7.8, 0.0, 6.9, 5.4], lo: 0, hi: 10 }];
  var CW = 640, PL = 40, PR = 72, DAYN = 21;
  function xd(d) { return PL + (d - 1) * (CW - PL - PR) / (DAYN - 1); }
  function xAxis(y) { var t = ""; for (var d = 1; d <= DAYN; d++) { t += '<text x="' + xd(d) + '" y="' + (y + 14) + '" text-anchor="middle" class="' + (MDAY.indexOf(d) >= 0 ? "ax on" : "ax") + '">' + d + "</text>"; } return t + '<text x="' + (CW - PR + 18) + '" y="' + (y + 14) + '" class="ax">일</text>'; }
  function trendChart(t) {
    var H = 128, top = 10, bot = H - 22;
    function y(v) { return bot - (v - t.lo) * (bot - top) / (t.hi - t.lo); }
    function bad(v) { return t.dir === "max" ? v > t.thr : v < t.thr; }
    var g = "";
    [t.lo, (t.lo + t.hi) / 2, t.hi].forEach(function (v) { g += '<line x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (PL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + Math.round(v * 10) / 10 + "</text>"; });
    g += '<line x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(t.thr) + '" y2="' + y(t.thr) + '" class="thr"/><text x="' + (PL + 6) + '" y="' + (y(t.thr) - 5) + '" class="thl">기준 ' + t.thr + t.unit + "</text>";
    g += '<polyline points="' + MDAY.map(function (d, i) { return xd(d) + "," + y(t.v[i]); }).join(" ") + '" class="ln"/>';
    MDAY.forEach(function (d, i) {
      var v = t.v[i], b = bad(v);
      g += "<g><title>10." + d + " " + t.name + " " + v + t.unit + (b ? " (기준 벗어남)" : "") + '</title><circle cx="' + xd(d) + '" cy="' + y(v) + '" r="' + (b ? 5 : 4) + '" class="' + (b ? "pt bad" : "pt") + '"/>' +
        (b ? (y(v) > bot - 16 ? '<text x="' + (xd(d) + 9) + '" y="' + (y(v) - 4) + '" class="vl">' + v + "</text>" : '<text x="' + xd(d) + '" y="' + (y(v) - 9) + '" text-anchor="middle" class="vl">' + v + "</text>") : "") + "</g>";
    });
    return '<div class="ch"><div class="cht"><b>' + t.name + "</b><span>" + t.type + ", " + t.thrLabel + '</span></div><svg viewBox="0 0 ' + CW + " " + H + '" width="100%" role="img" aria-label="' + t.name + ' 점검일별 측정값">' + g + xAxis(bot) + "</svg></div>";
  }
  function abChart() {
    var D = { 12: [0, 2], 13: [12, 0], 16: [0, 3], 21: [2, 4] }, H = 178, top = 18, bot = H - 22, mx = 12, bw = 12;
    function y(v) { return bot - v * (bot - top) / mx; }
    var g = "";
    [0, 4, 8, 12].forEach(function (v) { g += '<line x1="' + PL + '" x2="' + (CW - PR) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (PL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + v + "</text>"; });
    Object.keys(D).forEach(function (d) {
      var cr = D[d][0], ca = D[d][1], x = xd(+d) - bw / 2, yy = bot, h;
      if (cr) { h = y(0) - y(cr); g += '<path d="M' + x + "," + yy + " v" + (-(h - 3)) + " q0,-3 3,-3 h" + (bw - 6) + " q3,0 3,3 v" + (h - 3) + ' z" class="br cr"/>'; yy -= h + 2; }
      if (ca) { h = y(0) - y(ca); g += '<path d="M' + x + "," + yy + " v" + (-(h - 3)) + " q0,-3 3,-3 h" + (bw - 6) + " q3,0 3,3 v" + (h - 3) + ' z" class="br ca"/>'; yy -= h; }
      g += '<text x="' + xd(+d) + '" y="' + (yy - 6) + '" text-anchor="middle" class="vl n">' + (cr + ca) + '</text><rect x="' + (x - 6) + '" y="' + top + '" width="' + (bw + 12) + '" height="' + (bot - top) + '" fill="transparent"><title>10.' + d + " 위험 " + cr + "건, 주의 " + ca + "건</title></rect>";
    });
    return '<div class="ch"><div class="cht"><b>일별 위험, 주의 알림</b><span class="lg"><i class="cr"></i>위험<i class="ca"></i>주의</span></div><svg viewBox="0 0 ' + CW + " " + H + '" width="100%" role="img" aria-label="10월 일별 위험, 주의 알림 건수">' + g + xAxis(bot) + '</svg><div class="chn">점검하지 않은 날은 막대 없음. 합계 위험 14건, 주의 9건</div></div>';
  }
  function thermBlk(id) { return { h: secH("th", "열화상 분석 결과") + '<div class="ft">' + f2("최고 온도", THERM[id][0], "고온감지", THERM[id][1]) + "</div></div>" }; }
  function opinionBlk(id) { return { h: secH("o", "종합 소견") + '<div class="ft">' + fl("소견", OPINION[id]) + "</div></div>" }; }

  /* ---------- 쪽 나누기 — 종이 높이(1123)에서 위아래 여백 · 머리줄을 뺀 만큼 ---------- */
  var LIMIT = 1123 - 40 - 48 - 26 - 20;
  var measureBox = document.createElement("div");
  measureBox.className = "rp-measure";
  body.appendChild(measureBox);
  function paginate(id) {
    measureBox.innerHTML = "";
    var probe = document.createElement("div");
    probe.className = "rp-page";
    probe.style.height = "auto";
    measureBox.appendChild(probe);
    function measure(html) { probe.innerHTML = html; return probe.firstElementChild.offsetHeight; }
    var pages = [[firstPage(DOCS[id])]], curP = [], h = 0;
    function flush() { pages.push(curP.map(function (e) { return typeof e === "string" ? e : e.open + e.rows.join("") + e.close; })); curP = []; h = 0; }
    blocks(id).forEach(function (blk) {
      if (blk.brk) { if (curP.length) { flush(); } return; }
      if (blk.row) {
        var rh = measure(blk.cOpen + blk.row + blk.cClose) - measure(blk.cOpen + blk.cClose);
        if (h + rh > LIMIT) { flush(); curP.push({ open: blk.cOpen, rows: [], close: blk.cClose }); h += measure(blk.cOpen + blk.cClose) + 20; }
        curP[curP.length - 1].rows.push(blk.row); h += rh; return;
      }
      var html = blk.open ? blk.open + blk.rows.join("") + blk.close : blk.h;
      var bh = measure(html) + 20;
      if (h + bh > LIMIT && curP.length) { flush(); }
      curP.push(blk.open ? { open: blk.open, rows: blk.rows.slice(), close: blk.close } : html); h += bh;
    });
    if (curP.length) { flush(); }
    measureBox.innerHTML = "";
    return pages;
  }
  function sizeEst(id) { var s = 0.1; if (id === "m1017" && opt[id].has("p")) { s += 1.5; } return s < 1 ? Math.round(s * 1000) + " KB" : s.toFixed(1) + " MB"; }

  /* ---------- 뷰어 ---------- */
  var VIEWER = '<div class="rp-viewer"><nav class="rp-toc" data-v="toc" aria-label="문서 목차"></nav><div class="rp-pages" data-v="pages"></div><div class="rp-pgno t-caption num" data-v="pgno" aria-live="polite"></div></div>';
  var DL = '<button type="button" class="btn btn-ghost" data-v="cfg" aria-haspopup="dialog">' + ic("settings") + '문서 구성</button>' +
    '<button type="button" class="btn btn-secondary" data-v="docx">DOCX 내려받기</button>' +
    '<button type="button" class="btn btn-accent" data-v="pdf">PDF 내려받기</button>';
  function initViewer(rootEl, actsEl, popUp, id) {
    var doc = DOCS[id], count = 0, busy = false;
    function q(s) { return rootEl.querySelector('[data-v="' + s + '"]'); }
    function qa(s) { return actsEl.querySelector('[data-v="' + s + '"]'); }
    var pagesEl = q("pages"), tocEl = q("toc"), pgnoEl = q("pgno");
    function topOf(el) { return el.getBoundingClientRect().top - pagesEl.getBoundingClientRect().top + pagesEl.scrollTop; }
    // 머리가 종이 위에 겹쳐 있으면(보고서 메뉴) 종이 칸 위 여백 = 머리 높이 + 20 — 그만큼 아래를 "보이는 맨 위"로 친다
    function over() { return Math.max(0, (parseFloat(getComputedStyle(pagesEl).paddingTop) || 0) - 20); }
    function sync() {
      var y = pagesEl.scrollTop + over() + 140, pg = 1, c = null;
      Array.prototype.forEach.call(pagesEl.children, function (p, i) { if (topOf(p) <= pagesEl.scrollTop + pagesEl.clientHeight / 2) { pg = i + 1; } });
      if (pgnoEl) { pgnoEl.textContent = pg + " / " + count + " 쪽"; }
      Array.prototype.forEach.call(pagesEl.querySelectorAll("[data-sec]"), function (el) { if (topOf(el) <= y) { c = el.getAttribute("data-sec"); } });
      if (!c) { var f = pagesEl.querySelector("[data-sec]"); c = f && f.getAttribute("data-sec"); }
      Array.prototype.forEach.call(tocEl.querySelectorAll("button"), function (b) { b.classList.toggle("is-on", b.getAttribute("data-k") === c); });
    }
    function render() {
      var pages = paginate(id);
      count = pages.length;
      pagesEl.innerHTML = pages.map(function (bl) { return '<article class="rp-page">' + head(doc.no) + bl.join("") + "</article>"; }).join("");
      pagesEl.scrollTop = 0;
      // 섹션 번호 — 문서 제목과 목차가 같은 번호를 쓴다(빠진 섹션이 있으면 다시 매김)
      Array.prototype.forEach.call(pagesEl.querySelectorAll(".f-sec > .f-h"), function (h, i) { h.textContent = (i + 1) + ". " + h.textContent; });
      var items = Array.prototype.map.call(pagesEl.querySelectorAll("[data-sec]"), function (el) {
        var pg = Array.prototype.indexOf.call(pagesEl.children, el.closest(".rp-page")) + 1;
        return '<button type="button" class="t-body-4" data-k="' + el.getAttribute("data-sec") + '">' + el.querySelector(".f-h").textContent + '<span class="t-caption">' + pg + "쪽</span></button>";
      }).join("");
      // 목차 — 머리(목차 · 총 N쪽) · 항목 · 아래 생성 시각(Figma 목차 209)
      tocEl.innerHTML = '<h4 class="rp-th t-caption"><span>목차</span><span>총 ' + count + "쪽</span></h4>" + items + '<div class="rp-pn t-caption">' + (doc.kind === "m" ? "자동 생성 2026.10.13 10:46" : doc.kind === "d" ? "자동 생성 2026.10.13 18:00" : "생성 2026.10.22 14:12") + "</div>";
      Array.prototype.forEach.call(tocEl.querySelectorAll("button"), function (b) {
        b.onclick = function () { var el = pagesEl.querySelector('[data-sec="' + b.getAttribute("data-k") + '"]'); if (el) { pagesEl.scrollTo({ top: topOf(el) - over() - 60, behavior: "smooth" }); } };
      });
      sync();
      var s = actsEl.querySelector("[data-cfg-sum]");
      if (s) { s.innerHTML = "<span>총 " + count + "쪽</span><span>PDF 약 " + sizeEst(id) + "</span>"; }
    }
    pagesEl.addEventListener("scroll", sync);
    pagesEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ev]");
      if (b) { openLB(+b.getAttribute("data-ev")); return; }
      var l = e.target.closest("[data-doc]");
      if (l) { if (DOCS[l.getAttribute("data-doc")]) { selectDoc(l.getAttribute("data-doc")); } else { plainToast("시안에서는 연결되지 않은 보고서예요"); } }
    });
    function closePops() { Array.prototype.forEach.call(actsEl.querySelectorAll(".rp-pop"), function (p) { p.remove(); }); }
    // 특이 사항 입력(일일 · 월간)
    if (doc.kind !== "m" && !qa("note")) {
      qa("cfg").insertAdjacentHTML("beforebegin", '<button type="button" class="btn btn-ghost" data-v="note" aria-haspopup="dialog">' + ic("message") + "특이 사항 입력</button>");
    }
    function openNote() {
      var ex = actsEl.querySelector("[data-pop=note]");
      closePops();
      if (ex) { return; }
      var box = document.createElement("div");
      box.className = "rp-pop" + (popUp ? " is-up" : "");
      box.setAttribute("data-pop", "note");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", "특이 사항 입력");
      box.innerHTML = '<h4 class="t-title-2">특이 사항</h4><p class="rp-fx t-caption">입력한 내용이 문서의 특이 사항 칸에 들어가요. 비워 두면 빈칸으로 나가요.</p>' +
        '<textarea class="t-body-4" rows="6" maxlength="500" placeholder="예: 10:36 WP-10 고온은 다음 근무자가 현장 확인 예정"></textarea>' +
        '<div class="rp-sum t-caption"><span data-note-cnt></span><span class="rp-nb"><button type="button" class="btn btn-secondary" data-note-cancel>취소</button><button type="button" class="btn btn-accent" data-note-save>저장</button></span></div>';
      actsEl.appendChild(box);
      var tx = box.querySelector("textarea"), cnt = box.querySelector("[data-note-cnt]");
      tx.value = NOTE[id] || "";
      function upd() { cnt.textContent = tx.value.length + " / 500"; }
      upd(); tx.oninput = upd; tx.focus();
      box.querySelector("[data-note-cancel]").onclick = function () { box.remove(); };
      box.querySelector("[data-note-save]").onclick = function () {
        NOTE[id] = tx.value.trim(); box.remove(); render();
        var el = pagesEl.querySelector('[data-sec="n"]');
        if (el) { pagesEl.scrollTo({ top: topOf(el) - over() - 60, behavior: "smooth" }); }
        plainToast(NOTE[id] ? "특이 사항을 저장했어요" : "특이 사항을 비웠어요");
      };
    }
    if (qa("note")) { qa("note").onclick = openNote; }
    pagesEl.addEventListener("click", function (e) { if (e.target.closest("[data-note]")) { openNote(); } });
    qa("cfg").onclick = function () {
      var ex = actsEl.querySelector("[data-pop=cfg]");
      closePops();
      if (ex) { return; }
      var box = document.createElement("div");
      box.className = "rp-pop" + (popUp ? " is-up" : "");
      box.setAttribute("data-pop", "cfg");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", "문서 구성");
      box.innerHTML = '<h4 class="t-title-2">내려받을 문서 구성</h4><p class="rp-fx t-caption">1쪽(기본 정보, 요약, 유형별 현황)은 항상 들어가요</p><div>' +
        doc.flow.map(function (f) { return '<label class="rp-ck t-body-4"><input type="checkbox" value="' + f[0] + '"' + (opt[id].has(f[0]) ? " checked" : "") + ">" + f[1] + "</label>"; }).join("") +
        '</div><div class="rp-sep"></div><div class="rp-sum t-caption" data-cfg-sum></div>';
      actsEl.appendChild(box);
      Array.prototype.forEach.call(box.querySelectorAll("input[value]"), function (c) {
        c.addEventListener("change", function () { if (c.checked) { opt[id].add(c.value); } else { opt[id].delete(c.value); } render(); });
      });
      render();
    };
    function download(ext) {
      if (busy) { return; }
      busy = true; closePops();
      var btn = qa(ext), label = btn.innerHTML;
      btn.innerHTML = '<span class="rp-spin" aria-hidden="true"></span>' + ext.toUpperCase() + " 만드는 중";
      qa("pdf").disabled = qa("docx").disabled = true;
      setTimeout(function () {
        busy = false; btn.innerHTML = label; qa("pdf").disabled = qa("docx").disabled = false;
        toast(doc.file + "_" + doc.no + "." + ext + " 내려받기 완료", "열기", function () { plainToast("내려받은 파일 열기는 실제 서비스에서 동작해요"); });
      }, 1300);
    }
    qa("pdf").onclick = function () { download("pdf"); };
    qa("docx").onclick = function () { download("docx"); };
    render();
  }

  /* ---------- 보고서 메뉴 ---------- */
  var vm = 10;   // 보고 있는 달(2026년)
  var MAXM = 10, TODAY = 22;
  var list = body.querySelector("[data-rp-list]"), side = body.querySelector("[data-rp-side]"), detail = body.querySelector("[data-rp-detail]");
  var dh = body.querySelector("[data-rp-dh]");
  // 머리 메타 — 라벨(text/tertiary) · 값 짝. 마지막은 늘 문서 번호
  function metaHtml(d) {
    return d.meta.concat([["문서 번호", d.no]]).map(function (m) { return '<span><span class="rp-mlb">' + m[0] + '</span><span class="num">' + m[1] + "</span></span>"; }).join("");
  }
  // 그달이 다 끝나기 전에 만든 월 보고서 — 제목 옆 "중간 집계"(다 끝난 달 보고서와 헷갈리지 않게)
  function partTag(d) { return d.part ? '<span class="badge badge-idle t-caption">중간 집계</span>' : ""; }
  function detailHead(id) {
    var d = DOCS[id];
    return '<div><p class="rp-eb t-caption">' + d.title + '</p><h2 class="t-title-2">' + d.head + partTag(d) + "</h2>" +
      '<p class="rp-meta t-body-4">' + metaHtml(d) + "</p></div>" +
      '<div class="rp-acts" data-rp-acts>' + DL + "</div>";
  }
  // 머리 높이 — 종이 · 목차가 머리 뒤에서 시작하는 자리(CSS --rp-dh-h). 단추 줄이 접히면 높이가 바뀌어 늘 다시 잰다
  function measureHead() { detail.style.setProperty("--rp-dh-h", dh.offsetHeight + "px"); }
  if (window.ResizeObserver) { new ResizeObserver(measureHead).observe(dh); }
  function openDetail() {
    dh.innerHTML = detailHead(cur);
    measureHead();
    var old = detail.querySelector(".rp-viewer");
    if (old) { old.remove(); }
    detail.insertAdjacentHTML("beforeend", VIEWER);
    initViewer(detail, dh.querySelector("[data-rp-acts]"), false, cur);
  }
  function selectDoc(id) { cur = id; closeModal(); renderList(); openDetail(); }
  function daysIn(m) { return new Date(2026, m, 0).getDate(); }
  function rangeOf(m) { return m === MAXM ? "10.01 ~ 10." + (TODAY - 1) : String(m).padStart(2, "0") + ".01 ~ " + String(m).padStart(2, "0") + "." + daysIn(m); }

  /*
   * 줄 하나. 날짜 줄(is-day) = 그날 일일 보고서 — 문서 아이콘 · Title/2, 오른쪽 미션 수.
   * 미션 줄(is-mission) = └ 가지 · Body/3, 오른쪽 시각. 근무가 안 끝난 날(live)은 "작성 중"으로 못 누른다.
   */
  function dayRow(id, name, meta, isOn, live) {
    return '<button type="button" class="rp-item is-day' + (live ? " is-live" : "") + '" data-id="' + (id || "") + '"' + (isOn ? ' aria-current="true"' : "") + (live ? " disabled" : "") + ">" +
      '<span class="rp-a t-label-1">' + ic("document") + "<b>" + name + '</b></span><span class="rp-tm t-caption num">' + meta + "</span></button>";
  }
  function missionRow(id, time, isOn) {
    return '<button type="button" class="rp-item is-mission" data-id="' + (id || "") + '"' + (isOn ? ' aria-current="true"' : "") + ">" +
      '<span class="rp-a t-body-4"><span class="rp-br" aria-hidden="true"></span><b>' + NAME + '</b></span><span class="rp-tm t-caption num">' + time + "</span></button>";
  }

  /*
   * 월 보고서 단추 — 한 단추가 상태만 바꾼다.
   *   none  [월 보고서 생성]
   *   busy  돌림표 + 월 보고서 만드는 중(누를 수 없음)
   *   made  월 보고서 최신 · 기간(누를 수 없음) — 만든 뒤 날짜가 더 쌓이면 실제 서비스에선 "다시 만들기 (기간)"으로 살아난다
   * 만든 월 보고서는 목록 맨 위(날짜 줄들 위)에 고정된다.
   */
  var moBtn = body.querySelector("[data-mo-go]");
  function drawMoBtn() {
    var made = vm === 10 && moState === "made", busy = vm === 10 && moState === "busy";
    moBtn.disabled = made || busy;
    moBtn.innerHTML = busy ? '<span class="rp-spin" aria-hidden="true"></span>월 보고서 만드는 중' : made ? "월 보고서 최신 · " + rangeOf(vm) : "월 보고서 생성";
    moBtn.title = made ? "이 달에 새로 쌓인 날짜가 없어요" : "";
  }
  moBtn.onclick = function () {
    if (vm !== 10) { plainToast("시안에서는 10월만 연결돼요"); return; }
    moState = "busy"; drawMoBtn();
    setTimeout(function () { moState = "made"; selectDoc("mo10"); plainToast("10월 월 보고서를 만들었어요"); }, 1200);
  };

  function renderList() {
    var html = "", n = 0;
    var mt = body.querySelector("[data-rp-mt]");
    mt.textContent = "2026년 " + vm + "월";
    mt.setAttribute("aria-label", "2026년 " + vm + "월, 날짜로 찾기");
    body.querySelector("[data-rp-next]").disabled = vm >= MAXM;
    if (vm === 10) {
      if (moState === "made") { n++; html += '<div class="rp-grp is-month">' + dayRow("mo10", "10월 월 보고서", rangeOf(vm), cur === "mo10") + "</div>"; }
      DAYS.forEach(function (d) {
        if (!d.live) { n++; }
        html += '<div class="rp-grp" role="listitem" data-day="' + d.day + '">' + dayRow(d.dayRpt.id, d.d, d.live ? "작성 중" : "미션 " + d.dayRpt.n, d.dayRpt.id && d.dayRpt.id === cur, d.live);
        d.missions.forEach(function (m) { n++; html += missionRow(m.id, m.t, m.id && m.id === cur); });
        html += "</div>";
      });
    } else {
      html += '<p class="rp-empty t-body-4">이 달의 보고서가 없어요 (시안 예시는 10월만)</p>';
    }
    body.querySelector("[data-rp-cnt]").textContent = n + "건";
    list.innerHTML = html;
    drawMoBtn();
    Array.prototype.forEach.call(list.querySelectorAll(".rp-item"), function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-id");
        if (!id) { plainToast("시안에서는 10월 13일 보고서 두 건과 월 보고서만 연결돼요"); return; }
        if (id !== cur) { selectDoc(id); }
      };
    });
  }
  body.querySelector("[data-rp-prev]").onclick = function () { vm--; closeCal(); renderList(); };
  body.querySelector("[data-rp-next]").onclick = function () { if (vm < MAXM) { vm++; closeCal(); renderList(); } };

  /*
   * 달력 — 날짜로 찾기(10/29 디자이너: 달 제목을 누르면 뜬다). 달 이동 줄 바로 아래, 목록 위에 뜨는 판.
   * 보고서가 있는 날만 누를 수 있다(점). 누르면 그달로 옮겨 그날 일일 보고서를 열고 목록에서 그 날짜로 내려간다.
   * 오늘처럼 근무가 안 끝난 날은 일일 보고서가 없어 목록만 그 날짜로 옮긴다.
   */
  var mtBtn = body.querySelector("[data-rp-mt]");
  function closeCal() {
    var c = side.querySelector(".rp-cal");
    if (c) { c.remove(); }
    mtBtn.setAttribute("aria-expanded", "false");
  }
  function toggleCal() {
    if (side.querySelector(".rp-cal")) { closeCal(); return; }
    var p = document.createElement("div");
    p.className = "rp-cal";
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "날짜로 찾기");
    var row = side.querySelector(".rp-mrow");
    p.style.top = (row.getBoundingClientRect().bottom - side.getBoundingClientRect().top + 8) + "px";
    side.appendChild(p);
    mtBtn.setAttribute("aria-expanded", "true");
    drawCal(p, vm);
  }
  function reportDays(m) { return m === 10 ? DAYS.map(function (d) { return d.day; }) : []; }
  function drawCal(p, m) {
    var first = new Date(2026, m - 1, 1).getDay(), n = daysIn(m), has = reportDays(m), cells = "";
    for (var i = 0; i < first; i++) { cells += "<span></span>"; }
    for (var d = 1; d <= n; d++) {
      var fut = m === MAXM && d > TODAY, on = has.indexOf(d) >= 0;
      cells += '<button type="button" class="rp-cd t-body-4 num' + (on ? " has" : "") + (m === MAXM && d === TODAY ? " is-today" : "") + '" data-d="' + d + '"' + (on ? "" : " disabled") +
        ' aria-label="' + m + "월 " + d + "일" + (on ? ", 보고서 있음" : fut ? ", 아직 없음" : ", 보고서 없음") + '">' + d + "</button>";
    }
    p.innerHTML = '<div class="rp-cal-h"><button type="button" class="rp-ib" data-cm="-1" aria-label="이전 달">' + ic("chevron-left") + '</button><b class="t-title-2">2026년 ' + m + '월</b><button type="button" class="rp-ib" data-cm="1" aria-label="다음 달"' + (m >= MAXM ? " disabled" : "") + ">" + ic("chevron-right") + "</button></div>" +
      '<div class="rp-cg">' + ["일", "월", "화", "수", "목", "금", "토"].map(function (w) { return '<span class="rp-w t-caption">' + w + "</span>"; }).join("") + cells + "</div>" +
      '<div class="rp-cf t-caption"><span><i></i>보고서 있는 날</span>' + (m === 10 ? "" : "<span>시안 예시는 10월만</span>") + "</div>";
    Array.prototype.forEach.call(p.querySelectorAll("[data-cm]"), function (b) { b.onclick = function () { var nm = m + (+b.getAttribute("data-cm")); if (nm <= MAXM) { drawCal(p, nm); } }; });
    Array.prototype.forEach.call(p.querySelectorAll(".rp-cd.has"), function (b) {
      b.onclick = function () {
        var day = +b.getAttribute("data-d"), dd = DAYS.filter(function (x) { return x.day === day; })[0];
        vm = m; closeCal();
        if (dd && dd.dayRpt.id) { selectDoc(dd.dayRpt.id); } else { renderList(); }
        var g = list.querySelector('.rp-grp[data-day="' + day + '"]');
        if (g) {
          g.scrollIntoView({ block: "start", behavior: "smooth" });
          g.classList.add("is-flash");
          setTimeout(function () { g.classList.remove("is-flash"); }, 1200);
        }
      };
    });
  }
  mtBtn.onclick = function (e) { e.stopPropagation(); toggleCal(); };
  // 바깥을 누르면 닫는다
  document.addEventListener("click", function (e) {
    var c = side.querySelector(".rp-cal");
    // composedPath — 달 넘김 단추는 누르는 순간 달력이 새로 그려져 떨어져 나가므로 contains 로는 못 잡는다
    if (c && e.composedPath().indexOf(c) < 0 && e.target !== mtBtn) { closeCal(); }
  });
  // 목록 접기 — 머리 아이콘만 남기고 보고서를 넓게 본다
  var fold = body.querySelector("[data-rp-fold]");
  fold.onclick = function () {
    var on = body.classList.toggle("is-fold");
    fold.setAttribute("aria-expanded", on ? "false" : "true");
    fold.setAttribute("aria-label", on ? "보고서 목록 펴기" : "보고서 목록 접기");
  };

  /* ---------- 다른 화면(관제)에서 열기 — 같은 뷰어를 모달로 ---------- */
  var modal = null;
  function openModal(id) {
    id = id || "m1017";
    closeModal();
    var d = DOCS[id];
    modal = document.createElement("div");
    modal.innerHTML = '<div class="rp-modal-scrim" data-m-close></div><section class="rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-mt">' +
      '<div class="rp-mhd"><div><h2 class="t-title-2" id="rp-mt">' + d.title + partTag(d) + '</h2><p class="rp-meta t-body-4">' + metaHtml(d) + "</p></div>" +
      '<button type="button" class="icon-button modal-close" data-m-close aria-label="닫기"><span class="i i-20" style="--i:var(--ic-close)"></span></button></div>' +
      '<div style="display:flex;min-height:0">' + VIEWER + "</div>" +
      '<div class="rp-mft"><button type="button" class="rp-link t-label-2" data-m-menu>보고서 메뉴에서 보기' + ic("chevron-right") + '</button><div class="rp-acts" data-m-acts>' + DL + "</div></div></section>";
    document.body.appendChild(modal);
    Array.prototype.forEach.call(modal.querySelectorAll("[data-m-close]"), function (b) { b.onclick = closeModal; });
    modal.querySelector("[data-m-menu]").onclick = function () { selectDoc(id); };
    modal.querySelector(".rp-viewer").style.flex = "1";
    initViewer(modal.querySelector(".rp-modal"), modal.querySelector("[data-m-acts]"), true, id);
    modal.querySelector("[data-m-close].icon-button").focus();
  }
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  window.APRISM_REPORT = { open: openModal };

  /* ---------- 토스트 · 사진 크게 보기 ---------- */
  var tT = null;
  function toast(msg, act, onAct, top) {
    Array.prototype.forEach.call(body.querySelectorAll(".toast"), function (t) { t.remove(); });
    var t = document.createElement("div");
    t.className = "toast" + (top ? " is-top" : "");
    t.setAttribute("role", "status");
    t.innerHTML = '<span class="t-label-2">' + esc(msg) + "</span>" + (act ? '<button type="button" class="btn btn-ghost is-xs toast-undo">' + act + "</button>" : "");
    if (!act) { t.style.paddingRight = "var(--space-16)"; t.style.minHeight = "32px"; }
    body.appendChild(t);
    if (act) { t.querySelector("button").onclick = onAct; }
    clearTimeout(tT);
    tT = setTimeout(function () { t.remove(); }, top ? 2600 : 5000);
  }
  function plainToast(m) { toast(m, null, null, true); }
  var lbi = 0;
  function openLB(i) {
    lbi = i;
    var d = document.createElement("div");
    d.className = "rp-lb";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "이벤트 사진 크게 보기");
    d.innerHTML = '<button type="button" class="rp-x" data-lb-x aria-label="닫기">' + ic("close", 20) + '</button><button type="button" class="rp-nv" data-lb-p style="left:var(--space-48)" aria-label="이전">' + ic("chevron-left", 20) + '</button><figure><img data-lb-img alt=""><figcaption class="t-body-3 num" data-lb-cap></figcaption></figure><button type="button" class="rp-nv" data-lb-n style="right:var(--space-48)" aria-label="다음">' + ic("chevron-right", 20) + "</button>";
    document.body.appendChild(d);
    d.onclick = function (e) { if (e.target === d) { d.remove(); } };
    d.querySelector("[data-lb-x]").onclick = function () { d.remove(); };
    d.querySelector("[data-lb-p]").onclick = function () { lbi--; drawLB(); };
    d.querySelector("[data-lb-n]").onclick = function () { lbi++; drawLB(); };
    drawLB();
    d.querySelector("[data-lb-x]").focus();
  }
  function drawLB() {
    var d = document.querySelector(".rp-lb"), x = EV[lbi];
    if (!d) { return; }
    d.querySelector("[data-lb-img]").src = x.img;
    d.querySelector("[data-lb-cap]").innerHTML = "<span>" + String(lbi + 1).padStart(2, "0") + " / " + EV.length + "</span><span>2026-10-13 " + x.t + "</span><span>" + x.type + ' <span class="rp-v">' + x.v + "</span></span>";
    d.querySelector("[data-lb-p]").disabled = lbi === 0;
    d.querySelector("[data-lb-n]").disabled = lbi === EV.length - 1;
  }
  document.addEventListener("keydown", function (e) {
    var lb = document.querySelector(".rp-lb");
    if (lb) {
      if (e.key === "Escape") { lb.remove(); }
      if (e.key === "ArrowLeft" && lbi > 0) { lbi--; drawLB(); }
      if (e.key === "ArrowRight" && lbi < EV.length - 1) { lbi++; drawLB(); }
      return;
    }
    if (e.key === "Escape") {
      var pops = document.querySelectorAll(".rp-pop");
      if (pops.length) { Array.prototype.forEach.call(pops, function (p) { p.remove(); }); } else if (modal) { closeModal(); } else { closeCal(); }
    }
  });

  /* ---------- 시작 — 주소 #day · #month · #modal 로 장면을 바로 연다(시안과 같은 이름) ---------- */
  var hash = location.hash;
  if (hash === "#day") { cur = "d1013"; }
  if (hash === "#month") { cur = "mo10"; moState = "made"; }
  renderList();
  openDetail();
  if (hash === "#modal") { setTimeout(function () { openModal("m1017"); }, 50); }
})();
