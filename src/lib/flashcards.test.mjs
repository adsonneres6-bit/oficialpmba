import test from "node:test";
import assert from "node:assert/strict";
import {
  addLocalDays,
  SUBJECT_REVIEW_STAGES,
  analyzeFlashcardAnswer,
  completeFlashcardSession,
  flashcardTopicActivity,
  flashcardsForReviewStage,
  flashcardNeedsAttention,
  flashcardStatus,
  groupFlashcardDashboardActivities,
  mergeCompletionFlashcards,
  getFlashcardSummary,
  localDateISO,
  normalizeFlashcards,
  pendingFlashcardsForTarget,
  recordFlashcardReview,
  recordFlashcardAttempt,
  recordFlashcardSessionAttempt,
  resolveReviewFlashcardTarget,
} from "./flashcards.js";

function makeCard(id, overrides = {}) {
  return {
    id,
    subjectId: "law",
    topicId: "topic-a",
    archived: false,
    schedule: {
      lastReviewedAt: null,
      lastReviewedDate: null,
      nextReviewDate: null,
      repetitions: 0,
      positiveReviews: 0,
      negativeReviews: 0,
      lastRating: null,
      intervalDays: 0,
    },
    history: [],
    ...overrides,
  };
}

const constitutionCard = {
  ...makeCard("fundamentos", { topicId: "art-1" }),
  front: "Quais são os cinco fundamentos da República Federativa do Brasil?",
  back: [
    "Soberania",
    "Cidadania",
    "Dignidade da pessoa humana",
    "Valores sociais do trabalho e da livre iniciativa",
    "Pluralismo político",
  ].join("\n"),
  answerType: "list",
};

test("constitutional fundamentals recognize four complete items and the missing essential complement", () => {
  const result = analyzeFlashcardAnswer(
    constitutionCard,
    "Soberania, cidadania, dignidade da pessoa humana, valores sociais e pluralismo político.",
    new Date(2026, 9, 14, 12),
  );
  assert.equal(result.status, "partial");
  assert.equal(result.completionPercent, 80);
  assert.equal(result.confidence, "high");
  assert.equal(result.correctCount, 4);
  assert.equal(result.incompleteCount, 1);
  assert.equal(result.missingCount, 0);
  assert.equal(
    result.elements[3].official,
    "Valores sociais do trabalho e da livre iniciativa",
  );
  assert.equal(result.elements[3].matchedText, "valores sociais");
  assert.equal(result.elements[3].missingText, "do trabalho e da livre iniciativa");
  assert.equal(result.officialAnswer, constitutionCard.back);
});

test("normalized exact list accepts case, punctuation, accents and whitespace differences", () => {
  const result = analyzeFlashcardAnswer(
    constitutionCard,
    "  SOBERÂNIA!!! CIDADANIA; dignidade da pessoa humana; valores sociais do trabalho e da livre iniciativa; PLURALISMO POLÍTICO. ",
  );
  assert.equal(result.status, "correct");
  assert.equal(result.correctCount, 5);
  assert.equal(result.completionPercent, 100);
});

test("accent matching follows the card correction preference", () => {
  const card = { ...makeCard("accent"), back: "Soberania" };
  assert.equal(analyzeFlashcardAnswer(card, "Soberânia").status, "correct");
  const strict = {
    ...card,
    correctionCriteria: { ignoreAccents: false },
  };
  assert.notEqual(
    analyzeFlashcardAnswer(strict, "Soberânia").status,
    "correct",
  );
});

test("a clearly unrelated one-word response is incorrect rather than inconclusive", () => {
  const result = analyzeFlashcardAnswer(
    { ...makeCard("citizenship"), front: "Qual fundamento trata da participação política?", back: "Cidadania" },
    "Computador",
  );
  assert.equal(result.status, "incorrect");
  assert.equal(result.confidence, "high");
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.unverifiedCount, 0);
  assert.equal(result.elements[0].status, "incorrect");
});

