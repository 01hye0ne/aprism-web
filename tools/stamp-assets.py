# CSS/JS 링크에 내용 해시를 붙인다.
#
# 왜 필요한가: HTML 은 바뀌었는데 브라우저가 예전 CSS 를 계속 쓰면 화면이 깨진다.
# 실제로 그런 일이 있었다 — HTML 에 새 wrapper 를 넣었는데 캐시된 CSS 에는
# 그 규칙이 없어서 wrapper 가 display:block 으로 떨어졌고 레이아웃이 무너졌다.
#
# 해시는 파일 내용에서 나오므로 CSS 를 고칠 때만 바뀐다. 안 고치면 캐시가 그대로 산다.
# CSS 나 JS 를 수정한 뒤 커밋 전에 실행한다:  python tools/stamp-assets.py
import hashlib
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATTERN = re.compile(r'(?P<attr>href|src)="(?P<path>[^"]*?assets/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"')

cache = {}


def digest(abs_path):
    if abs_path not in cache:
        with io.open(abs_path, "rb") as f:
            cache[abs_path] = hashlib.sha1(f.read()).hexdigest()[:8]
    return cache[abs_path]


def stamp(html_path):
    rel_dir = os.path.dirname(html_path)
    with io.open(html_path, encoding="utf-8") as f:
        src = f.read()

    missing = []

    def repl(m):
        asset = os.path.normpath(os.path.join(rel_dir, m.group("path")))
        if not os.path.isfile(asset):
            missing.append(m.group("path"))
            return m.group(0)
        return '%s="%s?v=%s"' % (m.group("attr"), m.group("path"), digest(asset))

    out = PATTERN.sub(repl, src)
    changed = out != src
    if changed:
        with io.open(html_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(out)
    return changed, missing


def main():
    touched, problems = [], []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "tools")]
        for name in files:
            if not name.endswith(".html"):
                continue
            path = os.path.join(base, name)
            changed, missing = stamp(path)
            rel = os.path.relpath(path, ROOT).replace("\\", "/")
            if changed:
                touched.append(rel)
            for m in missing:
                problems.append("%s -> %s (파일 없음)" % (rel, m))

    for t in touched:
        print("stamped  " + t)
    for p in problems:
        print("WARNING  " + p)
    if not touched:
        print("변경 없음 — 이미 최신 해시다.")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
