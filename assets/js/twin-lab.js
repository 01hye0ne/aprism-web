// 디지털 트윈 모듈 실험(screens/lab-twin-v6.html, 11/02) — 지하 4층 설비 덩이 하나를 현장 기계실 모듈로 바꿔 본다.
//
// 좌표는 관제 지도(map-v6.js)와 같다 — 모델 가장 긴 변을 120 으로 키우고, 도면 좌표(m) X = x − min.x, Y = max.z − z.
// 바꾼 덩이: 도면 X 38.6 · Y 45.5 · 13.6 × 23.1 m(APRISM_ROUTE.lanesAll 로 뽑은 B4 설비 목록 — WP-08 옆 큰 덩이).
//
// 모듈 = 받침 + 몇 가지 덩어리(로우폴리 · 단색 · 질감 없음) — 레퍼런스(Siemens Bifrost)처럼 "무엇인지"만 알 만큼.
//   보일러 묶음(벽걸이 3대 · 받침대 · 연통) · 제어반 · 세로형 부스터 펌프 · 팽창(압력) 탱크 · 가로형 소화 펌프 · 판넬 저수조 · 색 배관(계통)
// 배관 색은 현장 그대로 계통을 말한다 — 소화 빨강 · 급수 파랑 · 가스 노랑 · 배기 은색. 다크 화면이라 채도를 한 단 낮췄다.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a10);
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;

scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1f29, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- 재질 ----------
const M = {};
function mat(key, color, o) { return (M[key] = M[key] || new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, o || {}))); }
const C = {
  pad: 0x2c4a63, padTop: 0x35597a, white: 0xe9ecf1, beige: 0xcfc6ad, dark: 0x1a1f29, screen: 0x0f2a33, steel: 0xaeb6c2,
  fire: 0xd9473f, supply: 0x3a63b8, gas: 0xe0b52a, green: 0x2f9a6e, motor: 0x3f5f9e, rack: 0x20242c, tankWall: 0x8b95a4, band: 0xd7dce3
};

// ---------- 형태 도우미 ----------
function box(w, h, d, c, x, y, z, key) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(key || ("c" + c), c)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m; }
function cyl(r, h, c, x, y, z, seg, key) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 20), mat(key || ("c" + c), c)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m; }
// 배관 — 꺾인 점들을 원기둥으로 잇고 꺾임마다 공, 일정 간격으로 밴드(보온재 고정띠)
function pipe(pts, r, c, bands) {
  const g = new THREE.Group(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 1; i < pts.length; i += 1) {
    const a = new THREE.Vector3(...pts[i - 1]), b = new THREE.Vector3(...pts[i]), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat("c" + c, c));
    m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); m.castShadow = true; g.add(m);
    if (bands !== false) {
      for (let s = 0.6; s < len - 0.3; s += 1.4) {
        const bd = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.06, 14), mat("band", C.band));
        bd.position.copy(a).lerp(b, s / len); bd.quaternion.copy(m.quaternion); g.add(bd);
      }
    }
    if (i < pts.length - 1) { const k = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 14, 10), mat("c" + c, c)); k.position.copy(b); g.add(k); }
  }
  return g;
}
function valve(x, y, z, c, rotY) {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.22, c, 0, -0.11, 0, 12));
  const stem = cyl(0.025, 0.28, C.steel, 0, 0.1, 0, 8); g.add(stem);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16), mat("dark", C.dark)); wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.4; g.add(wheel);
  g.position.set(x, y, z); g.rotation.y = rotY || 0; return g;
}
function pad(w, d, x, z, h) { const g = new THREE.Group(); g.add(box(w, h || 0.15, d, C.pad, x, 0, z, "pad")); const t = box(w - 0.06, 0.01, d - 0.06, C.padTop, x, (h || 0.15), z, "padTop"); t.castShadow = false; g.add(t); return g; }

// ---------- 모듈 ----------
// 각 모듈은 Group, userData = { name, kind, info: [[이름, 값]...], warn }
function moduleOf(name, kind, info, warn) { const g = new THREE.Group(); g.userData = { name, kind, info, warn: !!warn }; return g; }

