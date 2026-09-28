# 3D 지도 인수 문서 — 퍼블리싱 담당자용

이 폴더는 APRISM 관제 화면의 **지도(Map) 한 덩어리**를 기존 퍼블리싱에 얹기 위한 것입니다.
지도 밖의 UI는 이미 담당자가 만든 것이 정답이고, 이 작업은 그 위에 지도만 갈아 끼웁니다.

- 기준점(베이스라인): `origin/main` = `d04e08a` "카메라가 가다 마는 것을 고친다"
- 작업 브랜치: `map-v2-free-look`
- 결과 화면: `screens/dashboard-home.html`, `screens/mission-setup.html`, `screens/mission-precheck.html`

### 이 폴더에 든 것

```
README.md                      이 문서
shared-files.patch             CSS · screen.js · 화면 세 장의 변경 (40KB)
notes.patch                    작업 노트에 더한 지도 항목 (32KB · 넣어도 되고 안 넣어도 됩니다)
assets/js/map.js               지도의 전부 (88KB)
assets/js/map-model.js         모델을 base64 로 담은 자동 생성 파일 (3.3MB)
assets/model/apro-4f.glb       원본 모델 (2.4MB)
```

`assets/` 아래 세 파일은 저장소와 **같은 경로**입니다. 그 폴더를 통째로 덮어쓰면 자리가 맞습니다.
`apro-4f.glb` 는 화면이 직접 읽지 않습니다. 나중에 모델을 다시 내보낼 때 쓰는 원본입니다.

---

## 0. 작업 범위 — 이것만 하세요

**손대는 것**

| 파일 | 방식 |
| --- | --- |
| `assets/js/map.js` | 통째로 교체 |
| `assets/js/map-model.js` | 통째로 교체 |
| `assets/model/apro-4f.glb` | 통째로 교체 |
| `assets/css/app-shell.css` | 지정한 블록만 추가 |
| `assets/js/screen.js` | 지정한 다섯 곳만 추가 |
| `screens/dashboard-home.html` | 지도 칸 안쪽 마크업만 추가 |
| `screens/mission-setup.html` | 위와 같음 |
| `screens/mission-precheck.html` | 위와 같음 |

**손대지 않는 것**

좌측 사이드바, 상단 바, 우측 미션 패널의 **생김새**, 로봇 카드, 모달, Drawer, AI Assist Panel,
Delta 말풍선, 토큰(`assets/css/tokens.css`), 다른 화면 파일.
아래 3장 "MAP 외 변경"에 적힌 한 건을 빼면 지도 밖의 픽셀은 하나도 바뀌지 않습니다.

---

## 1. 넣는 방법

1. 이 폴더의 `assets/` 를 저장소 `assets/` 에 덮어씁니다. 파일 셋뿐이고, 지도 전용입니다.
   내용은 읽지 말고 그대로 두세요. 특히 `map-model.js` 는 자동 생성 파일이라
   손으로 고치면 안 됩니다.
2. 저장소 뿌리에서 패치를 적용합니다.
   ```
   git apply /경로/map-handover/shared-files.patch
   ```
   이 패치에는 CSS · `screen.js` · 화면 세 장의 변경만 들어 있습니다.
   **통째로 덮어쓰지 않고 더하는 줄만 얹습니다** — 그 파일들은 담당자가 그 사이 고쳤을 수
   있어서입니다.
3. 패치가 어긋나면 아래 4~6장을 보고 손으로 넣으세요. 같은 내용이 적혀 있습니다.

`map-v2-free-look` 브랜치를 함께 받았다면 패치 대신 그 브랜치를 병합해도 됩니다.
충돌은 `app-shell.css` 와 `screen.js` 에서만 나고, 둘 다 **추가**라 양쪽을 다 살리면 됩니다.

### 캐시 도장

이 저장소는 자산 주소에 `?v=<sha1 앞 8자리>` 를 붙입니다.
바꾼 파일마다 도장을 다시 찍어야 브라우저가 새로 받아 갑니다. 커밋 전에 한 번 돌리세요.

```
python tools/stamp-assets.py
```

해시는 **줄바꿈을 LF 로 바꾼 뒤** 계산해야 합니다(저장소가 `core.autocrlf=true` 라서
윈도우에서 그냥 세면 저장소의 다른 도장과 어긋납니다).

이번에 바뀐 도장은 이렇습니다.

```
app-shell.css   53496acf
screen.js       b498f12d
map.js          0bdb0db4
map-model.js    fb8d7fde
```

---

## 2. 지도가 무엇으로 만들어져 있는가

