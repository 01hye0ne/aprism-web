/*
 * 우측 패널의 로봇 그래픽 — 3D 로봇개와 바닥 방향 링.
 *
 * 들어 있는 것
 *   1. 로봇개     디자이너 핸드오프(assets/source/심플한 로봇개 3D 모델링-handoff)의
 *                 three.js 모델을 그대로 옮겼다. 네 가지 동작(걷기 · 대기 · 앉기 · 검사)을
 *                 뼈대 없이 구워 둔 클립으로 돌린다.
 *   2. 바닥 다이얼 Figma UI_00 826:12682 의 Robot-grahpics 에서 온 바닥 링이다.
 *                 24 칸(한 칸 15도)으로 쪼갰고, 대각 네 곳에 작은 삼각 표식이 붙는다.
 *   3. 방향 불    로봇이 보는 쪽 칸에 불이 들어온다. 가장 밝은 칸이 코가 가리키는 쪽이고
 *                 양옆으로 55도까지 차차 꺼진다.
 *
 * 구도는 고정이다 — 돌려 볼 수 없다. 방위는 지도의 처음 자리와 같은 45도라
 * 패널과 지도가 같은 쪽을 가리킨다. 지도를 돌려도 여기는 그대로다 —
 * 패널이 흔들리지 않아야 "로봇이 어느 쪽을 보는지"가 읽힌다.
 *
 * 카메라는 직교다. 아이소메트릭 느낌을 원근 왜곡 없이 붙박아 두려는 것이다.
 *
 * 로봇 카드는 열두 장이지만 캐러셀은 한 장만 보여 준다. WebGL 판도 하나만 두고
 * 고른 카드의 그래픽 자리에 겹쳐 놓는다 — 열두 개의 컨텍스트를 띄울 일이 아니다.
 * three.js 를 못 가져오면 아무것도 하지 않는다. 그 자리에는 원래의 SVG 로봇이 남는다.
 */
