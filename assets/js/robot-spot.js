/*
 * 지도 위 3D 로봇 — 디자이너 시안 "SPOT 로봇 360 시안"(artifact Pn2Hk8b3oJG59FtAGB2sZE, 10/29)을 옮겼다.
 *
 *   spot   SPOT 실물 비율 4족. 형광 연두 덮개 · 검은 정강이 · 무릎은 뒤로, 앞쪽 위 회색 탑재 카메라.
 *          옆면 ΔPRISM 로고 · 기체 번호, 뒤쪽 위 빨간 비상정지.
 *   wheel  휠 로봇(모베드) — 회색 직사각 몸통, 네 모서리 큰 바퀴와 은색 휠캡.
 *
 * 시안은 제자리에서 도는 걸음이었다. 지도에서는 길을 따라 앞으로 걸으므로 발을 앞뒤로 내딛게 바꿨다
 * (대각선 두 쌍이 번갈아 들고, 든 발은 앞으로 · 디딘 발은 뒤로). 앉기는 시안 그대로 — 몸이 300mm 내려앉고 무릎이 접힌다.
 * 시안의 바닥 방위 고리 · 시야 빔 · 격자는 지도에 이미 같은 구실이 있어 뺐다. 몸 · 발 그림자는 둔다.
 *
 *   var r = window.APRISM_SPOT(THREE, "spot" | "wheel");
 *   r.group             장면에 넣을 묶음. 앞(코)은 로컬 -z, 발바닥은 y 0, 몸길이 약 0.85
 *   r.update(dt, m)     m = "walk" | "idle" | "sit" | "inspect" — 걸음 · 앉기를 부드럽게 옮겨 간다
 *
 * three.js 는 부르는 쪽(map-v5.js)이 넘겨준다 — 지도와 같은 판(0.160)을 쓴다.
 */
