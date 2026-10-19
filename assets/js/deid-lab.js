/*
 * 비식별화 패턴 비교 — 해칭 시험판에서 갈라져 나왔다(2026-10-12).
 *
 * 해칭을 그대로 덮으면 점 하나하나의 밝기가 줄 굵기로 옮겨 가 얼굴 형태가 남는다.
 * 그래서 순서를 바꿨다 — 먼저 정보를 지우고(칸 평균), 그 위에 패턴을 입힌다.
 *
 *   mosaic      칸마다 평균색 하나
 *   hatch       줄무늬 · 줄 굵기 = 칸 평균 밝기(점 단위 정보는 이미 없다)
 *   silhouette  줄무늬 · 줄 굵기 고정 — 칸 사이 차이도 없다
 *   grid        격자 모자이크 — 칸 평균색 둥근 타일(Delta 점 비율) 사이에 검은 틈 + 감지 상자 · 라벨(10/19 디자이너, Figma UI_99 1818:67890)
 *
 * 기본은 가로 일자 줄(0°)이다(2026-10-12 디자이너가 사선 대신 고름).
 * 각도를 57° 로 두면 로고 A 의 다리 기울기가 된다(brand-mark.svg 실측 — 꼭짓점 (14.3, 0.2) → 밑 (3.2, 17.1)).
 * 칸 격자와 사선은 영역 왼쪽 위에 붙는다. 영상이 움직이면 영역과 함께 움직여 줄이 지글거리지 않는다.
 *
 * 그리기는 2D 캔버스 · 점 단위다. 시안 비교용이라 단순하게 두었다 — 제품에서는 셰이더 한 장이면 된다.
 */
