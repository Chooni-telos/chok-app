# 촉(CHOK) — 설계 문서

> 예지력 측정 플랫폼. 사용자가 미래 사건에 대한 예측을 던지고, 적중률 기반으로 PQ(Prophetic Quotient) 점수와 등급을 부여받는 소셜 예측 서비스.

이 문서는 DB 스키마와 PQ 점수 알고리즘의 **단일 진실 공급원(single source of truth)**이다. 코드 구현은 항상 이 문서를 기준으로 한다. 스키마/알고리즘 변경 시 코드보다 이 문서를 먼저 수정한다.

---

## 0. 설계 원칙 (왜 이렇게 설계했는가)

이 서비스는 화면이 단순해 보이지만, 데이터 정합성 측면에서 까다로운 지점이 두 곳 있다. 이 두 가지가 스키마 전체 설계를 좌우한다.

### 원칙 1 — 정산은 단일 트랜잭션이다
하나의 예언 카드가 마감/정산될 때, 다음이 **반드시 한 트랜잭션 안에서** 일어나야 한다:
1. 카드의 `final_result` 확정
2. 해당 카드에 투표한 모든 유저의 점수 변동 기록 생성
3. 각 유저의 누적 PQ 점수, 승/패 카운트, 등급 갱신

이 중 하나라도 부분 성공/부분 실패하면 "맞췄는데 점수가 안 올랐다" 같은 신뢰 붕괴가 발생한다. 따라서 정산 로직은 애플리케이션 레이어의 임시 처리가 아니라, **재실행해도 같은 결과가 나오는(idempotent) 정산 함수**로 설계한다.

### 원칙 2 — 역배 보너스는 투표 시점의 비율로 계산한다
"남들이 안 고른 선택을 맞추면 점수 2배" 같은 역배 보너스를 주려면, **그 유저가 투표한 순간의 YES/NO 비율**이 필요하다. 정산 시점의 비율은 이미 바뀌어 있으므로 쓸 수 없다. 따라서 투표를 기록할 때 그 순간의 진영 비율(odds)을 **스냅샷으로 함께 저장**한다. 이건 나중에 추가할 수 없고 처음부터 votes 테이블에 박아야 한다.

### 원칙 3 — 점수는 계산 결과가 아니라 기록이다
유저의 PQ 점수를 매번 전체 투표 이력에서 재계산하지 않는다. 정산 때마다 "이 카드에서 이 유저가 얼마를 얻거나 잃었는지"를 **score_events 테이블에 영구 기록**하고, 유저 테이블의 점수는 그 합산 캐시로 둔다. 이렇게 하면 점수 분쟁이 생겨도 "언제, 어느 카드에서, 왜 이 점수가 변했는지" 추적할 수 있다.

---

## 1. DB 스키마

PostgreSQL 기준. (FastAPI + SQLAlchemy/Alembic 마이그레이션 전제)

### 1.1 users — 유저

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 유저 식별자 |
| `nickname` | VARCHAR(20) UNIQUE | 닉네임 |
| `provider` | VARCHAR(20) | 소셜 로그인 제공자 (kakao/google) |
| `provider_id` | VARCHAR(255) | 제공자 측 유저 ID |
| `pq_score` | INTEGER DEFAULT 1000 | 현재 예지력 점수 (캐시값, score_events 합산) |
| `level_code` | VARCHAR(30) | 현재 등급 코드 (levels 참조) |
| `total_votes` | INTEGER DEFAULT 0 | 정산 완료된 총 투표 수 |
| `total_wins` | INTEGER DEFAULT 0 | 적중 수 |
| `current_streak` | INTEGER DEFAULT 0 | 현재 연속 적중 수 (감정서 발급용) |
| `preferred_language` | VARCHAR(5) DEFAULT 'ko' | 선호 표시 언어 (ko / en) |
| `created_at` | TIMESTAMPTZ | 가입 시각 |

> `win_rate`는 컬럼으로 두지 않는다. `total_wins / total_votes`로 언제든 계산되는 파생값이므로, 저장하면 정합성만 깨진다. 정렬/조회가 잦으면 generated column이나 view로 노출한다.