(function () {
  "use strict";

  var mount = document.querySelector("[data-robot-stage]");
  var canvas = mount && mount.querySelector("canvas");
  if (!mount || !canvas) { return; }

  /* ---------- 구도 ---------- */
  var YAW = Math.PI / 4;                 /* 지도 HOME_YAW 와 같다 */
  var PITCH = 46 * Math.PI / 180;        /* 바닥 링이 Figma 비율에 가깝게 보이는 기울기 */
  var R = 0.82;                          /* 바닥 링 반지름(m) — 로봇 몸길이가 1 쯤이다 */

  /*
   * 모델의 코는 로컬 +X 를 본다. 방위각은 지도와 같은 atan2(dx, dz) 라
   * 그 각으로 돌리면 +X 가 (cos, -sin) 쪽을 봐서 90도 어긋난다. 그만큼 되돌린다.
   */
  var NOSE = -Math.PI / 2;
  var LOOK_Y = 0.30;                     /* 카메라가 보는 높이. 로봇이 칸 가운데에 서게 한다 */
  var OVER = 1.06;                       /* 링이 좌우로 넘치는 정도 — 클수록 그림이 커진다 */
  var SCALE = 0.9;                       /* 그림 크기 손잡이. 1 이 기준이고 작을수록 줄어든다 */

  /*
   * 바닥 다이얼의 눈금. Figma 값은 #323846 인데 로봇 카드 면이 bg/surface/subtle(#2C3443)로
   * 밝아지면서 바탕과 거의 같은 색이 됐다. 한 단계 올려 gray/600 을 쓴다.
   */
  var RING = 0x4e576a;
  var ARC_TAIL = 0x3b79d5;               /* 방향 호 꼬리 */
  var ARC_HEAD = 0x4990e0;               /* 방향 호 머리 */
  var ARC_PEAK = 0x9fcdff;               /* 가장 밝은 칸 — 여기가 로봇이 보는 쪽이다 */

  var MOTION = { "수행중": "walk", "대기": "idle", "완료": "sit", "끊김": "idle" };

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /*
   * 방향은 지도가 알려 준다(map.js 의 showLane · 이동 갱신).
   * 듣는 자리를 three.js 를 받기 전에 먼저 걸어 둔다 — 지도가 먼저 말하고
   * 이쪽이 나중에 깨면 그 한 번을 놓쳐서 로봇이 처음 방향에 붙박인다.
   */
  /*
   * 지도가 알려 주기 전까지 볼 쪽. 카메라가 45도에 서 있으므로 이 각이면
   * 로봇이 화면 오른쪽 아래를 향한 3/4 로 선다 — 옆모습으로 납작해지지 않는 자리다.
   */
  var want = Math.PI / 2;
  var onTurn = null;

  document.addEventListener("aprism:robot-heading", function (event) {
    var h = event.detail && event.detail.heading;
    if (typeof h === "number") { want = h; }
    if (onTurn) { onTurn(); }
  });

  /* 지도와 같은 길이다 — <head> 의 importmap 이 "three" 를 CDN 으로 이어 준다. */
  import("three").then(start).catch(function () { /* 없으면 SVG 로봇이 그대로 남는다 */ });

  function start(THREE) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ("outputColorSpace" in renderer) { renderer.outputColorSpace = THREE.SRGBColorSpace; }

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);

    /*
     * 빛 — 핸드오프의 스튜디오 조명을 어두운 패널에 맞춰 옮겼다.
     * 반구광의 아랫색을 패널 바탕으로 낮춰야 흰 몸체의 밑면이 떠 보이지 않는다.
     */
    scene.add(new THREE.HemisphereLight(0xdfe7f5, 0x1b2434, 1.0));
    var key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(4, 7, 5);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    /*
     * 뒤에서 치는 빛 — 몸통 위 장비(LiDAR · PTZ)가 거의 검은 재질이라
     * 어두운 패널 바탕에 묻혀 윤곽이 사라졌다. 뒤위에서 한 겹 비춰 테두리를 띄운다.
     * 면을 밝히는 게 아니라 가장자리만 걸치게 하는 빛이라 세기를 높여도 흰 몸체가 뜨지 않는다.
     */
    var rim = new THREE.DirectionalLight(0xbcd8ff, 2.4);
    rim.position.set(-4, 5, -7);
    scene.add(rim);

    var dial = buildDial(THREE);
    scene.add(dial.group);

    var dog = buildDog(THREE);
    var turn = new THREE.Group();          /* 방향만 맡는 바깥 틀 — 동작 클립은 안쪽을 돌린다 */
    turn.add(dog.group);
    scene.add(turn);

    var mixer = new THREE.AnimationMixer(dog.group);
    var actions = {};
    dog.clips.forEach(function (clip) { actions[clip.name] = mixer.clipAction(clip); });
    actions.sit.setLoop(THREE.LoopOnce);
    actions.sit.clampWhenFinished = true;
    var playing = null;

    function play(name) {
      var next = actions[name] || actions.idle;
      if (playing === next) { return; }
      next.reset().setEffectiveWeight(1).play();
      if (playing) { playing.crossFadeTo(next, 0.45, false); }
      playing = next;
    }

    /* ---------- 자리 잡기 ---------- */
    var look = new THREE.Vector3(0, LOOK_Y, 0);

    function fit() {
      var w = mount.clientWidth || 1;
      var h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);

      /*
       * 그림 크기는 상자가 아니라 "그래픽 칸"으로 정한다. 상자는 사방 --stage-pad 만큼
       * 더 넓은데, 그 폭으로 틀을 잡으면 상자를 넓힐수록 그림이 커져 버린다.
       * 넓힌 자리는 칸 밖으로 나간 부분을 보여 주는 데 쓴다 — 거기서 잘리지 않게 하려는 것이다.
       */
      var pad = parseFloat(window.getComputedStyle(mount).getPropertyValue("--stage-pad")) || 0;
      var ref = Math.max(1, w - pad * 2);
      var perPx = (R / OVER / SCALE) / (ref / 2);
      camera.left = -w / 2 * perPx; camera.right = w / 2 * perPx;
      camera.top = h / 2 * perPx; camera.bottom = -h / 2 * perPx;
      camera.updateProjectionMatrix();
      camera.position.set(
        Math.cos(PITCH) * Math.sin(YAW) * 12,
        LOOK_Y + Math.sin(PITCH) * 12,
        Math.cos(PITCH) * Math.cos(YAW) * 12
      );
      camera.lookAt(look);
    }

    fit();
    if (window.ResizeObserver) { new ResizeObserver(fit).observe(mount); }
    else { window.addEventListener("resize", fit); }

    /* ---------- 고른 로봇을 따라간다 ---------- */
    var now = want;              /* 지금 보고 있는 방향 — 천천히 따라간다 */

    function motion() {
      var card = document.querySelector(".robot-strip.is-carousel .robot-card[aria-pressed='true']");
      var badge = card && card.querySelector(".robot-row .badge");
      var text = badge ? badge.textContent.replace(/\s+/g, "") : "";
      return MOTION[text] || "idle";
    }

    function follow() { play(motion()); }

    onTurn = follow;

    /* 카드를 바꾸면 상태도 바뀐다. 눌린 뒤의 상태를 읽어야 하므로 한 틱 뒤에 본다. */
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-robot], [data-robot-pick], [data-rc-step]")) {
        window.setTimeout(follow, 0);
      }
    }, true);

    follow();
    turn.rotation.y = now + NOSE;
    dial.aim(now);

    /* ---------- 보일 때만 그린다 ---------- */
    var clock = new THREE.Clock();
    var live = true;
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (rows) { live = rows[0].isIntersecting; }).observe(mount);
    }

    renderer.setAnimationLoop(function () {
      if (!live || document.hidden) { return; }
      var dt = clock.getDelta();
      if (!still) { mixer.update(dt); }

      /* 방향은 짧은 쪽으로 돈다 — 350도를 돌아가면 보는 사람이 멀미한다. */
      var d = ((want - now + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      now += d * (1 - Math.pow(0.01, dt));
      turn.rotation.y = now + NOSE;
      dial.aim(now);

      renderer.render(scene, camera);
    });

    /* 여기까지 왔으면 3D 가 산 것이다 — 아래의 SVG 로봇을 가린다. */
    mount.classList.add("is-live");
    var box = mount.closest(".robot-carousel");
    if (box) { box.classList.add("has-stage"); }
  }

  /* ------------------------------------------------------------------ *
   * 바닥 링 — Figma 826:12682 의 Robot-grahpics.
   *
   * 카메라 방위가 45도로 붙박여 있으므로 화면의 상·하·좌·우는 월드의 대각선이고
   * 화면의 대각선은 월드의 축이다. 그래서 끊긴 자리는 월드 45도, 삼각 표식은 월드 축에 둔다 —
   * 보이는 자리는 Figma 그대로이면서 표식이 설비 축을 가리킨다.
   * ------------------------------------------------------------------ */

  function onRing(THREE, angle, radius) {
    return new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  }

  /*
   * 바닥 위의 띠 한 토막. 선(THREE.Line)은 WebGL 에서 굵기를 못 준다 —
   * linewidth 는 거의 모든 브라우저가 무시한다. 그래서 바닥에 눕힌 면으로 그린다.
   * 폭은 월드 단위다. 칸 폭이 2R/OVER 이므로 1px ≈ 0.0153R 로 보면 된다.
   */
  function ribbon(THREE, a0, a1, width, color, opacity, lift) {
    var N = 72;
    var pos = new Float32Array((N + 1) * 2 * 3);
    var idx = [];
    for (var i = 0; i <= N; i++) {
      var a = a0 + (a1 - a0) * i / N;
      var sn = Math.sin(a), cs = Math.cos(a);
      var k = i * 6;
      pos[k] = sn * (R - width / 2); pos[k + 1] = 0; pos[k + 2] = cs * (R - width / 2);
      pos[k + 3] = sn * (R + width / 2); pos[k + 4] = 0; pos[k + 5] = cs * (R + width / 2);
      if (i < N) { idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2); }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    var mat = new THREE.MeshBasicMaterial({
      color: color, side: THREE.DoubleSide,
      transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = lift || 0;
    return { mesh: mesh, geo: geo, mat: mat, count: N };
  }

  /* ------------------------------------------------------------------ *
   * 바닥 다이얼 — 링을 24 칸으로 쪼개고, 로봇이 보는 쪽 칸에 불이 들어온다.
   *
   * 한 칸이 15도다. 가장 밝은 칸이 곧 로봇의 코가 가리키는 쪽이고, 양옆으로
   * 55도까지 차차 꺼진다. 칸을 잘게 나눈 덕에 몇 도쯤 돌았는지가 눈에 잡힌다.
   *
   * 두 겹이다. 늘 깔려 있는 가는 눈금과, 불이 들어올 때만 보이는 굵은 띠.
   * 색만 바꾸면 밝아지기만 할 뿐 굵어지지 않아서, 켜진 칸이 눈에 덜 들어온다.
   *
   * 대각 네 곳의 삼각 표식은 그대로 둔다 — 화면 대각선은 월드의 축이라
   * 저 표식이 설비 격자의 방향을 알려 준다. 칸 경계와도 맞아떨어진다(15도의 배수).
   * ------------------------------------------------------------------ */

  function buildDial(THREE) {
    var SEG = 24;                          /* 칸 수 — 한 칸 15도 */
    var GAP = 3.4 * Math.PI / 180;         /* 칸과 칸 사이 */
    var LIT = 55 * Math.PI / 180;          /* 불이 번지는 폭(한쪽) */
    var step = Math.PI * 2 / SEG;

    var group = new THREE.Group();
    var cells = [];

    var base = new THREE.Color(RING);
    var tail = new THREE.Color(ARC_TAIL);
    var head = new THREE.Color(ARC_HEAD);
    var peak = new THREE.Color(ARC_PEAK);

    for (var i = 0; i < SEG; i++) {
      var a0 = i * step + GAP / 2;
      var a1 = (i + 1) * step - GAP / 2;

      /* 눈금 — Figma 바닥 링과 같은 굵기(≈1.5px). */
      group.add(ribbon(THREE, a0, a1, R * 0.024, RING, 1, 0).mesh);

      /* 불 — 꺼져 있을 때는 투명이라 눈금만 보인다. */
      var lamp = ribbon(THREE, a0, a1, R * 0.075, ARC_HEAD, 0, 0.003);
      group.add(lamp.mesh);
      cells.push({ at: (i + 0.5) * step, mat: lamp.mat });
    }

    /* 대각 표식 — 링 바깥으로 뾰족한 작은 삼각(Figma 826:12682). */
    var TIP = R * 0.075, HALF = 3.2 * Math.PI / 180;
    var face = new THREE.MeshBasicMaterial({ color: RING, side: THREE.DoubleSide });
    for (var m = 0; m < 4; m++) {
      var a = m * Math.PI / 2;
      var geo = new THREE.BufferGeometry().setFromPoints([
        onRing(THREE, a - HALF, R),
        onRing(THREE, a + HALF, R),
        onRing(THREE, a, R + TIP)
      ]);
      geo.setIndex([0, 1, 2]);
      var mesh = new THREE.Mesh(geo, face);
      mesh.position.y = 0.001;
      group.add(mesh);
    }

    /* 번짐 — 켜진 칸들 아래에 깔아 바닥에 빛이 번진 것처럼 둔다. 머리와 같이 돈다. */
    var glow = ribbon(THREE, -LIT, LIT, R * 0.24, ARC_HEAD, 0.16, 0.0015);
    glow.mat.blending = THREE.AdditiveBlending;
    var glowPivot = new THREE.Group();
    glowPivot.add(glow.mesh);
    group.add(glowPivot);

    var mix = new THREE.Color();

    return {
      group: group,
      aim: function (heading) {
        glowPivot.rotation.y = heading;
        for (var i = 0; i < cells.length; i++) {
          var d = Math.abs(((cells[i].at - heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
          var t = d >= LIT ? 0 : Math.pow(1 - d / LIT, 1.6);
          cells[i].mat.opacity = t;
          /* 멀수록 짙은 파랑, 가까울수록 밝은 파랑 — 머리가 어디인지 색으로도 읽힌다. */
          if (t > 0) {
            if (t <= 0.35) { mix.copy(base).lerp(tail, t / 0.35); }
            else if (t <= 0.75) { mix.copy(tail).lerp(head, (t - 0.35) / 0.4); }
            else { mix.copy(head).lerp(peak, (t - 0.75) / 0.25); }
            cells[i].mat.color.copy(mix);
          }
        }
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 로봇개 — 핸드오프(3d/project/Robot Dog.html)의 모델과 동작을 옮긴 것이다.
   *
   * 뼈대가 없는 모델이라 다리는 2링크 IK 로 풀고, 그 결과를 클립으로 구워 둔다.
   * 치수 · 재질 · 걸음 값은 원본 그대로다. 바꾼 것은 하나도 없다 —
   * 디자이너가 그 화면에서 보고 넘긴 모습이 여기서도 같아야 한다.
   * ------------------------------------------------------------------ */

  function buildDog(THREE) {
    /* 모서리를 둥글린 상자 — 원본의 rbox. */
    function rbox(w, h, d, r, seg) {
      var g = new THREE.BoxGeometry(w, h, d, seg || 20, seg || 20, seg || 20);
      var p = g.attributes.position, n = g.attributes.normal;
      var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
      var v = new THREE.Vector3(), c = new THREE.Vector3(), o = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
        o.subVectors(v, c);
        if (o.lengthSq() > 1e-10) {
          o.normalize();
          n.setXYZ(i, o.x, o.y, o.z);
          o.multiplyScalar(r);
          v.addVectors(c, o);
          p.setXYZ(i, v.x, v.y, v.z);
        }
      }
      p.needsUpdate = true; n.needsUpdate = true;
      return g;
    }

    var M = {
      shell: new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.42, metalness: 0 }),
      gloss: new THREE.MeshStandardMaterial({ color: 0x1b1d23, roughness: 0.12, metalness: 0.1 }),
      joint: new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.5, metalness: 0.15 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x26272a, roughness: 0.85, metalness: 0 }),
      /* 원본은 0x1d1e22 인데 어두운 패널에서 바탕과 붙어 버린다 — 한 단계 올렸다. */
      dark: new THREE.MeshStandardMaterial({ color: 0x33373f, roughness: 0.5, metalness: 0.1 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x2f4a8a, roughness: 0.12, metalness: 0.2 }),
      red: new THREE.MeshStandardMaterial({ color: 0xff8a80, emissive: 0xff2a1f, emissiveIntensity: 2.2, roughness: 0.3 }),
      light: new THREE.MeshStandardMaterial({ color: 0x9cc0ff, emissive: 0x3f7cff, emissiveIntensity: 1.6, roughness: 0.3 })
    };

    function mesh(name, geo, mat, parent, pos, rot) {
      var m = new THREE.Mesh(geo, mat);
      m.name = name;
      if (pos) { m.position.set(pos[0], pos[1], pos[2]); }
      if (rot) { m.rotation.set(rot[0], rot[1], rot[2]); }
      parent.add(m);
      return m;
    }

    var dog = new THREE.Group(); dog.name = "robot_dog";
    var HIP_Y = 0.54, L1 = 0.29, L2 = 0.29, FOOT_R = 0.038;

    var chassis = new THREE.Group(); chassis.name = "chassis"; chassis.position.y = HIP_Y; dog.add(chassis);
    var body = new THREE.Group(); body.name = "body"; body.position.y = 0.04; chassis.add(body);
    mesh("torso_core", rbox(0.94, 0.17, 0.24, 0.03), M.dark, body, [0.02, -0.01, 0]);
    mesh("torso_top", rbox(0.96, 0.055, 0.36, 0.025), M.shell, body, [0.02, 0.0725, 0]);
    mesh("torso_front", rbox(0.08, 0.2, 0.36, 0.04), M.shell, body, [0.46, 0, 0]);
    mesh("torso_mid", rbox(0.48, 0.2, 0.36, 0.04), M.shell, body, [0, 0, 0]);
    mesh("torso_rear", rbox(0.05, 0.2, 0.36, 0.025), M.shell, body, [-0.435, 0, 0]);
    mesh("belly", rbox(0.9, 0.03, 0.28, 0.012), M.dark, body, [0.02, -0.095, 0]);

    var pay = new THREE.Group(); pay.name = "payload"; pay.position.y = 0.1; body.add(pay);
    mesh("mount_rail", rbox(0.74, 0.035, 0.26, 0.014), M.dark, pay, [0, 0.02, 0]);

    var ptz = new THREE.Group(); ptz.name = "ptz_camera"; ptz.position.set(0.24, 0.037, 0); pay.add(ptz);
    mesh("ptz_base", rbox(0.17, 0.06, 0.2, 0.02), M.dark, ptz, [0, 0.03, 0]);
    mesh("ptz_tower", rbox(0.1, 0.13, 0.12, 0.025), M.dark, ptz, [0, 0.125, 0]);
    mesh("ptz_led_l", new THREE.SphereGeometry(0.008, 16, 8), M.light, ptz, [0.051, 0.14, 0.025]);
    mesh("ptz_led_r", new THREE.SphereGeometry(0.008, 16, 8), M.light, ptz, [0.051, 0.14, -0.025]);
    mesh("ptz_neck", new THREE.CylinderGeometry(0.03, 0.04, 0.04, 32), M.joint, ptz, [0, 0.21, 0]);
    mesh("ptz_head", new THREE.SphereGeometry(0.068, 40, 24), M.gloss, ptz, [0, 0.29, 0]);
    mesh("ptz_lens_ring", new THREE.CylinderGeometry(0.03, 0.034, 0.03, 32), M.dark, ptz, [0.065, 0.29, 0], [0, 0, Math.PI / 2]);
    mesh("ptz_lens", new THREE.SphereGeometry(0.024, 24, 12), M.glass, ptz, [0.078, 0.29, 0]);
    mesh("ptz_cage_a", new THREE.TorusGeometry(0.1, 0.008, 12, 64), M.dark, ptz, [0, 0.29, 0], [0, Math.PI / 2, 0]);
    mesh("ptz_cage_b", new THREE.TorusGeometry(0.1, 0.008, 12, 64), M.dark, ptz, [0, 0.29, 0], [0, Math.PI / 4, 0]);
    mesh("ptz_cage_c", new THREE.TorusGeometry(0.1, 0.008, 12, 64), M.dark, ptz, [0, 0.29, 0], [0, -Math.PI / 4, 0]);
    mesh("mic_arm", new THREE.CylinderGeometry(0.008, 0.008, 0.05, 16), M.dark, ptz, [0.03, 0.2, 0.07]);
    mesh("mic", new THREE.CapsuleGeometry(0.02, 0.15, 8, 24), M.gloss, ptz, [0.08, 0.225, 0.07], [0, 0, Math.PI / 2]);

    mesh("center_puck", new THREE.CylinderGeometry(0.04, 0.04, 0.05, 32), M.dark, pay, [0, 0.062, 0]);

    var lidar = new THREE.Group(); lidar.name = "lidar"; lidar.position.set(-0.24, 0.037, 0); pay.add(lidar);
    mesh("lidar_box", rbox(0.2, 0.05, 0.2, 0.018), M.dark, lidar, [0, 0.025, 0]);
    mesh("lidar_base", new THREE.CylinderGeometry(0.058, 0.06, 0.04, 48), M.dark, lidar, [0, 0.07, 0]);
    mesh("lidar_band", new THREE.CylinderGeometry(0.056, 0.056, 0.045, 48), M.glass, lidar, [0, 0.112, 0]);
    mesh("lidar_cap", new THREE.CylinderGeometry(0.058, 0.06, 0.06, 48), M.dark, lidar, [0, 0.165, 0]);
    mesh("lidar_top", new THREE.CylinderGeometry(0.045, 0.058, 0.012, 48), M.gloss, lidar, [0, 0.201, 0]);
    mesh("rear_cap", rbox(0.06, 0.13, 0.26, 0.03), M.joint, body, [-0.465, 0, 0]);

    var faceG = new THREE.Group(); faceG.name = "front_face"; faceG.position.x = 0.02; faceG.scale.set(1, 0.8, 0.86); body.add(faceG);
    mesh("face_recess", rbox(0.014, 0.13, 0.25, 0.01), M.rubber, faceG, [0.475, 0, 0]);
    mesh("bezel_top", rbox(0.02, 0.016, 0.27, 0.008), M.shell, faceG, [0.478, 0.072, 0]);
    mesh("bezel_bottom", rbox(0.02, 0.016, 0.27, 0.008), M.shell, faceG, [0.478, -0.072, 0]);
    mesh("bezel_left", rbox(0.02, 0.16, 0.016, 0.008), M.shell, faceG, [0.478, 0, 0.13]);
    mesh("bezel_right", rbox(0.02, 0.16, 0.016, 0.008), M.shell, faceG, [0.478, 0, -0.13]);
    var camGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 24);
    [1, -1].forEach(function (s) {
      var side = s > 0 ? "left" : "right";
      mesh("cam_pod_" + side, rbox(0.012, 0.112, 0.042, 0.008), M.gloss, faceG, [0.481, 0, s * 0.092]);
      [0.034, 0, -0.034].forEach(function (y, k) {
        mesh("cam_" + side + "_" + k, camGeo, M.glass, faceG, [0.4905, y, s * 0.092], [0, 0, Math.PI / 2]);
      });
      mesh("face_light_" + side, rbox(0.008, 0.075, 0.008, 0.003), M.light, faceG, [0.477, 0, s * 0.158]);
      mesh("inspect_light_" + side, rbox(0.01, 0.079, 0.011, 0.004), M.red, faceG, [0.4775, 0, s * 0.158]).scale.setScalar(0.001);
    });
    mesh("grille", rbox(0.01, 0.112, 0.1, 0.006), M.joint, faceG, [0.48, 0, 0]);
    var dotGeo = new THREE.SphereGeometry(0.0035, 8, 6);
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 6; c++) {
        mesh("grille_hole_" + r + "_" + c, dotGeo, M.gloss, faceG, [0.4865, 0.0455 - r * 0.013, -0.035 + c * 0.014]);
      }
    }

    var a = Math.acos((HIP_Y - FOOT_R) / (L1 + L2));
    var legs = [];
    [[0.33, 1], [0.33, -1], [-0.33, 1], [-0.33, -1]].forEach(function (pair, i) {
      var x = pair[0], s = pair[1];
      var tag = (x > 0 ? "front" : "rear") + (s > 0 ? "_left" : "_right");
      var hip = new THREE.Group(); hip.name = "hip_" + tag; hip.position.set(x, 0, s * 0.15); chassis.add(hip);
      mesh("hip_roll_" + tag, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 40), M.joint, hip, [0, 0, -s * 0.01], [0, 0, Math.PI / 2]);
      mesh("hip_motor_" + tag, new THREE.CylinderGeometry(0.066, 0.066, 0.1, 40), M.joint, hip, [0, 0, s * 0.03], [Math.PI / 2, 0, 0]);
      mesh("hip_cap_" + tag, new THREE.CylinderGeometry(0.05, 0.05, 0.012, 40), M.shell, hip, [0, 0, s * 0.083], [Math.PI / 2, 0, 0]);

      var thigh = new THREE.Group(); thigh.name = "thigh_joint_" + tag; thigh.position.z = s * 0.125; thigh.rotation.z = -a; hip.add(thigh);
      mesh("thigh_" + tag, new THREE.CapsuleGeometry(0.052, L1 - 0.04, 8, 32), M.shell, thigh, [0, -L1 / 2, 0]);

      var knee = new THREE.Group(); knee.name = "knee_joint_" + tag; knee.position.y = -L1; knee.rotation.z = 2 * a; thigh.add(knee);
      mesh("knee_" + tag, new THREE.SphereGeometry(0.045, 32, 16), M.joint, knee);
      mesh("shin_" + tag, new THREE.CylinderGeometry(0.03, 0.022, L2, 32), M.joint, knee, [0, -L2 / 2, 0]);
      mesh("foot_" + tag, new THREE.SphereGeometry(FOOT_R, 32, 16), M.rubber, knee, [0, -L2, 0]);
      legs.push({ thigh: thigh, knee: knee, x: x, offset: (i === 0 || i === 3) ? 0 : 0.5 });
    });

    /* ---- 동작 — 2링크 IK, 발 목표는 월드 (x, y) · 몸통은 기울기와 높이 ---- */
    function solveLeg(L, pitch, py, fx, fy) {
      var c = Math.cos(pitch), s = Math.sin(pitch);
      var hx = L.x * c, hy = HIP_Y + py + L.x * s;
      var dx0 = fx - hx, dy0 = fy - hy;
      var dx = dx0 * c + dy0 * s, dy = -dx0 * s + dy0 * c;
      var D = Math.min(Math.sqrt(dx * dx + dy * dy), L1 + L2 - 1e-4);
      var phi = Math.atan2(dx, -dy);
      var beta = Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D));
      var gamma = Math.acos((L2 * L2 + D * D - L1 * L1) / (2 * L2 * D));
      return [phi - beta, beta + gamma];
    }

    function ease(t) { return t * t * (3 - 2 * t); }
    function lerp(x, y, t) { return x + (y - x) * t; }

    var STAND = { pitch: 0, py: 0, feet: legs.map(function (L) { return [L.x, FOOT_R]; }) };
    /*
     * 앉기 — 핸드오프는 뒷다리만 접고 앞다리는 선 채로 두었다(개가 앉는 모습).
     * 네 다리를 다 접게 고쳤다. 몸을 0.30 내리면 엉덩이가 0.54 에서 0.24 로 와서
     * 다리 길이(0.58) 가 한참 남아 네 다리 모두 Z 자로 접힌다.
     * 발은 엉덩이보다 조금씩 바깥에 둔다 — 바로 밑에 두면 무릎이 몸통을 파고든다.
     * 가슴만 조금 든 채로(pitch 0.12) 둔다. 완전히 평평하면 엎드린 것처럼 보인다.
     */
    var SIT = {
      pitch: 0.12,
      py: -0.30,
      feet: legs.map(function (L) { return [L.x > 0 ? L.x + 0.05 : L.x - 0.05, FOOT_R]; })
    };

    var poses = {
      walk: function (t) {
        var T = 0.9, S = 0.15, H = 0.07, ph = t / T;
        return { pitch: 0, py: 0.006 * Math.cos(4 * Math.PI * ph), feet: legs.map(function (L) {
          var u = (ph + L.offset) % 1;
          if (u < 0.5) { return [L.x + S / 2 - S * (u / 0.5), FOOT_R]; }
          var k = (u - 0.5) / 0.5;
          return [L.x - S / 2 + S * ease(k), FOOT_R + H * Math.sin(Math.PI * k)];
        }) };
      },
      idle: function (t) {
        var b = Math.sin(2 * Math.PI * t / 3);
        return { pitch: 0.008 * b, py: 0.006 * b, feet: STAND.feet };
      },
      inspect: function (t) {
        var b = Math.sin(2 * Math.PI * t / 3);
        return { pitch: 0.14 + 0.006 * b, py: 0.004 * b, feet: STAND.feet };
      },
      sit: function (t) {
        var k = ease(Math.min(t / 1.2, 1));
        return { pitch: lerp(STAND.pitch, SIT.pitch, k), py: lerp(0, SIT.py, k),
          feet: STAND.feet.map(function (f, i) { return [lerp(f[0], SIT.feet[i][0], k), FOOT_R]; }) };
      }
    };

    function bake(name, fn, dur, n, extra) {
      var times = [], cq = [], cp = [];
      var lq = legs.map(function () { return [[], []]; });
      var q = new THREE.Quaternion(), e = new THREE.Euler();
      for (var i = 0; i <= n; i++) {
        var t = dur * i / n;
        var P = fn(t % dur === 0 && i === n && name !== "sit" ? 0 : t);
        times.push(t);
        q.setFromEuler(e.set(0, 0, P.pitch)); cq.push(q.x, q.y, q.z, q.w);
        cp.push(0, HIP_Y + P.py, 0);
        legs.forEach(function (L, j) {
          var sol = solveLeg(L, P.pitch, P.py, P.feet[j][0], P.feet[j][1]);
          q.setFromEuler(e.set(0, 0, sol[0])); lq[j][0].push(q.x, q.y, q.z, q.w);
          q.setFromEuler(e.set(0, 0, sol[1])); lq[j][1].push(q.x, q.y, q.z, q.w);
        });
      }
      var tracks = [
        new THREE.VectorKeyframeTrack("chassis.position", times, cp),
        new THREE.QuaternionKeyframeTrack("chassis.quaternion", times, cq)
      ];
      legs.forEach(function (L, j) {
        tracks.push(new THREE.QuaternionKeyframeTrack(L.thigh.name + ".quaternion", times, lq[j][0]));
        tracks.push(new THREE.QuaternionKeyframeTrack(L.knee.name + ".quaternion", times, lq[j][1]));
      });
      return new THREE.AnimationClip(name, dur, tracks.concat(extra || []));
    }

    var clips = [
      bake("walk", poses.walk, 0.9, 36),
      bake("sit", poses.sit, 1.6, 40),
      bake("idle", poses.idle, 3, 45),
      /* 검사 — 앞쪽 붉은 표시등이 켜진다(평소에는 0 으로 접어 둔 조각이다). */
      bake("inspect", poses.inspect, 3, 45, ["left", "right"].map(function (sd) {
        return new THREE.VectorKeyframeTrack("inspect_light_" + sd + ".scale", [0, 3], [1, 1, 1, 1, 1, 1]);
      }))
    ];

    return { group: dog, clips: clips };
  }
})();
