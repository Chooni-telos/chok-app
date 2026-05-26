# 촉(CHOK) — API 명세

> 백엔드 헤드리스 REST API의 계약서. 프론트엔드(웹/네이티브)는 이 문서만 보고 통신할 수 있어야 한다. 스키마/알고리즘 세부는 `DESIGN.md` 참조. 이 문서와 DESIGN.md가 충돌하면 DESIGN.md가 우선이며, 이 문서를 수정한다.

## 공통 규약

- **Base URL**: `/api/v1`
- **포맷**: 요청/응답 모두 JSON. 시각은 ISO 8601 UTC (`2026-05-23T10:00:00Z`).
- **인증**: `Authorization: Bearer <access_token>` 헤더. (아래 인증 흐름 참조)
- **언어**: `Accept-Language: ko` 또는 `en` 헤더로 표시 언어 결정. 없으면 유저 `preferred_language`, 그래도 없으면 `ko`.
- **에러 응답 공통 형식**:
  ```json
  { "error": { "code": "VOTE_CLOSED", "message": "이미 마감된 카드입니다." } }
  ```
- **공통 에러 코드**: `UNAUTHORIZED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `VALIDATION_ERROR`(422), `CONFLICT`(409), `INTERNAL`(500).

---

## 1. 인증 (Auth)

### 흐름 개요 (OAuth → JWT)

```
1. 클라이언트가 카카오/구글 OAuth 로그인 → 인가 코드(authorization code) 획득
2. 인가 코드를 백엔드로 전달
3. 백엔드가 제공자에 코드 검증 → provider_id 획득
4. provider+provider_id로 users 조회:
   - 기존 유저 → 그대로 로그인
   - 신규 유저 → 임시 유저 생성 (닉네임 미정 상태)
5. 백엔드가 access_token(JWT, 단기) + refresh_token(장기) 발급
6. 신규 유저면 닉네임 설정 플로우로 유도 (needs_nickname=true)
```

> 인증은 세션 쿠키가 아니라 JWT 토큰 기반이다 (DESIGN.md 8.2). access_token은 짧게(예: 30분), refresh_token은 길게(예: 30일). refresh_token은 회전(rotation) 권장.

### `POST /api/v1/auth/login`
소셜 로그인 인가 코드로 토큰 발급.

요청:
```json
{ "provider": "kakao", "code": "<authorization_code>", "redirect_uri": "..." }
```
응답 200:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "needs_nickname": true,
  "user": { "id": "uuid", "nickname": null, "preferred_language": "ko" }
}
```

### `POST /api/v1/auth/refresh`
요청: `{ "refresh_token": "..." }` → 응답: 새 `access_token`(+회전된 refresh_token).

### `POST /api/v1/auth/nickname`
신규 유저 닉네임 확정. (중복 시 409 `CONFLICT`)
요청: `{ "nickname": "방구석솔로몬" }` → 응답: 갱신된 user.

### `POST /api/v1/auth/logout`
refresh_token 무효화.

---

## 2. 카드 (Cards)

### `GET /api/v1/cards`
촉피드(메인 피드). 진행 중 카드 목록.

쿼리 파라미터:
- `status`: `open`(기본) / `closed` / `settled`
- `category`: 선택 필터
- `cursor`, `limit`: 커서 기반 페이지네이션

