"""Render public/og-image.png (1200x630) for link previews.

Draws the same Sao shapes as src/components/Mascot.jsx, at 2x and then downsampled.
Run: python frontend/scripts/make_og.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "og-image.png"
W, H, SS = 1200, 630, 2  # draw at 2x for smooth edges
FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"  # has full Vietnamese diacritics

SKY = (110, 198, 255)
INK = (31, 33, 64)
PAPER = (255, 249, 236)
SUN = (255, 212, 59)
BLUE = (91, 184, 255)
PINK = (255, 122, 154)
WHITE = (255, 255, 255)


def S(v):
    return int(round(v * SS))


def quad(p0, p1, p2, steps=40):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def sao(draw, ox, oy, k):
    """Draw Sao (same geometry as src/components/Mascot.jsx, 120x120 SVG units) at (ox, oy), scale k."""
    RED = (229, 57, 53)
    STRAW = (242, 210, 122)
    RIB = (184, 134, 43)
    PINK_CHEEK = (255, 154, 168)

    def P(x, y):
        return (S(ox + x * k), S(oy + y * k))

    def sw(w):
        return max(1, S(w * k))

    def circle(cx, cy, r, fill, outline=None, width=0):
        x0, y0 = P(cx - r, cy - r)
        x1, y1 = P(cx + r, cy + r)
        draw.ellipse([x0, y0, x1, y1], fill=fill, outline=outline, width=width)

    # feet and arms (behind the body)
    for fx in (46, 74):
        x0, y0 = P(fx - 8, 99)
        x1, y1 = P(fx + 8, 109)
        draw.ellipse([x0, y0, x1, y1], fill=INK)
    for ax in (22, 98):
        circle(ax, 76, 8, RED, INK, sw(3.5))

    # body and star
    circle(60, 68, 36, RED, INK, sw(4))
    star = [(60.0,85.5),(62.5,91.6),(69.0,92.1),(64.0,96.3),(65.6,102.7),(60.0,99.2),(54.4,102.7),(56.0,96.3),(51.0,92.1),(57.5,91.6)]
    draw.polygon([P(*p) for p in star], fill=SUN, outline=INK, width=sw(2.5))

    # eyes
    for cx in (46, 74):
        circle(cx, 66, 8, WHITE, INK, sw(3))
    for cx in (47, 75):
        circle(cx, 67, 4, INK)

    # mouth: Q60 96 curve from (51,88) to (69,88)
    smile = quad((51, 81), (60, 89), (69, 81))
    draw.line([P(*p) for p in smile], fill=INK, width=sw(4), joint="curve")
    for x, y in ((51, 81), (69, 81)):
        r = sw(2)
        cx, cy = P(x, y)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)

    # cheeks
    circle(36, 76, 4, PINK_CHEEK)
    circle(84, 76, 4, PINK_CHEEK)

    # nón lá: cone + ribs + chin strap
    cone = quad((14, 46), (60, 58), (106, 46)) + quad((106, 46), (90, 30), (60, 8)) + quad((60, 8), (30, 30), (14, 46))
    draw.polygon([P(*p) for p in cone], fill=STRAW, outline=INK, width=sw(4))
    draw.line([P(60, 9), P(60, 54)], fill=RIB, width=sw(2.5))
    for rib in (quad((42, 16), (36, 34), (26, 47)), quad((78, 16), (84, 34), (94, 47))):
        draw.line([P(*p) for p in rib], fill=RIB, width=sw(2.5), joint="curve")


def text(draw, xy, s, size, fill, anchor="la"):
    font = ImageFont.truetype(FONT_BOLD, S(size))
    draw.text((S(xy[0]), S(xy[1])), s, font=font, fill=fill, anchor=anchor)


def main():
    img = Image.new("RGB", (S(W), S(H)), SKY)
    d = ImageDraw.Draw(img)

    # dotted paper texture on the sky
    for x in range(0, W, 26):
        for y in range(0, H, 26):
            d.ellipse([S(x), S(y), S(x + 3), S(y + 3)], fill=(90, 175, 235))

    # title block
    text(d, (70, 150), "Luyện nói", 92, INK)
    text(d, (70, 252), "tiếng Anh", 92, INK)
    text(d, (76, 372), "Trò chuyện bằng giọng nói,", 32, INK)
    text(d, (76, 414), "được chấm lỗi và sửa phát âm.", 32, INK)

    # pills
    pills = ["Chấm phát âm", "Sửa lỗi", "Trò chuyện"]
    x = 76
    font = ImageFont.truetype(FONT_BOLD, S(26))
    for label in pills:
        tw = d.textlength(label, font=font) / SS
        w = tw + 40
        d.rounded_rectangle([S(x + 3), S(486 + 4), S(x + w + 3), S(536 + 4)], radius=S(25), fill=INK)
        d.rounded_rectangle([S(x), S(486), S(x + w), S(536)], radius=S(25), fill=WHITE, outline=INK, width=S(4))
        d.text((S(x + 20), S(511)), label, font=font, fill=INK, anchor="lm")
        x += w + 26

    # comic panel with the Sao
    px0, py0, px1, py1 = 700, 70, 1130, 560
    d.rounded_rectangle([S(px0 + 12), S(py0 + 12), S(px1 + 12), S(py1 + 12)], radius=S(36), fill=INK)
    d.rounded_rectangle([S(px0), S(py0), S(px1), S(py1)], radius=S(36), fill=PAPER, outline=INK, width=S(8))
    # sun burst behind Sao (flat shapes, no gradient)
    cx, cy = (px0 + px1) / 2, 300
    d.ellipse([S(cx - 150), S(cy - 150), S(cx + 150), S(cy + 150)], fill=SUN, outline=INK, width=S(6))
    k = 3.0
    sao(d, cx - 60 * k, cy - 60 * k, k)

    img = img.resize((W, H), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, optimize=True)
    print("wrote", OUT, img.size)


if __name__ == "__main__":
    main()