function boilerBank(n) {
  const g = moduleOf("보일러 B-1 ~ B-" + n, "열원 · 벽걸이 보일러", [["대수", n + "대"], ["연료", "도시가스"], ["상태", "운전 중"]]);
  const W = 0.62, gap = 0.28, L = n * W + (n - 1) * gap;
  g.add(box(L + 0.4, 0.08, 0.5, C.rack, 0, 0.15, 0, "rack"));                      // 바닥 받침
  [-L / 2 - 0.1, L / 2 + 0.1].forEach(x => g.add(box(0.08, 1.9, 0.08, C.rack, x, 0.15, -0.15, "rack")));   // 세움대
  g.add(box(L + 0.3, 0.06, 0.08, C.rack, 0, 1.95, -0.15, "rack"));
  for (let i = 0; i < n; i += 1) {
    const x = -L / 2 + W / 2 + i * (W + gap);
    g.add(box(W, 0.82, 0.32, C.white, x, 1.0, 0, "white"));
    const disp = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), mat("dark", C.dark)); disp.position.set(x, 1.2, 0.161); g.add(disp);
    g.add(box(0.12, 0.08, 0.005, 0xe5b93a, x - 0.12, 1.5, 0.16, "label"));        // 노란 경고 딱지
    g.add(pipe([[x, 1.82, 0], [x, 3.1, 0], [x, 3.1, -0.8]], 0.07, C.steel, false)); // 배기 연통
    g.add(pipe([[x - 0.12, 1.0, 0.05], [x - 0.12, 0.55, 0.05], [x - 0.12, 0.55, 0.45]], 0.045, C.gas));   // 가스
    g.add(pipe([[x + 0.12, 1.0, 0.05], [x + 0.12, 0.4, 0.05], [x + 0.12, 0.4, 0.55]], 0.05, C.supply));  // 급수
  }
  g.add(pipe([[-L / 2 - 0.6, 0.55, 0.45], [L / 2 + 0.8, 0.55, 0.45]], 0.06, C.gas));
  g.add(pipe([[-L / 2 - 0.6, 0.4, 0.55], [L / 2 + 0.8, 0.4, 0.55]], 0.07, C.supply));
  g.add(pipe([[-L / 2 - 0.4, 3.1, -0.8], [L / 2 + 0.4, 3.1, -0.8]], 0.12, C.steel, false)); // 연통 헤더
  const panel = box(0.42, 0.55, 0.18, C.beige, -L / 2 - 0.55, 1.3, 0, "beige"); g.add(panel);   // 콘트롤 판넬
  return g;
}
function controlPanel() {
  const g = moduleOf("부스터 펌프 제어반", "제어 · 인버터 제어반", [["화면", "터치 HMI"], ["제어", "부스터 펌프 BP-1 ~ 2"], ["상태", "자동 운전"]]);
  g.add(box(0.85, 0.12, 0.55, C.dark, 0, 0, 0, "dark"));
  g.add(box(0.8, 1.9, 0.5, C.beige, 0, 0.12, 0, "beige"));
  g.add(box(0.36, 0.26, 0.01, C.screen, 0, 1.55, 0.255, "screen"));
  g.add(box(0.44, 0.34, 0.006, C.green, 0, 1.51, 0.252, "greenTrim"));
  g.add(box(0.26, 0.16, 0.008, 0x8d8673, 0, 0.35, 0.255, "vent"));
  g.add(cyl(0.04, 0.03, C.dark, 0, 1.05, 0.25, 12));
  return g;
}
function boosterPump(i, warn) {
  const g = moduleOf("부스터 펌프 BP-" + i, "급수 · 세로형 다단 펌프", warn ? [["상태", "운전 중"], ["진동", "4.8 mm/s (주의 4.5)"], ["최근 측정", "10:13 · Robot 01"]] : [["상태", "대기"], ["진동", "1.2 mm/s"], ["최근 측정", "10:13 · Robot 01"]], warn);
  g.add(box(0.55, 0.08, 0.55, C.rack, 0, 0.15, 0, "rack"));
  g.add(cyl(0.11, 0.75, C.steel, 0, 0.23, 0, 16));
  g.add(cyl(0.17, 0.12, C.green, 0, 0.95, 0, 16));
  g.add(cyl(0.16, 0.55, C.green, 0, 1.07, 0, 16));
  g.add(box(0.12, 0.14, 0.12, C.green, 0.19, 1.3, 0, "c" + C.green));
  g.add(pipe([[-0.6, 0.4, 0], [-0.1, 0.4, 0]], 0.07, C.supply));
  g.add(pipe([[0.1, 0.55, 0], [0.6, 0.55, 0]], 0.07, C.supply));
  return g;
}
function pressureTank() {
  const g = moduleOf("팽창 탱크 ET-1", "급수 · 압력 탱크", [["용량", "500 L"], ["압력", "0.42 MPa"], ["상태", "정상"]]);
  [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].forEach(p => g.add(cyl(0.035, 0.45, C.fire, p[0], 0.15, p[1], 8)));
  g.add(cyl(0.55, 1.1, C.fire, 0, 0.6, 0, 24));
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("c" + C.fire, C.fire)); top.position.y = 1.7; top.castShadow = true; g.add(top);
  const bot = top.clone(); bot.rotation.x = Math.PI; bot.position.y = 0.6; g.add(bot);
  g.add(cyl(0.2, 0.08, C.steel, 0, 2.2, 0, 16));
  return g;
}
function firePump(i) {
  const g = moduleOf("소화 펌프 FP-" + i, "소화 · 가로형 펌프 + 모터", [["구분", i === 1 ? "주 펌프" : "예비 펌프"], ["상태", "대기"], ["최근 점검", "10/23 09:00"]]);
  g.add(box(2.1, 0.12, 0.7, C.rack, 0, 0.15, 0, "rack"));
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.8, 18), mat("motor", C.motor)); motor.rotation.z = Math.PI / 2; motor.position.set(0.55, 0.6, 0); motor.castShadow = true; g.add(motor);
  g.add(box(0.2, 0.2, 0.3, C.motor, 0.55, 0.86, 0, "motor"));
  const cpl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 12), mat("c" + C.steel, C.steel)); cpl.rotation.z = Math.PI / 2; cpl.position.set(0.05, 0.6, 0); g.add(cpl);
  const casing = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), mat("c" + C.fire, C.fire)); casing.scale.set(1, 1, 0.75); casing.position.set(-0.4, 0.6, 0); casing.castShadow = true; g.add(casing);
  g.add(pipe([[-0.4, 0.6, 0], [-0.9, 0.6, 0], [-0.9, 3.4, 0]], 0.13, C.fire));
  g.add(valve(-0.9, 1.5, 0, C.fire));
  return g;
}
function waterTank(w, h, d) {
  const g = moduleOf("판넬 저수조 WT-1", "급수 · 저수조", [["크기", w + " × " + d + " × " + h + " m"], ["수위", "78%"], ["상태", "정상"]]);
  g.add(box(w, 0.3, d, C.pad, 0, 0, 0, "pad"));
  g.add(box(w, h, d, C.tankWall, 0, 0.3, 0, "tankWall"));
  const lm = mat("tankLine", 0x6d7684);
  for (let x = -w / 2 + 1; x < w / 2; x += 1) { [d / 2 + 0.005, -d / 2 - 0.005].forEach(z => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.01), lm); l.position.set(x, 0.3 + h / 2, z); g.add(l); }); }
  for (let y = 1; y < h; y += 1) { [d / 2 + 0.005, -d / 2 - 0.005].forEach(z => { const l = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.01), lm); l.position.set(0, 0.3 + y, z); g.add(l); }); }
  return g;
}

