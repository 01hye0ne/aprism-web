/*
 * Prism Orb — Delta 의 얼굴.
 *
 * 원본은 Claude Design 핸드오프 `assets/prism-orb/project/Prism Orb.dc.html` 이다.
 * 거기서는 three.js 를 esm.sh 에서 불러 쓰는데, 이 저장소엔 빌드 단계가 없고 화면이
 * 런타임에 외부 라이브러리를 더 끌어오는 것도 피하고 싶었다. 그래서 Strands 때와 같이
 * **셰이더는 원본 그대로 두고 three 가 대신 해 주던 일만 순수 WebGL2 로 옮겼다** —
 * 정이십면체 생성 · 베벨(면 평면에 p-노름으로 되쏘기) · 행렬 · 렌더타깃 · 블러 패스.
 *
 * 그리는 순서도 원본 그대로다.
 *   1. 안쪽 빛(코어 + 헤일로)만 렌더타깃에 additive 로 그린다
 *   2. 그걸 1/4 크기에서 가로 · 세로로 흐린다 — 형체가 없는 빛이 된다
 *   3. 유리 껍데기를 화면에 그리면서 그 빛을 화면공간에서 굴절시킨다(색분산 포함)
 *
 * 원본과 다르게 둔 것 셋. 셋 다 60px 짜리 자리에 담느라 생긴 일이다.
 *
 *  1. 화각을 32° 에서 조금 좁혔다(≈30.4°). 원본 무대에서 오브는 캔버스 높이의 74% 를 쓰는데,
 *     그대로 두면 60 상자에서 44 가 된다. Figma 자리표시자 원과 같은 48(펼침 19)이 되도록
 *     ORB_FILL 만큼 채우는 화각을 기하에서 역산한다. 카메라는 원본 자리에 그대로 있다 —
 *     화각만 바꾸는 건 순수한 확대라 원근은 하나도 안 변한다.
 *  2. 코어 블러 폭을 해상도에서 떼어냈다. 원본은 uDir 을 렌더타깃 픽셀로 계산해서 캔버스가
 *     작아지면 블러가 상대적으로 훨씬 커진다 — 96px 버퍼에서는 코어가 오브 전체로 번져
 *     형체가 사라졌다. 원본이 다듬어진 크기(REF_PX)에서 나오는 값으로 고정했다.
 *  3. 등배가 아니라 2배로 그려 브라우저가 줄이게 둔다. 면이 720 개라 48px 에 등배로 그리면
 *     삼각형이 1px 밑으로 내려가 자글거린다. 이 크기에선 2배도 싸다.
 *
 * 원본에 있고 여기 없는 것: shape · showEdges 프롭. 모양은 icosahedron 하나만 쓰고,
 * 모서리 선은 bevel 이 0 일 때만 보이는데 기본값이 0.4 라 원본에서도 안 보인다.
 *
 * 쓰는 법:
 *   var orb = PrismOrb.mount(el);      // el 을 꽉 채우는 캔버스를 붙인다
 *   orb.setPalette("warning");         // critical · warning · safe · info
 *   orb.destroy();
 * WebGL2 를 못 쓰면 mount 가 null 을 준다 — 부르는 쪽이 자리표시자를 그대로 두면 된다.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 원본 프로토타입에서 그대로 가져온 것 — 팔레트와 셰이더
   * ------------------------------------------------------------------ */

  var PALETTES = {
    critical: { a: [0.64, 0.24, 0.30], b: [0.30, 0.20, 0.20], c: [0.6, 0.6, 0.6], d: [0.00, 0.16, 0.32] },
    warning:  { a: [0.72, 0.50, 0.24], b: [0.24, 0.26, 0.18], c: [0.6, 0.6, 0.6], d: [0.05, 0.12, 0.36] },
    safe:     { a: [0.26, 0.60, 0.44], b: [0.22, 0.26, 0.22], c: [0.6, 0.6, 0.6], d: [0.32, 0.04, 0.20] },
    info:     { a: [0.28, 0.42, 0.74], b: [0.24, 0.24, 0.20], c: [0.6, 0.6, 0.6], d: [0.38, 0.22, 0.04] }
  };

  /* 원본 프롭의 기본값 그대로다. */
  var DEFAULTS = {
    palette: "info",
    glass: true,
    bevel: 0.4,
    coreBlur: 0.05,
    refraction: 0.16,
    dispersion: 0.35,
    glow: 1,
    hueShift: 0,
    speed: 1
  };

  var PAL_FN = `
  uniform vec3 uA, uB, uC, uD;
  vec3 pal(float t) { return uA + uB * cos(6.28318 * (uC * t + uD)); }
`;

  var VERT = `
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying vec3 vSphereN;
  varying vec3 vNorm;
  void main() {
    vLocal = position;
    vSphereN = normalMatrix * normalize(position);
    vNorm = normalMatrix * normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

  /* Inner light core: soft colour clouds that drift — this is what gets refracted. */
  var CORE_FRAG = `
  precision highp float;
  uniform float uTime, uShift;
  ${PAL_FN}
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying vec3 vSphereN;
  varying vec3 vNorm;
  void main() {
    vec3 N = normalize(vLocal);
    vec3 V = normalize(-vViewPos);
    float t = 0.30 + 0.42 * N.y + 0.16 * sin(N.x * 2.3 + uTime * 0.5)
            + 0.10 * sin(N.z * 3.1 - uTime * 0.37) + uShift;
    vec3 col = pal(t) * 1.25;
    col += pal(t + 0.18) * 0.45 * smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(N.y * 4.0 + uTime * 0.6));
    float edge = 1.0 - clamp(dot(normalize(vLocal), V), 0.0, 1.0);
    float falloff = pow(clamp(1.0 - edge, 0.0, 1.0), 2.2);
    col *= 0.6 + 1.3 * falloff;
    // white only at the hot centre, colour everywhere else
    col = mix(col, vec3(1.6), pow(falloff, 6.0) * 0.85);
    gl_FragColor = vec4(col * falloff, falloff);
  }
