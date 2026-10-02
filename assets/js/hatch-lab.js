/*
 * Hatching 시험판 — Figma 1차 셰이더 "Hatching" 을 WebGL 로 옮긴 것이다.
 * (Figma shader id b97afdde-e17f-4291-ade3-686068c703b2 · 버전 d60d46f1)
 *
 * 원본은 WGSL 이고 여기는 GLSL 인데 셈은 한 줄씩 그대로 옮겼다 —
 * patternHeight · seamlessCircleCycles · smoothstepDown · 4x4 슈퍼샘플링 ·
 * 프리멀티플라이드 출력까지 같다. 조절값 이름과 기본값도 Figma 속성판과 같다.
 *
 * 어떻게 도는가
 *   1. 아래 그림의 휘도를 잰다. thickness = 휘도 * density
 *   2. 픽셀을 중심 기준으로 돌리고, y 로 cycles 를 만들어 물결(sin) 또는 지그재그만큼 x 를 민다.
 *      원형 모드는 각도로 cycles 를 만들고 x 대신 중심에서의 거리를 쓴다.
 *   3. abs(fract(x / lineWidth) - 0.5) * 2 — 줄마다 0..1 삼각 램프가 선다.
 *   4. 그 램프를 thickness 로 자른다. 밝은 데는 굵은 줄, 어두운 데는 가는 줄이 남는다.
 *   5. 두 색을 coverage 로 섞는다.
 *
 * 색 공간: 장면을 sRGB 렌더 타깃에 담아 Figma 가 보는 값과 같은 수를 샘플링한다.
 * 효과 패스는 raw ShaderMaterial 이라 three.js 가 출력을 다시 변환하지 않는다.
 */