### 1.2 prediction_cards — 예언 카드

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 카드 식별자 |
| `title` | VARCHAR(200) | 원본 언어 질문 (origin_language 기준 표시 텍스트) |
| `description` | TEXT NULL | 원본 언어 부연 설명 |
| `origin_language` | VARCHAR(5) | 카드 원본 언어 (ko / en). 작성된 언어 |
| `category` | VARCHAR(20) | 시사/스포츠/연예/경제테크/도파민 |
| `creator_type` | VARCHAR(10) | official / user |
| `creator_id` | UUID NULL | 유저 발급 시 발급자 |
| `status` | VARCHAR(15) | open / closed / settled |
| `duration_tier` | VARCHAR(10) | short / mid / long (기간 등급, 6장 참조) |
| `event_start_at` | TIMESTAMPTZ NULL | 사건 발생 예정 시각 (자동 마감 계산용, 불명확하면 NULL) |
| `closes_at` | TIMESTAMPTZ | 투표 마감 시각 (이후 투표 거부) |
| `settled_at` | TIMESTAMPTZ NULL | 정산 완료 시각 |
| `yes_count` | INTEGER DEFAULT 0 | YES 누적 투표 수 (실시간 비율 표시용 캐시) |
| `no_count` | INTEGER DEFAULT 0 | NO 누적 투표 수 |
| `final_result` | VARCHAR(5) NULL | YES / NO / VOID(무효) |
| `created_at` | TIMESTAMPTZ | 생성 시각 |

> `title`/`description`은 **원본 언어 텍스트**이며 항상 존재한다(번역이 없어도 카드는 표시 가능). 다른 언어 번역은 `card_translations`(1.6) 에 둔다. `origin_language`로 어느 언어로 쓰였는지 추적한다. 다국어 정책은 7장 참조.

> `status`는 `open → closed → settled` 단방향으로만 전이한다. `open`일 때만 투표를 받는다. `closed`(마감~결과 대기)와 `settled`(정산 완료)에서는 투표를 거부한다. `VOID`는 사건 자체가 무산된 경우(경기 취소 등) 전원 점수 변동 없이 처리하기 위한 결과값이다. 마감 차단의 구체 규칙은 6장 참조.

### 1.3 votes — 투표 이력 (★ 스냅샷이 핵심)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 투표 식별자 |
| `user_id` | UUID FK | 투표자 |
| `card_id` | UUID FK | 대상 카드 |
| `choice` | VARCHAR(5) | YES / NO |
| `odds_at_vote` | NUMERIC(5,4) | **투표 시점, 유저가 고른 진영의 비율 (0~1)** |
| `is_settled` | BOOLEAN DEFAULT false | 이 투표가 정산 반영되었는지 |
| `created_at` | TIMESTAMPTZ | 투표 시각 |

- `UNIQUE(user_id, card_id)` — 한 카드에 한 번만 투표.
- `odds_at_vote`: 유저가 YES를 골랐고 그 순간 YES 비율이 80%였다면 `0.8000`을 저장. 이 값이 낮을수록(=소수파였을수록) 역배 보너스가 커진다. **정산 시점이 아니라 투표 시점 값**이라는 점이 핵심.

### 1.4 score_events — 점수 변동 원장 (★ 추적의 핵심)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 이벤트 식별자 |
| `user_id` | UUID FK | 대상 유저 |
| `card_id` | UUID FK | 원인 카드 |
| `vote_id` | UUID FK | 원인 투표 |
| `delta` | INTEGER | 점수 변동량 (+50, -30, +100 등) |
| `reason` | VARCHAR(30) | hit / miss / underdog_bonus / void_refund |
| `pq_after` | INTEGER | 이 이벤트 적용 후 유저의 PQ |
| `created_at` | TIMESTAMPTZ | 기록 시각 |

- `UNIQUE(vote_id)` — **하나의 투표는 정확히 하나의 점수 이벤트만 만든다.** 이 제약이 정산 idempotency를 보장한다. 정산을 두 번 돌려도 두 번째는 unique 위반으로 막혀 중복 지급이 불가능하다.

### 1.5 levels — 등급 정의 (정적 테이블 또는 코드 상수)

