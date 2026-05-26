import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base
from app.models import *  # noqa: F401,F403 — 모든 모델을 metadata에 등록
from app.models.level import Level


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:")

    # SQLite에서 FK 제약 활성화
    @event.listens_for(eng, "connect")
    def _set_sqlite_pragma(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture()
def db(engine):
    session = sessionmaker(bind=engine)()

    session.add_all(
        [
            Level(level_code="dull", min_pq=0, sort_order=0),
            Level(level_code="rookie", min_pq=1000, sort_order=1),
            Level(level_code="sharp", min_pq=1500, sort_order=2),
            Level(level_code="genius", min_pq=2200, sort_order=3),
            Level(level_code="god", min_pq=3000, sort_order=4),
            Level(level_code="cursed", min_pq=None, sort_order=5),
        ]
    )
    session.commit()

    yield session
    session.close()
