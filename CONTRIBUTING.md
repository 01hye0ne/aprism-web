# 함께 작업하는 방법

main 에는 직접 올리지 않고, 작업마다 브랜치를 만들어 PR(Pull Request)로 합칩니다.

## 작업 순서

### 1. 시작 전에 main 을 최신으로

```
git checkout main
git pull
```

### 2. 작업용 브랜치 만들기

이름은 `edit/할일` 형식으로 짓습니다.

```
git checkout -b edit/delta-wording
```

### 3. 수정하고 커밋하기

CSS·JS 를 고쳤다면 **커밋 전에 꼭** 아래를 실행합니다.

```
python tools/stamp-assets.py
```

HTML 이 불러오는 CSS·JS 주소 뒤의 `?v=` 값을 새로 매기는 스크립트입니다.
빠뜨리면 다른 사람 브라우저에는 캐시된 예전 CSS·JS 가 그대로 남아 화면이 어긋나 보입니다.

```
git add .
git commit -m "무엇을 왜 바꿨는지 한 줄"
```

### 4. 올리고 PR 열기

```
git push -u origin edit/delta-wording
```

GitHub 저장소에 뜨는 **Compare & pull request** 버튼을 눌러 `main` 으로 PR 을 엽니다.
PR 설명에는 바뀐 화면과 이유를 짧게 적습니다. 설명 칸에는 양식(`.github/pull_request_template.md`)이 미리 채워집니다.

### 5. 미리보기 (Preview)

PR 을 열 때 바뀐 화면을 바로 열어 볼 수 있는 링크를 **미리보기** 칸에 적습니다.
GitHub Pages 는 main 만 보여 주므로, 브랜치 화면은 아래 주소로 엽니다.

```
https://raw.githack.com/01hye0ne/aprism-web/브랜치이름/screens/화면.html
```

예: `https://raw.githack.com/01hye0ne/aprism-web/edit/delta-wording/screens/safety-v6.html`

- push 할 때마다 같은 링크에 새 내용이 반영됩니다. 몇 분 늦게 바뀔 수 있습니다.
- 비교용으로 main 화면(`https://01hye0ne.github.io/aprism-web/screens/화면.html`)도 함께 적습니다.

push 전에 내 컴퓨터에서 먼저 보려면 저장소 폴더에서 아래를 실행합니다.

```
node tools/serve.mjs screens/safety-v6.html
```

`http://localhost:5180/screens/safety-v6.html` 이 열립니다. 캐시를 끄고 띄우므로 고친 CSS·JS 가 새로고침만으로 바로 보입니다.
다른 브랜치를 보려면 `git checkout 브랜치이름` 뒤 새로고침합니다.

### 6. 확인 뒤 합치기

검토가 끝나면 **Merge pull request** 로 합치고, **Delete branch** 로 브랜치를 지웁니다.

## 지켜 주세요

- **PR 하나에 작업 하나.** 이미지 교체와 문구 수정처럼 성격이 다른 일은 PR 을 나눕니다.
- **다시 고칠 때는 같은 브랜치에 커밋을 더합니다.** `-2` 같은 새 브랜치를 만들지 않습니다.
  PR 이 열려 있으면 같은 브랜치에 push 한 내용이 그 PR 에 자동으로 붙습니다.
- **PR 을 연 사이 main 이 바뀌었다면** 브랜치에서 최신 main 을 합친 뒤 push 합니다.

  ```
  git pull origin main
  git push
  ```

  충돌이 나면 혼자 정하기 어려운 부분은 PR 댓글로 물어봐 주세요.
- **main 에 직접 push 하지 않습니다.**
- `_backup/` 폴더와 표기 v3·v4 화면(`*-v2-2.html`, `*-v3.html`)은 더 고치지 않습니다. 작업은 `*-v5.html` 에서 합니다.