| level_code | 이름(ko) | 최소 PQ |
|------------|------|---------|
| `dull` | 무딘 촉 | 0 |
| `rookie` | 촉 새내기 | 1000 |
| `sharp` | 예리한 촉 | 1500 |
| `genius` | 촉 천재 | 2200 |
| `god` | 신들린 촉 | 3000 |
| `cursed` | 고장난 촉 (역배지) | — (별도 조건: 승률 하위 + 충분한 표본) |

> 등급 경계는 운영하며 조정될 값이므로 코드 상수보다 테이블로 두는 것을 권장. `cursed`는 PQ 구간이 아니라 "총 투표 N회 이상 & 승률 하위 X%" 같은 별도 룰로 부여한다. ("촉이 고장나서 반대로 따라가면 맞는" 유머 등급 — 다른 유저가 역으로 참고하는 재미.)
>
> **다국어 주의:** `level_code`는 **불변 키**이며 점수 로직·DB는 이 코드만 참조한다. 화면 표시명("예리한 촉" / "Sharp Sense")은 코드가 아니라 **프론트엔드 i18n 사전**에서 `level_code`를 키로 끌어온다. 등급 이름은 한국어 말맛에 의존하므로 단순 직역이 아니라 **언어별로 따로 카피라이팅된 자산**으로 다룬다 (7.3 참조). DB에 표시명을 저장하지 말 것.

### 1.6 card_translations — 카드 번역 (다국어 콘텐츠)

카드 본문(질문/설명)의 비원본 언어 번역을 저장한다. 원본 언어 텍스트는 `prediction_cards.title/description`에 그대로 두고, 이 테이블에는 **추가 언어만** 쌓는다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 식별자 |
| `card_id` | UUID FK | 대상 카드 |
| `language` | VARCHAR(5) | 번역 언어 (ko / en) |
| `title` | VARCHAR(200) | 번역된 질문 |
| `description` | TEXT NULL | 번역된 설명 |
| `source` | VARCHAR(10) | manual / machine (수동/기계번역 출처) |
| `created_at` | TIMESTAMPTZ | 생성 시각 |

- `UNIQUE(card_id, language)` — 카드+언어 조합당 하나.
- 조회 시: 유저 선호 언어 번역이 있으면 그것을, 없으면 카드 원본(`origin_language`)을 폴백으로 표시한다.
- **MVP 운영 정책은 7장 참조** (MVP에선 이 테이블을 적극 채우지 않고 언어권별 카드 분리 노출).

### 1.7 device_tokens — 푸시 알림용 디바이스 토큰 (네이티브 확장 대비)

웹/PWA MVP에선 사용하지 않지만, 향후 네이티브(React Native) 푸시 알림을 위해 스키마 자리를 비워둔다. (장기 카드 결과 임박 알림 등)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 식별자 |
| `user_id` | UUID FK | 소유 유저 |
| `platform` | VARCHAR(10) | android / ios / web |
| `token` | VARCHAR(255) | FCM 등 푸시 토큰 |
| `is_active` | BOOLEAN DEFAULT true | 유효 여부 |
| `created_at` | TIMESTAMPTZ | 등록 시각 |

> MVP에선 테이블만 만들고 비워둔다. 푸시 발송 로직·언어별 알림 문구는 네이티브 확장 단계에서 붙인다.

---

## 2. PQ 점수 알고리즘

### 2.1 기본 점수

| 결과 | 변동 |
|------|------|
| 적중 (hit) | **+50** |
| 실패 (miss) | **−30** |
| 무효 (void) | **0** (변동 없음) |

비대칭(+50 / −30)으로 둔 이유: 참여 자체를 장려하고, 적중의 쾌감을 손실의 고통보다 크게 설계해 리텐션을 높이기 위함. 운영 데이터를 보며 조정한다.

### 2.2 역배 보너스 (underdog bonus)

적중한 경우에만 적용. 투표 시점에 소수파였을수록 추가 점수를 준다.