// ---------- 모델 ----------
let floorGroup = null, target = null, zone = null, modules = [], wallTop = 4;
function kindOf(o) { let n = o; while (n) { const s = String(n.name || "").toLowerCase().replace(/^[0-9]+[_\-\s]*/, "").split(/[\s\-–_]/)[0]; if (["floor", "wall", "equipment", "stairs"].includes(s)) { return s; } n = n.parent; } return "other"; }
const SKIN = { floor: 0x1b2230, wall: 0x56637a, equipment: 0x46536b, stairs: 0x56637a, other: 0x46536b };

new GLTFLoader().parse(Uint8Array.from(atob(window.APRISM_MAP_GLB), c => c.charCodeAt(0)).buffer, "", gltf => {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(root), size = all.getSize(new THREE.Vector3()), center = all.getCenter(new THREE.Vector3());
  const unit = 120 / Math.max(size.x, size.y, size.z);
  const place = new THREE.Matrix4().makeScale(unit, unit, unit).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const mb = all.clone().applyMatrix4(place);                         // 관제 지도의 modelBox
  const toWorld = (X, Y) => new THREE.Vector3(mb.min.x + X, 0, mb.max.z - Y);
  const b4 = root.children.find(c => /지하[\s_]*4[\s_]*층/.test(c.name));
  floorGroup = new THREE.Group(); scene.add(floorGroup);
  // 바꿀 덩이의 도면 범위
  const T = { X: 38.6, Y: 45.5, W: 13.6, H: 23.1 };
  const tMin = toWorld(T.X, T.Y + T.H), tMax = toWorld(T.X + T.W, T.Y);
  const tBox = new THREE.Box3(new THREE.Vector3(tMin.x - 0.6, -1e4, tMin.z - 0.6), new THREE.Vector3(tMax.x + 0.6, 1e4, tMax.z + 0.6));
  let deck = Infinity;
  const targets = [];
  b4.traverse(o => {
    if (!o.isMesh) { return; }
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.applyMatrix4(place); g.computeBoundingBox();
    const k = kindOf(o);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: SKIN[k], roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    m.castShadow = k !== "floor"; m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: 0xc7d2e4, transparent: true, opacity: k === "floor" ? 0.15 : 0.35 })));
    floorGroup.add(m);
    if (k === "floor") { deck = Math.min(deck, g.boundingBox.max.y); }
    if (k === "wall") { wallTop = Math.max(0, g.boundingBox.max.y); }
    // 바꿀 덩이 — 모델에서 덩이 하나는 면 · 모서리 조각 26개(mesh_223 · mesh_223_1 …)라, 바닥 중심이 목표 칸 안에 드는 설비 조각을 모두 모은다
    if (k === "equipment") {
      const c2 = g.boundingBox.getCenter(new THREE.Vector3());
      if (tBox.containsPoint(new THREE.Vector3(c2.x, 0, c2.z))) { targets.push(m); }
    }
  });
  if (!isFinite(deck)) { deck = 0; }
  const room = { x0: Math.min(tMin.x, tMax.x), x1: Math.max(tMin.x, tMax.x), z0: Math.min(tMin.z, tMax.z), z1: Math.max(tMin.z, tMax.z), y: deck };
  if (targets.length) { const u = new THREE.Box3(); targets.forEach(t => u.union(t.geometry.boundingBox)); room.x0 = u.min.x; room.x1 = u.max.x; room.z0 = u.min.z; room.z1 = u.max.z; target = targets; }
  const ceil = Math.min(4.2, Math.max(3.2, wallTop - deck));
  buildRoom(room, ceil);
  frame("room", true);
  document.getElementById("loading").remove();
});