(function () {
  "use strict";

  var host = document.querySelector("[data-hatch-stage]");
  if (!host) { return; }

  var FRAG = [
    "precision highp float;",
    "uniform sampler2D tInput;",
    "uniform vec2 uDims;",
    "uniform float uMode;",        /* 0 circles · 1 waves · 2 zigzag */
    "uniform float uLineWidth;",   /* px */
    "uniform float uDensity;",
    "uniform float uSoftness;",    /* 0..1 */
    "uniform float uRotation;",    /* rad */
    "uniform vec2 uCenter;",       /* 0..1 */
    "uniform float uWaveFreq;",
    "uniform float uWaveAmp;",     /* px */
    "uniform float uStripe;",      /* offset.x / 100 */
    "uniform float uPhase;",       /* offset.y / 100 */
    "uniform vec4 uColorA;",
    "uniform vec4 uColorB;",
    "varying vec2 vUv;",
    "",
    "const float TAU = 6.28318530718;",
    "",
    "mat2 rot(float t) { float c = cos(t); float s = sin(t); return mat2(c, -s, s, c); }",
    "",
    "float waveFromCycles(float cycles, float amp) { return sin(cycles * TAU) * amp; }",
    "",
    "float zigzagFromCycles(float cycles, float amp) {",
    "  return (abs(fract(cycles - 0.25) * 2.0 - 1.0) - 0.5) * 2.0 * amp;",
    "}",
    "",
    "float seamlessCircleCycles(float t, float freq) {",
    "  float whole = floor(freq);",
    "  float fracPart = fract(freq);",
    "  if (fracPart < 0.0001) { return t * whole; }",
    "  float cutoff = whole / freq;",
    "  if (t < cutoff) { return t * freq; }",
    "  return whole + (t - cutoff) / max(1.0 - cutoff, 0.0001);",
    "}",
    "",
    "float smoothstepDown(float e0, float e1, float x) {",
    "  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);",
    "  return t * t * (3.0 - 2.0 * t);",
    "}",
    "",
    "float patternHeight(vec2 pPx, vec2 centerPx) {",
    "  float corner = uMode > 1.5 ? 1.0 : 0.0;",
    "  float stripeOffset = uStripe * uLineWidth;",
    "  vec2 pos = rot(uRotation) * (pPx - centerPx);",
    "  float cycles = pos.y / max(max(uDims.x, uDims.y), 1.0) * uWaveFreq;",
    "  if (uMode < 0.5) {",
    "    float angleT = fract(atan(pos.y, pos.x) / TAU + 1.0);",
    "    cycles = seamlessCircleCycles(angleT, uWaveFreq);",
    "  }",
    "  float offset = mix(waveFromCycles(cycles + uPhase, uWaveAmp),",
    "                     zigzagFromCycles(cycles + uPhase, uWaveAmp), corner);",
    "  if (uMode < 0.5) { pos = vec2(length(pos) + offset + stripeOffset, pos.y); }",
    "  else { pos = vec2(pos.x + offset + stripeOffset, pos.y); }",
    "  return abs(fract(pos.x / uLineWidth) - 0.5) * 2.0;",
    "}",
    "",
    "void main() {",
    "  vec4 src = texture2D(tInput, vUv);",
    "  vec2 fragPx = vUv * uDims;",
    "  vec2 centerPx = uCenter * uDims;",
    "  float alphaIn = src.a;",
    "  vec3 straight = src.rgb / max(alphaIn, 0.0001);",
    "  float lum = clamp(dot(straight, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);",
    "  float thickness = lum * uDensity;",
    "  float eps = 0.001;",
    "  float coverage = 0.0;",
    "  for (int i = 0; i < 4; i++) {",
    "    for (int j = 0; j < 4; j++) {",
    "      vec2 off = (vec2(float(i), float(j)) + 0.5) * 0.25 - 0.5;",
    "      float h = patternHeight(fragPx + off, centerPx);",
    "      coverage += smoothstepDown(thickness, thickness - uSoftness - eps, h);",
    "    }",
    "  }",
    "  coverage /= 16.0;",
    "  vec4 a = vec4(uColorA.rgb * uColorA.a, uColorA.a);",
    "  vec4 b = vec4(uColorB.rgb * uColorB.a, uColorB.a);",
    "  vec4 result = mix(a, b, coverage);",
    "  gl_FragColor = result * max(0.0, alphaIn);",
    "}"
  ].join("\n");

  var VERT = [
    "varying vec2 vUv;",
    "void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }"
  ].join("\n");

  /* 휘도 띠 — 조절값이 어느 밝기에서 몇 겹으로 갈리는지 보려고 둔 두 번째 원본이다. */
  var RAMP = [
    "varying vec2 vUv;",
    "void main() {",
    "  float band = floor(vUv.x * 8.0) / 7.0;",
    "  float grad = vUv.x;",
    "  float v = vUv.y > 0.5 ? band : grad;",
    "  gl_FragColor = vec4(vec3(v), 1.0);",
    "}"
  ].join("\n");

  import("three").then(start).catch(function (err) {
    host.textContent = "three.js 를 가져오지 못했습니다 — " + err;
  });

  function start(THREE) {
    var canvas = document.createElement("canvas");
    host.appendChild(canvas);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    /* ---------- 원본 1 · 로봇개 ---------- */
    var dogScene = new THREE.Scene();
    var dogCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 60);
    dogScene.add(new THREE.HemisphereLight(0xdfe7f5, 0x1b2434, 1.0));
    var key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(4, 7, 5);
    dogScene.add(key);
    var fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
    fill.position.set(-5, 3, -4);
    dogScene.add(fill);
    var rim = new THREE.DirectionalLight(0xbcd8ff, 2.4);
    rim.position.set(-4, 5, -7);
    dogScene.add(rim);

    var dog = null;
    var mixer = null;
    if (window.APRISM_ROBOT_DOG) {
      dog = window.APRISM_ROBOT_DOG(THREE);
      var turn = new THREE.Group();
      turn.add(dog.group);
      turn.rotation.y = 0;   /* 코가 월드 +X — 이 구도에서는 화면 오른쪽 아래를 본다 */
      dogScene.add(turn);
      mixer = new THREE.AnimationMixer(dog.group);
      mixer.clipAction(dog.clips.filter(function (c) { return c.name === "walk"; })[0]).play();
    }

    /* ---------- 원본 2 · 휘도 띠 ---------- */
    var rampScene = new THREE.Scene();
    var rampCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    rampScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: RAMP })
    ));

    /* ---------- 효과 패스 ---------- */
    var target = new THREE.WebGLRenderTarget(2, 2);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.minFilter = THREE.LinearFilter;
    target.texture.magFilter = THREE.LinearFilter;

    var uniforms = {
      tInput: { value: target.texture },
      uDims: { value: new THREE.Vector2(2, 2) },
      uMode: { value: 1 },
      uLineWidth: { value: 8 },
      uDensity: { value: 1 },
      uSoftness: { value: 0 },
      uRotation: { value: Math.PI / 2 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uWaveFreq: { value: 2.8 },
      uWaveAmp: { value: 10 },
      uStripe: { value: 0 },
      uPhase: { value: 0 },
      uColorA: { value: new THREE.Vector4(0.0392, 0.3647, 0.2157, 1) },
      uColorB: { value: new THREE.Vector4(0.7804, 0.9725, 0.9725, 1) }
    };

    var postScene = new THREE.Scene();
    var postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms,
        transparent: true, depthTest: false, depthWrite: false
      })
    ));

    /* ---------- 조절값 ---------- */
    var P = {
      source: "dog",
      hatch: true,
      mode: 1,
      density: 1,
      softness: 0,
      waveFrequency: 2.8,
      waveAmplitude: 2.3,
      offsetX: 0,
      offsetY: 0,
      angle: 90,
      /*
       * 줄 간격은 Figma 와 같이 "판 폭의 %" 다. Figma 에서 본 프레임은 127 폭이라
       * 8% 가 10px 쯤이었는데 이 판은 1000 쯤이라 같은 8% 면 80px 짜리 덩어리가 된다.
       * 그래서 처음 값은 눈에 맞는 쪽으로 잡아 두었다 — [Figma 기본] 을 누르면 8 로 간다.
       */
      radius: 1.2,
      centerX: 50,
      centerY: 50,
      colorA: "#0A0E15",
      colorB: "#89B9ED"
    };

    function hexToVec(hex) {
      var n = parseInt(hex.slice(1), 16);
      return new THREE.Vector4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
    }

    function push() {
      var w = canvas.width, h = canvas.height;
      uniforms.uMode.value = P.mode;
      /* Figma 와 같다 — 줄 간격은 폭의 radius % 다. */
      uniforms.uLineWidth.value = Math.max(Math.max(w, 1) * P.radius / 100, 1);
      uniforms.uDensity.value = P.density;
      uniforms.uSoftness.value = P.softness / 100;
      uniforms.uRotation.value = P.angle * Math.PI / 180;
      uniforms.uCenter.value.set(P.centerX / 100, P.centerY / 100);
      uniforms.uWaveFreq.value = P.waveFrequency;
      uniforms.uWaveAmp.value = P.waveAmplitude / 100 * Math.max(w, h, 1);
      uniforms.uStripe.value = P.offsetX / 100;
      uniforms.uPhase.value = P.offsetY / 100;
      uniforms.uColorA.value.copy(hexToVec(P.colorA));
      uniforms.uColorB.value.copy(hexToVec(P.colorB));
    }

    function fit() {
      var w = host.clientWidth || 1;
      var h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      var dpr = renderer.getPixelRatio();
      target.setSize(Math.round(w * dpr), Math.round(h * dpr));
      uniforms.uDims.value.set(target.width, target.height);

      var halfH = 1.1;
      var halfW = halfH * w / h;
      dogCam.left = -halfW; dogCam.right = halfW;
      dogCam.top = halfH; dogCam.bottom = -halfH;
      dogCam.updateProjectionMatrix();
      /* 로봇 판과 같은 구도 — 방위 45도 · 기울기 46도 */
      var yaw = Math.PI / 4, pitch = 46 * Math.PI / 180;
      dogCam.position.set(
        Math.cos(pitch) * Math.sin(yaw) * 12,
        0.3 + Math.sin(pitch) * 12,
        Math.cos(pitch) * Math.cos(yaw) * 12
      );
      dogCam.lookAt(0, 0.3, 0);
      push();
    }

    fit();
    if (window.ResizeObserver) { new ResizeObserver(fit).observe(host); }
    else { window.addEventListener("resize", fit); }

    var clock = new THREE.Clock();

    renderer.setAnimationLoop(function () {
      if (mixer) { mixer.update(clock.getDelta()); }
      var scene = P.source === "dog" ? dogScene : rampScene;
      var cam = P.source === "dog" ? dogCam : rampCam;

      if (!P.hatch) {
        renderer.setRenderTarget(null);
        renderer.render(scene, cam);
        return;
      }
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    });

    /* ---------- 손잡이 묶기 ---------- */
    Array.prototype.forEach.call(document.querySelectorAll("[data-p]"), function (el) {
      var name = el.getAttribute("data-p");
      var out = document.querySelector("[data-out='" + name + "']");

      function read() {
        var v = el.type === "checkbox" ? el.checked
          : (el.type === "range" || el.type === "number") ? Number(el.value) : el.value;
        P[name] = v;
        if (out) { out.textContent = el.value; }
        push();
      }

      if (el.type === "range" || el.type === "number") { el.value = P[name]; }
      else if (el.type === "checkbox") { el.checked = P[name]; }
      else { el.value = P[name]; }
      if (out) { out.textContent = el.value; }

      el.addEventListener("input", read);
      el.addEventListener("change", read);
    });

    /* 미리 담아 둔 값 — Figma 기본값과 APRISM 팔레트. */
    var PRESETS = {
      figma: { mode: 1, density: 1, softness: 0, waveFrequency: 2.8, waveAmplitude: 2.3,
        offsetX: 0, offsetY: 0, angle: 90, radius: 8, centerX: 50, centerY: 50,
        colorA: "#0A5D37", colorB: "#C7F8F8" },
      aprism: { mode: 1, density: 1.15, softness: 18, waveFrequency: 3.4, waveAmplitude: 1.6,
        offsetX: 0, offsetY: 0, angle: 90, radius: 1.2, centerX: 50, centerY: 50,
        colorA: "#0A0E15", colorB: "#89B9ED" },
      print: { mode: 2, density: 1, softness: 0, waveFrequency: 6, waveAmplitude: 1.2,
        offsetX: 0, offsetY: 0, angle: 45, radius: 0.6, centerX: 50, centerY: 50,
        colorA: "#070A10", colorB: "#F7F8FA" }
    };

    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (btn) {
      btn.addEventListener("click", function () {
        var set = PRESETS[btn.getAttribute("data-preset")];
        if (!set) { return; }
        Object.keys(set).forEach(function (k) {
          P[k] = set[k];
          var el = document.querySelector("[data-p='" + k + "']");
          if (!el) { return; }
          el.value = set[k];
          var out = document.querySelector("[data-out='" + k + "']");
          if (out) { out.textContent = el.value; }
        });
        push();
      });
    });
  }
})();
