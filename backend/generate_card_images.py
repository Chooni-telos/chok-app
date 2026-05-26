"""샘플 카드용 썸네일 이미지 생성 — 아이콘 + 배경색만 (텍스트 없음)"""

import os

from PIL import Image, ImageDraw, ImageFont

from app.core.database import SessionLocal
from app.models.card import PredictionCard

CATEGORY_STYLES = {
    "경제테크": {"bg": (255, 243, 224), "accent": (217, 119, 6), "icon": "📈"},
    "스포츠":   {"bg": (220, 252, 231), "accent": (22, 163, 74), "icon": "⚽"},
    "연예":     {"bg": (252, 231, 243), "accent": (219, 39, 119), "icon": "🎤"},
    "시사":     {"bg": (219, 234, 254), "accent": (37, 99, 235), "icon": "📰"},
    "도파민":   {"bg": (243, 232, 255), "accent": (124, 58, 237), "icon": "🎲"},
}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "cards")
os.makedirs(OUT_DIR, exist_ok=True)

W, H = 800, 300

try:
    font_icon = ImageFont.truetype("seguiemj.ttf", 100)
except OSError:
    font_icon = ImageFont.load_default()


def generate_card_image(card_id: str, category: str) -> str:
    style = CATEGORY_STYLES.get(category, CATEGORY_STYLES["도파민"])
    bg = style["bg"]
    accent = style["accent"]

    img = Image.new("RGB", (W, H), color=bg)
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([(0, 0), (W, 6)], radius=0, fill=accent)

    try:
        bbox = draw.textbbox((0, 0), style["icon"], font=font_icon)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((W - tw) / 2, (H - th) / 2 - 10), style["icon"], font=font_icon, embedded_color=True)
    except TypeError:
        bbox = draw.textbbox((0, 0), style["icon"], font=font_icon)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((W - tw) / 2, (H - th) / 2 - 10), style["icon"], font=font_icon, fill=accent)

    filename = f"{card_id}.png"
    filepath = os.path.join(OUT_DIR, filename)
    img.save(filepath, "PNG")
    return f"/cards/{filename}"


db = SessionLocal()
cards = db.query(PredictionCard).filter(PredictionCard.status == "open").all()

for card in cards:
    url = generate_card_image(str(card.id), card.category)
    card.image_url = url
    print(f"  + [{card.category}] {card.title} -> {url}")

db.commit()
db.close()
print(f"\n이미지 {len(cards)}개 생성 완료!")