test("list elements can be submitted in a different order and tolerate a one-character typo", () => {
  const result = analyzeFlashcardAnswer(
    constitutionCard,
    "Pluralismo político; Valores sociais do trabalho e da livre iniciativa; Dignidade da pessoa humana; Cidadania; Soberania",
  );
  assert.equal(result.status, "correct");
  assert.equal(result.correctCount, 5);
  const typo = analyzeFlashcardAnswer(
    { ...makeCard("typo"), back: "Soberania" },
    "Soberaniaa",
  );
  assert.equal(typo.status, "correct");
  assert.equal(typo.completionPercent, 100);
  assert.equal(typo.confidence, "medium");
});

test("missing list items are distinct from incorrect and incomplete items", () => {
  const result = analyzeFlashcardAnswer(
    constitutionCard,
    "Soberania; Cidadania; Pluralismo político",
  );
  assert.equal(result.status, "partial");
  assert.equal(result.correctCount, 3);
  assert.equal(result.incompleteCount, 0);
  assert.equal(result.missingCount, 2);
});

test("configured incorrect terms are flagged and unmatched extras are inconclusive", () => {
  const configured = {
    ...constitutionCard,
    correctionCriteria: {
      answerType: "list",
      incorrectTerms: ["igualdade"],
    },
  };
  const contradictory = analyzeFlashcardAnswer(
    configured,
    "Soberania; Cidadania; Igualdade",
  );
  assert.equal(contradictory.status, "incorrect");
  assert.deepEqual(contradictory.incorrectTerms, ["igualdade"]);
  const uncertain = analyzeFlashcardAnswer(
    constitutionCard,
    "Soberania; Cidadania; informação extra não cadastrada",
  );
  assert.equal(uncertain.status, "inconclusive");
  assert.equal(uncertain.incorrectCount, 0);
  assert.equal(uncertain.unrecognizedExtras.length, 1);
});

test("blank answers are not submitted as attempts", () => {
  assert.throws(
    () => analyzeFlashcardAnswer(constitutionCard, " \n "),
    /Digite uma resposta/,
  );
});

test("semantic paraphrase is not accepted without an explicitly configured synonym", () => {
  const card = { ...makeCard("sovereignty"), back: "Soberania" };
  const unconfirmed = analyzeFlashcardAnswer(card, "O Brasil é independente");
  assert.notEqual(unconfirmed.status, "correct");
  assert.equal(unconfirmed.status, "inconclusive");
  assert.equal(unconfirmed.confidence, "low");
  assert.equal(unconfirmed.method, "local-text");
  assert.equal(unconfirmed.semanticAnalysis, "not-configured");
  const configured = {
    ...card,
    correctionCriteria: {
      requiredElements: [
        { text: "Soberania", acceptedVariants: ["Independência nacional"] },
      ],
    },
  };
  assert.equal(
    analyzeFlashcardAnswer(configured, "Independência nacional").status,
    "correct",
  );
});

test("legacy card can be corrected from its official answer without additional criteria", () => {
  const legacy = { ...makeCard("legacy"), back: "Ato administrativo válido" };
  assert.equal(
    analyzeFlashcardAnswer(legacy, "Ato administrativo válido").status,
    "correct",
  );
});

test("a correction failure leaves the card history untouched", () => {
  const legacy = { ...makeCard("blank-answer"), back: "Cidadania" };
  assert.throws(() => analyzeFlashcardAnswer(legacy, "  "));
  assert.deepEqual(legacy.history, []);
});

test("correction attempt is persisted and rating updates that attempt without discarding history", () => {
  const firstAttempt = analyzeFlashcardAnswer(
    constitutionCard,
    "Soberania; Cidadania",
    new Date(2026, 9, 14, 12),
  );
  const cardWithAttempt = recordFlashcardAttempt(
    { ...constitutionCard, history: [{ id: "previous-review", rating: "good" }] },
    firstAttempt,
  );
  const duplicate = recordFlashcardAttempt(cardWithAttempt, firstAttempt);
  assert.equal(duplicate.history.length, cardWithAttempt.history.length);
  assert.equal(cardWithAttempt.history.length, 2);
  assert.equal(cardWithAttempt.schedule.repetitions, 0);
  assert.equal(
    cardWithAttempt.history[1].officialAnswer,
    constitutionCard.back,
  );
  const rated = recordFlashcardReview(
    cardWithAttempt,
    "hard",
    new Date(2026, 9, 14, 12, 5),
    firstAttempt,
  );
  assert.equal(rated.history.length, 2);
  assert.equal(rated.history[1].rating, "hard");
  assert.equal(rated.history[1].answerAttempt.submittedAnswer, "Soberania; Cidadania");
  assert.equal(rated.schedule.repetitions, 1);
  assert.equal(rated.schedule.nextReviewDate, null);
  const edited = { ...rated, back: "Resposta oficial atualizada" };
  assert.equal(
    edited.history[1].officialAnswer,
    constitutionCard.back,
  );
  const restored = normalizeFlashcards(
    JSON.parse(JSON.stringify([edited])),
  )[0];
  assert.equal(restored.history.length, 2);
  assert.equal(
    restored.history[1].answerAttempt.submittedAnswer,
    "Soberania; Cidadania",
  );
  assert.equal(restored.history[1].correction.missingCount, 3);
  assert.equal(restored.schedule.nextReviewDate, null);
});

