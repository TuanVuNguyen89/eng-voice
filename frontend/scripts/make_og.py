"""Render public/og-image.png (1200x630) for link previews.

Draws the same Genie shapes as src/components/Mascot.jsx, at 2x and then downsampled.
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


def genie(draw, ox, oy, k):
    """Draw the Genie with its 120x120 SVG origin at (ox, oy), scale k (px per SVG unit)."""
    def P(x, y):
        return (S(ox + x * k), S(oy + y * k))

    def sw(w):
        return max(1, S(w * k))

    # wisp tail: M38 84 Q60 126 82 84 Q76 112 60 116 Q44 112 38 84 Z
    wisp = quad((40, 84), (60, 112), (80, 84)) + quad((80, 84), (72, 104), (60, 108)) + quad((60, 108), (48, 104), (40, 84))
    draw.polygon([P(*p) for p in wisp], fill=BLUE, outline=INK, width=sw(4))

    # body ellipse centre (60,64) rx30 ry32
    draw.ellipse([P(30, 32), P(90, 96)], fill=BLUE, outline=INK, width=sw(4))

    # turban: M31 38 Q60 2 89 38 Q60 46 31 38 Z
    turban = quad((31, 38), (60, 2), (89, 38)) + quad((89, 38), (60, 46), (31, 38))
    draw.polygon([P(*p) for p in turban], fill=SUN, outline=INK, width=sw(4))

    # gem
    draw.ellipse([P(55, 23), P(65, 33)], fill=PINK, outline=INK, width=sw(2.5))

    # eyes
    for cx in (49, 71):
        draw.ellipse([P(cx - 8, 54), P(cx + 8, 70)], fill=WHITE, outline=INK, width=sw(3))
    for cx in (50, 72):
        draw.ellipse([P(cx - 4, 59), P(cx + 4, 67)], fill=INK)

    # smile: M49 78 Q60 88 71 78
    smile = quad((49, 78), (60, 88), (71, 78))
    draw.line([P(*p) for p in smile], fill=INK, width=sw(4), joint="curve")
    for x, y in ((49, 78), (71, 78)):  # round caps
        r = sw(2)
        draw.ellipse([P(x, y)[0] - r, P(x, y)[1] - r, P(x, y)[0] + r, P(x, y)[1] + r], fill=INK)

    # cheeks
    for cx in (37, 83):
        draw.ellipse([P(cx - 4.5, 69.5), P(cx + 4.5, 78.5)], fill=PINK)


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

    # comic panel with the Genie
    px0, py0, px1, py1 = 700, 70, 1130, 560
    d.rounded_rectangle([S(px0 + 12), S(py0 + 12), S(px1 + 12), S(py1 + 12)], radius=S(36), fill=INK)
    d.rounded_rectangle([S(px0), S(py0), S(px1), S(py1)], radius=S(36), fill=PAPER, outline=INK, width=S(8))
    # sun burst behind the genie (flat shapes, no gradient)
    cx, cy = (px0 + px1) / 2, 300
    d.ellipse([S(cx - 150), S(cy - 150), S(cx + 150), S(cy + 150)], fill=SUN, outline=INK, width=S(6))
    k = 3.1
    genie(d, cx - 60 * k, cy - 60 * k, k)

    img = img.resize((W, H), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, optimize=True)
    print("wrote", OUT, img.size)


if __name__ == "__main__":
    main()
