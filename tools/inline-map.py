# assets/figma/map-temp.svg 를 dashboard-home.html 안에 <svg> 로 박아 넣는다.
#
# 왜 인라인인가: 지도 위의 글자와 뱃지는 확대해도 커지면 안 된다(assets/js/map.js).
# 그러려면 그 그룹 하나하나에 transform 을 걸어야 하는데, <img> 로 실은 SVG 는
# 안쪽에 손이 닿지 않는다. file:// 로 열어도 되어야 해서 fetch 도 못 쓴다.
#
# id 는 전부 map- 를 앞에 붙인다. Figma 내보내기가 "Rectangle 168" 같은 흔한 이름을
# 쓰기 때문에 페이지 안의 다른 SVG 와 부딪힌다. url(#...) 참조도 같이 고쳐 준다.
#
# 지도를 다시 내보낸 뒤 실행한다:  python tools/inline-map.py
# HTML 의 <!-- map:start --> ~ <!-- map:end --> 사이만 다시 쓴다.
import io
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, "assets", "figma", "map-temp.svg")
# 지도를 쓰는 화면 전부. 표시(<!-- map:start --> ~ <!-- map:end -->)가 있는 곳만 건드린다.
PAGES = ["dashboard-home.html", "mission-setup.html", "mission-precheck.html"]

START = "<!-- map:start -->"
END = "<!-- map:end -->"
PREFIX = "map-"
LF = "\n"


def prefixed(svg):
    ids = re.findall(r'\bid="([^"]+)"', svg)
    for name in sorted(set(ids), key=len, reverse=True):
        svg = svg.replace('id="%s"' % name, 'id="%s%s"' % (PREFIX, name))
        svg = svg.replace('url(#%s)' % name, 'url(#%s%s)' % (PREFIX, name))
        svg = svg.replace('href="#%s"' % name, 'href="#%s%s"' % (PREFIX, name))
    return svg


def main():
    svg = io.open(SVG, encoding="utf-8").read()
    body = svg[svg.index("<svg "):svg.rindex("</svg>") + len("</svg>")]
    body = prefixed(body)

    # <img> 가 갖고 있던 것을 그대로 옮긴다. width/height 는 map.js 가 다시 정한다.
    body = body.replace(
        "<svg ", '<svg class="map-image" aria-hidden="true" preserveAspectRatio="none" ', 1)

    for name in PAGES:
        path = os.path.join(ROOT, "screens", name)
        page = io.open(path, encoding="utf-8").read()
        if START not in page or END not in page:
            raise SystemExit("%s 에 %s / %s 표시가 없다" % (name, START, END))

        head = page[:page.index(START) + len(START)]
        tail = page[page.index(END):]
        out = head + LF + body + LF + "              " + tail
        if out == page:
            print("그대로   screens/" + name)
            continue
        io.open(path, "w", encoding="utf-8", newline="").write(out)
        print("inlined  screens/%s (%.0f KB)" % (name, len(body) / 1024.0))
    print("이어서:  python tools/stamp-assets.py")


main()
