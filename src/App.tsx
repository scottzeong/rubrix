import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type MenuKey =
  | "dashboard"
  | "rubrics"
  | "assignments"
  | "submissions"
  | "evaluations"
  | "reports"
  | "settings";

type Criterion = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

type Category = {
  id: string;
  name: string;
  type: "common" | "task";
  maxScore: number;
  criteria: Criterion[];
};

type RubricSet = {
  id: string;
  name: string;
  description: string;
  promptPersona: string;
  promptCommonCriteria: string;
  promptPrinciples: string;
  promptTemplate: string;
  categories: Category[];
};

type Assignment = {
  id: string;
  title: string;
  description: string;
  taskType: string;
  rubricSetId: string;
};

type Submission = {
  id: string;
  assignmentId: string;
  studentName: string;
  studentIdentifier: string;
  inputType: "pdf" | "text";
  fileName?: string;
  reportText: string;
};

type Evaluation = {
  id: string;
  submissionId: string;
  rubricSetId: string;
  totalScore: number;
  status: "ai_completed" | "finalized";
  feedback: string;
  studentReport: string;
  prompt: string;
};

type TaskType = {
  id: string;
  name: string;
  description: string;
  focus: string[];
};

const initialTaskTypes: TaskType[] = [
  {
    id: "literature-review",
    name: "문헌 리뷰",
    description: "선행연구를 정리하고 연구 흐름, 쟁점, 연구 공백을 도출하는 리포트",
    focus: ["선행연구 정리", "연구 흐름 파악", "연구 공백 도출"],
  },
  {
    id: "experiment-report",
    name: "실험 보고서",
    description: "가설, 실험설계, 결과 분석, 오차 논의를 포함하는 보고서",
    focus: ["연구가설", "실험설계", "결과 분석", "오차 논의"],
  },
  {
    id: "case-analysis",
    name: "사례 분석",
    description: "구체적 사례를 선정하고 이론이나 개념을 적용해 분석하는 리포트",
    focus: ["사례 선정 적절성", "맥락 설명", "이론 적용"],
  },
  {
    id: "policy-report",
    name: "정책 보고서",
    description: "정책 문제를 정의하고 이해관계자, 대안, 실행 가능성을 검토하는 보고서",
    focus: ["정책 문제 정의", "이해관계자 분석", "실행 가능성"],
  },
  {
    id: "reflection-essay",
    name: "감상문/성찰문",
    description: "개인적 경험과 학습 내용을 연결하고 성찰을 제시하는 글",
    focus: ["개인적 반응의 진정성", "경험과 개념의 연결", "성찰의 구체성"],
  },
  {
    id: "book-review",
    name: "독후감",
    description: "작품이나 도서를 이해하고 핵심 주제와 비평적 해석을 제시하는 글",
    focus: ["작품 이해", "핵심 주제 파악", "비평적 해석"],
  },
  {
    id: "field-research",
    name: "현장 조사 보고서",
    description: "현장 자료를 관찰, 기록, 해석하여 의미를 도출하는 보고서",
    focus: ["조사 방법", "관찰 기록", "현장 자료 해석"],
  },
  {
    id: "data-analysis",
    name: "데이터 분석 보고서",
    description: "데이터 처리, 분석 방법, 시각화, 결과 해석을 포함하는 보고서",
    focus: ["데이터 전처리", "분석 방법", "시각화", "결과 해석"],
  },
  {
    id: "project-report",
    name: "설계/프로젝트 보고서",
    description: "프로젝트 목표, 설계 과정, 결과물, 개선점을 설명하는 보고서",
    focus: ["목표 정의", "설계 과정", "결과물 설명", "개선점"],
  },
  {
    id: "debate-report",
    name: "토론 보고서",
    description: "찬반 논거를 정리하고 반론 대응과 최종 입장을 제시하는 보고서",
    focus: ["찬반 논거 정리", "반론 대응", "입장 정교화"],
  },
];

const defaultPrompt = `당신은 대학 리포트 평가를 보조하는 AI 평가자입니다.

아래에 제공된 평가세트와 선택된 세부 평가항목에 따라 학생 리포트를 평가하세요.
선택된 평가항목만 사용하고, 선택되지 않은 항목은 평가하지 마세요.
평가는 공정하고 구체적이며 리포트 본문에 근거해야 합니다.

중요한 원칙:
- 리포트에 없는 내용을 지어내지 마세요.
- 제출된 리포트 내용만 평가하세요.
- 근거가 부족하면 그 사실을 명확히 밝히세요.
- 각 카테고리의 배점 한도에 맞게 점수를 부여하세요.
- 점수마다 구체적인 이유를 제시하세요.
- 학생이 개선에 활용할 수 있는 피드백을 제공하세요.
- 최종 판단은 평가자가 검토하고 조정할 수 있습니다.`;

const seedRubric: RubricSet = {
  id: "rubric-general-report",
  name: "일반 리포트 평가세트",
  description: "학술 리포트를 위한 공통 80점 + 과제유형별 20점 평가세트입니다.",
  promptPersona: "당신은 대학 리포트 평가를 보조하는 AI 평가자입니다.",
  promptCommonCriteria:
    "아래에 제공된 평가세트와 선택된 세부 평가항목에 따라 학생 리포트를 평가하세요. 선택된 평가항목만 사용하고, 선택되지 않은 항목은 평가하지 마세요.",
  promptPrinciples:
    "리포트에 없는 내용을 지어내지 말고, 제출된 리포트 내용만 평가하세요. 근거가 부족하면 명확히 밝히고, 점수마다 구체적인 이유와 개선 가능한 피드백을 제공하세요.",
  promptTemplate: defaultPrompt,
  categories: [
    category("topic", "주제 및 과제 이해", "common", 10, [
      "핵심 질문을 정확히 이해함",
      "과제 지시문에 직접적으로 답함",
      "핵심 개념을 정확히 사용함",
      "주제 범위를 적절히 설정함",
      "리포트 전체에서 관련성을 유지함",
    ]),
    category("content", "내용의 충실성", "common", 12, [
      "필수 내용을 충분히 다룸",
      "사실과 개념을 정확히 제시함",
      "중요한 아이디어를 명확히 설명함",
      "사례를 적절히 활용함",
      "내용을 균형 있게 다룸",
    ]),
    category("analysis", "분석 및 비판적 사고", "common", 14, [
      "단순 요약을 넘어 분석함",
      "핵심 쟁점을 식별함",
      "원인과 결과를 설명함",
      "한계점을 검토함",
      "반론이나 다른 해석을 고려함",
    ]),
    category("logic", "논리와 구성", "common", 12, [
      "중심 주장을 명확히 제시함",
      "주장, 근거, 결론을 연결함",
      "문단의 일관성을 유지함",
      "불필요한 반복을 피함",
      "근거에 의해 뒷받침되는 결론을 도출함",
    ]),
    category("sources", "자료 활용 및 연구 역량", "common", 10, [
      "신뢰할 수 있는 자료를 사용함",
      "주제와 관련된 자료를 사용함",
      "자료를 논의에 통합함",
      "자료를 정확히 해석함",
      "결론을 뒷받침할 충분한 근거를 제시함",
    ]),
    category("originality", "독창성과 통찰", "common", 8, [
      "자신의 관점을 제시함",
      "의미 있는 해석을 제공함",
      "유용한 시사점을 도출함",
      "자료의 단순 재진술에 머무르지 않음",
    ]),
    category("writing", "표현과 문장력", "common", 8, [
      "문장이 명확함",
      "적절한 학술적 문체를 사용함",
      "핵심 용어를 일관되게 사용함",
      "읽기 쉬운 문단 흐름을 유지함",
    ]),
    category("ethics", "인용과 연구윤리", "common", 6, [
      "직접인용과 간접인용을 구분함",
      "출처를 명확히 표시함",
      "표절을 피함",
      "자료의 의미를 왜곡하지 않음",
    ]),
    category("task", "과제유형별 추가 평가", "task", 20, [
      "선택된 리포트 유형의 요구사항을 반영함",
      "과제 유형에 적합한 방법을 사용함",
      "과제 특성에 맞는 근거 또는 성찰을 제시함",
      "이번 과제의 특수한 목적을 충족함",
    ]),
  ],
};