응답 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "뉴진스 신곡 멜론 1위 할까?",   // Accept-Language 반영 (번역 없으면 원본)
      "category": "연예",
      "status": "open",
      "closes_at": "2026-05-25T12:00:00Z",
      "yes_count": 120, "no_count": 80,
      "yes_ratio": 0.60,                          // 표시용 계산값
      "my_vote": "YES",                           // 인증 시, 내 투표 (없으면 null)
      "duration_tier": "short"
    }
  ],
  "next_cursor": "..."
}
```
> MVP는 `duration_tier='short'`만 노출 (DESIGN.md 6장). 서버가 강제 필터.

### `GET /api/v1/cards/{card_id}`
카드 상세. 위 항목 + `description`, 시계열 비율 변화(있으면) 등.

### `POST /api/v1/cards`
유저 발급 카드 생성. (creator_type=user)
요청:
```json
{
  "title": "...", "description": "...",
  "category": "스포츠",
  "event_start_at": "2026-05-24T09:00:00Z",   // 없으면 null
  "closes_at": "...",                          // event_start_at 있으면 서버가 버퍼로 자동계산 가능
  "origin_language": "ko"
}
```
> 서버는 항상 `duration_tier='short'` 강제 (MVP). `event_start_at`이 있으면 카테고리 버퍼로 `closes_at` 자동 계산 (DESIGN.md 6.3).

---

## 3. 투표 (Votes)

### `POST /api/v1/cards/{card_id}/vote`
투표 제출. **마감 검증은 서버에서 강제** (DESIGN.md 6.4).

요청: `{ "choice": "YES" }`

서버 처리 (단일 트랜잭션):
1. `card.status == 'open' AND now() < card.closes_at` 검증 → 실패 시 409 `VOTE_CLOSED`
2. `UNIQUE(user_id, card_id)` — 이미 투표했으면 409 `ALREADY_VOTED`
3. vote INSERT + 같은 트랜잭션에서 card의 yes/no_count +1
4. `odds_at_vote` = INSERT 직후 본인 진영 비율 스냅샷 저장 (DESIGN.md 1.3)

응답 200: `{ "choice": "YES", "odds_at_vote": 0.60, "card": { ...갱신된 카운트 } }`

에러: `VOTE_CLOSED`(409), `ALREADY_VOTED`(409).

> 투표 수정/취소는 MVP 미지원 (한 번 던지면 끝 — 예지력의 진정성). 추후 정책 결정.

---

## 4. 유저 / 마이페이지 (Users)

### `GET /api/v1/me`
내 촉 (마이페이지) (마이페이지).
응답 200:
```json
{
  "id": "uuid", "nickname": "방구석솔로몬",
  "pq_score": 1180,
  "level_code": "rookie",          // 표시명은 프론트 i18n 사전에서 매핑 (DESIGN.md 7.3)
  "total_votes": 14, "total_wins": 9,
  "win_rate": 0.643,                // 서버 계산 파생값
  "current_streak": 3,
  "is_cursed": false,               // cursed 조건 충족 여부 (DESIGN.md 2.5)
  "preferred_language": "ko"
}
```

### `GET /api/v1/me/history`
내 투표 이력 (정산 결과 포함). 페이지네이션.

### `PATCH /api/v1/me`
설정 변경 (예: `preferred_language`).
요청: `{ "preferred_language": "en" }`

### `GET /api/v1/users/{user_id}`
타 유저 공개 프로필 (랭킹에서 진입). pq_score, level, win_rate 등 공개 범위만.

---

## 5. 랭킹 (Leaderboard)

### `GET /api/v1/leaderboard`
쿼리: `period` = `weekly`(기본) / `monthly` / `all`, `cursor`, `limit`.
응답 200:
```json
{
  "period": "weekly",
  "items": [
    { "rank": 1, "user_id": "uuid", "nickname": "...", "pq_score": 2400, "level_code": "genius", "win_rate": 0.81 }
  ],
  "my_rank": { "rank": 152, "pq_score": 1180 }
}
```
> 주간 랭킹이 운영의 중심 (DESIGN.md 6.1 주간 사이클). 집계 기준(전체 PQ vs 기간 내 획득 PQ)은 구현 시 확정 — 권장: 기간 내 score_events 합산 기반.

---

## 6. 운영 / 정산 (Admin) — 인증·권한 분리

> MVP에선 운영자 수동 정산. 별도 admin 권한 토큰 또는 분리된 엔드포인트로 보호. 일반 유저 노출 금지.

### `POST /api/v1/admin/cards/{card_id}/close`
운영자 강제 마감. `open → closed`. (DESIGN.md 6.3-B)

### `POST /api/v1/admin/cards/{card_id}/settle`
정산 실행. `settle_card(card_id, result)` 호출 (DESIGN.md 3장).
요청: `{ "result": "YES" }` (YES / NO / VOID)
- 멱등: 이미 settled면 200으로 현재 상태 반환 (중복 정산 무해).
- 응답: 정산 요약 `{ "settled_votes": 200, "winners": 120, "total_delta_distributed": 7200 }`

---

## 구현 우선순위 (MVP)

1. **Auth** (login/refresh/nickname) — 모든 인증 API의 전제
2. **Cards GET + Vote POST** — 핵심 루프 (촉피드에서 투표)
3. **GET /me** — 마이페이지 (PQ/등급 표시)
4. **Admin settle** — 정산 (이게 있어야 점수가 움직임)
5. **Leaderboard** — 랭킹
6. Cards POST (유저 발급), me/history 등 부가

> 1~4가 "투표→정산→점수확인"의 최소 완결 루프. 이것부터 동작시키고 5~6을 붙인다.
