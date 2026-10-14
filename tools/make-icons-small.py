# 작은 크기용 아이콘 만들기 — assets/icons/outline/*.svg(24 격자) → assets/icons/outline-16/*.svg
#
# 2026-10-14 디자이너: 24 격자 아이콘을 16px 로 줄이면 2px 선이 1.33px 가 되어 약하다.
# 선이 없는 테두리 아이콘(OFFSET_ICONS)은 도형을 밀어 굵힌다 — pip install pyclipper svgpathtools
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

# 선이 아니라 면(선을 면으로 바꾼 것)으로만 온 테두리 아이콘 — 선 굵기를 못 올리므로 도형을 고르게 OFFSET 만큼 민다.
# (2026-10-14 Figma 컴포넌트에서만 고친 것들. "원본" 프레임에 선으로 다시 그리면 이 목록에서 빼면 된다.)
# 꽉 찬 도형(사람 · 번개 등)은 넣지 않는다 — 안쪽 가는 틈이 막힌다.
OFFSET_ICONS = {"icon-calendar.svg", "icon-shield.svg"}   # cpu 는 10/14 원본 프레임이 선으로 갱신돼 빠졌다
OFFSET = 0.3      # 24 격자 단위 · 한쪽 — 16px 에서 2px 테두리 → 약 1.73px

# 굵힌 뒤 안쪽 틈이 막히는 아이콘 — 작은 크기용에서만 안쪽 도형을 줄인다(바꿀 문자열, 새 문자열).
# cpu: 테두리를 굵히면 안쪽 사각형과의 틈이 0.93px 로 줄어 막혀 보였다 → 사각형을 8 → 6.5 로(틈 약 1.43px).
SMALL_TWEAK = {
    "icon-cpu.svg": [('x="8" y="8" width="8" height="8"', 'x="8.75" y="8.75" width="6.5" height="6.5"')],
}


def thicken(svg):
    return re.sub(r'stroke-width="([\d.]+)"',
                  lambda m: 'stroke-width="%s"' % ("%.2f" % (float(m.group(1)) * RATIO)).rstrip("0").rstrip("."), svg)


def offset(svg):
    import pyclipper
    from svgpathtools import parse_path
    K = 1000
    polys = []
    for m in re.finditer(r'<path([^>]*)/>', svg):
        a = m.group(1)
        d = re.search(r' d="([^"]+)"', a).group(1)
        rule = pyclipper.PFT_EVENODD if 'evenodd' in a else pyclipper.PFT_NONZERO
        ps = []
        for sub in parse_path(d).continuous_subpaths():
            pts = []
            for seg in sub:
                n = max(2, int(seg.length() / 0.2) + 1)
                pts += [(round(seg.point(i / n).real * K), round(seg.point(i / n).imag * K)) for i in range(n)]
            if len(pts) >= 3:
                ps.append(pts)
        pc = pyclipper.Pyclipper(); pc.AddPaths(ps, pyclipper.PT_SUBJECT, True)
        polys += pc.Execute(pyclipper.CT_UNION, rule, rule)
    pc = pyclipper.Pyclipper(); pc.AddPaths(polys, pyclipper.PT_SUBJECT, True)
    merged = pc.Execute(pyclipper.CT_UNION, pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)
    co = pyclipper.PyclipperOffset(2.0, 0.1 * K)
    co.AddPaths(merged, pyclipper.JT_ROUND, pyclipper.ET_CLOSEDPOLYGON)
    out = pyclipper.CleanPolygons(co.Execute(OFFSET * K), 0.02 * K)
    f = lambda v: ("%.2f" % (v / K)).rstrip("0").rstrip(".")
    d = "".join("M" + "L".join("%s %s" % (f(x), f(y)) for x, y in p) + "Z" for p in out if len(p) >= 3)
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="%s" fill="#000"/></svg>\n' % d


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
            out = offset(svg) if name in OFFSET_ICONS else thicken(svg)
            for a, b in SMALL_TWEAK.get(name, []):
                assert a in out, (name, a)
                out = out.replace(a, b)
            f.write(out)
        n += 1
    print("wrote", n, "icons -> assets/icons/outline-16")


if __name__ == "__main__":
    main()