`;

  /* Separable gaussian used to melt the core into formless light. */
  var BLUR_FRAG = `
  precision highp float;
  uniform sampler2D uSrc;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(uSrc, vUv) * 0.1964;
    s += (texture2D(uSrc, vUv + uDir * 1.4) + texture2D(uSrc, vUv - uDir * 1.4)) * 0.1748;
    s += (texture2D(uSrc, vUv + uDir * 3.3) + texture2D(uSrc, vUv - uDir * 3.3)) * 0.1213;
    s += (texture2D(uSrc, vUv + uDir * 5.3) + texture2D(uSrc, vUv - uDir * 5.3)) * 0.0658;
    s += (texture2D(uSrc, vUv + uDir * 7.4) + texture2D(uSrc, vUv - uDir * 7.4)) * 0.0299;
    gl_FragColor = s;
  }
`;

  var QUAD_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

  /* Faceted glass shell: screen-space refraction of the core with chromatic dispersion. */
  var SHELL_FRAG = `
  precision highp float;
  uniform float uTime, uGlow, uShift, uGlass, uRefract, uDisp, uBlur, uBevel;
  uniform vec2 uRes;
  uniform sampler2D uTex;
  uniform sampler2D uSoftTex;
  ${PAL_FN}
  varying vec3 vViewPos;
  varying vec3 vLocal;
  varying vec3 vSphereN;
  varying vec3 vNorm;

  vec4 samp(vec2 uv, vec2 off, float k) {
    return texture2D(uTex, clamp(uv + off * k, vec2(0.002), vec2(0.998)));
  }

  // wide poisson-ish blur so the core reads as light, not a solid body
  vec4 soft(vec2 uv, vec2 off, float k, float r) {
    vec4 s = samp(uv, off, k) * 0.16;
    s += samp(uv, off + vec2( r,     0.0), k) * 0.105;
    s += samp(uv, off + vec2(-r,     0.0), k) * 0.105;
    s += samp(uv, off + vec2( 0.0,   r  ), k) * 0.105;
    s += samp(uv, off + vec2( 0.0,  -r  ), k) * 0.105;
    s += samp(uv, off + vec2( r*0.7, r*0.7), k) * 0.085;
    s += samp(uv, off + vec2(-r*0.7, r*0.7), k) * 0.085;
    s += samp(uv, off + vec2( r*0.7,-r*0.7), k) * 0.085;
    s += samp(uv, off + vec2(-r*0.7,-r*0.7), k) * 0.085;
    s += samp(uv, off + vec2( r*1.9, 0.0), k) * 0.0225;
    s += samp(uv, off + vec2(-r*1.9, 0.0), k) * 0.0225;
    s += samp(uv, off + vec2( 0.0, r*1.9), k) * 0.0225;
    s += samp(uv, off + vec2( 0.0,-r*1.9), k) * 0.0225;
    return s;
  }

  void main() {
    // beveled geometry carries true smooth normals; hard-faceted geometry uses screen-space flat normals
    vec3 N = uBevel > 0.5
      ? normalize(vNorm)
      : normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
    vec3 V = normalize(-vViewPos);
    if (dot(N, V) < 0.0) N = -N;
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.4);

    vec3 L1 = normalize(vec3(-0.45, 0.85, 0.55));
    vec3 L2 = normalize(vec3(0.75, -0.35, 0.40));
    float d1 = max(dot(N, L1), 0.0);
    float d2 = max(dot(N, L2), 0.0);

    float spread = 0.34 * N.x + 0.30 * N.y + 0.12 * fres;
    float band = 0.08 * sin(uTime * 0.11) + uShift;
    float t = 0.38 + clamp(spread, -0.28, 0.28) + band;
    vec3 tint = pal(t) * 0.6 + pal(t + 0.04) * 0.4;

    float lum = clamp(0.16 + 0.85 * pow(d1, 1.3) + 0.32 * pow(d2, 2.0), 0.0, 1.0);
    vec3 solid = mix(vec3(0.024, 0.022, 0.030), tint, smoothstep(0.13, 0.55, lum));
    solid = mix(solid, vec3(1.0), smoothstep(0.80, 1.0, lum) * 0.12);

    vec3 col = solid;
    float a = 1.0;

    if (uGlass > 0.5) {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec3 R = refract(-V, N, 1.0 / 1.45);
      vec2 off = R.xy * uRefract * (0.55 + 0.75 * fres);
      float rad = uBlur;
      vec4 r = texture2D(uSoftTex, clamp(uv + off * (1.0 - uDisp), vec2(0.002), vec2(0.998)));
      vec4 g = texture2D(uSoftTex, clamp(uv + off, vec2(0.002), vec2(0.998)));
      vec4 b = texture2D(uSoftTex, clamp(uv + off * (1.0 + uDisp), vec2(0.002), vec2(0.998)));
      vec4 blur = soft(uv, off, 1.0, rad);
      vec3 refr = vec3(r.r, g.g, b.b) * 0.6 + blur.rgb * 0.4;
      float mask = smoothstep(0.005, 0.45, (r.a + g.a + b.a) / 3.0);
      float bleed = clamp(blur.a * 3.2, 0.0, 1.0);
      vec3 bleedCol = blur.rgb / max(blur.a, 0.02);

      vec3 glassBody = mix(solid * 0.9, solid * 0.35 + bleedCol * 0.75, bleed * 0.8);
      glassBody += refr * (0.9 + 0.5 * ndv) * mask;
      glassBody += tint * 0.12 * lum;
      col = glassBody;
      a = clamp(0.46 + 0.54 * pow(fres, 1.1) + mask * 0.35 + bleed * 0.25, 0.0, 1.0);
      if (!gl_FrontFacing) { col *= 0.55; a *= 0.5; }
    } else if (!gl_FrontFacing) {
      col *= 0.55;
    }

    vec3 H = normalize(L1 + V);
    col += vec3(1.0) * pow(max(dot(N, H), 0.0), 72.0) * 0.26;
    col += pal(t + 0.15) * pow(fres, 2.0) * 0.55 * uGlow;


    gl_FragColor = vec4(col, a);
  }
