// 미니맵 경로 뽑기 — 관제 지도(map-v6.js)가 미션마다 깐 길을 미니맵 평면(PLAN2, px)으로 옮겨 assets/js/mini-routes.js 로 쓴다.
//   node tools/export-mini-routes.mjs <lanes.json>
//   lanes.json = 관제 화면에서 APRISM_ROUTE.lanesAll() 결과(JSON 문자열). 도면(m) → 평면(px): x = X·840/W, y = 1370 − Y·1370/H (B3 · B4 같은 틀, 11/02 실측 맞춤)
import { readFileSync, writeFileSync } from "node:fs";
const raw = readFileSync(process.argv[2], "utf8").trim();
const d = JSON.parse(raw.startsWith('"') ? JSON.parse(raw) : raw);
const W = d.box.maxX, H = d.box.maxY;
const px = p => [+(p[0] / W * 840).toFixed(1), +(1370 - p[1] / H * 1370).toFixed(1)];
const MIS = { "정기 순회 점검": 0, "야간 순회 점검": 3, "공조 설비 순회": 6, "유틸리티 순회": 8, "전기실 열화상 점검": 10 };
const FL = { 0: "B4", 3: "B4", 6: "B3", 8: "B4", 10: "B3" };
function cum(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
// 점 q 를 선 위에 투영한 거리(s)
function sOf(pts, c, q) { let best = 1e9, bs = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1; let t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L; t = Math.max(0, Math.min(1, t)); const x = a[0] + dx * t, y = a[1] + dy * t, dd = Math.hypot(q[0] - x, q[1] - y); if (dd < best) { best = dd; bs = c[i - 1] + Math.sqrt(L) * t; } } return +bs.toFixed(1); }
const out = {};
Object.entries(MIS).forEach(([m, id]) => {
  const ln = d.lanes[String(id)]; if (!ln) { return; }
  const pts = ln.turns.map(px), c = cum(pts);
  // 웨이포인트 차례대로 — 투영 거리가 앞 지점보다 작아지면(왕복 길) 그 뒤에서 다시 찾는다
  let last = 0; const sAt = ln.wps.map(px).map(q => { let s = sOf(pts, c, q); if (s < last) { const i0 = c.findIndex(v => v >= last); const sub = pts.slice(Math.max(0, i0 - 1)); s = c[Math.max(0, i0 - 1)] + sOf(sub, cum(sub), q); } last = s; return +s.toFixed(1); });
  out[m] = { [FL[id]]: { pts, sAt, n0: 1 } };
});
// 층을 건너는 미션(발전기실 설비 점검 · Robot 05) — B3 둘레(0 → s1)에 WP-01~12, B4(s2 → s3)에 WP-13~20 을 고르게
if (d.cross) {
  const c3 = d.cross.pts.filter(p => p[2] > -1).map(px), c4 = d.cross.pts.filter(p => p[2] < -4).map(px);
  const even = (pts, n) => { const c = cum(pts), L = c[c.length - 1]; return Array.from({ length: n }, (_, j) => +(L * (0.04 + 0.92 * j / (n - 1))).toFixed(1)); };
  const thin = pts => pts.filter((p, i) => i % 2 === 0 || i === pts.length - 1);
  const p3 = thin(c3), p4 = thin(c4);
  out["발전기실 설비 점검"] = { B3: { pts: p3, sAt: even(p3, 12), n0: 1 }, B4: { pts: p4, sAt: even(p4, 8), n0: 13 } };
}
const js = "// 자동 생성 — tools/export-mini-routes.mjs(관제 지도 map-v6.js 의 미션별 길을 미니맵 평면 px 로). 손으로 고치지 말 것.\n" +
  "// 미션 → 층 → { pts: 길(꺾인 점), sAt: 웨이포인트가 길 위 어디(거리), n0: 이 층 첫 웨이포인트 번호 }\n" +
  "window.APRISM_MINI_ROUTES = " + JSON.stringify(out) + ";\n";
writeFileSync("assets/js/mini-routes.js", js);
console.log(Object.entries(out).map(([m, f]) => m + " " + Object.entries(f).map(([k, v]) => k + ":" + v.pts.length + "pts/" + v.sAt.length + "wp").join(",")).join("\n"));
