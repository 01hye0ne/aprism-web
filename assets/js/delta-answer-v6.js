/*
 * [11/04 v6] Delta 펼침 답 구조 — 아티팩트 "Delta v6 접힘 / 펼침 시안"(MSLqX8J1QBegmAtb1gBB8i) 펼침 구조 8칸. 펼친 Delta 는 채팅창이 아니라
 *   답을 구조화된 정보와 바로 할 수 있는 단추로 보여 주는 판이다. delta-chat.js 가 불러 쓰고, v6 에서만 돈다(v5 이하는 그대로).
 *
 *   1 현재 관제 요약   창을 처음 펼치면 스스로 말한다. 건수는 칩이 아니라 문장 속 등급 색 글자
 *   2 먼저 확인할 항목 카드(아이콘 + 등급 색 지시 한 줄, 설비, 설명, 먼저 보는 이유, 위치와 감지 시각, 단추)
 *   3 다음 확인 항목   남은 위험. 누르면 알림 쪽지, 처리한 줄은 취소선, 다음 줄에 "다음". 주의는 눌러서 펼친다
 *   4 이렇게 물어보세요 마지막 답에 따라 바뀐다
 *   5 입력 칸          delta-chat.js 그대로 아래 고정
 *   6 후속 답          같은 블록 문법. 근거, 원인 분석(확인된 사실 / 추정), 추천 조치(확인 후 요청, 시뮬레이션), 위치
 *   7 새 알림          배너 없이 대화 안에서. 읽던 자리에 "새 알림" 선, 위를 읽고 있으면 아래 "새 위험 n건" 단추만
 *   8 시점             분석 시각은 Delta 머리에 한 번만. 새 알림 뒤의 지난 답은 흐려진다
 *
 * 시안과 다르게 둔 것:
 *   문체는 라이팅 시스템의 ~요 하나(시안은 ~습니다 — 시안 "정할 것"). 가운뎃점 · WP 번호는 문장에 쓰지 않는다.
 *   원인 후보 · 점검 순서 · 조치는 알림 데이터(monitor.js cause · fix · acts)에 있는 것만 쓴다 — 시안의 예상 영향 · 확신도는 데이터가 없어 뺐다.
 *   순서는 monitor.js handleOrder(APRISM_DELTA_ALERTS.order) 그대로다.
 */