```
base = 50 (적중 시)
odds = odds_at_vote   # 내가 고른 진영의 투표 시점 비율 (0~1)

# 소수파일수록 보너스가 커지는 배율. odds가 0.5 이상이면 보너스 없음(다수파).
if odds < 0.5:
    multiplier = 1 + (0.5 - odds) * 2    # odds=0.5→1.0배, odds=0.1→1.8배, odds→0→2.0배
else:
    multiplier = 1.0

final_delta = round(base * multiplier)
```

- 비율 50%인 선택을 맞추면: +50 (보너스 없음)
- 비율 20%인 소수파 선택을 맞추면: 50 × (1 + 0.3×2) = 50 × 1.6 = **+80**
- 비율 5%인 극소수 선택을 맞추면: 50 × (1 + 0.45×2) = 50 × 1.9 = **+95** (사실상 2배 가까이)

> 보너스는 **적중에만** 적용한다. 소수파였는데 틀린 경우는 그냥 −30. (소수파 패널티까지 주면 참여가 위축됨)

### 2.3 누적 점수와 등급

- 정산 시 `users.pq_score += final_delta`, `score_events`에 기록.
- `pq_score` 갱신 후 `levels`에서 해당 구간 등급으로 `level_code` 갱신.
- `total_votes += 1`, 적중이면 `total_wins += 1`.
- 연속 적중 시 `current_streak += 1`, 실패 시 `current_streak = 0` (감정서/연속 적중 배지 트리거).

### 2.4 무효(VOID) 처리
사건 자체가 무산되면 `final_result = VOID`. 이 카드의 모든 투표에 대해 `delta=0, reason=void_refund`로 score_event를 기록하고 `is_settled=true` 처리. 점수·승패 카운트 변동 없음. (idempotency를 위해 이벤트 자체는 남긴다.)

### 2.5 경계 케이스 (코드 구현 시 반드시 따를 것)

알고리즘을 코드로 옮길 때 부딪히는 미정의 케이스를 여기서 확정한다.

**점수 하한 (음수 방지):** PQ는 **0 미만으로 내려가지 않는다.** 정산 시 `new_pq = max(0, pq_score + delta)`로 클램프한다.
- 단, `score_events.delta`에는 **실제 적용된 변동량**을 기록한다. 예: PQ가 10인데 miss(-30)면 실제로는 -10만 적용되고 `delta=-10, pq_after=0`으로 기록. (원장 합산과 캐시값이 일치해야 하므로 명목 -30이 아니라 적용된 -10을 남긴다.)
- 이렇게 하면 "score_events의 delta 총합 == users.pq_score"가 항상 성립한다.

**최저 등급:** PQ 0~999 구간은 모두 `dull`(무딘 촉). 0이 최저이므로 음수 등급은 존재하지 않는다. `level_code`는 `levels`에서 `min_pq <= pq_score`인 가장 높은 등급으로 결정한다.

**cursed(고장난 촉) 판정:** PQ 구간이 아닌 별도 룰. 판정 조건을 다음으로 확정한다 — `total_votes >= 20` AND `win_rate < 0.30`. 이 조건을 만족하면 PQ 구간 등급보다 `cursed`를 **우선 표시**한다. (표본이 적은 신규 유저가 운 나쁘게 cursed 되는 것을 막기 위해 최소 20표 요구.)

**동점 정산 순서:** 한 카드의 여러 vote를 정산할 때 처리 순서는 결과에 영향을 주지 않는다(각 vote가 독립). 단 `current_streak`은 유저별 시계열이므로, **카드 단위 정산에서는 카드당 한 번만** streak를 갱신한다 (한 카드에 유저는 1표뿐이므로 자연히 보장됨 — `UNIQUE(user_id, card_id)`).

**신규 유저 시작값:** `pq_score=1000`, `level_code='rookie'`(촉 새내기, 1000 구간). dull(0~999)은 점수를 잃은 유저만 도달한다.

---

## 3. 정산 프로세스 (단일 트랜잭션)

`settle_card(card_id, result)` — 멱등(idempotent)하게 설계한다.

