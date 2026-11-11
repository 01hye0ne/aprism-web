/*
 * [11/02 v6] 층 평면 미니맵 — 안전진단(safety.js svg2)의 평면 · 순회 선을 다른 화면에서도 쓰려고 꺼낸 공용 그림.
 * 데이터(PLAN2 · WP2 · TOUR2)와 선 셈(tour2 · pos2 · cut2)은 safety.js 와 같은 값이다 — 평면이 바뀌면 둘 다 고친다.
 * 지금 쓰는 곳: 통합 순회(전체 미션) 층 펼침 아래 미션 칩(building.js), 안전진단 지도(safety.js svg2 — routeL).
 * 경로는 미션별 실제 길(mini-routes.js)이 있으면 그것, 없으면 층 공통 시안 선(tour2).
 *
 *   APRISM_MINI.svg({ floor:"B3", n:지점 수, done:지난 지점 수, robot:true|false(이 층에 로봇이 있나),
 *                     marks:{지점 순번(0부터): "crit"|"warn"}, kind:"spot"|"wheel", land:true(가로로 눕힘) })
 * 경로 표현은 관제 · 안전진단 큰 지도와 같다 — 지나온 길 동그란 점선 · 지금 구간 진한 실선 · 앞길 옅은 파랑 띠, 위험 · 주의 = 작은 세모.
 */