test("a new card remains new after an answer draft and becomes reviewed only after rating", () => {
  const fresh = makeCard("new-card", { front: "Question", back: "Answer" });
  assert.equal(flashcardStatus(fresh, "2026-10-14"), "new");
  const answer = analyzeFlashcardAnswer(fresh, "Answer", new Date(2026, 9, 14, 10));
  const attempted = recordFlashcardSessionAttempt(fresh, {
    sessionId: "session-a",
    attempt: answer,
    attemptNumber: 1,
  });
  assert.equal(flashcardStatus(attempted, "2026-10-14"), "new");
  const reviewed = completeFlashcardSession(attempted, {
    sessionId: "session-a",
    now: new Date(2026, 9, 14, 10, 5),
    rating: "good",
    outcome: "correct-first",
  });
  assert.equal(flashcardStatus(reviewed, "2026-10-14"), "reviewed");
  assert.equal(reviewed.schedule.lastReviewedDate, "2026-10-14");
  assert.equal(reviewed.schedule.nextReviewDate, null);
  assert.equal(reviewed.history.length, 1);
  assert.equal(reviewed.history[0].attempts.length, 1);
  assert.equal(reviewed.history[0].firstTryCorrect, true);
  const restored = normalizeFlashcards(
    JSON.parse(JSON.stringify([reviewed])),
  )[0];
  assert.equal(flashcardStatus(restored, "2026-10-14"), "reviewed");
  assert.equal(restored.history[0].attempts[0].submittedAnswer, "Answer");
});

test("a second-attempt success retains both answers and reports second-try performance", () => {
  const card = makeCard("second-try", { back: "Cidadania" });
  const first = analyzeFlashcardAnswer(card, "Computador", new Date(2026, 9, 14, 10));
  const withFirst = recordFlashcardSessionAttempt(card, {
    sessionId: "session-b",
    attempt: first,
    attemptNumber: 1,
  });
  const second = analyzeFlashcardAnswer(card, "Cidadania", new Date(2026, 9, 14, 10, 1));
  const withSecond = recordFlashcardSessionAttempt(withFirst, {
    sessionId: "session-b",
    attempt: second,
    attemptNumber: 2,
  });
  const reviewed = completeFlashcardSession(withSecond, {
    sessionId: "session-b",
    now: new Date(2026, 9, 14, 10, 2),
    rating: "hard",
    outcome: "correct-second",
  });
  assert.equal(reviewed.history[0].attempts.length, 2);
  assert.equal(reviewed.history[0].attemptCount, 2);
  assert.equal(reviewed.history[0].firstTryCorrect, false);
  assert.equal(reviewed.history[0].secondTryCorrect, true);
  assert.equal(reviewed.schedule.nextReviewDate, null);
});

test("two failed attempts preserve history without creating an individual card schedule", () => {
  const card = makeCard("two-wrongs", { back: "Cidadania" });
  const first = analyzeFlashcardAnswer(card, "Computador", new Date(2026, 9, 14, 10));
  const withFirst = recordFlashcardSessionAttempt(card, {
    sessionId: "session-c",
    attempt: first,
    attemptNumber: 1,
  });
  const second = analyzeFlashcardAnswer(card, "Geladeira", new Date(2026, 9, 14, 10, 1));
  const withSecond = recordFlashcardSessionAttempt(withFirst, {
    sessionId: "session-c",
    attempt: second,
    attemptNumber: 2,
  });
  const reviewed = completeFlashcardSession(withSecond, {
    sessionId: "session-c",
    now: new Date(2026, 9, 14, 10, 2),
    rating: "again",
    outcome: "incorrect",
  });
  const duplicate = completeFlashcardSession(reviewed, {
    sessionId: "session-c",
    now: new Date(2026, 9, 14, 10, 3),
    rating: "again",
    outcome: "incorrect",
  });
  assert.equal(duplicate.schedule.repetitions, 1);
  assert.equal(duplicate.schedule.nextReviewDate, null);
  assert.equal(duplicate.history.length, 1);
  assert.equal(duplicate.history[0].incorrect, true);
});