```
BEGIN TRANSACTION

1. 카드 잠금 조회 (SELECT ... FOR UPDATE)
   - status가 이미 'settled'면 즉시 종료 (재실행 방어)
   - status를 'settled'로, final_result = result, settled_at = now()

2. 해당 카드의 is_settled=false 인 votes 전체 조회

3. 각 vote에 대해:
   - result == VOID        → delta=0,  reason=void_refund
   - vote.choice == result → delta=역배보너스 적용, reason=hit/underdog_bonus, total_wins++
   - else                  → delta=-30(명목), reason=miss
   - 점수 클램프: applied_delta = max(0, pq_score + delta) - pq_score  (음수 방지, 2.5)
   - score_events INSERT (delta=applied_delta, pq_after=클램프 후 값. vote_id UNIQUE가 중복 방어)
   - users.pq_score = max(0, pq_score + delta), total_votes++, (적중 시)total_wins++, current_streak 갱신
   - vote.is_settled = true

4. 갱신된 pq_score 기준으로 users.level_code 재계산 (cursed 조건 우선 판정, 2.5)

COMMIT
```

핵심 안전장치:
- `SELECT ... FOR UPDATE`로 카드 행을 잠가 동시 정산을 직렬화.
- `score_events.vote_id UNIQUE`로 중복 지급을 DB 레벨에서 차단.
- 1단계에서 status 체크로 이미 정산된 카드는 빠르게 빠져나감.

이 세 가지 덕분에 정산 함수는 몇 번을 다시 돌려도 결과가 같다. 운영 중 정산 스크립트가 중간에 죽어도 안전하게 재실행할 수 있다.

---

## 4. 실시간 투표 비율 (주가 예측형 UI)

- 화면에선 `prediction_cards.yes_count / no_count`로 현재 비율을 보여준다 (캐시값이라 빠름).
- 투표 INSERT 시 같은 트랜잭션에서 해당 카드의 count를 +1 한다.
- 투표하는 유저의 `votes.odds_at_vote`에는 **그 INSERT 직후 기준 본인 진영 비율**을 저장.

---

## 5. MVP 범위에서 빠진 것 (의도적 제외)

다음은 설계엔 자리를 비워두되 MVP 구현에선 제외한다. 나중에 붙이기 쉽도록 스키마만 호환되게 둔다.

- 예지력 배틀(1:1 매치) — votes 구조 재사용 가능
- 카테고리별 레이더 차트 — score_events에 category가 card 통해 연결되므로 집계 쿼리로 산출 가능
- 감정서 이미지 생성 — current_streak / win_rate 기반으로 트리거만 정의해둠
- AI 자동 정산 — 지금은 운영자 수동 입력(settle_card 호출)으로 시작

---

## 6. 예지 기간 정책 및 마감/차단 규칙

### 6.1 기간 등급 (duration_tier)

카드는 세 가지 기간 등급을 가진다. **MVP에서는 `short`만 운영**하고, `mid`/`long`은 스키마에만 자리를 두고 구현은 추후로 미룬다.

| tier | 의미 | 예시 | MVP |
|------|------|------|-----|
| `short` | 당일~7일 (주간 사이클 위주) | 주말 프로야구 승패, 이번 주 멜론 1위, 주말 박스오피스 | ✅ 운영 |
| `mid` | 1주~1개월 | 월간 차트, 분기 실적 방향 | ⛔ 스키마만 |
| `long` | 1개월 초과 | 연말 시상식, "올해 안에 ○○ 할까" | ⛔ 스키마만 |

> MVP를 `short`로 좁히는 이유: 빠른 결과→빠른 보상으로 리텐션 사이클을 먼저 검증하기 위함. 장기 카드는 "던지고 잊힘" 문제와 결과 임박 푸시 알림 같은 부가 장치가 필요한데, 이는 리텐션 패턴이 보인 뒤 붙인다.

### 6.2 확장성 설계 (지금 안 만들지만 나중에 갈아엎지 않도록)

`mid`/`long`을 나중에 붙일 때 스키마 변경이 없도록 다음을 미리 보장한다:

