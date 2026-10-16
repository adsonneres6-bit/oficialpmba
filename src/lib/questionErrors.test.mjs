import test from "node:test";
import assert from "node:assert/strict";
import {
  filterQuestionErrors,
  makeQuestionAttempt,
  normalizeQuestionErrors,
  questionAlternativeLabel,
  questionErrorPerformance,
  summarizeQuestionErrors,
  validateQuestionErrorDraft,
} from "./questionErrors.js";
import { groupFlashcardDashboardActivities } from "./flashcards.js";

const roadmap = [{ id: "subject-a", subject: "Administrativo", topics: [{ id: "topic-a", title: "Princípios" }] }];
function makeDraft(count = 4, correctCount = 1) {
  return {
    examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", statement: "Enunciado completo",
    alternatives: Array.from({ length: count }, (_, index) => ({ id: `o${index}`, text: `Opção ${index}`, isCorrect: index < correctCount })),
    originalAlternativeId: "o1",
  };
}

test("accepts dynamic four and five alternative question records with one confirmed key", () => {
  assert.equal(validateQuestionErrorDraft(makeDraft(4), roadmap, "exam-a"), "");
  assert.equal(validateQuestionErrorDraft(makeDraft(5), roadmap, "exam-a"), "");
  const withoutManualExamField = makeDraft(4);
  delete withoutManualExamField.examId;
  assert.equal(validateQuestionErrorDraft(withoutManualExamField, roadmap, "exam-a"), "");
});

test("validates and records certo ou errado questions without mixing choice alternatives", () => {
  const draft = {
    ...makeDraft(),
    questionType: "true-false",
    alternatives: [
      { id: "true", text: "Certo", isCorrect: true },
      { id: "false", text: "Errado", isCorrect: false },
    ],
    originalAlternativeId: "false",
  };
  assert.equal(validateQuestionErrorDraft(draft, roadmap, "exam-a"), "");
  const attempt = makeQuestionAttempt(draft, "false", "session-ce", "2026-10-16T10:00:00.000Z");
  assert.equal(attempt.questionType, "true-false");
  assert.equal(attempt.selectedAlternativeLabel, "Errado");
  assert.equal(attempt.correctAlternativeLabel, "Certo");
  assert.equal(attempt.correct, false);
  assert.equal(validateQuestionErrorDraft({ ...draft, alternatives: makeDraft().alternatives }, roadmap, "exam-a").includes("Certo ou Errado"), true);
});

test("alternative labels recalculate consistently beyond Z", () => {
  assert.equal(questionAlternativeLabel(0), "A");
  assert.equal(questionAlternativeLabel(25), "Z");
  assert.equal(questionAlternativeLabel(26), "AA");
  assert.equal(questionAlternativeLabel(52), "BA");
});

test("rejects missing or multiple keys, empty alternatives and invalid matter/topic links", () => {
  assert.match(validateQuestionErrorDraft(makeDraft(4, 0), roadmap, "exam-a"), /exatamente uma/);
  assert.match(validateQuestionErrorDraft(makeDraft(4, 2), roadmap, "exam-a"), /exatamente uma/);
  const emptyOption = makeDraft(); emptyOption.alternatives[2].text = " ";
  assert.match(validateQuestionErrorDraft(emptyOption, roadmap, "exam-a"), /texto de todas/);
  const invalidLink = makeDraft(); invalidLink.topicId = "not-real";
  assert.match(validateQuestionErrorDraft(invalidLink, roadmap, "exam-a"), /matéria e assunto válidos/);
  assert.equal(validateQuestionErrorDraft(makeDraft(), roadmap, ""), "");
});

test("removing a selected original answer is rejected until the selection is cleared", () => {
  const draft = makeDraft(5);
  draft.alternatives = draft.alternatives.filter((option) => option.id !== "o1");
  assert.match(validateQuestionErrorDraft(draft, roadmap, "exam-a"), /marcada originalmente/);
  draft.originalAlternativeId = "";
  assert.equal(validateQuestionErrorDraft(draft, roadmap, "exam-a"), "");
});

test("attempts retain original error text and record correctness, count, and session", () => {
  const original = { ...makeDraft(), id: "q1", errorReason: "Confundi dois conceitos", attempts: [] };
  const first = makeQuestionAttempt(original, "o1", "session-1", "2026-10-16T10:00:00.000Z");
  const after = { ...original, attempts: [...original.attempts, first] };
  const second = makeQuestionAttempt(after, "o0", "session-2", "2026-10-17T10:00:00.000Z");
  assert.equal(first.correct, false);
  assert.equal(second.correct, true);
  assert.equal(second.attemptNumber, 2);
  assert.equal(second.sessionId, "session-2");
  assert.equal(after.errorReason, "Confundi dois conceitos");
  assert.equal(after.attempts.length, 1);
});

