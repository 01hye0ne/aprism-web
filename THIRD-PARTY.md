# 외부 자산과 라이선스

`aprism-web` 이 쓰는 남의 것들을 한곳에 모았습니다. 제품 판매를 앞두고 검토받으실 때
근거가 흩어져 있지 않도록 정리한 문서입니다.

마지막 확인: 2026-09-03

## 한눈에

| 항목 | 쓰는 곳 | 라이선스 | 제품에 넣어 팔 때 |
|---|---|---|---|
| React Bits — BorderGlow | 주의 상태 엣지 글로우 | MIT + Commons Clause | **가능** · 조건 있음 |
| React Bits — Strands | `strands-lab.html` | MIT + Commons Clause | **가능** · 조건 있음 |
| JetBrains Mono | 수치·코드 표기 | SIL OFL 1.1 | 가능 |
| IBM Plex Sans / Mono | 실험실 페이지 비교용 | SIL OFL 1.1 | 가능 |
| SUIT Variable | 화면 전체 본문 서체 | **확인 필요** | 확인 후 판단 |
| 아이콘 26개 | 화면 전반 | 자체 제작 추정 · **확인 필요** | 확인 후 판단 |
| Claude Design 핸드오프 번들 | `assets/robot-dog/` · `assets/prism-orb/` | 작업 자료 · 배포 안 됨 | 해당 없음 |

---

## React Bits

- **저작자** — Copyright (c) 2026 David Haz
- **라이선스** — MIT + Commons Clause License Condition v1.0
- 두 컴포넌트를 씁니다. 라이선스 조건은 둘 다 같습니다.

### BorderGlow — 실제 화면에 쓰입니다

- **쓰는 곳** — 대시보드 **주의(Warning) 상태 엣지 글로우**. `assets/css/app-shell.css` 안입니다.
- **출처** — <https://reactbits.dev/components/border-glow> · 레지스트리 `https://reactbits.dev/r/BorderGlow-JS-CSS.json`
- 원본은 React 컴포넌트지만 **움직임이 전부 CSS 에 있습니다.** JSX 가 하는 일은
  포인터 위치를 읽어 `--cursor-angle` · `--edge-proximity` 두 변수를 쓰는 것뿐입니다.
  커서를 안 쓰므로 **JSX 는 안 가져왔고 자바스크립트가 한 줄도 없습니다.**
- **원본과 다르게 둔 것**
  - **도는 빛을 박동으로 바꿨습니다.** 커서 원뿔 마스크와 두 변수 계산식을 빼고,
    네 변이 한꺼번에 2초에 두 번 뛰고 쉬도록 했습니다.
  - **흐린 그림자 스택을 또렷한 선 둘로 바꿨습니다** — 2~6px 이 4px 60%,
    6~8px 이 2px 20% 입니다. 원본은 한 번에 잦아드는 흐린 번짐 한 겹입니다.
  - **제자리에 있는 건 맨 바깥 1px 색 테두리뿐입니다.** 그 안쪽에서 선 한 쌍이 태어나
    **안쪽 44px 까지 미끄러지며 사라집니다** — 원본에 없는 층입니다.
  - 색은 warning 램프에서 **Delta 오브(`assets/js/prism-orb.js`)의 `PALETTES.warning`** 으로
    옮겼습니다 — 오브 · Spectrum · 엣지 글로우가 같은 팔레트에서 나옵니다.
    (원본 기본값은 보라·분홍·하늘입니다.)
  - 안쪽 면을 물들이는 층은 뺐습니다(지도 위에 색 얼룩이 상시로 뜨게 됩니다).
    테두리 링은 지도 때문에 원본의 배경색 덮기 대신 마스크로 잡았습니다 — 결과는 같습니다.

### Strands — 검토용입니다