(function () {
  "use strict";

  var W = 960, H = 640;
  var IMG_W = 1280, IMG_H = 854;

  // 사진(assets/img/hatch-sample-factory.jpg · 1280×854) 속 두 작업자 — 눈으로 잡은 자리다.
  var PEOPLE = {
    body: [[45, 95, 505, 770], [495, 165, 940, 835]],
    head: [[280, 95, 475, 370], [570, 160, 795, 445]]
  };

  // 기본값 — 2026-10-12 디자이너가 손잡이로 고른 값이다(두 번째 — 가로 일자 줄).
  var P = {
    scope: "body",
    move: false,
    cell: 25,
    margin: 0,
    angle: 0,
    gap: 11,
    thick: 12,
    range: 39,
    tint: true,
    ink: "#FFFFFF",
    paper: "#000000",
    // 격자 모자이크 — Figma 셰이더(픽셀화) 값: size 18 · gap 2 · 평균색 100%. 화면 px 기준이라 그릴 때 캔버스 배율을 곱한다.
    gcell: 18,
    ggap: 2,
    // 칸 모서리 — Delta 점(8 네모 · rx 2)과 같은 비율, 한 변의 25%(10/19 디자이너)
    ground: 25,
    glabel: true
  };

  // 감지 라벨 — 사람마다 하나. 시안 글(Figma "person/안전모o")을 그대로 쓴다.
  var LABELS = ["person/안전모o", "person/안전모o"];

  var views = {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (c) {
    views[c.getAttribute("data-view")] = c.getContext("2d");
  });

  var work = document.createElement("canvas");
  work.width = W; work.height = H;
  var wctx = work.getContext("2d", { willReadFrequently: true });

  var img = new Image();
  var ready = false;
  img.onload = function () { ready = true; draw(0); };
  img.src = window.APRISM_HATCH_SAMPLE || "";

  function hex(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // 화면 흔들림 흉내 — 사진을 조금 키워 두고 천천히 민다. 영역도 같은 변환을 탄다.
  function camera(t) {
    var s = (W / IMG_W) * 1.08;
    var ox = (W - IMG_W * s) / 2, oy = (H - IMG_H * s) / 2;
    if (P.move) {
      ox += Math.sin(t * 0.0011) * 22;
      oy += Math.cos(t * 0.0008) * 12;
    }
    return { s: s, ox: ox, oy: oy };
  }

  function regions(cam) {
    return PEOPLE[P.scope].map(function (r) {
      return [
        r[0] * cam.s + cam.ox - P.margin,
        r[1] * cam.s + cam.oy - P.margin,
        r[2] * cam.s + cam.ox + P.margin,
        r[3] * cam.s + cam.oy + P.margin
      ];
    });
  }

  /*
   * 칸 평균 — 칸 격자는 영역 왼쪽 위(rx, ry)에서 시작한다.
   * 영역을 넘는 칸은 영역 안쪽 점만 센다.
   */
  function cellsOf(src, r) {
    var x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1]));
    var x1 = Math.min(W, Math.ceil(r[2])), y1 = Math.min(H, Math.ceil(r[3]));
    var c = P.cell;
    var cols = Math.ceil((r[2] - r[0]) / c), rows = Math.ceil((r[3] - r[1]) / c);
    var sum = new Float32Array(cols * rows * 4);
    for (var y = y0; y < y1; y++) {
      var row = Math.floor((y - r[1]) / c);
      for (var x = x0; x < x1; x++) {
        var k = (row * cols + Math.floor((x - r[0]) / c)) * 4;
        var i = (y * W + x) * 4;
        sum[k] += src[i]; sum[k + 1] += src[i + 1]; sum[k + 2] += src[i + 2]; sum[k + 3] += 1;
      }
    }
    for (var j = 0; j < cols * rows; j++) {
      var n = sum[j * 4 + 3] || 1;
      sum[j * 4] /= n; sum[j * 4 + 1] /= n; sum[j * 4 + 2] /= n;
    }
    return { x0: x0, y0: y0, x1: x1, y1: y1, cols: cols, sum: sum };
  }

  function smooth(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function paint(kind, src, regs, cellSets) {
    var ctx = views[kind];
    if (!ctx) { return; }
    var out = ctx.createImageData(W, H);
    var d = out.data;
    d.set(src);

    if (kind === "source") {
      ctx.putImageData(out, 0, 0);
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = P.ink;
      regs.forEach(function (r) { ctx.strokeRect(r[0], r[1], r[2] - r[0], r[3] - r[1]); });
      ctx.restore();
      return;
    }

    var ink = hex(P.ink), paper = hex(P.paper);
    // 줄 방향 — 0° 면 가로 줄, 57° 면 오른쪽 위로 오르는 A 의 왼다리. 줄은 법선 n 방향으로 gap 마다 선다.
    var a = P.angle * Math.PI / 180;
    var nx = Math.sin(a), ny = Math.cos(a);
    var aa = 1.2 / P.gap;   // 줄 가장자리 1px 남짓을 부드럽게

    regs.forEach(function (r, ri) {
      var cs = cellSets[ri];
      for (var y = cs.y0; y < cs.y1; y++) {
        var row = Math.floor((y - r[1]) / P.cell);
        for (var x = cs.x0; x < cs.x1; x++) {
          var k = (row * cs.cols + Math.floor((x - r[0]) / P.cell)) * 4;
          var cr = cs.sum[k], cg = cs.sum[k + 1], cb = cs.sum[k + 2];
          var i = (y * W + x) * 4;

          if (kind === "mosaic") {
            d[i] = cr; d[i + 1] = cg; d[i + 2] = cb;
            continue;
          }

          var t;
          if (kind === "hatch") {
            var lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
            var mid = P.thick / 100, span = P.range / 100;
            t = Math.min(0.95, Math.max(0.05, mid + (lum - 0.5) * span));
          } else {
            t = P.thick / 100;
          }

          var u = ((x - r[0]) * nx + (y - r[1]) * ny) / P.gap;
          var h = Math.abs(u - Math.floor(u) - 0.5) * 2;      // 줄 가운데 0 · 줄 사이 1
          var cov = 1 - smooth(t - aa, t + aa, h);

          var br = paper[0], bg = paper[1], bb = paper[2];
          if (P.tint) { br = cr * 0.45; bg = cg * 0.45; bb = cb * 0.45; }
          d[i] = br + (ink[0] - br) * cov;
          d[i + 1] = bg + (ink[1] - bg) * cov;
          d[i + 2] = bb + (ink[2] - bb) * cov;
        }
      }
    });
    ctx.putImageData(out, 0, 0);
  }

  /*
   * 격자 모자이크 — 칸 평균색 타일, 칸 사이 틈은 검정(Figma background 프레임 #000).
   * 칸 · 틈 · 라벨은 화면 px 로 잡는다(k = 캔버스 점 / 화면 점) — Figma 값이 화면 크기라서.
   * 감지 상자 테두리는 blue/500(1px, 안쪽), 라벨 탭은 blue/600 면 + gray/50 글자 12 · 여백 4, 상자 위에 붙는다.
   */
  function paintGrid(src, regs) {
    var ctx = views.grid;
    if (!ctx) { return; }
    var cv = ctx.canvas;
    var k = cv.width / (cv.clientWidth || cv.width);
    var c = P.gcell * k, g = P.ggap * k;
    var tile = c - g, rad = Math.min(tile / 2, tile * P.ground / 100);
    var out = ctx.createImageData(W, H);
    out.data.set(src);
    var d = out.data;
    regs.forEach(function (r) {
      var cs = cellsOfSize(src, r, c);
      for (var y = cs.y0; y < cs.y1; y++) {
        var fy = (y - r[1]) % c;
        var row = Math.floor((y - r[1]) / c);
        for (var x = cs.x0; x < cs.x1; x++) {
          var fx = (x - r[0]) % c;
          var i = (y * W + x) * 4;
          // 틈은 칸 오른쪽 · 아래에 둔다 — 상자 왼쪽 위에서 첫 칸이 바로 시작한다.
          if (fx >= tile || fy >= tile) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; continue; }
          // 둥근 네모 — 점 가운데(+0.5)에서 모서리 원까지 거리로 덮임을 잰다. 가장자리 1px 은 검정과 섞는다.
          var px = fx + 0.5, py = fy + 0.5;
          var ex = Math.max(rad - px, px - (tile - rad), 0);
          var ey = Math.max(rad - py, py - (tile - rad), 0);
          var cov = rad > 0 ? Math.min(1, Math.max(0, rad - Math.sqrt(ex * ex + ey * ey) + 0.5)) : 1;
          var j = (row * cs.cols + Math.floor((x - r[0]) / c)) * 4;
          d[i] = cs.sum[j] * cov; d[i + 1] = cs.sum[j + 1] * cov; d[i + 2] = cs.sum[j + 2] * cov;
        }
      }
    });
    ctx.putImageData(out, 0, 0);
    if (!P.glabel) { return; }

    var css = getComputedStyle(document.documentElement);
    var line = css.getPropertyValue("--color-blue-500").trim() || "#6AA7E7";
    var tab = css.getPropertyValue("--color-blue-600").trim() || "#4990E0";
    var ink = css.getPropertyValue("--color-gray-50").trim() || "#F7F8FA";
    ctx.save();
    ctx.font = "400 " + (12 * k) + "px 'SUIT Variable', SUIT, sans-serif";
    ctx.textBaseline = "top";
    regs.forEach(function (r, ri) {
      var bw = 1 * k, pad = 4 * k, th = 15 * k;
      ctx.lineWidth = bw;
      ctx.strokeStyle = line;
      ctx.strokeRect(r[0] + bw / 2, r[1] + bw / 2, r[2] - r[0] - bw, r[3] - r[1] - bw);
      // 라벨 탭 — 상자 폭에 맞춘다(Figma 탭 127 = 상자 127). 글이 길면 글 폭까지 늘어난다.
      var text = LABELS[ri] || "person";
      var tw = Math.max(r[2] - r[0], ctx.measureText(text).width + pad * 2);
      var h = th + pad * 2;
      ctx.fillStyle = tab;
      ctx.fillRect(r[0], r[1] - h, tw, h);
      ctx.fillStyle = ink;
      ctx.fillText(text, r[0] + pad, r[1] - h + pad + 1 * k);
    });
    ctx.restore();
  }

  // cellsOf 와 같되 칸 크기를 따로 받는다(격자 모자이크는 제 칸 크기를 쓴다).
  function cellsOfSize(src, r, c) {
    var keep = P.cell;
    P.cell = c;
    var cs = cellsOf(src, r);
    P.cell = keep;
    return cs;
  }

  function draw(t) {
    if (!ready) { return; }
    var cam = camera(t || 0);
    wctx.fillStyle = "#000";
    wctx.fillRect(0, 0, W, H);
    wctx.drawImage(img, cam.ox, cam.oy, IMG_W * cam.s, IMG_H * cam.s);
    var src = wctx.getImageData(0, 0, W, H).data;
    var regs = regions(cam);
    var cellSets = regs.map(function (r) { return cellsOf(src, r); });
    ["source", "mosaic", "hatch", "silhouette"].forEach(function (k) { paint(k, src, regs, cellSets); });
    paintGrid(src, regs);
  }

  // 격자 모자이크는 화면 px 로 그리므로 창 크기가 바뀌면 다시 그린다.
  window.addEventListener("resize", function () { if (!P.move) { draw(performance.now()); } });

  var running = false;
  function loop(t) {
    if (!P.move) { running = false; return; }
    draw(t);
    requestAnimationFrame(loop);
  }

  function changed() {
    if (P.move && !running) { running = true; requestAnimationFrame(loop); }
    else if (!P.move) { draw(performance.now()); }
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-p]"), function (el) {
    var name = el.getAttribute("data-p");
    var out = document.querySelector("[data-out='" + name + "']");
    if (el.type === "checkbox") { el.checked = P[name]; } else { el.value = P[name]; }
    if (out) { out.textContent = el.value; }
    function read() {
      P[name] = el.type === "checkbox" ? el.checked : (el.type === "range" ? Number(el.value) : el.value);
      if (out) { out.textContent = el.value; }
      changed();
    }
    el.addEventListener("input", read);
    el.addEventListener("change", read);
  });
})();
