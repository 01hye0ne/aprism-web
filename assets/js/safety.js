/*
 * 안전진단(GNB [안전진단]) — v5 · 10/29 디자이너 와이어프레임 "UI_전주기 안전진단 탭"(artifact 56NnnFUgW1c1Wn2Nm2ZxPE)을 옮겼다.
 *
 * 화면 논리(감지 6종 카드 · 표 · 자세히 보기 · 미션 레일 · 2D 지도)는 시안 그대로다. 바꾼 것:
 *   · 1920 판을 화면에 맞춰 줄이던 무대(__fit)를 걷고 v5 앱 틀(상태바 · GNB · 본문 판)에 넣었다
 *   · 상단 경로는 관제와 같은 상태바 부품(.sb-overview › .scope-trigger · .dropdown-menu)으로 그린다
 *   · 시안 조작 단추(시연 · 미션 고르기 시안 · 라이트/다크)는 뺐다 — 테마는 상태바 단추(theme.js), 레일은 확정안(세로 레일)
 *     시연(다른 미션에 새 위험)은 콘솔에서 APRISM_SAFETY.fire() · reset()
 *   · 2D 지도 · 카드 안 인라인 색을 지우고 CSS(토큰)가 칠한다 — 라이트 · 다크가 토큰으로 따라간다
 *   · 돌아가기 · 현장 조치 요청은 .btn, AI 추천 · 라이브는 .badge, 메모는 실제 입력칸
 * 색 · 글자 · 간격은 assets/css/safety.css 맨 위에 적었다.
 */