- **쓰는 곳** — `strands-lab.html` (검토용 페이지). 실제 화면에는 얹지 않았습니다.
- **출처** — <https://reactbits.dev/animations/strands> · 레지스트리 `https://reactbits.dev/r/Strands-JS-CSS.json`
- 원본은 `ogl` 에 의존합니다. 이 저장소에는 빌드 단계가 없어서
  **프래그먼트 셰이더는 원본 그대로 두고 캔버스·uniform 껍데기만 순수 WebGL2 로 옮겼습니다.**

저작권 표시는 `app-shell.css` 의 엣지 글로우 블록 머리와 `strands-lab.html` 의 스크립트 머리에
들어 있습니다 — 라이선스가 요구하는 사항이라 **다른 곳에 또 옮겨 쓸 때도 같이 따라가야 합니다.**

**판매해도 됩니다.** 라이선스가 그 경우를 명시합니다.

> …rights to use, copy, modify, merge, publish, and distribute the Software
> **as part of an application, website, or product**…
>
> You may use this Software, **including for any commercial purpose**, so long as you do not
> sell, sublicense, or redistribute **the components themselves** — whether alone, in a bundle,
> or as a ported version.

**금지되는 것은 컴포넌트 자체를 파는 것**입니다. 즉 팔리는 물건이 컴포넌트일 때입니다.

- 이 컴포넌트들이 들어간 UI 킷 · 템플릿 · 컴포넌트 라이브러리를 판매
- 고객사에 재사용 가능한 컴포넌트 파일로 넘기는 것
- 이식본을 우리 것인 양 배포하는 것

APRISM 이 관제 대시보드 **제품**으로 팔리는 한 이 셋에 해당하지 않습니다.
**다만 디자인 시스템이나 화면 템플릿을 따로 떼어 파는 방향이 생기면 그때는 선에 가까워집니다.**

---

## 웹폰트

셋 다 **런타임에 외부 CDN 에서 내려받습니다.** 저장소에 폰트 파일은 없습니다.
판매용 제품이라면 CDN 의존을 없애기 위해 **자체 호스팅으로 옮기는 것을 권합니다** —
CDN 이 죽으면 서체가 무너지고, 사용자 브라우저가 외부에 요청을 보내는 것도 환경에 따라 문제가 됩니다.

### JetBrains Mono — SIL OFL 1.1

- Google Fonts 로 불러옵니다. 수치·타임스탬프 표기에 씁니다.
- <https://github.com/JetBrains/JetBrainsMono> · `OFL.txt`
- OFL 은 임베딩·재배포·상업적 사용을 허용합니다. 폰트 자체를 파는 것만 금지입니다.

### IBM Plex Sans / Mono — SIL OFL 1.1

- `tone-lab.html` · `type-lab.html` 의 서체 비교용입니다. 제품 화면에는 쓰지 않습니다.
- <https://github.com/IBM/plex> · `LICENSE.txt`

### SUIT Variable — 확인 필요

- 화면 전체의 본문 서체입니다. **가장 넓게 쓰이는 자산이라 우선순위가 높습니다.**
- `https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/static/woff2/SUIT.css` 로 불러옵니다.
- **문제** — 우리가 불러오는 저장소 `github.com/sunn-us/SUIT` 에는 **LICENSE 파일이 없고
  README 도 두 줄뿐입니다.** GitHub API 도 라이선스를 인식하지 못합니다.
- SUIT 는 일반적으로 SIL OFL 로 배포되는 것으로 알려져 있으나 **여기서 확인되지 않았습니다.**
- **해야 할 일** — 배포처(sun.fo)나 제작자에게 라이선스 전문을 확인하고, 그 사본을 이 저장소에 보관.

---

## 아이콘 26개

- `assets/icons/*.svg` — `brand-mark` 와 `icon-*` 25개. `tools/inline-icons.py` 가
  `app-shell.css` 안에 data URI 로 인라인합니다.
