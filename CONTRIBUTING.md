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
PR 설명에는 바뀐 화면과 이유를 짧게 적습니다.

### 5. 확인 뒤 합치기

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