test("consulting the official answer is a review activity but never an answer success", () => {
  const card = makeCard("consulted", { back: "Cidadania" });
  const reviewed = completeFlashcardSession(card, {
    sessionId: "session-consulted",
    now: new Date(2026, 9, 14, 10),
    rating: "again",
    outcome: "consulted",
    consulted: true,
  });
  assert.equal(flashcardStatus(reviewed, "2026-10-14"), "reviewed");
  assert.equal(reviewed.history[0].consulted, true);
  assert.equal(reviewed.history[0].firstTryCorrect, false);
  assert.equal(reviewed.history[0].secondTryCorrect, false);
});

test("an inconclusive correction is retained without consuming an attempt or reviewing the card", () => {
  const card = makeCard("uncertain", { back: "Cidadania" });
  const uncertain = analyzeFlashcardAnswer(
    card,
    "A participação política dos cidadãos",
    new Date(2026, 9, 14, 10),
  );
  assert.equal(uncertain.status, "inconclusive");
  const withUncertain = recordFlashcardSessionAttempt(card, {
    sessionId: "session-uncertain",
    attempt: uncertain,
    attemptNumber: 1,
  });
  assert.equal(withUncertain.history[0].attempts.length, 1);
  assert.equal(withUncertain.schedule.repetitions, 0);
  assert.equal(flashcardStatus(withUncertain, "2026-10-14"), "new");
  const laterCorrect = analyzeFlashcardAnswer(
    card,
    "Cidadania",
    new Date(2026, 9, 14, 10, 1),
  );
  const withCorrect = recordFlashcardSessionAttempt(withUncertain, {
    sessionId: "session-uncertain",
    attempt: laterCorrect,
    attemptNumber: 1,
  });
  const reviewed = completeFlashcardSession(withCorrect, {
    sessionId: "session-uncertain",
    now: new Date(2026, 9, 14, 10, 2),
    rating: "good",
    outcome: "correct-first",
  });
  assert.equal(reviewed.history[0].attemptCount, 1);
  assert.equal(reviewed.history[0].firstTryCorrect, true);
});

test("topic activity summarizes only its cards and does not imply theory completion", () => {
  const fresh = makeCard("topic-card", { back: "Resposta" });
  const firstAttempt = analyzeFlashcardAnswer(
    fresh,
    "Resposta",
    new Date(2026, 9, 14, 9, 59),
  );
  const attempted = recordFlashcardSessionAttempt(fresh, {
    sessionId: "session-topic",
    attempt: firstAttempt,
    attemptNumber: 1,
  });
  const reviewed = completeFlashcardSession(attempted, {
    sessionId: "session-topic",
    now: new Date(2026, 9, 14, 10),
    rating: "good",
    outcome: "correct-first",
  });
  const otherTopic = makeCard("other", { topicId: "topic-b" });
  const summary = flashcardTopicActivity(
    [reviewed, otherTopic],
    { subjectId: "law", topicId: "topic-a" },
    "2026-10-14",
  );
  assert.equal(summary.reviewed, true);
  assert.equal(summary.totalCards, 1);
  assert.equal(summary.cardsReviewed, 1);
  assert.equal(summary.correctFirstTry, 1);
  assert.equal(summary.neverReviewed, 0);
  assert.equal(otherTopic.schedule.repetitions, 0);
});

