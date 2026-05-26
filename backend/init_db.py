"""로컬 개발용 DB 초기화 — 테이블 생성 + levels 시드 데이터"""

from sqlalchemy import event

from app.core.database import Base, engine, SessionLocal
from app.models import *  # noqa: F401,F403
from app.models.level import Level
from app.models.user import User

if engine.url.drivername == "sqlite":
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(conn, _):
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

Base.metadata.create_all(engine)

db = SessionLocal()
existing = db.query(Level).first()
if not existing:
    db.add_all(
        [
            Level(level_code="dull", min_pq=0, sort_order=0),
            Level(level_code="rookie", min_pq=1000, sort_order=1),
            Level(level_code="sharp", min_pq=1500, sort_order=2),
            Level(level_code="genius", min_pq=2200, sort_order=3),
            Level(level_code="god", min_pq=3000, sort_order=4),
            Level(level_code="cursed", min_pq=None, sort_order=5),
        ]
    )
    db.commit()
    print("levels 시드 데이터 삽입 완료")
else:
    print("levels 데이터 이미 존재")

admin = db.execute(
    __import__("sqlalchemy").select(User).where(User.provider == "dev", User.provider_id == "admin")
).scalar_one_or_none()
if not admin:
    import uuid
    db.add(User(
        id=uuid.uuid4(),
        nickname="admin",
        provider="dev",
        provider_id="admin",
        is_admin=True,
    ))
    db.commit()
    print("어드민 계정 생성 완료 (provider=dev, provider_id=admin)")
else:
    print("어드민 계정 이미 존재")

db.close()
print(f"DB 초기화 완료: {engine.url}")