const initialAssignments: Assignment[] = [
  {
    id: "assignment-1",
    title: "샘플 학술 리포트",
    description: "리포트가 과제 질문에 근거를 바탕으로 답하고 있는지 평가합니다.",
    taskType: "case-analysis",
    rubricSetId: seedRubric.id,
  },
];

function category(
  id: string,
  name: string,
  type: "common" | "task",
  maxScore: number,
  criteria: string[]
): Category {
  return {
    id,
    name,
    type,
    maxScore,
    criteria: criteria.map((criterionName, index) => ({
      id: `${id}-${index}`,
      name: criterionName,
      description: criterionName,
      enabled: true,
    })),
  };
}

const menu = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "rubrics", label: "Rubric Sets", icon: BookOpenCheck },
  { key: "assignments", label: "Assignments", icon: ClipboardCheck },
  { key: "submissions", label: "Submissions", icon: Upload },
  { key: "evaluations", label: "Evaluations", icon: Sparkles },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
] satisfies { key: MenuKey; label: string; icon: typeof LayoutDashboard }[];

function statusLabel(status: Evaluation["status"]) {
  return status === "finalized" ? "최종 확정" : "AI 평가 완료";
}

export function App() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");
  const [rubrics, setRubrics] = useState<RubricSet[]>([seedRubric]);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>(initialTaskTypes);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState(seedRubric.id);
  const [aiModel, setAiModel] = useState("gpt-5.4-mini");
  const [evaluatingSubmissionIds, setEvaluatingSubmissionIds] = useState<string[]>([]);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [storageStatus, setStorageStatus] = useState("저장소 연결 확인 중");
  const selectedRubric = rubrics.find((rubric) => rubric.id === selectedRubricId) ?? rubrics[0];

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      try {
        const response = await fetch("/api/state");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "저장된 데이터를 불러오지 못했습니다.");
        }

        if (payload.data && isMounted) {
          setRubrics(payload.data.rubrics ?? [seedRubric]);
          setAssignments(payload.data.assignments ?? initialAssignments);
          setTaskTypes(payload.data.taskTypes ?? initialTaskTypes);
          setSubmissions(payload.data.submissions ?? []);
          setEvaluations(payload.data.evaluations ?? []);
          setSelectedRubricId(payload.data.selectedRubricId ?? seedRubric.id);
          setAiModel(payload.data.aiModel ?? "gpt-5.4-mini");
        }

        if (isMounted) {
          setStorageStatus("Supabase 저장소 연결됨");
        }
      } catch (error) {
        if (isMounted) {
          setStorageStatus(
            `Supabase 저장소 미연결: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
          );
        }
      } finally {
        if (isMounted) {
          setIsStateLoaded(true);
        }
      }
    }

    loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              rubrics,
              assignments,
              taskTypes,
              submissions,
              evaluations,
              selectedRubricId,
              aiModel,
            },
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "데이터 저장에 실패했습니다.");
        }

        setStorageStatus("저장됨");
      } catch (error) {
        setStorageStatus(`저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [aiModel, assignments, evaluations, isStateLoaded, rubrics, selectedRubricId, submissions, taskTypes]);

  const stats = useMemo(
    () => [
      { label: "평가세트", value: rubrics.length },
      { label: "과제", value: assignments.length },
      { label: "제출물", value: submissions.length },
      { label: "평가 결과", value: evaluations.length },
    ],
    [assignments.length, evaluations.length, rubrics.length, submissions.length]
  );

  function updateRubric(nextRubric: RubricSet) {
    setRubrics((current) => current.map((rubric) => (rubric.id === nextRubric.id ? nextRubric : rubric)));
  }

  function addRubricSet(name?: string, description?: string) {
    const sourceRubric = selectedRubric;
    const nextRubric: RubricSet = {
      ...sourceRubric,
      id: crypto.randomUUID(),
      name: name?.trim() || `새 평가세트 ${rubrics.length + 1}`,
      description: description?.trim() || "새 과제에 사용할 평가세트입니다.",
      categories: sourceRubric.categories.map((categoryItem) => ({
        ...categoryItem,
        id: crypto.randomUUID(),
        criteria: categoryItem.criteria.map((criterionItem) => ({
          ...criterionItem,
          id: crypto.randomUUID(),
        })),
      })),
    };
    setRubrics((current) => [...current, nextRubric]);
    setSelectedRubricId(nextRubric.id);
  }

  function deleteRubricSet(rubricId: string) {
    if (rubrics.length <= 1) return;
    if (!window.confirm("이 평가세트를 삭제할까요? 연결된 과제는 다른 평가세트로 변경됩니다.")) return;
    const fallbackRubric = rubrics.find((rubric) => rubric.id !== rubricId);
    setRubrics((current) => current.filter((rubric) => rubric.id !== rubricId));
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.rubricSetId === rubricId && fallbackRubric
          ? { ...assignment, rubricSetId: fallbackRubric.id }
          : assignment
      )
    );
    if (selectedRubricId === rubricId && fallbackRubric) {
      setSelectedRubricId(fallbackRubric.id);
    }
  }

  function addAssignment(values?: Partial<Assignment>) {
    const title = values?.title || `새 과제 ${assignments.length + 1}`;
    setAssignments((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title,
        description: values?.description || "과제 질문과 평가 맥락을 입력하세요.",
        taskType: values?.taskType || taskTypes[0].id,
        rubricSetId: values?.rubricSetId || selectedRubric.id,
      },
    ]);
  }

  function deleteAssignment(assignmentId: string) {
    if (!window.confirm("이 과제를 삭제할까요?")) return;
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
  }

  function deleteSubmission(submissionId: string) {
    if (!window.confirm("이 제출물을 삭제할까요? 연결된 평가결과도 함께 삭제됩니다.")) return;
    setSubmissions((current) => current.filter((submission) => submission.id !== submissionId));
    setEvaluations((current) => current.filter((evaluation) => evaluation.submissionId !== submissionId));
  }

  function addSubmission(inputType: "pdf" | "text", values: {
    assignmentId: string;
    studentName: string;
    studentIdentifier: string;
    fileName?: string;
    reportText: string;
  }) {
    const assignment = assignments.find((item) => item.id === values.assignmentId) ?? assignments[0];
    if (!assignment) return;
    setSubmissions((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        assignmentId: assignment.id,
        studentName: values.studentName,
        studentIdentifier: values.studentIdentifier,
        inputType,
        fileName: values.fileName,
        reportText: values.reportText,
      },
    ]);
  }

  async function runEvaluation(submission: Submission) {
    setEvaluatingSubmissionIds((current) =>
      current.includes(submission.id) ? current : [...current, submission.id]
    );
    const assignment = assignments.find((item) => item.id === submission.assignmentId);
    const rubric = rubrics.find((item) => item.id === assignment?.rubricSetId) ?? selectedRubric;
    const taskType = taskTypes.find((item) => item.id === assignment?.taskType) ?? taskTypes[0];
    const selectedCriteria = rubric.categories.flatMap((categoryItem) =>
      categoryItem.criteria
        .filter((criterionItem) => criterionItem.enabled)
        .map((criterionItem) => `${categoryItem.name}: ${criterionItem.name}`)
    );
    const categorySummaries = rubric.categories.map((categoryItem) => {
      const enabledCriteria = categoryItem.criteria.filter((criterionItem) => criterionItem.enabled);
      const score = Math.max(
        1,
        Math.min(categoryItem.maxScore, Math.round(categoryItem.maxScore * (submission.reportText.length > 80 ? 0.82 : 0.68)))
      );
      return {
        name: categoryItem.name,
        maxScore: categoryItem.maxScore,
        score,
        criteria: enabledCriteria.map((criterionItem) => criterionItem.name),
      };
    });
    const score = Math.min(
      100,
      categorySummaries.reduce((total, categoryItem) => total + categoryItem.score, 0)
    );
    const studentReport = createStudentReport({
      assignmentTitle: assignment?.title ?? "제목 없는 과제",
      taskType,
      studentName: submission.studentName,
      totalScore: score,
      categories: categorySummaries,
    });
    const rubricPrompt = [
      rubric.promptPersona,
      "",
      rubric.promptCommonCriteria,
      "",
      "중요한 원칙:",
      rubric.promptPrinciples,
    ].join("\n");
    const prompt = [
      rubricPrompt,
      "",
      `과제명: ${assignment?.title ?? "제목 없는 과제"}`,
      `과제 설명: ${assignment?.description ?? ""}`,
      `과제유형: ${taskType.name}`,
      `과제유형 평가 초점: ${taskType.focus.join(", ")}`,
      `평가세트: ${rubric.name}`,
      "",
      "선택된 평가항목:",
      selectedCriteria.map((item) => `- ${item}`).join("\n"),
      "",
      "리포트 본문:",
      submission.reportText,
    ].join("\n");

    let evaluatedScore = score;
    let evaluatedFeedback =
      "임시 AI 평가 결과입니다. OpenAI API 응답을 받으면 항목별 점수, 근거, 학생용 피드백으로 대체됩니다.";
    let evaluatedStudentReport = studentReport;

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiModel,
          prompt: `${prompt}

반드시 다음 JSON 형식으로만 응답하세요.
{
  "total_score": 0,
  "feedback": "평가자용 요약 피드백",
  "student_report": "학생에게 전달할 평가보고서"
}`,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "AI 평가 요청에 실패했습니다.");
      }

      evaluatedScore = Math.max(0, Math.min(100, Math.round(Number(payload.result.total_score) || score)));
      evaluatedFeedback = payload.result.feedback || evaluatedFeedback;
      evaluatedStudentReport = payload.result.student_report || evaluatedStudentReport;
    } catch (error) {
      evaluatedFeedback = `AI 평가 연결 실패: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      } 현재는 임시 평가 결과를 표시합니다.`;
    }

    try {
      setEvaluations((current) => [
        {
          id: crypto.randomUUID(),
          submissionId: submission.id,
          rubricSetId: rubric.id,
          totalScore: evaluatedScore,
          status: "ai_completed",
          prompt,
          feedback: evaluatedFeedback,
          studentReport: evaluatedStudentReport,
        },
        ...current,
      ]);
      setActiveMenu("evaluations");
    } finally {
      setEvaluatingSubmissionIds((current) => current.filter((submissionId) => submissionId !== submission.id));
    }
  }

  function finalizeEvaluation(evaluationId: string) {
    setEvaluations((current) =>
      current.map((evaluation) =>
        evaluation.id === evaluationId ? { ...evaluation, status: "finalized" } : evaluation
      )
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">RE</div>
          <div>
            <strong>Rubrix</strong>
            <span>AI Rubric System</span>
          </div>
        </div>
        <nav>
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeMenu === item.key ? "nav-item active" : "nav-item"}
                key={item.key}
                onClick={() => setActiveMenu(item.key)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{menu.find((item) => item.key === activeMenu)?.label}</h1>
          </div>
          <div className="status-pill">
            <CheckCircle2 size={16} />
            {storageStatus}
          </div>
        </header>

        {activeMenu === "dashboard" && (
          <Dashboard
            stats={stats}
            assignments={assignments}
            submissions={submissions}
            evaluations={evaluations}
          />
        )}
        {activeMenu === "rubrics" && (
          <RubricSets
            rubrics={rubrics}
            selectedRubric={selectedRubric}
            setSelectedRubricId={setSelectedRubricId}
            updateRubric={updateRubric}
            addRubricSet={addRubricSet}
            deleteRubricSet={deleteRubricSet}
          />
        )}
        {activeMenu === "assignments" && (
          <Assignments
            assignments={assignments}
            rubrics={rubrics}
            taskTypes={taskTypes}
            addAssignment={addAssignment}
            deleteAssignment={deleteAssignment}
            updateAssignments={setAssignments}
            updateTaskTypes={setTaskTypes}
          />
        )}
        {activeMenu === "submissions" && (
          <Submissions
            submissions={submissions}
            assignments={assignments}
            evaluations={evaluations}
            evaluatingSubmissionIds={evaluatingSubmissionIds}
            addSubmission={addSubmission}
            runEvaluation={runEvaluation}
            deleteSubmission={deleteSubmission}
          />
        )}
        {activeMenu === "evaluations" && (
          <Evaluations
            evaluations={evaluations}
            submissions={submissions}
            finalizeEvaluation={finalizeEvaluation}
            updateEvaluations={setEvaluations}
          />
        )}
        {activeMenu === "reports" && (
          <Reports evaluations={evaluations} submissions={submissions} assignments={assignments} />
        )}
        {activeMenu === "settings" && <SettingsPanel aiModel={aiModel} setAiModel={setAiModel} />}
      </main>
    </div>
  );
}

