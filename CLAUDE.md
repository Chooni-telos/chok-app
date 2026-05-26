# CLAUDE.md — 촉(CHOK) 프로젝트 작업 규칙

이 파일은 Claude Code가 이 프로젝트에서 따라야 할 규칙이다. 작업 전 항상 이 파일과 `docs/DESIGN.md`를 먼저 읽는다.

---

## 프로젝트 한 줄 요약

**촉(CHOK)** — 예지력 측정 플랫폼. "내 촉이 맞을까?"를 겨루는 소셜 예측 서비스. 유저가 미래 사건을 예측하고, 적중률 기반 PQ(예지력 지수) 점수와 촉 등급(무딘 촉 → 신들린 촉)을 받는다. **주 타깃은 중고등학생** — MBTI 테스트처럼 가볍게 자기 예지력을 측정·자랑하는 감성. 카피·UI는 10대에게 친숙하고 위트 있게. **사행성 배제** — 현금/환전 재화는 절대 다루지 않는다. 포인트·배지·명예 등급만 존재한다.

- 화면 브랜드: **촉** (영문 **CHOK**) / 메인 피드 = "촉피드", 마이페이지 = "내 촉"
- 내부 기술 식별자는 중립 영문 사용 (예: `prediction_cards`). 브랜드가 또 바뀌어도 DB/코드를 안 건드리도록 분리.

---

## 기술 스택 (확정)

- **프론트엔드**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **백엔드**: FastAPI (Python) + SQLAlchemy + Alembic — **headless REST API** (프론트 종류와 무관하게 동작)
- **DB**: PostgreSQL
- **인증**: 카카오/구글 소셜 로그인 (OAuth) → **JWT 토큰 기반** (세션 쿠키 아님, 네이티브 확장 대비)
- **i18n**: UI 텍스트는 next-intl 등 프론트 i18n 사전 / 카드 콘텐츠는 `card_translations` 테이블
- **플랫폼**: MVP는 모바일 웹/PWA → 향후 React Native 네이티브(안드로이드 우선) 확장
- **배포**: 프론트 Vercel / 백엔드 별도 (추후 결정)

> 백엔드를 직접 운영하는 이유는 정산 트랜잭션·PQ 산출·역배 보너스 같은 무거운 비즈니스 로직을 직접 제어하기 위함이다. 이 로직들을 프론트엔드나 BaaS로 옮기지 말 것. 백엔드는 웹/네이티브가 공유하는 순수 API로 유지한다 — 비즈니스 로직을 Next.js 서버에 두지 말 것.

---

## 작업 사이클 (Plan → Work → Review → Release)

1. **Plan** — 작업 시작 전 무엇을 어떤 파일에 만들/고칠지 먼저 계획을 제시하고 승인을 받는다. 큰 변경은 바로 코드부터 치지 않는다.
2. **Work** — 한 번에 하나의 관심사만 수정한다. 여러 기능을 한 커밋에 섞지 않는다.
3. **Review** — 변경 후 무엇을 왜 바꿨는지 요약하고, 설계 문서와 어긋난 점이 없는지 스스로 점검한다.
4. **Release** — 의미 단위로 커밋한다. 커밋 메시지는 한국어로, "무엇을/왜"가 드러나게.

---

## 절대 규칙 (Hard Constraints)

이 규칙들은 `docs/DESIGN.md`에서 나온 것이며, 위반은 데이터 정합성 붕괴로 직결된다.

1. **정산은 단일 트랜잭션이다.** `settle_card`는 카드 상태 변경 + 점수 이벤트 기록 + 유저 점수/등급 갱신을 한 트랜잭션에 묶는다. 절대 쪼개지 말 것.
2. **정산은 멱등(idempotent)해야 한다.** 같은 카드를 두 번 정산해도 점수가 중복 지급되면 안 된다. `score_events.vote_id`의 UNIQUE 제약에 의존한다. 이 제약을 제거하지 말 것.
3. **역배 보너스는 투표 시점 비율로 계산한다.** `votes.odds_at_vote`는 투표 INSERT 시점에 기록한다. 정산 시점 비율로 계산하는 코드를 작성하지 말 것.
4. **win_rate를 컬럼으로 저장하지 말 것.** `total_wins / total_votes` 파생값이다.
5. **PQ 점수는 score_events 원장의 합산 캐시다.** 유저 점수를 직접 임의로 덮어쓰지 말고, 항상 score_event 기록을 통해 변경한다.
6. **사행성 기능 금지.** 결제, 환전, 현금성 보상, 확률형 유료 아이템 등을 추가하지 말 것. 요청이 들어오면 먼저 경고한다.
7. **투표 차단은 백엔드에서 강제한다.** 투표 INSERT 트랜잭션 안에서 `status='open' AND now() < closes_at`을 검증한다. 프론트엔드 비활성화만으로 막지 말 것. 마감 후 투표는 공정성과 역배 시스템을 무너뜨린다. (DESIGN.md 6.4)
8. **MVP는 `duration_tier='short'`만 운영한다.** 카드 생성 시 항상 `short`, 피드 조회 시 `WHERE duration_tier='short'` 필터. mid/long은 스키마에만 존재하고 구현하지 않는다. tier 확장이 스키마 변경 없이 가능하도록 유지한다. (DESIGN.md 6장)
9. **인증은 JWT 토큰 기반으로만 구현한다.** 세션 쿠키 방식 금지. 웹/네이티브가 같은 토큰 API를 공유해야 한다. (DESIGN.md 8.2)
10. **등급명 등 UI 텍스트를 DB에 저장하지 말 것.** DB·점수 로직은 `level_code`(불변 키)만 참조한다. 표시명("예리한 촉" 등)은 프론트 i18n 사전에서 끌어온다. 등급명은 직역하지 말고 언어별 카피 자산으로 다룬다. (DESIGN.md 7.3)
11. **카드 콘텐츠 다국어는 `card_translations`로 처리한다.** 카드 원본은 `title/description`+`origin_language`, 추가 언어는 번역 테이블. 조회는 선호 언어 → 원본 폴백. MVP에선 번역을 적극 채우지 않고 언어권별 카드 분리 노출. (DESIGN.md 7.2)

