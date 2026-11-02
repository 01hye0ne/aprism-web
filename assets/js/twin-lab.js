// 디지털 트윈 모듈 실험 2차(screens/lab-twin-v6.html, 11/02) — 지하 4층 설비 덩이 하나를 기계실 모듈로 바꿔 본다.
//
// 1차는 현장 사진을 그대로 옮겨 "AI 티"가 났다(디자이너). 레퍼런스(Siemens Bifrost)에서 읽은 규칙으로 다시 짰다:
//   1 덜어내기    모듈마다 알아볼 거리 3개 이하. 나머지는 매끈한 덩어리. 같은 정밀도의 반복(배관 밴드 · 행거 · 밸브 줄)은 뺐다
//   2 색 절제     무채색 두 단(흰 · 옅은 회색) + 어두운 점(화면) 하나. 계통 색은 알림이 난 배관만 켠다
//   3 모서리 · 빛 모든 상자에 작은 베벨(RoundedBoxGeometry), AO(GTAO)로 맞닿은 곳 그늘, 그림자는 하늘빛이 채워 검지 않게
//   4 과장 · 여백  실제 치수 대신 1.8배 · 모듈마다 받침 타일 하나, 타일 사이를 비운다
//   5 선 없음     모듈에는 윤곽선을 긋지 않는다(빛과 그늘로 읽힌다). 주변 층 판의 선도 옅게
//
// 좌표는 관제 지도(map-v6.js)와 같다 — 모델 가장 긴 변 120, 도면 X = x − min.x, Y = max.z − z.
// 바꾼 덩이: 도면 X 38.6 · Y 45.5 · 13.6 × 23.1 m(WP-08 옆 큰 덩이, 면 · 모서리 조각 26개).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1018);
const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;

// 빛 — 하늘(푸른 회색)이 그늘을 채워 그림자가 검지 않다. 해는 한 방향, 부드럽게
scene.add(new THREE.HemisphereLight(0xdde6f3, 0x4a5870, 1.25));
const sun = new THREE.DirectionalLight(0xfff6ec, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 6; sun.shadow.blurSamples = 16; sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

// 후처리 — AO(맞닿은 곳 그늘)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, 1, 1);
ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 16 });
ao.blendIntensity = 0.85;
composer.addPass(ao);
composer.addPass(new OutputPass());

// ---------- 팔레트 — 무채색 두 단 + 어두운 점 + (알림 계통만) 상태색 ----------
const P = { white: 0xeef1f5, light: 0xc9d0da, mid: 0x9aa4b3, dark: 0x2e3440, tile: 0xdfe4eb, base: 0x8d97a7, warn: 0xffcc00 };   // 바닥은 한 단 어둡게 — 타일 · 덩어리가 바닥에서 떠 보이게
const MATS = {};
function mat(c, rough) { const k = c + "|" + (rough || 0.82); return (MATS[k] = MATS[k] || new THREE.MeshStandardMaterial({ color: c, roughness: rough || 0.82, metalness: 0 })); }
function shade(m) { m.castShadow = m.receiveShadow = true; return m; }
// 베벨 상자 — 바닥(y)에서 세운다
function rbox(w, h, d, c, x, y, z, r) { const m = shade(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r == null ? Math.min(w, h, d) * 0.12 : r), mat(c))); m.position.set(x, y + h / 2, z); return m; }
function rcyl(rad, h, c, x, y, z) { const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h, 32, 1), mat(c))); m.position.set(x, y + h / 2, z); return m; }
function cap(rad, len, c, x, y, z) { const m = shade(new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 8, 32), mat(c))); m.position.set(x, y + len / 2 + rad, z); return m; }
// 굵은 관 한 줄(계통당 하나) — 꺾임은 둥글게(공), 밴드 없음
function pipe(pts, r, c) {
  const g = new THREE.Group(), up = new THREE.Vector3(0, 1, 0), M = mat(c, 0.6);
  for (let i = 1; i < pts.length; i += 1) {
    const a = new THREE.Vector3(...pts[i - 1]), b = new THREE.Vector3(...pts[i]);
    const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 24), M));
    m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); g.add(m);
    if (i < pts.length - 1) { const k = shade(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), M)); k.position.copy(b); g.add(k); }
  }
  return g;
}
// 받침 타일 — 모듈 하나에 하나, 살짝 두껍게 · 둥근 모서리
function tile(w, d) { return rbox(w, 0.28, d, P.tile, 0, 0, 0, 0.12); }

