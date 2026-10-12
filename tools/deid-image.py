# 그림 속 사람 영역에 비식별화 줄무늬를 입혀 새 그림으로 저장한다.
#
# 왜 미리 굽나: 실제 제품에서 비식별화는 영상이 나가기 전(로봇 · 서버)에서 끝나야 한다.
# 브라우저가 덮으면 원본이 그대로 오간다. 그래서 화면은 "이미 비식별화된 그림"을 받는 것으로 둔다.
#
# 셈은 screens/deid-lab.html(assets/js/deid-lab.js)과 같다 — 칸 평균으로 먼저 지우고, 그 위에 줄무늬.
# 줄과 칸 격자는 영역 왼쪽 위에 붙는다.
#
#   python tools/deid-image.py            아래 JOBS 를 모두 다시 만든다
import io
import math
import os
import sys

from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 기본값은 비교판에서 디자이너가 고른 값(2026-10-12)을 이 그림 크기에 맞춰 키운 것이다.
# 비교판은 960 폭 판을 약 0.62 배로 보여 주고, 알림 쪽지는 720 폭 그림을 약 0.43 배로 보여 준다 —
# 화면에서 같은 굵기로 보이게 칸 · 줄 간격을 1.44 배 했다(25 → 36, 11 → 16).
STYLE = {
    "mode": "silhouette",   # silhouette(줄 굵기 고정) | hatch(줄 굵기 = 칸 평균 밝기)
    "cell": 36,
    "gap": 16,
    "angle": 0,             # 0 = 가로 줄 · 57 = 로고 A 의 사선
    "thick": 0.12,
    "range": 0.39,
    "tint": True,           # 바탕을 칸 평균색(어둡게)으로
    "ink": (255, 255, 255),
    "paper": (0, 0, 0),
}

# 사람 영역 — 감지 상자 안쪽(상자 선 · 라벨은 남긴다). 실제로는 감지 결과가 준다.
JOBS = [
    {
        "src": "assets/img/alert-live-ppe.webp",
        "out": "assets/img/alert-live-ppe-deid.webp",
        "regions": [(267, 99, 393, 337), (375, 101, 503, 337)],
    },
]


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def deid(img, regions, s):
    px = img.load()
    src = img.copy().load()
    W, H = img.size
    a = math.radians(s["angle"])
    nx, ny = math.sin(a), math.cos(a)
    aa = 1.2 / s["gap"]
    c = s["cell"]
    for (x0, y0, x1, y1) in regions:
        cols = math.ceil((x1 - x0) / c)
        rows = math.ceil((y1 - y0) / c)
        sums = [[0, 0, 0, 0] for _ in range(cols * rows)]
        for y in range(max(0, y0), min(H, y1)):
            r = (y - y0) // c
            for x in range(max(0, x0), min(W, x1)):
                k = r * cols + (x - x0) // c
                p = src[x, y]
                sums[k][0] += p[0]; sums[k][1] += p[1]; sums[k][2] += p[2]; sums[k][3] += 1
        avg = [(q[0] / max(q[3], 1), q[1] / max(q[3], 1), q[2] / max(q[3], 1)) for q in sums]
        for y in range(max(0, y0), min(H, y1)):
            r = (y - y0) // c
            for x in range(max(0, x0), min(W, x1)):
                cr, cg, cb = avg[r * cols + (x - x0) // c]
                if s["mode"] == "hatch":
                    lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255
                    t = min(0.95, max(0.05, s["thick"] + (lum - 0.5) * s["range"]))
                else:
                    t = s["thick"]
                u = ((x - x0) * nx + (y - y0) * ny) / s["gap"]
                h = abs(u - math.floor(u) - 0.5) * 2
                cov = 1 - smooth(t - aa, t + aa, h)
                if s["tint"]:
                    base = (cr * 0.45, cg * 0.45, cb * 0.45)
                else:
                    base = s["paper"]
                ink = s["ink"]
                px[x, y] = tuple(int(round(base[i] + (ink[i] - base[i]) * cov)) for i in range(3))
    return img


def main():
    for job in JOBS:
        img = Image.open(os.path.join(ROOT, job["src"])).convert("RGB")
        deid(img, job["regions"], STYLE)
        out = os.path.join(ROOT, job["out"])
        img.save(out, "WEBP", quality=90)
        print("saved", job["out"])


if __name__ == "__main__":
    main()
