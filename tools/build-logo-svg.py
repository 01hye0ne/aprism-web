"""APRISM / DELTA 로고를 기하 도형으로 다시 그려 SVG 로 뽑는다 (2026-11-11).

기준 이미지: assets/source/26.11.10_에이프로즘 로고/APRISM_DELTA_CI_Design_Portfolio.docx
안의 word/media/image1.png (1512x959). 아래 숫자는 모두 그 이미지의 픽셀 좌표에서
가장자리를 소수점 단위로 잰 값이다. 모서리는 원본처럼 전부 각지게 둔다.

- Δ 는 문서의 "60° 정삼각형" 이 아니라 이미지대로 밑각 약 57.6° (가로:세로 ≈ 1.27:1).
- 둥근 획(P·R 볼, S, D)은 바깥 = 원(또는 원호), 속 = 같은 중심의 타원.
  타원 반지름 = 바깥 반지름 - 획 두께 (가로는 세로획 두께, 세로는 가로획 두께).

실행: python tools/build-logo-svg.py  → assets/img/logo/*.svg
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'logo')

COLOR_BLACK = '#000000'   # 이미지 값 (CI 문서 표기는 #111111)
COLOR_BLUE = '#2C5790'    # 이미지 값 (CI 문서 표기는 #004893)
COLOR_GRAY = '#D9D9D9'    # 이미지 값 (CI 문서 표기는 #7D848C)


class Pen:
    """이미지 좌표로 그리고, 변환(배율·이동)을 거쳐 SVG path 문자열을 만든다."""

    def __init__(self, s=1.0, tx=0.0, ty=0.0):
        self.s, self.tx, self.ty = s, tx, ty
        self.d = []

    def _p(self, x, y):
        return f'{self._n(x * self.s + self.tx)} {self._n(y * self.s + self.ty)}'

    @staticmethod
    def _n(v):
        t = f'{v:.2f}'.rstrip('0').rstrip('.')
        return '0' if t == '-0' else t

    def M(self, x, y): self.d.append('M' + self._p(x, y)); self.x, self.y = x, y
    def L(self, x, y): self.d.append('L' + self._p(x, y)); self.x, self.y = x, y
    def H(self, x): self.L(x, self.y)
    def V(self, y): self.L(self.x, y)

    def A(self, rx, ry, large, sweep, x, y):
        self.d.append(f'A{self._n(rx * self.s)} {self._n(ry * self.s)} 0 {large} {sweep} ' + self._p(x, y))
        self.x, self.y = x, y

    def Z(self): self.d.append('Z')

    def poly(self, pts):
        self.M(*pts[0])
        for p in pts[1:]:
            self.L(*p)
        self.Z()

    def path(self):
        return ''.join(self.d)


# ── 삼각형 Δ ─────────────────────────────────────────────
# 바깥 꼭짓점 · 밑변 y · 기울기 k(세로 1 당 가로) · 빗변 가로 두께 · 밑변 두께
def delta(p, cx, apex_y, base_y, k, side_w, base_w):
    hw = (base_y - apex_y) * k
    p.poly([(cx, apex_y), (cx + hw, base_y), (cx - hw, base_y)])          # 시계
    in_apex = apex_y + side_w / k
    in_base = base_y - base_w
    ihw = (in_base - in_apex) * k
    p.poly([(cx, in_apex), (cx - ihw, in_base), (cx + ihw, in_base)])     # 반시계(구멍)


# ── APRISM 글자 (이미지 좌표, 캡 21.5 ~ 기준선 104.5) ─────────
A_T, A_B = 21.5, 104.5
A_H = 15.15          # 가로획 두께
A_V = 16.43          # 세로획 두께
A_DELTA = dict(cx=463.9, apex_y=15.35, base_y=104.5, k=0.636, side_w=16.8, base_w=13.0)


def glyph_P(p, x0=528.07, cx=611.56):
    R, mid_t, mid_b = 24.905, 56.07, 71.31
    rx, ry = R - A_V, (mid_t - (A_T + A_H)) / 2
    p.M(x0, A_B); p.V(A_T); p.H(cx)
    p.A(R, R, 0, 1, cx, A_T + 2 * R)
    p.H(x0 + A_V); p.V(A_B); p.Z()
    p.M(x0 + A_V, A_T + A_H); p.V(mid_t); p.H(cx)
    p.A(rx, ry, 0, 0, cx, A_T + A_H); p.Z()


def glyph_R(p, x0=644.5, cx=729.03):
    R, mid_t, mid_b = 24.905, 56.07, 71.31
    cy = A_T + R
    rx, ry = R - A_V, (mid_t - (A_T + A_H)) / 2
    k = 0.4435                                    # 다리 기울기(세로 1 당 가로)
    leg_l = lambda y: 725.69 + (y - 80) * k
    leg_r = lambda y: 743.65 + (y - 80) * k
    # 다리 오른쪽 선과 바깥 원의 교점
    lo, hi = cy, A_B
    for _ in range(60):
        y = (lo + hi) / 2
        if (leg_r(y) - cx) ** 2 + (y - cy) ** 2 < R * R:
            lo = y
        else:
            hi = y
    yi = (lo + hi) / 2
    p.M(x0, A_B); p.V(A_T); p.H(cx)
    p.A(R, R, 0, 1, leg_r(yi), yi)
    p.L(leg_r(A_B), A_B); p.L(leg_l(A_B), A_B); p.L(leg_l(mid_b), mid_b)
    p.H(x0 + A_V); p.V(A_B); p.Z()
    p.M(x0 + A_V, A_T + A_H); p.V(mid_t); p.H(cx)
    p.A(rx, ry, 0, 0, cx, A_T + A_H); p.Z()


def glyph_I(p, x0=760.5, x1=858.65, s0=801.35, s1=817.93):
    p.poly([(x0, A_T), (x1, A_T), (x1, A_T + A_H), (s1, A_T + A_H), (s1, A_B - A_H),
            (x1, A_B - A_H), (x1, A_B), (x0, A_B), (x0, A_B - A_H), (s0, A_B - A_H),
            (s0, A_T + A_H), (x0, A_T + A_H)])


def glyph_S(p, lc=890.57, rc=952.8):
    R, rx = 24.5, 8.2
    m1, m2 = 55.5, 70.5                       # 가운데 가로획 위·아래
    ht, hb = A_T + A_H, A_B - A_H             # 위 가로획 아래선 · 아래 가로획 윗선
    cyu, cyl = A_T + R, A_B - R               # 바깥 원 중심 y
    t_up, t_lo = 46.5, 79.5                   # 끝(터미널) 자르는 y
    ryu, cyu_in = (m1 - ht) / 2, (m1 + ht) / 2
    ryl, cyl_in = (hb - m2) / 2, (hb + m2) / 2
    p.M(lc, A_T); p.H(rc)
    p.A(R, R, 0, 1, rc + R, cyu); p.V(t_up)
    p.H(rc + rx); p.V(cyu_in)
    p.A(rx, ryu, 0, 0, rc, ht)
    p.H(lc)
    p.A(rx, ryu, 0, 0, lc, m1)
    p.H(rc)
    p.A(R, R, 0, 1, rc, A_B)
    p.H(lc)
    p.A(R, R, 0, 1, lc - R, cyl); p.V(t_lo)
    p.H(lc - rx); p.V(cyl_in)
    p.A(rx, ryl, 0, 0, lc, hb)
    p.H(rc)
    p.A(rx, ryl, 0, 0, rc, m2)
    p.H(lc)
    p.A(R, R, 0, 1, lc, A_T)
    p.Z()


def glyph_M(p, x0=985.35, x1=1099.31, sv=16.3):
    cx = (x0 + x1) / 2
    k = 0.537
    up = lambda y: 1025.65 + (y - 55) * k     # 왼쪽 사선 윗선
    lo = lambda y: 1004.5 + (y - 55) * k      # 왼쪽 사선 아랫선
    y_notch = 55 + (cx - 1025.65) / k
    y_join = 55 + (x0 + sv - 1004.5) / k
    m = lambda x: 2 * cx - x
    p.poly([(x0, A_B), (x0, A_T), (up(A_T), A_T), (cx, y_notch), (m(up(A_T)), A_T),
            (x1, A_T), (x1, A_B), (x1 - sv, A_B), (x1 - sv, y_join), (m(lo(A_B)), A_B),
            (lo(A_B), A_B), (x0 + sv, y_join), (x0 + sv, A_B)])


# ── DELTA 글자 (이미지 좌표, 캡 524.5 ~ 기준선 599.5) ─────────
D_T, D_B = 524.5, 599.5
D_H, D_V = 13.81, 15.0
D_DELTA = dict(cx=1151.6, apex_y=519.18, base_y=599.5, k=0.638, side_w=15.2, base_w=11.81)


def glyph_D(p, x0=685.5, cx=751.93, R=30.0):
    rx, ry = R - D_V, R - D_H
    p.M(x0, D_T); p.H(cx)
    p.A(R, R, 0, 1, cx + R, D_T + R); p.V(D_B - R)
    p.A(R, R, 0, 1, cx, D_B); p.H(x0); p.Z()
    p.M(x0 + D_V, D_T + D_H); p.V(D_B - D_H); p.H(cx)
    p.A(rx, ry, 0, 0, cx + rx, D_B - R); p.V(D_T + R)
    p.A(rx, ry, 0, 0, cx, D_T + D_H); p.Z()


def glyph_E(p, x0=790.5, x1=885.5, mt=555.07, mb=568.65):
    s = x0 + D_V
    p.poly([(x0, D_T), (x1, D_T), (x1, D_T + D_H), (s, D_T + D_H), (s, mt), (x1, mt),
            (x1, mb), (s, mb), (s, D_B - D_H), (x1, D_B - D_H), (x1, D_B), (x0, D_B)])


def glyph_L(p, x0=895.5, x1=993.65):
    p.poly([(x0, D_T), (x0 + D_V, D_T), (x0 + D_V, D_B - D_H), (x1, D_B - D_H),
            (x1, D_B), (x0, D_B)])


def glyph_T(p, x0=995.69, x1=1098.5, s0=1039.5):
    p.poly([(x0, D_T), (x1, D_T), (x1, D_T + D_H), (s0 + D_V, D_T + D_H),
            (s0 + D_V, D_B), (s0, D_B), (s0, D_T + D_H), (x0, D_T + D_H)])


# ── 조립 ───────────────────────────────────────────────
def svg(w, h, parts, title):
    body = ''.join(f'<path fill="{c}" d="{d}"/>' for c, d in parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Pen._n(w)} {Pen._n(h)}" '
            f'width="{Pen._n(w)}" height="{Pen._n(h)}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')


def build_aprism():
    d = A_DELTA
    x0 = d['cx'] - (d['base_y'] - d['apex_y']) * d['k']
    y0 = d['apex_y']
    p = Pen(1, -x0, -y0)
    delta(p, **d)
    for g in (glyph_P, glyph_R, glyph_I, glyph_S, glyph_M):
        g(p)
    return svg(1099.31 - x0, A_B - y0, [(COLOR_BLACK, p.path())], 'APRISM')


def build_delta():
    d = D_DELTA
    x0, y0 = 685.5, d['apex_y']
    x1 = d['cx'] + (d['base_y'] - d['apex_y']) * d['k']
    p = Pen(1, -x0, -y0)
    for g in (glyph_D, glyph_E, glyph_L, glyph_T):
        g(p)
    delta(p, **d)
    return svg(x1 - x0, D_B - y0, [(COLOR_BLACK, p.path())], 'DELTA')


def build_aprism_blue():
    """파란 Δ + 회색 PRISM. Δ 는 APRISM 의 Δ 와 같은 크기,
    PRISM 은 APRISM 글자를 0.3512 배로 줄여 Δ 밑변에 기준선을 맞춘다."""
    d = A_DELTA
    x0 = d['cx'] - (d['base_y'] - d['apex_y']) * d['k']
    y0 = d['apex_y']
    tri = Pen(1, -x0, -y0)
    delta(tri, **d)
    s = 0.35122                                # 200.63 / 571.24 (이미지에서 잰 P~M 폭 비)
    gap = 60.04                                # Δ 중심 → P 왼쪽 (이미지 값)
    px = d['cx'] + gap - x0                    # 결과 좌표에서 P 왼쪽
    by = d['base_y'] - y0                      # 결과 좌표에서 기준선
    txt = Pen(s, px - 528.07 * s, by - A_B * s)
    for g in (glyph_P, glyph_R, glyph_I, glyph_S, glyph_M):
        g(txt)
    w = px + (1099.31 - 528.07) * s
    return svg(w, by, [(COLOR_BLUE, tri.path()), (COLOR_GRAY, txt.path())], 'APRISM')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (('aprism.svg', build_aprism), ('delta.svg', build_delta),
                     ('aprism-blue.svg', build_aprism_blue)):
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
            f.write(fn())
        print('wrote', os.path.normpath(os.path.join(OUT, name)))