// ---------- 모듈(과장 1.8배 · 알아볼 거리 3개 이하) ----------
const S = 1.8, Y0 = 0.28;   // Y0 = 타일 윗면
function mod(name, kind, info, warn) { const g = new THREE.Group(); g.userData = { name, kind, info, warn: !!warn }; return g; }
function boilerBank() {
  const g = mod("보일러 B-1 ~ B-3", "열원 · 벽걸이 보일러", [["대수", "3대"], ["연료", "도시가스"], ["상태", "운전 중"]]);
  g.add(tile(4.6, 2.6));
  g.add(rbox(4.0, 0.18 * S, 0.5, P.mid, 0, Y0, -0.7));                       // 받침 레일
  for (let i = 0; i < 3; i += 1) {
    const x = -1.3 + i * 1.3;
    g.add(rbox(0.62 * S, 0.84 * S, 0.34 * S, P.white, x, Y0 + 0.32, -0.7));   // ① 흰 몸통
    const d = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), mat(P.dark, 0.4))); d.rotation.x = Math.PI / 2; d.position.set(x, Y0 + 1.25, -0.7 + 0.31); g.add(d);   // ② 둥근 화면
    g.add(rcyl(0.09, 0.9, P.light, x, Y0 + 0.32 + 0.84 * S, -0.7));          // ③ 연통(짧게)
  }
  return g;
}
function controlPanel() {
  const g = mod("부스터 펌프 제어반", "제어 · 인버터 제어반", [["화면", "터치 HMI"], ["제어", "부스터 펌프 BP-1 ~ 2"], ["상태", "자동 운전"]]);
  g.add(tile(2.0, 1.8));
  g.add(rbox(0.8 * S, 1.9 * S * 0.8, 0.5 * S, P.white, 0, Y0, 0));           // ① 함
  g.add(rbox(0.5, 0.36, 0.04, P.dark, 0, Y0 + 2.05, 0.46, 0.03));            // ② 화면
  g.add(rbox(0.42, 0.26, 0.03, P.light, 0, Y0 + 0.45, 0.46, 0.03));          // ③ 통풍구
  return g;
}
function boosterPump(i, warn) {
  const g = mod("부스터 펌프 BP-" + i, "급수 · 세로형 다단 펌프",
    warn ? [["상태", "운전 중"], ["진동", "4.8 mm/s (주의 4.5)"], ["최근 측정", "10:13 · Robot 01"]] : [["상태", "대기"], ["진동", "1.2 mm/s"], ["최근 측정", "10:13 · Robot 01"]], warn);
  g.add(tile(1.5, 1.5));
  g.add(rcyl(0.17 * S, 0.7 * S, P.light, 0, Y0, 0));                         // ① 몸통
  g.add(rcyl(0.25 * S, 0.55 * S, P.white, 0, Y0 + 0.7 * S, 0));              // ② 모터
  g.add(rcyl(0.12 * S, 0.12, P.mid, 0, Y0 + 1.25 * S, 0));                   // ③ 팬 덮개
  return g;
}
function pressureTank() {
  const g = mod("팽창 탱크 ET-1", "급수 · 압력 탱크", [["용량", "500 L"], ["압력", "0.42 MPa"], ["상태", "정상"]]);
  g.add(tile(2.0, 2.0));
  g.add(rbox(1.2, 0.3, 1.2, P.mid, 0, Y0, 0, 0.08));                         // ① 받침
  g.add(cap(0.5 * S, 0.7 * S, P.white, 0, Y0 + 0.3, 0));                     // ② 캡슐 몸통
  g.add(rcyl(0.14, 0.18, P.light, 0, Y0 + 0.3 + 0.7 * S + S, 0));            // ③ 위 연결구
  return g;
}
function firePump(i) {
  const g = mod("소화 펌프 FP-" + i, "소화 · 가로형 펌프 + 모터", [["구분", i === 1 ? "주 펌프" : "예비 펌프"], ["상태", "대기"], ["최근 점검", "11/01 09:00"]]);
  g.add(tile(3.4, 1.6));
  g.add(rbox(3.0, 0.22, 0.9, P.mid, 0, Y0, 0, 0.06));                        // ① 받침
  const motor = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 8, 32), mat(P.white))); motor.rotation.z = Math.PI / 2; motor.position.set(0.55, Y0 + 0.7, 0); g.add(motor);   // ② 모터
  const cas = shade(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), mat(P.light))); cas.scale.set(1, 1, 0.8); cas.position.set(-0.85, Y0 + 0.72, 0); g.add(cas);                // ③ 펌프 집
  return g;
}
function waterTank() {
  const g = mod("판넬 저수조 WT-1", "급수 · 저수조", [["크기", "6 × 3 × 3 m"], ["수위", "78%"], ["상태", "정상"]]);
  g.add(tile(8.6, 4.2));
  g.add(rbox(7.6, 3.4, 3.2, P.white, 0, Y0, 0, 0.16));                       // ① 몸통
  [-2.53, 0, 2.53].forEach(x => g.add(rbox(0.06, 3.0, 0.02, P.light, x, Y0 + 0.2, 1.61, 0.01)));   // ② 판넬 이음(셋만)
  g.add(rbox(1.0, 0.16, 1.0, P.light, 2.6, Y0 + 3.4, -0.6, 0.06));           // ③ 맨홀
  return g;
}