function createStudentReport({
  assignmentTitle,
  taskType,
  studentName,
  totalScore,
  categories,
}: {
  assignmentTitle: string;
  taskType: TaskType;
  studentName: string;
  totalScore: number;
  categories: { name: string; maxScore: number; score: number; criteria: string[] }[];
}) {
  const categoryLines = categories
    .map(
      (categoryItem) =>
        `- ${categoryItem.name}: ${categoryItem.score}/${categoryItem.maxScore}점\n  평가기준: ${categoryItem.criteria.join(", ")}\n  피드백: 선택된 기준을 바탕으로 리포트의 강점과 보완점을 검토했습니다. 실제 AI 연동 후에는 본문 근거가 포함된 구체적 평가문으로 대체됩니다.`
    )
    .join("\n\n");

  return [
    `학생용 평가보고서`,
    ``,
    `학생: ${studentName}`,
    `과제: ${assignmentTitle}`,
    `과제유형: ${taskType.name}`,
    `총점: ${totalScore}/100점`,
    ``,
    `과제유형 평가 초점`,
    taskType.focus.map((item) => `- ${item}`).join("\n"),
    ``,
    `평가기준별 결과`,
    categoryLines,
    ``,
    `종합 피드백`,
    `이 보고서는 선택된 루브릭 기준에 맞추어 자동 작성된 초안입니다. 평가자는 최종 전달 전에 점수, 근거, 표현을 검토하고 필요하면 수정해야 합니다.`,
  ].join("\n");
}

