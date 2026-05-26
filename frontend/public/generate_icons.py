"""PWA 앱 아이콘 생성 — 촉(CHOK) 브랜드 아이콘"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
BG = "#7C3AED"


def draw_icon(size: int):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 둥근 배경
    r = size // 8
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)

    # 수정구슬 이모지 대신 심플한 눈 모양 아이콘
    cx, cy = size // 2, size // 2
    eye_r = size // 3

    # 외부 원 (흰색)
    draw.ellipse(
        [cx - eye_r, cy - eye_r, cx + eye_r, cy + eye_r],
        fill="white",
    )

    # 내부 원 (보라)
    inner_r = eye_r * 2 // 3
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        fill=BG,
    )

    # 하이라이트
    hl_r = eye_r // 4
    hl_x = cx - inner_r // 3
    hl_y = cy - inner_r // 3
    draw.ellipse(
        [hl_x - hl_r, hl_y - hl_r, hl_x + hl_r, hl_y + hl_r],
        fill="white",
    )

    img.save(str(OUT / f"icon-{size}x{size}.png"))


if __name__ == "__main__":
    for s in SIZES:
        draw_icon(s)
    # favicon
    draw_icon(32)
    img32 = Image.open(str(OUT / "icon-32x32.png"))
    img32.save(str(OUT / "favicon.ico"), format="ICO")
    (OUT / "icon-32x32.png").unlink()
    print(f"Generated {len(SIZES)} icons + favicon.ico")
