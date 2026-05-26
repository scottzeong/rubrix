# Report Evaluation System MVP Development Plan

## 1. 프로젝트 개요

이 시스템은 학생들이 제출한 리포트를 평가자가 개인적으로 업로드하고, 사전에 정의한 평가 루브릭과 프롬프트를 바탕으로 AI 평가 결과를 생성한 뒤, 평가자가 최종 검토하여 학생에게 전달할 피드백을 얻는 단일 사용자용 MVP 시스템이다.

초기 버전에서는 복잡한 사용자 관리, 학생 계정, 제출 포털, LMS 연동은 포함하지 않는다. 사용자는 관리자이자 평가자 1명으로 가정한다.

## 2. MVP 목표

### 핵심 목표

- 평가자가 직접 평가세트를 만들고 관리할 수 있다.
- 평가세트는 공통 평가 80점과 과제유형별 추가 평가 20점으로 구성된다.
- 평가자는 세부 평가항목의 사용 여부를 체크하여 이번 평가에 반영할 수 있다.
- 평가자는 PDF 파일 업로드 또는 텍스트 붙여넣기로 리포트를 등록할 수 있다.
- AI는 평가세트, 선택된 세부항목, 전체 프롬프트, 리포트 내용을 바탕으로 평가 결과를 생성한다.
- 평가자는 AI 평가 결과를 확인하고 필요한 경우 점수와 피드백을 수정할 수 있다.
- 최종 결과는 학생에게 개별 전달하기 쉬운 형태로 확인하거나 복사할 수 있다.

### 제외 범위

- 학생 로그인
- 다중 평가자 권한 관리
- 관리자/평가자 역할 분리
- DOCX, HWP 직접 처리
- 표절 검사 엔진
- LMS 연동
- 자동 이메일 발송
- 결제, 기관 계정, 조직 관리

## 3. 사용자 모델

MVP에서는 단일 사용자를 전제로 한다.

```text
User = Evaluator + Admin
```

사용자는 다음 권한을 모두 가진다.

- 평가세트 생성/수정/삭제
- 프롬프트 템플릿 관리
- 과제 생성/수정/삭제
- 제출물 업로드/삭제
- AI 평가 실행
- 평가 결과 수정 및 확정
- 결과 조회 및 내보내기

## 4. 주요 메뉴 구조

MVP 메뉴명은 영어로 구성한다.

```text
Dashboard

Rubric Sets
- Rubric Set List
- Create Rubric Set
- Criteria Manager
- Prompt Template

Assignments
- Assignment List
- Create Assignment
- Rubric Mapping

Submissions
- Submission List
- Upload PDF
- Paste Text
- Extracted Text

Evaluations
- Evaluation Queue
- AI Results
- Human Review
- Final Results

Reports
- Evaluation Reports
- Student Feedback
- Export

Settings
- AI Settings
- App Settings
```

## 5. 추천 화면 흐름

### 5.1 Rubric Sets

평가세트를 생성하고 관리하는 핵심 메뉴다.

주요 기능:

- 평가세트 목록 조회
- 평가세트 생성
- 평가세트 수정
- 평가세트 복제
- 평가세트 삭제
- 공통 평가 카테고리 관리
- 과제유형별 추가 평가항목 관리
- 전체 프롬프트 템플릿 관리

### 5.2 Assignments

평가 대상 과제를 관리한다.

주요 기능:

- 과제명 입력
- 과제 설명 입력
- 리포트 주제 또는 지시문 입력
- 사용할 평가세트 선택
- 제출물과 평가 결과를 과제 단위로 묶어 관리

### 5.3 Submissions

학생 리포트를 등록하는 메뉴다.

입력 방식:

- PDF Upload
- Paste Text

주요 기능:

- 제출자 이름 입력
- 학번 또는 식별자 입력
- PDF 파일 업로드
- 텍스트 직접 붙여넣기
- PDF 텍스트 추출 결과 확인
- 제출물 수정/삭제

### 5.4 Evaluations

AI 평가와 평가자 검토를 수행하는 메뉴다.

주요 기능:

- 평가 대기 제출물 확인
- 사용할 세부 평가항목 체크
- AI 평가 실행
- 항목별 점수 확인
- 항목별 평가 근거 확인
- 학생용 피드백 확인
- 평가자 메모 작성
- 점수 및 피드백 수정
- 최종 평가 확정

### 5.5 Reports

확정된 평가 결과를 확인하고 전달용 자료를 생성한다.