// ---------- 모델 ----------
let floorGroup = null, target = null, zone = null;
const modules = [];
function kindOf(o) { let n = o; while (n) { const s = String(n.name || "").toLowerCase().replace(/^[0-9]+[_\-\s]*/, "").split(/[\s\-–_]/)[0]; if (["floor", "wall", "equipment", "stairs"].includes(s)) { return s; } n = n.parent; } return "other"; }
const SKIN = { floor: 0x1a2130, wall: 0x4a566c, equipment: 0x3f4a60, stairs: 0x4a566c, other: 0x3f4a60 };

new GLTFLoader().parse(Uint8Array.from(atob(window.APRISM_MAP_GLB), c => c.charCodeAt(0)).buffer, "", gltf => {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(root), size = all.getSize(new THREE.Vector3()), center = all.getCenter(new THREE.Vector3());
  const unit = 120 / Math.max(size.x, size.y, size.z);
  const place = new THREE.Matrix4().makeScale(unit, unit, unit).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const mb = all.clone().applyMatrix4(place);
  const toWorld = (X, Y) => new THREE.Vector3(mb.min.x + X, 0, mb.max.z - Y);
  const b4 = root.children.find(c => /지하[\s_]*4[\s_]*층/.test(c.name));
  floorGroup = new THREE.Group(); scene.add(floorGroup);
  const T = { X: 38.6, Y: 45.5, W: 13.6, H: 23.1 };
  const tMin = toWorld(T.X, T.Y + T.H), tMax = toWorld(T.X + T.W, T.Y);
  const tBox = new THREE.Box3(new THREE.Vector3(tMin.x - 0.6, -1e4, tMin.z - 0.6), new THREE.Vector3(tMax.x + 0.6, 1e4, tMax.z + 0.6));
  let deck = Infinity; const targets = [];
  b4.traverse(o => {
    if (!o.isMesh) { return; }
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.applyMatrix4(place); g.computeBoundingBox();
    const k = kindOf(o);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: SKIN[k], roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    m.castShadow = k !== "floor"; m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: 0xc7d2e4, transparent: true, opacity: k === "floor" ? 0.08 : 0.16 })));   // 5 주변 선은 옅게
    floorGroup.add(m);
    if (k === "floor") { deck = Math.min(deck, g.boundingBox.max.y); }
    if (k === "equipment") { const c2 = g.boundingBox.getCenter(new THREE.Vector3()); if (tBox.containsPoint(new THREE.Vector3(c2.x, 0, c2.z))) { targets.push(m); } }
  });
  if (!isFinite(deck)) { deck = 0; }
  const u = new THREE.Box3(); targets.forEach(t => u.union(t.geometry.boundingBox)); target = targets;
  const room = targets.length ? { x0: u.min.x, x1: u.max.x, z0: u.min.z, z1: u.max.z, y: deck } : { x0: Math.min(tMin.x, tMax.x), x1: Math.max(tMin.x, tMax.x), z0: Math.min(tMin.z, tMax.z), z1: Math.max(tMin.z, tMax.z), y: deck };
  buildRoom(room);
  frame("room");
  document.getElementById("loading").remove();
});