test("legacy reviewed history repairs a missing schedule and remains reviewed after normalization", () => {
  const [restored] = normalizeFlashcards([
    makeCard("legacy-reviewed", {
      history: [{
        id: "legacy-review",
        rating: "good",
        reviewedAt: "2026-10-13T10:00:00.000Z",
        reviewedDate: "2026-10-13",
        nextReviewDate: "2026-10-16",
        intervalDays: 3,
      }],
    }),
  ]);
  assert.equal(restored.schedule.repetitions, 1);
  assert.equal(restored.schedule.lastReviewedDate, "2026-10-13");
  assert.equal(restored.schedule.nextReviewDate, "2026-10-16");
  assert.equal(flashcardStatus(restored, "2026-10-14"), "reviewed");
});

test("dashboard groups traditional and stage-eligible flashcards by context IDs", () => {
  const roadmap = [
    {
      id: "law",
      subject: "Direito Constitucional",
      topics: [
        { id: "art-1", title: "Fundamentos da República" },
        { id: "art-2", title: "Outro assunto" },
        { id: "art-3", title: "Princípios constitucionais" },
      ],
    },
  ];
  const dueCard = makeCard("due", {
    examKey: "exam-a",
    subjectId: "law",
    topicId: "art-1",
    schedule: { repetitions: 1, nextReviewDate: "2026-10-14" },
  });
  const lateCard = makeCard("late", {
    examKey: "exam-a",
    subjectId: "law",
    topicId: "art-1",
    schedule: { repetitions: 1, nextReviewDate: "2026-10-13" },
  });
  const newCard = makeCard("new", {
    examKey: "exam-a",
    subjectId: "law",
    topicId: "art-1",
  });
  const futureCard = makeCard("future", {
    examKey: "exam-a",
    subjectId: "law",
    topicId: "art-1",
    schedule: { repetitions: 1, nextReviewDate: "2026-10-15" },
  });
  const otherTopicCard = makeCard("other-topic", {
    examKey: "exam-a",
    subjectId: "law",
    topicId: "art-2",
    schedule: { repetitions: 1, nextReviewDate: "2026-10-14" },
  });
  const traditional = {
    id: "review-1",
    examId: "exam-a",
    subjectId: "law",
    topicId: "art-1",
    title: "Direito Constitucional: Fundamentos da República",
    type: "24 horas",
    date: "14/10/2026",
    status: "pendente",
  };
  const traditionalOnly = {
    ...traditional,
    id: "review-only",
    topicId: "art-3",
    title: "Direito Constitucional: Princípios constitucionais",
  };
  const traditionalOtherTopic = {
    ...traditional,
    id: "review-other-topic",
    topicId: "art-2",
    title: "Direito Constitucional: Outro assunto",
  };
  const groups = groupFlashcardDashboardActivities({
    traditionalReviews: [
      { review: traditional, status: "due" },
      { review: traditionalOtherTopic, status: "due" },
      { review: traditionalOnly, status: "overdue" },
      { review: { ...traditional, id: "review-completed", status: "concluida" }, status: "due" },
    ],
    cards: [dueCard, dueCard, lateCard, newCard, futureCard, otherTopicCard],
    roadmap,
    examId: "exam-a",
    today: "2026-10-14",
  });
  const topicGroup = groups.find(
    (group) => group.subjectId === "law" && group.topicId === "art-1",
  );
  assert.ok(topicGroup);
  assert.equal(topicGroup.traditional.length, 1);
  assert.equal(topicGroup.flashcardStages.length, 2);
  assert.ok(
    topicGroup.flashcardStages.some(
      (stage) => stage.reviewId === "review-completed",
    ),
  );
  assert.deepEqual(
    topicGroup.flashcardStages[0].cards.map((card) => card.id).sort(),
    ["due", "future", "late", "new"],
  );
  assert.equal(
    groups.find((group) => group.topicId === "art-2").traditional.length,
    1,
  );
  assert.equal(
    groups.find((group) => group.topicId === "art-2").flashcardStages[0].cards[0].id,
    "other-topic",
  );
  assert.equal(
    groups.find((group) => group.topicId === "art-3").traditional.length,
    1,
  );
  assert.equal(groups.find((group) => group.topicId === "art-3").flashcardStages.length, 0);
  assert.equal(groups.some((group) =>
    group.traditional.some((review) => review.id === "review-completed"),
  ), false);
});

