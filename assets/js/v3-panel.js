// v3 — 왼쪽 관제 패널(2026-10-21 디자이너, v2.2 피드백 2번).
// "오늘 확인 완료" 를 접는다. 머리 줄 어디를 눌러도 되고, 접힌 자리는 위 최신 알림이 가져간다.
// 접힘은 보는 사람 브라우저에만 기억한다(새로 고쳐도 그대로) — 막힌 곳에서는 펼친 채로 시작한다.
(function () {
  var sec = document.querySelector("[data-done-sec]");
  var head = document.querySelector("[data-done-head]");
  var btn = document.querySelector("[data-done-fold]");
  if (!sec || !head || !btn) { return; }
  var KEY = "aprism.v3.doneFolded";

  function set(folded) {
    sec.classList.toggle("is-folded", folded);
    btn.setAttribute("aria-expanded", folded ? "false" : "true");
    btn.setAttribute("aria-label", folded ? "오늘 확인 완료 펼치기" : "오늘 확인 완료 접기");
    try { window.localStorage.setItem(KEY, folded ? "1" : "0"); } catch (e) { /* 저장이 막힌 곳 — 이번만 */ }
  }

  var start = false;
  try { start = window.localStorage.getItem(KEY) === "1"; } catch (e) { /* 펼친 채로 */ }
  // 처음 그릴 때는 움직이지 않는다 — 새로 고칠 때마다 접히는 모션이 보이면 거슬린다.
  sec.classList.add("no-motion");
  set(start);
  requestAnimationFrame(function () { requestAnimationFrame(function () { sec.classList.remove("no-motion"); }); });

  head.addEventListener("click", function () { set(!sec.classList.contains("is-folded")); });
})();
