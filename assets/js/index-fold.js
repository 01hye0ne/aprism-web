// 인덱스 — 최신이 아닌 판의 카드는 화면 목록을 접어 둔다(10/30 디자이너). 이름 · 날짜만 남고 [화면 N개 ▾] 로 펼친다.
// 최신 카드(.is-latest)는 늘 펼쳐 둔다. 목록이 없는 카드(한 화면짜리 판)는 접을 것이 없다.
(function () {
  "use strict";
  Array.prototype.forEach.call(document.querySelectorAll(".ver-card:not(.is-latest)"), function (card, n) {
    var pages = card.querySelector(".ver-pages");
    if (!pages) { return; }
    var id = pages.id || "ver-pages-" + n;
    pages.id = id;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ver-fold";
    btn.setAttribute("aria-controls", id);
    btn.innerHTML = '<span>화면 ' + pages.children.length + '개</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    function set(open) {
      card.classList.toggle("is-folded", !open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", (open ? "화면 목록 접기" : "화면 목록 펼치기") + " — " + pages.children.length + "개");
    }
    btn.addEventListener("click", function () { set(card.classList.contains("is-folded")); });
    card.insertBefore(btn, pages);
    set(false);
  });
})();
