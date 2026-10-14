# 작은 크기용 아이콘 만들기 — assets/icons/outline/*.svg(24 격자) → assets/icons/outline-16/*.svg
#
# 2026-10-14 디자이너: 24 격자 아이콘을 16px 로 줄이면 2px 획이 1.33px 가 되어 약하다.
# 도형 바깥선을 고르게 OFFSET 만큼 밀어(구멍은 그만큼 좁아진다) 16px 에서 획이 약 1.75px 로 보이게 한다.
# 모양 · 격자 · 여백은 24 세트 그대로다 — 굵기만 다르다. Figma 에 16 세트가 생기면 그쪽으로 바꾼다.
#
#   pip install pyclipper svgpathtools
#   python tools/make-icons-small.py && python tools/inline-icons-outline.py
import io
import os
import re

import pyclipper
from svgpathtools import parse_path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "icons", "outline")
DST = os.path.join(ROOT, "assets", "icons", "outline-16")

OFFSET = 0.3      # 24 격자 단위 · 한쪽. 16px 에서 2px 획 → 1.33 + 0.4 ≈ 1.75px
STEP = 0.2        # 곡선을 이 길이마다 점으로 나눈다
SCALE = 1000      # clipper 는 정수 좌표


def path_polys(d):
    polys = []
    for sub in parse_path(d).continuous_subpaths():
        pts = []
        for seg in sub:
            n = max(2, int(seg.length() / STEP) + 1)
            for i in range(n):
                p = seg.point(i / n)
                pts.append((round(p.real * SCALE), round(p.imag * SCALE)))
        if len(pts) >= 3:
            polys.append(pts)
    return polys


def union(polys, rule):
    pc = pyclipper.Pyclipper()
    pc.AddPaths(polys, pyclipper.PT_SUBJECT, True)
    return pc.Execute(pyclipper.CT_UNION, rule, rule)


def build(svg):
    shapes = []
    for m in re.finditer(r'<path([^>]*)/>', svg):
        a = m.group(1)
        d = re.search(r' d="([^"]+)"', a).group(1)
        rule = pyclipper.PFT_EVENODD if 'fill-rule="evenodd"' in a else pyclipper.PFT_NONZERO
        shapes += union(path_polys(d), rule)
    merged = union(shapes, pyclipper.PFT_NONZERO)
    co = pyclipper.PyclipperOffset(2.0, 0.1 * SCALE)
    co.AddPaths(merged, pyclipper.JT_ROUND, pyclipper.ET_CLOSEDPOLYGON)
    out = pyclipper.CleanPolygons(co.Execute(OFFSET * SCALE), 0.02 * SCALE)
    parts = []
    for poly in out:
        if len(poly) < 3:
            continue
        xy = ["%s %s" % (fmt(x), fmt(y)) for x, y in poly]
        parts.append("M" + "L".join(xy) + "Z")
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="%s" fill="#070A10"/></svg>\n' % "".join(parts)


def fmt(v):
    s = "%.2f" % (v / SCALE)
    return s.rstrip("0").rstrip(".")


def main():
    os.makedirs(DST, exist_ok=True)
    n = 0
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".svg"):
            continue
        with io.open(os.path.join(SRC, name), encoding="utf-8") as f:
            svg = f.read()
        with io.open(os.path.join(DST, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(build(svg))
        n += 1
    print("wrote", n, "icons →", os.path.relpath(DST, ROOT))


if __name__ == "__main__":
    main()