- `duration_tier` 컬럼은 처음부터 존재한다. MVP 코드는 카드 생성 시 항상 `short`를 넣고, 피드 조회 시 `WHERE duration_tier = 'short'`로 필터링한다. tier 확장 시 이 필터만 풀면 된다.
- `event_start_at`은 NULL 허용. `short`의 스포츠 경기처럼 시점이 명확하면 채우고, 불명확하면 비운다. 장기 카드도 동일 구조를 그대로 쓴다.
- 결과 임박 푸시 알림, 장기 카드 리마인더 같은 기능은 **별도 테이블/잡으로 추가**되며 기존 스키마를 건드리지 않는다.

### 6.3 마감(closes_at) 결정 규칙

마감 시각은 두 경로로 정해지며, 둘 다 지원한다.

**(A) 시간 기반 자동 마감** — `event_start_at`이 있는 경우:
```
closes_at = event_start_at - 마감버퍼(category 기본값)
```
라인업 발표·부상 소식 같은 결정적 정보가 새기 직전에 닫는 것이 목적. 카테고리별 기본 버퍼:

| category | 기본 마감 버퍼 (분) | 비고 |
|----------|---------------|------|
| 스포츠 | `10` (10분 전) | 라인업 확정 직전 |
| 연예 (차트/시상) | `30` (30분 전) | |
| 경제/테크 | `0` (발표 시각) | 발표 즉시 마감 |
| 시사 | `0` + 운영자 강제 마감 권장 | 사건 시점 불명확 시 (B) 사용 |
| 도파민/기타 | `0` + 운영자 강제 마감 권장 | 사건 시점 불명확 시 (B) 사용 |

> 위 값은 카테고리별 **기본 버퍼(분)**이며 코드 상수(`CATEGORY_CLOSE_BUFFER_MINUTES`)로 둔다. 카드 생성 시 `event_start_at`이 있으면 이 값으로 `closes_at`을 자동 계산하고, 운영자가 카드별로 덮어쓸 수 있다. `event_start_at`이 NULL이면 운영자가 `closes_at`을 직접 지정한다.

**(B) 운영자 강제 마감** — `event_start_at`이 NULL이거나 사건 임박을 시스템이 알 수 없는 경우, 운영자가 카드를 즉시 `closed`로 전환할 수 있다. (`short` MVP에서도 안전장치로 반드시 필요)

### 6.4 투표 차단 (★ 백엔드에서 강제)

결과가 거의 확정된 시점의 투표를 막는 것은 공정성과 역배 시스템 보호의 핵심이다. 마감 후 들어온 투표는 점수를 쓸어가거나 역배 보너스를 무의미하게 만든다.

투표 INSERT 트랜잭션 안에서 **반드시 서버 시각 기준으로** 다음을 검증한다:
```
유효한 투표 조건:
  card.status == 'open'
  AND now() < card.closes_at
둘 중 하나라도 실패 → 투표 거부 (적절한 에러 응답)
```

> 이 검증은 반드시 백엔드(투표 INSERT와 같은 트랜잭션)에서 한다. 프론트엔드 비활성화만으로는 클라이언트 조작을 막을 수 없다. 프론트는 UX용으로 마감 카드 버튼을 비활성화하되, 최종 방어선은 서버다.

### 6.5 자동 마감 스케줄러

`closes_at`이 지난 `open` 카드를 주기적으로 `closed`로 전환하는 잡(예: 1분 주기)을 둔다. 이로써 `event_start_at` 기반 자동 마감이 시각 도래 시 실제로 닫힌다. `closed`~`settled` 사이 구간은 화면에 "결과 대기 중"으로 표시해 긴장감을 준다.

---

## 7. 다국어(i18n) 정책

글로벌 서비스 확장을 위해 **UI 텍스트와 카드 콘텐츠 양쪽**의 한/영 전환을 지원한다. 단, 둘은 처리 방식이 완전히 다르다. MVP는 한국어 중심으로 운영하되, 구조를 처음부터 다국어 호환으로 갖춘다.

### 7.1 두 종류의 번역을 구분한다

| 종류 | 대상 | 처리 방식 | 저장 위치 |
|------|------|-----------|-----------|
| UI 텍스트 | 버튼·라벨·등급명·고정 문구 | 프론트엔드 i18n 사전 (키-값) | 프론트 코드 (DB 아님) |
| 콘텐츠 | 카드 질문/설명 (데이터) | 번역 테이블 + 원본 폴백 | `card_translations` |

