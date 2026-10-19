export const QUESTION_ERROR_CATEGORIES = [
  "Falta de conhecimento",
  "Esquecimento",
  "Confusão entre conceitos",
  "Interpretação do enunciado",
  "Desatenção",
  "Pegadinha da banca",
  "Aplicação incorreta da regra",
  "Outro",
];

export const QUESTION_LEARNING_REVIEW_INTERVALS = [1, 7, 15, 30];

export function questionAlternativeLabel(index) {
  if (!Number.isInteger(index) || index < 0) return "alternativa removida";
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function questionLearningReviewDueAt(
  item,
  studyMethod,
  scheduledAt = new Date(),
) {
  if (item?.learningReviewDueAt) return item.learningReviewDueAt;
  if (studyMethod !== "reverse" || !String(item?.correctExplanation || "").trim()) {
    return null;
  }
  const scheduledTime = new Date(scheduledAt).getTime();
  if (!Number.isFinite(scheduledTime)) return null;
  return new Date(scheduledTime + 24 * 60 * 60 * 1000).toISOString();
}

export function getQuestionLearningReviewStatus(item, now = new Date()) {
  if (item?.learningReviewCompletedAt || item?.learningReviewCycleCompletedAt) {
    return { state: "completed", label: "Revisão concluída" };
  }
  if (!item?.learningReviewDueAt) return null;
  const dueDate = new Date(item.learningReviewDueAt);
  if (!Number.isFinite(dueDate.getTime())) return null;
  const localDayNumber = (date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (localDayNumber(dueDate) - localDayNumber(now)) / 86400000,
  );
  if (item.learningReviewNeedsReinforcement && dayDifference >= 0) {
    return { state: "reinforcement", label: "Precisa de reforço" };
  }
  if (dayDifference < 0) {
    return {
      state: "overdue",
      label: item.learningReviewNeedsReinforcement
        ? "Revisão atrasada · precisa de reforço"
        : "Revisão atrasada",
    };
  }
  if (dayDifference === 0) {
    return { state: "today", label: "Revisão prevista: hoje" };
  }
  if (dayDifference === 1) {
    return { state: "tomorrow", label: "Revisão prevista: amanhã" };
  }
  return {
    state: "future",
    label: `Revisão prevista: ${dueDate.toLocaleDateString("pt-BR")}`,
  };
}

export function completeQuestionLearningReview(item, remembered, completedAt = new Date()) {
  const completedDate = new Date(completedAt);
  if (!Number.isFinite(completedDate.getTime())) return item;
  const stage = Math.min(
    Math.max(0, Number(item?.learningReviewStage) || 0),
    QUESTION_LEARNING_REVIEW_INTERVALS.length - 1,
  );
  const history = Array.isArray(item?.learningReviewHistory)
    ? item.learningReviewHistory
    : [];
  const review = {
    id: `learning_review_${completedDate.getTime()}_${history.length}`,
    scheduledAt: item?.learningReviewDueAt || null,
    completedAt: completedDate.toISOString(),
    remembered: Boolean(remembered),
    stage,
  };
  if (!remembered) {
    return {
      ...item,
      learningReviewHistory: [...history, review],
      learningReviewStage: stage,
      learningReviewNeedsReinforcement: true,
      learningReviewDueAt: new Date(
        completedDate.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
      learningReviewCompletedAt: null,
      updatedAt: completedDate.toISOString(),
    };
  }
  const nextStage = stage + 1;
  if (nextStage >= QUESTION_LEARNING_REVIEW_INTERVALS.length) {
    return {
      ...item,
      learningReviewHistory: [...history, review],
      learningReviewStage: QUESTION_LEARNING_REVIEW_INTERVALS.length,
      learningReviewNeedsReinforcement: false,
      learningReviewCycleCompletedAt: completedDate.toISOString(),
      learningReviewCompletedAt: completedDate.toISOString(),
      updatedAt: completedDate.toISOString(),
    };
  }
  const nextDueAt = new Date(
    completedDate.getTime() +
      QUESTION_LEARNING_REVIEW_INTERVALS[nextStage] * 24 * 60 * 60 * 1000,
  );
  return {
    ...item,
    learningReviewHistory: [...history, review],
    learningReviewStage: nextStage,
    learningReviewNeedsReinforcement: false,
    learningReviewCycleCompletedAt: null,
    learningReviewCompletedAt: null,
    learningReviewDueAt: nextDueAt.toISOString(),
    updatedAt: completedDate.toISOString(),
  };
}

export function filterQuestionErrorsByStudyMethod(items, method, sessions) {
  if (!method || method === "all") return items;
  const methodsBySessionId = new Map();
  (sessions || []).forEach((session) => {
    if (
      session?.studySessionId &&
      ["traditional", "reverse"].includes(session.studyMethod)
    ) {
      methodsBySessionId.set(session.studySessionId, session.studyMethod);
    }
  });
  return items.filter(
    (item) => {
      if (item.studySessionId) {
        return methodsBySessionId.get(item.studySessionId) === method;
      }
      return item.studyMethod === method;
    },
  );
}

export function validateQuestionErrorDraft(
  draft,
  roadmap,
  requireLearning = true,
  requireStudyMethod = false,
) {
  if (
    requireStudyMethod &&
    !["traditional", "reverse"].includes(draft.studyMethod)
  ) {
    return "Selecione o método de estudo.";
  }
  const subject = roadmap.find((item) => item.id === draft.subjectId);
  const validOfficialTopic = subject?.topics?.some((topic) => topic.id === draft.topicId);
  const validCustomTopic = draft.topicKind === "custom" && String(draft.topicLabel || "").trim();
  if (!subject || (!validOfficialTopic && !validCustomTopic)) return "Selecione matéria e assunto válidos do edital ativo.";
  if (requireLearning && !String(draft.correctExplanation || "").trim()) return "O campo O que aprendi é obrigatório.";
  if (Array.isArray(draft.alternatives) && draft.alternatives.length > 0) {
    const questionType = draft.questionType || "multiple-choice";
    if (questionType === "true-false") {
      if (draft.alternatives.length !== 2 || draft.alternatives[0]?.id !== "true" || draft.alternatives[0]?.text !== "Certo" || draft.alternatives[1]?.id !== "false" || draft.alternatives[1]?.text !== "Errado") return "Questões de Certo ou Errado devem ter apenas as opções Certo e Errado.";
    } else if (draft.alternatives.length !== 4 && draft.alternatives.length !== 5) return "Cadastre quatro ou cinco alternativas.";
    if (draft.alternatives.some((option) => !String(option.text || "").trim())) return "Preencha o texto de todas as alternativas.";
    if (draft.alternatives.filter((option) => option.isCorrect).length !== 1) return "Marque exatamente uma alternativa correta.";
    if (draft.originalAlternativeId && !draft.alternatives.some((option) => option.id === draft.originalAlternativeId)) return "A alternativa marcada originalmente não existe mais.";
  }
  return "";
}

export function normalizeQuestionErrors(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item.id === "string").map((item) => ({
    ...item,
    questionType: item.questionType === "true-false" ? "true-false" : "multiple-choice",
    originalErrorReason: String(item.originalErrorReason ?? item.errorReason ?? ""),
    originalErrorCategory: String(item.originalErrorCategory ?? item.errorCategory ?? ""),
    alternatives: Array.isArray(item.alternatives) ? item.alternatives.map((option, index) => ({
      id: String(option?.id || `alternative_${index + 1}`),
      text: String(option?.text || ""),
      isCorrect: Boolean(option?.isCorrect),
    })) : [],
    attempts: Array.isArray(item.attempts) ? item.attempts.map((attempt) => ({
      ...attempt,
      originalErrorReason: String(attempt?.originalErrorReason ?? item.originalErrorReason ?? item.errorReason ?? ""),
      originalErrorCategory: String(attempt?.originalErrorCategory ?? item.originalErrorCategory ?? item.errorCategory ?? ""),
    })) : [],
    archived: Boolean(item.archived),
  }));
}

export function questionErrorPerformance(item) {
  const attempts = Array.isArray(item?.attempts) ? item.attempts : [];
  let consecutiveCorrect = 0;
  for (let index = attempts.length - 1; index >= 0 && attempts[index]?.correct === true; index -= 1) consecutiveCorrect += 1;
  return {
    attempts: attempts.length,
    correct: attempts.filter((attempt) => attempt.correct === true).length,
    incorrect: attempts.filter((attempt) => attempt.correct === false).length,
    last: attempts.at(-1) || null,
    consecutiveCorrect,
    needsReinforcement: consecutiveCorrect < 2,
  };
}

export function filterQuestionErrors(items, filters = {}) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("pt-BR");
  return normalizeQuestionErrors(items).filter((item) => {
    if (!filters.includeArchived && item.archived) return false;
    if (filters.examId && filters.examId !== "all" && item.examId && item.examId !== filters.examId) return false;
    if (filters.subjectId && filters.subjectId !== "all" && item.subjectId !== filters.subjectId) return false;
    if (filters.topicId && filters.topicId !== "all" && item.topicId !== filters.topicId) return false;
    if (filters.bank && filters.bank !== "all" && item.bank !== filters.bank) return false;
    if (filters.category && filters.category !== "all" && item.errorCategory !== filters.category) return false;
    const performance = questionErrorPerformance(item);
    if (filters.status === "new" && performance.attempts) return false;
    if (filters.status === "reviewed" && !performance.attempts) return false;
    if (filters.status === "archived" && !item.archived) return false;
    if (filters.performance === "reinforcement" && !performance.needsReinforcement) return false;
    if (filters.performance === "correct" && !performance.correct) return false;
    if (filters.performance === "incorrect" && !performance.incorrect) return false;
    if (query) {
      const haystack = [item.statement, item.bank, item.identification, item.source, item.errorReason, item.correctExplanation, item.subjectLabel, item.topicLabel, ...(item.alternatives || []).map((option) => option.text)].join(" ").toLocaleLowerCase("pt-BR");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function summarizeQuestionErrors(items) {
  const active = normalizeQuestionErrors(items).filter((item) => !item.archived);
  return active.reduce((summary, item) => {
    const performance = questionErrorPerformance(item);
    summary.total += 1;
    if (!performance.attempts) summary.new += 1;
    if (performance.last?.correct === false) summary.stillMissed += 1;
    if (performance.correct) summary.correctInReview += 1;
    if (performance.needsReinforcement) summary.reinforcement += 1;
    return summary;
  }, { total: 0, new: 0, stillMissed: 0, correctInReview: 0, reinforcement: 0 });
}

export function makeQuestionAttempt(item, selectedAlternativeId, sessionId, now = new Date().toISOString()) {
  const alternatives = Array.isArray(item?.alternatives) ? item.alternatives : [];
  const correctOptions = alternatives.filter((option) => option.isCorrect);
  if (correctOptions.length !== 1 || !alternatives.some((option) => option.id === selectedAlternativeId)) {
    throw new Error("A questão precisa de exatamente uma alternativa correta válida.");
  }
  return {
    id: `question_attempt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    attemptedAt: now,
    selectedAlternativeId,
    correctAlternativeId: correctOptions[0].id,
    questionType: item.questionType === "true-false" ? "true-false" : "multiple-choice",
    selectedAlternativeLabel: item.questionType === "true-false" ? alternatives.find((option) => option.id === selectedAlternativeId)?.text : questionAlternativeLabel(alternatives.findIndex((option) => option.id === selectedAlternativeId)),
    correctAlternativeLabel: item.questionType === "true-false" ? correctOptions[0].text : questionAlternativeLabel(alternatives.findIndex((option) => option.id === correctOptions[0].id)),
    correct: selectedAlternativeId === correctOptions[0].id,
    originalErrorReason: String(item.originalErrorReason ?? item.errorReason ?? ""),
    originalErrorCategory: String(item.originalErrorCategory ?? item.errorCategory ?? ""),
    attemptNumber: (item.attempts || []).length + 1,
    sessionId,
  };
}
