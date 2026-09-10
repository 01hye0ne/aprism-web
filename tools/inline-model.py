# assets/model/apro-4f.glb 를 assets/js/map-model.js 안에 base64 로 박아 넣는다.
#
# 왜 필요한가: 지도는 3D 모델(.glb)이다. 브라우저는 file:// 로 연 페이지에서
# fetch / XHR 로 로컬 파일을 읽는 것을 교차 출처로 막는다. 그냥 열면 지도가 안 뜬다.
# 평범한 <script src> 는 file:// 에서도 실리므로, 모델을 문자열로 싣고
# map.js 가 그 문자열을 풀어서 GLTFLoader.parse 에 넘긴다.
#
# 아이콘을 CSS 에 인라인한 것과 같은 이유이고 같은 방식이다.
#
# 모델을 다시 내보낸 뒤 실행한다:  python tools/inline-model.py
# 이어서:                          python tools/stamp-assets.py
import base64
import io
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "assets", "model", "apro-4f.glb")
OUT = os.path.join(ROOT, "assets", "js", "map-model.js")

HEAD = """// 지도 3D 모델 — assets/model/apro-4f.glb 를 base64 로 담고 있다.
//
// 손으로 고치지 말 것. 모델을 다시 내보낸 뒤 python tools/inline-model.py 로 다시 만든다.
// 왜 이렇게 싣는지는 그 파일 머리에 적어 두었다(file:// 에서 fetch 가 막힌다).
//
// 원본 %d bytes -> base64 %d chars
window.APRISM_MAP_GLB = "%s";
"""


def main():
    raw = io.open(GLB, "rb").read()
    b64 = base64.b64encode(raw).decode("ascii")
    body = HEAD % (len(raw), len(b64), b64)

    old = io.open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
    if old == body:
        print("그대로")
        return
    io.open(OUT, "w", encoding="utf-8", newline="").write(body)
    print("inlined  assets/js/map-model.js (%.0f KB)" % (len(body) / 1024.0))
    print("이어서:  python tools/stamp-assets.py")


main()
