# 작은 크기용 아이콘 만들기 — assets/icons/outline/*.svg(24 격자) → assets/icons/outline-16/*.svg
#
# 2026-10-14 디자이너: 24 격자 아이콘을 16px 로 줄이면 2px 선이 1.33px 가 되어 약하다.
# Figma 아웃라인 세트(01.7 Icon · 1142:32478)는 선(stroke)으로 그려져 있으므로 선 굵기만 RATIO 배로 올린다
# (16px 에서 2px 선 → 약 1.73px). 면으로 칠한 도형은 그대로다. 모양 · 격자 · 여백은 24 세트와 같다.
# Figma 에 16 세트가 생기면 그쪽으로 바꾼다.
#
#   python tools/make-icons-small.py && python tools/inline-icons-outline.py
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "icons", "outline")
DST = os.path.join(ROOT, "assets", "icons", "outline-16")
RATIO = 1.3


def thicken(svg):
    return re.sub(r'stroke-width="([\d.]+)"',
                  lambda m: 'stroke-width="%s"' % ("%.2f" % (float(m.group(1)) * RATIO)).rstrip("0").rstrip("."), svg)


def main():
    os.makedirs(DST, exist_ok=True)
    for f in os.listdir(DST):
        if f.endswith(".svg"):
            os.remove(os.path.join(DST, f))
    n = 0
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".svg"):
            continue
        with io.open(os.path.join(SRC, name), encoding="utf-8") as f:
            svg = f.read()
        with io.open(os.path.join(DST, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(thicken(svg))
        n += 1
    print("wrote", n, "icons -> assets/icons/outline-16")


if __name__ == "__main__":
    main()