(function () {
  "use strict";
  const PLAN2 = {"B4":{"wall":[[0,1365,388,5],[0,0,825,5],[645,903,5,270],[550,1015,5,158],[383,1253,350,5],[645,1170,195,5],[173,200,258,5],[243,355,78,5],[133,898,518,5],[645,350,5,548],[645,3,5,268],[383,978,5,393],[388,1015,93,5],[430,453,5,45],[173,483,258,5],[168,200,5,400],[173,355,35,5],[430,200,5,190],[353,355,78,5],[173,595,263,5],[430,533,5,63],[835,0,5,1175],[738,198,98,5],[0,0,5,1370],[5,898,58,5],[835,1190,5,180],[795,1253,40,5]],"equipment":[[23,20,240,60],[263,23,3,55],[28,643,28,115],[558,295,83,63],[153,733,228,90],[23,830,53,60],[80,1070,88,258],[113,960,55,110],[175,208,253,145],[285,1000,75,335],[440,588,155,263]],"stairs":[[600,1120,45,43],[603,1108,40,3],[603,1075,40,3],[603,1053,40,3],[603,1020,40,3],[600,1020,45,13],[600,1033,45,10],[600,1020,45,13],[600,1043,45,10],[600,1053,45,13],[600,1065,45,10],[600,1075,45,13],[600,1088,45,10],[600,1098,45,10],[600,1108,45,13],[600,1120,45,43],[603,1108,40,3],[603,1075,40,3],[603,1053,40,3],[603,1020,40,3],[600,1020,45,13],[600,1033,45,10],[600,1020,45,13],[600,1043,45,10],[600,1053,45,13],[600,1065,45,10],[600,1075,45,13],[600,1088,45,10],[600,1098,45,10],[600,1108,45,13],[333,493,43,50],[320,493,3,48],[288,493,3,48],[265,493,3,48],[255,493,3,48],[233,493,3,48],[233,493,13,50],[245,493,10,50],[233,493,13,50],[255,493,13,50],[268,493,10,50],[278,493,10,50],[288,493,13,50],[300,493,10,50],[310,493,10,50],[320,493,13,50],[333,493,43,50],[320,493,3,48],[288,493,3,48],[265,493,3,48],[255,493,3,48],[233,493,3,48],[233,493,13,50],[245,493,10,50],[233,493,13,50],[255,493,13,50],[268,493,10,50],[278,493,10,50],[288,493,13,50],[300,493,10,50],[310,493,10,50],[320,493,13,50]]},"B3":{"wall":[[0,1365,388,5],[0,0,825,5],[645,903,5,270],[550,1015,5,158],[383,1253,350,5],[645,1170,195,5],[173,200,258,5],[243,355,78,5],[645,3,5,268],[383,978,5,393],[388,1015,93,5],[168,200,5,400],[173,355,35,5],[430,200,5,190],[353,355,78,5],[835,0,5,1175],[738,198,98,5],[0,0,5,1370],[5,898,58,5],[835,1190,5,180],[795,1253,40,5],[430,453,5,45],[173,483,258,5],[173,595,263,5],[430,533,5,63]],"equipment":[[560,788,228,90],[560,288,228,90],[560,285,225,3],[560,465,228,93],[560,633,228,93],[148,1250,228,93],[148,1073,228,90],[148,905,228,93],[148,725,228,93],[285,18,85,60],[23,20,240,60],[263,23,3,55],[175,208,253,145]],"stairs":[[228,543,45,50],[270,543,3,48],[293,543,3,48],[303,543,3,48],[325,543,3,48],[358,543,3,48],[360,543,10,50],[348,543,13,50],[360,543,10,50],[338,543,10,50],[328,543,10,50],[315,543,13,50],[305,543,10,50],[295,543,10,50],[283,543,13,50],[273,543,10,50],[228,543,45,50],[270,543,3,48],[293,543,3,48],[303,543,3,48],[325,543,3,48],[358,543,3,48],[360,543,10,50],[348,543,13,50],[360,543,10,50],[338,543,10,50],[328,543,10,50],[315,543,13,50],[305,543,10,50],[295,543,10,50],[283,543,13,50],[273,543,10,50],[555,1060,45,10],[555,1070,45,10],[555,1080,45,13],[555,1093,45,10],[555,1103,45,13],[555,1115,45,10],[555,1125,45,10],[555,1148,45,10],[555,1135,45,13],[555,1148,45,10],[558,1145,43,3],[558,1113,43,3],[558,1090,43,3],[558,1058,43,3],[555,1015,45,45],[555,1060,45,10],[555,1070,45,10],[555,1080,45,13],[555,1093,45,10],[555,1103,45,13],[555,1115,45,10],[555,1125,45,10],[555,1148,45,10],[555,1135,45,13],[555,1148,45,10],[558,1145,43,3],[558,1113,43,3],[558,1090,43,3],[558,1058,43,3],[555,1015,45,45]]}};
  const R2 = (x, y) => [x, 1370 - y];
  const WP2 = {'01':[515,250],'02':[260,510],'03':[100,280],'04':[100,760],'05':[100,1000],'06':[280,1240],'07':[500,950],'08':[810,1060],'09':[810,780],'10':[810,620],'11':[700,480],'12':[620,420],'13':[510,415],'14':[300,420],'15':[100,580],'16':[100,900],'17':[150,1240],'18':[470,1240],'19':[520,1088],'20':[695,700]};
  const TOUR2 = {
    B3:[[577,370],[515,370],'01',[515,510],'02',[100,510],'03','04','05',[100,1240],'06',[500,1240],'07',[810,950],'08','09','10',[810,480],'11',[620,480],'12',[577,420]],
    B4:[[622,362],[622,415],'13','14',[100,425],'15','16',[100,1240],'17','18',[520,1240],'19',[695,1088],'20',[695,1290]]};
  function tour2(pf, n){
    const pts = [], at = []; TOUR2[pf].forEach(q => { if(typeof q==='string'){ at.push(pts.length); pts.push(R2(...WP2[q])); } else pts.push(R2(...q)); });
    const cum = [0]; for(let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    const sAt = at.length===n ? at.map(i => cum[i]) : Array.from({length:n}, (_, j) => len * (.06 + .88 * (n===1 ? .5 : j / (n - 1))));
    return {pts, cum, len, sAt};
  }
  function pos2(L, sv){ sv = Math.max(0, Math.min(L.len, sv)); let i = 1; while(i < L.pts.length - 1 && L.cum[i] < sv) i++;
    const a = L.pts[i - 1], b = L.pts[i], t = (sv - L.cum[i - 1]) / ((L.cum[i] - L.cum[i - 1]) || 1);
    return {x:a[0] + (b[0] - a[0]) * t, y:a[1] + (b[1] - a[1]) * t, ang:Math.atan2(b[1] - a[1], b[0] - a[0])}; }
  function cut2(L, s0, s1){ if(s1 <= s0) return ''; const o = [pos2(L, s0)]; for(let i = 1; i < L.pts.length; i++) if(L.cum[i] > s0 && L.cum[i] < s1) o.push({x:L.pts[i][0], y:L.pts[i][1]}); o.push(pos2(L, s1)); return o.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '); }

  /*
   * [11/02] 미션별 실제 길 — 관제 지도가 깐 길(mini-routes.js, tools/export-mini-routes.mjs 로 뽑음)을 쓴다.
   * 없거나 그 층에 길이 없으면 null(예전 층 공통 시안 선 tour2 로 그린다). 웨이포인트 수가 다르면 길 위 웨이포인트 구간에 고르게 다시 놓는다.
   */
  function routeL(mission, floor, n) {
    var R = window.APRISM_MINI_ROUTES && window.APRISM_MINI_ROUTES[mission], f = R && R[floor];
    if (!f || !f.pts || f.pts.length < 2) { return null; }
    var pts = f.pts, cum = [0];
    for (var i = 1; i < pts.length; i += 1) { cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    var len = cum[cum.length - 1], sAt = f.sAt.slice();
    if (n && sAt.length !== n) {
      var a = sAt.length ? sAt[0] : len * 0.04, b = sAt.length ? sAt[sAt.length - 1] : len * 0.96;
      sAt = Array.from({ length: n }, function (_, j) { return n === 1 ? (a + b) / 2 : a + (b - a) * j / (n - 1); });
    }
    return { pts: pts, cum: cum, len: len, sAt: sAt };
  }

  function svg(o) {
    var P = PLAN2[o.floor] || PLAN2.B4, L = (o.mission && routeL(o.mission, o.floor, Math.max(1, o.n))) || tour2(o.floor in TOUR2 ? o.floor : "B4", Math.max(1, o.n));
    var px = 888 / (o.w || 220), u = function (v) { return +(v * px).toFixed(1); };
    var done = Math.max(0, Math.min(o.n, o.done));
    var sCut = done <= 0 ? 0 : done >= o.n ? L.len : L.sAt[done - 1];
    var sR = o.robot && done < o.n ? (done > 0 ? L.sAt[done - 1] + (L.sAt[done] - L.sAt[done - 1]) * 0.35 : L.sAt[0] * 0.5) : null;
    if (sR !== null) { sCut = sR; }
    var sNext = sR !== null && done < o.n ? Math.max(sCut, L.sAt[done]) : sCut;
    var vb = o.land ? "-24 -864 1418 888" : "-24 -24 888 1418";
    var g = '<svg class="mini-plan" viewBox="' + vb + '" role="img" aria-label="' + (o.label || "") + '"><defs><filter id="mpbl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>';
    g += o.land ? '<g transform="rotate(-90)">' : "<g>";
    g += '<polyline class="mp-road" points="' + cut2(L, 0, L.len) + '" stroke-width="' + u(13) + '"/>';
    P.equipment.forEach(function (r) { if (r[2] >= 12 && r[3] >= 12) { g += '<rect class="mp-eq" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="4"/>'; } });
    P.wall.forEach(function (r) { g += '<rect class="mp-wl" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '"/>'; });
    if (sNext < L.len) { g += '<polyline class="mp-ahead" points="' + cut2(L, sNext, L.len) + '" stroke-width="' + u(3.4) + '"/>'; }
    if (sCut > 0) { g += '<polyline class="mp-past" points="' + cut2(L, 0, sCut) + '" stroke-width="' + u(2.6) + '" stroke-dasharray="0 ' + u(5.2) + '"/>'; }
    if (sNext > sCut) { g += '<polyline class="mp-cur" points="' + cut2(L, sCut, sNext) + '" stroke-width="' + u(3.4) + '"/>'; }
    for (var j = 0; j < o.n; j += 1) {
      var q = pos2(L, L.sAt[j]), mk = o.marks && o.marks[j];
      var t = "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ")" + (o.land ? " rotate(90)" : "");
      if (mk && o.dots) { g += '<circle transform="' + t + '" class="mp-' + (mk === "crit" ? "c" : "w") + '" r="' + u(3) + '" stroke-width="' + u(0.9) + '"/>'; }   // [11/11 v7] 위험 · 주의 = 단계 색 점(관제 지도 · 목록과 같은 말)
      else if (mk) { g += '<path transform="' + t + '" class="mp-' + (mk === "crit" ? "c" : "w") + '" d="M0 ' + u(-4.4) + " " + u(4.2) + " " + u(2.8) + " " + u(-4.2) + " " + u(2.8) + 'Z" stroke-width="' + u(0.9) + '" stroke-linejoin="round"/>'; }
      else if (j < done) { g += '<circle transform="' + t + '" class="mp-ok" r="' + u(2.2) + '"/>'; }
      else { g += '<circle transform="' + t + '" class="mp-plan" r="' + u(2.4) + '" stroke-width="' + u(1) + '"/>'; }
    }
    if (sR !== null) {
      var rq = pos2(L, sR), S = u(30), h = (S / 2).toFixed(1);
      g += '<g transform="translate(' + rq.x.toFixed(1) + "," + rq.y.toFixed(1) + ") rotate(" + (rq.ang * 180 / Math.PI).toFixed(1) + ')">' +
        '<ellipse class="mp-sh" cx="' + u(1) + '" cy="' + u(1.5) + '" rx="' + u(13) + '" ry="' + u(8) + '" filter="url(#mpbl)"/>' +
        '<image href="../assets/img/safety/robot-top-' + (o.kind || "spot") + '.png" x="-' + h + '" y="-' + h + '" width="' + S + '" height="' + S + '" transform="rotate(90)"/></g>';
    }
    return g + "</g></svg>";
  }

  /*
   * [11/11 v7 디자이너] 고급 미니맵(관제 웨이포인트 상자 [지도]) — 레퍼런스(서킷 안내도)처럼:
   *   어두운 바닥 위 설비 = 살짝 밝은 블록 + 아래 오른쪽 그림자 띠(2.5D) + 밝은 윗테, 벽 = 가는 선
   *   경로 = 어두운 테(케이싱)를 두른 밝은 파랑 한 줄(지나온 길 = 진하게 + 빛, 앞길 = 옅게), 지점 = 흰 테 작은 점
   *   번호 = 길 바깥쪽(경로 무게중심 반대 · 길에 수직)으로 짧은 지시선 + 번호 원(관제 지도 핀과 같은 말: 기본 회색 테 · 위험 · 주의 = 단계 색 테 · 지금 = 파랑)
   *   이름표 상자 = 출발 · 지금 지점(지시선 + 테 상자). o = svg() 와 같고 + names[](지점 이름) · nos[](지점 번호) · cur(지금 순번)
   */
  function svgHQ(o) {
    var P = PLAN2[o.floor] || PLAN2.B4, L = (o.mission && routeL(o.mission, o.floor, Math.max(1, o.n))) || tour2(o.floor in TOUR2 ? o.floor : "B4", Math.max(1, o.n));
    // 경로 둘레로 확대 — 칸(o.w × o.h) 안에 경로 + 번호 자리(가장자리 44px)가 꽉 차게. 그림 크기(u)는 화면 px 기준으로 맞춘다
    var W0 = o.w || 300, H0 = o.h || 480, M = 44;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    L.pts.forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    var sc = Math.min((W0 - 2 * M) / Math.max(1, x1 - x0), (H0 - 2 * M) / Math.max(1, y1 - y0));
    var vw = W0 / sc, vh = H0 / sc, vx = (x0 + x1) / 2 - vw / 2, vy = (y0 + y1) / 2 - vh / 2;
    var px = 1 / sc, u = function (v) { return +(v * px).toFixed(1); };
    var n = o.n, done = Math.max(0, Math.min(n, o.done));
    var sCut = done <= 0 ? 0 : done >= n ? L.len : L.sAt[done - 1];
    var sR = o.robot && done < n ? (done > 0 ? L.sAt[done - 1] + (L.sAt[done] - L.sAt[done - 1]) * 0.35 : L.sAt[0] * 0.5) : null;
    if (sR !== null) { sCut = sR; }
    var cx = 0, cy = 0;
    L.pts.forEach(function (q) { cx += q[0]; cy += q[1]; });
    cx /= L.pts.length; cy /= L.pts.length;
    var all = cut2(L, 0, L.len);
    var esc = function (t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
    var g = '<svg class="mini-plan mp-hq" viewBox="' + [vx, vy, vw, vh].map(function (v) { return v.toFixed(1); }).join(" ") + '" role="img" aria-label="' + esc(o.label || "") + '">' +
      '<defs><filter id="mphq-gl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="' + u(2.2) + '"/></filter>' +
      '<filter id="mpbl2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>';
    P.equipment.forEach(function (r) {
      if (r[2] < 12 || r[3] < 12) { return; }
      var d = u(3.5);
      g += '<rect class="mp-eq-side" x="' + (r[0] + d) + '" y="' + (r[1] + d) + '" width="' + r[2] + '" height="' + r[3] + '" rx="' + u(1.5) + '"/>';
      g += '<rect class="mp-eq-top" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="' + u(1.5) + '" stroke-width="' + u(0.6) + '"/>';
    });
    P.wall.forEach(function (r) { g += '<rect class="mp-wl2" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '"/>'; });
    g += '<polyline class="mp-case" points="' + all + '" stroke-width="' + u(5.6) + '"/>';
    g += '<polyline class="mp-line-ahead" points="' + all + '" stroke-width="' + u(2.6) + '"/>';
    if (sCut > 0) {
      var pastPts = cut2(L, 0, sCut);
      g += '<polyline class="mp-line-glow" points="' + pastPts + '" stroke-width="' + u(5) + '" filter="url(#mphq-gl)"/>';
      g += '<polyline class="mp-line" points="' + pastPts + '" stroke-width="' + u(2.6) + '"/>';
    }
    var labels = "", placed = [], dots = [];
    for (var k0 = 0; k0 < n; k0 += 1) { var q0 = pos2(L, L.sAt[k0]); dots.push({ x: q0.x, y: q0.y }); }
    // 지금 지점 · 위험 · 주의를 먼저 앉힌다 — 좋은 자리는 중요한 번호가 갖는다
    var order = [];
    for (var j0 = 0; j0 < n; j0 += 1) { order.push(j0); }
    order.sort(function (a1, b1) {
      var w = function (k) { return k === o.cur ? 0 : (o.marks && o.marks[k]) ? 1 : 2; };
      return w(a1) - w(b1) || a1 - b1;
    });
    for (var oi = 0; oi < n; oi += 1) {
      var j = order[oi];
      var q = pos2(L, L.sAt[j]), mk = o.marks && o.marks[j], cur = j === o.cur;
      var nx = q.x - cx, ny = q.y - cy, nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      // 길 방향 성분을 빼서 길에 수직으로 — 번호가 길 위에 앉지 않게
      var tx = Math.cos(q.ang), ty = Math.sin(q.ang), dt = nx * tx + ny * ty;
      nx -= tx * dt; ny -= ty * dt; nl = Math.hypot(nx, ny);
      if (nl < 0.01) { nx = -ty; ny = tx; nl = 1; }
      nx /= nl; ny /= nl;
      var R = u(cur ? 7.5 : 6.5), Ld = u(cur ? 15 : 13), lx = q.x + nx * Ld, ly = q.y + ny * Ld;
      // 겹침 피하기 — 왕복 길은 같은 자리에 지점이 둘 놓인다. 바깥 → 안쪽 → 더 멀리(1.9 · 2.8배) 차례로 빈자리를 찾는다
      var pick = null;
      [1, 1.9, 2.8, 3.7].some(function (k) {
        return [1, -1].some(function (sd) {
          var x = q.x + sd * nx * Ld * k, y = q.y + sd * ny * Ld * k;
          if (x < vx + R || x > vx + vw - R || y < vy + R || y > vy + vh - R) { return false; }
          var free = placed.every(function (c) { return Math.hypot(c.x - x, c.y - y) > c.r + R + u(1.2); }) &&
            dots.every(function (c) { return Math.hypot(c.x - x, c.y - y) > R + u(3); });
          if (free) { pick = { x: x, y: y, sd: sd }; }
          return free;
        });
      });
      if (pick) { lx = pick.x; ly = pick.y; if (pick.sd < 0) { nx = -nx; ny = -ny; } }
      placed.push({ x: lx, y: ly, r: R });
      var tone = mk === "crit" ? "c" : mk === "warn" ? "w" : cur ? "now" : j < done ? "past" : "plan";
      g += '<circle class="mp-dot2 is-' + tone + '" cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + u(2.3) + '" stroke-width="' + u(1) + '"/>';
      labels += '<line class="mp-lead is-' + tone + '" x1="' + q.x.toFixed(1) + '" y1="' + q.y.toFixed(1) + '" x2="' + (lx - nx * R).toFixed(1) + '" y2="' + (ly - ny * R).toFixed(1) + '" stroke-width="' + u(0.8) + '"/>';
      labels += '<g class="mp-no is-' + tone + '" transform="translate(' + lx.toFixed(1) + ',' + ly.toFixed(1) + ')"><circle r="' + R + '" stroke-width="' + u(1.2) + '"/>' +
        '<text y="' + u(0.5) + '" font-size="' + u(cur ? 8 : 7) + '" text-anchor="middle" dominant-baseline="middle">' + ((o.nos && o.nos[j]) || j + 1) + '</text></g>';
      var name = j === 0 && !cur ? "출발" : (cur && o.names ? o.names[j] : "");
      if (name) {
        var fs = u(8), bw = Math.min(u(150), name.length * fs * 0.92 + u(12)), bh = u(16);
        // 번호 원의 위(바깥이 위쪽이면) 또는 아래에 가운데 맞춰 — 옆에 두면 칸 끝에서 밀려 원을 덮었다
        var up = ny < 0, gap = u(6);
        var bx = Math.max(vx + u(4), Math.min(vx + vw - u(4) - bw, lx - bw / 2));
        var by = up ? ly - R - gap - bh : ly + R + gap;
        if (by < vy + u(4) || by + bh > vy + vh - u(4)) { up = !up; by = up ? ly - R - gap - bh : ly + R + gap; }
        labels += '<g class="mp-tag' + (cur ? " is-now" : "") + '"><line x1="' + lx.toFixed(1) + '" y1="' + (ly + (up ? -R : R)).toFixed(1) + '" x2="' + lx.toFixed(1) + '" y2="' + (up ? by + bh : by).toFixed(1) + '" stroke-width="' + u(0.8) + '"/>' +
          '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh + '" rx="' + u(2) + '" stroke-width="' + u(0.8) + '"/>' +
          '<text x="' + (bx + u(6)).toFixed(1) + '" y="' + (by + bh / 2 + u(0.5)).toFixed(1) + '" font-size="' + fs + '" dominant-baseline="middle">' + esc(name) + '</text></g>';
      }
    }
    if (sR !== null) {
      var rq = pos2(L, sR), S = u(30), h = (S / 2).toFixed(1);
      g += '<g transform="translate(' + rq.x.toFixed(1) + "," + rq.y.toFixed(1) + ") rotate(" + (rq.ang * 180 / Math.PI).toFixed(1) + ')">' +
        '<ellipse class="mp-sh" cx="' + u(1) + '" cy="' + u(1.5) + '" rx="' + u(13) + '" ry="' + u(8) + '" filter="url(#mpbl2)"/>' +
        '<image href="../assets/img/safety/robot-top-' + (o.kind || "spot") + '.png" x="-' + h + '" y="-' + h + '" width="' + S + '" height="' + S + '" transform="rotate(90)"/></g>';
    }
    return g + labels + "</svg>";
  }


  window.APRISM_MINI = { svgHQ: svgHQ, svg: svg, PLAN2: PLAN2, tour2: tour2, routeL: routeL };
})();
