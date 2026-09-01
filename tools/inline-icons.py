# assets/icons/*.svg 를 app-shell.css 안에 data URI 로 인라인한다.
#
# 왜 필요한가: 아이콘은 CSS mask-image 로 그리는데, 브라우저는 file:// 로 연 페이지에서
# mask 로 쓰는 외부 SVG 로드를 교차 출처로 막는다. 로컬에서 index.html 을 그냥 열면
# 아이콘이 전부 사라진다. data URI 로 박아 두면 외부 요청이 없어 file:// 에서도 보인다.
#
# 아이콘 SVG 를 바꾼 뒤 커밋 전에 실행한다:  python tools/inline-icons.py
# app-shell.css 의 /* icons:start */ ~ /* icons:end */ 블록만 다시 쓴다.
import io
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "assets", "icons")
CSS = os.path.join(ROOT, "assets", "css", "app-shell.css")

START = "/* icons:start */"
END = "/* icons:end */"

# url() / data URI 안에서 문제가 되는 문자만 최소로 퍼센트 인코딩한다. 공백은 그대로 둔다(가독성).
SUBS = [("%", "%25"), ("&", "%26"), ("#", "%23"), ("<", "%3C"), (">", "%3E"),
        ('"', "%22"), ("{", "%7B"), ("}", "%7D"), ("|", "%7C"), ("\\", "%5C"),
        ("^", "%5E"), ("`", "%60")]


def var_name(filename):
    stem = filename[:-4]  # .svg
    if stem.startswith("icon-"):
        stem = stem[5:]
    return "--ic-" + stem


def encode(svg):
    svg = svg.strip()
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = re.sub(r">\s+<", "><", svg)
    svg = re.sub(r"\s{2,}", " ", svg)
    for a, b in SUBS:
        svg = svg.replace(a, b)
    return svg


def build_block():
    lines = [START,
             "/* assets/icons/*.svg 를 data URI 로 인라인한 것. tools/inline-icons.py 가 생성한다.",
             " * 손으로 고치지 말 것 — 아이콘을 바꾼 뒤 스크립트를 다시 실행한다.",
             " * file:// 로 열어도 mask 아이콘이 보이게 하려는 것이다. */",
             ":root {"]
    for name in sorted(os.listdir(ICON_DIR)):
        if not name.endswith(".svg"):
            continue
        with io.open(os.path.join(ICON_DIR, name), encoding="utf-8") as f:
            data = encode(f.read())
        lines.append('  %s: url("data:image/svg+xml,%s");' % (var_name(name), data))
    lines.append("}")
    lines.append(END)
    return "\n".join(lines)


def main():
    with io.open(CSS, encoding="utf-8") as f:
        src = f.read()
    if START not in src or END not in src:
        print("WARNING  app-shell.css 에 %s ~ %s 마커가 없다." % (START, END))
        return 1
    new = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: build_block(),
                 src, count=1, flags=re.S)
    if new == src:
        print("변경 없음 — 이미 최신이다.")
        return 0
    with io.open(CSS, "w", encoding="utf-8", newline="\n") as f:
        f.write(new)
    print("inlined  assets/css/app-shell.css (아이콘 %d개)" %
          len([n for n in os.listdir(ICON_DIR) if n.endswith(".svg")]))
    print("이어서:  python tools/stamp-assets.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