- **출처** — Figma 디자인 시스템(`UI_00_Design System`)에서 내보낸 것입니다.
- **확인 필요** — 이름이 `home` · `bot` · `cpu` · `calendar` · `panel-left` 처럼
  **널리 쓰이는 오픈 아이콘 세트(Lucide 등)의 작명과 겹칩니다.** 실제 path 는 면으로 채운
  모양이라 그 세트를 그대로 쓴 것으로는 보이지 않지만, **밑그림으로 삼았는지는 그린 분만 압니다.**
- 자체 제작이면 문제 없습니다. 어떤 세트를 바탕으로 했다면 그 세트의 라이선스가 따라옵니다
  (Lucide 는 ISC 라 표시만 하면 상업적 사용이 자유롭습니다).

---

## 자체 제작 자산

라이선스 문제가 없는 것들입니다. 기록만 남깁니다.

- `assets/js/prism-orb.js` — Delta 의 오브. Claude Design 핸드오프(`assets/prism-orb/`)의
  프로토타입을 옮긴 것입니다. **원본은 three.js 를 esm.sh 에서 불러 쓰지만 이쪽은 안 씁니다** —
  셰이더는 그대로 두고 three 가 하던 일(기하 · 행렬 · 렌더타깃)만 순수 WebGL2 로 다시 썼습니다.
  **저장소에도 화면에도 three.js 는 들어오지 않습니다.**
- `assets/img/robot-graphic.svg` — Figma 의 `Robot-Graphic` 내보내기
- `assets/figma/map-temp.svg` — Figma 지도 자리표시자
- `assets/css/tokens.css` — Figma 변수에서 옮긴 디자인 토큰
- 모든 화면 · 컴포넌트 마크업과 스타일

---

## 배포되지 않는 작업 자료

- `assets/robot-dog/` · `assets/prism-orb/` — Claude Design(claude.ai/design) 핸드오프 번들입니다.
  각각 로봇 걷는 모션과 Delta 오브를 만들 때 쓴 원본 프로젝트로,
  **퍼블리싱된 화면은 이 폴더들을 참조하지 않습니다.**
- 그 안의 `project/support.js` 는 Claude Design 런타임 생성물이고
  `unpkg.com` 에서 React · Babel 을 불러옵니다. **이 저장소의 화면과는 무관합니다.**
  오브 원본(`assets/prism-orb/project/Prism Orb.dc.html`)이 불러오는 three.js 도 마찬가지입니다 —
  화면이 쓰는 것은 그걸 옮긴 `assets/js/prism-orb.js` 이고, 거기엔 외부 의존이 없습니다.
- `_backup/` — 작업 중 남긴 백업본입니다.
- `assets/source/` — Figma 에서 내보낸 파일을 그냥 두는 곳입니다.
  쓰는 파일은 `assets/icons/` · `assets/img/` 등 제자리로 옮겨지므로,
  **여기 남아 있는 것은 화면이 참조하지 않는 파일입니다.**

판매용 빌드를 만들 때는 위 셋을 **제외**하는 편이 깔끔합니다.

---

## 판매 전 점검표

- [ ] **SUIT 라이선스 전문 확보** — 가장 넓게 쓰이는 자산입니다
- [ ] **아이콘 26개의 출처 확인** — 자체 제작인지, 어떤 세트를 바탕으로 했는지
- [x] React Bits 를 실제 화면에 얹을 때 **저작권 주석이 함께 따라갔는지** — `app-shell.css` 엣지 글로우 블록 머리에 있음
- [ ] 웹폰트 **자체 호스팅**으로 전환 (CDN 의존 · 외부 요청 제거)
- [ ] 배포 빌드에서 `assets/robot-dog/` · `assets/prism-orb/` · `_backup/` · `assets/source/` 제외
- [ ] 디자인 시스템을 **따로 떼어 파는 계획**이 생기면 React Bits 조항 재검토

---

이 문서는 라이선스 문구를 읽고 정리한 것이지 법률 자문이 아닙니다.
실제 판매 계약을 앞두시면 위 항목을 근거로 한 번 검토받으시길 권합니다.