### 7.2 카드 콘텐츠 다국어 — 구조는 갖추되 MVP 운영은 단순하게

- 카드는 `origin_language`(작성 언어)와 원본 `title/description`을 항상 가진다.
- 추가 언어 번역은 `card_translations`에 쌓는다. **조회 시 유저 `preferred_language` 번역이 있으면 사용, 없으면 원본으로 폴백.**
- **MVP 운영 정책:** 번역 테이블을 적극 채우지 않는다. 대신 **언어권별로 카드 풀을 분리 노출**한다 (한국어 카드는 ko 유저에게, 영어 카드는 en 유저에게). 이유: 초기에 어색한 기계번역 카드가 노출되면 서비스 인상을 크게 깎는다. 양쪽에 다 보여주기보다 언어권을 나누는 편이 낫다.
- 글로벌 본격화 시: 공식(official) 카드부터 수동 번역(`source=manual`)으로 `card_translations`를 채워 양쪽 노출로 전환. **이때 스키마 변경은 없다** — 테이블이 이미 존재하므로 데이터만 채우고 조회 폴백 로직만 활성화하면 된다.

### 7.3 등급명·고정 카피 — 한국어 말맛 자산

"예리한 촉", "고장난 촉", "신들린 촉" 같은 등급명은 직역하면 매력이 죽는다. 이들은 단순 번역이 아니라 **언어별로 따로 카피라이팅된 자산**으로 다룬다.

- DB는 `level_code`(불변 키)만 안다. 표시명은 프론트 i18n 사전에서 `level_code` → 언어별 카피로 매핑.
- 예: `sharp` → ko "예리한 촉" / en "Sharp Sense" (직역 아닌 의역·재창작)
- 영문 카피는 출시 전 별도 작업으로 확정한다. (지금은 자리만 정의)

### 7.4 언어 결정 우선순위

표시 언어는 다음 순서로 결정: ① 유저가 설정에서 고른 `preferred_language` → ② 없으면 브라우저/기기 로캘 → ③ 그래도 없으면 기본값 `ko`.

---

## 8. 플랫폼 전략 (웹 우선 → 네이티브 확장)

### 8.1 단계적 접근

| 단계 | 형태 | 목적 |
|------|------|------|
| MVP | 모바일 웹 / PWA (Next.js) | 카카오톡 링크 바이럴로 빠른 검증. 설치 장벽 0 |
| 확장 | React Native 네이티브 (안드로이드 우선) | 플레이스토어 출시, 푸시 알림, 네이티브 UX |

> 웹 우선 이유: 촉의 초기 성공 공식은 "카톡에 링크 던지고 주말 지나 결과 확인"이다. 설치가 필요하면 초기 바이럴이 죽는다. 네이티브는 리텐션 검증 후 확장한다.

### 8.2 네이티브 확장을 위해 MVP부터 지킬 것

프론트엔드는 웹으로 시작하지만, **백엔드를 나중에 갈아엎지 않도록** 다음을 MVP부터 적용한다:

1. **인증은 토큰(JWT) 기반.** 세션 쿠키 방식을 쓰지 않는다. 네이티브 앱은 쿠키 세션이 까다롭다. 웹/네이티브가 같은 토큰 기반 API를 공유하도록 처음부터 토큰으로 간다.
2. **API는 순수 백엔드 분리(headless).** 프론트 종류와 무관하게 동작하는 REST API. Next.js는 이 API를 소비하는 클라이언트일 뿐, 백엔드 로직을 Next.js 서버에 두지 않는다.
3. **푸시 토큰 자리 확보.** `device_tokens`(1.7) 테이블을 미리 둔다. MVP에선 비워두고, 네이티브 단계에서 FCM 연동을 붙인다.

### 8.3 PWA 준비 (MVP 단계 선택사항)

모바일 웹을 앱처럼 쓰게 하려면 manifest + 서비스워커로 PWA화한다. 안드로이드는 TWA로 플레이스토어 우회 등재도 가능하나, 정식 네이티브 출시는 React Native 단계로 본다.