(function(){
  /* 상태바 계정 · 통신 드롭다운 — app-shell.css 의 .status-menu 짜임(알림 센터와 같다) */
  (function statusMenus(){
    const menus = Array.from(document.querySelectorAll('[data-status-menu]'));
    const close = except => menus.forEach(m => { if(m === except) return; m.querySelector('[data-menu-trigger]').setAttribute('aria-expanded', 'false'); m.querySelector('.dropdown-menu').hidden = true; });
    menus.forEach(m => { const t = m.querySelector('[data-menu-trigger]'), d = m.querySelector('.dropdown-menu');
      t.addEventListener('click', e => { e.stopPropagation(); const open = t.getAttribute('aria-expanded') === 'true'; close(m); t.setAttribute('aria-expanded', open ? 'false' : 'true'); d.hidden = open; }); });
    document.addEventListener('click', () => close());
    document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
  })();

  // 확정 C 화면 기준: 미션이 여럿이면 인덱스가 늘 있음(펼침/접힘은 관제사가 고름). 상단 바와 인덱스는 같은 선택
  const K = ['안전감지','누출감지','온도감지','계기인식','이상음향','부분방전'];
  // [10/30] 감지 사진 — 다른 작업자가 준 프로토타입 이미지(assets/source/프로토타입용 이미지, 1280×720 16:9). 감지마다 정상 · 주의 · 위험 세 장.
  //   열화상 색 · 음향 히트맵 · PRPD 그래프 · 감지 상자 · 얼굴 모자이크가 그림에 이미 들어 있어 CSS 필터 · 상자 · 스펙트로그램 캔버스를 걷었다.
  //   요청됨(done)은 주의 사진, 예정 · 판정 안 함은 정상 사진.
  const MDF = {'안전감지':'safety_%.jpg','누출감지':'leak_%.jpg','온도감지':'temp_%.jpg','계기인식':'gauge_%.jpg','이상음향':'sound_%.jpg','부분방전':'pd_%.png'};
  // [10/30] 미션마다 다른 사진 — 같은 감지 · 같은 판정이 두 미션에 있으면 뒤 미션은 제 사진(MV, 키 '미션 번호|감지|판정').
  //   0 정기 순회 점검은 기본(MDF), 1 전기실 열화상 점검 · 2 발전기실 설비 점검에서 겹치던 칸만 새로 만든 그림을 쓴다.
  const MV = {'1|부분방전|warn':'m1_pd_warn.png', '2|온도감지|warn':'m2_temp_warn.jpg', '2|이상음향|ok':'m2_sound_ok.jpg', '2|안전감지|ok':'m2_safety_na.jpg'};
  const MD = (k, st, mi) => { const s3 = st==='crit' ? 'crit' : st==='warn' || st==='done' ? 'warn' : 'ok';
    return ['', `<img src="../assets/img/safety/${MV[mi + '|' + k + '|' + s3] || MDF[k].replace('%', s3)}" alt="">`]; };

  // 연관 감지 근거(시안용 예시): 계통 정보와 함께 움직이는 감지 짝. [원인 쪽 감지, 영향 쪽 감지, 근거, 가능성]
  const LINKS = {0:[
    ['이상음향', '온도감지', '같은 펌프 P-2. 베어링 이상음이 발열로 이어질 수 있다', '높음'],
    ['온도감지', '누출감지', '같은 냉각수 계통. WP-05 펌프 온도가 오르면 WP-03 밸브 이음부 압력이 오른다', '높음'],
    ['부분방전', '온도감지', '같은 펌프 전원. WP-06 수배전반 방전이 WP-05 펌프 모터 발열로 이어질 수 있다', '보통']],
    2:[['온도감지', '누출감지', '같은 급수 계통. WP-B09 펌프 모터 과열이 분기부 압력 변동으로 이어질 수 있다', '보통']]};
  const BASE = [
    // [10/30] 관제 v5 와 같은 데이터 — Robot 01 · 지하 4층 · WP-01~20 중 7곳 측정(WP-08 로 가는 중). 감지 6종 = 관제 최신 알림 6건(monitor.js R01_MORE)
    {mis:'정기 순회 점검', fl:'지하 4층', ab:'B4', robot:'Robot 01', done:7, total:20, r:{
      '안전감지':['crit','안전벨트 미착용 1명','WP-07 고소 작업 발판','10:16'],
      '누출감지':['warn','미세 누출 1곳','WP-03 냉각수 배관 밸브','10:11'],
      '온도감지':['warn','최고 48.6 ℃','WP-05 냉각 펌프 P-2','10:14'],
      '계기인식':['crit','압력 0.86 MPa','WP-04 N₂ 배관 압력계','10:12'],
      '이상음향':['warn','이상 점수 20.4','WP-05 냉각 펌프 P-2','10:13'],
      '부분방전':['warn','CH1 이상 점수 9.05','WP-06 수배전반 MCC-1','10:15']}},
    // [10/30] 미션 이름 · 로봇 · 층 · 진행을 관제(screen.js · building.js)의 수행중 미션에 맞췄다 — 예전 '설비 순회 · 1층 · Robot 02', '배관 순회 · Robot 03'.
    //   전기실 열화상 점검 = Robot 11 · 지하 3층 · 3/20(WP-03 → WP-04 가는 중). 지점 번호도 진행에 맞춰 WP-102 · 103(새 결과 104)으로 당겼다.
    {mis:'전기실 열화상 점검', fl:'지하 3층', ab:'B3', robot:'Robot 11', done:3, total:20, r:{
      '안전감지':['ok','정상 범위','측정 3곳'], '누출감지':['ok','정상 범위','측정 2곳'], '온도감지':['ok','정상 범위','측정 3곳'],
      '계기인식':['warn','압력 0.84 MPa','WP-102 압력계 PG-A3','10:01'],
      '이상음향':['ok','정상 범위','측정 2곳'],
      '부분방전':['warn','CH1 이상 점수 9.05','WP-103 수배전반','09:58']}},
    //   발전기실 설비 점검 = Robot 05 · 지하 3층(WP-01~12) → 계단 → 지하 4층(WP-13~20) · 13/20, 지금 지하 4층(관제 지도 층 건너기 예시).
    {mis:'발전기실 설비 점검', fl:'지하 3층, 지하 4층', ab:'B3', fls:[['B3','지하 3층',12],['B4','지하 4층',20]], robot:'Robot 05', done:13, total:20, na:{'안전감지':'scope','부분방전':'sensor'}, r:{
      '안전감지':null, '누출감지':['crit','누출 확률 81%','WP-B04 급수 배관 분기부','09:21'],
      '온도감지':['warn','최고 41.8 ℃','WP-B09 급수 펌프 모터','10:09'], '계기인식':['ok','정상 범위','측정 3곳'], '이상음향':['ok','정상 범위','측정 4곳'], '부분방전':null}}
  ];
  const NEWR = [1, '온도감지', ['crit','최고 71.2 ℃','WP-104 변압기 TR-1','10:15']];
  const RANK = {crit:3, warn:2, done:1, ok:0};
  const WORD = {crit:'위험', warn:'주의', done:'요청됨', ok:'정상 범위', plan:'예정'};
  const COLR = {crit:'var(--status-critical-icon)', warn:'var(--status-warning-icon)', done:'var(--text-tertiary)', ok:'var(--text-disabled)'};
  let M, scope, menu, fired, toasts, drawer, newSeen, lay = 'card', dt = null, bigD = false;
  const COND = {'안전감지':null,'누출감지':[0,100,55,70,'%'],'온도감지':[18,90,40,55,' ℃'],'계기인식':null,'이상음향':[0,30,19,22.8,''],'부분방전':[0,10,8.6,9.23,'']};
  const SUG = {'안전감지':['작업자에게 즉시 착용을 안내하고 고소 작업을 멈춰야 함',[['작업자 즉시 착용 안내',1,'현장 작업자, 무전 2채널'],['고소 작업 일시 중지',1,'작업 감독자, 내선 2214'],['안전관리팀 전달',0,'안전관리팀, 업무 메신저']]],
    '누출감지':['구역 출입을 통제하고 설비팀에 밸브 확인을 요청해야 함',[['구역 출입 통제',1,'현장 작업자, 무전 2채널'],['설비팀 밸브 확인 요청',1,'설비팀, 내선 2310'],['현장 확인',0,'순회 근무자, 무전 1채널']]],
    '온도감지':['부하를 줄이고 점검을 요청해야 함',[['부하 감소 요청',1,'운전원, 내선 2201'],['설비 점검 요청',1,'설비팀, 내선 2310'],['현장 확인',0,'순회 근무자, 무전 1채널']]],
    '계기인식':['계측팀에 계기 교정을 요청해야 함',[['계기 교정 요청',1,'계측팀, 내선 2420'],['운전원 수동 판독 요청',0,'운전원, 내선 2201']]],
    '이상음향':['진동 정밀 측정을 요청해야 함',[['진동 정밀 측정 요청',1,'설비팀, 내선 2310'],['설비 정지 검토 요청',0,'운전원, 내선 2201']]],
    '부분방전':['절연 진단을 요청하고 전기팀에 알려야 함',[['절연 진단 요청',1,'전기팀, 내선 2405'],['감시 강화',1,'전기팀, 업무 메신저']]]};
  // [10/30] 정기 순회 점검 계기인식은 위험(NG) — 관제 알림의 AI 추천(작업 중지)과 같은 조치
  const SUG0 = {'계기인식':['현장에 작업 중지를 요청해야 함',[['현장 무전 연락, 작업 중지 요청',1,'현장 작업자, 무전 2채널'],['로봇 정지, 현장 점검 요청',1,'설비팀, 내선 2310'],['재측정 후 판단',0,'순회 근무자, 무전 1채널']]]};
  // 자세히 보기: 좌측 지도 + 지점 × 6종, 가운데 판정과 근거, 오른쪽 조치
  function detail(){
    const {mi, k} = dt, m = M[mi], x0 = m.r[k], {sp, now, rows} = eData(mi);
    const cellOf = (k2, w) => { const r = rows.find(r2 => r2.n===k2); return r ? r.c[w] : undefined; };
    const hitWp = x0[0] !== 'ok' ? x0[2].split(' ')[0] : null;
    const wp = dt.w || hitWp || (sp.find(p => { const c = cellOf(k, p[0]); return c && c[0]==='ok'; }) || sp[0])[0];
    const its = itemsOf(mi, k).filter(it => it[0] !== 'ok'), hx = its.find(it => wpOf(it)===wp);
    const isHit = !!hx, here = cellOf(k, wp), spi = sp.find(p => p[0]===wp) || [wp, ''];
    const x = isHit ? hx : [here && here[0]==='plan' ? 'plan' : 'ok', here && here[1] ? here[1] : '정상 범위', wp, spi[1]];
    const st = x[0];
    const tabs = K.map(k2 => { const y = m.r[k2]; if(!y) return `<span class="tb na">${k2}</span>`; const s2 = y[0]==='ok' ? '' : y[0];
      return `<button type="button" class="tb ${k2===k ? 'on' : ''}" data-dk="${k2}">${k2}<i class="d ${s2}"></i></button>`; }).join('');
    // [10/30] 안전감지(안전모 · 안전벨트 착용)는 히트맵 칸이 없다 — 원본만 크게
    const md = MD(k, st, mi), canBig = !md[1].includes('canvas'), heat = k !== '안전감지';
    const media = bigD && canBig ? `<div class="dmw ${heat ? 'two' : ''}"><div class="md ${md[0]}">${md[1]}<span class="dlab">원본</span></div>${heat ? `<div class="md hm ${md[0]}">${md[1].replace(/<span class="bx"[^>]*><\/span>/, '')}<span class="heat"></span><span class="dlab">히트맵</span></div>` : ''}<button type="button" class="bigb on" data-bigd="1">원본 크게 끄기</button></div>`
      : `<div class="dmw"><div class="md ${md[0]}">${md[1]}</div>${canBig ? `<button type="button" class="bigb" data-bigd="1">${heat ? '원본과 히트맵 크게' : '원본 크게'}</button>` : ''}</div>`;
    const cd = COND[k], num = parseFloat(SHORT[x[1]] || x[1]);
    const cond = !isHit ? `<span class="why1">기준: ${STD[k]}</span>` : cd && !isNaN(num) ? (() => { const [lo, hi, w2, c2, u] = cd, p = q => Math.max(0, Math.min(100, (q - lo) / (hi - lo) * 100)).toFixed(1);
        return `<span class="sm2 ${st}">${x[1].includes(String(num)) ? '' : num + u + ', '}${num >= c2 ? '위험 기준 ' + c2 + u + ' 초과' : '주의 기준 ' + w2 + u + ' 초과'}</span><div class="trk"><span class="f ${st}" style="width:${p(num)}%"></span><span class="m w" style="left:${p(w2)}%"><span>주의 ${w2}${u}</span></span><span class="m c" style="left:${p(c2)}%"><span>위험 ${c2}${u}</span></span></div><span class="why1">기준: ${STD[k]}</span>`; })()
      : `<span class="why1">기준: ${STD[k]}</span>`;
    const SG = (mi===0 && SUG0[k]) || SUG[k];
    const prevAct = (SG ? SG[1][0][0] : '현장 조치').replace(/ 요청$/, '') + ' 요청';
    const nowAct = !isHit ? (st==='plan' ? '' : '조치 없음') : st==='done' ? (x[4] || '10:17') + ' 현장 조치 요청됨' : '';
    const hist = !isHit ? [['10/22 09:00','정상 범위','ok','조치 없음'],['10/22 14:00','정상 범위','ok','조치 없음'],['10/23 09:00','정상 범위','ok','조치 없음'],['오늘 ' + (x[3] || ''), st==='plan' ? '측정 전' : x[1], st, nowAct]] : [['10/22 09:00','정상 범위','ok','조치 없음'],['10/22 14:00','정상 범위','ok','조치 없음'],['10/23 09:00', st==='warn' ? '주의' : '정상 범위', st==='warn' ? 'warn' : 'ok', st==='warn' ? '09:14 ' + prevAct : '조치 없음'],['오늘 ' + x[3], SHORT[x[1]] || x[1], st, nowAct]];
    const again = '';
    const rel = K.filter(k2 => k2 !== k && m.r[k2] && (m.r[k2][0]==='crit' || m.r[k2][0]==='warn'));
    const sug = SG;
    const side = !isHit ? `<div class="donec"><b>${st==='plan' ? '아직 측정 전' : '조치 필요 없음'}</b><span>${st==='plan' ? '로봇이 도착하면 결과가 표시됨' : '정상 범위의 측정값'}</span></div>` : st==='done' ? `<div class="donec"><b>${x[4] || '10:17'} 현장 조치 요청됨</b><span>재측정에서 다시 넘으면 다시 표시</span></div>`
      : `<div class="dl"><div class="hh"><span><span class="dlogo" aria-hidden="true"></span>DELTA 조치 제안</span><span>오탐 가능성 <b>낮음</b></span></div><div class="ti">${sug[0]}</div>
        <div class="cks">${sug[1].map(([l, a2, to]) => `<label class="c1x"><input type="checkbox" ${a2 ? 'checked' : ''}><span><b>${l}</b><small>${to}</small></span>${a2 ? '<em class="badge badge-mode badge-info t-caption">AI 추천</em>' : ''}</label>`).join('')}</div>
        <label class="mm" for="sfMemo">메모 (선택)</label><textarea class="fd" id="sfMemo" rows="2" placeholder="현장에 전달할 내용"></textarea></div><button type="button" class="btn btn-accent rqx" data-req="1">현장 조치 요청</button>`;
    const step = q => `<div class="sth"><b>${q}</b></div>`;   // [v5 점검] 번호 원을 뺐다 — 배치가 동시에 보는 격자라 순서를 강요하지 않는다(위계는 판 밝기가 말한다)
    const lks = (LINKS[dt.mi] || []).filter(l => l[0]===k || l[1]===k).map(l => { const k2 = l[0]===k ? l[1] : l[0], y = m.r[k2]; return y && (y[0]==='crit' || y[0]==='warn') ? {k2, y, w2:y[2].split(' ')[0], role:l[0]===k ? '영향 후보' : '원인 후보', why:l[2], p:l[3]} : null; }).filter(Boolean);
    const rest = rel.filter(k2 => !lks.some(l => l.k2===k2));
    const lkRow = l => `<button type="button" class="rlx lk" data-dk="${l.k2}" data-dw="${l.w2}" data-rel="1"><span class="rlt"><span class="pl ${l.y[0]}">${WORD[l.y[0]]}</span><b>${l.k2}</b><span>${l.w2}</span><em class="rr r0">${l.role}</em><small class="lp">가능성 ${l.p}</small><span class="t">${SHORT[l.y[1]] || l.y[1]}</span></span><span class="rwhy">${l.why}</span></button>`;
    const restRow = k2 => { const y = m.r[k2], w2 = y[2].split(' ')[0]; return `<button type="button" class="rlx" data-dk="${k2}" data-dw="${w2}" data-rel="1"><span class="pl ${y[0]}">${WORD[y[0]]}</span><b>${k2}</b><span>${w2}</span><span class="t">${SHORT[y[1]] || y[1]}</span></button>`; };
    const relB = (lks.length ? `<div class="rl b">${lks.map(lkRow).join('')}</div>` : '<span class="why1">연관 근거가 있는 감지 없음</span>');
    const relHead = `<div class="sth"><b>연관 감지</b><span class="qt" tabindex="0" role="button" aria-label="연관 감지 설명">?<span class="tip" role="tooltip">DELTA가 같은 계통 정보와 함께 움직이는 감지 짝으로 고른 연관 후보다. 확정된 원인이 아니라 판단을 돕는 참고용 가설이다. 시안의 계통 정보는 예시 값이다.</span></span></div>`;
    dt.wp = wp; dt.lk = lks.map(l => l.w2);   // 왼쪽 패널 지도가 이 지점과 연관 지점을 표시한다(sideHtml)
    const loc = `<p class="loc"><b>${wp}</b>${isHit ? '<span>' + x[2].split(' ').slice(1).join(' ') + '</span>' : ''}<span class="lm">${m.fl}, ${m.robot}${x[3] ? ' 측정 ' + x[3] : ''}</span></p>`;
    return `<div class="dtop"><button type="button" class="btn btn-secondary bkx" data-dback="1"><span class="i i-16" style="--i:var(--ic-chevron-left)" aria-hidden="true"></span>돌아가기</button><div class="tbs">${tabs}</div></div>
      <div class="dB">
        <div class="dBm">
          <div class="lvA s1 ${st}">${step('이상 판정')}<div class="tt"><span class="pl ${st}">${WORD[st]}</span><h5>${k}, ${isHit ? x[1] : st==='plan' ? '측정 전' : '정상 범위 ' + x[1]}</h5></div>${loc}${cond}</div>
          <div class="dBr2">
            <div class="lvA s2">${step('영상 확인')}${!isHit ? '<span class="why1">시안용 예시 이미지(같은 감지의 사진)</span>' : ''}${media}</div>
            <div class="dBc"><div class="lvB">${step('재발 여부')}<div class="hist">${hist.map(([t, val, s2, a], n) => `<div class="hi ${n===3 ? 'now' : ''}"><span class="t">${t}</span><span>${val}</span><span class="pl ${s2}">${WORD[s2]}</span><span class="hia ${a && a !== '조치 없음' ? 'on' : ''}">${a}</span></div>`).join('')}</div>${again}</div>
              <div class="lvB s4 ref">${relHead}${relB}</div></div>
          </div>
        </div>
        <div class="lvD">${step('조치 결정')}${side}</div>
      </div>${dt.from ? `<div class="rtbar" role="group" aria-label="동시 발생에서 이동함"><span class="ri" aria-hidden="true">↩</span><button type="button" class="rtb" data-dret="1">${dt.from.k}로 돌아가기</button><button type="button" class="rtx" data-dretx="1" aria-label="돌아가기 닫기">✕</button></div>` : ''}`;
  }
  const STD = {'안전감지':'미착용 0명','누출감지':'55% 미만','온도감지':'40 ℃ 미만','계기인식':'0.60 ~ 0.80 MPa','이상음향':'19.0 미만','부분방전':'8.60 미만'};
  const SHORT = {'안전벨트 미착용 1명':'1명','안전모 미착용 1명':'1명','미세 누출 1곳':'62%','최고 48.6 ℃':'48.6','압력 편차 1건':'0.79','압력 0.86 MPa':'0.86','이상 점수 20.4':'20.4','CH1 이상 점수 9.05':'9.05','압력 0.84 MPa':'0.84','누출 확률 81%':'81%','최고 41.8 ℃':'41.8','최고 71.2 ℃':'71.2'};
  const cellV = x => `<span class="tv ${x[0]}">${SHORT[x[1]] || x[1]}</span>`;
  // 표: 미션 하나 = 행 감지 × 열 지점(위 E 표와 같은 축), 전체 = 행 감지 × 열 미션
  // 미션의 지점(시안용): 넘은 지점 + 나머지 측정 지점 + 예정 지점, 지점 번호 순
  function spotsOne(i){
    const m = M[i], fl = {};
    K.forEach(k => { const x = m.r[k]; if(x && x[0] !== 'ok'){ const wp = x[2].split(' ')[0]; (fl[wp] = fl[wp] || {t:x[3], ks:{}}).ks[k] = x; } });
    const any = Object.keys(fl)[0] || 'WP-001', pre = any.slice(0, -2);
    const id = n => pre + String(n).padStart(2, '0');
    const meas = new Set(Object.keys(fl)); let n = 1;
    while(meas.size < m.done){ if(!fl[id(n)]) meas.add(id(n)); n++; }
    const plan = []; while(plan.length < m.total - m.done){ if(!meas.has(id(n))) plan.push(id(n)); n++; }
    const list = [...meas].sort().map(w => ({w, t:fl[w] ? fl[w].t : '', ks:fl[w] ? fl[w].ks : {}, plan:false})).concat(plan.map(w => ({w, t:'', ks:{}, plan:true})));
    return list;
  }
  // 미션 하나의 표 = 위 확정 E 표와 같은 모양(행 감지, 열 순회 순서의 지점, 지금 지점 강조, DELTA 메모)
  const E_SP0 = [['WP-01','09:31','Robot 01'],['WP-02','09:52','Robot 01'],['WP-03','10:11','Robot 01'],['WP-04','10:12','Robot 01'],['WP-05','10:14','Robot 01'],['WP-06','10:15','Robot 01'],['WP-07','10:16','Robot 01'],['WP-08','10:20','Robot 01',1],['WP-09','10:24','Robot 01',1]], E_NOW0 = 'WP-07', E_ROWS0 = [
    {n:'안전감지', src:'영상', s:'crit', rep:'1명', wp:'WP-07', std:'미착용 0명', memo:'WP-07 고소 작업 발판 안전벨트 미착용', c:{'WP-01':['ok','0명'],'WP-04':['ok','0명'],'WP-07':['crit','1명']}},
    {n:'누출감지', src:'영상 + 열화상', s:'warn', rep:'62%', wp:'WP-03', std:'55% 미만', memo:'같은 냉각수 계통 WP-05 온도, 음향도 기준 초과', c:{'WP-03':['warn','62%'],'WP-04':['ok','9%'],'WP-05':['ok','12%'],'WP-09':['plan']}},
    {n:'온도감지', src:'열화상', s:'warn', rep:'48.6 ℃', wp:'WP-05', std:'40 ℃ 미만', memo:'평소 36.2 ℃ 대비 +12.4 ℃', c:{'WP-01':['ok','29.8'],'WP-02':['ok','31.4'],'WP-03':['ok','30.2'],'WP-04':['ok','32.1'],'WP-05':['warn','48.6'],'WP-06':['ok','33.0'],'WP-08':['plan']}},
    {n:'계기인식', src:'영상', s:'crit', rep:'0.86 MPa', wp:'WP-04', std:'0.60 ~ 0.80', memo:'N₂ 배관 압력 상한 초과, 최근 3회 잇달아 오름', c:{'WP-02':['ok','0.71'],'WP-04':['crit','0.86'],'WP-09':['plan']}},
    {n:'이상음향', src:'마이크', s:'warn', rep:'20.4', wp:'WP-05', std:'19.0 미만', memo:'저주파 대역 에너지 증가, 베어링 마모 패턴과 비슷', c:{'WP-01':['ok','8.2'],'WP-05':['warn','20.4'],'WP-06':['ok','7.6'],'WP-08':['plan']}},
    {n:'부분방전', src:'PD 센서', s:'warn', rep:'9.05', wp:'WP-06', std:'8.60 미만', memo:'CH1만 주의, CH2와 CH3은 정상 범위', c:{'WP-06':['warn','9.05']}},
  ];
  const SRC = {'안전감지':'영상','누출감지':'영상 + 열화상','온도감지':'열화상','계기인식':'영상','이상음향':'마이크','부분방전':'PD 센서'};
  const OKV = {'안전감지':'0명','누출감지':'9%','온도감지':'31.0','계기인식':'0.71','이상음향':'7.9','부분방전':'6.4'};
  const MEMO = {'1|온도감지':'10:15 새로 넘음, 직전 순회보다 +18.9 ℃','1|계기인식':'PG-A3 상한 초과, 계기 점검 필요','1|부분방전':'CH1만 주의, 같은 전기 계통 변압기 과열','2|누출감지':'지하 3층 순회 끝, 13:00 전까지 다시 못 잼. CCTV 사각 구간','2|온도감지':'지하 3층에서 측정, 평소보다 +6.3 ℃'};
  function eData(i){
    if(i===0){ const m = M[0];
      const rows = E_ROWS0.map(r => { const x = m.r[r.n], c = Object.assign({}, r.c);
        if(m.rs && m.rs[r.n]) m.rs[r.n].forEach(it => { c[wpOf(it)] = [it[0], SHORT[it[1]] || it[1]]; });
        else if(x && x[0] !== 'ok' && c[wpOf(x)]) c[wpOf(x)] = [x[0], c[wpOf(x)][1]];
        return Object.assign({}, r, {s:x ? x[0] : r.s, c}); });
      return {sp:E_SP0, now:E_NOW0, rows}; }
    const m = M[i], list = spotsOne(i);
    let tt = 9 * 60 + 50; const sp = list.map(p => { const t = p.t || (String(Math.floor(tt / 60)).padStart(2, '0') + ':' + String(tt % 60).padStart(2, '0')); tt += 4; return [p.w, t, m.robot, p.plan ? 1 : 0]; });
    sp.sort((x, y) => x[3] - y[3] || (x[1] < y[1] ? -1 : 1));
    const meas = sp.filter(x => !x[3]), now = m.done < m.total && meas.length ? meas[meas.length - 1][0] : '';
    const rows = K.map((k, ki) => { const x = m.r[k]; if(!x){ const why = naOf(i, k); return {n:k, src:SRC[k], s:'na', na:why, std:STD[k], memo:why==='sensor' ? m.robot + '에 센서가 달려 있지 않음' : '이 미션에서 판정하지 않음', c:{}}; }
      const c = {}, cnt = x[0]==='ok' ? (parseInt(x[2].replace(/\D/g, '')) || 3) : 3; let n = 0;
      sp.forEach(([w, , , pl], si) => { const hit = x[0] !== 'ok' && x[2].startsWith(w);
        if(hit){ c[w] = [x[0], SHORT[x[1]] || x[1]]; n++; return; }
        if((si + ki) % 2) return;
        if(pl){ c[w] = ['plan']; return; }
        if(n < cnt){ c[w] = ['ok', OKV[k]]; n++; } });
      return {n:k, src:SRC[k], s:x[0], std:STD[k], memo:x[0]==='ok' ? '모두 정상 범위' : (MEMO[i + '|' + k] || ''), c}; }).filter(Boolean);
    return {sp, now, rows};
  }
  function tableOne(i){
    const {sp, now, rows} = eData(i);
    const head = `<tr><th class="c-n">감지</th><th>판정</th><th>기준</th>${sp.map(([w, t, r, p]) => `<th class="c-wp ${w===now ? 'now' : ''} ${p ? 'plan' : ''}" data-col="${w}"><b>${w}</b><span>${p ? '예정 ' : ''}${t}</span><span class="rb">${r}</span></th>`).join('')}<th class="c-m dmh"><span class="dlogo"><i></i><i></i><i></i></span>DELTA 메모</th></tr>`;
    const body = rows.map(r => `<tr class="r-${r.s}"><td class="c-n"><span class="bar"></span><b>${r.n}</b><span class="src">${r.src}</span></td>
      <td><span class="pl ${r.s}">${r.s==='na' ? NAW[r.na] : WORD[r.s]}</span></td><td class="c-std">${r.std}</td>
      ${sp.map(([w]) => { const v = r.c[w], cls = `c-wp ${w===now ? 'now' : ''}`;
        if(!v) return `<td class="${cls}" data-col="${w}"><i class="nil"></i></td>`;
        if(v[0]==='plan') return `<td class="${cls}" data-col="${w}"><span class="cv plan">예정</span></td>`;
        return `<td class="${cls}" data-col="${w}"><span class="cv ${v[0]}" data-dk="${r.n}" data-dm="${i}" data-dw="${w}"><i></i>${v[1]}</span></td>`; }).join('')}
      <td class="c-m">${r.s==='na' ? r.memo : '<span class="dmm"><span class="dlogo"><i></i><i></i><i></i></span><span>' + r.memo + '</span></span>'}</td></tr>`).join('');
    return `<div class="ewrap"><table class="mx">${head}${body}</table></div>`;
  }


  function tableAll(){
    // 행 = 층(미션), 열 = 감지 6종. 카드 전체 보기와 같은 축
    const head = `<tr><th class="tn">미션, 층</th>${K.map(k => `<th class="tw"><b>${k}</b><span>${STD[k]}</span></th>`).join('')}</tr>`;
    const body = M.map((m, i) => { const w = worst(i);
      return `<tr class="${w}"><td class="tn"><span class="bar"></span><div class="tnw"><div class="tnt"><b class="fl2">${m.mis}</b><small>${flN(m)}</small><span class="trb"><i></i>${m.robot}${nowOf(i) ? ', ' + nowOf(i) + ' 지나 이동 중' : ', 순회 끝'}</span><small>측정 ${m.done}/${m.total}곳</small>${i===1 && !newSeen ? '<em class="nwm">새로</em>' : ''}</div></div></td>
        ${K.map(k => { const x = m.r[k]; if(!x) return '<td class="tc"><span class="nat">' + NAW[naOf(i, k)] + '</span></td>';
          if(x[0]==='ok') return `<td class="tc"><span class="cv ok" data-dk="${k}" data-dm="${i}"><i></i>정상 범위</span></td>`;
          return `<td class="tc"><span class="cv ${x[0]}" data-dk="${k}" data-dm="${i}"><i></i>${SHORT[x[1]] || x[1]}</span><small class="twp">${x[2].split(' ')[0]}${moreTxt(i, k)}, ${x[3]}</small></td>`; }).join('')}</tr>`; }).join('');
    return `<div class="mtbw"><table class="mtb">${head}${body}</table></div>`;
  }

  const LAYB = () => `<span class="lyseg"><button type="button" data-lay="card" class="${lay==='card' ? 'on' : ''}">카드</button><button type="button" data-lay="table" class="${lay==='table' ? 'on' : ''}">표</button></span>`;
  // 한 감지의 결과 목록. 넘은 것 먼저(위험 > 주의 > 요청됨), 같으면 최근 것 먼저. 맨 앞이 대표
  const isOpen = it => (it[0]==='crit' || it[0]==='warn') && !it[4];
  const wpOf = it => it[2].split(' ')[0];
  // [10/29] 전체 목록은 미션이 제목, 층은 보조 — 한 미션이 여러 층을 지나고 한 층에 미션이 여럿일 수 있어 층은 열쇠가 못 된다. 여러 층은 지나는 순서로
  const flN = m => m.fls ? m.fls.map(f => f[1]).join(' → ') : m.fl;
  function itemsOf(i, k){ const m = M[i]; if(m.rs && m.rs[k]) return m.rs[k].slice().sort((a, b) => (RANK[b[0]] - RANK[a[0]]) || (b[3] > a[3] ? 1 : -1)); return m.r[k] ? [m.r[k]] : []; }
  function sync(m, i){ if(!m.rs) return; Object.keys(m.rs).forEach(k => { m.r[k] = itemsOf(i, k)[0].slice(); }); }
  const moreTxt = (i, k) => { const n = itemsOf(i, k).length - 1; return n > 0 ? ' 외 ' + n + '곳' : ''; };
  const flOf = (m, w) => { if(!m.fls) return m.ab; const n = parseInt(w.slice(-2)); return (m.fls.find(f => n <= f[2]) || m.fls[m.fls.length - 1])[0]; };

  // 2D 탑뷰 지도: 관제 2D 지도 시안의 평면(B3, B4)을 그대로 쓴다. 3F, 1F 평면은 아직 없어 B4, B3 평면을 대신 쓴다
  const PLAN2 = {"B4":{"wall":[[0,1365,388,5],[0,0,825,5],[645,903,5,270],[550,1015,5,158],[383,1253,350,5],[645,1170,195,5],[173,200,258,5],[243,355,78,5],[133,898,518,5],[645,350,5,548],[645,3,5,268],[383,978,5,393],[388,1015,93,5],[430,453,5,45],[173,483,258,5],[168,200,5,400],[173,355,35,5],[430,200,5,190],[353,355,78,5],[173,595,263,5],[430,533,5,63],[835,0,5,1175],[738,198,98,5],[0,0,5,1370],[5,898,58,5],[835,1190,5,180],[795,1253,40,5]],"equipment":[[23,20,240,60],[263,23,3,55],[28,643,28,115],[558,295,83,63],[153,733,228,90],[23,830,53,60],[80,1070,88,258],[113,960,55,110],[175,208,253,145],[285,1000,75,335],[440,588,155,263]],"stairs":[[600,1120,45,43],[603,1108,40,3],[603,1075,40,3],[603,1053,40,3],[603,1020,40,3],[600,1020,45,13],[600,1033,45,10],[600,1020,45,13],[600,1043,45,10],[600,1053,45,13],[600,1065,45,10],[600,1075,45,13],[600,1088,45,10],[600,1098,45,10],[600,1108,45,13],[600,1120,45,43],[603,1108,40,3],[603,1075,40,3],[603,1053,40,3],[603,1020,40,3],[600,1020,45,13],[600,1033,45,10],[600,1020,45,13],[600,1043,45,10],[600,1053,45,13],[600,1065,45,10],[600,1075,45,13],[600,1088,45,10],[600,1098,45,10],[600,1108,45,13],[333,493,43,50],[320,493,3,48],[288,493,3,48],[265,493,3,48],[255,493,3,48],[233,493,3,48],[233,493,13,50],[245,493,10,50],[233,493,13,50],[255,493,13,50],[268,493,10,50],[278,493,10,50],[288,493,13,50],[300,493,10,50],[310,493,10,50],[320,493,13,50],[333,493,43,50],[320,493,3,48],[288,493,3,48],[265,493,3,48],[255,493,3,48],[233,493,3,48],[233,493,13,50],[245,493,10,50],[233,493,13,50],[255,493,13,50],[268,493,10,50],[278,493,10,50],[288,493,13,50],[300,493,10,50],[310,493,10,50],[320,493,13,50]]},"B3":{"wall":[[0,1365,388,5],[0,0,825,5],[645,903,5,270],[550,1015,5,158],[383,1253,350,5],[645,1170,195,5],[173,200,258,5],[243,355,78,5],[645,3,5,268],[383,978,5,393],[388,1015,93,5],[168,200,5,400],[173,355,35,5],[430,200,5,190],[353,355,78,5],[835,0,5,1175],[738,198,98,5],[0,0,5,1370],[5,898,58,5],[835,1190,5,180],[795,1253,40,5],[430,453,5,45],[173,483,258,5],[173,595,263,5],[430,533,5,63]],"equipment":[[560,788,228,90],[560,288,228,90],[560,285,225,3],[560,465,228,93],[560,633,228,93],[148,1250,228,93],[148,1073,228,90],[148,905,228,93],[148,725,228,93],[285,18,85,60],[23,20,240,60],[263,23,3,55],[175,208,253,145]],"stairs":[[228,543,45,50],[270,543,3,48],[293,543,3,48],[303,543,3,48],[325,543,3,48],[358,543,3,48],[360,543,10,50],[348,543,13,50],[360,543,10,50],[338,543,10,50],[328,543,10,50],[315,543,13,50],[305,543,10,50],[295,543,10,50],[283,543,13,50],[273,543,10,50],[228,543,45,50],[270,543,3,48],[293,543,3,48],[303,543,3,48],[325,543,3,48],[358,543,3,48],[360,543,10,50],[348,543,13,50],[360,543,10,50],[338,543,10,50],[328,543,10,50],[315,543,13,50],[305,543,10,50],[295,543,10,50],[283,543,13,50],[273,543,10,50],[555,1060,45,10],[555,1070,45,10],[555,1080,45,13],[555,1093,45,10],[555,1103,45,13],[555,1115,45,10],[555,1125,45,10],[555,1148,45,10],[555,1135,45,13],[555,1148,45,10],[558,1145,43,3],[558,1113,43,3],[558,1090,43,3],[558,1058,43,3],[555,1015,45,45],[555,1060,45,10],[555,1070,45,10],[555,1080,45,13],[555,1093,45,10],[555,1103,45,13],[555,1115,45,10],[555,1125,45,10],[555,1148,45,10],[555,1135,45,13],[555,1148,45,10],[558,1145,43,3],[558,1113,43,3],[558,1090,43,3],[558,1058,43,3],[555,1015,45,45]]}};
  const PLANOF = {'3F':'B4', '1F':'B3', 'B4':'B4', 'B3':'B3'};
  const R2 = (x, y) => [x, 1370 - y];
  const WP2 = {'01':[515,250],'02':[260,510],'03':[100,280],'04':[100,760],'05':[100,1000],'06':[280,1240],'07':[500,950],'08':[810,1060],'09':[810,780],'10':[810,620],'11':[700,480],'12':[620,420],'13':[510,415],'14':[300,420],'15':[100,580],'16':[100,900],'17':[150,1240],'18':[470,1240],'19':[520,1088],'20':[695,700]};
  const TOUR2 = {
    B3:[[577,370],[515,370],'01',[515,510],'02',[100,510],'03','04','05',[100,1240],'06',[500,1240],'07',[810,950],'08','09','10',[810,480],'11',[620,480],'12',[577,420]],
    B4:[[622,362],[622,415],'13','14',[100,425],'15','16',[100,1240],'17','18',[520,1240],'19',[695,1088],'20',[695,1290]]};
  // 층 평면 위 순회 선. 지점 수가 시안과 같으면 시안의 지점 자리, 다르면 선 위에 고르게
  function tour2(pf, n){
    const pts = [], at = []; TOUR2[pf].forEach(q => { if(typeof q==='string'){ at.push(pts.length); pts.push(R2(...WP2[q])); } else pts.push(R2(...q)); });
    const cum = [0]; for(let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    const sAt = at.length===n ? at.map(i => cum[i]) : Array.from({length:n}, (_, j) => len * (.06 + .88 * (n===1 ? .5 : j / (n - 1))));
    return {pts, cum, len, sAt};
  }
  function pos2(L, sv){ sv = Math.max(0, Math.min(L.len, sv)); let i = 1; while(i < L.pts.length - 1 && L.cum[i] < sv) i++;
    const a = L.pts[i - 1], b = L.pts[i], t = (sv - L.cum[i - 1]) / ((L.cum[i] - L.cum[i - 1]) || 1);
    return {x:a[0] + (b[0] - a[0]) * t, y:a[1] + (b[1] - a[1]) * t, ang:Math.atan2(b[1] - a[1], b[0] - a[0])}; }
  function cut2(L, s0, s1){ if(s1 <= s0) return ''; const o = [pos2(L, s0)]; for(let i = 1; i < L.pts.length; i++) if(L.cum[i] > s0 && L.cum[i] < s1) o.push({x:L.pts[i][0], y:L.pts[i][1]}); o.push(pos2(L, s1)); return o.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '); }
  let mapF = {}, mapT = null;
  // 지금 지점: 여러 층 미션은 순회 순서(층 순, 번호 순)의 마지막 측정 지점
  const nowOf = i => { const m = M[i], ed = eData(i); if(m.done >= m.total) return ''; if(!m.fls) return ed.now; const ms = ed.sp.filter(p => !p[3]).map(p => p[0]).sort(); return ms[ms.length - 1] || ''; };
  // 한 층 그림. big = 크게 보기(벽, 계단, 지점 번호, 방 이름까지)
  function svg2(i, ab, big, w, sel, lk){
    const m = M[i], ed = eData(i), sp = ed.sp, rows = ed.rows, pf = PLANOF[ab] || 'B4', P = PLAN2[pf];
    const list = sp.filter(p => flOf(m, p[0])===ab); if(m.fls) list.sort((p, q) => p[0] < q[0] ? -1 : 1);
    const L = tour2(pf, list.length);
    const px = big ? 888 / 560 : 888 / (w || 220), u = v => (v * px).toFixed(1);
    const stOf = w => rows.reduce((a, r) => { const c = r.c[w]; return c && RANK[c[0]] !== undefined && RANK[c[0]] > RANK[a] ? c[0] : a; }, 'ok');
    const ksOf = w => rows.filter(r => r.c[w] && r.c[w][0] !== 'plan').map(r => r.n).join(',');
    const now = nowOf(i), nowF = now ? flOf(m, now) : '';
    const idx = list.findIndex(p => p[0]===now), next = list.find(p => p[3]);
    // 로봇은 지금 지점과 다음 지점 사이, 지나온 길은 로봇 자리까지
    let sR = null; if(ab===nowF && idx >= 0) sR = idx < list.length - 1 ? L.sAt[idx] + (L.sAt[idx + 1] - L.sAt[idx]) * .35 : L.sAt[idx];
    const allDone = list.length && list.every(p => !p[3]), noneDone = list.every(p => p[3]);
    const sCut = sR !== null ? sR : allDone ? L.len : noneDone ? 0 : L.sAt[list.filter(p => !p[3]).length - 1];
    let g = `<svg class="m2v" viewBox="-24 -24 888 1418" role="img" aria-label="${m.mis} ${ab} 평면, 지점 ${list.length}곳">`;
    g += '<rect class="bg" x="-24" y="-24" width="888" height="1418"/>';
    P.equipment.forEach(r => { g += `<rect class="${big ? 'eqb' : 'eq'}" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`; });
    if(big){ P.stairs.forEach(r => { g += `<rect class="stz" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" stroke-width=".6"/>`; });
      P.wall.forEach(r => { g += `<rect class="wl" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`; }); }
    const sw = big ? 1 : 1.15;
    g += `<polyline class="ra" points="${cut2(L, sCut, L.len)}" stroke-width="${u(1.4 * sw)}" stroke-dasharray="${u(1.5)} ${u(4)}" vector-effect="none"/>`;
    g += `<polyline class="rd" points="${cut2(L, 0, sCut)}" stroke-width="${u(2.4 * sw)}"/>`;
    if(sel && lk && lk.length){ const at2 = w2 => { const j = list.findIndex(p => p[0]===w2); return j < 0 ? null : pos2(L, L.sAt[j]); }, q0 = at2(sel);
      if(q0) lk.forEach(w2 => { const q1 = at2(w2); if(q1 && w2 !== sel) g += `<line x1="${q1.x.toFixed(1)}" y1="${q1.y.toFixed(1)}" x2="${q0.x.toFixed(1)}" y2="${q0.y.toFixed(1)}" class="lkl" stroke-width="${u(1.6)}" stroke-dasharray="${u(3)} ${u(2.5)}"/><circle class="lkc" cx="${q1.x.toFixed(1)}" cy="${q1.y.toFixed(1)}" r="${u(6)}" fill="none" stroke-width="${u(1.2)}"/>`; }); }
    list.forEach((p, j) => { const w = p[0], q = pos2(L, L.sAt[j]), s2 = p[3] ? 'plan' : stOf(w), isNext = next && next[0]===w && ab===nowF;
      let mk;
      if(s2==='plan') mk = `<circle r="${u(isNext ? 3.4 : 2.6)}" class="mk-p ${isNext ? 'nx' : ''}" stroke-width="${u(isNext ? 1.6 : 1)}"/>`;
      else if(s2==='crit' || s2==='warn') mk = `<circle r="${u(3.6)}" class="mk-${s2==='crit' ? 'c' : 'w'}" stroke-width="${u(.8)}"/>`;
      else if(s2==='done') mk = `<circle r="${u(3)}" class="mk-d" fill="none" stroke-width="${u(1.4)}"/>`;
      else mk = `<circle r="${u(2.4)}" class="mk-o"/>`;
      const nm = sel===w ? `<circle class="mk-sel" r="${u(6.5)}" fill="none" stroke-width="${u(1.4)}"/><text class="wpn" x="${q.x > 420 ? -u(9) : u(9)}" text-anchor="${q.x > 420 ? 'end' : 'start'}" y="${u(-7)}" font-size="${u(12)}" font-weight="800" stroke-width="${u(3)}">${w}</text>` : big ? `<text class="wpn" x="${u(7)}" y="${u(-6)}" font-size="${u(11)}" stroke-width="${u(3)}">${w}</text>` : '';
      g += `<g class="wpm" data-w="${w}" data-ks="${ksOf(w)}" transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)})"><title>${w}, ${s2==='plan' ? '예정' : WORD[s2]}</title><circle r="${u(9)}" fill="transparent"/><circle class="hlr" r="${u(8)}" fill="none" stroke-width="${u(2.4)}"/>${sel && sel !== w ? `<text class="wpn hlr" x="${q.x > 420 ? -u(10) : u(10)}" text-anchor="${q.x > 420 ? 'end' : 'start'}" y="${u(4)}" font-size="${u(12)}" font-weight="800" stroke-width="${u(3)}">${w}</text>` : ''}${mk}${nm}</g>`; });
    if(sR !== null){ const q = pos2(L, sR);
      g += `<g transform="translate(${q.x.toFixed(1)},${q.y.toFixed(1)}) rotate(${(q.ang * 180 / Math.PI).toFixed(1)}) scale(${(px * (big ? 1 : .62)).toFixed(3)})"><title>${m.robot} 이동 중</title><path class="rbt" d="M10 0-7.5 8.5-3.6 0-7.5-8.5Z" stroke-width="1.6" stroke-linejoin="round"/></g>`; }
    g += '</svg>';
    return g;
  }
  function viewF(i){ const m = M[i], fls = m.fls ? m.fls.map(f => f[0]) : [m.ab], ed = eData(i), meas = ed.sp.filter(p => !p[3]).map(p => p[0]);
    const nw = nowOf(i), robotF = m.fls ? (nw ? flOf(m, nw) : fls[0]) : m.ab;
    return {fls, robotF, cur:mapF[i] && fls.includes(mapF[i]) ? mapF[i] : robotF}; }
  function floorBar(i, big){ const {fls, robotF, cur} = viewF(i);
    if(fls.length < 2) return `<span class="m2f"><span>${fls[0]}</span></span>`;
    return `<span class="m2f" role="group" aria-label="층">${fls.map(f => `<button type="button" data-mf="${f}" data-mi="${i}" class="${f===cur ? 'on' : ''}" aria-pressed="${f===cur}">${f}${f===robotF ? '<i title="로봇 있는 층"></i>' : ''}</button>`).join('')}</span>`; }
  const LEG = '<div class="mlg"><i class="c"></i>위험 <i class="w"></i>주의 <i class="o"></i>정상 범위 <i class="p"></i>예정 <svg viewBox="-9 -9 20 18" width="11" height="10"><path class="rbt" d="M10 0-7.5 8.5-3.6 0-7.5-8.5Z" stroke="none"/></svg>로봇</div>';
  // [v5 점검] 왼쪽 패널(관제 · 보고서와 같은 340) 본문 — 미션 하나: 요약 + 2D 지도(자세히 보기에서는 그 지점 · 연관 지점 표시), 전체: 미션별 작은 지도 목록
  // [10/29] 왼쪽 패널은 깊이와 상관없이 늘 미션 목록(보고서 목록과 같은 짜임) — 지금 어디인지는 고른 줄이 말한다.
  // 맨 위 [전체], 아래 미션 줄. 고른 미션은 줄 아래로 2D 지도가 펼쳐지고(자세히 보기에서는 그 지점 · 연관 지점), 나머지는 작은 지도 줄
  // [10/30 GUI · Figma 1467:8482] 목록은 한 덩이(모서리 8) — 맨 위 [미션 전체] 줄 + 안으로 꺼진 칸(bg/map-chip 50%) 안의 미션 줄.
  // 미션 줄의 단계는 이름 앞 ⓧ/△ 가 말하고(왼쪽 선은 10/30 뺐다), 글은 위치 · 측정 · 로봇 · 요청 전 키-값이다. 범례는 패널 맨 아래.
  function sideHtml(){
    const allN = M.reduce((a, m, i) => a + hits(i), 0);
    const nOf = w => M.filter((m, i) => worst(i)===w).length, nc = nOf('crit'), nw0 = nOf('warn');   // 단계별 미션 수
    const kv = (k, v) => `<span class="sf-kv"><span class="k">${k}</span><span class="v">${v}</span></span>`;
    // [10/30 A안] [미션 전체]도 목록의 한 줄 — 미션 줄과 같은 칸 · 여백 · 썸네일 자리(72) · 키-값. 썸네일 자리는 단계별 미션 수를 쌓은 블록,
    // 왼쪽 선은 중립(전체 단계를 빨강으로 칠하면 바로 아래 위험 미션과 빨강이 겹친다). 고른 줄은 어느 깊이에서나 bg/selected 면 하나로 말한다
    const cnt = (w, n, t) => `<span class="sf-cnt ${w} ${n ? '' : 'zero'}" title="${t} 미션 ${n}개"><span class="l">${t}</span><b>${n}</b></span>`;   // 한 칸 — 단계 이름(왼쪽 위) + 숫자(오른쪽 아래). 기호는 목록 · 카드에 이미 많아 글로 쓴다(10/30)
    const sumD = M.reduce((a, m) => a + m.done, 0), sumT = M.reduce((a, m) => a + m.total, 0);
    // [10/30] 줄 꼴 — 제목 줄이 맨 위(썸네일 위까지 한 줄), 그 아래 썸네일 | 키-값. 고른 미션(제목 줄 + 테 안 정보 · 지도)과 제목 자리가 같아 깊이가 바뀌어도 줄이 흔들리지 않는다
    const top = `<button type="button" class="sf-mrow sf-all ${scope==='all' ? 'on' : ''}" data-sc="all" aria-current="${scope==='all'}"><span class="sf-mt1"><b>미션 전체</b></span><span class="sf-mbody"><span class="sf-mmap sf-allsum" aria-hidden="true">${cnt('crit', nc, '위험')}${cnt('warn', nw0, '주의')}${cnt('ok', M.length - nc - nw0, '정상')}</span><span class="sf-meta">${kv('미션', M.length + '개')}${kv('측정', sumD + '/' + sumT + '곳')}${kv('요청 전', allN + '건')}</span></span></button>`;
    const rows = M.map((m, i) => { const w = worst(i), h = hits(i), nw = i===1 && !newSeen, on = scope===i;
      const t1 = `<span class="sf-mt1"><i class="ixd ${w} ${nw ? 'blink' : ''}"></i><b>${m.mis}</b>${nw ? '<em class="nwm">새로</em>' : ''}</span>`;
      const meta = `<span class="sf-meta">${kv('층', flN(m))}${kv('측정', `${m.done}/${m.total}곳${m.done===m.total ? ', 순회 끝' : ''}`)}${kv('로봇', m.robot)}${kv('요청 전', h + '건')}</span>`;
      if(!on) return `<button type="button" class="sf-mrow ${w}" data-sc="${i}">${t1}<span class="sf-mbody"><span class="sf-mmap">${svg2(i, viewF(i).robotF, false, 96)}</span>${meta}</span></button>`;
      const cur = dt && dt.wp ? flOf(m, dt.wp) : viewF(i).cur, sel = dt ? dt.wp : undefined, lk = dt ? dt.lk : undefined;
      // [10/30] 고른 미션 — 제목 줄(+ [관제에서 보기])은 테 밖, 테(border/default) 하나 안에 정보 + 지도. 면은 깔지 않는다.
      // 층 표시는 층이 여럿일 때만(고르는 단추) 지도 위에 남긴다
      const multi = !!(m.fls && m.fls.length > 1);
      return `<div class="sf-mon ${w}"><div class="sf-monh"><button type="button" class="sf-mrow on" data-sc="${i}" aria-current="true">${t1}</button></div>
        <div class="sf-monb">${meta}<div class="m2"><div class="m2b">${multi ? floorBar(i) : ''}<span class="sp"></span><a class="m2go" href="${mainUrl(i, cur)}" title="관제 3D 지도에서 이 미션과 층을 연다" aria-label="관제에서 보기">관제<span class="i i-14" style="--i:var(--ic-chevron-right)" aria-hidden="true"></span></a></div><div class="m2rot">${svg2(i, cur, false, 316, sel, lk)}</div></div></div></div>`; }).join('');
    return `${LEG}<div class="sf-mwrap"><div class="sf-mlist"><div class="sf-mwell">${top}${rows}</div></div><span class="sf-mthumb" aria-hidden="true"></span></div>`;   // 범례는 목록 위(10/30) — 기호를 먼저 읽고 목록으로
  }
  const gnbMain = document.querySelector('.gnb-item[href^="./main-v5.html"]');
  const MAINV3 = "./main-v5.html";   // [v5] 같은 판의 관제로
  function mainUrl(i, ab){ const m = M[i], q = new URLSearchParams({mission:m.mis, floor:PLANOF[ab] || ab}); const nw = nowOf(i); if(nw) q.set("wp", nw); return MAINV3 + "?" + q.toString(); }
  function pickF(i, f){ const {robotF} = viewF(i); mapF[i] = f; clearTimeout(mapT);
    if(f !== robotF) mapT = setTimeout(() => { delete mapF[i]; if(!dt) render(); }, 10000); render(); }
  // 판정하지 않는 감지 카드. scope = 이 미션 대상 아님(카메라는 송출 중), sensor = 이 로봇에 센서 없음
  const NAW = {scope:'대상 아님', sensor:'센서 없음'};
  function naOf(i, k){ const m = M[i]; return (m.na && m.na[k]) || 'scope'; }
  // 정상 범위 카드: 측정 곳 수 대신 가장 최근에 잰 지점(시안용 설비 이름)
  const OKN = {'안전감지':'작업 구역 출입구','누출감지':'배관 이음부','온도감지':'펌프 모터','계기인식':'압력계','이상음향':'펌프 베어링','부분방전':'수배전반'};
  function okLatest(i, k){ const ed = eData(i), r = ed.rows.find(r2 => r2.n===k); if(!r) return '';
    const hit = ed.sp.filter(p => !p[3] && r.c[p[0]] && r.c[p[0]][0]==='ok').sort((p, q) => p[1] < q[1] ? -1 : 1).pop();
    return hit ? hit[0] + ' ' + OKN[k] + ', ' + hit[1] : ''; }
  function cardNA(i, k){ const m = M[i], why = naOf(i, k), md = MD(k, 'ok', i);
    const judged = K.filter(k2 => m.r[k2]).map(k2 => k2.replace('감지', '').replace('인식', '')).join(', ');
    if(why==='sensor') return `<div class="kd na" data-n="${k}"><div class="rw"><span class="nm">${k}</span><span class="pl na">센서 없음</span></div><div class="big">센서 없음</div><span class="sm">${m.robot}에 ${k==='부분방전' ? 'PD' : k} 센서가 달려 있지 않음</span><div class="md naempty"><span><b>송출할 센서 없음</b>센서를 단 로봇이 순회하면 표시</span></div></div>`;
    return `<div class="kd na" data-n="${k}"><div class="rw"><span class="nm">${k}</span><span class="pl na">대상 아님</span></div><div class="big">판정하지 않음</div><span class="sm">${m.mis}는 ${judged}만 판정</span><div class="md nadim ${md[0]}">${md[1].replace(/<span class="bx"[^>]*><\/span>/, '')}</div></div>`;
  }
  function cardM(i, k){
    const m = M[i], x = m.r[k];
    if(!x) return cardNA(i, k);
    if(x[0]==='ok') return cardC(k, ['ok', x[1], okLatest(i, k) || x[2]], '', i);
    if(!m.rs || !m.rs[k]) return cardC(k, x, '', i);
    const its = itemsOf(i, k), dn = its.filter(it => it[4] && it !== its[0]);
    const extra = dn.length ? `<span class="req">${dn.map(wpOf).join(', ')} ${dn[0][4]} 현장 조치 요청됨</span>` : '';
    const html = cardC(k, [x[0], x[1], x[2], x[3], x[4]], extra, i);
    return its.length > 1 ? html.replace(`<span class="nm">${k}</span>`, `<span class="nm">${k} ${its.length}개</span>`) : html;
  }
  function init(){ M = JSON.parse(JSON.stringify(BASE)); scope = 0; menu = false; fired = false; toasts = []; drawer = null; newSeen = true; M.forEach(sync); }
  init();
  const scr = document.querySelector('.app'), sf = document.querySelector('[data-sf]'), v = document.getElementById('sfv'), bc = document.querySelector('[data-sf-crumb]'), side = document.querySelector('[data-sf-sb]');
  if(!sf || !v || !bc || !side) return;
  const hits = i => K.reduce((a, k) => a + itemsOf(i, k).filter(isOpen).length, 0);
  const worst = i => K.reduce((a, k) => { const x = M[i].r[k]; return x && RANK[x[0]] > RANK[a] ? x[0] : a; }, 'ok');
  const worstAll = () => M.reduce((a, m, i) => RANK[worst(i)] > RANK[a] ? worst(i) : a, 'ok');
  function cardC(k, x, extra, mi){
    if(!x) return `<div class="kd ok" data-n="${k}"><div class="rw"><span class="nm">${k}</span></div><div class="big">재지 않음</div></div>`;
    const [s, sent, loc, t, rq] = x, md = MD(k, s, mi);
    if(s==='ok') return `<div class="kd ok" data-n="${k}" tabindex="0" role="button"><div class="rw"><span class="nm">${k}</span><span class="pl ok">정상 범위</span></div><div class="big">정상 범위</div><span class="sm">${loc}</span>${extra || ''}<div class="md ${md[0]}">${md[1].replace(/<span class="bx"[^>]*><\/span>/, '')}</div><span class="more">자세히 보기 →</span></div>`;
    return `<div class="kd ${s} ${s==='done' ? 'dim' : ''}" data-n="${k}" tabindex="0" role="button"><div class="rw"><span class="nm">${k}</span><span class="pl ${s}">${WORD[s]}</span></div>
      <div class="big">${sent}</div><span class="sm">${loc}, ${t}</span>${rq ? `<span class="req">${rq} 현장 조치 요청됨</span>` : ''}${extra || ''}<div class="md ${md[0]}">${md[1]}</div><span class="more">자세히 보기 →</span></div>`;
  }
  function head(title, done, total, n){
    // [10/30] 'n건 현장 조치 요청 전'은 뺐다 — 왼쪽 목록의 '요청 전'(전체 · 고른 미션)과 같은 숫자다. 요청을 보내면 목록 값이 줄어 피드백이 된다
    return `<div class="hd"><span class="lvh t-caption" title="6종 영상과 센서를 실시간으로 받는 중"><span class="lvd" aria-hidden="true"></span>라이브</span><span class="sp"></span>${LAYB()}</div>`;
  }
  function crumb(){
    const isAll = scope==='all';
    // [10/30] 미션 메뉴는 관제(mission-scope.js buildMenu)와 같은 표 — 머리(수행 · 미션 · 층 · 로봇) + 줄마다 수행 점 · 이름 뒤 알림 기호 · 층 꼬리표 · 로봇 번호.
    //   미션 전체는 왼쪽 "통합 순회 현황" 단추가 맡아 메뉴 줄에서 뺐다(관제 메뉴에도 없다)
    const SEV = {crit:['critical','error','위험'], warn:['warning','warning','주의']};
    const head = '<div class="scope-head t-caption" aria-hidden="true"><span>수행</span><span>미션</span><span>층</span><span>로봇</span></div>';
    // 줄 차례도 관제와 같게 — 로봇 번호 순
    const ord = M.map((m, i) => i).sort((x, y) => parseInt(M[x].robot.replace(/\D+/g, '')) - parseInt(M[y].robot.replace(/\D+/g, '')));
    const items = head + ord.map(i => [M[i], i]).map(([m, i]) => { const w = worst(i), on = String(scope)===String(i), sv = SEV[w], run = m.done < m.total ? 'run' : 'done';
      const fls = (m.fls ? m.fls.map(f => f[0]) : [m.ab]).map(f => `<span class="floor-tag num">${f}</span>`).join('');
      return `<button type="button" class="menu-item scope-item is-${run}" role="menuitemradio" aria-checked="${on}" data-sc="${i}"><span class="scope-run" data-run="${run}" title="${run==='run' ? '수행중' : '완료'}"></span><span class="scope-name"><span class="t-label-2">${m.mis}</span>${sv ? `<span class="i i-16 scope-sev" data-sev="${sv[0]}" style="--i:var(--ic-${sv[1]})" title="${sv[2]} 알림 있음"></span>` : ''}${i===1 && !newSeen ? '<em class="nwm">새 위험</em>' : ''}</span><span class="scope-floors">${fls}</span><span class="scope-robots num">${m.robot.replace(/\D+/g, '')}</span></button>`; }).join('');
    return `<button type="button" class="sb-overview t-title-2 ${isAll ? 'is-on' : ''}" data-sc="all">통합 순회 현황</button><span class="status-bar-sep t-title-2" aria-hidden="true">›</span>
      <div class="scope-menu-box"><button type="button" class="scope-trigger" data-menu="1" aria-haspopup="true" aria-expanded="${menu}"><span class="t-title-2">${isAll ? '미션 고르기' : M[scope].mis}</span><span class="i i-16" style="--i:var(--ic-chevron-down)" aria-hidden="true"></span></button><div class="dropdown-menu scope-menu sf-scope" role="menu" aria-label="미션"${menu ? '' : ' hidden'}>${items}</div></div>${dt ? `<span class="status-bar-sep t-title-2" aria-hidden="true">›</span><span class="t-title-2 sf-crumb-k">${dt.k}</span>` : ''}`;
  }
  // 전체 카드: 미션(위치)마다 한 줄, 그 미션에서 넘은 결과만 C 카드로
  // [10/30 GUI · Figma 1494:14581] 카드 꼴 — 미션 전체 · 미션 하나 같은 꼴(.cx). 건수는 단계 배지 안으로(위험 2), 위치 · 시각 두 줄, 현장 조치 요청은 시각 줄 오른쪽.
  // named: 감지 이름 줄을 남긴다(미션 하나 — 감지 열 머리가 없다). 미션 전체는 머리 줄이 감지 이름을 말해 뺀다
  function cardX(h, k, named){
    let c = h.replace(/<span class="nm">([^<]*)<\/span>(<span class="pl ([a-z]+)">([^<]*)<\/span>)?/, (a, t, pl, st, w) => { const n = (t.match(/(\d+)개/) || [])[1];
      // [10/30] 정상 카드는 배지를 뺀다 — 큰 제목이 같은 말(정상 범위)을 한다. 주의 · 위험 · 대상 아님 · 센서 없음은 그대로
      return '<span class="nm"></span>' + (pl && st !== 'ok' ? `<span class="pl ${st}">${w}${n ? ' ' + n : ''}</span>` : ''); });
    if(named) c = c.replace('</div>', `</div><span class="knm">${k}</span>`);   // 첫 </div> = 배지 줄 끝
    return c.replace(/<span class="sm">([^<]*), (\d\d:\d\d)<\/span>/, '<span class="mt lc">$1</span><span class="mt tm">$2</span>')
      .replace(/<span class="mt tm">([^<]*)<\/span>(<span class="req">[^<]*<\/span>)?/, (q, t, r) => `<span class="mt trow"><span class="tm">${t}</span>${r || ''}</span>`);
  }
  function secsAll(){
    const mh = `<div class="mhead" aria-hidden="true">${K.map(k => `<span><b>${k}</b><small>${STD[k]}</small></span>`).join('')}</div>`;   // 감지 이름은 머리 줄이 말한다(스크롤해도 붙어 있다)
    return '<div class="msecs">' + mh + M.map((m, i) => { const fl = K;   // [10/29] 열 고정 — 표 · 미션 하나(3×2) · 감지 탭과 같은 순서. 급한 것은 ⓧ/△ 기호와 위험 글자색이 알린다
      const w = worst(i);
      // [10/30 GUI · Figma 1467:8854] 카드 — 배지 왼쪽 · 건수 오른쪽, 위치(핀) · 시각(시계) 두 줄, 아래 사진은 카드 안 4 만 띄워 꽉 채운다
      // [10/30] 묶음 제목 앞 단계 기호는 뺐다 — 바로 아래 카드 배지와 왼쪽 목록이 같은 말을 한다(한 화면에 세 번)
      // [10/30] 제목 옆 층 · 로봇 · 측정(왼쪽 목록과 같다)과 오른쪽 정상 범위 n종(카드가 보여 준다)도 뺐다 — 제목은 미션 이름만
      return `<section class="msec ${w}" data-mi="${i}"><div class="msh2"><b>${m.mis}</b>${i===1 && !newSeen ? '<em class="nwm">새로</em>' : ''}</div>
        <div class="mrow cx vC">${fl.map(k => cardX(cardM(i, k), k, false)).join('')}</div></section>`; }).join('') + '</div>';
  }
  function cardsAll(){
    return K.map(k => { const has = M.map((m, i) => [i, m.r[k]]).filter(([, x]) => x);
      if(!has.length) return cardC(k, null);
      const top = has.reduce((a, b) => RANK[b[1][0]] > RANK[a[1][0]] ? b : a), others = has.filter(([i, x]) => i !== top[0] && x[0] !== 'ok').length;
      return cardC(k, top[1], top[1][0]==='ok' ? '' : `<span class="mchip"><b>${M[top[0]].mis} ${M[top[0]].fl}</b>${others ? ` 외 ${others}개 미션` : ''}</span>`, top[0]); }).join('');
  }
  function view(){
    if(dt) return detail();
    if(scope==='all'){ const done = M.reduce((a, m) => a + m.done, 0), total = M.reduce((a, m) => a + m.total, 0), n = M.reduce((a, m, i) => a + hits(i), 0);
      return head('통합 순회 현황', done, total, n) + (lay==='table' ? tableAll() : secsAll()); }
    const m = M[scope];
    // [10/30 Figma 1468:8819] 미션 하나 — 칸마다 위에 감지 이름 · 기준, 아래 카드
    return head(m.mis, m.done, m.total, hits(scope)) + (lay==='table' ? tableOne(scope) : `<div class="g6 cx vC mmg">${K.map(k => `<div class="mcell"><div class="mch"><b>${k}</b><small>${STD[k]}</small></div>${cardX(cardM(M.indexOf(m), k), k, false)}</div>`).join('')}</div>`);
  }
  function spec3(cv){ const W = cv.clientWidth || 400, H = cv.clientHeight || 160; cv.width = W; cv.height = H; let seed = 7; const R = () => { seed = seed + 0x6D2B79F5 | 0; let q = Math.imul(seed ^ seed >>> 15, 1 | seed); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; }; const c = cv.getContext('2d'); for(let x = 0; x < 40; x++) for(let y = 0; y < 18; y++){ const vv = .25 + (y / 18) * .35 + R() * .3, h = x / 40 > .6 && x / 40 < .78 && y / 18 > .5 && y / 18 < .85; c.fillStyle = h ? `rgb(250,${190 + R() * 50 | 0},60)` : `rgb(${30 + 50 * vv | 0},${70 + 110 * vv | 0},${150 + 90 * vv | 0})`; c.fillRect(x * W / 40, y * H / 18, W / 40 + .6, H / 18 + .6); } }
  const pv = document.createElement('div'); pv.className = 'pvx'; pv.hidden = true; sf.appendChild(pv);
  function showPv(el){
    const k = el.dataset.dk, mi = +el.dataset.dm, m = M[mi], x = m.r[k]; if(!x) return;
    const wp = el.dataset.dw || (x[0] !== 'ok' ? wpOf(x) : ''), hx = el.dataset.dw ? itemsOf(mi, k).find(y => y[0] !== 'ok' && wpOf(y)===el.dataset.dw) : (x[0] !== 'ok' ? x : null), hit = !!hx;
    const st = hit ? hx[0] : (el.classList.contains('plan') ? 'plan' : 'ok'), val = el.textContent.trim(), md = MD(k, st, mi);
    pv.innerHTML = `<div class="pvh"><b>${k}</b><span>${m.mis} ${m.fl}${wp ? ', ' + wp : ''}${hit ? ', ' + hx[3] : ''}</span></div><div class="pvm md ${md[0]}">${md[1]}</div>
      <div class="pvf"><span class="pl ${st}">${WORD[st]}</span><b>${val}</b><span>기준 ${STD[k]}</span></div><span class="pvn">${hit ? '누르면 자세히 보기' : '시안용 예시 이미지(같은 감지의 사진), 누르면 자세히 보기'}</span>`;
    pv.querySelectorAll('canvas[data-spec3]').forEach(spec3);
    const sr = sf.getBoundingClientRect(), cr = el.getBoundingClientRect();
    let px = cr.right - sr.left + 12, py = cr.top - sr.top - 40;
    if(px + 300 > sr.width) px = cr.left - sr.left - 312;
    py = Math.max(12, Math.min(py, sf.offsetHeight - 290));
    pv.style.left = px + 'px'; pv.style.top = py + 'px'; pv.hidden = false;
  }
  scr.addEventListener('mouseover', e => { if(dt) return; const c = e.target.closest('.cv[data-dk][data-dm]'); if(c) showPv(c); });
  scr.addEventListener('mouseout', e => { const c = e.target.closest('.cv[data-dk][data-dm]'); if(c && !c.contains(e.relatedTarget)) pv.hidden = true; });
  const RM2 = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frEl = () => sf;
  function relR(el){ const a = el.getBoundingClientRect(), b = frEl().getBoundingClientRect(); return {l:a.left - b.left, t:a.top - b.top, w:a.width, h:a.height}; }
  function ghostR(from, to, done){
    const g = document.createElement('div'); g.className = 'gx';
    const put = r => Object.assign(g.style, {left:r.l + 'px', top:r.t + 'px', width:r.w + 'px', height:r.h + 'px'});
    put(from); frEl().appendChild(g); g.getBoundingClientRect();
    g.style.transition = ['left','top','width','height'].map(p => p + ' 260ms cubic-bezier(.2,.7,.2,1)').join(',');
    put(to); setTimeout(() => { g.remove(); done(); }, 270);
  }
  function zoomIn(el, run){
    if(RM2){ run(); return; }
    const from = relR(el), to = relR(v); v.classList.add('xfade');
    ghostR(from, to, () => { run(); v.classList.add('xin'); requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove('xfade', 'xin'))); });
  }
  function zoomOut(el, done){
    if(RM2){ done(); return; }
    const to = relR(el), from = relR(v); v.classList.add('xfade');
    ghostR(from, to, () => { v.classList.remove('xfade'); done(); });
  }
  // 표: 마우스가 있는 열(지점)과 행(감지)을 함께 강조
  scr.addEventListener('mouseover', e => { scr.querySelectorAll('.colhi').forEach(x => x.classList.remove('colhi')); if(dt) return; const c = e.target.closest('.mx [data-col]'); if(c) scr.querySelectorAll(`.mx [data-col="${c.dataset.col}"]`).forEach(x => x.classList.add('colhi')); });
  scr.addEventListener('mouseover', e => { const kd = e.target.closest('.kd[data-n]'); side.querySelectorAll('.m2v').forEach(sv => { sv.classList.toggle('dimk', !!kd); sv.querySelectorAll('.wpm').forEach(g => g.classList.toggle('hit', !!kd && g.dataset.ks.split(',').includes(kd.dataset.n))); }); });
  scr.addEventListener('mouseleave', () => scr.querySelectorAll('.colhi').forEach(x => x.classList.remove('colhi')));
  function render(){
    pv.hidden = true;
    v.innerHTML = view();   // 자세히 보기가 dt.wp · dt.lk 를 정하므로 본문을 먼저 그린다
    // [10/30] 스크롤은 머리 아래만 — 머리(.hd)와 감지 머리 줄(.mhead)은 .sftop 에 남기고 나머지를 .sfsc 로 감싼다
    const top = document.createElement('div'), sc = document.createElement('div'), hd = v.querySelector(':scope > .hd'), mh = v.querySelector('.mhead');
    top.className = 'sftop'; sc.className = 'sfsc';
    if(hd){ top.appendChild(hd); if(mh) top.appendChild(mh); }
    while(v.firstChild) sc.appendChild(v.firstChild);
    if(hd) v.appendChild(top);
    v.appendChild(sc);
    bc.innerHTML = crumb();
    side.innerHTML = sideHtml();
    bindThumb();
    // [10/30] GNB [관제] — 미션 전체를 보고 있으면 통합 순회 현황, 미션 하나면 그 미션의 관제(관제에서 보기와 같은 주소)
    if(gnbMain) gnbMain.href = scope==='all' ? './building-v5.html' : mainUrl(scope, viewF(scope).cur);
    requestAnimationFrame(() => v.querySelectorAll('canvas[data-spec3]').forEach(spec3));
  }
  /*
   * [10/30] 왼쪽 목록 스크롤 막대 — 목록이 본문 판에 닿아 감싸는 꼴이라 막대 자리(12)를 비우면 고른 줄과 판 사이가 끊긴다.
   * 그래서 브라우저 막대는 숨기고, 공통 스크롤바와 같은 꼴(막대 4 · border/default · pill)의 얇은 막대를 목록 위에 띄운다.
   * 막대는 목록에 마우스를 올렸을 때만 보이고, 아래에 더 있으면 목록 아래 끝을 흐린다. 휠 · 키보드 스크롤은 그대로, 막대를 끌어 내릴 수도 있다.
   */
  function bindThumb(){
    const wrap = side.querySelector('.sf-mwrap'), l = wrap && wrap.querySelector('.sf-mlist'), t = wrap && wrap.querySelector('.sf-mthumb');
    if(!l || !t) return;
    const upd = () => { const h = l.clientHeight, sh = l.scrollHeight, over = sh > h + 1;
      wrap.classList.toggle('can', over); wrap.classList.toggle('more', over && l.scrollTop + h < sh - 1);
      if(!over) return; const th = Math.max(24, h * h / sh); t.style.height = th + 'px'; t.style.transform = `translateY(${(h - th) * l.scrollTop / (sh - h)}px)`; };
    l.addEventListener('scroll', upd, {passive:true});
    t.addEventListener('pointerdown', e => { e.preventDefault(); const y0 = e.clientY, s0 = l.scrollTop, k = l.scrollHeight / l.clientHeight; t.setPointerCapture(e.pointerId); wrap.classList.add('drag');
      const mv = ev => { l.scrollTop = s0 + (ev.clientY - y0) * k; }, up = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); wrap.classList.remove('drag'); };
      t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); });
    upd(); requestAnimationFrame(upd);
  }
  window.addEventListener('resize', () => bindThumb && side.querySelector('.sf-mlist') && side.querySelector('.sf-mlist').dispatchEvent(new Event('scroll')));
  function go(id){
    const to = id==='all' ? 'all' : +id, from = scope, wasDt = !!dt;
    const apply = () => { mapF = {}; dt = null; menu = false; drawer = null; scope = to; if(scope===1){ newSeen = true; toasts = toasts.filter(t => t.mi !== 1); } render(); };
    if(to===from && !wasDt){ menu = false; return render(); }
    // [10/30] 전체 → 미션: 그 미션의 카드 여섯 장이 1행 6열에서 2행 3열 자리로 옮겨 앉는다(FLIP). 머리 · 칸 이름은 옅게 들어온다
    const sec = from==='all' && to !== 'all' && !wasDt ? v.querySelector(`.msec[data-mi="${to}"]`) : null;
    if(sec){ if(RM2) return apply(); const prev = cardRects(sec); apply(); return flipCards(prev, v); }
    // 미션 → 전체: 반대로 2행 3열에서 그 미션 묶음의 1행 6열로 돌아가고, 묶음 테가 잠깐 빛난다
    if(to==='all' && from !== 'all' && !wasDt && !RM2){ const prev = cardRects(v); apply(); const back = v.querySelector(`.msec[data-mi="${from}"]`);
      if(back){ back.scrollIntoView({block:'nearest'}); flipCards(prev, back); back.classList.add('ring'); setTimeout(() => back.classList.remove('ring'), 1500); } return; }
    apply();
    if(to==='all' && from !== 'all'){ const back = v.querySelector(`.msec[data-mi="${from}"]`);
      if(back){ back.scrollIntoView({block:'nearest'}); zoomOut(back, () => { back.classList.add('ring'); setTimeout(() => back.classList.remove('ring'), 1500); }); } }
  }
  // 카드 자리 재기 — 감지 이름(data-n)으로 짝을 짓는다
  function cardRects(root){ const o = {}; root.querySelectorAll('.kd[data-n]').forEach(k => { o[k.dataset.n] = k.getBoundingClientRect(); }); return o; }
  // 새로 그린 카드를 예전 자리 · 크기에서 출발시켜 제자리로(360ms). 크기는 가로 · 세로를 따로 줄였다 늘린다
  function flipCards(prev, root){
    const ks = [...root.querySelectorAll('.kd[data-n]')].filter(k => prev[k.dataset.n]);
    ks.forEach(k => { const a = prev[k.dataset.n], b = k.getBoundingClientRect(); if(!b.width || !b.height) return;
      k.style.transition = 'none'; k.style.transformOrigin = '0 0'; k.style.zIndex = '3';
      k.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`; });
    v.classList.add('flip');
    v.getBoundingClientRect();
    requestAnimationFrame(() => {
      ks.forEach(k => { k.style.transition = 'transform 360ms cubic-bezier(.2,.7,.2,1)'; k.style.transform = ''; });
      setTimeout(() => { ks.forEach(k => { k.style.transition = k.style.transformOrigin = k.style.zIndex = ''; }); v.classList.remove('flip'); }, 400);
    });
  }
  scr.addEventListener('click', e => {
    const mfb = e.target.closest('[data-mf]'); if(mfb){ return pickF(+mfb.dataset.mi, mfb.dataset.mf); }
    if(e.target.closest('[data-menu]')){ menu = !menu; bc.innerHTML = crumb(); return; }
    if(dt){
      if(e.target.closest('[data-dback]')){ const k = dt.k, w = dt.w, mi = dt.mi; dt = null; render(); const c = v.querySelector(`.kd[data-n="${k}"]`) || v.querySelector(`[data-dk="${k}"][data-dm="${mi}"]${w ? `[data-dw="${w}"]` : ''}`) || v.querySelector(`[data-dk="${k}"][data-dm="${mi}"]`); if(c){ const t = c.closest('td') || c; zoomOut(t, () => { t.classList.add('ring'); setTimeout(() => t.classList.remove('ring'), 1500); }); } return; }
      if(e.target.closest('[data-bigd]')){ bigD = !bigD; return render(); }
      if(e.target.closest('[data-req]')){ const m = M[dt.mi];
        if(m.rs && m.rs[dt.k]){ const w = dt.w || wpOf(m.r[dt.k]), it = m.rs[dt.k].find(y => wpOf(y)===w); if(it){ it[4] = '10:17'; } sync(m, dt.mi); dt.w = w; }
        else { m.r[dt.k][4] = '10:17'; }
        return render(); }
      if(e.target.closest('[data-dret]')){ dt = {mi:dt.mi, k:dt.from.k, w:dt.from.w}; return render(); }
      if(e.target.closest('[data-dretx]')){ delete dt.from; return render(); }
      const dk2 = e.target.closest('[data-dk]'); if(dk2){ const from = dk2.dataset.rel ? (dt.from || {k:dt.k, w:dt.w}) : null; dt = {mi:dt.mi, k:dk2.dataset.dk, w:dk2.dataset.dw}; if(from) dt.from = from; return render(); }
    }
    // 왼쪽 패널 접기(보고서와 같다)
    if(e.target.closest('[data-sf-fold]')){ const f = sf.classList.toggle('is-fold'), t = e.target.closest('[data-sf-fold]'); t.setAttribute('aria-expanded', String(!f)); t.setAttribute('aria-label', f ? '안전진단 패널 펼치기' : '안전진단 패널 접기'); return; }
    const kd = e.target.closest('.kd[data-n][role="button"]');
    if(kd && !dt){ const sec = kd.closest('[data-mi]'); const mi = sec ? +sec.dataset.mi : scope==='all' ? null : scope; if(mi !== null){ return zoomIn(kd, () => { dt = {mi, k:kd.dataset.n}; render(); }); } }
    const tdc = e.target.closest('[data-dk][data-dm]'); if(tdc && !dt){ pv.hidden = true; const cell = tdc.closest('td') || tdc; return zoomIn(cell, () => { dt = {mi:+tdc.dataset.dm, k:tdc.dataset.dk, w:tdc.dataset.dw}; render(); }); }
    const ly = e.target.closest('[data-lay]'); if(ly){ lay = ly.dataset.lay; return render(); }
    const sc = e.target.closest('[data-sc]'); if(sc) return go(sc.dataset.sc);
    if(menu){ menu = false; bc.innerHTML = crumb(); }
  });
  // 시연 — 다른 미션에 새 위험이 들어온 상태(레일 점 깜빡임 · 새로 표시). 화면에는 단추를 두지 않고 콘솔에서 부른다(APRISM_SAFETY.fire · reset)
  window.APRISM_SAFETY = {
    fire(){ if(fired) return; fired = true; newSeen = false; if(scope===1) scope = 0; M[NEWR[0]].r[NEWR[1]] = NEWR[2].slice(); toasts.unshift({mi:NEWR[0], k:NEWR[1]}); render(); },
    reset(){ mapF = {}; init(); dt = null; render(); }
  };
  // 연관 감지에 올리면 왼쪽 지도의 그 지점이 노랗게
  const hlSet = b => { side.querySelectorAll('.wpm.hl').forEach(x => x.classList.remove('hl')); if(!b) return; const g = side.querySelector(`.wpm[data-w="${b.dataset.dw}"]`); if(g) g.classList.add('hl'); };
  ['mouseover', 'focusin'].forEach(ev => document.addEventListener(ev, e => { const b = e.target.closest && e.target.closest('[data-sf] .lvB.ref .rlx'); if(b) hlSet(b); }));
  ['mouseout', 'focusout'].forEach(ev => document.addEventListener(ev, e => { const b = e.target.closest && e.target.closest('[data-sf] .lvB.ref .rlx'); if(b && !(e.relatedTarget && b.contains(e.relatedTarget))) hlSet(null); }));
  // 메뉴 밖을 누르면 닫는다(상태바 메뉴와 같다)
  document.addEventListener('keydown', e => { if(e.key==='Escape' && menu){ menu = false; bc.innerHTML = crumb(); } });
  // 주소로 장면을 바로 연다(인덱스 링크) — #table 표 · #all 전체 미션 · #detail 자세히 보기(정기 순회 점검 안전감지)
  const h = location.hash.slice(1);
  if(h==='table') lay = 'table'; else if(h==='all') scope = 'all'; else if(h==='detail') dt = {mi:0, k:'안전감지'};
  // 관제 최신 알림의 [안전진단](10/30) — ?mission=관제 미션 이름&detect=감지 종류. 그 미션의 그 감지 카드 자세히 보기를 연다.
  //   관제 미션(screen.js)과 이 화면 미션은 아직 임시 값이라 이름이 어긋날 수 있다 — 같은 이름, 이름 포함 순으로 찾고 못 찾으면 미션 전체.
  //   감지 종류가 이 화면 여섯에 없거나(진동감지) 그 미션이 판정하지 않으면 미션 카드 화면까지만 간다.
  const qs = new URLSearchParams(location.search), qm = qs.get('mission'), qk = qs.get('detect');
  if(qm || qk){
    let mi = qm ? M.findIndex(m => m.mis===qm) : -1;
    if(mi < 0 && qm) mi = M.findIndex(m => qm.includes(m.mis) || m.mis.includes(qm));
    if(mi < 0) scope = 'all';
    else { scope = mi; if(mi===1){ newSeen = true; toasts = toasts.filter(t => t.mi !== 1); } if(K.includes(qk) && M[mi].r[qk]) dt = {mi, k:qk}; }
  }
  render();
})();
