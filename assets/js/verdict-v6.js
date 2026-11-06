/*
 * [11/06 v6] 판정 글 하나로 — "기준 초과 +0.06 MPa". 안전진단 상세(safety.js)와 관제 알림 팝오버(monitor.js)가 같이 쓴다(디자이너).
 *   차이는 정상 한계(주의 기준 · 범위 끝)에서 잰다. 자릿수 · 단위는 값을 따른다. 안전감지는 "기준 위반".
 *   기준 값은 안전진단 기준(safety.js STD · COND)과 같다. 계기는 단위로 기준을 고른다(MPa · Pa · bar).
 */
(function () {
  "use strict";
  var LIM = { "누출감지": [55, "%"], "온도감지": [40, " ℃"], "이상음향": [19, ""], "부분방전": [8.6, ""] };
  var GAUGE = { "MPa": [0.60, 0.80], "Pa": [null, 250], "bar": [6.0, 7.5] };
  function verdict(detect, value) {
    if (detect === "안전감지") { return "기준 위반"; }
    var m = String(value || "").match(/(-?\d+(?:\.\d+)?)\s*(℃|%|MPa|kPa|Pa|bar)?/);
    if (!m) { return ""; }
    var v = parseFloat(m[1]), decs = (m[1].split(".")[1] || "").length, lo = null, hi, unit;
    if (detect === "계기인식") {
      var g = GAUGE[m[2]]; if (!g) { return "기준 초과"; }
      lo = g[0]; hi = g[1]; unit = " " + m[2];
    } else if (LIM[detect]) {
      hi = LIM[detect][0]; unit = LIM[detect][1];
    } else { return ""; }
    if (lo !== null && v < lo) { return "기준 미달 −" + (lo - v).toFixed(decs) + unit; }
    return "기준 초과 +" + Math.max(0, v - hi).toFixed(decs) + unit;
  }
  window.APRISM_VERDICT = verdict;
})();
