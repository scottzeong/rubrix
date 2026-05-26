# Rubrix Supabase Setup

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속
2. New project
3. Project name: `rubrix`
4. Region은 가까운 곳으로 선택
5. Database password는 안전하게 저장

## 2. 테이블 생성

Supabase Dashboard → SQL Editor에서 아래 SQL을 실행합니다.

```sql
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
```

Rubrix MVP는 우선 앱 전체 상태를 `app_state` 테이블의 JSON으로 저장합니다.

## 3. API 키 확인

Supabase Dashboard → Project Settings → API에서 아래 값을 확인합니다.

```text
Project URL
service_role key
```

주의: `service_role key`는 절대 브라우저 코드나 GitHub에 올리면 안 됩니다.

## 4. Vercel 환경변수 추가

Vercel Project → Settings → Environment Variables에 아래를 추가합니다.

```text
SUPABASE_URL=Project URL
SUPABASE_SERVICE_ROLE_KEY=service_role key
```

이미 있는 `OPENAI_API_KEY`도 유지해야 합니다.

## 5. 재배포

환경변수 추가 후 Vercel에서 Redeploy를 실행합니다.

## 6. 확인

Rubrix 접속 후 데이터를 추가하고 새로고침합니다.

```text
Rubric Sets / Assignments / Submissions / Evaluations
```

새로고침 후에도 데이터가 남아 있으면 Supabase 저장이 정상입니다.