`;

  /*
   * 원본 셰이더는 GLSL ES 1.00 문법(varying · texture2D · gl_FragColor)으로 쓰였고
   * three 가 알아서 3.00 으로 옮겨 준다. 그 일을 이 머리말이 대신한다 — 셰이더 본문은
   * 한 글자도 안 건드린다. three 가 넣어 주던 행렬 · attribute 선언도 같이 넣는다.
   */
  var VS_HEAD = [
    "#version 300 es",
    "#define attribute in",
    "#define varying out",
    "uniform mat4 modelViewMatrix;",
    "uniform mat4 projectionMatrix;",
    "uniform mat3 normalMatrix;",
    "attribute vec3 position;",
    "attribute vec3 normal;",
    "attribute vec2 uv;",
    ""
  ].join("\n");

  var FS_HEAD = [
    "#version 300 es",
    "#define varying in",
    "#define texture2D texture",
    "precision highp float;",
    "out highp vec4 pc_fragColor;",
    "#define gl_FragColor pc_fragColor",
    ""
  ].join("\n");

  /* 카메라 — 위치는 원본 그대로. 화각은 기하에서 역산한다(머리말 1번). */
  var CAM_Z = 5.4;
  var CAM_NEAR = 0.1;
  var CAM_FAR = 100;

  /* 오브가 캔버스 높이의 몇 할을 쓰는가. 0.8 이면 60 상자에서 48, 24 에서 19 다. */
  var ORB_FILL = 0.8;

  /* 코어 블러를 해상도에서 떼어낼 때 쓰는 기준 버퍼 폭(머리말 2번).
     원본 무대 68vmin 을 1000 높이 · dpr 2 로 잡은 값이다. */
  var REF_PX = 1360;

  /* 등배의 몇 배로 그릴지(머리말 3번). dpr 까지 곱해 4 를 넘기지 않는다. */
  var SUPERSAMPLE = 2;
  var MAX_RATIO = 4;

  /* 움직임을 줄이도록 설정한 환경에서는 이 시각의 한 장만 그리고 멈춘다. */
  var STILL_T = 2.0;

  /* ------------------------------------------------------------------ *
   * 기하 — three 의 IcosahedronGeometry(PolyhedronGeometry) 를 옮긴 것
   * ------------------------------------------------------------------ */

  var PHI = (1 + Math.sqrt(5)) / 2;
  var ICO_V = [
    -1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI, 0,
    0, -1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI,
    PHI, 0, -1, PHI, 0, 1, -PHI, 0, -1, -PHI, 0, 1
  ];
  var ICO_I = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
  ];

  function lerp3(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* three 의 PolyhedronGeometry.subdivideFace 와 같은 쪼개기 · 같은 감김 순서다. */
  function subdivideFace(a, b, c, detail, out) {
    var cols = detail + 1;
    var grid = [];
    var i, j;

    for (i = 0; i <= cols; i++) {
      grid[i] = [];
      var aj = lerp3(a, c, i / cols);
      var bj = lerp3(b, c, i / cols);
      var rows = cols - i;
      for (j = 0; j <= rows; j++) {
        // 꼭짓점 하나로 모이는 마지막 줄은 rows 가 0 이라 나눗셈을 피한다.
        grid[i][j] = (j === 0 && i === cols) ? aj : lerp3(aj, bj, j / rows);
      }
    }

    function push(v) { out.push(v[0], v[1], v[2]); }

    for (i = 0; i < cols; i++) {
      for (j = 0; j < 2 * (cols - i) - 1; j++) {
        var k = Math.floor(j / 2);
        if (j % 2 === 0) {
          push(grid[i][k + 1]); push(grid[i + 1][k]); push(grid[i][k]);
        } else {
          push(grid[i][k + 1]); push(grid[i + 1][k + 1]); push(grid[i + 1][k]);
        }
      }
    }
  }

  function icosahedron(radius, detail) {
    var out = [];
    for (var f = 0; f < ICO_I.length; f += 3) {
      var ia = ICO_I[f] * 3, ib = ICO_I[f + 1] * 3, ic = ICO_I[f + 2] * 3;
      subdivideFace(
        [ICO_V[ia], ICO_V[ia + 1], ICO_V[ia + 2]],
        [ICO_V[ib], ICO_V[ib + 1], ICO_V[ib + 2]],
        [ICO_V[ic], ICO_V[ic + 1], ICO_V[ic + 2]],
        detail, out
      );
    }
    var pos = new Float32Array(out);
    for (var i = 0; i < pos.length; i += 3) {
      var l = Math.sqrt(pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2]) || 1;
      var s = radius / l;
      pos[i] *= s; pos[i + 1] *= s; pos[i + 2] *= s;
    }
    return pos;
  }

  /* 인덱스 없는 지오메트리의 computeVertexNormals — 삼각형마다 한 법선(각진 면). */
  function flatNormals(pos) {
    var nrm = new Float32Array(pos.length);
    for (var i = 0; i < pos.length; i += 9) {
      var ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      var bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
      var cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
      var ux = cx - bx, uy = cy - by, uz = cz - bz;   // C - B
      var vx = ax - bx, vy = ay - by, vz = az - bz;   // A - B
      var nx = uy * vz - uz * vy;
      var ny = uz * vx - ux * vz;
      var nz = ux * vy - uy * vx;
      var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (var k = 0; k < 9; k += 3) {
        nrm[i + k] = nx; nrm[i + k + 1] = ny; nrm[i + k + 2] = nz;
      }
    }
    return nrm;
  }

  /* detail > 0 인 PolyhedronGeometry 의 법선은 구 법선이다. */
  function sphereNormals(pos) {
    var nrm = new Float32Array(pos.length);
    for (var i = 0; i < pos.length; i += 3) {
      var l = Math.sqrt(pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2]) || 1;
      nrm[i] = pos[i] / l; nrm[i + 1] = pos[i + 1] / l; nrm[i + 2] = pos[i + 2] / l;
    }
    return nrm;
  }

  /* 오브가 원점에서 가장 멀리 나가는 거리. 화각을 여기서 역산한다. */
  function maxReach(pos) {
    var m = 0;
    for (var i = 0; i < pos.length; i += 3) {
      var r = Math.sqrt(pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2]);
      if (r > m) m = r;
    }
    return m;
  }

  function solid(radius, detail) {
    var pos = icosahedron(radius, detail);
    return { position: pos, normal: detail === 0 ? flatNormals(pos) : sphereNormals(pos) };
  }

  /*
   * 진짜로 모서리를 깎은 입체 — 원본 주석 그대로다. 촘촘한 구를 다면체의 면 평면들에
   * 부드러운 p-노름으로 되쏘아서, 음영으로 둥글어 보이게 하는 게 아니라 실제로 둥글게 만든다.
   */
  function bevelize(base, bevel) {
    var planes = [];
    var i, q;

    for (i = 0; i < base.length; i += 9) {
      var ax = base[i], ay = base[i + 1], az = base[i + 2];
      var abx = base[i + 3] - ax, aby = base[i + 4] - ay, abz = base[i + 5] - az;
      var acx = base[i + 6] - ax, acy = base[i + 7] - ay, acz = base[i + 8] - az;
      var nx = aby * acz - abz * acy;
      var ny = abz * acx - abx * acz;
      var nz = abx * acy - aby * acx;
      var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (!l) continue;
      nx /= l; ny /= l; nz /= l;
      if (nx * ax + ny * ay + nz * az < 0) { nx = -nx; ny = -ny; nz = -nz; }
      var d = nx * ax + ny * ay + nz * az;
      if (d <= 1e-4) continue;
      var seen = false;
      for (q = 0; q < planes.length; q++) {
        if (planes[q][0] * nx + planes[q][1] * ny + planes[q][2] * nz > 0.999) { seen = true; break; }
      }
      if (!seen) planes.push([nx, ny, nz, d]);
    }
    if (!planes.length) return { position: base, normal: flatNormals(base) };

    var k = Math.min(Math.max(bevel, 0), 1);
    var p = Math.pow(2, 9.8 - 2.5 * k); // ~890 at 0 (hairline) · ~158 at 1 (widest fillet)
    var pos = icosahedron(1, 5);
    for (i = 0; i < pos.length; i += 3) {
      var x = pos[i], y = pos[i + 1], z = pos[i + 2];
      var sum = 0;
      for (q = 0; q < planes.length; q++) {
        var pl = planes[q];
        var dp = x * pl[0] + y * pl[1] + z * pl[2];
        if (dp > 0) sum += Math.pow(dp / pl[3], p);
      }
      var s = sum > 0 ? Math.pow(sum, -1 / p) : 1;
      pos[i] = x * s; pos[i + 1] = y * s; pos[i + 2] = z * s;
    }
    return { position: pos, normal: flatNormals(pos) };
  }

  /* ------------------------------------------------------------------ *
   * 행렬 — three.Matrix4 / Matrix3 에서 쓰던 것만. 열 우선이다.
   * ------------------------------------------------------------------ */

  function mat4() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function mul4(out, a, b) { // out = a * b
    for (var c = 0; c < 4; c++) {
      var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  function perspective(out, fovDeg, aspect, near, far) {
    var top = near * Math.tan(fovDeg * Math.PI / 360);
    var height = 2 * top, width = aspect * height;
    out[0] = 2 * near / width; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 2 * near / height; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = -(far + near) / (far - near); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = -2 * far * near / (far - near); out[15] = 0;
    return out;
  }

  /* three.Euler 기본 순서(XYZ) · 평행이동은 y 만 쓴다. */
  function eulerXYZ(out, x, y, z, ty) {
    var a = Math.cos(x), b = Math.sin(x);
    var c = Math.cos(y), d = Math.sin(y);
    var e = Math.cos(z), f = Math.sin(z);
    var ae = a * e, af = a * f, be = b * e, bf = b * f;
    out[0] = c * e; out[4] = -c * f; out[8] = d; out[12] = 0;
    out[1] = af + be * d; out[5] = ae - bf * d; out[9] = -b * c; out[13] = ty;
    out[2] = bf - ae * d; out[6] = be + af * d; out[10] = a * c; out[14] = 0;
    out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
    return out;
  }

  /* three.Matrix3.getNormalMatrix — 4x4 의 좌상단 3x3 을 역행렬 뒤 전치. */
  function normalMatrix(out, m) {
    var a = m[0], b = m[1], c = m[2];
    var d = m[4], e = m[5], f = m[6];
    var g = m[8], h = m[9], i = m[10];
    var t1 = e * i - f * h, t2 = f * g - d * i, t3 = d * h - e * g;
    var det = a * t1 + b * t2 + c * t3;
    var s = det ? 1 / det : 0;
    // 역행렬을 전치까지 한 결과를 바로 채운다.
    out[0] = t1 * s; out[3] = t2 * s; out[6] = t3 * s;
    out[1] = (c * h - b * i) * s; out[4] = (a * i - c * g) * s; out[7] = (b * g - a * h) * s;
    out[2] = (b * f - c * e) * s; out[5] = (c * d - a * f) * s; out[8] = (a * e - b * d) * s;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * WebGL 잔심부름
   * ------------------------------------------------------------------ */

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  function program(gl, vsBody, fsBody) {
    var prog = gl.createProgram();
    var vs = compile(gl, gl.VERTEX_SHADER, VS_HEAD + vsBody);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FS_HEAD + fsBody);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    // 자리를 못 박아 둬야 VAO 하나를 여러 프로그램에서 같이 쓸 수 있다.
    gl.bindAttribLocation(prog, 0, "position");
    gl.bindAttribLocation(prog, 1, "normal");
    gl.bindAttribLocation(prog, 2, "uv");
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    var u = {};
    var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(prog, i).name;
      u[name] = gl.getUniformLocation(prog, name);
    }
    return { id: prog, u: u };
  }

  function mesh(gl, attrs) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    attrs.forEach(function (a) {
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, a.data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);
    return { vao: vao, count: attrs[0].data.length / attrs[0].size };
  }

  function target(gl) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fbo: fbo, w: 0, h: 0 };
  }

  function sizeTarget(gl, t, w, h) {
    if (t.w === w && t.h === h) return;
    t.w = w; t.h = h;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  function f1(gl, u, n, v) { if (u[n]) gl.uniform1f(u[n], v); }
  function f2(gl, u, n, x, y) { if (u[n]) gl.uniform2f(u[n], x, y); }
  function f3(gl, u, n, v) { if (u[n]) gl.uniform3f(u[n], v[0], v[1], v[2]); }
  function i1(gl, u, n, v) { if (u[n]) gl.uniform1i(u[n], v); }
  function m4(gl, u, n, v) { if (u[n]) gl.uniformMatrix4fv(u[n], false, v); }
  function m3(gl, u, n, v) { if (u[n]) gl.uniformMatrix3fv(u[n], false, v); }

  /* ------------------------------------------------------------------ *
   * 붙이기
   * ------------------------------------------------------------------ */

  function mount(host, options) {
    if (!host) return null;

    var opts = {};
    var key;
    for (key in DEFAULTS) { if (DEFAULTS.hasOwnProperty(key)) opts[key] = DEFAULTS[key]; }
    for (key in (options || {})) { if (options.hasOwnProperty(key)) opts[key] = options[key]; }

    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: false,
      stencil: false
    });
    if (!gl) return null;

    var progShell, progCore, progBlur;
    try {
      progShell = program(gl, VERT, SHELL_FRAG);
      progCore = program(gl, VERT, CORE_FRAG);
      progBlur = program(gl, QUAD_VERT, BLUR_FRAG);
    } catch (err) {
      if (global.console) console.warn("PrismOrb: 셰이더를 만들지 못했다 —", err.message);
      return null;
    }

    // 껍데기 — 원본의 IcosahedronGeometry(1.15, 0) 을 베벨로 다시 깎은 것.
    var shellGeo = bevelize(icosahedron(1.15, 0), opts.bevel);
    // 오브의 바깥둘레가 캔버스 높이의 ORB_FILL 을 차지하는 화각(머리말 1번).
    // 실루엣은 카메라에서 오브에 그은 접선이 만든다 — 반지름을 그대로 나누면
    // 원근 때문에 조금 크게 잡히므로 접선 거리 sqrt(D² - R²) 로 나눈다.
    var reach = maxReach(shellGeo.position);
    var camFov = 2 * Math.atan(reach / (ORB_FILL * Math.sqrt(CAM_Z * CAM_Z - reach * reach))) * 180 / Math.PI;
    var shell = mesh(gl, [
      { loc: 0, size: 3, data: shellGeo.position },
      { loc: 1, size: 3, data: shellGeo.normal }
    ]);

    // 안쪽 빛 — 코어와 그걸 감싸는 헤일로. 둘 다 코어의 숨쉬는 배율을 같이 받는다.
    var coreGeo = solid(0.44, 1);
    var haloGeo = solid(0.82, 2);
    var core = mesh(gl, [
      { loc: 0, size: 3, data: coreGeo.position },
      { loc: 1, size: 3, data: coreGeo.normal }
    ]);
    var halo = mesh(gl, [
      { loc: 0, size: 3, data: haloGeo.position },
      { loc: 1, size: 3, data: haloGeo.normal }
    ]);

    var quad = mesh(gl, [
      { loc: 0, size: 3, data: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]) },
      { loc: 2, size: 2, data: new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]) }
    ]);

    var rt = target(gl);    // 코어 원본
    var rtA = target(gl);   // 가로 블러
    var rtB = target(gl);   // 세로 블러 — 껍데기가 굴절시키는 빛

    var proj = mat4();
    var view = mat4();
    view[14] = -CAM_Z;
    var model = mat4();
    var mv = mat4();
    var nm = new Float32Array(9);

    var pal = PALETTES[opts.palette] || PALETTES.info;
    var pw = 0, ph = 0, bw = 0, bh = 0;
    var raf = 0, dead = false, running = false;
    var start = 0;
    // 크기는 ResizeObserver 가 알려줄 때만 다시 잰다 — 프레임마다 레이아웃을 읽지 않는다.
    var needsResize = true;

    var reduce = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);
    host.classList.add("has-orb");

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);

    function resize() {
      needsResize = false;
      var w = host.clientWidth || 1;
      var h = host.clientHeight || 1;
      var ratio = Math.min((global.devicePixelRatio || 1) * SUPERSAMPLE, MAX_RATIO);
      var nw = Math.max(2, Math.round(w * ratio));
      var nh = Math.max(2, Math.round(h * ratio));
      if (nw === pw && nh === ph) return;
      pw = nw; ph = nh;
      canvas.width = pw;
      canvas.height = ph;
      bw = Math.max(2, Math.floor(pw / 4));
      bh = Math.max(2, Math.floor(ph / 4));
      sizeTarget(gl, rt, pw, ph);
      sizeTarget(gl, rtA, bw, bh);
      sizeTarget(gl, rtB, bw, bh);
      perspective(proj, camFov, pw / ph, CAM_NEAR, CAM_FAR);
    }

    function bind(fbo, w, h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function palUniforms(u) {
      f3(gl, u, "uA", pal.a); f3(gl, u, "uB", pal.b);
      f3(gl, u, "uC", pal.c); f3(gl, u, "uD", pal.d);
    }

    function draw(T) {
      var s = opts.speed;

      // 1. 안쪽 빛만 렌더타깃에. 껍데기는 이 패스에 없다.
      //    코어는 돌지 않고 숨만 쉰다 — 원본에서도 group 이 아니라 scene 에 바로 달려 있다.
      eulerXYZ(model, 0, 0, 0, 0);
      var cs = 1 + Math.sin(T * 0.9) * 0.07;
      model[0] = cs; model[5] = cs; model[10] = cs;
      mul4(mv, view, model);
      normalMatrix(nm, mv);

      bind(rt.fbo, pw, ph);
      gl.useProgram(progCore.id);
      gl.disable(gl.CULL_FACE);                                   // DoubleSide
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);       // AdditiveBlending
      m4(gl, progCore.u, "projectionMatrix", proj);
      m4(gl, progCore.u, "modelViewMatrix", mv);
      m3(gl, progCore.u, "normalMatrix", nm);
      f1(gl, progCore.u, "uTime", T);
      f1(gl, progCore.u, "uShift", opts.hueShift);
      palUniforms(progCore.u);
      gl.bindVertexArray(core.vao);
      gl.drawArrays(gl.TRIANGLES, 0, core.count);
      gl.bindVertexArray(halo.vao);
      gl.drawArrays(gl.TRIANGLES, 0, halo.count);

      // 2. 1/4 크기에서 가로 · 세로로 흐린다.
      var dir = opts.coreBlur * 9.0 * 16 / REF_PX;
      gl.useProgram(progBlur.id);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(quad.vao);
      i1(gl, progBlur.u, "uSrc", 0);
      gl.activeTexture(gl.TEXTURE0);

      bind(rtA.fbo, bw, bh);
      gl.bindTexture(gl.TEXTURE_2D, rt.tex);
      f2(gl, progBlur.u, "uDir", dir, 0);
      gl.drawArrays(gl.TRIANGLES, 0, quad.count);

      bind(rtB.fbo, bw, bh);
      gl.bindTexture(gl.TEXTURE_2D, rtA.tex);
      f2(gl, progBlur.u, "uDir", 0, dir);
      gl.drawArrays(gl.TRIANGLES, 0, quad.count);

      // 3. 유리 껍데기를 화면에. 뒷면 먼저 · 앞면 나중 — 원본의 renderOrder 1 · 3 이다.
      eulerXYZ(model, T * 0.62 * s, T * 0.41 * s, T * 0.27 * s, Math.sin(T * 0.8) * 0.05);
      mul4(mv, view, model);
      normalMatrix(nm, mv);

      bind(null, pw, ph);
      gl.useProgram(progShell.id);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      m4(gl, progShell.u, "projectionMatrix", proj);
      m4(gl, progShell.u, "modelViewMatrix", mv);
      m3(gl, progShell.u, "normalMatrix", nm);
      f1(gl, progShell.u, "uTime", T);
      f1(gl, progShell.u, "uGlow", opts.glow);
      f1(gl, progShell.u, "uShift", opts.hueShift);
      f1(gl, progShell.u, "uGlass", opts.glass ? 1 : 0);
      f1(gl, progShell.u, "uRefract", opts.refraction);
      f1(gl, progShell.u, "uDisp", opts.dispersion);
      f1(gl, progShell.u, "uBlur", opts.coreBlur * 0.6);
      f1(gl, progShell.u, "uBevel", opts.bevel > 0.001 ? 1 : 0);
      f2(gl, progShell.u, "uRes", pw, ph);
      palUniforms(progShell.u);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, rt.tex);
      i1(gl, progShell.u, "uTex", 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, rtB.tex);
      i1(gl, progShell.u, "uSoftTex", 1);

      gl.bindVertexArray(shell.vao);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);                                      // BackSide
      gl.drawArrays(gl.TRIANGLES, 0, shell.count);
      gl.cullFace(gl.BACK);                                       // FrontSide
      gl.drawArrays(gl.TRIANGLES, 0, shell.count);

      // 다음 프레임엔 이 타깃들에 다시 그린다 — 유닛에 걸어 둔 채로 두지 않는다.
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindVertexArray(null);
    }

    function still() {
      if (dead) return;
      if (needsResize) resize();
      draw(STILL_T);
    }

    function tick(now) {
      if (dead) return;
      if (!start) start = now;
      if (needsResize) resize();
      draw((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function play() {
      if (dead || running) return;
      if (reduce && reduce.matches) { still(); return; }
      running = true;
      start = 0;
      raf = requestAnimationFrame(tick);
    }

    // 탭이 가려지면 멈춘다 — 안 보이는 그림에 GPU 를 쓸 이유가 없다.
    function onVisibility() {
      if (document.hidden) stop();
      else play();
    }

    function onMotionChange() {
      stop();
      play();
    }

    var ro = null;
    if (global.ResizeObserver) {
      ro = new ResizeObserver(function () {
        needsResize = true;
        // 도는 중이면 다음 프레임이 알아서 새 크기를 잡는다.
        // 멈춰 있을 때(움직임 줄이기)만 그 자리에서 한 장 다시 그린다.
        if (!running) still();
      });
      ro.observe(host);
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (reduce && reduce.addEventListener) reduce.addEventListener("change", onMotionChange);

    // 컨텍스트를 잃으면 조용히 물러난다 — CSS 자리표시자 원이 다시 나온다.
    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      destroy();
    });

    function destroy() {
      if (dead) return;
      dead = true;
      stop();
      if (ro) ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (reduce && reduce.removeEventListener) reduce.removeEventListener("change", onMotionChange);
      host.classList.remove("has-orb");
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    play();

    return {
      setPalette: function (name) {
        var next = PALETTES[name];
        if (!next || next === pal) return;
        pal = next;
        if (!running) still();
      },
      destroy: destroy
    };
  }

  global.PrismOrb = { mount: mount, PALETTES: PALETTES };
})(window);
