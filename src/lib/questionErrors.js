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

export function validateQuestionErrorDraft(draft, roadmap, activeExamId) {
  const subject = roadmap.find((item) => item.id === draft.subjectId);
  if (!subject || !subject.topics?.some((topic) => topic.id === draft.topicId)) return "Selecione matéria e assunto válidos do edital ativo.";
  if (!String(draft.statement || "").trim()) return "O enunciado é obrigatório.";
  const questionType = draft.questionType || "multiple-choice";
  if (!Array.isArray(draft.alternatives)) return "Configure as alternativas da questão.";
  if (questionType === "true-false") {
    if (draft.alternatives.length !== 2 || draft.alternatives[0]?.id !== "true" || draft.alternatives[0]?.text !== "Certo" || draft.alternatives[1]?.id !== "false" || draft.alternatives[1]?.text !== "Errado") return "Questões de Certo ou Errado devem ter apenas as opções Certo e Errado.";
  } else if (draft.alternatives.length !== 4 && draft.alternatives.length !== 5) return "Cadastre quatro ou cinco alternativas.";
  if (draft.alternatives.some((option) => !String(option.text || "").trim())) return "Preencha o texto de todas as alternativas.";
  if (draft.alternatives.filter((option) => option.isCorrect).length !== 1) return "Marque exatamente uma alternativa correta.";
  if (draft.originalAlternativeId && !draft.alternatives.some((option) => option.id === draft.originalAlternativeId)) return "A alternativa marcada originalmente não existe mais.";
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