- **three.js r160** 을 CDN 에서 모듈로 받습니다. 번들러는 쓰지 않습니다.
- 모델은 `map-model.js` 가 base64 로 들고 있습니다. `file://` 로 열어도 보여야 해서입니다.
  `assets/model/apro-4f.glb` 는 원본 보관용이고, 화면은 base64 쪽을 씁니다.
- 모델을 다시 내보냈다면 `python tools/inline-model.py` 로 `map-model.js` 를 다시 만듭니다.
  `map-model.js` 를 손으로 고치지 마세요.

화면 `<head>` 에 importmap 이 있어야 합니다. 베이스라인에 이미 들어 있지만,
새 화면에 지도를 붙일 때는 이것부터 확인하세요.

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
```

세 겹 구조입니다.

| 요소 | 역할 |
| --- | --- |
| `.map-view[data-map]` | 지도가 보이는 창. `.two-col` 전체를 덮습니다. `z-index:-1`, `pointer-events:none` |
| `canvas.map-scene[data-map-scene]` | WebGL 캔버스 |
| `.map-canvas` | 손이 닿는 자리. 여기서만 휠·드래그가 먹습니다 |

우측 미션 패널 **뒤까지** 지도가 깔리고, 패널 위에서 휠을 굴려도 지도는 움직이지 않습니다.
이 둘이 동시에 성립해야 해서 창과 조작 영역을 나눠 두었습니다.

---

## 3. MAP 외 변경 — 한 건

지도를 위해 넣었지만 **지도 밖에 보이는** 변경이 한 건 있습니다. 발주자 확인을 마쳤습니다.

### 우측 미션 목록 카드의 선택 테두리

`.timeline-item.is-selected .step-card` 의 1px `--border-brand` 테두리와
`:focus-visible` 테두리, 그리고 `cursor: pointer`.

지도에서 웨이포인트를 누르면 우측 목록의 같은 칸이 선택되는데,
그 선택이 눈에 보여야 해서 넣었습니다. 이것을 빼면 지도→목록 연동이 보이지 않습니다.

진행 상태(완료·수행·대기)의 색은 **건드리지 않습니다**. 선택과 진행은 다른 이야기라
서로 덮으면 안 됩니다. 그래서 테두리 하나로만 표시합니다.

### 참고 — 겉모습이 바뀌지 않는 변경

`assets/js/screen.js` 의 미션 더미 데이터에 `result` · `read` · `measuring` 필드를 넣었습니다.
목록에는 그리지 않고, 지도 웨이포인트 쪽지가 이 값을 읽어 갑니다.
실제 데이터가 붙으면 이 자리를 바꾸면 됩니다.

---

## 4. HTML — 화면 세 장에 넣을 것

`.map-canvas` 안, 도구 레일(`.map-tools`) **다음**에 세 덩이를 넣습니다.
셋 다 `hidden` 으로 시작하고, 자리와 내용은 `map.js` 가 채웁니다.

```html
<!-- 지도 위의 로봇·웨이포인트·설비 쪽지. 자리와 내용은 모두
     assets/js/map.js 가 채운다. 기본은 hidden 이다. -->
<div class="map-wp" data-map-wp hidden>
  <div class="map-card-head">
    <span class="map-card-tag" data-map-wp-chip>정상</span>
    <span class="map-card-name" data-map-wp-name>WP-01</span>
    <button type="button" class="map-card-close" data-map-wp-close aria-label="닫기">
      <span class="i i-16" style="--i:var(--ic-close)" aria-hidden="true"></span>
    </button>
  </div>
  <p class="map-wp-read" data-map-wp-read></p>
  <button type="button" class="btn btn-ghost map-wp-more" data-map-wp-more>상세보기</button>
</div>

<div class="map-bot" data-map-bot hidden>
  <div class="map-bot-tip" data-map-bot-tip hidden>
    <div class="map-card-head">
      <span class="map-card-tag" data-map-bot-tag>로봇</span>
      <span class="map-card-name" data-map-bot-title>ROBOT 01</span>
      <button type="button" class="map-card-close" data-map-bot-close aria-label="닫기">
        <span class="i i-16" style="--i:var(--ic-close)" aria-hidden="true"></span>
      </button>
    </div>
    <dl class="map-card-rows" data-map-bot-rows></dl>
  </div>
  <button type="button" class="map-bot-hit" data-map-bot-open aria-label="로봇 상태 보기">
    <span class="map-bot-halo" aria-hidden="true"></span>
    <span class="map-bot-dot" aria-hidden="true"></span>
  </button>
  <span class="map-bot-name" data-map-bot-name>ROBOT 01</span>
</div>