test("all shared subject review intervals unlock cards only when their review date arrives", () => {
  const card = makeCard("one-card");
  const studyDate = "2026-10-13";
  for (const { type, days } of SUBJECT_REVIEW_STAGES) {
    const date = addLocalDays(studyDate, days);
    const review = {
      id: `review-${type}`,
      type,
      date,
      subjectId: "law",
      topicId: "topic-a",
    };
    assert.deepEqual(
      flashcardsForReviewStage([card], review, {
        examId: "exam-a",
        today: date,
      }).map((item) => item.id),
      ["one-card"],
    );
    assert.deepEqual(
      flashcardsForReviewStage(
        [card],
        { ...review, date: addLocalDays(date, 1) },
        {
        examId: "exam-a",
          today: date,
        },
      ),
      [],
    );
    assert.deepEqual(
      flashcardsForReviewStage(
        [card],
        { ...review, examId: "exam-b" },
        { examId: "exam-a", today: date },
      ),
      [],
    );
  }
});

test("stage completion is independent, idempotent, and preserves legacy individual dates", () => {
  const card = makeCard("mistake", {
    schedule: { repetitions: 2, nextReviewDate: "2026-10-30", lastRating: "again" },
    history: [{
      id: "mistake-history",
      activityType: "flashcard-review",
      reviewedAt: "2026-10-13T10:00:00.000Z",
      outcome: "incorrect",
      rating: "again",
      attempts: [{ status: "incorrect" }],
    }],
  });
  assert.equal(flashcardNeedsAttention(card), true);
  const stage = {
    id: "review-24h",
    type: "24 horas",
    date: "2026-10-14",
    subjectId: "law",
    topicId: "topic-a",
  };
  const due = flashcardsForReviewStage([card], stage, {
    examId: "exam-a",
    today: "2026-10-14",
  });
  assert.equal(due[0].id, "mistake");
  const cleanCard = makeCard("clean", { front: "Outro cartão" });
  assert.deepEqual(
    flashcardsForReviewStage([cleanCard, card], stage, {
      examId: "exam-a",
      today: "2026-10-14",
    }).map((item) => item.id),
    ["mistake", "clean"],
  );
  const interrupted = recordFlashcardSessionAttempt(card, {
    sessionId: "interrupted-stage-session",
    reviewStageId: stage.id,
    reviewStageType: stage.type,
    attempt: analyzeFlashcardAnswer(
      card,
      "Resposta parcial",
      new Date(2026, 9, 14, 9),
    ),
    attemptNumber: 1,
  });
  assert.equal(
    flashcardsForReviewStage([interrupted], stage, {
      examId: "exam-a",
      today: "2026-10-14",
    }).length,
    1,
  );
  const reviewed = completeFlashcardSession(card, {
    sessionId: "new-session",
    reviewStageId: stage.id,
    now: new Date(2026, 9, 14, 10),
    rating: "hard",
    outcome: "incorrect",
  });
  assert.equal(reviewed.history.at(-1).reviewStageId, stage.id);
  assert.equal(reviewed.schedule.nextReviewDate, "2026-10-30");
  const restored = normalizeFlashcards(
    JSON.parse(JSON.stringify([reviewed])),
  )[0];
  assert.equal(restored.schedule.lastReviewedDate, "2026-10-14");
  assert.deepEqual(
    flashcardsForReviewStage([restored], stage, {
      examId: "exam-a",
      today: "2026-10-14",
    }),
    [],
  );
  assert.deepEqual(
    flashcardsForReviewStage([reviewed], stage, {
      examId: "exam-a",
      today: "2026-10-14",
    }),
    [],
  );
  const nextStage = { ...stage, id: "review-7d", type: "7 dias" };
  assert.equal(
    flashcardsForReviewStage([reviewed], nextStage, {
      examId: "exam-a",
      today: "2026-10-14",
    }).length,
    1,
  );
});

test("a completed traditional stage can remain independently pending for flashcards", () => {
  const review = {
    id: "review-complete-traditional",
    title: "Direito Constitucional: Fundamentos da República",
    type: "24 horas",
    date: "14/10/2026",
    status: "concluida",
    examId: "exam-a",
    subjectId: "law",
    topicId: "art-1",
  };
  const groups = groupFlashcardDashboardActivities({
    traditionalReviews: [{ review, status: "due" }],
    cards: [makeCard("card-not-done-for-stage", {
      examKey: "exam-a",
      subjectId: "law",
      topicId: "art-1",
    })],
    roadmap: [{
      id: "law",
      subject: "Direito Constitucional",
      topics: [{ id: "art-1", title: "Fundamentos da República" }],
    }],
    examId: "exam-a",
    today: "2026-10-14",
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].traditional.length, 0);
  assert.equal(groups[0].flashcardStages.length, 1);
  assert.equal(groups[0].flashcardStages[0].cards[0].id, "card-not-done-for-stage");
});

