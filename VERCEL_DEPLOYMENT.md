# Rubrix Vercel Deployment

## 1. 준비

Vercel에서는 로컬의 `scripts/static-server.mjs` 대신 `api/evaluate.js`가 OpenAI API 호출을 처리합니다.

## 2. GitHub에 업로드

`.env` 파일은 절대 올리지 마세요. `.gitignore`에 이미 제외했습니다.

## 3. Vercel 프로젝트 생성

1. Vercel에서 `New Project`
2. GitHub 저장소 선택
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`

## 4. 환경변수 설정

Vercel Project Settings → Environment Variables:

```text
OPENAI_API_KEY=발급받은_API_KEY
```

Production, Preview, Development에 모두 사용할지 선택할 수 있습니다.

## 5. 도메인 연결

Vercel Project Settings → Domains:

```text
rubrix.kr
www.rubrix.kr
```

Vercel이 안내하는 DNS 값을 후이즈 DNS 관리 화면에 등록하면 됩니다.

## 6. 배포 후 확인

배포가 끝나면 다음 흐름을 테스트합니다.

```text
Submissions → 제출물 추가 → 실행 → Evaluations → 최종 확정 → Reports
```
