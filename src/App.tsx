import {
  BarChart3,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Plus,
  SearchCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import rtsSimulatorHtml from "./assets/RTS_Calculator_SAFE_offline.html?raw";
import rubrixLogo from "./assets/rubrix.png";

type MenuKey =
  | "dashboard"
  | "rubrics"
  | "assignments"
  | "submissions"
  | "aiDiagnosis"
  | "aiGeneratedScore"
  | "analysis"
  | "evaluations"
  | "reports"
  | "settings"
  | "safeModel"
  | "userManual"
  | "rtsSimulator";

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
  aiEvaluationScore?: number;
  aiNormalizedScore?: number;
  status: "ai_completed" | "finalized";
  feedback: string;
  studentReport: string;
  prompt: string;
  evaluatedAt?: string;
  finalizedAt?: string;
  model?: string;
  promptVersion?: string;
  rubricPromptVersion?: string;
  safeModelVersion?: string;
  rubrixTuningScore?: number;
  rubrixTuningDelta?: number;
  rubrixTuningNote?: string;
};

type SimilarityMode = "exact" | "sentence" | "paragraph" | "structure";

type SimilarityPair = {
  id: string;
  submissionAId: string;
  submissionBId: string;
  score: number;
  exactScore: number;
  sentenceScore: number;
  paragraphScore: number;
  structureScore: number;
  matchedPhrases: string[];
  similarSentences: string[];
  similarParagraphs: string[];
  structureParagraphIndexes: number[];
};

type SimilarityAnalysis = {
  id: string;
  assignmentId: string;
  createdAt: string;
  modes: SimilarityMode[];
  submissionCount: number;
  pairs: SimilarityPair[];
  submissionSummaries?: SimilaritySubmissionSummary[];
};

type SimilaritySubmissionSummary = {
  submissionId: string;
  score: number;
  exactScore: number;
  sentenceScore: number;
  paragraphScore: number;
  structureScore: number;
};

type AiBaseline = {
  id: string;
  assignmentId: string;
  type: string;
  model: string;
  enabled: boolean;
  text: string;
};

type AiGeneratedModelScore = {
  baselineId: string;
  type: string;
  model: string;
  score: number;
  exactScore: number;
  sentenceScore: number;
  paragraphScore: number;
  structureScore: number;
};

type AiGeneratedSubmissionScore = {
  submissionId: string;
  averageScore: number;
  modelScores: AiGeneratedModelScore[];
};

type AiGeneratedResult = {
  id: string;
  assignmentId: string;
  createdAt: string;
  scores: AiGeneratedSubmissionScore[];
};

type TaskType = {
  id: string;
  name: string;
  description: string;
  focus: string[];
};

type EvaluationHistory = Evaluation & {
  archivedAt: string;
  archiveReason: string;
};

type AuditLog = {
  id: string;
  createdAt: string;
  action: string;
  targetType: string;
  targetId?: string;
  message: string;
};

type BackupData = {
  rubrics: RubricSet[];
  assignments: Assignment[];
  taskTypes: TaskType[];
  submissions: Submission[];
  evaluations: Evaluation[];
  similarityAnalyses: SimilarityAnalysis[];
  aiBaselines: AiBaseline[];
  aiGeneratedResults: AiGeneratedResult[];
  evaluationHistories: EvaluationHistory[];
  auditLogs: AuditLog[];
  selectedRubricId: string;
  aiModel: string;
};

type BackupSnapshot = {
  id: string;
  createdAt: string;
  reason: string;
  summary: string;
  data: BackupData;
};

type AppStateData = BackupData & {
  autoBackups: BackupSnapshot[];
};

const evaluationPromptVersion = "strict-evaluation-v2";
const rubricPromptVersion = "rubric-prompt-v1";
const safeModelVersion = "safe-v1.0";

function normalizeAiEvaluationScores<T extends { id: string; aiEvaluationScore?: number; totalScore: number }>(
  evaluations: T[]
) {
  if (evaluations.length < 2) {
    return evaluations.map((evaluation) => ({
      ...evaluation,
      aiNormalizedScore: evaluation.aiEvaluationScore ?? evaluation.totalScore,
      totalScore: evaluation.aiEvaluationScore ?? evaluation.totalScore,
    }));
  }

  const rawScores = evaluations.map((evaluation) => evaluation.aiEvaluationScore ?? evaluation.totalScore);
  const average = rawScores.reduce((total, score) => total + score, 0) / rawScores.length;
  const minScore = Math.min(...rawScores);
  const maxScore = Math.max(...rawScores);
  const range = maxScore - minScore;

  if (range >= 30) {
    return evaluations.map((evaluation) => ({
      ...evaluation,
      aiNormalizedScore: evaluation.aiEvaluationScore ?? evaluation.totalScore,
      totalScore: evaluation.aiEvaluationScore ?? evaluation.totalScore,
    }));
  }

  const targetMin = Math.max(0, average - 15);
  const targetMax = Math.min(100, average + 15);
  const targetRange = targetMax - targetMin;
  const rankedIds = [...evaluations]
    .sort((left, right) => {
      const scoreDiff = (left.aiEvaluationScore ?? left.totalScore) - (right.aiEvaluationScore ?? right.totalScore);
      return scoreDiff || left.id.localeCompare(right.id);
    })
    .map((evaluation) => evaluation.id);

  return evaluations.map((evaluation) => {
    const rawScore = evaluation.aiEvaluationScore ?? evaluation.totalScore;
    const normalized =
      range > 0
        ? targetMin + ((rawScore - minScore) / range) * targetRange
        : targetMin + (rankedIds.indexOf(evaluation.id) / Math.max(1, evaluations.length - 1)) * targetRange;
    const aiNormalizedScore = Math.max(0, Math.min(100, Math.round(normalized)));
    return {
      ...evaluation,
      aiNormalizedScore,
      totalScore: aiNormalizedScore,
    };
  });
}

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

const initialAssignments: Assignment[] = [];

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
  { key: "aiDiagnosis", label: "AI Diagnosis", icon: Bot },
  { key: "submissions", label: "Submissions", icon: Upload },
  { key: "aiGeneratedScore", label: "AI Generated Score", icon: BrainCircuit },
  { key: "analysis", label: "Analysis", icon: SearchCheck },
  { key: "evaluations", label: "Evaluations", icon: Sparkles },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "safeModel", label: "Rubrix Tuning (SAFE Model)", icon: ShieldCheck },
  { key: "userManual", label: "User Manual", icon: FileText },
  { key: "rtsSimulator", label: "RTS Simulator", icon: Calculator },
] satisfies { key: MenuKey; label: string; icon: typeof LayoutDashboard }[];

function statusLabel(status: Evaluation["status"]) {
  return status === "finalized" ? "최종 확정" : "AI완료";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.?!。！？\n]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= 18);
}

function splitParagraphs(value: string) {
  return value
    .split(/\n\s*\n+/)
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= 35);
}

function jaccardSimilarity(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function averageBestSimilarity(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;

  const bestFromLeft = left.map((leftItem) =>
    Math.max(...right.map((rightItem) => jaccardSimilarity(tokenize(leftItem), tokenize(rightItem))))
  );
  const bestFromRight = right.map((rightItem) =>
    Math.max(...left.map((leftItem) => jaccardSimilarity(tokenize(rightItem), tokenize(leftItem))))
  );
  const scores = [...bestFromLeft, ...bestFromRight];
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function findSimilarTexts(left: string[], right: string[], threshold: number) {
  const matches = new Set<string>();

  left.forEach((leftItem) => {
    let bestScore = 0;
    let bestRightItem = "";

    right.forEach((rightItem) => {
      const score = jaccardSimilarity(tokenize(leftItem), tokenize(rightItem));
      if (score > bestScore) {
        bestScore = score;
        bestRightItem = rightItem;
      }
    });

    if (bestScore >= threshold) {
      matches.add(leftItem);
      if (bestRightItem) matches.add(bestRightItem);
    }
  });

  return [...matches].slice(0, 40);
}

function exactSimilarity(leftSentences: string[], rightSentences: string[]) {
  if (leftSentences.length === 0 || rightSentences.length === 0) {
    return { score: 0, matches: [] as string[] };
  }
  const rightCounts = new Map<string, number>();
  rightSentences.forEach((sentence) => {
    rightCounts.set(sentence, (rightCounts.get(sentence) ?? 0) + 1);
  });

  let matchedCount = 0;
  const matchedSamples: string[] = [];
  const sampleSet = new Set<string>();

  leftSentences.forEach((sentence) => {
    const count = rightCounts.get(sentence) ?? 0;
    if (count <= 0) return;

    matchedCount += 1;
    rightCounts.set(sentence, count - 1);

    if (!sampleSet.has(sentence) && matchedSamples.length < 5) {
      sampleSet.add(sentence);
      matchedSamples.push(sentence);
    }
  });

  const denominator = Math.max(1, Math.max(leftSentences.length, rightSentences.length));
  return { score: matchedCount / denominator, matches: matchedSamples };
}

function structureSignature(value: string) {
  const paragraphs = splitParagraphs(value);
  const source = paragraphs.length > 0 ? paragraphs : splitSentences(value);
  return source.map((item) => {
    const tokenCount = tokenize(item).length;
    if (tokenCount <= 25) return "short";
    if (tokenCount <= 70) return "medium";
    return "long";
  });
}

function structureParagraphIndexes(leftText: string, rightText: string) {
  const leftSignature = structureSignature(leftText);
  const rightSignature = structureSignature(rightText);
  const length = Math.min(leftSignature.length, rightSignature.length);
  const indexes: number[] = [];

  for (let index = 0; index < length; index += 1) {
    if (leftSignature[index] === rightSignature[index]) {
      indexes.push(index);
    }
  }

  return indexes.slice(0, 30);
}

function compareTexts(leftText: string, rightText: string) {
  const leftSentences = splitSentences(leftText);
  const rightSentences = splitSentences(rightText);
  const leftParagraphs = splitParagraphs(leftText);
  const rightParagraphs = splitParagraphs(rightText);
  const exact = exactSimilarity(leftSentences, rightSentences);
  const sentenceScore = averageBestSimilarity(leftSentences, rightSentences);
  const paragraphScore = averageBestSimilarity(leftParagraphs, rightParagraphs);
  const structureScore = sequenceSimilarity(structureSignature(leftText), structureSignature(rightText));
  const score = (exact.score + sentenceScore + paragraphScore + structureScore) / 4;

  return {
    score: Math.round(score * 100),
    exactScore: Math.round(exact.score * 100),
    sentenceScore: Math.round(sentenceScore * 100),
    paragraphScore: Math.round(paragraphScore * 100),
    structureScore: Math.round(structureScore * 100),
  };
}

function averageTopTenPercent(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => right - left);
  const takeCount = Math.max(1, Math.ceil(sorted.length * 0.1));
  const topValues = sorted.slice(0, takeCount);
  return Math.round(topValues.reduce((total, value) => total + value, 0) / topValues.length);
}

function createSubmissionSimilaritySummaries(
  submissions: Submission[],
  pairs: SimilarityPair[]
): SimilaritySubmissionSummary[] {
  return submissions.map((submission) => {
    const relatedPairs = pairs.filter(
      (pair) => pair.submissionAId === submission.id || pair.submissionBId === submission.id
    );
    const exactScore = averageTopTenPercent(relatedPairs.map((pair) => pair.exactScore));
    const sentenceScore = averageTopTenPercent(relatedPairs.map((pair) => pair.sentenceScore));
    const paragraphScore = averageTopTenPercent(relatedPairs.map((pair) => pair.paragraphScore));
    const structureScore = averageTopTenPercent(relatedPairs.map((pair) => pair.structureScore));

    return {
      submissionId: submission.id,
      exactScore,
      sentenceScore,
      paragraphScore,
      structureScore,
      score: Math.round((exactScore + sentenceScore + paragraphScore + structureScore) / 4),
    };
  });
}

function sequenceSimilarity(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row][column] =
        left[row - 1] === right[column - 1]
          ? rows[row - 1][column - 1] + 1
          : Math.max(rows[row - 1][column], rows[row][column - 1]);
    }
  }
  return rows[left.length][right.length] / Math.max(left.length, right.length);
}

function analyzeSubmissionSimilarity(
  assignmentId: string,
  modes: SimilarityMode[],
  submissions: Submission[]
): SimilarityAnalysis {
  const targetSubmissions = submissions.filter((submission) => submission.assignmentId === assignmentId);
  const pairs: SimilarityPair[] = [];

  for (let leftIndex = 0; leftIndex < targetSubmissions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < targetSubmissions.length; rightIndex += 1) {
      const left = targetSubmissions[leftIndex];
      const right = targetSubmissions[rightIndex];
      const leftSentences = splitSentences(left.reportText);
      const rightSentences = splitSentences(right.reportText);
      const exact = exactSimilarity(leftSentences, rightSentences);
      const sentenceScore = averageBestSimilarity(leftSentences, rightSentences);
      const leftParagraphs = splitParagraphs(left.reportText);
      const rightParagraphs = splitParagraphs(right.reportText);
      const paragraphScore = averageBestSimilarity(leftParagraphs, rightParagraphs);
      const structureIndexes = structureParagraphIndexes(left.reportText, right.reportText);
      const structureScore = sequenceSimilarity(structureSignature(left.reportText), structureSignature(right.reportText));
      const activeScores = modes.map((mode) => {
        if (mode === "exact") return exact.score;
        if (mode === "sentence") return sentenceScore;
        if (mode === "paragraph") return paragraphScore;
        return structureScore;
      });
      const score =
        activeScores.length === 0
          ? 0
          : activeScores.reduce((total, item) => total + item, 0) / activeScores.length;

      pairs.push({
        id: `${left.id}-${right.id}`,
        submissionAId: left.id,
        submissionBId: right.id,
        score: Math.round(score * 100),
        exactScore: Math.round(exact.score * 100),
        sentenceScore: Math.round(sentenceScore * 100),
        paragraphScore: Math.round(paragraphScore * 100),
        structureScore: Math.round(structureScore * 100),
        matchedPhrases: exact.matches,
        similarSentences: findSimilarTexts(leftSentences, rightSentences, 0.55),
        similarParagraphs: findSimilarTexts(leftParagraphs, rightParagraphs, 0.42),
        structureParagraphIndexes: structureIndexes,
      });
    }
  }

  const sortedPairs = pairs.sort((left, right) => right.score - left.score);

  return {
    id: crypto.randomUUID(),
    assignmentId,
    createdAt: new Date().toISOString(),
    modes,
    submissionCount: targetSubmissions.length,
    pairs: sortedPairs.slice(0, 100),
    submissionSummaries: createSubmissionSimilaritySummaries(targetSubmissions, sortedPairs),
  };
}

async function readApiJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const preview = (await response.text()).slice(0, 80);
    throw new Error(
      `/api/state가 JSON이 아닌 응답을 반환했습니다. 현재 서버가 API 없이 실행 중일 수 있습니다. 응답: ${preview}`
    );
  }

  return response.json();
}