function buildRoom(r, ceil) {
  zone = new THREE.Group(); zone.position.set((r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2); scene.add(zone);
  const W = r.x1 - r.x0, D = r.z1 - r.z0;          // 짧은 변 W(x) · 긴 변 D(z)
  const long = D >= W;
  // 긴 변이 z 가 되게 놓는다(아니면 통째로 돌린다)
  const holder = new THREE.Group(); zone.add(holder);
  if (!long) { holder.rotation.y = Math.PI / 2; }
  const w = Math.min(W, D), d = Math.max(W, D);
  holder.add(pad(w - 0.4, d - 0.4, 0, 0, 0.12));    // 기계실 바닥(현장 하늘색 에폭시 → 다크 청회색)
  // 판넬 저수조 — 안쪽 끝
  const tank = waterTank(Math.min(6, w - 2), 3, 3); tank.position.set(0, 0.12, -d / 2 + 2.2); add(tank, holder);
  // 보일러 묶음 — 한쪽 벽
  const bb = boilerBank(3); bb.position.set(-w / 2 + 1.1, 0.12, -d / 2 + 6.5); bb.rotation.y = Math.PI / 2; add(bb, holder);
  const bb2 = boilerBank(3); bb2.position.set(-w / 2 + 1.1, 0.12, -d / 2 + 10.5); bb2.rotation.y = Math.PI / 2; add(bb2, holder);
  // 제어반 — 통로 가운데
  const cp = controlPanel(); cp.position.set(-1.4, 0.12, -d / 2 + 13.6); add(cp, holder);
  // 부스터 펌프 2대 + 팽창 탱크 — 오른쪽 받침 위
  holder.add(pad(3.4, 2.2, w / 2 - 2.0, -d / 2 + 13.5, 0.3));
  const p1 = boosterPump(1, false); p1.position.set(w / 2 - 3.0, 0.42, -d / 2 + 13.0); add(p1, holder);
  const p2 = boosterPump(2, true); p2.position.set(w / 2 - 3.0, 0.42, -d / 2 + 14.0); add(p2, holder);
  const et = pressureTank(); et.position.set(w / 2 - 1.2, 0.42, -d / 2 + 13.5); add(et, holder);
  // 소화 펌프 2대 — 반대쪽 끝
  holder.add(pad(w - 1.6, 3.6, 0, d / 2 - 3.2, 0.3));
  const f1 = firePump(1); f1.position.set(-1.6, 0.42, d / 2 - 4.0); add(f1, holder);
  const f2 = firePump(2); f2.position.set(1.6, 0.42, d / 2 - 4.0); add(f2, holder);
  // 계통 배관 — 천장 아래로 지나간다(소화 빨강 · 급수 파랑 · 가스 노랑)
  const yc = ceil - 0.4;
  holder.add(pipe([[-2.5, 3.4, d / 2 - 4.0], [-2.5, yc, d / 2 - 4.0], [-2.5, yc, -d / 2 + 4.0]], 0.15, C.fire));
  holder.add(pipe([[0.7, 3.4, d / 2 - 4.0], [0.7, yc - 0.1, d / 2 - 4.0], [0.7, yc - 0.1, -d / 2 + 4.0]], 0.15, C.fire));
  holder.add(pipe([[w / 2 - 3.6, 0.7, -d / 2 + 13.5], [w / 2 - 3.6, yc - 0.5, -d / 2 + 13.5], [w / 2 - 3.6, yc - 0.5, -d / 2 + 3.7]], 0.12, C.supply));
  holder.add(pipe([[-w / 2 + 1.7, 0.67, -d / 2 + 4.5], [-w / 2 + 1.7, 0.67, -d / 2 + 11.8], [w / 2 - 3.6, 0.67, -d / 2 + 11.8]], 0.09, C.gas));
  holder.add(pipe([[-w / 2 + 1.75, 0.52, -d / 2 + 3.9], [0, 0.52, -d / 2 + 3.9]], 0.1, C.supply));
  [-d / 2 + 6, -d / 2 + 10, d / 2 - 7].forEach(z => holder.add(valve(-2.5, yc - 0.9, z, C.fire)));
  // 천장 행거 기둥 몇 개
  [[-2.5, -d / 2 + 7], [0.7, -d / 2 + 7], [-2.5, d / 2 - 8], [0.7, d / 2 - 8]].forEach(p => holder.add(box(0.06, yc - 0.15, 0.06, C.steel, p[0], 0.12, p[1] + 0.3, "c" + C.steel)));
}
function add(g, parent) { parent.add(g); modules.push(g); }

// ---------- 보기 ----------
function frame(v, now) {
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  const showRoom = v !== "before";
  if (zone) { zone.visible = showRoom; }
  if (target) { target.forEach(t => { t.visible = !showRoom; }); }
  const fb = new THREE.Box3().setFromObject(floorGroup), c = fb.getCenter(new THREE.Vector3());
  let tgt, dist;
  if (v === "floor") { tgt = c; dist = fb.getSize(new THREE.Vector3()).length() * 1.35; }
  else { const zb = new THREE.Box3().setFromObject(zone || floorGroup); tgt = zb.getCenter(new THREE.Vector3()); tgt.y = (zone ? zone.position.y : 0) + 1; dist = zb.getSize(new THREE.Vector3()).length() * 1.25; }
  const dir = new THREE.Vector3(1, 0.95, 1).normalize();
  controls.target.copy(tgt); camera.position.copy(tgt).addScaledVector(dir, dist);
  sun.position.copy(tgt).add(new THREE.Vector3(-30, 60, 20)); sun.target.position.copy(tgt);
  const s = Math.max(30, dist * 0.6); Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 200 }); sun.shadow.camera.updateProjectionMatrix();
  controls.update();
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => frame(b.dataset.view)));

