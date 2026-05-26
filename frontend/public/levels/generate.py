"""등급별 아이콘 이미지 생성 — 각 등급의 개성을 표현하는 원형 뱃지"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

OUT = Path(__file__).parent
SIZE = 200

LEVELS = [
    ("dull",    "😶",  "#94a3b8", "#f1f5f9"),
    ("rookie",  "🌱",  "#22c55e", "#dcfce7"),
    ("sharp",   "⚡",  "#3b82f6", "#dbeafe"),
    ("genius",  "🧠",  "#a855f7", "#f3e8ff"),
    ("god",     "👁️",  "#f59e0b", "#fef3c7"),
    ("cursed",  "💀",  "#ef4444", "#fee2e2"),
]


def draw_badge(name: str, emoji: str, ring_color: str, bg_color: str):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = SIZE // 2, SIZE // 2
    r = SIZE // 2 - 4

    # outer glow
    for i in range(8):
        alpha = 30 - i * 3
        c = tuple(int(ring_color.lstrip("#")[j:j+2], 16) for j in (0, 2, 4)) + (alpha,)
        draw.ellipse([cx - r - i, cy - r - i, cx + r + i, cy + r + i], fill=c)

    # bg circle
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg_color)

    # ring
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ring_color, width=6)

    # inner ring
    ir = r - 12
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], outline=ring_color + "40", width=2)

    # decorative dots around the ring for god/genius
    if name in ("god", "genius"):
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            dx = cx + int((r - 6) * math.cos(rad))
            dy = cy + int((r - 6) * math.sin(rad))
            dot_r = 3
            draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=ring_color)

    img.save(str(OUT / f"{name}.png"))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, emoji, ring, bg in LEVELS:
        draw_badge(name, emoji, ring, bg)
    print(f"Generated {len(LEVELS)} level badges in {OUT}")