설계 변경이 필요하면 코드보다 `docs/DESIGN.md`를 먼저 수정하고, 변경 이유를 남긴다.

---

## 디렉토리 구조 (목표)

```
chok/
├── CLAUDE.md
├── docker-compose.yml      # 로컬 개발용 (PostgreSQL 등)
├── docs/
│   ├── DESIGN.md           # 스키마/알고리즘 단일 진실 공급원
│   └── API.md              # API 엔드포인트 + 인증 흐름 계약서
├── backend/
│   ├── .env.example        # 환경변수 템플릿
│   ├── app/
│   │   ├── main.py
│   │   ├── models/         # SQLAlchemy 모델 (DESIGN.md 스키마와 1:1)
│   │   ├── schemas/        # Pydantic 스키마
│   │   ├── api/            # 라우터 (auth, cards, votes, users, leaderboard, admin)
│   │   ├── services/       # 비즈니스 로직 (settlement.py = 정산 핵심)
│   │   └── core/           # 설정, DB 세션, 인증(JWT)
│   ├── tests/              # 정산 로직 테스트 필수
│   └── alembic/            # 마이그레이션
└── frontend/
    └── app/                # Next.js App Router (촉피드/내촉/랭킹)
```

> **문서 참조 우선순위:** 작업 전 `DESIGN.md`(스키마/알고리즘/정책)와 `API.md`(통신 계약)를 모두 읽는다. 충돌 시 DESIGN.md가 최상위 진실이다.

---

## 환경 설정 및 실행

### 필수 환경변수 (`backend/.env`)
`.env.example`을 복사해 채운다. MVP 기준 목록:

```
# DB
DATABASE_URL=postgresql://chok:chok@localhost:5432/chok

# JWT
JWT_SECRET_KEY=<랜덤 시크릿>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# OAuth (소셜 로그인)
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# 앱
APP_ENV=local
DEFAULT_LANGUAGE=ko
```

> 실제 OAuth 키가 없는 초기 개발 단계에선, 로컬 전용 더미 로그인(개발 모드에서만 활성)으로 우회할 수 있게 한다. 운영 빌드에선 비활성.

### 로컬 실행
```bash
# 1. DB 띄우기 (docker-compose)
docker compose up -d db

# 2. 백엔드
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # 값 채우기
alembic upgrade head                                 # 마이그레이션
uvicorn app.main:app --reload                        # http://localhost:8000

# 3. 프론트엔드
cd ../frontend
npm install
npm run dev                                          # http://localhost:3000
```

### 테스트
```bash
cd backend && pytest                                 # 정산 로직 테스트 필수 통과
```

---

## 코드 스타일

- **언어**: 코드 주석·커밋·문서는 한국어. 변수/함수명은 영어.
- **백엔드**: 비즈니스 로직은 `services/`에 둔다. 라우터(`api/`)는 얇게 유지하고 로직을 넣지 않는다.
- **타입**: 백엔드 Pydantic, 프론트 TypeScript. `any` 금지.
- **에러**: 정산·투표 같은 핵심 경로는 실패를 삼키지 말고 명시적으로 처리/로깅한다. 에러 응답은 API.md 공통 형식을 따른다.
- **테스트**: 정산 로직(`settlement.py`)은 반드시 테스트를 동반한다. 특히 "두 번 정산해도 점수 중복 안 됨", "역배 보너스 계산", "VOID 처리", "음수 점수 클램프(2.5)" 케이스.

---

## 지금 단계

설계 완료: `docs/DESIGN.md`(스키마/알고리즘/정책), `docs/API.md`(통신 계약). 코딩 착수 준비 완료.

권장 작업 순서:
1. backend 프로젝트 골격 + `.env.example` + docker-compose (PostgreSQL)
2. SQLAlchemy 모델 (DESIGN.md 1장 — 테이블 7개 그대로)
3. Alembic 초기 마이그레이션
4. `settlement.py` 정산 서비스 + 테스트 (이 프로젝트의 심장)
5. Auth API (JWT) → Cards/Vote API → /me → Admin settle (API.md 우선순위)
6. frontend MVP 3화면 (촉피드 / 내 촉 / 랭킹)

작업 지시가 모호하면 추측하지 말고 어느 범위인지 먼저 확인한다. 큰 작업은 Plan을 먼저 제시하고 승인받는다.
