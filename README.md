# APRISM Web

Figma 와이어프레임을 기준으로 작업한 APRISM 화면의 웹 퍼블리싱 결과물입니다.
GitHub Pages로 배포해 여러 사람이 브라우저에서 바로 확인할 수 있게 합니다.

## 제품 개요

- **APRISM** — 공장 내부 환경점검 로봇을 관제하는 Responsive Desktop Dashboard
- 기본 테마는 **Dark Mode**, Light Mode도 동일한 기능과 정보 위계로 제공
- 핵심 기능: 대화형 AI, 지도/로봇/감지 결과, 미션 및 way-point 관리

## 폴더 구조

```text
aprism-web/
├── index.html          # 화면 목록 인덱스
├── screens/            # 개별 화면 페이지
└── assets/
    ├── css/base.css    # 공통 토큰 및 기본 스타일
    └── js/theme.js     # Dark/Light 테마 전환
```

## 로컬에서 확인하기

정적 파일이라 `index.html`을 브라우저로 열어도 되고, 로컬 서버를 띄워도 됩니다.

```bash
# Python 3
python -m http.server 8000
# http://localhost:8000 접속
```

## 배포

`main` 브랜치에 push하면 GitHub Pages에 반영됩니다.
배포 주소는 저장소 설정(Settings → Pages)에서 확인할 수 있습니다.

## 작업 규칙

- 색상은 `assets/css/base.css`의 semantic 토큰을 사용하고 raw hex를 컴포넌트에 직접 넣지 않습니다.
- Dark/Light는 별도 페이지를 만들지 않고 `data-theme` 속성으로 전환합니다.
- 감지 상태는 위험(Danger) / 주의(Warning) / 안전(Safe) 세 단계를 유지합니다.