test("completion-modal drafts create new linked cards idempotently without losing history", () => {
  const topicOptions = [{ id: "topic-a", title: "Fundamentos" }];
  const draft = {
    id: "flashcard_draft_1",
    topicId: "topic-a",
    front: "Pergunta digitada pelo estudante",
    back: "Resposta digitada pelo estudante",
  };
  const created = mergeCompletionFlashcards([], [draft, draft], {
    examId: "exam-a",
    subjectId: "law",
    subjectLabel: "Direito Constitucional",
    topicOptions,
    sourceBlockId: "study-block",
    now: "2026-10-14T10:00:00.000Z",
  });
  assert.equal(created.length, 1);
  assert.equal(created[0].examKey, "exam-a");
  assert.equal(created[0].subjectId, "law");
  assert.equal(created[0].topicId, "topic-a");
  assert.equal(created[0].sourceCompletionBlockId, "study-block");
  assert.equal(created[0].schedule.repetitions, 0);
  assert.equal(created[0].history.length, 0);
  assert.equal(flashcardStatus(created[0]), "new");
  const reviewed = completeFlashcardSession(created[0], {
    sessionId: "independent-review",
    now: new Date(2026, 9, 14, 12),
    rating: "good",
    outcome: "correct-first",
  });
  const updated = mergeCompletionFlashcards(
    [reviewed],
    [{ ...draft, front: "Pergunta editada" }],
    {
      examId: "exam-a",
      subjectId: "law",
      subjectLabel: "Direito Constitucional",
      topicOptions,
      sourceBlockId: "study-block",
      now: "2026-10-14T13:00:00.000Z",
    },
  );
  assert.equal(updated.length, 1);
  assert.equal(updated[0].front, "Pergunta editada");
  assert.equal(updated[0].history.length, 1);
  assert.equal(updated[0].schedule.repetitions, 1);
  assert.throws(
    () =>
      mergeCompletionFlashcards([], [{ ...draft, topicId: "missing-topic" }], {
        subjectId: "law",
        topicOptions,
      }),
    /assunto válido/,
  );
});

test("flashcard dashboard sessions select only the requested status and edital context", () => {
  const cards = [
    makeCard("due-a", {
      examKey: "exam-a",
      schedule: { repetitions: 1, nextReviewDate: "2026-10-14" },
    }),
    makeCard("new-a", { examKey: "exam-a" }),
    makeCard("due-b", {
      examKey: "exam-b",
      schedule: { repetitions: 1, nextReviewDate: "2026-10-14" },
    }),
  ];
  assert.deepEqual(
    pendingFlashcardsForTarget(
      cards,
      { examId: "exam-a", subjectId: "law", topicId: "topic-a" },
      "2026-10-14",
      { statuses: ["reviewed"] },
    ).map((card) => card.id),
    ["due-a"],
  );
  assert.deepEqual(
    pendingFlashcardsForTarget(
      cards,
      { examId: "exam-a", subjectId: "law", topicId: "topic-a" },
      "2026-10-14",
      { statuses: ["new"] },
    ).map((card) => card.id),
    ["new-a"],
  );
});

test("date arithmetic uses local calendar dates across month/year boundaries", () => {
  const localDate = new Date(2026, 11, 30, 23, 45);
  assert.equal(localDateISO(localDate), "2026-12-30");
  assert.equal(addLocalDays("2026-12-30", 3), "2027-01-02");
});

test("new, previously reviewed, and archived cards have distinct lifecycle states", () => {
  assert.equal(flashcardStatus(makeCard("new"), "2026-10-14"), "new");
  assert.equal(
    flashcardStatus(
      makeCard("future", {
        schedule: { repetitions: 1, nextReviewDate: "2026-10-15" },
      }),
      "2026-10-14",
    ),
    "reviewed",
  );
  assert.equal(
    flashcardStatus(makeCard("archived", { archived: true }), "2026-10-14"),
    "archived",
  );
});