(function () {
  "use strict";

  // 실물 사진 기준: 형광 연두 덮개와 허벅지, 검은 정강이, 회색 카메라 탑재(시안 "실물 형광")
  var S = { shell: 0xD3E40A, leg: 0x23282A, joint: 0x1B1E22, foot: 0x111214, rail: 0x15171A, metal: 0x8C929B, cam: 0xC6C9CE, camDark: 0x1A1D22, light: 0x3DFF6E, ink: "#1B2238", seam: "#15171A" };
  var FONT = '"SUIT Variable", "SUIT", "Pretendard", "Malgun Gothic", sans-serif';

  function build(THREE, kind) {
    var root = new THREE.Group();

    function roundedBox(w, h, d, r, mat) {   // 모서리가 둥근 상자
      var x = w / 2 - r, y = h / 2 - r, q = Math.min(r * 0.8, x, y), s = new THREE.Shape();
      s.moveTo(-x + q, -y); s.lineTo(x - q, -y); s.quadraticCurveTo(x, -y, x, -y + q); s.lineTo(x, y - q); s.quadraticCurveTo(x, y, x - q, y);
      s.lineTo(-x + q, y); s.quadraticCurveTo(-x, y, -x, y - q); s.lineTo(-x, -y + q); s.quadraticCurveTo(-x, -y, -x + q, -y);
      var dep = Math.max(0.001, d - 2 * r);
      var g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, steps: 1, curveSegments: 4 });
      g.translate(0, 0, -dep / 2);
      return new THREE.Mesh(g, mat);
    }
    function canvasTex(w, h, draw) {
      var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
      var t = new THREE.CanvasTexture(c);
      if ("colorSpace" in t) { t.colorSpace = THREE.SRGBColorSpace; }
      return t;
    }
    function blobTex() {
      return canvasTex(128, 128, function (g) {
        var r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
        r.addColorStop(0, "rgba(0,0,0,1)"); r.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      });
    }
    var shadowMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.6, color: 0x000000 });

    return kind === "wheel" ? wheelBot() : spot();

    /* ---------- SPOT ---------- */
    function spot() {
      var body = new THREE.Group(); root.add(body);
      var M = {}, ROUGH = { shell: 0.3, cam: 0.5, metal: 0.35 };
      ["shell", "leg", "joint", "foot", "rail", "metal", "cam", "camDark"].forEach(function (k) {
        M[k] = new THREE.MeshStandardMaterial({ color: S[k], roughness: ROUGH[k] || 0.7, metalness: k === "metal" ? 0.6 : 0.05 });
      });
      M.light = new THREE.MeshBasicMaterial({ color: S.light });

      // 몸: 도면 기준 윗판 길이 850mm, 앞뒤(엉덩이 관절 자리)는 폭 168mm로 좁고 가운데는 222mm로 넓은 허리 모양. 앞이 -z
      var BEV = 0.018, NW = 0.084, WW = 0.111, BL = 0.425, BY0 = 0.44, BY1 = 0.60;
      (function () {
        var n = NW - BEV, w = WW - BEV, l = BL - BEV;
        var P = [[-n, -l], [n, -l], [n, -0.27], [w, -0.235], [w, 0.18], [n, 0.215], [n, l], [-n, l], [-n, 0.215], [-w, 0.18], [-w, -0.235], [-n, -0.27]];
        var s = new THREE.Shape(); s.moveTo(P[0][0], -P[0][1]); P.slice(1).forEach(function (p) { s.lineTo(p[0], -p[1]); });
        var bt = 0.02, dep = BY1 - BY0 - 2 * bt;
        var g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: bt, bevelSize: BEV, bevelSegments: 4, steps: 1 });
        g.rotateX(-Math.PI / 2); g.translate(0, BY0 + bt, 0);
        body.add(new THREE.Mesh(g, M.shell));
      })();
      var SIDE = WW, TOP = BY1;
      // 윗면: 양옆 레일 두 줄, 가운데 이음선, 탑재 포트 두 개, 앞뒤 볼트 판, 뒤쪽 비상정지 버튼
      [-1, 1].forEach(function (sx) {
        var r = roundedBox(0.016, 0.01, 0.43, 0.004, M.rail); r.position.set(sx * 0.085, TOP + 0.003, -0.012); body.add(r);
        for (var i = 0; i < 6; i++) { var s = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8), M.metal); s.position.set(sx * 0.085, TOP + 0.009, -0.21 + i * 0.08); body.add(s); }
      });
      var seam = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.78), M.rail); seam.position.set(0, TOP + 0.001, 0); body.add(seam);
      [-0.276, -0.029].forEach(function (z) { var p = roundedBox(0.08, 0.006, 0.032, 0.002, M.rail); p.position.set(0, TOP + 0.001, z); body.add(p); });
      [[-0.315, 0.12], [0.29, 0.15]].forEach(function (zl) {
        var z = zl[0], len = zl[1];
        var p = roundedBox(0.15, 0.008, len, 0.003, M.shell); p.position.set(0, TOP + 0.003, z); body.add(p);
        [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { var b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12), M.rail); b.position.set(sx * 0.04, TOP + 0.008, z + sz * (len / 2 - 0.025)); body.add(b); }); });
      });
      var estop = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0xE5322D, roughness: 0.4 }));
      estop.position.set(0.05, TOP + 0.016, 0.39); body.add(estop);

      // 앞뒤 얼굴: 가운데 세로 격자, 양옆 카메라창 세 칸, 바깥 세로 홈
      var faceTex = canvasTex(260, 240, function (g) {
        var rr = function (x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
        g.fillStyle = "#0B0D10"; rr(30, 14, 200, 212, 26); g.fill();
        g.fillStyle = "#050607"; g.fillRect(100, 20, 60, 200);
        g.fillStyle = "#242A32"; for (var y = 24; y < 218; y += 6) { for (var x = 103; x < 156; x += 6) { g.fillRect(x + (y % 12 ? 3 : 0), y, 2, 2); } }
        [40, 166].forEach(function (x0) { [[24, 44], [74, 44], [124, 92]].forEach(function (yh) {
          g.fillStyle = "#1C2533"; rr(x0 + 4, yh[0], 46, yh[1], 10); g.fill(); g.strokeStyle = "#3A424E"; g.lineWidth = 3; g.stroke();
        }); });
        g.fillStyle = "#0B0D10"; rr(6, 70, 8, 90, 4); g.fill(); rr(246, 70, 8, 90, 4); g.fill();
      });
      var faceMat = new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
      var front = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.12), faceMat); front.position.set(0, 0.52, -(BL + 0.0015)); front.rotation.y = Math.PI; body.add(front);
      var rear = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.12), faceMat); rear.position.set(0, 0.52, BL + 0.0015); body.add(rear);
      [-1, 1].forEach(function (sx) { var l = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.006), M.light); l.position.set(sx * 0.045, 0.463, -(BL + 0.004)); body.add(l); });
      [-1, 1].forEach(function (sx) { var c = roundedBox(0.006, 0.07, 0.1, 0.0025, M.camDark); c.position.set(sx * (SIDE + 0.002), 0.52, -0.17); body.add(c); });

      // 옆면 표기: 위쪽 홈 줄, 로고, 기체 번호, 통풍 슬롯
      var DW = 1024, DH = 400;
      [-1, 1].forEach(function (sx) {
        var frontLeft = sx < 0, X = function (cx) { return frontLeft ? cx : DW - cx; };
        var tex = canvasTex(DW, DH, function (g) {
          g.fillStyle = S.seam; g.fillRect(0, 18, DW, 16);
          g.fillStyle = S.ink; g.textAlign = "center"; g.textBaseline = "middle";
          g.font = "800 128px " + FONT; g.fillText("ΔPRISM", X(300), 215);
          g.font = "300 96px " + FONT; g.fillText("#007", X(770), 120);
          g.font = "700 58px " + FONT; g.fillText("A-PRO  INX", X(780), 330);
          g.fillStyle = S.seam;
          for (var i = 0; i < 3; i++) { g.save(); g.translate(X(710 + i * 62), 228); g.transform(1, 0, frontLeft ? -0.4 : 0.4, 1, 0, 0); g.fillRect(-22, -14, 44, 28); g.restore(); }
        });
        var m = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.11), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }));
        m.position.set(sx * (SIDE + 0.0015), 0.52, 0.03); m.rotation.y = sx * Math.PI / 2; body.add(m);
      });

      // 탑재 카메라: 검은 받침판, 회전 목, 회색 상자, 앞면 렌즈 두 개, 옆 렌즈, 위 방열판
      var PZ = -0.315;
      var plate = roundedBox(0.17, 0.02, 0.15, 0.006, M.rail); plate.position.set(0, TOP + 0.016, PZ); body.add(plate);
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.03, 24), M.camDark); neck.position.set(0, TOP + 0.041, PZ); body.add(neck);
      var CY = TOP + 0.056 + 0.095;
      var camBox = roundedBox(0.21, 0.19, 0.2, 0.024, M.cam); camBox.position.set(0, CY, PZ); body.add(camBox);
      var camFace = roundedBox(0.165, 0.1, 0.02, 0.007, M.camDark); camFace.position.set(0, CY + 0.005, PZ - 0.098); body.add(camFace);
      var lensMat = new THREE.MeshStandardMaterial({ color: 0x2B3A55, roughness: 0.15, metalness: 0.4 });
      [-0.045, 0.045].forEach(function (x) {
        var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 24), M.camDark); ring.rotation.x = Math.PI / 2; ring.position.set(x, CY + 0.005, PZ - 0.11); body.add(ring);
        var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 24), lensMat); lens.rotation.x = Math.PI / 2; lens.position.set(x, CY + 0.005, PZ - 0.117); body.add(lens);
      });
      var sideBand = roundedBox(0.014, 0.18, 0.11, 0.005, M.camDark); sideBand.position.set(0.107, CY, PZ - 0.03); body.add(sideBand);
      var sLens = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.01, 20), lensMat); sLens.rotation.z = Math.PI / 2; sLens.position.set(0.116, CY + 0.01, PZ - 0.03); body.add(sLens);
      var sink = roundedBox(0.16, 0.018, 0.15, 0.005, M.camDark); sink.position.set(0, CY + 0.1, PZ + 0.01); body.add(sink);
      for (var fi = 0; fi < 7; fi++) { var f = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.012, 0.13), M.camDark); f.position.set(-0.06 + fi * 0.02, CY + 0.112, PZ + 0.01); body.add(f); }

      var bodyShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.05), shadowMat);
      bodyShadow.rotation.x = -Math.PI / 2; bodyShadow.position.y = 0.004; root.add(bodyShadow);

      // 다리: 허벅지는 덮개 색의 두툼한 판, 정강이는 무릎 쪽이 불룩한 검은 대, 발은 홈 세 줄 난 고무 원통
      var UP = new THREE.Vector3(0, 1, 0), A = 0.32, B = 0.34;
      function capsuleLathe(y0, y1, r0, r1) {
        var pts = [], n = 10, i, a;
        for (i = 0; i <= n; i++) { a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * r0), y0 + r0 + Math.sin(a) * r0)); }
        for (i = 0; i <= n; i++) { a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0, Math.cos(a) * r1), y1 - r1 + Math.sin(a) * r1)); }
        return new THREE.LatheGeometry(pts, 28);
      }
      var upperGeo = capsuleLathe(-A / 2 - 0.05, A / 2 + 0.035, 0.064, 0.044); upperGeo.scale(0.68, 1, 1);
      var lowerGeo = new THREE.LatheGeometry([[-0.205, 0], [-0.2, 0.026], [-0.19, 0.038], [-0.17, 0.042], [-0.12, 0.034], [0, 0.022], [0.1, 0.018], [0.15, 0.022], [0.168, 0.024], [0.172, 0]].map(function (yr) { return new THREE.Vector2(yr[1], yr[0]); }), 28);
      lowerGeo.scale(0.72, 1, 1);
      var actGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.08, 24); actGeo.rotateZ(Math.PI / 2);
      var actRingGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.012, 24); actRingGeo.rotateZ(Math.PI / 2);
      var kneeGeo = new THREE.SphereGeometry(0.042, 16, 12); kneeGeo.scale(0.8, 1, 1);
      var footGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.05, 24); footGeo.rotateZ(Math.PI / 2);
      var ribGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.005, 24); ribGeo.rotateZ(Math.PI / 2);
      var footShadowGeo = new THREE.PlaneGeometry(0.16, 0.16);
      var legs = [{ sx: -1, sz: -1, off: 0 }, { sx: 1, sz: -1, off: Math.PI }, { sx: -1, sz: 1, off: Math.PI }, { sx: 1, sz: 1, off: 0 }].map(function (l) {
        var hz = l.sz < 0 ? -0.31 : 0.28;   // 도면: 앞 관절은 앞끝에서 114mm, 뒤 관절은 뒤끝에서 146mm
        var o = { sx: l.sx, off: l.off, hip0: new THREE.Vector3(l.sx * 0.16, 0.50, hz), foot0: new THREE.Vector3(l.sx * 0.15, 0.036, hz) };
        o.hip = new THREE.Group();
        var act = new THREE.Mesh(actGeo, M.joint); act.position.x = -l.sx * 0.04; o.hip.add(act);
        var ar = new THREE.Mesh(actRingGeo, M.metal); ar.position.x = -l.sx * 0.002; o.hip.add(ar);
        o.upper = new THREE.Mesh(upperGeo, M.shell);
        var vent = roundedBox(0.006, 0.07, 0.05, 0.002, M.rail); vent.position.set(l.sx * 0.036, 0.07, 0); o.upper.add(vent);
        o.knee = new THREE.Mesh(kneeGeo, M.joint); o.lower = new THREE.Mesh(lowerGeo, M.leg);
        o.foot = new THREE.Group(); o.foot.add(new THREE.Mesh(footGeo, M.foot));
        [-0.016, 0, 0.016].forEach(function (x) { var rb = new THREE.Mesh(ribGeo, M.joint); rb.position.x = x; o.foot.add(rb); });
        o.sh = new THREE.Mesh(footShadowGeo, shadowMat); o.sh.rotation.x = -Math.PI / 2;
        [o.hip, o.upper, o.knee, o.lower, o.foot, o.sh].forEach(function (m) { root.add(m); });
        return o;
      });

      function placeSeg(mesh, a, b) {
        var d = b.clone().sub(a), len = d.length();
        mesh.position.copy(a).addScaledVector(d, 0.5);
        mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
      }
      var REAR = new THREE.Vector3(0, 0, 1);
      function kneeOf(hip, foot) {   // 두 마디 역기구학, 무릎은 뒤로
        var d = foot.clone().sub(hip), L = Math.min(d.length(), A + B - 1e-4);
        var n = d.normalize(), p = REAR.clone().sub(n.clone().multiplyScalar(n.dot(REAR))).normalize();
        var ca = (A * A + L * L - B * B) / (2 * A * L), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
        return hip.clone().addScaledVector(n, A * ca).addScaledVector(p, A * sa);
      }
      // amp 0~1 걸음 세기, sit 0 서기 ~ 1 앉기. 든 발은 앞(-z)으로, 디딘 발은 뒤로 — 앞으로 걷는다
      function pose(amp, phase, sit) {
        var bob = -0.012 * amp * Math.abs(Math.sin(phase)) - 0.30 * sit;
        body.position.y = bob;
        legs.forEach(function (l) {
          var p = phase + l.off, s = Math.sin(p);
          var lift = amp * Math.max(0, s) * 0.075;
          var stride = amp * 0.09 * Math.cos(p);
          var foot = new THREE.Vector3(l.foot0.x, l.foot0.y + lift, l.foot0.z - 0.03 * sit + stride);
          var hip = l.hip0.clone(); hip.y += bob;
          var knee = kneeOf(hip, foot);
          l.hip.position.copy(hip); l.knee.position.copy(knee); l.foot.position.copy(foot);
          placeSeg(l.upper, hip, knee); placeSeg(l.lower, knee, foot);
          l.sh.position.set(foot.x, 0.003, foot.z); var k = Math.max(0.4, 1 - lift * 7); l.sh.scale.set(k, k, 1);
        });
      }

      var st = { amp: 0, phase: 0, sit: 0 };
      pose(0, 0, 0);
      var ease = function (t) { return t * t * (3 - 2 * t); };
      return {
        group: root,
        update: function (dt, motion) {
          var sitT = motion === "sit" ? 1 : 0;
          st.sit += Math.max(-dt * 1.1, Math.min(dt * 1.1, sitT - st.sit));
          var want = motion === "walk" && st.sit < 0.02 ? 1 : 0;   // 앉아 있을 때는 다리를 들지 않는다
          st.amp += (want - st.amp) * Math.min(1, dt * 6);
          if (st.amp > 0.002) { st.phase += dt * Math.PI * 2 * 1.7; } else { st.phase = 0; }
          pose(st.amp, st.phase, ease(st.sit));
        }
      };
    }

    /* ---------- 휠 로봇(모베드) — 바퀴 지름 300mm 기준 사진 비율 추정 ---------- */
    function wheelBot() {
      var wheel = new THREE.Group(); root.add(wheel);
      var WM = {
        shell: new THREE.MeshStandardMaterial({ color: 0x5F6267, roughness: 0.35, metalness: 0.45 }),
        under: new THREE.MeshStandardMaterial({ color: 0x15171A, roughness: 0.7 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x0C0D10, roughness: 0.8 }),
        box: new THREE.MeshStandardMaterial({ color: 0x2A2D31, roughness: 0.6 }),
        cap: new THREE.MeshStandardMaterial({ color: 0xC4C7CC, roughness: 0.3, metalness: 0.6 }),
        lens: new THREE.MeshStandardMaterial({ color: 0x2B3A55, roughness: 0.15, metalness: 0.4 }),
        red: new THREE.MeshStandardMaterial({ color: 0xE5322D, roughness: 0.4 })
      };
      var shell = roundedBox(0.68, 0.075, 0.31, 0.012, WM.shell); shell.position.y = 0.245; wheel.add(shell);
      var under = roundedBox(0.56, 0.09, 0.27, 0.02, WM.under); under.position.y = 0.165; wheel.add(under);
      var WT = 0.2825;
      [-1, 1].forEach(function (sz) { var s = roundedBox(0.40, 0.004, 0.012, 0.0015, WM.dark); s.position.set(0, WT + 0.001, sz * 0.115); wheel.add(s); });
      var decalMat = function (tex) { return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }); };
      var flat = function (w, h, tex, x, z, ry) { var g = new THREE.PlaneGeometry(w, h); g.rotateX(-Math.PI / 2); var m = new THREE.Mesh(g, decalMat(tex)); m.position.set(x, WT + 0.0012, z); m.rotation.y = ry; wheel.add(m); };
      flat(0.31, 0.09, canvasTex(620, 180, function (g, w, h) {
        g.fillStyle = "#0B0C0E"; g.beginPath(); if (g.roundRect) { g.roundRect(0, 0, w, h, 18); } else { g.rect(0, 0, w, h); } g.fill();
        g.fillStyle = "#F2C200"; g.beginPath(); g.moveTo(40, 52); g.lineTo(50, 34); g.lineTo(60, 52); g.closePath(); g.fill();
        g.fillStyle = "#FFFFFF"; g.textBaseline = "middle"; g.font = "600 20px " + FONT; g.fillText("CAUTION", 70, 44);
        g.font = "500 84px " + FONT; g.textAlign = "center"; g.fillText("NO RIDING", w / 2, 116);
      }), -0.043, 0, Math.PI);
      flat(0.11, 0.024, canvasTex(440, 96, function (g, w, h) { g.fillStyle = "#3A3D42"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "300 64px " + FONT; g.fillText("APRISM", w / 2, h / 2); }), -0.315, 0, Math.PI / 2);
      var oval = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 24), WM.dark); oval.scale.set(1, 1, 2.1); oval.position.set(0.213, WT + 0.001, 0); wheel.add(oval);
      var port = roundedBox(0.045, 0.004, 0.1, 0.0015, WM.dark); port.position.set(0.29, WT + 0.001, 0); wheel.add(port);
      var portIn = roundedBox(0.02, 0.003, 0.03, 0.001, WM.box); portIn.position.set(0.29, WT + 0.003, -0.02); wheel.add(portIn);
      // 앞 끝(+x) 빨간 비상정지 · 은색 손잡이 · 분홍 표시등 · 견인 고리 · 카메라 막대
      var ws = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.022, 20), WM.red); ws.rotation.z = Math.PI / 2; ws.position.set(0.352, 0.24, -0.04); wheel.add(ws);
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 16), WM.cap); knob.rotation.z = Math.PI / 2; knob.position.set(0.355, 0.255, 0.01); wheel.add(knob);
      var led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.012), new THREE.MeshBasicMaterial({ color: 0xFF4D6D })); led.position.set(0.3425, 0.24, -0.12); wheel.add(led);
      var hook = roundedBox(0.012, 0.045, 0.05, 0.004, WM.cap); hook.position.set(0.29, 0.125, -0.1); hook.rotation.z = -0.5; wheel.add(hook);
      var camBar = roundedBox(0.02, 0.024, 0.13, 0.006, WM.dark); camBar.position.set(0.288, 0.19, 0); wheel.add(camBar);
      [-0.03, 0.03].forEach(function (z) { var l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), WM.lens); l.rotation.z = Math.PI / 2; l.position.set(0.299, 0.19, z); wheel.add(l); });
      [-1, 1].forEach(function (sz) { var sBox = roundedBox(0.09, 0.055, 0.04, 0.008, WM.box); sBox.position.set(0, 0.145, sz * 0.14); wheel.add(sBox); });

      // 바퀴 모듈: 검은 조향 기둥 + 바퀴(타이어 홈, 은색 휠캡과 눈금 8개). 바퀴 축은 z
      var WRAD = 0.15, WWID = 0.1;
      var treadTex = canvasTex(512, 64, function (g, w) {
        g.fillStyle = "#121314"; g.fillRect(0, 0, w, 64); g.fillStyle = "#262729";
        for (var i = 0; i < 48; i++) { var x = i * (w / 48); g.fillRect(x + 2, 6 + (i % 2) * 6, w / 48 - 5, 20); g.fillRect(x + 2, 38 - (i % 2) * 6, w / 48 - 5, 20); }
      });
      treadTex.wrapS = THREE.RepeatWrapping;
      var tireGeo = new THREE.LatheGeometry([[0.11, -WWID / 2], [0.14, -WWID / 2], [WRAD, -0.035], [WRAD + 0.002, 0], [WRAD, 0.035], [0.14, WWID / 2], [0.11, WWID / 2]].map(function (ry) { return new THREE.Vector2(ry[0], ry[1]); }), 48);
      tireGeo.rotateX(Math.PI / 2);
      var tireMat = new THREE.MeshStandardMaterial({ map: treadTex, roughness: 0.9 });
      var hubGeo = new THREE.CylinderGeometry(0.11, 0.11, WWID - 0.01, 32); hubGeo.rotateX(Math.PI / 2);
      var capGeo = new THREE.CylinderGeometry(0.112, 0.112, 0.01, 40); capGeo.rotateX(Math.PI / 2);
      var dashGeo = new THREE.BoxGeometry(0.006, 0.022, 0.004);
      var colGeo = new THREE.BoxGeometry(0.06, 0.11, 0.05);
      var axleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 16); axleGeo.rotateX(Math.PI / 2);
      var spins = [];
      [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) {
        var g = new THREE.Group(); g.position.set(sx * 0.36, WRAD, sz * 0.24); wheel.add(g);
        var spin = new THREE.Group(); g.add(spin);
        spin.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(hubGeo, WM.under));
        var cap = new THREE.Mesh(capGeo, WM.cap); cap.position.z = sz * 0.048; spin.add(cap);
        for (var k = 0; k < 8; k++) {
          var a = k * Math.PI / 4, d = new THREE.Mesh(dashGeo, WM.dark);
          d.position.set(Math.cos(a) * 0.082, Math.sin(a) * 0.082, sz * 0.054); d.rotation.z = a - Math.PI / 2; spin.add(d);
        }
        var col = new THREE.Mesh(colGeo, WM.under); col.position.set(0, 0.075, -sz * 0.08); g.add(col);
        var ax = new THREE.Mesh(axleGeo, WM.under); ax.position.z = -sz * 0.05; g.add(ax);
        spins.push(spin);
      }); });
      var wShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.68), shadowMat); wShadow.rotation.x = -Math.PI / 2; wShadow.position.y = 0.004; wheel.add(wShadow);
      wheel.rotation.y = Math.PI / 2;   // 긴 축을 진행 방향에 맞춤: +x 끝이 앞(-z)

      var speed = 0;
      return {
        group: root,
        // 걸을 때(이동)만 바퀴가 앞으로 구른다 — 서면 천천히 멈춘다. 휠 로봇은 앉기가 없다
        update: function (dt, motion) {
          speed += ((motion === "walk" ? 1 : 0) - speed) * Math.min(1, dt * 4);
          spins.forEach(function (s) { s.rotation.z -= speed * dt * 0.5 / WRAD; });
        }
      };
    }
  }

  window.APRISM_SPOT = build;
})();