주요 기능:

- 과제별 평가 결과 목록
- 학생별 평가 결과 상세
- 학생 전달용 피드백 보기
- 평가 결과 복사
- CSV 또는 Excel 내보내기

### 5.6 Settings

MVP에서는 최소한의 설정만 제공한다.

주요 기능:

- AI 모델명 설정
- API Key 설정
- 기본 평가 언어 설정
- 기본 출력 형식 설정

## 6. 평가세트 구조

평가세트는 시스템의 핵심 데이터다.

```text
Rubric Set
- name
- description
- total_score: 100
- common_score: 80
- task_specific_score: 20
- common_categories
- task_specific_categories
- prompt_template
- output_format
- created_at
- updated_at
```

## 7. 평가 카테고리 구조

### 7.1 공통 평가 80점

형식 및 제출요건은 제외한다.

```text
Common Evaluation: 80 points

1. Topic & Assignment Understanding
2. Content Quality
3. Analysis & Critical Thinking
4. Logic & Organization
5. Source Use & Research Competence
6. Originality & Insight
7. Expression & Writing Quality
8. Citation & Research Ethics
```

초기 권장 배점:

| Category | Score |
|---|---:|
| Topic & Assignment Understanding | 10 |
| Content Quality | 12 |
| Analysis & Critical Thinking | 14 |
| Logic & Organization | 12 |
| Source Use & Research Competence | 10 |
| Originality & Insight | 8 |
| Expression & Writing Quality | 8 |
| Citation & Research Ethics | 6 |
| Total | 80 |

### 7.2 과제유형별 추가 평가 20점

```text
Task-specific Evaluation: 20 points
```

과제 유형에 따라 다음 중 하나를 선택하거나 직접 구성한다.

- Literature Review
- Experiment Report
- Case Analysis
- Policy Report
- Reflection Essay
- Book Review
- Field Research Report
- Data Analysis Report
- Project Report
- Debate Report

## 8. 세부 평가항목 사용 여부

각 카테고리는 여러 세부 평가항목을 가진다. 평가자는 평가 실행 전에 사용할 세부항목을 체크한다.

예시:

```text
Topic & Assignment Understanding
- Understands the core question
- Responds directly to the assignment prompt
- Uses key concepts accurately
- Sets an appropriate scope
- Maintains relevance throughout the report
```

평가 실행 시 체크된 항목만 AI 프롬프트에 포함한다.

## 9. 기본 세부 평가항목 목록

### 9.1 Topic & Assignment Understanding

- Understands the core question
- Responds directly to the assignment prompt
- Uses key concepts accurately
- Sets an appropriate scope
- Maintains relevance throughout the report
- Avoids unrelated background information

### 9.2 Content Quality

- Covers essential content sufficiently
- Provides accurate facts and concepts
- Explains important ideas clearly
- Selects relevant information
- Provides concrete supporting details
- Uses examples appropriately
- Maintains balanced coverage

### 9.3 Analysis & Critical Thinking

- Goes beyond summary
- Interprets meaning and implications
- Identifies key issues
- Explains cause and effect
- Compares perspectives or theories
- Evaluates limitations
- Considers counterarguments
- Suggests reasonable alternatives

### 9.4 Logic & Organization

- Presents a clear central argument
- Connects claims, evidence, and conclusions
- Organizes introduction, body, and conclusion effectively
- Maintains paragraph coherence
- Uses a natural sequence of ideas
- Avoids unnecessary repetition
- Avoids logical leaps
- Draws a conclusion supported by the body

### 9.5 Source Use & Research Competence

- Uses reliable sources
- Uses sources relevant to the topic
- Integrates sources into the argument
- Interprets data or sources accurately
- Uses diverse sources where appropriate
- Uses recent sources where appropriate
- Provides sufficient evidence for conclusions
- Applies an appropriate research approach

### 9.6 Originality & Insight

- Presents the evaluator's own perspective
- Offers meaningful interpretation
- Shows creative approach to the topic
- Derives useful implications
- Demonstrates problem-solving perspective
- Connects learning to broader context
- Avoids simple restatement of sources

### 9.7 Expression & Writing Quality

- Uses clear sentences
- Uses appropriate academic tone
- Uses key terms consistently
- Maintains readable paragraph flow
- Avoids excessive verbosity
- Avoids informal spoken style
- Avoids awkward translated expressions
- Has few grammar or spelling errors

### 9.8 Citation & Research Ethics