test("self-directed new-card selection is context-filtered and deduplicated", () => {
  const cards = [
    makeCard("new"),
    makeCard("other-topic", {
      topicId: "topic-b",
    }),
    makeCard("archived", { archived: true }),
  ];
  const due = pendingFlashcardsForTarget(
    cards,
    { subjectId: "law", topicId: "topic-a" },
    "2026-10-14",
  );
  assert.deepEqual(
    due.map((card) => card.id).sort(),
    [],
  );
  assert.equal(new Set(due.map((card) => card.id)).size, due.length);
  assert.deepEqual(
    pendingFlashcardsForTarget(
      cards,
      { subjectId: "law", topicId: "topic-a" },
      "2026-10-14",
      { includeNew: true },
    )
      .map((card) => card.id)
      .sort(),
    ["new"],
  );
  assert.deepEqual(
    pendingFlashcardsForTarget(
      cards,
      { subjectId: "law", topicId: "topic-b" },
      "2026-10-14",
      { includeNew: true },
    ).map((card) => card.id),
    ["other-topic"],
  );
});

test("summary reports card history, not an individual due calendar", () => {
  const summary = getFlashcardSummary(
    [
      makeCard("new"),
      makeCard("due", {
        schedule: { repetitions: 1, nextReviewDate: "2026-10-14" },
      }),
      makeCard("late", {
        schedule: { repetitions: 1, nextReviewDate: "2026-10-13" },
      }),
      makeCard("future", {
        schedule: { repetitions: 2, nextReviewDate: "2026-10-20" },
      }),
      makeCard("archived", { archived: true }),
    ],
    "2026-10-14",
  );
  assert.equal(summary.total, 4);
  assert.equal(summary.new, 1);
  assert.equal(summary.reviewedEver, 3);
  assert.equal(summary.completion, 75);
});

test("rating records individual performance without creating another review calendar", () => {
  const previous = makeCard("with-history", {
    front: "Pergunta do usuário",
    back: "Resposta do usuário",
    history: [{ id: "old", rating: "hard" }],
    schedule: {
      repetitions: 1,
      positiveReviews: 0,
      negativeReviews: 1,
      intervalDays: 1,
    },
  });
  const reviewed = recordFlashcardReview(
    previous,
    "easy",
    new Date(2026, 9, 14, 12, 0),
  );
  assert.equal(reviewed.front, previous.front);
  assert.equal(reviewed.back, previous.back);
  assert.equal(reviewed.history.length, 2);
  assert.equal(reviewed.schedule.repetitions, 2);
  assert.equal(reviewed.schedule.positiveReviews, 1);
  assert.equal(reviewed.schedule.negativeReviews, 1);
  assert.equal(reviewed.schedule.lastRating, "easy");
  assert.equal(reviewed.schedule.intervalDays, 1);
  assert.equal(reviewed.schedule.nextReviewDate, null);
});

test("normalization retains card content/history and initializes old optional fields", () => {
  const [card] = normalizeFlashcards([
    {
      id: "legacy",
      subjectId: 5,
      front: "Conteúdo",
      back: "Resposta",
      history: [{ rating: "good" }],
      tags: "revisar, lei",
    },
  ]);
  assert.equal(card.subjectId, "5");
  assert.equal(card.front, "Conteúdo");
  assert.equal(card.back, "Resposta");
  assert.equal(card.history.length, 1);
  assert.deepEqual(card.tags, ["revisar", "lei"]);
  assert.equal(card.schedule.repetitions, 0);
});

test("legacy review titles resolve to real matter and topic identifiers", () => {
  const roadmap = [
    {
      id: "law",
      subject: "Direito Constitucional",
      topics: [{ id: "topic-a", title: "Direitos fundamentais" }],
    },
  ];
  assert.deepEqual(
    resolveReviewFlashcardTarget(
      { title: "Direito Constitucional: Direitos fundamentais" },
      roadmap,
    ),
    { subjectId: "law", topicId: "topic-a" },
  );
  assert.equal(
    resolveReviewFlashcardTarget({ title: "Revisão sem vínculo" }, roadmap),
    null,
  );
});
