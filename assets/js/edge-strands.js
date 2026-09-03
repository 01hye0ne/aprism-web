/* =============================================================
 * 주의(Warning) 엣지 글로우 — Strands 를 테두리에 감은 것
 *
 * 셰이더 본문(spectrum · samplePalette · strandColor · 가닥 누적 · 톤매핑)은
 * React Bits 의 Strands 원본 그대로다.
 *   https://reactbits.dev/animations/strands
 *   Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0
 *   라이선스 정리는 저장소 루트 THIRD-PARTY.md 를 볼 것.
 *
 * 고친 것은 좌표 하나뿐이다. 원본은 uv 를 화면 가운데 기준으로 잡아 가닥이
 * 가로로 곧게 지나가는데, 여기서는
 *   uv.x <- 라운드 사각형 둘레를 따라간 위치(0~1)
 *   uv.y <- 테두리 중심선에서 떨어진 거리
 * 로 바꿔서 가닥이 테두리를 감고 돈다. 나머지 계산은 손대지 않았다.
 *
 * 값은 디자이너가 strands-lab.html 에서 맞춘 것이고, 색만 경고 계열로 바꿨다.
 * ============================================================= */
(function () {
  "use strict";

  var MAX_STRANDS = 12;
  var MAX_COLORS = 8;

  /* 디자이너가 맞춘 값. 색은 warning 램프 — 500(진한) · 300(중간) · 200(옅은) */
  var CONF = {
    colors: ["#FFCC00", "#EEDA6B", "#F8EBAE"],
    count: 2,
    speed: 1.29,
    amplitude: 0.24,
    waviness: 0.6,
    thickness: 0.8,
    glow: 2.65,
    taper: 1.95,
    spread: 0,
    hueShift: 0.065,
    intensity: 0.04,
    saturation: 1.27,
    opacity: 1,
    scale: 1.5,

    /* 테두리에 감으면서 생긴 값들 */
    radius: 8,     // .two-col 의 border-radius (--radius-container)
    ring: 2,       // 선 두께 (--border-width-strong)
    band: 7,       // 빛이 번지는 반경(px). 이 밖은 계산하지 않고 버린다
    lap: 6,        // 한 바퀴 도는 데 걸리는 초 — 예전 별똥별과 같다
    spanX: 5.2,    // 둘레 한 바퀴를 uv.x 로 편 폭. 클수록 빛나는 구간이 짧다
    spanY: 0.32    // 번짐 반경을 uv.y 로 편 폭
  };

  var VERT = "#version 300 es\n" +
    "in vec2 position;\n" +
    "void main() { gl_Position = vec4(position, 0.0, 1.0); }\n";

  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "out vec4 fragColor;",
    "",
    "uniform vec2  uRes;",
    "uniform float uTime;",
    "uniform vec2  uHalf;",
    "uniform float uRadius, uRing, uBand, uLap, uSpanX, uSpanY;",
    "",
    "uniform vec3  uColors[" + MAX_COLORS + "];",
    "uniform int   uColorCount;",
    "uniform int   uStrandCount;",
    "uniform float uSpeed, uAmplitude, uWaviness, uThickness, uGlow;",
    "uniform float uTaper, uSpread, uHueShift, uIntensity, uOpacity;",
    "uniform float uScale, uSaturation;",
    "",
    "const float PI = 3.14159265;",
    "const float HALF_PI = 1.57079633;",
    "",
    /* ---- 여기부터 원본 그대로 ---- */
    "vec3 spectrum(float t) {",
    "  return 0.5 + 0.5 * cos(2.0 * PI * (t + vec3(0.00, 0.33, 0.67)));",
    "}",
    "",
    "vec3 samplePalette(float t) {",
    "  t = fract(t);",
    "  float scaled = t * float(uColorCount);",
    "  int idx = int(floor(scaled));",
    "  float blend = fract(scaled);",
    "  int nextIdx = idx + 1;",
    "  if (nextIdx >= uColorCount) nextIdx = 0;",
    "  return mix(uColors[idx], uColors[nextIdx], blend);",
    "}",
    "",
    "vec3 strandColor(float t) {",
    "  if (uColorCount > 0) return samplePalette(t);",
    "  return spectrum(t);",
    "}",
    /* ---- 원본 그대로 끝 ---- */
    "",
    // 라운드 사각형 외곽선까지의 부호 있는 거리
    "float sdRoundBox(vec2 p, vec2 c, float r) {",
    "  vec2 q = abs(p) - c;",
    "  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;",
    "}",
    "",
    // 둘레 위치 — 위쪽 가운데에서 시계방향으로 잰 길이
    "float perimeter(vec2 p, float cx, float cy, float qa, float P) {",
    "  if (abs(p.x) <= cx) {",
    "    if (p.y > 0.0) return (p.x >= 0.0) ? p.x : P + p.x;",
    "    return cx + 2.0 * qa + 2.0 * cy + (cx - p.x);",
    "  }",
    "  if (abs(p.y) <= cy) {",
    "    if (p.x > 0.0) return cx + qa + (cy - p.y);",
    "    return 3.0 * cx + 3.0 * qa + 2.0 * cy + (p.y + cy);",
    "  }",
    "  vec2 c = vec2(cx * sign(p.x), cy * sign(p.y));",
    "  float ang = atan(p.y - c.y, p.x - c.x);",
    "  if (p.x > 0.0 && p.y > 0.0) return cx + qa * (1.0 - ang / HALF_PI);",
    "  if (p.x > 0.0)              return cx + qa + 2.0 * cy + qa * (-ang / HALF_PI);",
    "  if (p.y < 0.0)              return 3.0 * cx + 2.0 * qa + 2.0 * cy + qa * ((-HALF_PI - ang) / HALF_PI);",
    "  return 3.0 * cx + 3.0 * qa + 4.0 * cy + qa * ((PI - ang) / HALF_PI);",
    "}",
    "",
    "void main() {",
    "  vec2 p = gl_FragCoord.xy - 0.5 * uRes;",
    "  float cx = max(uHalf.x - uRadius, 0.0);",
    "  float cy = max(uHalf.y - uRadius, 0.0);",
    "",
    // 선은 안쪽으로 그린다 — 중심선이 외곽선에서 ring/2 만큼 안쪽이다
    "  float dc = sdRoundBox(p, vec2(cx, cy), uRadius) + uRing * 0.5;",
    "  if (abs(dc) > uBand) { fragColor = vec4(0.0); return; }",
    "",
    "  float qa = HALF_PI * uRadius;",
    "  float P  = 4.0 * cx + 4.0 * cy + 4.0 * qa;",
    "  float t  = perimeter(p, cx, cy, qa, P) / P;",
    "",
    // 빛나는 창이 테두리를 돈다 — 예전 별똥별이 하던 일이다
    "  float x = fract(t - uTime / uLap) - 0.5;",
    "",
    "  vec2 uv = vec2(x * uSpanX, dc / uBand * uSpanY);",
    "  uv /= max(uScale, 0.0001);",
    "",
    /* ---- 여기부터 다시 원본 그대로 ---- */
    "  float e = 0.06 + uIntensity * 0.94;",
    "  float env = pow(max(cos(uv.x * PI * 1.3), 0.0), uTaper);",
    "",
    "  vec3 col = vec3(0.0);",
    "",
    "  for (int i = 0; i < " + MAX_STRANDS + "; i++) {",
    "    if (i >= uStrandCount) break;",
    "",
    "    float fi = float(i);",
    "    float ph = fi * 1.7 * uSpread;",
    "    float freq = (2.0 + fi * 0.35) * uWaviness;",
    "    float spd = 1.4 + fi * 1.2;",
    "",
    "    float tt = uTime * uSpeed;",
    "    float w = sin(uv.x * freq + tt * spd + ph) * 0.60",
    "            + sin(uv.x * freq * 1.1 - tt * spd * 0.7 + ph * 1.7) * 0.40;",
    "",
    "    float amp = (0.1 + 0.02 * e) * env * uAmplitude;",
    "    float y = w * amp;",
    "",
    "    float d = abs(uv.y - y);",
    "    float thick = (0.001 + 0.05 * e) * (0.35 + env) * uThickness;",
    "    float g = thick / (d + thick * 0.45);",
    "    g = g * g;",
    "",
    "    float h = fi / float(uStrandCount) + uv.x * 0.30 + uTime * 0.04 + uHueShift;",
    "    col += strandColor(h) * g * env;",
    "  }",
    "",
    "  col *= 0.45 + 0.7 * e;",
    "  col = 1.0 - exp(-col * uGlow);",
    "",
    "  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));",
    "  col = max(mix(vec3(gray), col, uSaturation), 0.0);",
    "",
    "  float lum = max(max(col.r, col.g), col.b);",
    "  float alpha = clamp(lum, 0.0, 1.0) * uOpacity;",
    "",
    "  fragColor = vec4(col * uOpacity, alpha);",
    "}"
    /* ---- 원본 그대로 끝 ---- */
  ].join("\n");

  var canvas = document.querySelector("[data-edge-strands]");
  if (!canvas) return;

  var host = canvas.parentElement;
  var gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false
  });

  // WebGL2 를 못 쓰면 CSS 별똥별(.two-col::after)이 그대로 남는다.
  if (!gl) return;

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
  } catch (err) {
    return; // 컴파일이 안 되면 CSS 쪽을 그대로 둔다
  }

  gl.useProgram(prog);
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["uRes", "uTime", "uHalf", "uRadius", "uRing", "uBand", "uLap", "uSpanX", "uSpanY",
   "uColors", "uColorCount", "uStrandCount", "uSpeed", "uAmplitude", "uWaviness",
   "uThickness", "uGlow", "uTaper", "uSpread", "uHueShift", "uIntensity",
   "uOpacity", "uScale", "uSaturation"].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  // ogl 의 Color 와 같다 — 16진수를 0~1 로만 옮긴다(감마 변환 없음)
  function palette(colors) {
    var out = new Float32Array(MAX_COLORS * 3);
    for (var i = 0; i < MAX_COLORS; i++) {
      var hex = colors[i] !== undefined ? colors[i] : colors[colors.length - 1];
      var v = parseInt(hex.replace("#", ""), 16);
      out[i * 3] = ((v >> 16) & 255) / 255;
      out[i * 3 + 1] = ((v >> 8) & 255) / 255;
      out[i * 3 + 2] = (v & 255) / 255;
    }
    return out;
  }
  var PALETTE = palette(CONF.colors);

  // 값이 안 변하니 한 번만 넘긴다
  gl.uniform3fv(U.uColors, PALETTE);
  gl.uniform1i(U.uColorCount, Math.min(CONF.colors.length, MAX_COLORS));
  gl.uniform1i(U.uStrandCount, Math.min(Math.max(Math.round(CONF.count), 1), MAX_STRANDS));
  [["uSpeed", "speed"], ["uAmplitude", "amplitude"], ["uWaviness", "waviness"],
   ["uThickness", "thickness"], ["uGlow", "glow"], ["uTaper", "taper"],
   ["uSpread", "spread"], ["uHueShift", "hueShift"], ["uIntensity", "intensity"],
   ["uOpacity", "opacity"], ["uScale", "scale"], ["uSaturation", "saturation"],
   ["uRadius", "radius"], ["uRing", "ring"], ["uBand", "band"], ["uLap", "lap"],
   ["uSpanX", "spanX"], ["uSpanY", "spanY"]].forEach(function (pair) {
    gl.uniform1f(U[pair[0]], CONF[pair[1]]);
  });

  // 여기까지 왔으면 캔버스가 그린다 — CSS 별똥별은 물러난다
  host.classList.add("has-edge-strands");

  var W = 0, H = 0;
  function resize() {
    // 원본 Renderer 의 기본 dpr 이 1 이다. 링 하나 그리자고 화면 네 배를
    // 칠할 이유가 없어서 여기서도 1 로 둔다.
    var w = Math.round(host.clientWidth);
    var h = Math.round(host.clientHeight);
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform2f(U.uHalf, w * 0.5, h * 0.5);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(host);
  } else {
    window.addEventListener("resize", resize);
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var raf = 0;

  function paint(seconds) {
    resize();
    if (!W || !H) return;
    gl.uniform1f(U.uTime, seconds);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    paint(now * 0.001);
  }

  function start() {
    if (raf) return;
    // 움직임을 줄이라고 했으면 한 장만 그리고 멈춘다 — 빛은 남고 돌지 않는다.
    if (reduce && reduce.matches) {
      paint(CONF.lap * 0.25);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // 주의 상태일 때만 돈다. 화면 밖으로 나가면 쉰다.
  function sync() {
    if (host.classList.contains("is-warning")) start();
    else { stop(); gl.clear(gl.COLOR_BUFFER_BIT); }
  }

  new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ["class"] });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) sync();
      else stop();
    }).observe(host);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else sync();
  });
  if (reduce && reduce.addEventListener) {
    reduce.addEventListener("change", function () { stop(); sync(); });
  }

  sync();
})();