test("keeps the original error reason on every attempt after later edits", () => {
  const original = normalizeQuestionErrors([
    { ...makeDraft(), id: "q1", errorReason: "Desatenção", errorCategory: "Desatenção", attempts: [] },
  ])[0];
  const first = makeQuestionAttempt(original, "o1", "session-1", "2026-10-16T10:00:00.000Z");
  const edited = { ...original, errorReason: "Nota atualizada", attempts: [first] };
  const second = makeQuestionAttempt(edited, "o0", "session-2", "2026-10-17T10:00:00.000Z");
  assert.equal(first.originalErrorReason, "Desatenção");
  assert.equal(second.originalErrorReason, "Desatenção");
  assert.equal(second.originalErrorCategory, "Desatenção");
});

test("question content and attempt history survive the app-state JSON round trip", () => {
  const record = { ...makeDraft(5), id: "persisted-question", errorReason: "Pressa", correctExplanation: "Regra confirmada", attempts: [makeQuestionAttempt({ ...makeDraft(5), attempts: [] }, "o0", "session-persist", "2026-10-16T10:00:00.000Z")] };
  const restored = normalizeQuestionErrors(JSON.parse(JSON.stringify({ questionErrors: [record] })).questionErrors)[0];
  assert.equal(restored.statement, record.statement);
  assert.equal(restored.alternatives.length, 5);
  assert.equal(restored.errorReason, "Pressa");
  assert.equal(restored.correctExplanation, "Regra confirmada");
  assert.equal(restored.attempts[0].sessionId, "session-persist");
});

test("won't register a result for a missing or ambiguous answer key", () => {
  const invalid = { ...makeDraft(), alternatives: makeDraft().alternatives.map((option) => ({ ...option, isCorrect: false })), attempts: [] };
  assert.throws(() => makeQuestionAttempt(invalid, "o0", "session"), /exatamente uma/);
});

test("combined filters keep exam, matter, topic, bank, category, and performance scoped", () => {
  const data = [
    { ...makeDraft(), id: "a", bank: "IBFC", errorCategory: "Esquecimento", attempts: [] },
    { ...makeDraft(), id: "b", examId: "exam-b", bank: "IBFC", errorCategory: "Esquecimento", attempts: [] },
    { ...makeDraft(), id: "c", bank: "CESPE", errorCategory: "Desatenção", attempts: [{ correct: true }] },
  ];
  const result = filterQuestionErrors(data, { examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", bank: "IBFC", category: "Esquecimento", performance: "reinforcement", query: "enunciado" });
  assert.deepEqual(result.map((item) => item.id), ["a"]);
});

test("summary is derived from actual attempts and does not treat one success as mastery", () => {
  const items = [
    { id: "new", attempts: [] },
    { id: "wrong", attempts: [{ correct: false }] },
    { id: "right", attempts: [{ correct: true }] },
    { id: "archived", archived: true, attempts: [] },
  ];
  assert.deepEqual(summarizeQuestionErrors(items), { total: 3, new: 1, stillMissed: 1, correctInReview: 1, reinforcement: 3 });
  assert.equal(questionErrorPerformance(items[2]).needsReinforcement, true);
  assert.equal(questionErrorPerformance({ attempts: [{ correct: true }, { correct: true }] }).needsReinforcement, false);
  assert.equal(normalizeQuestionErrors(items).length, 4);
});

test("topic review dashboard groups only matching pending question records as an independent activity", () => {
  const questionErrors = [
    { id: "q1", examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", attempts: [{ correct: false }, { correct: false }, { correct: false }] },
    { id: "q2", examId: "exam-a", subjectId: "subject-a", topicId: "topic-b", attempts: [] },
    { id: "q3", examId: "exam-b", subjectId: "subject-a", topicId: "topic-a", attempts: [] },
    { id: "q4", examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", attempts: [{ correct: true }] },
    { id: "q5", examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", attempts: [{ correct: true }, { correct: true }] },
    { id: "q6", examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", archived: true, attempts: [] },
  ];
  const groups = groupFlashcardDashboardActivities({
    traditionalReviews: [{ review: { id: "r1", examId: "exam-a", subjectId: "subject-a", topicId: "topic-a", title: "Administrativo: Princípios", date: "16/10/2026", type: "24h", status: "pendente" }, status: "due" }],
    cards: [], roadmap, examId: "exam-a", today: "2026-10-16", questionErrors,
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].traditional.length, 1);
  assert.deepEqual(groups[0].questionErrors.map((item) => item.id).sort(), ["q1", "q4"]);
});