async function fetchJsonWithTimeout(url: string, options?: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await readApiJson(response);
    return { response, payload };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function App() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");
  const [rubrics, setRubrics] = useState<RubricSet[]>([seedRubric]);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>(initialTaskTypes);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [similarityAnalyses, setSimilarityAnalyses] = useState<SimilarityAnalysis[]>([]);
  const [aiBaselines, setAiBaselines] = useState<AiBaseline[]>([]);
  const [aiGeneratedResults, setAiGeneratedResults] = useState<AiGeneratedResult[]>([]);
  const [, setEvaluationHistories] = useState<EvaluationHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState(seedRubric.id);
  const [aiModel, setAiModel] = useState("gpt-5.4-mini");
  const [evaluatingSubmissionIds, setEvaluatingSubmissionIds] = useState<string[]>([]);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [storageStatus, setStorageStatus] = useState("저장소 연결 확인 중");
  const selectedRubric = rubrics.find((rubric) => rubric.id === selectedRubricId) ?? rubrics[0];
  const currentAppState = useMemo<AppStateData>(
    () => ({
      rubrics,
      assignments,
      taskTypes,
      submissions,
      evaluations,
      similarityAnalyses,
      aiBaselines,
      aiGeneratedResults,
      evaluationHistories: [],
      auditLogs,
      selectedRubricId,
      aiModel,
      autoBackups: [],
    }),
    [
      aiBaselines,
      aiGeneratedResults,
      aiModel,
      assignments,
      auditLogs,
      evaluations,
      rubrics,
      selectedRubricId,
      similarityAnalyses,
      submissions,
      taskTypes,
    ]
  );
  const serverAppState = useMemo<AppStateData>(
    () => ({
      ...currentAppState,
      autoBackups: [],
    }),
    [currentAppState]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      try {
        const { response, payload } = await fetchJsonWithTimeout("/api/state");

        if (!response.ok) {
          throw new Error(payload.error || "저장된 데이터를 불러오지 못했습니다.");
        }

        if (payload.data && isMounted) {
          setRubrics(payload.data.rubrics ?? [seedRubric]);
          setAssignments(payload.data.assignments ?? initialAssignments);
          setTaskTypes(payload.data.taskTypes ?? initialTaskTypes);
          setSubmissions(payload.data.submissions ?? []);
          setEvaluations(payload.data.evaluations ?? []);
          setSimilarityAnalyses(payload.data.similarityAnalyses ?? []);
          setAiBaselines(payload.data.aiBaselines ?? []);
          setAiGeneratedResults(payload.data.aiGeneratedResults ?? []);
          setEvaluationHistories([]);
          setAuditLogs(payload.data.auditLogs ?? []);
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
        const { response, payload } = await fetchJsonWithTimeout("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: serverAppState,
          }),
        });

        if (!response.ok) {
          throw new Error(payload.error || "데이터 저장에 실패했습니다.");
        }

        setStorageStatus("저장됨");
      } catch (error) {
        setStorageStatus(`저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
      }
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [
    serverAppState,
    isStateLoaded,
  ]);

  useEffect(() => {
    if (!isStateLoaded) return;

    try {
      window.localStorage.removeItem("rubrix-local-backup");
      window.localStorage.removeItem("rubrix-auto-backups");
    } catch {
      // Legacy local backup cleanup is best-effort.
    }
  }, [isStateLoaded]);

  const stats = useMemo(
    () => [
      { label: "평가세트", value: rubrics.length },
      { label: "과제", value: assignments.length },
      { label: "제출물", value: submissions.length },
      { label: "평가 결과", value: evaluations.length },
    ],
    [assignments.length, evaluations.length, rubrics.length, submissions.length]
  );

  function createBackupData(): BackupData {
    return {
      rubrics,
      assignments,
      taskTypes,
      submissions,
      evaluations,
      similarityAnalyses,
      aiBaselines,
      aiGeneratedResults,
      evaluationHistories: [],
      auditLogs,
      selectedRubricId,
      aiModel,
    };
  }

  function backupSummary(data: BackupData) {
    return `과제 ${data.assignments.length}개 · 제출물 ${data.submissions.length}개 · 평가 ${data.evaluations.length}개`;
  }

  function addAuditLog(action: string, targetType: string, message: string, targetId?: string) {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      action,
      targetType,
      targetId,
      message,
    };
    setAuditLogs((current) => [log, ...current].slice(0, 200));
  }

  function updateRubric(nextRubric: RubricSet) {
    setRubrics((current) => current.map((rubric) => (rubric.id === nextRubric.id ? nextRubric : rubric)));
  }

  function restoreAppState(nextState: Partial<AppStateData>) {
    if (!window.confirm("백업 파일의 데이터로 현재 데이터를 복원할까요? 현재 서버 데이터는 복원 데이터로 덮어써집니다.")) {
      return;
    }

    setRubrics(nextState.rubrics?.length ? nextState.rubrics : [seedRubric]);
    setAssignments(nextState.assignments ?? []);
    setTaskTypes(nextState.taskTypes?.length ? nextState.taskTypes : initialTaskTypes);
    setSubmissions(nextState.submissions ?? []);
    setEvaluations(nextState.evaluations ?? []);
    setSimilarityAnalyses(nextState.similarityAnalyses ?? []);
    setAiBaselines(nextState.aiBaselines ?? []);
    setAiGeneratedResults(nextState.aiGeneratedResults ?? []);
    setEvaluationHistories([]);
    setAuditLogs(nextState.auditLogs ?? []);
    setSelectedRubricId(nextState.selectedRubricId ?? nextState.rubrics?.[0]?.id ?? seedRubric.id);
    setAiModel(nextState.aiModel ?? "gpt-5.4-mini");
    addAuditLog("restore_backup", "app_state", "백업 파일에서 데이터를 복원했습니다.");
    setStorageStatus("백업 복원됨. 자동 저장 대기 중");
  }

  function downloadBackup() {
    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: createBackupData(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `rubrix-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function addRubricSet(name?: string, description?: string, source?: RubricSet) {
    const sourceRubric = source ?? selectedRubric;
    const nextRubric: RubricSet = {
      ...sourceRubric,
      id: crypto.randomUUID(),
      name: name?.trim() || sourceRubric.name || `새 평가세트 ${rubrics.length + 1}`,
      description: description?.trim() || sourceRubric.description || "새 과제에 사용할 평가세트입니다.",
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
    addAuditLog("delete", "rubric", "평가세트를 삭제했습니다.", rubricId);
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
    const assignment = assignments.find((item) => item.id === assignmentId);
    const linkedSubmissions = submissions.filter((submission) => submission.assignmentId === assignmentId);
    const linkedSubmissionIds = new Set(linkedSubmissions.map((submission) => submission.id));
    const linkedEvaluations = evaluations.filter((evaluation) => linkedSubmissionIds.has(evaluation.submissionId));
    const linkedAnalyses = similarityAnalyses.filter((analysis) => analysis.assignmentId === assignmentId);
    const linkedBaselines = aiBaselines.filter((baseline) => baseline.assignmentId === assignmentId);
    const linkedAiResults = aiGeneratedResults.filter((result) => result.assignmentId === assignmentId);
    const confirmation = window.prompt(
      [
        `"${assignment?.title ?? "이 과제"}"를 삭제합니다.`,
        `연결된 제출물 ${linkedSubmissions.length}개, 평가 ${linkedEvaluations.length}개, 분석 ${linkedAnalyses.length}개, AI Baseline ${linkedBaselines.length}개, AI Generated 결과 ${linkedAiResults.length}개가 함께 삭제됩니다.`,
        "삭제하려면 아래에 삭제 라고 입력하세요.",
      ].join("\n")
    );
    if (confirmation !== "삭제") return;
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    setSubmissions((current) => current.filter((submission) => submission.assignmentId !== assignmentId));
    setEvaluations((current) => current.filter((evaluation) => !linkedSubmissionIds.has(evaluation.submissionId)));
    setSimilarityAnalyses((current) => current.filter((analysis) => analysis.assignmentId !== assignmentId));
    setAiBaselines((current) => current.filter((baseline) => baseline.assignmentId !== assignmentId));
    setAiGeneratedResults((current) => current.filter((result) => result.assignmentId !== assignmentId));
    addAuditLog(
      "delete",
      "assignment",
      `과제 삭제: 제출물 ${linkedSubmissions.length}개, 평가 ${linkedEvaluations.length}개 포함`,
      assignmentId
    );
  }

  function deleteSubmission(submissionId: string) {
    const submission = submissions.find((item) => item.id === submissionId);
    const linkedEvaluations = evaluations.filter((evaluation) => evaluation.submissionId === submissionId);
    const confirmation = window.prompt(
      [
        `"${submission?.studentName ?? "이 제출물"}"을 삭제합니다.`,
        `연결된 평가 ${linkedEvaluations.length}개도 함께 삭제됩니다.`,
        "삭제하려면 아래에 삭제 라고 입력하세요.",
      ].join("\n")
    );
    if (confirmation !== "삭제") return;
    setSubmissions((current) => current.filter((submission) => submission.id !== submissionId));
    setEvaluations((current) => current.filter((evaluation) => evaluation.submissionId !== submissionId));
    setSimilarityAnalyses((current) =>
      current.map((analysis) => ({
        ...analysis,
        pairs: analysis.pairs.filter(
          (pair) => pair.submissionAId !== submissionId && pair.submissionBId !== submissionId
        ),
        submissionSummaries: (analysis.submissionSummaries ?? []).filter(
          (summary) => summary.submissionId !== submissionId
        ),
      }))
    );
    setAiGeneratedResults((current) =>
      current.map((result) => ({
        ...result,
        scores: result.scores.filter((score) => score.submissionId !== submissionId),
      }))
    );
    addAuditLog("delete", "submission", `제출물을 삭제했습니다. 연결 평가 ${linkedEvaluations.length}개`, submissionId);
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

  async function runAssignmentEvaluations(assignmentId: string) {
    const assignmentSubmissions = submissions.filter((submission) => submission.assignmentId === assignmentId);
    if (assignmentSubmissions.length === 0) {
      window.alert("선택한 과제에 등록된 제출물이 없습니다.");
      return;
    }

    const submissionIds = new Set(assignmentSubmissions.map((submission) => submission.id));
    const hasExistingEvaluations = evaluations.some((evaluation) => submissionIds.has(evaluation.submissionId));
    if (
      hasExistingEvaluations &&
      !window.confirm("선택한 과제의 기존 평가 결과를 새 일괄 평가 결과로 덮어쓸까요? 기존 점수 이력은 보관하지 않습니다.")
    ) {
      return;
    }

    setEvaluatingSubmissionIds((current) => Array.from(new Set([...current, ...assignmentSubmissions.map((submission) => submission.id)])));

    try {
    const assignment = assignments.find((item) => item.id === assignmentId);
    const rubric = rubrics.find((item) => item.id === assignment?.rubricSetId) ?? selectedRubric;
    const taskType = taskTypes.find((item) => item.id === assignment?.taskType) ?? taskTypes[0];
    const criteriaText = rubric.categories
      .map((categoryItem) => {
        const enabledCriteria = categoryItem.criteria.filter((criterionItem) => criterionItem.enabled);
        return `${categoryItem.name} (${categoryItem.maxScore}점): ${enabledCriteria.map((criterionItem) => criterionItem.name).join(", ")}`;
      })
      .join("\n");
    const now = new Date().toISOString();
    const nextEvaluations: Evaluation[] = [];

    for (const submission of assignmentSubmissions) {
      const fallbackScore = Math.max(45, Math.min(90, Math.round(62 + Math.min(26, submission.reportText.length / 220))));
      const prompt = [
        rubric.promptPersona,
        "",
        rubric.promptCommonCriteria,
        "",
        "중요한 원칙:",
        rubric.promptPrinciples,
        "",
        "엄격한 점수 산정 지침:",
        "- 리포트에 있는 내용만 평가하고 없는 내용을 추정하지 마세요.",
        "- 같은 과제의 여러 제출물을 평가한다고 가정하고 0~100점 전체 척도를 사용하세요.",
        "- 평균적인 제출물은 65~75점, 충분하지만 결함이 있는 제출물은 75~85점에 배치하세요.",
        "- 90점 이상은 과제 요구, 분석, 근거, 구성, 표현, 연구윤리가 모두 매우 뛰어난 경우에만 부여하세요.",
        "- 내용 누락, 근거 부족, 단순 요약, 논리 비약, 인용 문제, 과제 지시 미충족은 명확히 감점하세요.",
        "",
        `과제명: ${assignment?.title ?? "제목 없는 과제"}`,
        `과제 설명: ${assignment?.description ?? ""}`,
        `과제유형: ${taskType.name}`,
        `과제유형 초점: ${taskType.focus.join(", ")}`,
        `평가세트: ${rubric.name}`,
        "",
        "평가기준:",
        criteriaText,
        "",
        "리포트 본문:",
        submission.reportText,
      ].join("\n");

      let evaluatedScore = fallbackScore;
      let evaluatedFeedback = "AI 평가 연결 실패 시 표시되는 임시 평가 결과입니다. 평가자는 Evaluations에서 내용을 확인하고 조정할 수 있습니다.";
      let evaluatedStudentReport = createStudentReport({
        assignmentTitle: assignment?.title ?? "제목 없는 과제",
        taskType,
        studentName: submission.studentName,
        totalScore: fallbackScore,
        categories: rubric.categories.map((categoryItem) => ({
          name: categoryItem.name,
          maxScore: categoryItem.maxScore,
          score: Math.max(1, Math.min(categoryItem.maxScore, Math.round(categoryItem.maxScore * (fallbackScore / 100)))),
          criteria: categoryItem.criteria.filter((criterionItem) => criterionItem.enabled).map((criterionItem) => criterionItem.name),
        })),
      });

      try {
        const { response, payload } = await fetchJsonWithTimeout("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: aiModel,
            prompt: `${prompt}

반드시 다음 JSON 형식으로만 응답하세요.
{
  "total_score": 0,
  "feedback": "평가 내용 요약 피드백",
  "student_report": "학생에게 전달할 평가보고서"
}`,
          }),
        }, 60000);
        if (!response.ok) throw new Error(payload.error || "AI 평가 요청에 실패했습니다.");
        evaluatedScore = Math.max(0, Math.min(100, Math.round(Number(payload.result.total_score) || fallbackScore)));
        evaluatedFeedback = payload.result.feedback || evaluatedFeedback;
        evaluatedStudentReport = payload.result.student_report || evaluatedStudentReport;
      } catch (error) {
        evaluatedFeedback = `AI 평가 연결 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"} 현재는 임시 평가 결과를 표시합니다.`;
      }

      nextEvaluations.push({
        id: crypto.randomUUID(),
        submissionId: submission.id,
        rubricSetId: rubric.id,
        totalScore: evaluatedScore,
        aiEvaluationScore: evaluatedScore,
        aiNormalizedScore: evaluatedScore,
        status: "ai_completed",
        prompt,
        feedback: evaluatedFeedback,
        studentReport: evaluatedStudentReport,
        evaluatedAt: now,
        model: aiModel,
        promptVersion: evaluationPromptVersion,
        rubricPromptVersion,
        safeModelVersion,
      });
    }

    const normalizedEvaluations = normalizeAiEvaluationScores(nextEvaluations);
    setEvaluations((current) => [
      ...normalizedEvaluations,
      ...current.filter((evaluation) => !submissionIds.has(evaluation.submissionId)),
    ]);
    addAuditLog(
      hasExistingEvaluations ? "rerun_assignment_evaluation" : "run_assignment_evaluation",
      "assignment",
      `과제 일괄 평가 완료: ${assignmentSubmissions.length}개 제출물`,
      assignmentId
    );
    } finally {
      setEvaluatingSubmissionIds((current) => current.filter((submissionId) => !submissionIds.has(submissionId)));
    }
  }

  function finalizeEvaluation(evaluationId: string) {
    const evaluation = evaluations.find((item) => item.id === evaluationId);
    setEvaluations((current) =>
      current.map((evaluation) =>
        evaluation.id === evaluationId ? { ...evaluation, status: "finalized", finalizedAt: new Date().toISOString() } : evaluation
      )
    );
    addAuditLog("finalize", "evaluation", `평가를 최종 확정했습니다. 점수 ${evaluation?.totalScore ?? "-"}점`, evaluationId);
  }

  function reopenEvaluation(evaluationId: string) {
    const evaluation = evaluations.find((item) => item.id === evaluationId);
    if (!window.confirm("최종확정을 해제하고 Evaluations에서 다시 수정할 수 있게 할까요?")) return;
    setEvaluations((current) =>
      current.map((item) =>
        item.id === evaluationId ? { ...item, status: "ai_completed", finalizedAt: undefined } : item
      )
    );
    addAuditLog("reopen", "evaluation", `최종확정을 해제했습니다. 점수 ${evaluation?.totalScore ?? "-"}점`, evaluationId);
  }

  function runSimilarityAnalysis(assignmentId: string, modes: SimilarityMode[]) {
    const analysis = analyzeSubmissionSimilarity(assignmentId, modes, submissions);
    setSimilarityAnalyses((current) => [
      analysis,
      ...current.filter((item) => item.assignmentId !== assignmentId),
    ]);
  }

  function addAiBaseline(assignmentId: string, type: string, model: string) {
    if (!assignmentId) return;
    setAiBaselines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        assignmentId,
        type: type.trim() || "ChatGPT",
        model: model.trim() || "직접 입력 모델",
        enabled: true,
        text: "",
      },
    ]);
  }

  function updateAiBaseline(nextBaseline: AiBaseline) {
    setAiBaselines((current) =>
      current.map((baseline) => (baseline.id === nextBaseline.id ? nextBaseline : baseline))
    );
  }

  function deleteAiBaseline(baselineId: string) {
    if (!window.confirm("AI Baseline을 삭제할까요?")) return;
    setAiBaselines((current) => current.filter((baseline) => baseline.id !== baselineId));
    setAiGeneratedResults((current) =>
      current.map((result) => ({
        ...result,
        scores: result.scores.map((score) => ({
          ...score,
          modelScores: score.modelScores.filter((modelScore) => modelScore.baselineId !== baselineId),
        })),
      }))
    );
    addAuditLog("delete", "ai_baseline", "AI Baseline을 삭제했습니다.", baselineId);
  }

  function runAiGeneratedDiagnosis(assignmentId: string) {
    const assignmentSubmissions = submissions.filter((submission) => submission.assignmentId === assignmentId);
    const baselines = aiBaselines.filter(
      (baseline) => baseline.assignmentId === assignmentId && baseline.enabled && baseline.text.trim()
    );

    const result: AiGeneratedResult = {
      id: crypto.randomUUID(),
      assignmentId,
      createdAt: new Date().toISOString(),
      scores: assignmentSubmissions.map((submission) => {
        const modelScores = baselines.map((baseline) => ({
          baselineId: baseline.id,
          type: baseline.type,
          model: baseline.model,
          ...compareTexts(submission.reportText, baseline.text),
        }));
        const averageScore =
          modelScores.length === 0
            ? 0
            : Math.round(modelScores.reduce((total, score) => total + score.score, 0) / modelScores.length);

        return {
          submissionId: submission.id,
          averageScore,
          modelScores,
        };
      }),
    };

    setAiGeneratedResults((current) => [
      result,
      ...current.filter((item) => item.assignmentId !== assignmentId),
    ]);
  }

  function runRubrixTuning(assignmentId: string) {
    const assignmentEvaluationSignals = evaluations
      .filter((evaluation) => evaluation.status !== "finalized")
      .map((evaluation) => {
        const submission = submissions.find((item) => item.id === evaluation.submissionId);
        if (submission?.assignmentId !== assignmentId) return null;
        const similaritySummary = similarityAnalyses
          .find((analysis) => analysis.assignmentId === assignmentId)
          ?.submissionSummaries?.find((summary) => summary.submissionId === submission.id);
        const aiGeneratedScore = aiGeneratedResults
          .find((result) => result.assignmentId === assignmentId)
          ?.scores.find((score) => score.submissionId === submission.id);

        const signal: SafeSignal = {
          evaluationId: evaluation.id,
          baseScore: evaluation.aiNormalizedScore ?? evaluation.aiEvaluationScore ?? evaluation.totalScore,
          aiEvaluationScore: evaluation.aiEvaluationScore ?? evaluation.totalScore,
          exact: similaritySummary?.exactScore,
          sentence: similaritySummary?.sentenceScore,
          paragraph: similaritySummary?.paragraphScore,
          structure: similaritySummary?.structureScore,
          modelScores: Object.fromEntries(
            (aiGeneratedScore?.modelScores ?? []).slice(0, 6).map((modelScore) => [modelScore.baselineId, modelScore.score])
          ),
        };
        return signal;
      })
      .filter((signal): signal is SafeSignal => signal !== null);

    if (assignmentEvaluationSignals.length === 0) return;

    const tuningResults = calculateSafeTuning(assignmentEvaluationSignals);
    const tuningMap = new Map(tuningResults.map((result) => [result.evaluationId, result]));

    setEvaluations((current) =>
      current.map((evaluation) => {
        const result = tuningMap.get(evaluation.id);
        return result
          ? {
              ...evaluation,
              rubrixTuningScore: result.score,
              rubrixTuningDelta: result.delta,
              rubrixTuningNote: result.note,
            }
          : evaluation;
      })
    );
    addAuditLog("rubrix_tuning", "assignment", `Rubrix Tuning을 실행했습니다. 대상 ${tuningResults.length}개`, assignmentId);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={rubrixLogo} alt="Rubrix" />
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
            runAssignmentEvaluations={runAssignmentEvaluations}
            deleteSubmission={deleteSubmission}
          />
        )}
        {activeMenu === "aiDiagnosis" && (
          <AiDiagnosis
            assignments={assignments}
            rubrics={rubrics}
            taskTypes={taskTypes}
            baselines={aiBaselines}
            addBaseline={addAiBaseline}
            updateBaseline={updateAiBaseline}
            deleteBaseline={deleteAiBaseline}
          />
        )}
        {activeMenu === "aiGeneratedScore" && (
          <AiGeneratedScore
            assignments={assignments}
            submissions={submissions}
            baselines={aiBaselines}
            results={aiGeneratedResults}
            runDiagnosis={runAiGeneratedDiagnosis}
          />
        )}
        {activeMenu === "analysis" && (
          <Analysis
            analyses={similarityAnalyses}
            assignments={assignments}
            submissions={submissions}
            runSimilarityAnalysis={runSimilarityAnalysis}
          />
        )}
        {activeMenu === "evaluations" && (
          <Evaluations
            evaluations={evaluations}
            submissions={submissions}
            assignments={assignments}
            similarityAnalyses={similarityAnalyses}
            aiGeneratedResults={aiGeneratedResults}
            finalizeEvaluation={finalizeEvaluation}
            updateEvaluations={setEvaluations}
            runRubrixTuning={runRubrixTuning}
            recordEvaluationEdit={addAuditLog}
          />
        )}
        {activeMenu === "reports" && (
          <Reports
            evaluations={evaluations}
            submissions={submissions}
            assignments={assignments}
            similarityAnalyses={similarityAnalyses}
            aiGeneratedResults={aiGeneratedResults}
            reopenEvaluation={reopenEvaluation}
          />
        )}
        {activeMenu === "settings" && (
          <SettingsPanel
            aiModel={aiModel}
            setAiModel={setAiModel}
            downloadBackup={downloadBackup}
            restoreBackup={restoreAppState}
            appState={currentAppState}
            auditLogs={auditLogs}
          />
        )}
        {activeMenu === "safeModel" && <SafeModelGuide />}
        {activeMenu === "userManual" && <UserManualGuide />}
        {activeMenu === "rtsSimulator" && <RtsSimulator />}
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
  const evaluatedScores = selectedAssignmentEvaluations.map((evaluation) => evaluation.totalScore);
  const averageScore = evaluatedScores.length ? mean(evaluatedScores) : 0;
  const scoreDeviation = evaluatedScores.length ? standardDeviation(evaluatedScores) : 0;
  const scoreRange =
    evaluatedScores.length > 0 ? Math.max(...evaluatedScores) - Math.min(...evaluatedScores) : 0;
  const highScoreRate =
    evaluatedScores.length > 0
      ? (evaluatedScores.filter((score) => score >= 90).length / evaluatedScores.length) * 100
      : 0;
  const lowScoreRate =
    evaluatedScores.length > 0
      ? (evaluatedScores.filter((score) => score <= 60).length / evaluatedScores.length) * 100
      : 0;
  const narrowDistributionWarning = evaluatedScores.length >= 5 && scoreRange < 30;
  const formatStatNumber = (value: number) => value.toFixed(2);
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
      title: "AI Diagnosis",
      description: "AI Baseline을 등록해 주세요.",
    },
    {
      title: "Submissions",
      description: "제출물을 등록해 평가해 주세요.",
    },
    {
      title: "AI Generated Score",
      description: "AI Baseline과의 유사도를 계산해 주세요.",
    },
    {
      title: "Analysis",
      description: "제출물 간 유사도를 분석해 주세요.",
    },
    {
      title: "Evaluations",
      description: "점수와 보고서를 조정하고 확정해 주세요.",
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
        <div className="score-monitor-grid">
          <div><span>평균</span><strong>{evaluatedScores.length ? `${formatStatNumber(averageScore)}점` : "-"}</strong></div>
          <div><span>표준편차</span><strong>{evaluatedScores.length ? formatStatNumber(scoreDeviation) : "-"}</strong></div>
          <div><span>최고/최저 차이</span><strong>{evaluatedScores.length ? `${formatStatNumber(scoreRange)}점` : "-"}</strong></div>
          <div><span>90점 이상</span><strong>{evaluatedScores.length ? `${formatStatNumber(highScoreRate)}%` : "-"}</strong></div>
          <div><span>60점 이하</span><strong>{evaluatedScores.length ? `${formatStatNumber(lowScoreRate)}%` : "-"}</strong></div>
        </div>
        {narrowDistributionWarning ? (
          <p className="score-warning">점수 분포가 너무 좁습니다. 평가 기준 또는 프롬프트를 점검하세요.</p>
        ) : null}
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
  addRubricSet: (name?: string, description?: string, source?: RubricSet) => void;
  deleteRubricSet: (rubricId: string) => void;
}) {
  const [isAddingRubric, setIsAddingRubric] = useState(false);
  const [isRubricEditing, setIsRubricEditing] = useState(false);
  const [newRubricName, setNewRubricName] = useState("");
  const [newRubricDescription, setNewRubricDescription] = useState("");
  const [draftRubric, setDraftRubric] = useState<RubricSet | null>(null);
  const editableRubric = isAddingRubric && draftRubric ? draftRubric : selectedRubric;

  function updateEditableRubric(nextRubric: RubricSet) {
    if (isAddingRubric) {
      setDraftRubric(nextRubric);
      return;
    }

    updateRubric(nextRubric);
  }

  function startAddingRubric() {
    setDraftRubric({
      ...selectedRubric,
      id: "draft-rubric",
      name: newRubricName || selectedRubric.name,
      description: newRubricDescription || selectedRubric.description,
      categories: selectedRubric.categories.map((categoryItem) => ({
        ...categoryItem,
        criteria: categoryItem.criteria.map((criterionItem) => ({ ...criterionItem })),
      })),
    });
    setIsAddingRubric(true);
    setIsRubricEditing(true);
  }

  function toggleCriterion(categoryId: string, criterionId: string) {
    if (!isRubricEditing) return;
    updateEditableRubric({
      ...editableRubric,
      categories: editableRubric.categories.map((categoryItem) =>
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
    if (!isScoreBalanced) {
      window.alert("배점 합계가 100점이 되어야 평가세트를 추가할 수 있습니다.");
      return;
    }

    addRubricSet(newRubricName, newRubricDescription, editableRubric);
    setNewRubricName("");
    setNewRubricDescription("");
    setDraftRubric(null);
    setIsAddingRubric(false);
    setIsRubricEditing(false);
  }

  function updateCategoryScore(categoryId: string, value: string) {
    if (!isRubricEditing) return;
    const nextScore = Math.max(0, Math.min(100, Number(value) || 0));
    updateEditableRubric({
      ...editableRubric,
      categories: editableRubric.categories.map((categoryItem) =>
        categoryItem.id === categoryId ? { ...categoryItem, maxScore: nextScore } : categoryItem
      ),
    });
  }

  const totalScore = editableRubric.categories.reduce((total, categoryItem) => total + categoryItem.maxScore, 0);
  const commonScore = editableRubric.categories
    .filter((categoryItem) => categoryItem.type === "common")
    .reduce((total, categoryItem) => total + categoryItem.maxScore, 0);
  const taskScore = editableRubric.categories
    .filter((categoryItem) => categoryItem.type === "task")
    .reduce((total, categoryItem) => total + categoryItem.maxScore, 0);
  const isScoreBalanced = totalScore === 100;

  function toggleRubricScoreEditing() {
    if (isRubricEditing && !isScoreBalanced) {
      window.alert("배점 합계가 100점이 되어야 확정할 수 있습니다.");
      return;
    }

    setIsRubricEditing((current) => !current);
  }

  return (
    <section className="two-column">
      <article className="panel">
        <div className="panel-title">
          <h2>평가세트 목록</h2>
          <button className="icon-button" title="평가세트 추가" onClick={startAddingRubric}>
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
              <button
                className="secondary-button"
                onClick={() => {
                  setIsAddingRubric(false);
                  setIsRubricEditing(false);
                  setDraftRubric(null);
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}
        {rubrics.map((rubric) => (
          <div className={selectedRubric.id === rubric.id ? "select-row selected" : "select-row"} key={rubric.id}>
            <button
              className="row-main-button"
              onClick={() => {
                setSelectedRubricId(rubric.id);
                setIsAddingRubric(false);
                setIsRubricEditing(false);
                setDraftRubric(null);
              }}
            >
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
          <button className="secondary-button" onClick={toggleRubricScoreEditing}>
            {isRubricEditing ? "배점 확정" : "배점 수정"}
          </button>
        </div>
        <div className={isScoreBalanced ? "score-balance balanced" : "score-balance warning"}>
          <strong>배점 합계 {totalScore}/100</strong>
          <span>공통 기준 {commonScore}점 · 과제유형별 추가 평가 {taskScore}점</span>
          {!isScoreBalanced ? <p>전체 배점 합계가 100점이 되도록 조정해 주세요.</p> : null}
        </div>
        <div className="form-grid compact-form">
          <label className="field">
            <span>평가세트 이름</span>
            <input
              value={editableRubric.name}
              disabled={!isRubricEditing}
              onChange={(event) => updateEditableRubric({ ...editableRubric, name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>평가세트 설명</span>
            <input
              value={editableRubric.description}
              disabled={!isRubricEditing}
              onChange={(event) => updateEditableRubric({ ...editableRubric, description: event.target.value })}
            />
          </label>
        </div>
        <div className="rubric-grid">
          {editableRubric.categories.map((categoryItem) => (
            <div className="category-box" key={categoryItem.id}>
              <div className="category-head">
                <strong>{categoryItem.name}</strong>
                <label className="score-input">
                  <input
                    min="0"
                    max="100"
                    type="number"
                    value={categoryItem.maxScore}
                    disabled={!isRubricEditing}
                    onChange={(event) => updateCategoryScore(categoryItem.id, event.target.value)}
                  />
                  <span>점</span>
                </label>
              </div>
              {categoryItem.criteria.map((criterionItem) => (
                <label className="check-row" key={criterionItem.id}>
                  <input
                    type="checkbox"
                    checked={criterionItem.enabled}
                    disabled={!isRubricEditing}
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
              value={editableRubric.promptPersona}
              disabled={!isRubricEditing}
              onChange={(event) => updateEditableRubric({ ...editableRubric, promptPersona: event.target.value })}
            />
          </label>
          <label className="field full">
            <span>공통 기준</span>
            <textarea
              value={editableRubric.promptCommonCriteria}
              disabled={!isRubricEditing}
              onChange={(event) => updateEditableRubric({ ...editableRubric, promptCommonCriteria: event.target.value })}
            />
          </label>
          <label className="field full">
            <span>중요한 원칙</span>
            <textarea
              value={editableRubric.promptPrinciples}
              disabled={!isRubricEditing}
              onChange={(event) => updateEditableRubric({ ...editableRubric, promptPrinciples: event.target.value })}
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
  const [assignmentSortDirection, setAssignmentSortDirection] = useState<"asc" | "desc">("asc");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [assignmentDraft, setAssignmentDraft] = useState<Assignment | null>(null);
  const sortedAssignments = [...assignments].sort((left, right) => {
    const compareResult = left.title.localeCompare(right.title, "ko");
    return assignmentSortDirection === "asc" ? compareResult : -compareResult;
  });

  function startEditAssignment(assignment: Assignment) {
    setEditingAssignmentId(assignment.id);
    setAssignmentDraft({ ...assignment });
  }

  function cancelEditAssignment() {
    setEditingAssignmentId("");
    setAssignmentDraft(null);
  }

  function updateAssignmentDraft(field: keyof Assignment, value: string) {
    setAssignmentDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function confirmEditAssignment() {
    if (!assignmentDraft) return;
    updateAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentDraft.id
          ? {
              ...assignmentDraft,
              title: assignmentDraft.title.trim() || assignment.title,
              description: assignmentDraft.description.trim() || assignment.description,
            }
          : assignment
      )
    );
    cancelEditAssignment();
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
        <div className="panel-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setAssignmentSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
          >
            {assignmentSortDirection === "asc" ? "오름차순" : "내림차순"}
          </button>
          <button className="primary-button" onClick={() => setIsAddingAssignment(true)}>
            <Plus size={16} />
            과제 만들기
          </button>
        </div>
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
        {sortedAssignments.map((assignment) => {
          const isEditing = editingAssignmentId === assignment.id && assignmentDraft;
          const taskType = taskTypes.find((item) => item.id === assignment.taskType);
          const rubric = rubrics.find((item) => item.id === assignment.rubricSetId);

          return (
            <div className="table-row" key={assignment.id}>
              {isEditing ? (
                <>
                  <label className="compact-field">
                    <input
                      value={assignmentDraft.title}
                      onChange={(event) => updateAssignmentDraft("title", event.target.value)}
                    />
                  </label>
                  <label className="compact-field">
                    <select
                      value={assignmentDraft.taskType}
                      onChange={(event) => updateAssignmentDraft("taskType", event.target.value)}
                    >
                      {taskTypes.map((taskTypeItem) => (
                        <option key={taskTypeItem.id} value={taskTypeItem.id}>
                          {taskTypeItem.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="compact-field">
                    <select
                      value={assignmentDraft.rubricSetId}
                      onChange={(event) => updateAssignmentDraft("rubricSetId", event.target.value)}
                    >
                      {rubrics.map((rubricItem) => (
                        <option key={rubricItem.id} value={rubricItem.id}>
                          {rubricItem.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="compact-field">
                    <textarea
                      value={assignmentDraft.description}
                      onChange={(event) => updateAssignmentDraft("description", event.target.value)}
                    />
                  </label>
                  <div className="row-actions">
                    <button className="primary-button compact-action" onClick={confirmEditAssignment}>
                      확정
                    </button>
                    <button className="secondary-button compact-action" onClick={cancelEditAssignment}>
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{assignment.title}</strong>
                  <span>{taskType?.name ?? "-"}</span>
                  <span>{rubric?.name ?? "-"}</span>
                  <span>{assignment.description}</span>
                  <div className="row-actions">
                    <button className="secondary-button compact-action" onClick={() => startEditAssignment(assignment)}>
                      수정
                    </button>
                    <button className="danger-button compact-action" onClick={() => deleteAssignment(assignment.id)}>
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
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
  runAssignmentEvaluations,
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
  runAssignmentEvaluations: (assignmentId: string) => Promise<void>;
  deleteSubmission: (submissionId: string) => void;
}) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const [studentName, setStudentName] = useState("학생 1");
  const [studentIdentifier, setStudentIdentifier] = useState("S001");
  const [inputType, setInputType] = useState<"pdf" | "text">("text");
  const [fileName, setFileName] = useState("");
  const [reportText, setReportText] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [submissionSortDirection, setSubmissionSortDirection] = useState<"asc" | "desc">("asc");
  const filteredSubmissions = submissions.filter(
    (submission) => submission.assignmentId === (selectedAssignmentId || assignments[0]?.id)
  );
  const sortedFilteredSubmissions = [...filteredSubmissions].sort((left, right) => {
    const compareResult = left.studentName.localeCompare(right.studentName, "ko");
    return submissionSortDirection === "asc" ? compareResult : -compareResult;
  });
  const selectedSubmission =
    sortedFilteredSubmissions.find((submission) => submission.id === selectedSubmissionId) ?? sortedFilteredSubmissions[0];
  const selectedSubmissionAssignment = assignments.find(
    (assignment) => assignment.id === selectedSubmission?.assignmentId
  );
  const selectedSubmissionEvaluated = selectedSubmission
    ? evaluations.some((evaluation) => evaluation.submissionId === selectedSubmission.id)
    : false;
  const selectedSubmissionEvaluating = selectedSubmission
    ? evaluatingSubmissionIds.includes(selectedSubmission.id)
    : false;
  const selectedAssignmentEvaluating = filteredSubmissions.some((submission) =>
    evaluatingSubmissionIds.includes(submission.id)
  );

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
        <div className="button-group">
          <button
            className="primary-button"
            type="button"
            disabled={filteredSubmissions.length === 0 || selectedAssignmentEvaluating}
            onClick={() => runAssignmentEvaluations(selectedAssignmentId || assignments[0]?.id || "")}
          >
            {selectedAssignmentEvaluating ? <span className="button-spinner" /> : <Square size={16} />}
            {selectedAssignmentEvaluating ? "일괄 평가 중" : "일괄 AI 평가"}
          </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setSubmissionSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
        >
          {submissionSortDirection === "asc" ? "오름차순" : "내림차순"}
        </button>
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
          {filteredSubmissions.length === 0 ? <p className="muted">선택한 과제에 등록된 제출물이 없습니다.</p> : null}
          {sortedFilteredSubmissions.map((submission) => {
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

const defaultAiTypes = ["ChatGPT", "Claude", "Gemini"];
const defaultAiModels: Record<string, string[]> = {
  ChatGPT: ["gpt-5.4-mini", "gpt-5.1", "gpt-4.1"],
  Claude: ["claude-sonnet-4.5", "claude-opus-4.1"],
  Gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
};

function AiDiagnosis({
  assignments,
  rubrics,
  taskTypes,
  baselines,
  addBaseline,
  updateBaseline,
  deleteBaseline,
}: {
  assignments: Assignment[];
  rubrics: RubricSet[];
  taskTypes: TaskType[];
  baselines: AiBaseline[];
  addBaseline: (assignmentId: string, type: string, model: string) => void;
  updateBaseline: (baseline: AiBaseline) => void;
  deleteBaseline: (baselineId: string) => void;
}) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const [selectedBaselineId, setSelectedBaselineId] = useState("");
  const [aiType, setAiType] = useState(defaultAiTypes[0]);
  const [customType, setCustomType] = useState("");
  const [aiModelName, setAiModelName] = useState(defaultAiModels[defaultAiTypes[0]][0]);
  const [customModel, setCustomModel] = useState("");
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? assignments[0];
  const selectedRubric = rubrics.find((rubric) => rubric.id === selectedAssignment?.rubricSetId);
  const selectedTaskType = taskTypes.find((taskType) => taskType.id === selectedAssignment?.taskType);
  const assignmentBaselines = baselines.filter((baseline) => baseline.assignmentId === selectedAssignment?.id);
  const selectedBaseline =
    assignmentBaselines.find((baseline) => baseline.id === selectedBaselineId) ?? assignmentBaselines[0];
  const modelOptions = defaultAiModels[aiType] ?? [];

  useEffect(() => {
    if (!selectedAssignmentId && assignments[0]?.id) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    setSelectedBaselineId(assignmentBaselines[0]?.id ?? "");
  }, [selectedAssignment?.id, assignmentBaselines.length]);

  function confirmAddBaseline() {
    const type = aiType === "직접 입력" ? customType : aiType;
    const model = aiModelName === "직접 입력" ? customModel : aiModelName;
    addBaseline(selectedAssignment?.id ?? "", type, model);
  }

  return (
    <section className="analysis-layout">
      <article className="panel analysis-control-panel">
        <div className="panel-title">
          <div>
            <h2>AI Diagnosis</h2>
            <p className="muted">과제별 AI Baseline을 등록하고 관리합니다.</p>
          </div>
        </div>
        <div className="form-grid compact-form">
          <label className="field">
            <span>과제</span>
            <select value={selectedAssignment?.id ?? ""} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </label>
          <div className="analysis-summary-card">
            <span>과제유형</span>
            <strong>{selectedTaskType?.name ?? "-"}</strong>
          </div>
          <div className="analysis-summary-card">
            <span>평가세트</span>
            <strong>{selectedRubric?.name ?? "-"}</strong>
          </div>
        </div>
        <label className="check-row ai-diagnosis-check">
          <input type="checkbox" checked={assignmentBaselines.some((baseline) => baseline.enabled)} readOnly />
          <span>AI Diagnosis 사용</span>
        </label>
        <p className="muted">{selectedAssignment?.description ?? "과제 설명이 없습니다."}</p>
        <div className="form-grid compact-form">
          <label className="field">
            <span>Type</span>
            <select
              value={aiType}
              onChange={(event) => {
                const nextType = event.target.value;
                setAiType(nextType);
                setAiModelName(defaultAiModels[nextType]?.[0] ?? "직접 입력");
              }}
            >
              {[...defaultAiTypes, "직접 입력"].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {aiType === "직접 입력" ? (
            <label className="field">
              <span>새 Type</span>
              <input value={customType} onChange={(event) => setCustomType(event.target.value)} />
            </label>
          ) : null}
          <label className="field">
            <span>Model</span>
            <select value={aiModelName} onChange={(event) => setAiModelName(event.target.value)}>
              {[...modelOptions, "직접 입력"].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          {aiModelName === "직접 입력" ? (
            <label className="field">
              <span>새 Model</span>
              <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} />
            </label>
          ) : null}
        </div>
        <button className="primary-button" onClick={confirmAddBaseline}>
          <Plus size={16} />
          Baseline 추가
        </button>
      </article>

      <article className="panel similarity-list-panel">
        <h2>AI Baselines</h2>
        <div className="similarity-list">
          {assignmentBaselines.length === 0 ? <p className="muted">등록된 AI Baseline이 없습니다.</p> : null}
          {assignmentBaselines.map((baseline) => (
            <button
              className={selectedBaseline?.id === baseline.id ? "similarity-row selected" : "similarity-row"}
              key={baseline.id}
              onClick={() => setSelectedBaselineId(baseline.id)}
            >
              <div>
                <strong>
                  {baseline.type} · {baseline.model}
                </strong>
                <span>{baseline.enabled ? "사용" : "미사용"} · {baseline.text.trim() ? "본문 입력됨" : "본문 없음"}</span>
              </div>
              <b>{baseline.text.length}</b>
            </button>
          ))}
        </div>
      </article>

      <article className="panel similarity-detail-panel">
        {selectedBaseline ? (
          <>
            <div className="panel-title">
              <div>
                <h2>{selectedBaseline.type} · {selectedBaseline.model}</h2>
                <p className="muted">AI Baseline 텍스트를 붙여넣으세요.</p>
              </div>
              <button className="danger-button" onClick={() => deleteBaseline(selectedBaseline.id)}>
                삭제
              </button>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={selectedBaseline.enabled}
                onChange={() => updateBaseline({ ...selectedBaseline, enabled: !selectedBaseline.enabled })}
              />
              <span>이 Baseline 사용</span>
            </label>
            <label className="field full">
              <span>Baseline Text</span>
              <textarea
                className="report-editor"
                value={selectedBaseline.text}
                onChange={(event) => updateBaseline({ ...selectedBaseline, text: event.target.value })}
                placeholder="선택한 AI 모델이 과제 내용으로 생성한 결과를 붙여넣으세요."
              />
            </label>
          </>
        ) : (
          <p className="muted">왼쪽에서 Baseline을 선택하거나 새로 추가하세요.</p>
        )}
      </article>
    </section>
  );
}

function AiGeneratedScore({
  assignments,
  submissions,
  baselines,
  results,
  runDiagnosis,
}: {
  assignments: Assignment[];
  submissions: Submission[];
  baselines: AiBaseline[];
  results: AiGeneratedResult[];
  runDiagnosis: (assignmentId: string) => void;
}) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? assignments[0];
  const assignmentSubmissions = submissions.filter((submission) => submission.assignmentId === selectedAssignment?.id);
  const assignmentBaselines = baselines.filter(
    (baseline) => baseline.assignmentId === selectedAssignment?.id && baseline.enabled && baseline.text.trim()
  );
  const modelColumns = assignmentBaselines.slice(0, 6);
  const result = results.find((item) => item.assignmentId === selectedAssignment?.id);
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false);

  function handleRunDiagnosis() {
    if (!selectedAssignment || isRunningDiagnosis) return;
    setIsRunningDiagnosis(true);
    window.setTimeout(() => {
      runDiagnosis(selectedAssignment.id);
      setIsRunningDiagnosis(false);
    }, 50);
  }

  return (
    <article className="panel">
      <div className="panel-title">
        <div>
          <h2>AI Generated Score</h2>
          <p className="muted">학생 제출물과 AI Baseline의 유사도를 모델별로 비교합니다.</p>
        </div>
        <button
          className="primary-button"
          disabled={!selectedAssignment || assignmentSubmissions.length === 0 || assignmentBaselines.length === 0 || isRunningDiagnosis}
          onClick={handleRunDiagnosis}
        >
          {isRunningDiagnosis ? <span className="button-spinner" /> : <BrainCircuit size={16} />}
          {isRunningDiagnosis ? "처리 중" : "AI 진단 실행"}
        </button>
      </div>
      <div className="form-grid compact-form">
        <label className="field">
          <span>과제</span>
          <select value={selectedAssignment?.id ?? ""} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
        </label>
        <div className="analysis-summary-card">
          <span>제출물</span>
          <strong>{assignmentSubmissions.length}개</strong>
        </div>
        <div className="analysis-summary-card">
          <span>AI Baseline</span>
          <strong>{assignmentBaselines.length}개</strong>
        </div>
      </div>
      <div className="ai-score-table">
        <div className="ai-score-head">
          <span>학생</span>
          <span>평균</span>
          {modelColumns.map((baseline) => (
            <span key={baseline.id}>{modelColumnLabel(baseline)}</span>
          ))}
        </div>
        {assignmentSubmissions.map((submission) => {
          const score = result?.scores.find((item) => item.submissionId === submission.id);
          return (
            <div className="ai-score-row" key={submission.id}>
              <strong>{submission.studentName}</strong>
              <ScoreBadge score={score?.averageScore} />
              {modelColumns.map((baseline) => {
                const modelScore = score?.modelScores.find((item) => item.baselineId === baseline.id);
                return <ScoreBadge key={baseline.id} score={modelScore?.score} />;
              })}
              <div className="model-group-list legacy-model-group-list">
                {score?.modelScores.length ? (
                  Object.entries(groupModelScores(score.modelScores)).map(([type, modelScores]) => (
                    <div className="model-group" key={type}>
                      <strong>{type}</strong>
                      <div>
                        {modelScores.map((modelScore) => (
                          <span className={`model-score-chip ${scoreTone(modelScore.score)}`} key={modelScore.baselineId}>
                            {modelScore.model} {modelScore.score}%
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="muted">아직 진단 결과가 없습니다.</span>
                )}
              </div>
              <span>
                {score?.modelScores.length
                  ? score.modelScores.map((modelScore) => `${modelScore.type}/${modelScore.model}: ${modelScore.score}%`).join(" · ")
                  : "아직 진단 결과가 없습니다."}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Evaluations({
  evaluations,
  submissions,
  assignments,
  similarityAnalyses,
  aiGeneratedResults,
  finalizeEvaluation,
  updateEvaluations,
  runRubrixTuning,
  recordEvaluationEdit,
}: {
  evaluations: Evaluation[];
  submissions: Submission[];
  assignments: Assignment[];
  similarityAnalyses: SimilarityAnalysis[];
  aiGeneratedResults: AiGeneratedResult[];
  finalizeEvaluation: (evaluationId: string) => void;
  updateEvaluations: React.Dispatch<React.SetStateAction<Evaluation[]>>;
  runRubrixTuning: (assignmentId: string) => void;
  recordEvaluationEdit: (action: string, targetType: string, message: string, targetId?: string) => void;
}) {
  const pendingEvaluations = evaluations.filter((evaluation) => evaluation.status !== "finalized");
  const [selectedAssignmentFilterId, setSelectedAssignmentFilterId] = useState(assignments[0]?.id ?? "");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(pendingEvaluations[0]?.id ?? "");
  const [isRunningTuning, setIsRunningTuning] = useState(false);
  const selectedFilterAssignment =
    assignments.find((assignment) => assignment.id === selectedAssignmentFilterId) ?? assignments[0];
  const filteredPendingEvaluations = pendingEvaluations.filter((evaluation) => {
    const submission = submissions.find((item) => item.id === evaluation.submissionId);
    return !selectedFilterAssignment || submission?.assignmentId === selectedFilterAssignment.id;
  });
  const selectedEvaluation =
    filteredPendingEvaluations.find((evaluation) => evaluation.id === selectedEvaluationId) ?? filteredPendingEvaluations[0];
  const selectedSubmission = submissions.find((submission) => submission.id === selectedEvaluation?.submissionId);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedSubmission?.assignmentId);
  const similaritySummary = similarityAnalyses
    .find((analysis) => analysis.assignmentId === selectedAssignment?.id)
    ?.submissionSummaries?.find((summary) => summary.submissionId === selectedSubmission?.id);
  const aiGeneratedScore = aiGeneratedResults
    .find((result) => result.assignmentId === selectedAssignment?.id)
    ?.scores.find((score) => score.submissionId === selectedSubmission?.id);
  const groupedAiGeneratedScores = groupModelScores(aiGeneratedScore?.modelScores ?? []);
  const evaluationModelColumns = (aiGeneratedScore?.modelScores ?? []).slice(0, 6);

  useEffect(() => {
    if (!selectedAssignmentFilterId && assignments[0]?.id) {
      setSelectedAssignmentFilterId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentFilterId]);

  useEffect(() => {
    const hasSelectedEvaluation = filteredPendingEvaluations.some((evaluation) => evaluation.id === selectedEvaluationId);
    if (!hasSelectedEvaluation && filteredPendingEvaluations[0]?.id) {
      setSelectedEvaluationId(filteredPendingEvaluations[0].id);
    }
    if (!filteredPendingEvaluations.length && selectedEvaluationId) {
      setSelectedEvaluationId("");
    }
  }, [selectedAssignmentFilterId, pendingEvaluations.length, selectedEvaluationId]);

  function handleRunRubrixTuning() {
    if (isRunningTuning || !selectedFilterAssignment) return;
    setIsRunningTuning(true);
    window.setTimeout(() => {
      runRubrixTuning(selectedFilterAssignment.id);
      setIsRunningTuning(false);
    }, 50);
  }

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
    if (field === "totalScore") {
      const previousScore = evaluations.find((evaluation) => evaluation.id === evaluationId)?.totalScore;
      recordEvaluationEdit("edit_score", "evaluation", `최종조정점수 변경: ${previousScore ?? "-"}점 → ${value}점`, evaluationId);
    }
  }

  if (selectedEvaluation) {
    return (
      <section className="reports-layout">
        <article className="panel">
          <h2>Evaluations</h2>
          <label className="field compact-assignment-filter">
            <span>과제</span>
            <select value={selectedFilterAssignment?.id ?? ""} onChange={(event) => setSelectedAssignmentFilterId(event.target.value)}>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </label>
          <div className="compact-report-list">
            {filteredPendingEvaluations.map((evaluation) => {
              const submission = submissions.find((item) => item.id === evaluation.submissionId);
              return (
                <button
                  className={selectedEvaluation.id === evaluation.id ? "compact-report-row selected" : "compact-report-row"}
                  key={evaluation.id}
                  onClick={() => setSelectedEvaluationId(evaluation.id)}
                >
                  <strong>{submission?.studentName ?? "알 수 없는 학생"}</strong>
                  <span>{evaluation.totalScore}점</span>
                  <span>{statusLabel(evaluation.status)}</span>
                  <span>{submission?.studentIdentifier ?? "-"}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel report-detail-panel">
          <div className="panel-title">
            <div>
              <h2>{selectedSubmission?.studentName ?? "알 수 없는 학생"}</h2>
              <p className="muted">{selectedAssignment?.title ?? "-"}</p>
            </div>
            <div className="panel-actions">
              <button className="secondary-button" type="button" disabled={isRunningTuning} onClick={handleRunRubrixTuning}>
                {isRunningTuning ? <span className="button-spinner" /> : <Sparkles size={16} />}
                {isRunningTuning ? "처리 중" : "Rubrix Tuning"}
              </button>
              <button className="secondary-button" onClick={() => finalizeEvaluation(selectedEvaluation.id)}>
                <CheckCircle2 size={16} />
                평가완료
              </button>
            </div>
          </div>
          <div className="evaluation-score-row primary-score-row">
            <div><span>AI 평가점수</span><strong>{selectedEvaluation.aiEvaluationScore ?? selectedEvaluation.totalScore}</strong></div>
            <div><span>AI Normalized Score</span><strong>{selectedEvaluation.aiNormalizedScore ?? "-"}</strong></div>
            <div><span>AI Generated</span><ScoreBadge score={aiGeneratedScore?.averageScore} /></div>
            <div><span>Analysis 종합</span><ScoreBadge score={similaritySummary?.score} /></div>
          </div>
          <div className="evaluation-score-row similarity-score-row">
            <div><span>문장일치</span><ScoreBadge score={similaritySummary?.exactScore} /></div>
            <div><span>문장유사</span><ScoreBadge score={similaritySummary?.sentenceScore} /></div>
            <div><span>문단유사</span><ScoreBadge score={similaritySummary?.paragraphScore} /></div>
            <div><span>구조유사</span><ScoreBadge score={similaritySummary?.structureScore} /></div>
          </div>
          <div className="evaluation-model-groups">
            <div className="evaluation-model-score-grid">
              {evaluationModelColumns.map((modelScore) => (
                <div key={modelScore.baselineId}>
                  <span>{modelScore.type}</span>
                  <strong>{modelScore.model}</strong>
                  <ScoreBadge score={modelScore.score} />
                </div>
              ))}
            </div>
            <div className="legacy-model-group-list">
            {aiGeneratedScore?.modelScores.length ? (
              Object.entries(groupedAiGeneratedScores).map(([type, modelScores]) => (
                <div className="model-group" key={type}>
                  <strong>{type}</strong>
                  <div>
                    {modelScores.map((modelScore) => (
                      <span className={`model-score-chip ${scoreTone(modelScore.score)}`} key={modelScore.baselineId}>
                        {modelScore.model} {modelScore.score}%
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <span className="muted">AI Generated Score 결과가 없습니다.</span>
            )}
            </div>
          </div>
          <div className="tuning-score-row">
            <label className="field score-field">
              <span>최종조정점수</span>
              <input
                min="0"
                max="100"
                type="number"
                value={selectedEvaluation.totalScore}
                onChange={(event) => updateEvaluation(selectedEvaluation.id, "totalScore", event.target.value)}
              />
            </label>
            <div className="rubrix-tuning-box">
              <span>Rubrix Tuning Score</span>
              <strong>
                {selectedEvaluation.rubrixTuningScore === undefined
                  ? "-"
                  : `${selectedEvaluation.rubrixTuningScore}점`}
              </strong>
              {selectedEvaluation.rubrixTuningDelta !== undefined ? (
                <small>
                  {selectedEvaluation.rubrixTuningDelta > 0 ? "+" : ""}
                  {selectedEvaluation.rubrixTuningDelta}점 · {selectedEvaluation.rubrixTuningNote}
                </small>
              ) : (
                <small>상단의 Rubrix Tuning을 눌러 과제 단위로 계산하세요.</small>
              )}
            </div>
          </div>
          <div className="evaluation-score-strip legacy-evaluation-score-strip">
            <div><span>AI 평가점수</span><strong>{selectedEvaluation.aiEvaluationScore ?? selectedEvaluation.totalScore}</strong></div>
            <div><span>AI Generated</span><strong>{aiGeneratedScore ? `${aiGeneratedScore.averageScore}%` : "-"}</strong></div>
            <div><span>Analysis 종합</span><strong>{similaritySummary ? `${similaritySummary.score}%` : "-"}</strong></div>
            <div><span>문장일치</span><strong>{similaritySummary ? `${similaritySummary.exactScore}%` : "-"}</strong></div>
            <div><span>문장유사</span><strong>{similaritySummary ? `${similaritySummary.sentenceScore}%` : "-"}</strong></div>
            <div><span>문단유사</span><strong>{similaritySummary ? `${similaritySummary.paragraphScore}%` : "-"}</strong></div>
            <div><span>구조유사</span><strong>{similaritySummary ? `${similaritySummary.structureScore}%` : "-"}</strong></div>
          </div>
          {aiGeneratedScore?.modelScores.length ? (
            <div className="model-score-list">
              {aiGeneratedScore.modelScores.map((modelScore) => (
                <span key={modelScore.baselineId}>
                  {modelScore.type}/{modelScore.model}: {modelScore.score}%
                </span>
              ))}
            </div>
          ) : null}
          <label className="field score-field">
            <span>최종 조정 점수</span>
            <input
              min="0"
              max="100"
              type="number"
              value={selectedEvaluation.totalScore}
              onChange={(event) => updateEvaluation(selectedEvaluation.id, "totalScore", event.target.value)}
            />
          </label>
          <label className="field">
            <span>피드백</span>
            <textarea
              value={selectedEvaluation.feedback}
              onChange={(event) => updateEvaluation(selectedEvaluation.id, "feedback", event.target.value)}
            />
          </label>
          <label className="field">
            <span>학생용 보고서</span>
            <textarea
              className="report-editor"
              value={selectedEvaluation.studentReport}
              onChange={(event) => updateEvaluation(selectedEvaluation.id, "studentReport", event.target.value)}
            />
          </label>
        </article>
      </section>
    );
  }

  return (
    <section className="reports-layout">
      <article className="panel">
        <h2>Evaluations</h2>
        <label className="field compact-assignment-filter">
          <span>과제</span>
          <select value={selectedFilterAssignment?.id ?? ""} onChange={(event) => setSelectedAssignmentFilterId(event.target.value)}>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">선택한 과제에 검토할 AI완료 평가가 없습니다. 최종 확정된 결과는 Reports에서 확인하세요.</p>
      </article>
      <article className="panel report-detail-panel">
        <p className="muted">왼쪽 과제 필터에서 검토할 과제를 선택하세요.</p>
      </article>
    </section>
  );
}

const similarityModeLabels: Record<SimilarityMode, string> = {
  exact: "Exact Match",
  sentence: "Sentence Similarity",
  paragraph: "Paragraph Similarity",
  structure: "Structure Similarity",
};

const similarityModeDescriptions: Record<SimilarityMode, string> = {
  exact: "완전히 같은 문장을 찾습니다.",
  sentence: "표현이 조금 달라도 비슷한 문장을 찾습니다.",
  paragraph: "문단 단위의 내용 유사성을 봅니다.",
  structure: "문단 길이와 전개 순서의 유사성을 봅니다.",
};

function similarityRiskLabel(score: number) {
  if (score >= 70) return "강한 검토 필요";
  if (score >= 50) return "검토 필요";
  if (score >= 30) return "참고 확인";
  return "낮음";
}

function scoreTone(score?: number) {
  if (score === undefined || Number.isNaN(score)) return "score-empty";
  if (score <= 20) return "score-green";
  if (score <= 40) return "score-blue";
  if (score < 60) return "score-orange";
  return "score-red";
}

function ScoreBadge({ score }: { score?: number }) {
  return <span className={`score-badge ${scoreTone(score)}`}>{score === undefined ? "-" : `${score}%`}</span>;
}

function groupModelScores(modelScores: AiGeneratedModelScore[] = []) {
  return modelScores.reduce<Record<string, AiGeneratedModelScore[]>>((groups, modelScore) => {
    groups[modelScore.type] = [...(groups[modelScore.type] ?? []), modelScore];
    return groups;
  }, {});
}

function modelColumnLabel(baseline: AiBaseline) {
  return `${baseline.type}\n${baseline.model}`;
}

const safeDefaults = {
  maxScore: 100,
  epsilon: 0.001,
  k: 1,
  rho: 0.15,
  lambda: 0.5,
  theta: 0.3,
  wA: 0.15,
  wInt: 0.5,
  hardCap: 8,
  beta: {
    exact: 0.35,
    sentence: 0.3,
    paragraph: 0.2,
    structure: 0.15,
  },
};

type SafeSignal = {
  evaluationId: string;
  baseScore: number;
  aiEvaluationScore: number;
  exact?: number;
  sentence?: number;
  paragraph?: number;
  structure?: number;
  modelScores: Record<string, number>;
};

type SafeTuningResult = {
  evaluationId: string;
  score: number;
  delta: number;
  note: string;
};

function clampScore(value: number, min = 0, max = safeDefaults.maxScore) {
  return Math.max(min, Math.min(max, value));
}

function logitScore(value: number) {
  const score = clampScore(value);
  return Math.log((score + safeDefaults.epsilon) / (safeDefaults.maxScore - score + safeDefaults.epsilon));
}

function mean(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function zScores<T extends string>(
  items: { id: T; value?: number }[],
  transform: (value: number) => number = (value) => value
) {
  const validItems = items.filter((item): item is { id: T; value: number } => item.value !== undefined);
  const transformedValues = validItems.map((item) => transform(item.value));
  const average = mean(transformedValues);
  const deviation = standardDeviation(transformedValues);
  const scores = new Map<T, number>();

  validItems.forEach((item, index) => {
    scores.set(item.id, deviation === 0 ? 0 : (transformedValues[index] - average) / deviation);
  });

  return scores;
}

function calculateSafeTuning(signals: SafeSignal[]) {
  const zBaseScore = zScores(signals.map((signal) => ({ id: signal.evaluationId, value: signal.baseScore })));
  const zExact = zScores(
    signals.map((signal) => ({ id: signal.evaluationId, value: signal.exact })),
    logitScore
  );
  const zSentence = zScores(
    signals.map((signal) => ({ id: signal.evaluationId, value: signal.sentence })),
    logitScore
  );
  const zParagraph = zScores(
    signals.map((signal) => ({ id: signal.evaluationId, value: signal.paragraph })),
    logitScore
  );
  const zStructure = zScores(
    signals.map((signal) => ({ id: signal.evaluationId, value: signal.structure })),
    logitScore
  );
  const modelIds = [...new Set(signals.flatMap((signal) => Object.keys(signal.modelScores)))].slice(0, 6);
  const zModelScores = new Map(
    modelIds.map((modelId) => [
      modelId,
      zScores(
        signals.map((signal) => ({ id: signal.evaluationId, value: signal.modelScores[modelId] })),
        logitScore
      ),
    ])
  );
  const baseRows = signals.map((signal) => {
    const zText =
      safeDefaults.beta.exact * (zExact.get(signal.evaluationId) ?? 0) +
      safeDefaults.beta.sentence * (zSentence.get(signal.evaluationId) ?? 0) +
      safeDefaults.beta.paragraph * (zParagraph.get(signal.evaluationId) ?? 0) +
      safeDefaults.beta.structure * (zStructure.get(signal.evaluationId) ?? 0);
    const modelZValues = modelIds.map((modelId) => zModelScores.get(modelId)?.get(signal.evaluationId) ?? 0);
    const zAiMean = modelZValues.length ? mean(modelZValues) : 0;
    const zAiMax = modelZValues.length ? Math.max(...modelZValues) : 0;
    const zAi = (1 - safeDefaults.theta) * zAiMean + safeDefaults.theta * zAiMax;
    const zSim = safeDefaults.lambda * zText + (1 - safeDefaults.lambda) * zAi;
    const zBaseValue = zBaseScore.get(signal.evaluationId) ?? 0;

    return {
      ...signal,
      zBaseScore: zBaseValue,
      zSim,
      zIntRaw: Math.max(zBaseValue, 0) * Math.max(zSim, 0),
    };
  });
  const zInt = zScores(baseRows.map((row) => ({ id: row.evaluationId, value: row.zIntRaw })));

  return baseRows.map<SafeTuningResult>((row) => {
    const zS = row.zSim + safeDefaults.wA * row.zBaseScore + safeDefaults.wInt * (zInt.get(row.evaluationId) ?? 0);
    const kernel = -Math.tanh(safeDefaults.k * zS);
    const rawScore =
      row.baseScore +
      safeDefaults.rho *
        (Math.max(kernel, 0) * (safeDefaults.maxScore - row.baseScore) + Math.min(kernel, 0) * row.baseScore);
    const rawDelta = rawScore - row.baseScore;
    const cappedDelta = Math.max(-safeDefaults.hardCap, Math.min(safeDefaults.hardCap, rawDelta));
    const tunedScore = clampScore(row.baseScore + cappedDelta);
    const notes = [
      signals.length < 30 ? "소규모 코호트라 참고용으로 사용하세요." : "코호트 기준 보정값입니다.",
      Math.abs(rawDelta) > safeDefaults.hardCap ? `하드캡 ±${safeDefaults.hardCap}점 적용` : "",
    ].filter(Boolean);

    return {
      evaluationId: row.evaluationId,
      score: Math.round(tunedScore * 10) / 10,
      delta: Math.round(cappedDelta * 10) / 10,
      note: notes.join(" · "),
    };
  });
}

function splitRawParagraphs(value: string) {
  return value
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitRawSentences(value: string) {
  const sentences = value.match(/[^.!?。！？\n]+[.!?。！？]?/gu) ?? [value];
  return sentences.map((item) => item.trim()).filter(Boolean);
}

function HighlightedReport({
  text,
  pair,
  modes,
}: {
  text: string;
  pair: SimilarityPair;
  modes: SimilarityMode[];
}) {
  const exactSet = new Set(pair.matchedPhrases);
  const sentenceSet = new Set(pair.similarSentences ?? []);
  const paragraphSet = new Set(pair.similarParagraphs ?? []);
  const structureSet = new Set(pair.structureParagraphIndexes ?? []);
  const paragraphs = splitRawParagraphs(text);

  return (
    <div className="report-text-box highlighted-report-box">
      {paragraphs.map((paragraph, paragraphIndex) => {
        const normalizedParagraph = normalizeText(paragraph);
        const paragraphClasses = [
          "highlight-paragraph",
          modes.includes("paragraph") && paragraphSet.has(normalizedParagraph) ? "paragraph-similar" : "",
          modes.includes("structure") && structureSet.has(paragraphIndex) ? "structure-similar" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const sentences = splitRawSentences(paragraph);

        return (
          <p className={paragraphClasses} key={`${paragraphIndex}-${normalizedParagraph.slice(0, 20)}`}>
            {sentences.map((sentence, sentenceIndex) => {
              const normalizedSentence = normalizeText(sentence);
              const sentenceClass =
                modes.includes("exact") && exactSet.has(normalizedSentence)
                  ? "highlight-sentence exact-similar"
                  : modes.includes("sentence") && sentenceSet.has(normalizedSentence)
                    ? "highlight-sentence sentence-similar"
                    : "highlight-sentence";

              return (
                <span className={sentenceClass} key={`${sentenceIndex}-${normalizedSentence.slice(0, 20)}`}>
                  {sentence}
                  {sentenceIndex < sentences.length - 1 ? " " : ""}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

function Analysis({
  analyses,
  assignments,
  submissions,
  runSimilarityAnalysis,
}: {
  analyses: SimilarityAnalysis[];
  assignments: Assignment[];
  submissions: Submission[];
  runSimilarityAnalysis: (assignmentId: string, modes: SimilarityMode[]) => void;
}) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const [selectedModes, setSelectedModes] = useState<SimilarityMode[]>([
    "exact",
    "sentence",
    "paragraph",
    "structure",
  ]);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? assignments[0];
  const assignmentSubmissions = submissions.filter((submission) => submission.assignmentId === selectedAssignment?.id);
  const analysis = analyses.find((item) => item.assignmentId === selectedAssignment?.id);
  const [selectedPairId, setSelectedPairId] = useState(analysis?.pairs[0]?.id ?? "");
  const selectedPair = analysis?.pairs.find((pair) => pair.id === selectedPairId) ?? analysis?.pairs[0];
  const selectedLeft = submissions.find((submission) => submission.id === selectedPair?.submissionAId);
  const selectedRight = submissions.find((submission) => submission.id === selectedPair?.submissionBId);
  const analysisModes = analysis?.modes ?? [];

  useEffect(() => {
    if (!selectedAssignmentId && assignments[0]?.id) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    setSelectedPairId(analysis?.pairs[0]?.id ?? "");
  }, [analysis?.id]);

  function toggleMode(mode: SimilarityMode) {
    setSelectedModes((current) =>
      current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]
    );
  }

  function runAnalysis() {
    if (!selectedAssignment || selectedModes.length === 0 || assignmentSubmissions.length < 2 || isRunningAnalysis) return;
    setIsRunningAnalysis(true);
    window.setTimeout(() => {
      runSimilarityAnalysis(selectedAssignment.id, selectedModes);
      setIsRunningAnalysis(false);
    }, 50);
  }

  return (
    <section className="analysis-layout">
      <article className="panel analysis-control-panel">
        <div className="panel-title">
          <div>
            <h2>유사도 분석</h2>
            <p className="muted">같은 과제의 제출물을 서로 비교합니다.</p>
          </div>
          <button
            className="primary-button"
            disabled={assignmentSubmissions.length < 2 || selectedModes.length === 0 || isRunningAnalysis}
            onClick={runAnalysis}
          >
            {isRunningAnalysis ? <span className="button-spinner" /> : <SearchCheck size={16} />}
            {isRunningAnalysis ? "처리 중" : "분석 실행"}
          </button>
        </div>
        <div className="form-grid compact-form">
          <label className="field">
            <span>과제</span>
            <select value={selectedAssignment?.id ?? ""} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </label>
          <div className="analysis-summary-card">
            <span>제출물</span>
            <strong>{assignmentSubmissions.length}개</strong>
          </div>
          <div className="analysis-summary-card">
            <span>최근 분석</span>
            <strong>{analysis ? new Date(analysis.createdAt).toLocaleString("ko-KR") : "없음"}</strong>
          </div>
        </div>
          <div className="analysis-summary-card">
            <span>사용 기준</span>
            <strong>{analysis ? analysis.modes.map((mode) => similarityModeLabels[mode]).join(", ") : "없음"}</strong>
          </div>
        <div className="similarity-mode-grid">
          {(Object.keys(similarityModeLabels) as SimilarityMode[]).map((mode) => (
            <label className="similarity-mode" key={mode}>
              <input type="checkbox" checked={selectedModes.includes(mode)} onChange={() => toggleMode(mode)} />
              <span>
                <strong>{similarityModeLabels[mode]}</strong>
                <small>{similarityModeDescriptions[mode]}</small>
              </span>
            </label>
          ))}
        </div>
        {assignmentSubmissions.length < 2 ? (
          <p className="muted">유사도 분석은 같은 과제에 제출물이 2개 이상 있어야 실행할 수 있습니다.</p>
        ) : null}
      </article>

      <article className="panel similarity-list-panel">
        <div className="panel-title">
          <div>
            <h2>유사 제출물 쌍</h2>
            <p className="muted">상위 100개 결과를 높은 유사도 순으로 표시합니다.</p>
          </div>
        </div>
        {!analysis ? <p className="muted">아직 분석 결과가 없습니다.</p> : null}
        <div className="similarity-list">
          {analysis?.pairs.map((pair) => {
            const left = submissions.find((submission) => submission.id === pair.submissionAId);
            const right = submissions.find((submission) => submission.id === pair.submissionBId);
            return (
              <button
                className={selectedPair?.id === pair.id ? "similarity-row selected" : "similarity-row"}
                key={pair.id}
                onClick={() => setSelectedPairId(pair.id)}
              >
                <div>
                  <strong>
                    {left?.studentName ?? "-"} / {right?.studentName ?? "-"}
                  </strong>
                  <span>{similarityRiskLabel(pair.score)}</span>
                </div>
                <b>{pair.score}%</b>
              </button>
            );
          })}
        </div>
      </article>

      <article className="panel similarity-detail-panel">
        {selectedPair ? (
          <>
            <div className="panel-title">
              <div>
                <h2>비교 상세</h2>
                <p className="muted">
                  {selectedLeft?.studentName ?? "-"} 와 {selectedRight?.studentName ?? "-"}
                </p>
              </div>
              <span className="tag pending-tag">{similarityRiskLabel(selectedPair.score)}</span>
            </div>
            <div className="similarity-score-grid">
              <div>
                <span>종합</span>
                <strong>{selectedPair.score}%</strong>
              </div>
              <div>
                <span>문장 일치</span>
                <strong>{analysisModes.includes("exact") ? `${selectedPair.exactScore}%` : "-"}</strong>
              </div>
              <div>
                <span>문장 유사</span>
                <strong>{analysisModes.includes("sentence") ? `${selectedPair.sentenceScore}%` : "-"}</strong>
              </div>
              <div>
                <span>문단 유사</span>
                <strong>{analysisModes.includes("paragraph") ? `${selectedPair.paragraphScore}%` : "-"}</strong>
              </div>
              <div>
                <span>구조 유사</span>
                <strong>{analysisModes.includes("structure") ? `${selectedPair.structureScore}%` : "-"}</strong>
              </div>
            </div>
            <section className="report-detail-section">
              <h3>동일 문장 후보</h3>
              <div className="highlight-legend">
                {analysisModes.includes("exact") ? <span className="legend-exact">Exact Match</span> : null}
                {analysisModes.includes("sentence") ? <span className="legend-sentence">Sentence Similarity</span> : null}
                {analysisModes.includes("paragraph") ? <span className="legend-paragraph">Paragraph Similarity</span> : null}
                {analysisModes.includes("structure") ? <span className="legend-structure">Structure Similarity</span> : null}
              </div>
              {selectedPair.matchedPhrases.length > 0 ? (
                <div className="match-list">
                  {selectedPair.matchedPhrases.map((phrase) => (
                    <p key={phrase}>{phrase}</p>
                  ))}
                </div>
              ) : (
                <p className="muted">완전히 동일한 긴 문장은 확인되지 않았습니다.</p>
              )}
            </section>
            <section className="comparison-text-grid">
              <div>
                <h3>{selectedLeft?.studentName ?? "-"}</h3>
                <HighlightedReport text={selectedLeft?.reportText ?? ""} pair={selectedPair} modes={analysisModes} />
              </div>
              <div>
                <h3>{selectedRight?.studentName ?? "-"}</h3>
                <HighlightedReport text={selectedRight?.reportText ?? ""} pair={selectedPair} modes={analysisModes} />
              </div>
            </section>
          </>
        ) : (
          <p className="muted">왼쪽 목록에서 비교 결과를 선택하세요.</p>
        )}
      </article>
    </section>
  );
}

function Reports({
  evaluations,
  submissions,
  assignments,
  similarityAnalyses,
  aiGeneratedResults,
  reopenEvaluation,
}: {
  evaluations: Evaluation[];
  submissions: Submission[];
  assignments: Assignment[];
  similarityAnalyses: SimilarityAnalysis[];
  aiGeneratedResults: AiGeneratedResult[];
  reopenEvaluation: (evaluationId: string) => void;
}) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const selectedReportAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? assignments[0];
  const reportEvaluations = evaluations.filter((evaluation) => {
    const submission = submissions.find((item) => item.id === evaluation.submissionId);
    return evaluation.status === "finalized" && (!selectedReportAssignment || submission?.assignmentId === selectedReportAssignment.id);
  });
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(reportEvaluations[0]?.id ?? "");
  const selectedEvaluation =
    reportEvaluations.find((evaluation) => evaluation.id === selectedEvaluationId) ?? reportEvaluations[0];
  const selectedSubmission = submissions.find((submission) => submission.id === selectedEvaluation?.submissionId);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedSubmission?.assignmentId);
  const selectedSimilaritySummary = similarityAnalyses
    .find((analysis) => analysis.assignmentId === selectedAssignment?.id)
    ?.submissionSummaries?.find((summary) => summary.submissionId === selectedSubmission?.id);
  const selectedAiGeneratedScore = aiGeneratedResults
    .find((result) => result.assignmentId === selectedAssignment?.id)
    ?.scores.find((score) => score.submissionId === selectedSubmission?.id);

  useEffect(() => {
    if (!selectedAssignmentId && assignments[0]?.id) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    const hasSelectedEvaluation = reportEvaluations.some((evaluation) => evaluation.id === selectedEvaluationId);
    if (!hasSelectedEvaluation && reportEvaluations[0]?.id) {
      setSelectedEvaluationId(reportEvaluations[0].id);
    }
    if (!reportEvaluations.length && selectedEvaluationId) {
      setSelectedEvaluationId("");
    }
  }, [selectedAssignmentId, evaluations.length, selectedEvaluationId]);

  return (
    <section className="reports-layout">
      <article className="panel">
        <h2>평가 보고서</h2>
        <label className="field compact-assignment-filter">
          <span>과제</span>
          <select value={selectedReportAssignment?.id ?? ""} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
        </label>
        <div className="compact-report-list">
          <div className="compact-report-head report-head">
            <span>학생</span>
            <span>점수</span>
            <span>상태</span>
          </div>
          {reportEvaluations.length === 0 ? <p className="muted">아직 평가 보고서가 없습니다.</p> : null}
          {reportEvaluations.map((evaluation) => {
            const submission = submissions.find((item) => item.id === evaluation.submissionId);
            return (
              <button
                className={selectedEvaluation?.id === evaluation.id ? "compact-report-row report-row selected" : "compact-report-row report-row"}
                key={evaluation.id}
                onClick={() => setSelectedEvaluationId(evaluation.id)}
              >
                <strong>{submission?.studentName ?? "알 수 없음"}</strong>
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
              <button className="secondary-button" onClick={() => reopenEvaluation(selectedEvaluation.id)}>
                확정 해제
              </button>
            </div>
            <section className="report-detail-section">
              <h3>Rubrix Tuning 설명</h3>
              <div className="safe-explanation-box">
                <div><span>AI 원점수</span><strong>{selectedEvaluation.aiEvaluationScore ?? selectedEvaluation.totalScore}점</strong></div>
                <div><span>AI Normalized Score</span><strong>{selectedEvaluation.aiNormalizedScore ?? "-"}점</strong></div>
                <div><span>Rubrix Tuning Score</span><strong>{selectedEvaluation.rubrixTuningScore === undefined ? "-" : `${selectedEvaluation.rubrixTuningScore}점`}</strong></div>
                <div><span>보정폭</span><strong>{selectedEvaluation.rubrixTuningDelta === undefined ? "-" : `${selectedEvaluation.rubrixTuningDelta > 0 ? "+" : ""}${selectedEvaluation.rubrixTuningDelta}점`}</strong></div>
              </div>
              <p className="muted">
                {createSafeExplanation(selectedEvaluation, selectedSimilaritySummary, selectedAiGeneratedScore)}
              </p>
            </section>
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

function SafeModelGuide() {
  return (
    <section className="safe-guide">
      <article className="safe-hero">
        <div>
          <p className="eyebrow">Rubrix Tuning Mode</p>
          <h2>SAFE Model</h2>
          <p>
            SAFE는 Similarity and AI Footprint Evaluation Model의 약자입니다. AI 평가점수에 표절 유사도와
            AI 생성 유사도를 결합해, 동일 과제 제출자 집단 안에서 Rubrix Tuning Score를 계산합니다.
          </p>
        </div>
        <div className="safe-hero-metric">
          <span>출력</span>
          <strong>RTS</strong>
          <small>Rubrix Tuning Score</small>
        </div>
      </article>

      <div className="safe-grid">
        <article className="panel">
          <h2>모델 목적</h2>
          <p className="muted">
            SAFE는 학생의 부정행위를 단정하는 모델이 아니라, 평가자가 검토할 수 있는 점수 보정 신호를
            제공합니다. 기준은 절대 유사도가 아니라 같은 과제 코호트 내 상대 위치입니다.
          </p>
          <div className="safe-principles">
            {["코호트 상대성", "유계 보정", "로짓 변환", "품질×유사 상호작용", "단일 모델 과적합 탐지"].map(
              (item) => (
                <span key={item}>{item}</span>
              )
            )}
          </div>
        </article>

        <article className="panel">
          <h2>입력 신호</h2>
          <div className="safe-signal-list">
            <div>
              <strong>AINS</strong>
              <span>AI가 평가한 순수 평가점수</span>
            </div>
            <div>
              <strong>ST · SP · PP · FP</strong>
              <span>문장일치, 문장유사, 문단유사, 구조유사</span>
            </div>
            <div>
              <strong>AI Footprint</strong>
              <span>최대 6개 AI Baseline 모델과의 유사도</span>
            </div>
          </div>
        </article>
      </div>

      <article className="panel">
        <div className="panel-title">
          <div>
            <h2>계산 흐름</h2>
            <p className="muted">Rubrix Tuning 버튼을 누르면 선택된 과제의 미확정 평가 결과를 코호트로 계산합니다.</p>
          </div>
        </div>
        <div className="safe-flow">
          {[
            ["1", "신호 표준화", "유사도 신호는 로짓 변환 후 z-score로 변환합니다."],
            ["2", "유사도 위험 합성", "텍스트 위험과 AI 위험을 각각 계산합니다."],
            ["3", "품질×유사 상호작용", "고품질이면서 고유사인 경우 추가 위험으로 봅니다."],
            ["4", "복합 위험 지수", "Z_sim, AIES, 상호작용 항을 결합합니다."],
            ["5", "조정 커널", "g = -tanh(k · Z_S)로 보정 방향과 강도를 정합니다."],
            ["6", "RTS 계산", "잔여 여유분 기반으로 가점·감점을 제한합니다."],
            ["7", "가드레일", "소규모 코호트 경고와 최종 하드캡을 적용합니다."],
          ].map(([step, title, text]) => (
            <div className="safe-flow-step" key={step}>
              <b>{step}</b>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </article>

      <div className="safe-grid">
        <article className="panel">
          <h2>운영 기본값</h2>
          <div className="safe-table">
            <div><span>k</span><strong>1.0</strong><small>커널 기울기</small></div>
            <div><span>ρ</span><strong>0.15</strong><small>최대 조정 비율</small></div>
            <div><span>λ</span><strong>0.50</strong><small>표절 vs AI 균형</small></div>
            <div><span>θ</span><strong>0.30</strong><small>최유사 모델 반영</small></div>
            <div><span>w_int</span><strong>0.50</strong><small>품질×유사 상호작용</small></div>
            <div><span>Hard Cap</span><strong>±8</strong><small>최종 보정 상한</small></div>
          </div>
        </article>

        <article className="panel">
          <h2>운영 가드레일</h2>
          <ul className="safe-bullets">
            <li>권장 코호트 규모는 30명 이상입니다.</li>
            <li>30명 미만도 계산은 가능하지만 참고값으로 표시합니다.</li>
            <li>Rubrix Tuning Score는 최종 판정이 아니라 평가자 검토용 보정 신호입니다.</li>
            <li>최종조정점수, 피드백, 학생용 보고서는 평가자가 직접 확정합니다.</li>
          </ul>
        </article>
      </div>

      <article className="panel safe-formula-panel">
        <h2>핵심 수식</h2>
        <div className="safe-formulas">
          <code>Z_sim = λ·Z_text + (1−λ)·Z_ai</code>
          <code>Z_int = z(ReLU(z_AINS) · ReLU(Z_sim))</code>
          <code>Z_S = Z_sim + w_A·z_AINS + w_int·Z_int</code>
          <code>g = −tanh(k · Z_S)</code>
          <code>RTS = AINS + ρ·[max(g,0)(M−AINS) + min(g,0)AINS]</code>
        </div>
      </article>
      <SafeFullFormulaPanel />
    </section>
  );
}

function SafeFullFormulaPanel() {
  return (
    <article className="panel safe-formula-panel safe-full-formula-panel">
      <h2>SAFE Model Full Formula</h2>
      <p className="muted">
        아래 수식은 Rubrix Tuning Score가 계산되는 전체 흐름입니다. RTS는 최종점수를 자동 확정하는 값이 아니라,
        평가자가 최종조정점수를 검토할 때 참고하는 보정 신호입니다.
      </p>
      <div className="safe-formula-sections">
        <div>
          <h3>1. Input Signals</h3>
          <code>AIES_i = AI Evaluation Score of submission i</code>
          <code>AINS_i = AI Normalized Score of submission i</code>
          <code>ST_i = sentence exact-match similarity</code>
          <code>SP_i = sentence semantic similarity</code>
          <code>PP_i = paragraph similarity</code>
          <code>FP_i = structure similarity</code>
          <code>AF_i = average AI Baseline similarity across selected models</code>
        </div>
        <div>
          <h3>2. Text Similarity Integration</h3>
          <code>T_i = beta_ST * ST_i + beta_SP * SP_i + beta_PP * PP_i + beta_FP * FP_i</code>
          <code>beta_ST = 0.35, beta_SP = 0.30, beta_PP = 0.20, beta_FP = 0.15</code>
        </div>
        <div>
          <h3>3. Logit Transform and Z-score</h3>
          <code>L(x) = log((x + epsilon) / (100 - x + epsilon))</code>
          <code>Z_X_i = (L(X_i) - mean(L(X))) / sd(L(X))</code>
          <code>epsilon = 0.001</code>
        </div>
        <div>
          <h3>4. Combined Similarity Signal</h3>
          <code>Z_sim_i = lambda * Z_T_i + (1 - lambda) * Z_AF_i</code>
          <code>lambda = 0.50</code>
        </div>
        <div>
          <h3>5. High-Quality Similarity Interaction</h3>
          <code>Z_int_i = z(ReLU(Z_AINS_i) * ReLU(Z_sim_i))</code>
          <code>ReLU(x) = max(0, x)</code>
        </div>
        <div>
          <h3>6. SAFE Risk Signal</h3>
          <code>Z_S_i = Z_sim_i + w_A * Z_AINS_i + w_int * Z_int_i</code>
          <code>w_A = 0.15, w_int = 0.50</code>
        </div>
        <div>
          <h3>7. Adjustment Kernel</h3>
          <code>g_i = -tanh(k * Z_S_i)</code>
          <code>k = 1.0</code>
        </div>
        <div>
          <h3>8. Rubrix Tuning Score</h3>
          <code>RTS_raw_i = AINS_i + rho * [max(g_i, 0) * (100 - AINS_i) + min(g_i, 0) * AINS_i]</code>
          <code>rho = 0.15</code>
          <code>RTS_i = clamp(RTS_raw_i, AINS_i - 8, AINS_i + 8)</code>
          <code>RTS_i = clamp(RTS_i, 0, 100)</code>
        </div>
        <div>
          <h3>9. AI Normalized Score</h3>
          <code>if range(AIES) &lt; 30: target_min = mean(AIES) - 15</code>
          <code>target_max = mean(AIES) + 15</code>
          <code>AINS_i = target_min + ((AIES_i - min(AIES)) / range(AIES)) * 30</code>
          <code>if range(AIES) &gt;= 30: AINS_i = AIES_i</code>
          <code>Final adjustment score starts from AINS_i and can be edited by the evaluator.</code>
        </div>
      </div>
    </article>
  );
}

function UserManualGuide() {
  return (
    <section className="manual-guide">
      <article className="safe-hero manual-hero">
        <div>
          <p className="eyebrow">Rubrix User Manual</p>
          <h2>기본 사용설명서</h2>
          <p>
            Rubrix는 평가세트 설정, 과제 관리, 제출물 등록, AI 평가, 유사도 분석, SAFE 기반 Rubrix
            Tuning, 최종 보고서 확인까지 한 흐름으로 운영하는 리포트 평가 시스템입니다.
          </p>
        </div>
        <div className="safe-hero-metric">
          <span>권장 흐름</span>
          <strong>8</strong>
          <small>단계</small>
        </div>
      </article>

      <article className="panel">
        <h2>빠른 시작</h2>
        <div className="manual-steps">
          {[
            ["1", "Rubric Sets", "평가세트와 카테고리별 배점을 확인하고 필요하면 배점 수정으로 조정합니다."],
            ["2", "Assignments", "과제명, 과제유형, 설명, 사용할 평가세트를 등록합니다."],
            ["3", "AI Diagnosis", "과제별 AI Baseline을 만들고 모델별 기준 답안을 붙여 넣습니다."],
            ["4", "Submissions", "학생 제출물을 모두 등록한 뒤 과제 단위로 일괄 AI 평가를 실행합니다."],
            ["5", "AI Generated Score", "학생 제출물과 AI Baseline의 유사도를 과제 단위로 일괄 계산합니다."],
            ["6", "Analysis", "같은 과제 제출물끼리 문장일치, 문장유사, 문단유사, 구조유사를 분석합니다."],
            ["7", "Evaluations", "AI 점수, AI Normalized Score, 유사도, Rubrix Tuning Score를 보고 최종확정합니다."],
            ["8", "Reports", "최종확정된 피드백과 학생용 보고서를 과제별로 확인합니다."],
          ].map(([step, title, text]) => (
            <div className="manual-step" key={step}>
              <b>{step}</b>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </article>

      <div className="manual-grid">
        <article className="panel">
          <h2>1. 평가세트 준비</h2>
          <p className="muted">
            `Rubric Sets`에서 평가 기준과 배점을 관리합니다. 기본 구조는 공통 평가 80점과 과제유형별
            추가 평가 20점이지만, 각 카테고리의 배점은 합계 100점 기준으로 수정할 수 있습니다.
          </p>
          <ul className="safe-bullets">
            <li>평가항목 사용 여부를 체크해 실제 평가에 반영할 항목을 정합니다.</li>
            <li>배점은 `배점 수정`을 누른 뒤 수정하고, 합계가 100점일 때 확정합니다.</li>
            <li>페르소나, 공통기준, 중요한 원칙은 AI 평가 프롬프트의 기본 방향이 됩니다.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>2. 과제 만들기</h2>
          <p className="muted">
            `Assignments`에서 실제 평가할 과제를 만듭니다. 한 평가자가 여러 과제를 관리할 수 있으므로,
            이후 AI Diagnosis, Submissions, Analysis, Evaluations, Reports는 과제 선택을 기준으로 운영됩니다.
          </p>
          <ul className="safe-bullets">
            <li>과제명은 학생 제출물을 구분하는 가장 중요한 기준입니다.</li>
            <li>과제유형은 기본 목록에서 선택하거나 새 유형을 추가할 수 있습니다.</li>
            <li>과제 설명에는 평가자가 AI에 참고시키고 싶은 과제 지시문을 적는 것이 좋습니다.</li>
            <li>기존 과제는 `수정`을 누른 뒤 변경하고, `확정`을 눌러 저장합니다.</li>
            <li>과제 목록은 오름차순 또는 내림차순으로 정렬할 수 있습니다.</li>
          </ul>
        </article>
      </div>

      <div className="manual-grid">
        <article className="panel">
          <h2>3. AI Diagnosis와 Baseline</h2>
          <p className="muted">
            `AI Diagnosis`는 AI가 작성했을 가능성을 참고하기 위한 기준 답안 보관소입니다. ChatGPT, Claude,
            Gemini 등에서 같은 과제 지시문으로 만든 답안을 모델별 Baseline으로 붙여 넣습니다.
          </p>
          <ul className="safe-bullets">
            <li>최대 6개 모델을 기준으로 운영하는 것을 권장합니다.</li>
            <li>Baseline은 과제별로 관리됩니다.</li>
            <li>사용하지 않을 Baseline은 비활성화하거나 삭제할 수 있습니다.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>4. 제출물 등록과 AI 평가</h2>
          <p className="muted">
            `Submissions`에서 과제를 선택하고 학생별 제출물을 모두 등록합니다. PDF 업로드 또는 텍스트 붙여넣기를
            사용할 수 있으며, 등록이 끝난 뒤 `일괄 AI 평가`로 선택한 과제 전체를 한 번에 평가합니다.
          </p>
          <ul className="safe-bullets">
            <li>같은 과제의 제출물은 반드시 같은 과제로 등록해야 이후 비교분석이 정확합니다.</li>
            <li>개별 평가 버튼은 사용하지 않고 과제 단위 일괄 평가만 사용합니다.</li>
            <li>이미 평가된 과제를 다시 일괄 평가하면 기존 결과를 새 결과로 덮어쓰며, 점수 이력은 저장하지 않습니다.</li>
            <li>평가 실행 중에는 로딩 표시가 나타나고, 완료 후에도 화면은 Submissions에 머뭅니다.</li>
            <li>제출물 목록은 오름차순 또는 내림차순으로 정렬할 수 있습니다.</li>
            <li>제출물을 삭제하면 연결된 평가 결과도 함께 삭제됩니다.</li>
          </ul>
        </article>
      </div>

      <div className="manual-grid">
        <article className="panel">
          <h2>5. AI Normalized Score</h2>
          <p className="muted">
            일괄 AI 평가 후 AI 원점수는 보존하고, 같은 과제 안에서 점수 분포가 30점보다 좁으면 평균을 중심으로
            30점 폭에 가깝게 재배치한 `AI Normalized Score`를 계산합니다.
          </p>
          <ul className="safe-bullets">
            <li>AI 평가점수는 AI가 직접 부여한 원점수입니다.</li>
            <li>AI Normalized Score는 점수 쏠림을 완화하기 위한 과제 단위 보정 점수입니다.</li>
            <li>Evaluations의 최종조정점수 기본값은 AI Normalized Score로 시작합니다.</li>
            <li>평가자는 최종조정점수, 피드백, 학생용 보고서를 직접 수정할 수 있습니다.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>6. AI Generated Score</h2>
          <p className="muted">
            `AI Generated Score`는 학생 제출물과 AI Baseline을 비교해 모델별 AI 생성 유사도 평균을 계산합니다.
            이 값은 Evaluations와 Rubrix Tuning 계산에서 참고 신호로 사용됩니다.
          </p>
          <ul className="safe-bullets">
            <li>과제를 선택한 뒤 `AI 진단 실행`을 누르면 제출물 전체를 일괄 비교합니다.</li>
            <li>평균과 최대 6개 모델별 점수를 확인할 수 있습니다.</li>
            <li>점수 색상은 낮음, 보통, 주의, 높음의 위험 정도를 빠르게 구분하는 데 사용합니다.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>7. 유사도 분석</h2>
          <p className="muted">
            `Analysis`는 같은 과제 제출물끼리 비교합니다. 결과는 각 리포트가 다른 리포트들과 얼마나 유사한지
            상위 10% 평균을 기준으로 요약되어 SAFE Model에 사용됩니다.
          </p>
          <ul className="safe-bullets">
            <li>Exact Match는 거의 같은 문장 또는 긴 문장 일치를 봅니다.</li>
            <li>Sentence, Paragraph, Structure Similarity는 표현·문단·구조의 유사성을 봅니다.</li>
            <li>선택하지 않은 분석 기준은 결과에서 `-`로 표시됩니다.</li>
          </ul>
        </article>
      </div>

      <div className="manual-grid">
        <article className="panel">
          <h2>8. Evaluations에서 확정</h2>
          <p className="muted">
            `Evaluations`에서는 최종확정 전 평가만 검토합니다. AI 평가점수, AI Generated Score, Analysis,
            AI Normalized Score, Rubrix Tuning Score를 함께 보고 최종조정점수와 피드백, 학생용 보고서를 수정합니다.
          </p>
          <ul className="safe-bullets">
            <li>`Rubrix Tuning` 버튼은 선택한 과제의 미확정 평가를 일괄 계산합니다.</li>
            <li>최종조정점수는 AI Normalized Score를 기본값으로 시작하며 평가자가 직접 확정합니다.</li>
            <li>Rubrix Tuning Score는 참고값이며 최종점수를 자동 확정하지 않습니다.</li>
            <li>`평가완료`를 누르면 결과가 Reports로 이동합니다.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>9. Reports와 운영 주의사항</h2>
          <div className="manual-note-grid">
            <div>
              <strong>Reports</strong>
              <span>최종확정된 평가 결과만 과제별로 확인합니다. 학생에게 전달할 피드백과 보고서를 여기서 점검합니다.</span>
            </div>
            <div>
              <strong>데이터 저장</strong>
              <span>Supabase가 연결되어 있으면 입력 데이터는 자동 저장됩니다. 새로고침해도 유지됩니다.</span>
            </div>
            <div>
              <strong>AI 평가</strong>
              <span>OpenAI API 키가 설정되어 있어야 실제 평가가 실행됩니다. 키가 없으면 임시 평가 결과가 표시됩니다.</span>
            </div>
            <div>
              <strong>윤리적 사용</strong>
              <span>Similarity와 AI Footprint는 부정행위의 단독 증거가 아니라 평가자 검토를 돕는 보조 신호입니다.</span>
            </div>
          </div>
        </article>
      </div>

      <article className="panel">
        <h2>운영 안정성 기능</h2>
        <div className="manual-note-grid">
          <div>
            <strong>수동 백업 운영</strong>
            <span>자동 백업 이력은 저장하지 않습니다. 중요한 작업 전후에는 Settings에서 직접 백업을 다운로드합니다.</span>
          </div>
          <div>
            <strong>수동 백업</strong>
            <span>`Settings`에서 PC로 JSON 백업을 다운로드하고, 복원 전 미리보기로 과제·제출물·평가 개수를 확인합니다.</span>
          </div>
          <div>
            <strong>삭제 보호</strong>
            <span>과제와 제출물 삭제 시 연결 데이터 개수를 보여주고, `삭제`라고 직접 입력해야 삭제됩니다.</span>
          </div>
          <div>
            <strong>일괄 재평가</strong>
            <span>기존 평가가 있는 과제는 `일괄 AI 평가`로 다시 실행할 수 있고, 기존 결과는 새 결과로 덮어씁니다.</span>
          </div>
          <div>
            <strong>Data Check</strong>
            <span>과제 없는 제출물, 제출물 없는 평가, 깨진 한글 데이터, Analysis 불일치 등을 Settings에서 점검합니다.</span>
          </div>
          <div>
            <strong>운영 로그</strong>
            <span>일괄 평가, 점수 수정, 최종확정, 확정 해제, 삭제, 복원 같은 주요 작업이 로그로 남습니다.</span>
          </div>
          <div>
            <strong>버전 기록</strong>
            <span>평가 결과에는 사용 모델, 평가 프롬프트 버전, 루브릭 프롬프트 버전, SAFE Model 버전이 저장됩니다.</span>
          </div>
          <div>
            <strong>확정 해제</strong>
            <span>현재 단계에서는 Reports에서 `확정 해제`를 눌러 Evaluations로 되돌릴 수 있으며, 작업은 로그에 기록됩니다.</span>
          </div>
        </div>
      </article>
    </section>
  );
}

function RtsSimulator() {
  const simulatorHtml = useMemo(() => {
    const overrideStyle = `
      <style>
        :root{
          --paper:#f8fafc !important;
          --surface:#ffffff !important;
          --surface-2:#eff6ff !important;
          --ink:#0f172a !important;
          --muted:#64748b !important;
          --faint:#94a3b8 !important;
          --line:#dbeafe !important;
          --line-strong:#bfdbfe !important;
          --gain:#15803d !important;
          --gain-soft:#dcfce7 !important;
          --penalty:#dc2626 !important;
          --penalty-soft:#fee2e2 !important;
          --neutral:#1e40af !important;
          --accent:#2563eb !important;
          --alert:#dc2626 !important;
        }
        body{
          background:#f8fafc !important;
          font-family:"Pretendard Variable","Pretendard","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif !important;
          padding:0 !important;
        }
        .wrap{max-width:none !important;margin:0 !important;}
        header{border-bottom:1px solid #bfdbfe !important;margin-bottom:18px !important;padding:18px 20px !important;background:#ffffff !important;border-radius:8px !important;}
        h1,.panel-title,.chart-title{font-family:"Pretendard Variable","Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif !important;letter-spacing:0 !important;}
        h1{color:#0f172a !important;font-size:28px !important;}
        .grid{grid-template-columns:minmax(300px,.38fr) minmax(0,1fr) !important;gap:18px !important;}
        .panel,.chart-card,.table-card{border-color:#dbeafe !important;border-radius:8px !important;box-shadow:none !important;}
        .formula{border-color:#bfdbfe !important;border-left-color:#2563eb !important;border-radius:8px !important;background:#eff6ff !important;}
        .btn,.toggle-group button,.secondary-button{border-radius:8px !important;}
        input,button,td input{font-family:inherit !important;}
        @media(max-width:1020px){.grid{grid-template-columns:1fr !important;}}
      </style>
    `;
    return rtsSimulatorHtml.replace("</head>", `${overrideStyle}</head>`);
  }, []);

  return (
    <section className="content-grid">
      <article className="panel">
        <div className="panel-title">
          <div>
            <h2>RTS Simulator</h2>
            <p className="muted">
              SAFE Model의 Rubric Tuning Score 계산 흐름을 파라미터와 샘플 데이터로 실험할 수 있습니다.
            </p>
          </div>
        </div>
        <iframe
          className="rts-simulator-frame"
          sandbox="allow-scripts"
          srcDoc={simulatorHtml}
          title="RTS Simulator"
        />
      </article>
    </section>
  );
}

function hasBrokenKorean(value: unknown): boolean {
  if (typeof value === "string") {
    return /\?{2,}/.test(value) || value.includes("�");
  }
  if (Array.isArray(value)) return value.some((item) => hasBrokenKorean(item));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => hasBrokenKorean(item));
  }
  return false;
}

function createDataIssues(state: AppStateData) {
  const issues: string[] = [];
  const assignmentIds = new Set(state.assignments.map((assignment) => assignment.id));
  const submissionIds = new Set(state.submissions.map((submission) => submission.id));
  const rubricIds = new Set(state.rubrics.map((rubric) => rubric.id));
  const baselineIds = new Set(state.aiBaselines.map((baseline) => baseline.id));

  const orphanSubmissions = state.submissions.filter((submission) => !assignmentIds.has(submission.assignmentId));
  if (orphanSubmissions.length) issues.push(`과제 없는 제출물 ${orphanSubmissions.length}개`);

  const orphanEvaluations = state.evaluations.filter((evaluation) => !submissionIds.has(evaluation.submissionId));
  if (orphanEvaluations.length) issues.push(`제출물 없는 평가 ${orphanEvaluations.length}개`);

  const assignmentsWithoutRubric = state.assignments.filter((assignment) => !rubricIds.has(assignment.rubricSetId));
  if (assignmentsWithoutRubric.length) issues.push(`평가세트 없는 과제 ${assignmentsWithoutRubric.length}개`);

  const brokenAiScores = state.aiGeneratedResults.flatMap((result) =>
    result.scores.flatMap((score) => score.modelScores.filter((modelScore) => !baselineIds.has(modelScore.baselineId)))
  );
  if (brokenAiScores.length) issues.push(`AI Baseline 없는 AI Generated 점수 ${brokenAiScores.length}개`);

  const brokenAnalyses = state.similarityAnalyses.filter((analysis) =>
    analysis.pairs.some((pair) => !submissionIds.has(pair.submissionAId) || !submissionIds.has(pair.submissionBId))
  );
  if (brokenAnalyses.length) issues.push(`현재 제출물과 불일치하는 Analysis 결과 ${brokenAnalyses.length}개`);

  if (hasBrokenKorean({
    rubrics: state.rubrics,
    assignments: state.assignments,
    taskTypes: state.taskTypes,
    submissions: state.submissions,
    evaluations: state.evaluations,
  })) {
    issues.push("깨진 한글 데이터 의심: ?? 또는 � 문자가 감지되었습니다.");
  }

  return issues;
}

function createSafeExplanation(
  evaluation: Evaluation,
  similaritySummary?: SimilaritySubmissionSummary,
  aiGeneratedScore?: AiGeneratedSubmissionScore
) {
  if (evaluation.rubrixTuningScore === undefined) {
    return "아직 Rubrix Tuning이 계산되지 않았습니다. Evaluations에서 Rubrix Tuning을 실행하면 보정 사유가 함께 표시됩니다.";
  }

  const reasons: string[] = [];
  if ((aiGeneratedScore?.averageScore ?? 0) >= 60) reasons.push("AI Baseline과의 평균 유사도가 높습니다.");
  if ((similaritySummary?.exactScore ?? 0) >= 60) reasons.push("문장일치 점수가 높습니다.");
  if ((similaritySummary?.structureScore ?? 0) >= 60) reasons.push("구조유사 점수가 높습니다.");
  if ((similaritySummary?.score ?? 0) <= 20 && (aiGeneratedScore?.averageScore ?? 0) <= 20) {
    reasons.push("동료 제출물 및 AI Baseline 대비 유사도가 낮아 독창성 신호가 있습니다.");
  }
  if (evaluation.rubrixTuningNote) reasons.push(evaluation.rubrixTuningNote);

  return reasons.length
    ? reasons.join(" ")
    : "SAFE Model은 AI Normalized Score를 기준점으로 두고, 제출물 간 유사도와 AI Baseline 유사도를 코호트 기준으로 함께 검토해 참고 보정값을 산출했습니다.";
}

function SettingsPanel({
  aiModel,
  setAiModel,
  downloadBackup,
  restoreBackup,
  appState,
  auditLogs,
}: {
  aiModel: string;
  setAiModel: React.Dispatch<React.SetStateAction<string>>;
  downloadBackup: () => void;
  restoreBackup: (state: Partial<AppStateData>) => void;
  appState: AppStateData;
  auditLogs: AuditLog[];
}) {
  const [restorePreview, setRestorePreview] = useState<{
    fileName: string;
    createdAt?: string;
    data: Partial<AppStateData>;
  } | null>(null);
  const dataIssues = createDataIssues(appState);

  function handleRestoreFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const nextState = parsed.data ?? parsed;
        setRestorePreview({
          fileName: file.name,
          createdAt: parsed.createdAt,
          data: nextState,
        });
      } catch {
        window.alert("백업 파일을 읽지 못했습니다. Rubrix JSON 백업 파일인지 확인해 주세요.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <section className="content-grid">
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

      <article className="panel backup-panel manual-backup-panel">
        <div>
          <h2>데이터 백업</h2>
          <p className="muted">
            현재 Rubrix 데이터를 PC에 JSON 파일로 저장하거나, 저장해 둔 백업 파일로 복원할 수 있습니다.
            브라우저에는 최근 상태가 자동 로컬 백업으로도 저장됩니다.
          </p>
        </div>
        <div className="manual-backup-copy">
          <h2>데이터 백업</h2>
          <p className="muted">
            자동 백업 이력은 저장하지 않습니다. 중요한 평가, 삭제, Rubrix Tuning 실행 전후에는 직접 백업을 다운로드해
            PC에 보관해 주세요.
          </p>
        </div>
        <div className="button-group">
          <button className="primary-button" type="button" onClick={downloadBackup}>
            백업 다운로드
          </button>
          <label className="secondary-button backup-file-button">
            백업 복원
            <input accept="application/json" type="file" onChange={handleRestoreFile} />
          </label>
        </div>
        <p className="muted backup-note">
          중요한 평가 전후에는 `백업 다운로드`를 눌러 PC에 파일을 보관해 주세요. 파일명은
          `rubrix-backup-날짜.json` 형식으로 저장됩니다.
        </p>
        {restorePreview ? (
          <div className="restore-preview">
            <strong>복원 미리보기: {restorePreview.fileName}</strong>
            <span>백업 생성일: {restorePreview.createdAt ? new Date(restorePreview.createdAt).toLocaleString("ko-KR") : "알 수 없음"}</span>
            <span>
              과제 {restorePreview.data.assignments?.length ?? 0}개 · 제출물 {restorePreview.data.submissions?.length ?? 0}개 · 평가{" "}
              {restorePreview.data.evaluations?.length ?? 0}개
            </span>
            <span>
              현재 데이터: 과제 {appState.assignments.length}개 · 제출물 {appState.submissions.length}개 · 평가{" "}
              {appState.evaluations.length}개
            </span>
            <div className="button-group">
              <button className="primary-button" type="button" onClick={() => restoreBackup(restorePreview.data)}>
                복원 확정
              </button>
              <button className="secondary-button" type="button" onClick={() => setRestorePreview(null)}>
                취소
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article className="panel backup-panel">
        <h2>Data Check</h2>
        <p className="muted">데이터 무결성과 한글 손상 가능성을 점검합니다.</p>
        <div className={dataIssues.length ? "data-check-list warning" : "data-check-list"}>
          {dataIssues.length ? (
            dataIssues.map((issue) => <div key={issue}>{issue}</div>)
          ) : (
            <div>현재 감지된 데이터 문제는 없습니다.</div>
          )}
        </div>
      </article>

      <article className="panel backup-panel">
        <h2>운영 로그</h2>
        <div className="audit-log-list">
          {auditLogs.length === 0 ? <p className="muted">아직 기록된 운영 로그가 없습니다.</p> : null}
          {auditLogs.slice(0, 20).map((log) => (
            <div className="audit-log-row" key={log.id}>
              <strong>{log.action}</strong>
              <span>{new Date(log.createdAt).toLocaleString("ko-KR")} · {log.message}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