// ---------- 고르기 · 카드 · 경고 핀 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), card = document.getElementById("card");
let hot = null, picked = null;
function modOf(o) { while (o && !modules.includes(o)) { o = o.parent; } return o; }
function tint(g, on) { g.traverse(o => { if (o.isMesh) { if (!o.userData.base) { o.material = o.material.clone(); o.userData.base = o.material.emissive.getHex(); } o.material.emissive.setHex(on ? 0x2a4a7a : o.userData.base); } }); }
function showCard(g, x, y) {
  card.querySelector("[data-k]").textContent = g.userData.kind;
  card.querySelector("[data-n]").textContent = g.userData.name;
  card.querySelector("[data-d]").innerHTML = g.userData.info.map(([k, v]) => `<dt>${k}</dt><dd class="${/주의/.test(v) ? "warn" : ""}">${v}</dd>`).join("");
  card.style.left = Math.min(innerWidth - 300, x + 16) + "px"; card.style.top = Math.min(innerHeight - 160, y + 16) + "px";
  card.classList.add("on");
}
function pick(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(modules, true)[0];
  return h ? modOf(h.object) : null;
}
renderer.domElement.addEventListener("pointermove", e => {
  if (picked) { return; }
  const g = pick(e);
  if (g !== hot) { if (hot) { tint(hot, false); } hot = g; if (hot) { tint(hot, true); } }
  if (hot) { showCard(hot, e.clientX, e.clientY); renderer.domElement.style.cursor = "pointer"; } else { card.classList.remove("on"); renderer.domElement.style.cursor = ""; }
});
renderer.domElement.addEventListener("click", e => {
  const g = pick(e);
  if (picked) { tint(picked, false); picked = null; }
  if (g) { picked = g; tint(g, true); showCard(g, e.clientX, e.clientY); } else { card.classList.remove("on"); }
});
// 주의 모듈 위 노란 세모(관제 지도 · 안전진단과 같은 기호) — HTML 로 띄운다
const pins = [];
function syncPins() {
  modules.filter(m => m.userData.warn).forEach((m, i) => {
    if (!pins[i]) { const p = document.createElement("div"); p.className = "pin"; p.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#ffcc00" stroke="#070a10" stroke-width="1.2" d="M11.13 3.5c.39-.67 1.35-.67 1.74 0l9.26 16c.39.67-.1 1.5-.87 1.5H2.73c-.77 0-1.25-.83-.87-1.5l9.27-16Z"/><path fill="#070a10" d="M11 10h2v4h-2zM11 16h2v2h-2z"/></svg>'; document.body.appendChild(p); pins[i] = p; }
    const b = new THREE.Box3().setFromObject(m), top = b.getCenter(new THREE.Vector3()); top.y = b.max.y + 0.3;
    const q = top.project(camera);
    pins[i].style.display = zone && zone.visible && q.z < 1 ? "" : "none";
    pins[i].style.left = ((q.x + 1) / 2 * innerWidth) + "px"; pins[i].style.top = ((1 - q.y) / 2 * innerHeight) + "px";
  });
}

function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); if (modules.length) { syncPins(); } });