function Dashboard({
  stats,
  assignments,
  submissions,
  evaluations,
}: {
  stats: { label: string; value: number }[];
  assignments: Assignment[];
  submissions: Submission[];
  evaluations: Evaluation[];
}) {
  const latestEvaluatedSubmission = submissions.find((submission) => submission.id === evaluations[0]?.submissionId);
  const defaultAssignmentId = latestEvaluatedSubmission?.assignmentId ?? assignments[0]?.id ?? "";
  const [selectedStatsAssignmentId, setSelectedStatsAssignmentId] = useState(defaultAssignmentId);
  const selectedStatsAssignment =
    assignments.find((assignment) => assignment.id === selectedStatsAssignmentId) ?? assignments[0];
  const selectedAssignmentEvaluations = evaluations.filter((evaluation) => {
    const submission = submissions.find((item) => item.id === evaluation.submissionId);
    return submission?.assignmentId === selectedStatsAssignment?.id;
  });
  const scoreBins = Array.from({ length: 20 }, (_, index) => {
    const min = index * 5;
    const max = index === 19 ? 100 : min + 4;
    const count = selectedAssignmentEvaluations.filter(
      (evaluation) => evaluation.totalScore >= min && evaluation.totalScore <= max
    ).length;

    return {
      label: `${min}-${max}`,
      count,
    };
  });
  const maxBinCount = Math.max(1, ...scoreBins.map((bin) => bin.count));
  const flowSteps = [
    {
      title: "Rubric Sets",
      description: "평가항목과 기준을 설정해 주세요.",
    },
    {
      title: "Assignments",
      description: "과제의 유형과 내용을 설정해 주세요.",
    },
    {
      title: "Submissions",
      description: "제출물을 등록해 평가해 주세요.",
    },
    {
      title: "Evaluations",
      description: "AI평가결과를 확인하고 조정해 주세요.",
    },
    {
      title: "Reports",
      description: "피드백과 결과를 확인해 주세요.",
    },
  ];

  useEffect(() => {
    if (!selectedStatsAssignmentId && defaultAssignmentId) {
      setSelectedStatsAssignmentId(defaultAssignmentId);
    }
  }, [defaultAssignmentId, selectedStatsAssignmentId]);

  return (
    <section className="content-grid">
      <div className="stat-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>
      <article className="panel wide">
        <h2>평가 흐름</h2>
        <div className="flow">
          {flowSteps.map((step) => (
            <div className="flow-step" key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="panel wide">
        <h2>과제리스트</h2>
        {assignments.length === 0 ? <p className="muted">아직 등록된 과제가 없습니다.</p> : null}
        <div className="assignment-stat-list">
          {assignments.map((assignment) => {
            const assignmentEvaluationCount = evaluations.filter((evaluation) => {
              const submission = submissions.find((item) => item.id === evaluation.submissionId);
              return submission?.assignmentId === assignment.id;
            }).length;

            return (
              <div className="assignment-stat-row" key={assignment.id}>
                <div>
                  <strong>{assignment.title}</strong>
                  <span>{assignmentEvaluationCount}명 평가됨</span>
                </div>
                <button className="secondary-button" onClick={() => setSelectedStatsAssignmentId(assignment.id)}>
                  통계
                </button>
              </div>
            );
          })}
        </div>
      </article>
      <article className="panel wide">
        <div className="panel-title">
          <div>
            <h2>평가통계</h2>
            <p className="muted">{selectedStatsAssignment?.title ?? "선택된 과제 없음"}</p>
          </div>
        </div>
        <div className="histogram">
          {scoreBins.map((bin) => (
            <div className="histogram-bin" key={bin.label}>
              <div className="histogram-label">{bin.label}</div>
              <div className="histogram-track">
                <div className="histogram-bar" style={{ height: bin.count === 0 ? "0%" : `${(bin.count / maxBinCount) * 100}%` }} />
              </div>
              <strong>{bin.count}</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function RubricSets({
  rubrics,
  selectedRubric,
  setSelectedRubricId,
  updateRubric,
  addRubricSet,
  deleteRubricSet,
}: {
  rubrics: RubricSet[];
  selectedRubric: RubricSet;
  setSelectedRubricId: (id: string) => void;
  updateRubric: (rubric: RubricSet) => void;
  addRubricSet: (name?: string, description?: string) => void;
  deleteRubricSet: (rubricId: string) => void;
}) {
  const [isAddingRubric, setIsAddingRubric] = useState(false);
  const [newRubricName, setNewRubricName] = useState("");
  const [newRubricDescription, setNewRubricDescription] = useState("");

  function toggleCriterion(categoryId: string, criterionId: string) {
    updateRubric({
      ...selectedRubric,
      categories: selectedRubric.categories.map((categoryItem) =>
        categoryItem.id === categoryId
          ? {
              ...categoryItem,
              criteria: categoryItem.criteria.map((criterionItem) =>
                criterionItem.id === criterionId
                  ? { ...criterionItem, enabled: !criterionItem.enabled }
                  : criterionItem
              ),
            }
          : categoryItem
      ),
    });
  }

  function confirmAddRubric() {
    addRubricSet(newRubricName, newRubricDescription);
    setNewRubricName("");
    setNewRubricDescription("");
    setIsAddingRubric(false);
  }

  return (
    <section className="two-column">
      <article className="panel">
        <div className="panel-title">
          <h2>평가세트 목록</h2>
          <button className="icon-button" title="평가세트 추가" onClick={() => setIsAddingRubric(true)}>
            <Plus size={18} />
          </button>
        </div>
        {isAddingRubric ? (
          <div className="confirm-box">
            <label className="field">
              <span>새 평가세트 이름</span>
              <input
                value={newRubricName}
                onChange={(event) => setNewRubricName(event.target.value)}
                placeholder="새 평가세트"
              />
            </label>
            <label className="field">
              <span>설명</span>
              <textarea
                value={newRubricDescription}
                onChange={(event) => setNewRubricDescription(event.target.value)}
                placeholder="평가세트 설명"
              />
            </label>
            <div className="button-group">
              <button className="primary-button" onClick={confirmAddRubric}>
                확인
              </button>
              <button className="secondary-button" onClick={() => setIsAddingRubric(false)}>
                취소
              </button>
            </div>
          </div>
        ) : null}
        {rubrics.map((rubric) => (
          <div className={selectedRubric.id === rubric.id ? "select-row selected" : "select-row"} key={rubric.id}>
            <button className="row-main-button" onClick={() => setSelectedRubricId(rubric.id)}>
              <strong>{rubric.name}</strong>
              <span>{rubric.description}</span>
            </button>
            <button className="danger-button" disabled={rubrics.length <= 1} onClick={() => deleteRubricSet(rubric.id)}>
              삭제
            </button>
          </div>
        ))}
      </article>

      <article className="panel wide">
        <div className="panel-title">
          <div>
            <h2>평가기준 관리</h2>
            <p className="muted">공통 평가 80점 + 과제유형별 추가 평가 20점</p>
          </div>
        </div>
        <div className="form-grid compact-form">
          <label className="field">
            <span>평가세트 이름</span>
            <input
              value={selectedRubric.name}
              onChange={(event) => updateRubric({ ...selectedRubric, name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>평가세트 설명</span>
            <input
              value={selectedRubric.description}
              onChange={(event) => updateRubric({ ...selectedRubric, description: event.target.value })}
            />
          </label>
        </div>
        <div className="rubric-grid">
          {selectedRubric.categories.map((categoryItem) => (
            <div className="category-box" key={categoryItem.id}>
              <div className="category-head">
                <strong>{categoryItem.name}</strong>
                <span>{categoryItem.maxScore}점</span>
              </div>
              {categoryItem.criteria.map((criterionItem) => (
                <label className="check-row" key={criterionItem.id}>
                  <input
                    type="checkbox"
                    checked={criterionItem.enabled}
                    onChange={() => toggleCriterion(categoryItem.id, criterionItem.id)}
                  />
                  <span>{criterionItem.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="prompt-editor">
          <label className="field full">
            <span>페르소나</span>
            <textarea
              value={selectedRubric.promptPersona}
              onChange={(event) => updateRubric({ ...selectedRubric, promptPersona: event.target.value })}
            />
          </label>
          <label className="field full">
            <span>공통 기준</span>
            <textarea
              value={selectedRubric.promptCommonCriteria}
              onChange={(event) => updateRubric({ ...selectedRubric, promptCommonCriteria: event.target.value })}
            />
          </label>
          <label className="field full">
            <span>중요한 원칙</span>
            <textarea
              value={selectedRubric.promptPrinciples}
              onChange={(event) => updateRubric({ ...selectedRubric, promptPrinciples: event.target.value })}
            />
          </label>
        </div>
      </article>
    </section>
  );
}

function Assignments({
  assignments,
  rubrics,
  taskTypes,
  addAssignment,
  deleteAssignment,
  updateAssignments,
  updateTaskTypes,
}: {
  assignments: Assignment[];
  rubrics: RubricSet[];
  taskTypes: TaskType[];
  addAssignment: (values?: Partial<Assignment>) => void;
  deleteAssignment: (assignmentId: string) => void;
  updateAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  updateTaskTypes: React.Dispatch<React.SetStateAction<TaskType[]>>;
}) {
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("");
  const [newAssignmentDescription, setNewAssignmentDescription] = useState("");
  const [newAssignmentTaskType, setNewAssignmentTaskType] = useState(taskTypes[0]?.id ?? "");
  const [newAssignmentRubricSet, setNewAssignmentRubricSet] = useState(rubrics[0]?.id ?? "");
  const [isAddingTaskType, setIsAddingTaskType] = useState(false);
  const [newTaskTypeName, setNewTaskTypeName] = useState("");
  const [newTaskTypeDescription, setNewTaskTypeDescription] = useState("");
  const [newTaskTypeFocus, setNewTaskTypeFocus] = useState("");

  function updateTaskType(assignmentId: string, taskTypeId: string) {
    updateAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, taskType: taskTypeId } : assignment
      )
    );
  }

  function updateTaskTypeDetail(taskTypeId: string, field: keyof TaskType, value: string) {
    updateTaskTypes((current) =>
      current.map((taskType) =>
        taskType.id === taskTypeId
          ? {
              ...taskType,
              [field]: field === "focus" ? value.split("\n").map((item) => item.trim()).filter(Boolean) : value,
            }
          : taskType
      )
    );
  }

  function updateAssignment(assignmentId: string, field: keyof Assignment, value: string) {
    updateAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, [field]: value } : assignment
      )
    );
  }

  function confirmAddAssignment() {
    addAssignment({
      title: newAssignmentTitle.trim() || `새 과제 ${assignments.length + 1}`,
      description: newAssignmentDescription.trim() || "과제 질문과 평가 맥락을 입력하세요.",
      taskType: newAssignmentTaskType || taskTypes[0]?.id,
      rubricSetId: newAssignmentRubricSet || rubrics[0]?.id,
    });
    setNewAssignmentTitle("");
    setNewAssignmentDescription("");
    setNewAssignmentTaskType(taskTypes[0]?.id ?? "");
    setNewAssignmentRubricSet(rubrics[0]?.id ?? "");
    setIsAddingAssignment(false);
  }

  function confirmAddTaskType() {
    const nextTaskType: TaskType = {
      id: crypto.randomUUID(),
      name: newTaskTypeName.trim() || `새 과제유형 ${taskTypes.length + 1}`,
      description: newTaskTypeDescription.trim() || "새 과제유형의 설명을 입력하세요.",
      focus: newTaskTypeFocus
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    if (nextTaskType.focus.length === 0) {
      nextTaskType.focus = ["평가 초점 1", "평가 초점 2"];
    }
    updateTaskTypes((current) => [...current, nextTaskType]);
    setNewTaskTypeName("");
    setNewTaskTypeDescription("");
    setNewTaskTypeFocus("");
    setIsAddingTaskType(false);
  }

  function deleteTaskType(taskTypeId: string) {
    if (taskTypes.length <= 1) return;
    if (!window.confirm("이 과제유형을 삭제할까요? 연결된 과제는 다른 과제유형으로 변경됩니다.")) return;
    const fallbackTaskType = taskTypes.find((taskType) => taskType.id !== taskTypeId);
    updateTaskTypes((current) => current.filter((taskType) => taskType.id !== taskTypeId));
    updateAssignments((current) =>
      current.map((assignment) =>
        assignment.taskType === taskTypeId && fallbackTaskType
          ? { ...assignment, taskType: fallbackTaskType.id }
          : assignment
      )
    );
  }

  return (
    <article className="panel">
      <div className="panel-title">
        <h2>과제 목록</h2>
        <button className="primary-button" onClick={() => setIsAddingAssignment(true)}>
          <Plus size={16} />
          과제 만들기
        </button>
      </div>
      {isAddingAssignment ? (
        <div className="confirm-box">
          <div className="form-grid">
            <label className="field">
              <span>과제명</span>
              <input
                value={newAssignmentTitle}
                onChange={(event) => setNewAssignmentTitle(event.target.value)}
                placeholder="새 과제"
              />
            </label>
            <label className="field">
              <span>과제유형</span>
              <select value={newAssignmentTaskType} onChange={(event) => setNewAssignmentTaskType(event.target.value)}>
                {taskTypes.map((taskType) => (
                  <option key={taskType.id} value={taskType.id}>
                    {taskType.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>평가세트</span>
              <select
                value={newAssignmentRubricSet}
                onChange={(event) => setNewAssignmentRubricSet(event.target.value)}
              >
                {rubrics.map((rubric) => (
                  <option key={rubric.id} value={rubric.id}>
                    {rubric.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field full">
            <span>과제 설명</span>
            <textarea
              value={newAssignmentDescription}
              onChange={(event) => setNewAssignmentDescription(event.target.value)}
              placeholder="과제 질문과 평가 맥락을 입력하세요."
            />
          </label>
          <div className="button-group">
            <button className="primary-button" onClick={confirmAddAssignment}>
              확인
            </button>
            <button className="secondary-button" onClick={() => setIsAddingAssignment(false)}>
              취소
            </button>
          </div>
        </div>
      ) : null}
      <div className="table">
        <div className="table-head">
          <span>과제명</span>
          <span>과제유형</span>
          <span>평가세트</span>
          <span>설명</span>
          <span>관리</span>
        </div>
        {assignments.map((assignment) => (
          <div className="table-row" key={assignment.id}>
            <label className="compact-field">
              <input
                value={assignment.title}
                onChange={(event) => updateAssignment(assignment.id, "title", event.target.value)}
              />
            </label>
            <label className="compact-field">
              <select
                value={assignment.taskType}
                onChange={(event) => updateTaskType(assignment.id, event.target.value)}
              >
                {taskTypes.map((taskType) => (
                  <option key={taskType.id} value={taskType.id}>
                    {taskType.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              <select
                value={assignment.rubricSetId}
                onChange={(event) => updateAssignment(assignment.id, "rubricSetId", event.target.value)}
              >
                {rubrics.map((rubric) => (
                  <option key={rubric.id} value={rubric.id}>
                    {rubric.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              <textarea
                value={assignment.description}
                onChange={(event) => updateAssignment(assignment.id, "description", event.target.value)}
              />
            </label>
            <button className="danger-button" onClick={() => deleteAssignment(assignment.id)}>
              삭제
            </button>
          </div>
        ))}
      </div>
      <div className="section-title-row">
        <div>
          <h2>과제유형 관리</h2>
          <p className="muted">과제별 평가 초점을 직접 수정하거나 새 유형을 추가할 수 있습니다.</p>
        </div>
        <button className="primary-button" onClick={() => setIsAddingTaskType(true)}>
          <Plus size={16} />
          과제유형 추가
        </button>
      </div>
      {isAddingTaskType ? (
        <div className="confirm-box">
          <div className="form-grid">
            <label className="field">
              <span>유형명</span>
              <input
                value={newTaskTypeName}
                onChange={(event) => setNewTaskTypeName(event.target.value)}
                placeholder="새 과제유형"
              />
            </label>
            <label className="field">
              <span>설명</span>
              <input
                value={newTaskTypeDescription}
                onChange={(event) => setNewTaskTypeDescription(event.target.value)}
                placeholder="과제유형 설명"
              />
            </label>
          </div>
          <label className="field full">
            <span>평가 초점</span>
            <textarea
              value={newTaskTypeFocus}
              onChange={(event) => setNewTaskTypeFocus(event.target.value)}
              placeholder={"평가 초점 1\n평가 초점 2"}
            />
          </label>
          <div className="button-group">
            <button className="primary-button" onClick={confirmAddTaskType}>
              확인
            </button>
            <button className="secondary-button" onClick={() => setIsAddingTaskType(false)}>
              취소
            </button>
          </div>
        </div>
      ) : null}
      <div className="task-type-grid">
        {taskTypes.map((taskType) => (
          <div className="task-type-card" key={taskType.id}>
            <div className="card-action-row">
              <strong>과제유형</strong>
              <button className="danger-button" disabled={taskTypes.length <= 1} onClick={() => deleteTaskType(taskType.id)}>
                삭제
              </button>
            </div>
            <label className="field">
              <span>유형명</span>
              <input
                value={taskType.name}
                onChange={(event) => updateTaskTypeDetail(taskType.id, "name", event.target.value)}
              />
            </label>
            <label className="field">
              <span>설명</span>
              <textarea
                value={taskType.description}
                onChange={(event) => updateTaskTypeDetail(taskType.id, "description", event.target.value)}
              />
            </label>
            <label className="field">
              <span>평가 초점</span>
              <textarea
                value={taskType.focus.join("\n")}
                onChange={(event) => updateTaskTypeDetail(taskType.id, "focus", event.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
    </article>
  );
}

function Submissions({
  submissions,
  assignments,
  evaluations,
  evaluatingSubmissionIds,
  addSubmission,
  runEvaluation,
  deleteSubmission,
}: {
  submissions: Submission[];
  assignments: Assignment[];
  evaluations: Evaluation[];
  evaluatingSubmissionIds: string[];
  addSubmission: (
    inputType: "pdf" | "text",
    values: { assignmentId: string; studentName: string; studentIdentifier: string; fileName?: string; reportText: string }
  ) => void;
  runEvaluation: (submission: Submission) => Promise<void>;
  deleteSubmission: (submissionId: string) => void;
}) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const [studentName, setStudentName] = useState("학생 1");
  const [studentIdentifier, setStudentIdentifier] = useState("S001");
  const [inputType, setInputType] = useState<"pdf" | "text">("text");
  const [fileName, setFileName] = useState("");
  const [reportText, setReportText] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const selectedSubmission =
    submissions.find((submission) => submission.id === selectedSubmissionId) ?? submissions[0];
  const selectedSubmissionAssignment = assignments.find(
    (assignment) => assignment.id === selectedSubmission?.assignmentId
  );
  const selectedSubmissionEvaluated = selectedSubmission
    ? evaluations.some((evaluation) => evaluation.submissionId === selectedSubmission.id)
    : false;
  const selectedSubmissionEvaluating = selectedSubmission
    ? evaluatingSubmissionIds.includes(selectedSubmission.id)
    : false;

  function submitReport() {
    const trimmedText = reportText.trim();
    addSubmission(inputType, {
      assignmentId: selectedAssignmentId || assignments[0]?.id || "",
      studentName: studentName.trim() || "이름 없는 학생",
      studentIdentifier: studentIdentifier.trim() || "-",
      fileName: inputType === "pdf" ? fileName || "uploaded-report.pdf" : undefined,
      reportText:
        trimmedText ||
        (inputType === "pdf"
          ? "아직 PDF 텍스트 추출 기능이 연결되지 않았습니다. 최종 평가 전에 추출된 텍스트를 여기에 붙여넣으세요."
          : "리포트 본문이 입력되지 않았습니다."),
    });
    setReportText("");
  }

  return (
    <article className="panel">
      <div className="panel-title">
        <div>
          <h2>제출물 목록</h2>
          <p className="muted">PDF 업로드와 텍스트 붙여넣기를 지원합니다.</p>
        </div>
      </div>
      <div className="submission-form">
        <div className="form-grid">
          <label className="field">
            <span>평가할 과제</span>
            <select value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>학생 이름</span>
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
          </label>
          <label className="field">
            <span>학번/식별자</span>
            <input value={studentIdentifier} onChange={(event) => setStudentIdentifier(event.target.value)} />
          </label>
          <label className="field">
            <span>입력 방식</span>
            <select value={inputType} onChange={(event) => setInputType(event.target.value as "pdf" | "text")}>
              <option value="text">텍스트 붙여넣기</option>
              <option value="pdf">PDF 업로드</option>
            </select>
          </label>
        </div>
        {inputType === "pdf" ? (
          <label className="file-drop">
            <FileText size={18} />
            <span>{fileName || "PDF 파일 선택"}</span>
            <input
              accept="application/pdf"
              type="file"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
        ) : null}
        <label className="field full">
          <span>{inputType === "pdf" ? "추출 또는 붙여넣은 PDF 텍스트" : "리포트 본문"}</span>
          <textarea
            placeholder="리포트 본문을 여기에 붙여넣으세요."
            value={reportText}
            onChange={(event) => setReportText(event.target.value)}
          />
        </label>
        <button className="primary-button" onClick={submitReport}>
          <Plus size={16} />
          제출물 추가
        </button>
      </div>
      <section className="submissions-layout">
        <article className="submission-list-panel">
          <div className="compact-report-head submission-head">
            <span>학생</span>
            <span>과제</span>
            <span>상태</span>
            <span>관리</span>
          </div>
          {submissions.length === 0 ? <p className="muted">아직 등록된 제출물이 없습니다.</p> : null}
          {submissions.map((submission) => {
            const isEvaluated = evaluations.some((evaluation) => evaluation.submissionId === submission.id);
            const isEvaluating = evaluatingSubmissionIds.includes(submission.id);
            const assignment = assignments.find((item) => item.id === submission.assignmentId);
            return (
              <div
                className={
                  selectedSubmission?.id === submission.id ? "compact-report-row submission-row selected" : "compact-report-row submission-row"
                }
                key={submission.id}
              >
                <button className="row-main-button submission-select-button" onClick={() => setSelectedSubmissionId(submission.id)}>
                  <strong>{submission.studentName}</strong>
                </button>
                <button className="row-main-button submission-select-button" onClick={() => setSelectedSubmissionId(submission.id)}>
                  <span>{assignment?.title ?? "-"}</span>
                </button>
                <span>{isEvaluated ? "평가완료" : isEvaluating ? "평가진행중" : "평가대기"}</span>
                <div className="row-actions">
                  <button
                    className="primary-button compact-action"
                    disabled={isEvaluated || isEvaluating}
                    onClick={() => runEvaluation(submission)}
                  >
                    {!isEvaluated ? <Square className={isEvaluating ? "spin-icon" : ""} size={14} /> : null}
                    {isEvaluated ? "완료" : isEvaluating ? "진행중" : "실행"}
                  </button>
                  <button className="danger-button compact-action" onClick={() => deleteSubmission(submission.id)}>
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </article>

        <article className="panel submission-detail-panel">
          {selectedSubmission ? (
            <>
              <div className="panel-title">
                <div>
                  <h2>{selectedSubmission.studentName}</h2>
                  <p className="muted">
                    {selectedSubmissionAssignment?.title ?? "-"} · {selectedSubmission.studentIdentifier}
                  </p>
                </div>
                <span className={selectedSubmissionEvaluated ? "tag success-tag" : "tag pending-tag"}>
                  {selectedSubmissionEvaluated ? "평가완료" : selectedSubmissionEvaluating ? "평가진행중" : "평가대기"}
                </span>
              </div>
              <div className="submission-meta-grid">
                <div>
                  <span>입력 방식</span>
                  <strong>{selectedSubmission.inputType.toUpperCase()}</strong>
                </div>
                <div>
                  <span>파일명</span>
                  <strong>{selectedSubmission.fileName ?? "-"}</strong>
                </div>
              </div>
              <section className="report-detail-section">
                <h3>제출 내용</h3>
                <div className="report-text-box student-report-box">{selectedSubmission.reportText}</div>
              </section>
            </>
          ) : (
            <p className="muted">왼쪽 목록에서 제출물을 선택하세요.</p>
          )}
        </article>
      </section>
    </article>
  );
}

function Evaluations({
  evaluations,
  submissions,
  finalizeEvaluation,
  updateEvaluations,
}: {
  evaluations: Evaluation[];
  submissions: Submission[];
  finalizeEvaluation: (evaluationId: string) => void;
  updateEvaluations: React.Dispatch<React.SetStateAction<Evaluation[]>>;
}) {
  const pendingEvaluations = evaluations.filter((evaluation) => evaluation.status !== "finalized");

  function updateEvaluation(evaluationId: string, field: "totalScore" | "feedback" | "studentReport", value: string) {
    updateEvaluations((current) =>
      current.map((evaluation) =>
        evaluation.id === evaluationId
          ? {
              ...evaluation,
              [field]: field === "totalScore" ? Number(value) : value,
            }
          : evaluation
      )
    );
  }

  return (
    <article className="panel">
      <h2>AI 평가 결과</h2>
      {pendingEvaluations.length === 0 ? (
        <p className="muted">검토할 평가 결과가 없습니다. 최종확정된 결과는 Reports에서 확인하세요.</p>
      ) : null}
      <div className="evaluation-list">
        {pendingEvaluations.map((evaluation) => {
          const submission = submissions.find((item) => item.id === evaluation.submissionId);
          const isFinalized = evaluation.status === "finalized";
          return (
            <div className="result-card editable-result" key={evaluation.id}>
              <div>
                <strong>{submission?.studentName ?? "알 수 없는 학생"}</strong>
                <span>{statusLabel(evaluation.status)}</span>
              </div>
              <label className="field score-field">
                <span>평가 점수</span>
                <input
                  min="0"
                  max="100"
                  type="number"
                  value={evaluation.totalScore}
                  disabled={isFinalized}
                  onChange={(event) => updateEvaluation(evaluation.id, "totalScore", event.target.value)}
                />
              </label>
              <label className="field">
                <span>평가자 피드백</span>
                <textarea
                  value={evaluation.feedback}
                  disabled={isFinalized}
                  onChange={(event) => updateEvaluation(evaluation.id, "feedback", event.target.value)}
                />
              </label>
              <label className="field">
                <span>학생에게 제시할 평가보고서</span>
                <textarea
                  className="report-editor"
                  value={evaluation.studentReport}
                  disabled={isFinalized}
                  onChange={(event) => updateEvaluation(evaluation.id, "studentReport", event.target.value)}
                />
              </label>
              <button className="secondary-button" disabled={isFinalized} onClick={() => finalizeEvaluation(evaluation.id)}>
                <CheckCircle2 size={16} />
                {isFinalized ? "확정됨" : "최종 확정"}
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Reports({
  evaluations,
  submissions,
  assignments,
}: {
  evaluations: Evaluation[];
  submissions: Submission[];
  assignments: Assignment[];
}) {
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(evaluations[0]?.id ?? "");
  const selectedEvaluation = evaluations.find((evaluation) => evaluation.id === selectedEvaluationId) ?? evaluations[0];
  const selectedSubmission = submissions.find((submission) => submission.id === selectedEvaluation?.submissionId);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedSubmission?.assignmentId);

  return (
    <section className="reports-layout">
      <article className="panel">
        <h2>평가 보고서</h2>
        <div className="compact-report-list">
          <div className="compact-report-head">
            <span>학생</span>
            <span>과제</span>
            <span>점수</span>
            <span>상태</span>
          </div>
          {evaluations.length === 0 ? <p className="muted">아직 평가 보고서가 없습니다.</p> : null}
          {evaluations.map((evaluation) => {
            const submission = submissions.find((item) => item.id === evaluation.submissionId);
            const assignment = assignments.find((item) => item.id === submission?.assignmentId);
            return (
              <button
                className={selectedEvaluation?.id === evaluation.id ? "compact-report-row selected" : "compact-report-row"}
                key={evaluation.id}
                onClick={() => setSelectedEvaluationId(evaluation.id)}
              >
                <strong>{submission?.studentName ?? "알 수 없음"}</strong>
                <span>{assignment?.title ?? "-"}</span>
                <span>{evaluation.totalScore}</span>
                <span>{statusLabel(evaluation.status)}</span>
              </button>
            );
          })}
        </div>
      </article>

      <article className="panel report-detail-panel">
        {selectedEvaluation ? (
          <>
            <div className="panel-title">
              <div>
                <h2>{selectedSubmission?.studentName ?? "알 수 없는 학생"}</h2>
                <p className="muted">
                  {selectedAssignment?.title ?? "-"} · {selectedEvaluation.totalScore}점 ·{" "}
                  {statusLabel(selectedEvaluation.status)}
                </p>
              </div>
            </div>
            <section className="report-detail-section">
              <h3>피드백</h3>
              <div className="report-text-box">{selectedEvaluation.feedback}</div>
            </section>
            <section className="report-detail-section">
              <h3>학생용 보고서</h3>
              <div className="report-text-box student-report-box">{selectedEvaluation.studentReport}</div>
            </section>
          </>
        ) : (
          <p className="muted">왼쪽 목록에서 학생을 선택하세요.</p>
        )}
      </article>
    </section>
  );
}

function SettingsPanel({
  aiModel,
  setAiModel,
}: {
  aiModel: string;
  setAiModel: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <article className="panel settings-panel">
      <h2>AI 설정</h2>
      <div className="form-grid">
        <label className="field">
          <span>모델</span>
          <input value={aiModel} onChange={(event) => setAiModel(event.target.value)} />
        </label>
        <label className="field">
          <span>API 키</span>
          <input placeholder="OPENAI_API_KEY 환경변수로 설정" type="password" disabled />
        </label>
        <label className="field">
          <span>기본 언어</span>
          <input defaultValue="한국어" />
        </label>
      </div>
    </article>
  );
}