- Distinguishes direct and indirect citation
- Marks sources clearly
- Provides reference information
- Avoids plagiarism
- Avoids distortion of source meaning
- Discloses AI tool use if required
- Uses citation style consistently where required

## 10. 프롬프트 관리 방식

MVP에서는 평가자가 매번 프롬프트를 수정하지 않도록 한다.

권장 방식:

- 전체 평가 프롬프트는 Rubric Set 단위로 저장한다.
- 평가자는 평가 실행 시 세부 평가항목 사용 여부만 체크한다.
- 시스템은 체크된 항목, 과제 정보, 리포트 본문을 조합하여 최종 프롬프트를 생성한다.
- 프롬프트 수정은 Rubric Set 편집 화면에서만 수행한다.

## 11. 기본 프롬프트 템플릿

```text
You are an academic report evaluation assistant.

Evaluate the student's report according to the rubric set provided below.
Use only the selected criteria. Do not evaluate criteria that are not selected.
The evaluation must be fair, specific, and evidence-based.

Important rules:
- Do not invent content that is not present in the report.
- Do not judge the student's identity, background, or personal traits.
- Focus only on the submitted report.
- If evidence is insufficient, state that clearly.
- Award scores according to the category score limits.
- Provide concrete reasons for each score.
- Provide feedback that the student can use to improve.
- The final decision may be reviewed and adjusted by a human evaluator.

Assignment:
{{assignment_title}}

Assignment Description:
{{assignment_description}}

Rubric Set:
{{rubric_set_name}}

Selected Criteria:
{{selected_criteria}}

Report Text:
{{report_text}}

Return the result in the following JSON structure:

{
  "total_score": 0,
  "common_score": 0,
  "task_specific_score": 0,
  "category_results": [
    {
      "category": "",
      "max_score": 0,
      "score": 0,
      "selected_criteria": [],
      "reason": "",
      "evidence": [],
      "improvement": ""
    }
  ],
  "overall_feedback": "",
  "student_feedback": "",
  "review_notes": "",
  "review_required": true
}
```

## 12. 평가 결과 데이터 구조

```text
Evaluation Result
- id
- assignment_id
- submission_id
- rubric_set_id
- selected_criteria
- ai_raw_result
- total_score
- common_score
- task_specific_score
- category_results
- student_feedback
- evaluator_adjusted_score
- evaluator_comment
- status
- created_at
- updated_at
```

상태값:

```text
draft
ai_completed
reviewed
finalized
```

## 13. 파일 입력 정책

MVP 입력 방식은 두 가지다.

### 13.1 PDF Upload

- PDF 파일을 업로드한다.
- 시스템은 PDF에서 텍스트를 추출한다.
- 추출된 텍스트를 평가자가 확인할 수 있게 한다.
- 텍스트 추출 품질이 낮은 경우 평가자가 직접 수정할 수 있게 한다.

### 13.2 Paste Text

- 평가자가 리포트 본문을 직접 붙여넣는다.
- PDF 변환이 어렵거나 텍스트만 있는 경우에 사용한다.

DOCX, HWP는 MVP에서 직접 지원하지 않는다. 제출자가 PDF로 변환한 뒤 업로드하는 것을 기본 정책으로 한다.

## 14. 기술 구성 제안

Codex를 이용해 빠르게 개발하기 좋은 구성은 다음과 같다.

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui 또는 단순 커스텀 컴포넌트

### Backend

- Node.js
- Express 또는 Fastify
- SQLite
- Prisma ORM

### AI Integration

- OpenAI API
- 평가 프롬프트 생성 모듈
- JSON 응답 파싱 및 검증

### PDF Processing

- pdf-parse 또는 유사 라이브러리
- 추출 텍스트 저장

### Export

- CSV export
- 추후 Excel export 추가 가능

## 15. 주요 데이터 테이블

```text
rubric_sets
- id
- name
- description
- common_score
- task_specific_score
- prompt_template
- created_at
- updated_at

rubric_categories
- id
- rubric_set_id
- type
- name
- description
- max_score
- sort_order

rubric_criteria
- id
- category_id
- name
- description
- default_enabled
- sort_order

assignments
- id
- title
- description
- rubric_set_id
- created_at
- updated_at

submissions
- id
- assignment_id
- student_name
- student_identifier
- input_type
- file_path
- original_text
- extracted_text
- created_at
- updated_at

evaluations
- id
- assignment_id
- submission_id
- rubric_set_id
- selected_criteria_json
- ai_result_json
- total_score
- adjusted_score
- student_feedback
- evaluator_comment
- status
- created_at
- updated_at
```