<div class="map-card" data-map-card hidden>
  <div class="map-card-head">
    <span class="map-card-tag" data-map-card-tag>설비</span>
    <span class="map-card-name" data-map-card-name>설비</span>
    <button type="button" class="map-card-close" data-map-card-close aria-label="닫기">
      <span class="i i-16" style="--i:var(--ic-close)" aria-hidden="true"></span>
    </button>
  </div>
  <dl class="map-card-rows">
    <div><dt>상태</dt><dd data-map-card-state>정상</dd></div>
    <div><dt>최근 점검</dt><dd data-map-card-seen>09:52</dd></div>
    <div><dt>담당 로봇</dt><dd data-map-card-robot>ROBOT 01</dd></div>
  </dl>
</div>
```

화면 아래쪽 `<script>` 줄은 순서가 중요합니다. `map-model.js` 가 `map.js` 보다 먼저 와야 합니다.

```html
<script src="../assets/js/screen.js?v=b498f12d"></script>
<script src="../assets/js/map-model.js?v=fb8d7fde"></script>
<script src="../assets/js/map.js?v=0bdb0db4"></script>
```

---

## 5. CSS — `assets/css/app-shell.css` 에 넣을 것

모두 **추가**입니다. 기존 규칙을 고치는 곳은 `.map-canvas` 커서 한 줄뿐입니다.

| 블록 | 내용 |
| --- | --- |
| `.map-canvas.is-picking` | 설비 위에서만 손가락 커서. 지도에서 누를 수 있는 것은 설비뿐이라는 유일한 표시 |
| `.map-wp` 외 8개 | 웨이포인트 쪽지. 설비 카드와 같은 면·같은 꼬리를 쓰고 머리의 칩 색만 다름 |
| `.timeline-item` 외 3개 | 3장 참고. 지도 밖에 보이는 유일한 규칙입니다 |
| `.map-bot` 외 7개 | 지도 위 로봇 표식. 3D 가 아니라 HTML |
| `.map-card` 외 8개 | 설비 카드 |

색은 전부 디자인 시스템 토큰입니다. Raw color 는 쓰지 않았습니다.
쪽지 칩만 `safe-300` · `warning-500` · `danger-500` · `main-400` 을 직접 부릅니다.

로봇 표식을 3D 가 아니라 HTML 로 둔 이유는 두 가지입니다.
배율을 아무리 올려도 또렷하고, 우측 카드와 같은 자원을 쓸 수 있습니다.
자리(`--x` · `--y`)와 크기(`--bot-zoom`)는 `map.js` 가 매 프레임 넣어 줍니다.

---

## 6. `assets/js/screen.js` — 다섯 곳

지도와 목록을 잇는 배선입니다. 목록의 **생김새는 바꾸지 않습니다**.

1. **미션 더미 데이터** (약 481줄, 1·2번 로봇의 `steps`)
   완료 단계에 `result`(`safe`/`caution`/`danger`)와 `read`(측정 요약 한 줄),
   수행 중 단계에 `measuring` 을 넣습니다.

2. **상수와 이름 짓기** (`stepNode` 바로 위)
   ```js
   var WP_STATE = { done: "completed", running: "current", pending: "upcoming" };

   function wpId(index) {
     return "WP-" + (index + 1 < 10 ? "0" : "") + (index + 1);
   }
   ```
   미션 하나 안에서만 쓰는 이름이라 순번으로 충분합니다. 지도와 목록이 이 값을 나눠 씁니다.

3. **`stepNode()` 끝** — 만든 `<article>` 에 속성을 답니다. 자식은 늘리지 않습니다.
   ```js
   item.setAttribute("data-waypoint", wpId(index));
   item.setAttribute("data-wp-state", kind);
   if (kind === "completed") {
     item.setAttribute("data-wp-result", step.result || "safe");
     item.setAttribute("data-wp-read", step.read || "측정 6항목 · 기준 이내");
   } else if (kind === "current") {
     item.setAttribute("data-wp-read", step.measuring || "측정 항목 확인 중");
   }
   item.setAttribute("tabindex", "0");
   ```

4. **`render()` 끝** — 지금 수행 중인 칸을 알리고, 고른 칸은 놓습니다.
   미션이 바뀌면 고른 칸은 놓습니다. 앞 미션의 셋째 칸을 짚어 두었다고
   다음 미션의 셋째 칸을 짚은 것은 아닙니다.
   지금 하는 칸은 놓지 않습니다. 그것은 사람이 고른 것이 아니라 미션이 정한 것입니다.

5. **고르기 배선** — `paintPicked()` · `pickWaypoint()` 와 click · keydown 리스너,
   그리고 지도에서 오는 `aprism:waypoint` 수신.

---

## 7. 지도와 화면 사이의 약속

두 파일은 서로를 직접 부르지 않습니다. DOM 속성과 CustomEvent 로만 이야기합니다.
한쪽만 넣어도 다른 쪽이 깨지지 않게 하려는 것입니다.

### 지도가 읽는 것

| 자리 | 뜻 |
| --- | --- |
| `.robot-strip .robot-card[data-robot]` | 우측 로봇 띠. `aria-pressed="true"` 인 카드가 지금 고른 로봇 |
| `[data-robot-offline]` | 이 카드는 눌러도 지도가 반응하지 않음 |
| `[data-timeline] [data-waypoint]` | 웨이포인트 목록. 지도는 **여기를 원본으로 읽습니다** |
| `data-wp-state` | `completed` · `current` · `upcoming` |
| `data-wp-result` | `safe` · `caution` · `danger` (완료 칸에만) |
| `data-wp-read` | 측정 요약 한 줄. 쪽지 본문이 됩니다 |
| `.step-title` | 웨이포인트 이름 |

웨이포인트 값은 **목록에만** 있습니다. 같은 값을 지도와 목록 두 군데에 적어 두면 언젠가 어긋납니다.

### 주고받는 알림

| 이름 | 방향 | detail |
| --- | --- | --- |
| `aprism:mission` | 목록 → 지도 | `{ current }` 목록을 다시 그렸다. 표식을 새로 깔아라 |
| `aprism:waypoint` | 양쪽 | `{ id, from }` `from` 은 `"panel"` 또는 `"map"` |

알림은 **온 쪽으로 되돌려 보내지 않습니다**. 두 쪽이 서로를 끝없이 부르는 것을 막습니다.

### 상태를 둘로 나눠 든 이유

```
currentWaypointId    미션이 정하는 것 — 지금 로봇이 하고 있는 칸
selectedWaypointId   사람이 짚은 것 — 들여다보려고 고른 칸
```

한 자리에 두면 로봇이 다음 칸으로 넘어갈 때 사람이 보던 칸이 튕겨 나갑니다.

---

## 8. 마이크로 인터랙션 — 검수 목록

### 카메라

- [ ] 휠·두 손가락 오므리기로 확대·축소. **커서 밑이 제자리에 남습니다**
- [ ] 끌면 돌아봅니다. 좌우로 한 바퀴, 위로는 탑뷰(89°)까지
- [ ] **바닥 아래로는 내려가지 않습니다**(최저 6°)
- [ ] Shift · 가운데 버튼 · 오른쪽 버튼으로 끌면 판이 밀립니다
- [ ] `[전체 보기]` 처음 자리·처음 배율로 되돌아갑니다
- [ ] `[탑뷰]` 바로 위에서 내려다봅니다
- [ ] 우측 미션 패널 위에서 휠을 굴려도 지도는 가만히 있습니다
- [ ] 확대 단계에 따라 벽이 투명해집니다(X-ray)

카메라는 투시인데 아주 약합니다. 카메라를 멀리 세우고 화각을 좁혀 깊이만 느껴질 만큼 남겼습니다.
원근을 세게 주면 같은 크기의 설비가 자리마다 다르게 보여 배치를 읽기 어렵습니다.

### 설비

- [ ] 설비 위에 손을 얹으면 커서가 손가락이 되고 **얇은 외곽선**이 뜹니다
- [ ] 누르면 외곽선이 밝아지고 면이 물들며 카드가 뜹니다
- [ ] 외곽선은 실제 mesh 를 따라갑니다. 사각형 bounding box 가 아닙니다
- [ ] **정육면체 설비는 보이는 모서리 9개에만** 선이 갑니다. 뒤의 3개는 긋지 않습니다
- [ ] 모서리 하나에 선이 **한 줄**입니다. 라운딩된 설비도 두 줄로 갈라지지 않습니다
- [ ] 카메라를 돌리면 외곽선도 따라 바뀝니다

외곽선은 카메라를 기준으로 그때그때 뽑습니다. 한 면은 이쪽을 보고 한 면은 등을 돌린
경계가 실루엣입니다. 필렛(둥근 모서리)은 가까운 넓은 면에 배정해서 두 쪽이 한 줄로 만납니다.

### 로봇과 경로

- [ ] 우측 로봇 카드를 누르면 그 로봇의 경로만 보입니다. **나머지는 숨습니다**
- [ ] 지도의 로봇 표식은 동그라미입니다. 고른 로봇에는 30% 불투명도의 큰 원이 생깁니다
- [ ] 로봇 표식을 누르면 상태 툴팁이 뜹니다
- [ ] 바닥의 부채꼴이 로봇이 보는 쪽을 알려 줍니다. 로봇 쪽이 진하고 멀수록 옅어집니다
- [ ] 확대하면 로봇 표식도 같이 커집니다
- [ ] 경로는 꺾이는 자리가 둥글려져 있습니다
- [ ] 경로는 도킹 스테이션에서 나갔다가 되돌아오는 왕복입니다
- [ ] **경로가 벽과 설비를 통과하지 않습니다**

길은 바닥을 격자로 잘라 BFS 로 찾습니다. 벽 판정은 삼각형을 격자에 직접 칠하는 방식입니다.
칸마다 아래로 광선을 쏘면 칸보다 얇은 벽을 놓칩니다.

경로선은 화면 좌표 굵기(`Line2`)입니다. `THREE.Line` 의 굵기는 WebGL 에서 언제나 1px 이라
쓸 수 없습니다. 창 크기가 바뀌면 `mat.resolution` 을 다시 넣어야 합니다.

### 웨이포인트

- [ ] 경로 위에 일곱 자리가 찍혀 있습니다
- [ ] 상태별로 색이 다릅니다. safe 초록 · caution 노랑 · danger 빨강 · current 파랑 · upcoming 회색
- [ ] 고른 표식은 **색이 변하지 않고** 바깥에 흰 고리가 하나 생깁니다
- [ ] 지도 표식을 누르면 쪽지가 뜹니다. 이름 · 검사 상태 칩 · 측정 요약 · 상세보기
- [ ] 지도 표식을 누르면 우측 목록의 같은 칸에 테두리가 생깁니다
- [ ] 그 칸이 화면 밖이면 **거기까지 부드럽게 굴러갑니다**
- [ ] 우측 칸을 누르면 지도가 그 자리로 카메라를 데려갑니다
- [ ] 우측에서 같은 칸을 다시 누르면 선택이 풀립니다
- [ ] 로봇을 바꾸면 고른 칸은 풀리고, 수행 중인 칸은 그대로 남습니다

지도에서 누른 것은 카메라를 움직이지 않습니다. 이미 보고 있으니까요.

---

## 9. 자주 걸리는 함정

**모델을 바꿨는데 외곽선이 안 나옵니다.**
`EdgesGeometry` 는 꼭짓점을 소수 넷째 자리로 맞춰 붙입니다. 모델이 너무 작으면 다 붙어 버립니다.
그래서 불러온 뒤 긴 변이 120 이 되게 키웁니다(`SPAN_UNITS`).

**그림자가 안 보입니다.**
빛이 카메라와 같은 쪽에 있으면 그림자가 전부 물체 뒤에 숨습니다. 빛을 옆으로 돌리세요.

**벽 너머로 선이 비칩니다.**
면을 반투명으로 만들면서 `depthWrite` 를 끄면 뒤의 선이 그대로 보입니다.
가려야 하는 것은 완전히 불투명하게 두세요.

**웨이포인트 점이 경로선에 덮입니다.**
`renderOrder` 를 경로선보다 높게 주세요. 경로가 2, 점이 3입니다.

**바닥 높이가 이상합니다.**
모델 바운딩 박스의 최저점이 아니라 `00_floor` 레이어의 윗면을 씁니다.
계단이 바닥보다 아래로 내려가서 그렇습니다.

**`file://` 로 열었더니 모델이 안 보입니다.**
그러라고 `map-model.js` 가 있습니다. 이 파일이 먼저 로드됐는지 확인하세요.

---

## 10. 확인하는 법

정적 서버 하나면 충분합니다. 빌드 과정은 없습니다.

```
python -m http.server 8000
```

그리고 `http://localhost:8000/screens/dashboard-home.html` 을 엽니다.
`file://` 로 열어도 지도는 보입니다. three.js 만 CDN 에서 받으면 되니 인터넷은 필요합니다.

콘솔에 오류가 없어야 합니다. `favicon.ico` 404 는 무시해도 됩니다.

---

## 11. 더 읽을 것

지도를 이렇게 만든 이유와 중간에 버린 방법들은 작업 노트
`screens/dashboard-home-notes.html` 의 9-9 · 9-10-1 ~ 9-10-5 항목에 적어 두었습니다.
그 항목은 이 폴더의 `notes.patch` 에 들어 있습니다.

```
git apply /경로/map-handover/notes.patch
```

화면 동작과는 상관없는 문서라 넣지 않아도 됩니다.
다만 같은 문제를 다시 만나면 거기부터 보는 편이 빠릅니다.
