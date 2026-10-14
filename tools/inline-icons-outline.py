# assets/icons/outline/*.svg 를 assets/css/icons-outline.css 안에 data URI 로 인라인한다.
#
# 2026-10-14 아이콘 개편(Figma 01.7 Icon · "아웃라인" 섹션 1142:28126). v2.2 에만 쓴다 —
# 지난 판(v1 · v2 · v2.1)은 app-shell.css 의 기존 아이콘(assets/icons/*.svg)을 그대로 둔다.
# .v2-2 아래에서 같은 --ic-* 이름을 덮으므로 화면 마크업은 고치지 않는다.
#
# 아이콘 SVG 를 바꾼 뒤 커밋 전에 실행한다:  python tools/inline-icons-outline.py
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module

base = import_module("inline-icons")   # encode() · var_name() 를 같이 쓴다

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "assets", "icons", "outline")
OUT = os.path.join(ROOT, "assets", "css", "icons-outline.css")

# 코드에만 있던 이름 — 새 세트의 가까운 아이콘으로 잇는다.
ALIAS = {"--ic-play-sm": "--ic-play"}


def main():
    lines = [
        "/* assets/icons/outline/*.svg 를 data URI 로 인라인한 것. tools/inline-icons-outline.py 가 생성한다.",
        " * 손으로 고치지 말 것. v2.2(.v2-2) 에서만 기존 --ic-* 를 새 아웃라인 아이콘으로 덮는다. */",
        ".v2-2 {",
    ]
    for name in sorted(os.listdir(ICON_DIR)):
        if not name.endswith(".svg"):
            continue
        with io.open(os.path.join(ICON_DIR, name), encoding="utf-8") as f:
            data = base.encode(f.read())
        lines.append('  %s: url("data:image/svg+xml,%s");' % (base.var_name(name), data))
    for a, b in ALIAS.items():
        lines.append("  %s: var(%s);" % (a, b))
    lines.append("}")
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", os.path.relpath(OUT, ROOT), len(lines) - 4, "icons")


if __name__ == "__main__":
    main()