(function () {
  "use strict";

  var KINDS = [[/계기/, "gauge"], [/온도/, "thermometer"], [/방전/, "bolt"], [/누출/, "eye"], [/음향|진동/, "gauge"], [/안전/, "shield"]];
  var INTENTS = [
    ["why", /왜.*(순위|먼저|순서)|먼저 봐야/],
    ["others", /다른 위험|다른 미션/],
    ["priority", /요약|뭐부터|무엇부터|우선|먼저|순서|가이드|할 ?일/],
    ["cause", /원인|왜|이유|근거/],
    ["actions", /조치|어떻게|해결|방법|고치|뭘 해야/],
    ["location", /위치|어디|지도/],
    ["count", /몇|개수/],
    ["greet", /^(안녕|하이|hi|hello)/i]
  ];
  var SUGG = {
    priority: ["원인이 뭐야?", "어떻게 조치해?", "왜 이걸 먼저 봐야 해?"],
    why: ["원인이 뭐야?", "어떻게 조치해?", "다른 위험도 알려줘"],
    cause: ["어떻게 조치해?", "위치 알려줘", "왜 이걸 먼저 봐야 해?"],
    actions: ["위치 알려줘", "다른 위험도 알려줘", "원인이 뭐야?"],
    location: ["어떻게 조치해?", "원인이 뭐야?", "다른 위험도 알려줘"],
    others: ["뭐부터 처리해?", "원인이 뭐야?", "어떻게 조치해?"],
    alert: ["원인이 뭐야?", "어떻게 조치해?", "뭐부터 처리해?"],
    other: ["뭐부터 처리해?", "원인이 뭐야?", "어떻게 조치해?"]
  };
  var ST = { suggested: "추천", pending: "승인 대기", requested: "요청됨(시뮬레이션)", progress: "진행 중(시뮬레이션)" };
  // 라이팅 시스템 11 — "재측정 후 판단"은 판단이지 할 일이 아니고, "작업 중지 요청"은 무전으로 사람이 하는 일이다
  var NOT_ACT = /재측정 후 판단|작업 중지/;

  window.APRISM_DELTA_V6 = function (c) {
    var el = c.el, msgs = [];
    var lastType = null, lastQ = null, lastTarget = null;
    var seen = null, unread = false, jumpTo = null, jumpN = 0;
    var acts = new WeakMap();
    var host = c.body, box = c.box, name = c.win.querySelector(".delta3-name-in");

    var sugg = el("div", "dc6-sugg");
    sugg.hidden = true;
    sugg.appendChild(el("span", "dc6-sugg-l", "이렇게 물어보세요"));
    var chips = el("div", "dc6-qs");
    sugg.appendChild(chips);
    host.insertBefore(sugg, box);
    var anchor = el("div", "dc6-jump-at");
    var jump = el("button", "dc6-jump");
    jump.type = "button";
    jump.hidden = true;
    anchor.appendChild(jump);
    host.insertBefore(anchor, sugg);
    var stamp = el("span", "dc6-at num");
    if (name) { name.appendChild(stamp); }

    function A() { return c.alerts(); }
    function ordered() { var a = A(); return a.order || a.all || []; }
    function counts(list) {
      var cr = list.filter(function (a) { return a.sev === "critical"; }).length;
      return { c: cr, w: list.length - cr };
    }
    function isOpenAlert(a) { return (A().all || []).indexOf(a) >= 0; }
    function wpNo(a) { var m = /\d+/.exec(a.wp || ""); return m ? parseInt(m[0], 10) + "번 지점" : ""; }
    function place(a) { return [a.floor, wpNo(a)].filter(Boolean).join(" "); }
    function label(a) { return c.label(a); }
    function mine(a) { return (A().mine || []).indexOf(a) >= 0; }
    function missionLine(a) { return [a.floor, A().missionOf ? A().missionOf(a) : ""].filter(Boolean).join(" "); }
    /*
     * [11/05 v6] 미션 표식 — 접힘과 같은 모양(v3-panel.js APRISM_DELTA_TOKEN, 문형표 5). 미션 [M번호 이름](괄호만 회색).
     *   waypoint 번호 표식은 접힘에서만 쓴다 — 펼친 Delta 는 예전 글("B4 4번 지점") 그대로(11/05 디자이너). 표식이 없으면(다른 화면) 예전 글.
     */
    function tok() { return window.APRISM_DELTA_TOKEN || null; }
    // 층 + [M번호 미션]
    function missionNode(a) {
      var T = tok(), name = A().missionOf ? A().missionOf(a) : "";
      if (!T || !name) { return document.createTextNode(missionLine(a)); }
      var f = document.createDocumentFragment();
      if (a.floor) { f.appendChild(document.createTextNode(a.floor + " ")); }
      f.appendChild(T.mission(name));
      return f;
    }

    function needLine(a) {
      var w = (a.btn || "").replace(/\s*(요청|예약)$/, "");
      if (!w) { return a.sev === "critical" ? "바로 확인이 필요해요" : "확인이 필요해요"; }
      return w + (c.batchim(w) ? "이" : "가") + " 필요해요";
    }
    function icon(n, cls) {
      var i = el("span", "i i-16" + (cls ? " " + cls : ""));
      i.style.setProperty("--i", "var(--ic-" + n + ")");
      i.setAttribute("aria-hidden", "true");
      return i;
    }
    function diag(a) {
      var k = KINDS.filter(function (x) { return x[0].test(a.detect || a.title || ""); })[0];
      return icon(k ? k[1] : "info", "dc6-diag");
    }
    function btn(text, kind, fn) {
      var b = el("button", "dc6-btn" + (kind ? " " + kind : ""), text);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }
    function btnRow() {
      var r = el("div", "dc6-btns");
      Array.prototype.forEach.call(arguments, function (b) { r.appendChild(b); });
      return r;
    }
    function open(a) { return c.openA(a); }
    function detailBtn(a) { return btn(a.sev === "critical" ? "위험 상세 확인" : "상세 확인", "is-pri", open(a)); }
    function mapBtn(a) { return btn("위치 보기", "", open(a)); }

    // 답 틀 — 제목(왼쪽)과 범위나 대상(오른쪽). 시각은 머리에 한 번만 둔다
    function msg(type, a, title, right) {
      var m = { type: type, a: a, node: el("div", "dc-msg is-ai dc6"), rows: [], card: null, next: false };
      var h = el("div", "dc6-h");
      h.appendChild(el("h4", null, title));
      if (right) { h.appendChild(el("span", null, right)); }
      m.node.appendChild(h);
      msgs.push(m);
      return m;
    }
    function text(m, t, strong) { m.node.appendChild(el("p", "dc6-p" + (strong ? " is-strong" : ""), t)); }
    function toTop(node) {
      var th = c.thread();
      if (th) { th.scrollTop += node.getBoundingClientRect().top - th.getBoundingClientRect().top - 8; }
    }
    function stampNow() {
      var t = (A().all || []).map(function (a) { return a.time || ""; }).sort().pop();
      stamp.textContent = t ? c.hhmm(t) + " 분석" : "";
    }
    function finish(m, type) {
      lastType = type || m.type;
      if (m.a) { lastTarget = m.a; }
      c.add(m.node);
      refresh(m);
      toTop(m.node);
      paintSugg();
      stampNow();
      return m;
    }

    // 처리한 항목 — 지우지 않고 취소선, 다음 항목에 꼬리표(라이팅 시스템 10)
    function refresh(m) {
      var taken = false;
      if (m.card) {
        var cardGone = !isOpenAlert(m.card.a);
        m.card.node.classList.toggle("is-done", cardGone);
        m.card.note.hidden = !cardGone;
        if (cardGone) {
          m.card.at = m.card.at || c.nowHM();
          m.card.note.textContent = m.card.at + " 처리했어요. 다음 항목을 확인하세요.";
        } else { taken = true; }
      }
      m.rows.forEach(function (r) {
        var gone = !isOpenAlert(r.a);
        if (gone && !r.at) { r.at = c.nowHM(); }
        r.node.classList.toggle("is-done", gone);
        if (gone) { r.sub.textContent = r.at + " 처리"; } else if (!r.sub.querySelector(".dl-m")) { r.sub.textContent = ""; r.sub.appendChild(missionNode(r.a)); }
        var tag = r.node.querySelector(".dc6-tag");
        if (tag) { tag.remove(); }
        r.node.classList.remove("is-next");
        if (!gone && !taken && m.next) {
          taken = true;
          r.node.classList.add("is-next");
          r.node.querySelector(".dc6-row-t").appendChild(el("b", "dc6-tag", "다음"));
        }
      });
    }

    function row(m, a) {
      var b = el("button", "dc6-row is-" + a.sev);
      b.type = "button";
      b.appendChild(diag(a));
      var x = el("span", "dc6-row-x");
      var t = el("span", "dc6-row-t");
      t.appendChild(el("span", null, label(a)));
      x.appendChild(t);
      var meta = missionLine(a);
      var sub = el("span", "dc6-row-s");
      sub.appendChild(missionNode(a));
      x.appendChild(sub);
      b.appendChild(x);
      b.appendChild(icon("chevron-right", "dc6-row-c"));
      b.addEventListener("click", open(a));
      m.rows.push({ a: a, node: b, sub: sub, meta: meta });
      return b;
    }
    function rows(m, list, hidden) {
      var l = el("div", "dc6-list");
      l.hidden = !!hidden;
      list.forEach(function (a) { l.appendChild(row(m, a)); });
      return l;
    }

    function reasons(a, ord) {
      var out = [a.sev === "critical" ? "가장 높은 위험 단계" : "열린 위험이 없어 주의 중 먼저"];
      if (!mine(a) && !(A().mine || []).some(function (x) { return x.sev === a.sev; })) { out.push("보는 미션에는 같은 단계 알림이 없음"); }
      var same = ord.filter(function (x) { return x.sev === a.sev && mine(x) === mine(a); }).length;
      out.push(c.hhmm(a.time) + "부터 열려 있음" + (same > 1 ? ", 같은 단계에서 가장 오래" : ""));
      if (a.fp !== undefined) { out.push("오탐 가능성 " + a.fpLabel + " " + a.fp + "%"); }
      return out.slice(0, 3);
    }
    function ul(list, tag, cls) {
      var l = el(tag || "ul", cls);
      list.forEach(function (t) { l.appendChild(el("li", null, t)); });
      return l;
    }
    function card(m, a, ord) {
      var d = el("div", "dc6-card");
      var top = el("p", "dc6-need is-" + a.sev);
      top.appendChild(diag(a));
      top.appendChild(el("span", null, needLine(a)));
      d.appendChild(top);
      d.appendChild(el("p", "dc6-eq", label(a)));
      if (a.sum) { d.appendChild(el("p", "dc6-desc", a.sum)); }
      var why = el("div", "dc6-why");
      why.appendChild(el("span", "dc6-why-l", "먼저 보는 이유"));
      why.appendChild(ul(reasons(a, ord)));
      d.appendChild(why);
      // [11/05] 위치와 시각 줄("B4 4번 지점, 10:12 감지")은 뺐다(디자이너) — 위치는 [위치 보기] 단추가 맡는다
      var note = el("p", "dc6-done");
      note.hidden = true;
      d.appendChild(note);
      d.appendChild(btnRow(detailBtn(a), mapBtn(a)));
      m.card = { a: a, node: d, note: note };
      return d;
    }
    function countLine(n, tail) {
      var p = el("p", "dc6-p");
      p.appendChild(document.createTextNode("지금 "));
      if (n.c) { p.appendChild(el("b", "dc6-sev is-critical", "위험 " + n.c + "건")); }
      if (n.c && n.w) { p.appendChild(document.createTextNode(", ")); }
      if (n.w) { p.appendChild(el("b", "dc6-sev is-warning", "주의 " + n.w + "건")); }
      p.appendChild(document.createTextNode("이 있어요. " + tail));
      return p;
    }

    function priority(first) {
      var ord = ordered(), top = ord[0], n = counts(ord);
      var m = msg("priority", top, first ? "현재 관제 요약" : "처리 순서");   // [11/05] 오른쪽 범위 글("전체 미션")은 뺐다(디자이너)
      if (!top) { text(m, "지금은 확인할 알림이 없어요."); return finish(m); }
      m.node.appendChild(countLine(n, n.c ? "급한 것부터 안내할게요." : "먼저 볼 것부터 안내할게요."));
      m.next = true;
      m.node.appendChild(card(m, top, ord));
      var rest = ord.slice(1).filter(function (a) { return a.sev === "critical"; });
      if (rest.length) {
        var sh = el("div", "dc6-sub");
        sh.appendChild(el("span", null, "다음 확인 항목"));
        sh.appendChild(el("span", null, rest.length + "건"));
        m.node.appendChild(sh);
        m.node.appendChild(rows(m, rest));
      }
      var warns = ord.filter(function (a) { return a.sev !== "critical" && a !== top; });
      if (warns.length) {
        var tg = el("button", "dc6-toggle");
        tg.type = "button";
        tg.setAttribute("aria-expanded", "false");
        tg.appendChild(el("span", null, "주의"));
        var r = el("span", "dc6-toggle-r", warns.length + "건");
        r.appendChild(icon("chevron-down"));
        tg.appendChild(r);
        var l = rows(m, warns, true);
        tg.addEventListener("click", function () {
          var on = tg.getAttribute("aria-expanded") !== "true";
          tg.setAttribute("aria-expanded", String(on));
          l.hidden = !on;
        });
        m.node.appendChild(tg);
        m.node.appendChild(l);
      }
      return finish(m);
    }

    function why(a) {
      var ord = ordered(), at = ord.indexOf(a);
      var m = msg("why", a, "먼저 보는 이유", a.eq);
      text(m, at === 0 ? "이것부터 확인하세요. 열린 " + ord.length + "건 중 첫 번째예요." : "열린 " + ord.length + "건 중 " + (at + 1) + "번째예요.");
      m.node.appendChild(ul(reasons(a, ord), "ul", "dc6-ul"));
      m.node.appendChild(el("p", "dc6-rule", "순서는 운영 규칙(위험, 보는 미션, 오래된 순)으로 정해요. Delta는 순서를 바꾸지 않고 근거만 설명해요."));
      m.node.appendChild(btnRow(detailBtn(a), mapBtn(a)));
      return finish(m);
    }

    function sec(d, title, tag, bodyNode) {
      var s = el("div", "dc6-sec");
      var h = el("h5", null, title);
      if (tag) { h.appendChild(el("span", tag === "fact" ? "dc6-fact" : "dc6-est", tag === "fact" ? "확인된 사실" : "추정")); }
      s.appendChild(h);
      s.appendChild(bodyNode);
      d.appendChild(s);
    }
    function cause(a) {
      var m = msg("cause", a, "원인 분석", a.eq);
      var real = a.fp !== undefined && a.fp < 20;
      text(m, real ? "판독 오류보다 실제 이상 쪽으로 보여요." : "판독 오류일 수도 있어요. 근거를 같이 보세요.", true);
      var d = el("div", "dc6-card");
      sec(d, "감지된 문제", null, el("p", null, a.sum || label(a)));
      var ev = [];
      if (a.hist) { ev.push(a.hist.length + "회 측정 " + a.hist.join(" → ")); } else if (a.trend) { ev.push(a.trend); }
      if (a.fp !== undefined) { ev.push("오탐 가능성 " + a.fpLabel + " " + a.fp + "%"); }
      ev.push(c.robotName(a) + " 측정, " + c.hhmm(a.time));
      sec(d, "관찰된 근거", "fact", ul(ev));
      if (a.cause) { sec(d, "가능한 원인", "est", ul(a.cause)); }
      if (a.fix) { sec(d, "권장 확인 순서", null, ul(a.fix, "ol")); }
      if (!a.cause) { d.appendChild(el("div", "dc6-gap", "추가 확인 필요: 원인 후보가 아직 정리되지 않았어요. 현장 확인이 필요해요.")); }
      d.appendChild(btnRow(btn("추천 조치 보기", "is-pri", function () { c.ask("어떻게 조치해?"); }), mapBtn(a)));
      m.node.appendChild(d);
      return finish(m);
    }

    function actList(a) {
      var list = (a.acts || []).filter(function (x) { return !NOT_ACT.test(x.t); });
      return list.length ? list : a.btn ? [{ t: a.btn, ai: true }] : [];
    }
    function stateOf(a) { if (!acts.has(a)) { acts.set(a, {}); } return acts.get(a); }
    function paintActs() {
      var root = c.thread() || document;
      Array.prototype.forEach.call(root.querySelectorAll(".dc6-act"), function (r) {
        var st = stateOf(r._a)[r._t] || "suggested", chip = r.querySelector(".dc6-st"), cb = r.querySelector("input");
        chip.setAttribute("data-st", st);
        chip.textContent = ST[st];
        cb.disabled = st !== "suggested";
        if (cb.disabled) { cb.checked = false; }
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-dc6-req]"), function (b) {
        var d = b.closest(".dc6-card");
        b.disabled = !d.querySelector(".dc6-act input:checked") || !!d.querySelector(".dc6-confirm");
      });
    }
    // 시뮬레이션 — 아무것도 보내지 않는다. 이 화면의 상태만 바뀐다
    function request(a, names) {
      var s = stateOf(a);
      names.forEach(function (t, i) {
        s[t] = "pending";
        setTimeout(function () {
          s[t] = "requested";
          paintActs();
          setTimeout(function () { s[t] = "progress"; paintActs(); }, 2600);
        }, 700 + i * 250);
      });
      paintActs();
    }
    function actions(a) {
      var list = actList(a);
      var m = msg("actions", a, "추천 조치", a.eq);
      if (!list.length) {
        text(m, "이 알림은 추천 조치가 아직 없어요. 알림을 열어 확인하세요.");
        m.node.appendChild(btnRow(detailBtn(a), mapBtn(a)));
        return finish(m);
      }
      text(m, a.fixFirst || ("추천 조치 " + list.length + "건이에요. 확인 후 요청하세요."));
      var d = el("div", "dc6-card");
      d.appendChild(el("p", "dc6-sim", "시뮬레이션: 확인 전에는 아무것도 보내지 않고, 상태는 이 화면에서만 바뀌어요."));
      var l = el("div", "dc6-acts");
      list.forEach(function (x, i) {
        var r = el("label", "dc6-act");
        r._a = a;
        r._t = x.t;
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = !!x.ai && i === 0 && !stateOf(a)[x.t];
        cb.addEventListener("change", paintActs);
        r.appendChild(cb);
        r.appendChild(el("span", "dc6-act-t", x.t));
        r.appendChild(el("span", "dc6-st"));
        l.appendChild(r);
      });
      d.appendChild(l);
      var req = btn("선택 항목 요청", "is-pri", function () {
        var picked = Array.prototype.filter.call(l.querySelectorAll(".dc6-act"), function (r) { return r.querySelector("input").checked; }).map(function (r) { return r._t; });
        if (!picked.length) { return; }
        var cf = el("div", "dc6-confirm");
        cf.appendChild(el("span", null, "요청 " + picked.length + "건을 보낼까요? " + picked.join(", ")));
        cf.appendChild(el("span", "dc6-sim", "시뮬레이션: 작업자, 팀, 로봇에 연락하지 않아요."));
        var yes = btn("요청 확인", "is-pri", function () { cf.remove(); request(a, picked); });
        cf.appendChild(btnRow(yes, btn("취소", "", function () { cf.remove(); paintActs(); req.focus(); })));
        d.appendChild(cf);
        paintActs();
        yes.focus();
      });
      req.setAttribute("data-dc6-req", "1");
      d.appendChild(btnRow(req, mapBtn(a)));
      m.node.appendChild(d);
      finish(m);
      paintActs();
      return m;
    }

    function location(a) {
      var m = msg("location", a, "위치", a.eq);
      var d = el("div", "dc6-card");
      d.appendChild(el("p", "dc6-eq", a.eq || a.title));
      var dl = el("dl", "dc6-dl");
      [["미션", missionLine(a), missionNode(a)], ["지점", wpNo(a)], ["측정", c.robotName(a) + ", " + c.hhmm(a.time)]].forEach(function (r) {
        if (!r[1]) { return; }
        dl.appendChild(el("dt", null, r[0]));
        var dd = el("dd", null, r[2] ? null : r[1]);
        if (r[2] && tok()) { dd.appendChild(r[2]); } else if (r[2]) { dd.textContent = r[1]; }
        dl.appendChild(dd);
      });
      d.appendChild(dl);
      d.appendChild(btnRow(btn("위치 보기", "is-pri", open(a)), btn("상세 확인", "", open(a))));
      m.node.appendChild(d);
      return finish(m);
    }
    function others() {
      var ord = ordered(), top = ord[0], n = counts(ord);
      var rest = ord.filter(function (a) { return a.sev === "critical" && a !== top; });
      var m = msg("others", null, "다른 위험", "위험 " + rest.length + "건");
      text(m, rest.length ? "먼저 확인할 항목 말고 위험 " + rest.length + "건이 더 있어요." : "먼저 확인할 항목 말고 다른 위험은 없어요. 주의는 " + n.w + "건이에요.");
      if (rest.length) { m.node.appendChild(rows(m, rest)); }
      return finish(m);
    }
    function count() {
      var ord = ordered(), n = counts(ord);
      var m = msg("count", null, "알림 수");
      text(m, "위험 " + n.c + "건, 주의 " + n.w + "건이에요.");
      var crit = ord.filter(function (a) { return a.sev === "critical"; });
      if (crit.length) { m.node.appendChild(rows(m, crit)); }
      return finish(m, "others");
    }
    function plain(type, title, t, b) {
      var m = msg(type, null, title);
      text(m, t);
      if (b) { m.node.appendChild(btnRow(b)); }
      return finish(m, "other");
    }

    function target(q) {
      var all = A().all || [];
      var hit = all.filter(function (a) { return a.eq && c.norm(q).indexOf(c.norm(a.eq)) >= 0; })[0];
      if (hit) { return hit; }
      if (lastTarget && isOpenAlert(lastTarget)) { return lastTarget; }
      return ordered()[0] || null;
    }
    // 답한 블록을 돌려준다. 이 판이 맡지 않는 말(보내기 · 추세 · 이력 · 주의 묶음)은 null — delta-chat.js 의 답으로 간다
    function answer(q) {
      lastQ = q;
      if (/보고서|메일|전송|보내|추세|이력|묶/.test(q)) { lastType = "other"; paintSugg(); return null; }
      var hit = INTENTS.filter(function (x) { return x[1].test(q); })[0];
      var intent = hit ? hit[0] : "fallback";
      var t = target(q);
      if (["why", "cause", "actions", "location"].indexOf(intent) >= 0 && !t) { intent = "priority"; }
      // 같은 알림에 "왜"를 다시 물으면 빠진 쪽(어떻게)을 답한다(라이팅 시스템 11)
      if (intent === "cause" && lastType === "cause" && lastTarget === t) { intent = "actions"; }
      if (intent === "priority") { return priority(false); }
      if (intent === "why") { return why(t); }
      if (intent === "cause") { return cause(t); }
      if (intent === "actions") { return actions(t); }
      if (intent === "location") { return location(t); }
      if (intent === "others") { return others(); }
      if (intent === "count") { return count(); }
      var n = counts(ordered());
      if (intent === "greet") {
        return plain("greet", "Delta", "안녕하세요. " + (n.c ? "지금 위험이 " + n.c + "건 있어요." : n.w ? "지금 주의가 " + n.w + "건 있어요." : "지금은 알림이 없어요."),
          btn("처리 순서 보기", "is-pri", function () { c.ask("뭐부터 처리해?"); }));
      }
      return plain("fallback", "답할 수 없어요", "지금 데이터로는 답할 수 없는 질문이에요. Delta는 열린 알림의 원인, 조치, 위치, 처리 순서를 답할 수 있어요.");
    }

    function paintSugg(busy) {
      chips.textContent = "";
      sugg.hidden = !!busy || !c.thread();
      if (sugg.hidden) { return; }
      (SUGG[lastType] || SUGG.other).filter(function (t) { return t !== lastQ; }).slice(0, 3).forEach(function (t) {
        var b = el("button", "dc6-q", t);
        b.type = "button";
        b.addEventListener("click", function () { c.ask(t); });
        chips.appendChild(b);
      });
    }

    // 새 알림 — 배너 없이 대화 안에서. 판이 통째로 바뀌는 시연(단계 전환)은 시스템 한 줄이 맡는다
    function keyOf(a) { return (a.title || "") + "|" + (a.time || ""); }
    function atEnd() { var th = c.thread(); return !th || th.scrollTop + th.clientHeight >= th.scrollHeight - 24; }
    function hideJump() { jump.hidden = true; jumpTo = null; jumpN = 0; }
    // 읽던 자리를 끌어내리지 않는다 — add 는 맨 아래로 내려가므로 대화 칸에 바로 붙인다
    function put(node) { c.thread().appendChild(node); }
    function announce(a) {
      var end = atEnd(), mark = null;
      if (!unread) {
        mark = el("div", "dc6-unread");
        mark.appendChild(el("span", null, "새 알림"));
        msgs.forEach(function (x) { x.node.classList.add("is-old"); });
        put(mark);
        unread = true;
      }
      var top = ordered()[0], word = a.sev === "critical" ? "위험" : "주의";
      var same = (A().all || []).filter(function (x) { return x.sev === a.sev; }).length;
      var m = msg("alert", a, label(a));
      m.node.classList.add("dc6-new", "is-" + a.sev);
      var topName = top ? (top.eq || top.title) : "";
      text(m, top === a ? "이 항목부터 확인하세요." : (top ? "먼저 확인할 항목은 그대로 " + topName + (c.batchim(topName) ? "이에요. " : "예요. ") : "") + "지금 " + word + " " + same + "건이에요.");
      var d = el("div", "dc6-card");
      if (a.sum) { d.appendChild(el("p", "dc6-desc", a.sum)); }
      // [11/05] 위치와 시각 줄은 뺐다(먼저 확인할 항목 카드와 같다)
      d.appendChild(btnRow(detailBtn(a), btn("처리 순서 보기", "", function () { c.ask("뭐부터 처리해?"); })));
      m.node.appendChild(d);
      lastType = "alert";
      lastTarget = a;
      lastQ = null;
      put(m.node);
      paintSugg();
      stampNow();
      if (end) { toTop(mark || m.node); return; }
      jumpTo = jumpTo || mark || m.node;
      jumpN += 1;
      jump.textContent = "새 " + word + " " + jumpN + "건";
      jump.className = "dc6-jump is-" + a.sev;
      jump.hidden = false;
    }
    jump.addEventListener("click", function () { if (jumpTo) { toTop(jumpTo); } hideJump(); });

    function severity() {
      var all = A().all || [];
      msgs.forEach(refresh);
      if (seen && c.thread()) {
        var added = all.filter(function (a) { return seen.indexOf(keyOf(a)) < 0; });
        if (added.length && added.length <= 2) { added.forEach(announce); }
      }
      seen = all.map(keyOf);
      stampNow();
    }
    document.addEventListener("aprism:severity", function () { setTimeout(severity, 0); });
    setTimeout(severity, 0);

    return {
      anchor: anchor,   // 대화 칸은 이 앞에 놓인다 — 대화 · 추천 질문 · 입력 칸 차례
      // 처음 펼칠 때 — 접힘 요약이 그대로 "현재 관제 요약"이 된다
      first: function () { if (!msgs.length) { priority(true); } },
      // 접힘 답 단추의 "처리 순서 보기"는 창을 열며 묻는다 — 막 펼친 요약이 이미 그 답이다
      skip: function (q) { return msgs.length === 1 && !lastQ && /순서/.test(q); },
      answer: answer,
      busy: function () { stamp.textContent = "분석 중"; paintSugg(true); },
      settle: function () { stampNow(); paintSugg(); },
      read: function () { unread = false; hideJump(); },
      reset: function () { msgs.length = 0; lastType = lastQ = lastTarget = null; unread = false; hideJump(); sugg.hidden = true; stamp.textContent = ""; }
    };
  };
})();