## 16. UI 디자인 방향

전체 디자인은 깔끔한 청색 계열 variation으로 설계한다.

### 디자인 키워드

- Clean
- Academic
- Focused
- Calm
- Professional

### 색상 방향

```text
Primary Blue: #2563EB
Deep Navy: #1E3A8A
Soft Blue Background: #EFF6FF
Border Blue Gray: #CBD5E1
Text Dark: #0F172A
Text Muted: #64748B
Success: #16A34A
Warning: #F59E0B
Danger: #DC2626
Surface: #FFFFFF
App Background: #F8FAFC
```

### 화면 구성 원칙

- 좌측 사이드바에 주요 메뉴 배치
- 상단에는 현재 화면 제목과 주요 액션 버튼 배치
- 데이터 목록은 테이블 중심으로 구성
- 평가 화면은 좌우 분할 구조를 사용
  - 왼쪽: 제출 리포트 텍스트
  - 오른쪽: 루브릭, 선택 항목, AI 평가 결과
- 점수는 카테고리별 progress bar 또는 compact score badge로 표시
- 버튼과 상태 표시에는 청색 계열을 기본으로 사용하되, 경고/오류는 별도 색상 사용

## 17. MVP 개발 단계

### Phase 1. Project Setup

- Vite React TypeScript 프로젝트 생성
- Tailwind CSS 설정
- 기본 레이아웃 구성
- SQLite/Prisma 또는 로컬 JSON 저장 방식 결정

### Phase 2. Rubric Sets

- 평가세트 목록 화면
- 평가세트 생성/수정 화면
- 카테고리 및 세부항목 관리
- 프롬프트 템플릿 관리

### Phase 3. Assignments

- 과제 목록 화면
- 과제 생성/수정
- 평가세트 연결

### Phase 4. Submissions

- 제출물 목록 화면
- PDF 업로드
- 텍스트 붙여넣기
- 추출 텍스트 확인

### Phase 5. Evaluations

- 평가 대기 목록
- 세부 평가항목 체크
- 최종 프롬프트 생성
- AI 평가 실행
- 결과 저장
- 평가자 수정 및 확정

### Phase 6. Reports

- 평가 결과 목록
- 학생 피드백 화면
- 결과 복사
- CSV export

## 18. Codex 작업 지시 예시

초기 구현을 Codex에 요청할 때는 다음 순서로 진행하는 것이 좋다.

```text
1. Vite + React + TypeScript 기반 MVP 프로젝트를 생성해줘.
2. 청색 계열의 깔끔한 admin dashboard layout을 만들어줘.
3. Rubric Sets 메뉴와 CRUD 화면을 먼저 구현해줘.
4. 기본 평가세트 seed data를 추가해줘.
5. Assignments와 Submissions 화면을 추가해줘.
6. PDF 업로드와 텍스트 붙여넣기 입력을 구현해줘.
7. 선택된 세부 평가항목으로 AI 평가 프롬프트를 생성하는 모듈을 만들어줘.
8. OpenAI API 평가 실행과 JSON 결과 저장을 구현해줘.
9. Human Review 화면에서 점수와 피드백을 수정할 수 있게 해줘.
10. Final Results와 CSV export를 구현해줘.
```

## 19. MVP 완료 기준

다음이 가능하면 MVP 완료로 본다.

- 평가세트를 생성할 수 있다.
- 공통 80점, 과제유형별 20점 구조를 관리할 수 있다.
- 세부 평가항목을 체크하여 사용할 수 있다.
- 과제를 생성하고 평가세트를 연결할 수 있다.
- PDF 또는 텍스트로 제출물을 등록할 수 있다.
- AI 평가를 실행할 수 있다.
- 평가 결과를 항목별로 확인할 수 있다.
- 평가자가 점수와 피드백을 수정할 수 있다.
- 최종 피드백을 학생에게 전달하기 쉬운 형태로 확인할 수 있다.

## 20. 향후 확장 후보

- DOCX 직접 처리
- HWP 직접 처리
- 학생 제출 포털
- 다중 평가자 지원
- 루브릭 버전 관리
- 평가 결과 비교 분석
- 표절 또는 유사도 검사
- LMS 연동
- 이메일 발송
- Excel export
- 평가 프롬프트 품질 점검 기능