function buildRoom(r) {
  zone = new THREE.Group(); zone.position.set((r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2); scene.add(zone);
  const W = r.x1 - r.x0, D = r.z1 - r.z0;
  const h = new THREE.Group(); zone.add(h);
  if (D < W) { h.rotation.y = Math.PI / 2; }
  const w = Math.min(W, D), d = Math.max(W, D);
  h.add(rbox(w - 0.3, 0.12, d - 0.3, P.base, 0, 0, 0, 0.1));                 // 디오라마 바닥(한 단 낮은 회색)
  const at = (g, x, z, ry) => { g.position.set(x, 0.12, z); g.rotation.y = ry || 0; h.add(g); modules.push(g); return g; };
  // 타일 배치 — 타일 사이를 비운다
  at(waterTank(), 0, -d / 2 + 3.0);
  at(boilerBank(), -w / 2 + 3.2, -d / 2 + 8.4);
  at(controlPanel(), w / 2 - 2.0, -d / 2 + 7.6);
  at(boosterPump(1, false), w / 2 - 3.2, -d / 2 + 10.4);
  at(boosterPump(2, true), w / 2 - 1.4, -d / 2 + 10.4);
  at(pressureTank(), -w / 2 + 2.6, -d / 2 + 13.6);
  at(firePump(1), w / 2 - 3.0, d / 2 - 5.6);
  at(firePump(2), w / 2 - 3.0, d / 2 - 3.2);
  // 배관 — 계통당 굵은 한 줄, 무채색. 알림이 난 급수(BP-2) 계통만 상태색(주의 노랑)
  const yp = 0.12 + 0.28 + 0.35;
  h.add(pipe([[w / 2 - 1.4, yp, -d / 2 + 10.4], [w / 2 - 1.4, yp, -d / 2 + 5.4], [0, yp, -d / 2 + 5.4]], 0.16, P.warn));
  h.add(pipe([[-w / 2 + 3.2, yp, -d / 2 + 9.6], [-w / 2 + 3.2, yp, -d / 2 + 11.6], [w / 2 - 3.2, yp, -d / 2 + 11.6]], 0.13, P.light));
  h.add(pipe([[w / 2 - 4.9, yp, d / 2 - 5.6], [-w / 2 + 1.2, yp, d / 2 - 5.6], [-w / 2 + 1.2, yp, -d / 2 + 5.4]], 0.18, P.light));
}

// ---------- 보기 ----------
function frame(v) {
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  const showRoom = v !== "before";
  if (zone) { zone.visible = showRoom; }
  if (target) { target.forEach(t => { t.visible = !showRoom; }); }
  let tgt, dist;
  if (v === "floor") { const fb = new THREE.Box3().setFromObject(floorGroup); tgt = fb.getCenter(new THREE.Vector3()); dist = fb.getSize(new THREE.Vector3()).length() * 1.6; }
  else { const zb = new THREE.Box3(); if (zone) { const was = zone.visible; zone.visible = true; zb.setFromObject(zone); zone.visible = was; } tgt = zb.getCenter(new THREE.Vector3()); dist = zb.getSize(new THREE.Vector3()).length() * 1.7; }
  const dir = new THREE.Vector3(1, 1.05, 1).normalize();
  controls.target.copy(tgt); camera.position.copy(tgt).addScaledVector(dir, dist);
  sun.position.copy(tgt).add(new THREE.Vector3(-18, 34, 12)); sun.target.position.copy(tgt);
  const s = Math.max(16, dist * 0.45); Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 150 }); sun.shadow.camera.updateProjectionMatrix();
  controls.update();
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => frame(b.dataset.view)));

// ---------- 고르기 · 카드 · 주의 핀 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), card = document.getElementById("card");
let hot = null, picked = null;
function modOf(o) { while (o && !modules.includes(o)) { o = o.parent; } return o; }
function tint(g, on) { g.traverse(o => { if (o.isMesh) { if (!o.userData.own) { o.material = o.material.clone(); o.userData.own = true; } o.material.emissive.setHex(on ? 0x1d3550 : 0x000000); } }); }
function showCard(g, x, y) {
  card.querySelector("[data-k]").textContent = g.userData.kind;
  card.querySelector("[data-n]").textContent = g.userData.name;
  card.querySelector("[data-d]").innerHTML = g.userData.info.map(([k, v]) => `<dt>${k}</dt><dd class="${/주의/.test(v) ? "warn" : ""}">${v}</dd>`).join("");
  card.style.left = Math.min(innerWidth - 300, x + 16) + "px"; card.style.top = Math.min(innerHeight - 160, y + 16) + "px";
  card.classList.add("on");
}
function pick(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(modules, true)[0]; return hit ? modOf(hit.object) : null; }
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
const pins = [];
function syncPins() {
  modules.filter(m => m.userData.warn).forEach((m, i) => {
    if (!pins[i]) { const p = document.createElement("div"); p.className = "pin"; p.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#ffcc00" stroke="#070a10" stroke-width="1.2" d="M11.13 3.5c.39-.67 1.35-.67 1.74 0l9.26 16c.39.67-.1 1.5-.87 1.5H2.73c-.77 0-1.25-.83-.87-1.5l9.27-16Z"/><path fill="#070a10" d="M11 10h2v4h-2zM11 16h2v2h-2z"/></svg>'; document.body.appendChild(p); pins[i] = p; }
    const b = new THREE.Box3().setFromObject(m), top = b.getCenter(new THREE.Vector3()); top.y = b.max.y + 0.4;
    const q = top.project(camera);
    pins[i].style.display = zone && zone.visible && q.z < 1 ? "" : "none";
    pins[i].style.left = ((q.x + 1) / 2 * innerWidth) + "px"; pins[i].style.top = ((1 - q.y) / 2 * innerHeight) + "px";
  });
}

function resize() { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
renderer.setAnimationLoop(() => { controls.update(); composer.render(); if (modules.length) { syncPins(); } });
