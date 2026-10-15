export const FLASHCARD_STATE_VERSION = 3;

export const SUBJECT_REVIEW_STAGES = Object.freeze([
  { type: "24 horas", days: 1 },
  { type: "7 dias", days: 7 },
  { type: "15 dias", days: 15 },
  { type: "30 dias", days: 30 },
]);

export const FLASHCARD_RATINGS = Object.freeze([
  { id: "again", label: "Errei", description: "Não consegui lembrar." },
  { id: "hard", label: "Difícil", description: "Lembrei com esforço." },
  { id: "good", label: "Bom", description: "Lembrei com algum esforço." },
  { id: "easy", label: "Fácil", description: "Lembrei sem dificuldade." },
]);

export function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addLocalDays(dateISO, days) {
  const [year, month, day] = String(dateISO).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days));
  return localDateISO(date);
}

export function formatLocalDate(dateISO) {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return "Sem data";
  const [year, month, day] = dateISO.split("-");
  return `${day}/${month}/${year}`;
}

export function normalizeAnswerText(value, { ignoreAccents = true } = {}) {
  let normalized = String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFKC");
  if (ignoreAccents) {
    normalized = normalized.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }
  return normalized
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitAnswerItems(value, { allowComma = false } = {}) {
  const text = String(value || "").trim();
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const separator = allowComma ? /[;,]+/ : /[;]+/;
  return text
    .split(separator)
    .map((part) => part.trim().replace(/^[•-]\s*/, ""))
    .filter(Boolean);
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function tokenMatches(expected, actual, { ignoreAccents = true } = {}) {
  if (expected === actual) return true;
  if (
    !ignoreAccents &&
    expected.normalize("NFD").replace(/\p{Diacritic}/gu, "") ===
      actual.normalize("NFD").replace(/\p{Diacritic}/gu, "")
  ) {
    return false;
  }
  if (expected.length < 8 || actual.length < 8) return false;
  return editDistance(expected, actual) <= 1;
}

function tokenCoverage(expectedText, answerText, options) {
  const expectedOriginalTokens = String(expectedText || "").match(/[\p{L}\p{N}]+/gu) || [];
  const expectedTokens = expectedOriginalTokens
    .map((token) => normalizeAnswerText(token, options))
    .filter(Boolean);
  const answerTokens = normalizeAnswerText(answerText, options)
    .split(" ")
    .filter(Boolean);
  if (!expectedTokens.length || !answerTokens.length) {
    return { score: 0, missing: expectedTokens, matched: [] };
  }
  const used = new Set();
  const matched = [];
  const missing = [];
  const missingOriginalTokens = [];
  let typoMatched = false;
  expectedTokens.forEach((token, tokenIndex) => {
    const foundIndex = answerTokens.findIndex(
      (candidate, index) =>
        !used.has(index) && tokenMatches(token, candidate, options),
    );
    if (foundIndex < 0) {
      missing.push(token);
      missingOriginalTokens.push(expectedOriginalTokens[tokenIndex]);
    } else {
      used.add(foundIndex);
      matched.push(token);
      if (token !== answerTokens[foundIndex]) typoMatched = true;
    }
  });
  return {
    score: matched.length / expectedTokens.length,
    expectedTokenCount: expectedTokens.length,
    answerTokenCount: answerTokens.length,
    missing,
    missingText: missingOriginalTokens.join(" "),
    matched,
    typoMatched,
  };
}

function configuredElements(card) {
  const criteria = card.correctionCriteria || {};
  const items = criteria.requiredElements || card.requiredElements || [];
  return items
    .map((item) =>
      typeof item === "string"
        ? { text: item, acceptedVariants: [] }
        : {
            text: String(item?.text || item?.label || "").trim(),
            acceptedVariants: Array.isArray(item?.acceptedVariants)
              ? item.acceptedVariants.map(String)
              : [],
          },
    )
    .filter((item) => item.text);
}

function correctionElements(card) {
  const configured = configuredElements(card);
  if (configured.length) return configured;
  const listed = splitAnswerItems(card.back, {
    allowComma:
      card.correctionCriteria?.answerType === "list" ||
      card.answerType === "list",
  });
  if (listed.length > 1) {
    return listed.map((text) => ({ text, acceptedVariants: [] }));
  }
  return [{ text: String(card.back || "").trim(), acceptedVariants: [] }].filter(
    (item) => item.text,
  );
}

function correctionCandidates(answer, listMode, elements = [], options = {}) {
  if (!listMode) return [String(answer || "").trim()].filter(Boolean);
  const initial = splitAnswerItems(answer, { allowComma: true });
  const knownElements = elements
    .map((element) => normalizeAnswerText(element.text, options))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  return initial.flatMap((candidate) => {
    let fragments = [candidate];
    let changed = true;
    while (changed) {
      changed = false;
      fragments = fragments.flatMap((fragment) => {
        const normalized = normalizeAnswerText(fragment, options);
        const matchedElement = knownElements.find((item) => {
          const position = normalized.lastIndexOf(item);
          return position > 0 && position + item.length === normalized.length;
        });
        if (!matchedElement) return [fragment];
        const rawNormalized = normalizeAnswerText(fragment, options);
        const leftover = rawNormalized
          .slice(0, rawNormalized.length - matchedElement.length)
          .trim()
          .replace(/\b(e|and|y)$/i, "")
          .trim();
        if (!leftover) return [fragment];
        changed = true;
        return [leftover, matchedElement];
      });
    }
    return fragments;
  });
}

function scoreElement(element, candidate, options) {
  const official = element.text;
  const variants = [official, ...(element.acceptedVariants || [])];
  const candidateNormalized = normalizeAnswerText(candidate, options);
  for (const variant of variants) {
    if (candidateNormalized === normalizeAnswerText(variant, options)) {
      const tokens = candidateNormalized.split(" ").filter(Boolean);
      return {
        score: 1,
        missingText: "",
        matchedVariant: variant,
        allTokensMatch: true,
        typoMatched: false,
        expectedTokenCount: tokens.length,
        answerTokenCount: tokens.length,
      };
    }
  }
  const scores = variants.map((variant) => ({
    variant,
    coverage: tokenCoverage(variant, candidate, options),
  }));
  scores.sort((left, right) => right.coverage.score - left.coverage.score);
  const best = scores[0];
  const missingTokens = best.coverage.missing;
  const missingText = missingTokens.length ? best.coverage.missingText : "";
  const allTokensMatch = best.coverage.score === 1;
  return {
    score: best.coverage.score,
    similarity: Math.round(best.coverage.score * 100),
    missingText,
    matchedVariant: best.variant,
    allTokensMatch,
    typoMatched: best.coverage.typoMatched,
    expectedTokenCount: best.coverage.expectedTokenCount,
    answerTokenCount: best.coverage.answerTokenCount,
  };
}

function knownIncorrectTerms(card) {
  return (
    card.correctionCriteria?.incorrectTerms ||
    card.incorrectTerms ||
    []
  )
    .map(String)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function analyzeFlashcardAnswer(card, answer, attemptedAt = new Date()) {
  const enteredAnswer = String(answer || "").trim();
  if (!enteredAnswer) throw new Error("Digite uma resposta antes de corrigi-la.");
  const criteria = card.correctionCriteria || {};
  const options = { ignoreAccents: criteria.ignoreAccents !== false };
  const elements = correctionElements(card);
  const isList =
    criteria.answerType === "list" ||
    card.answerType === "list" ||
    configuredElements(card).length > 0 ||
    splitAnswerItems(card.back, {
      allowComma:
        criteria.answerType === "list" || card.answerType === "list",
    }).length > 1;
  const candidates = correctionCandidates(
    enteredAnswer,
    isList,
    elements,
    options,
  );
  const usedCandidates = new Set();
  let correctCount = 0;
  let incompleteCount = 0;
  let missingCount = 0;
  const results = elements.map((element) => {
    let best = { score: 0, candidate: "", candidateIndex: -1 };
    candidates.forEach((candidate, candidateIndex) => {
      if (usedCandidates.has(candidateIndex)) return;
      const score = scoreElement(element, candidate, options);
      if (score.score > best.score) best = { ...score, candidate, candidateIndex };
    });
    if (best.score === 1) {
      usedCandidates.add(best.candidateIndex);
      correctCount += 1;
      return {
        official: element.text,
        status: "correct",
        matchedText: best.candidate,
        missingText: "",
        similarity: best.similarity ?? 100,
      };
    }
    if (best.score > 0) {
      usedCandidates.add(best.candidateIndex);
      incompleteCount += 1;
      return {
        official: element.text,
        status: "incomplete",
        matchedText: best.candidate,
        missingText: best.missingText,
        similarity: best.similarity,
      };
    }
    missingCount += 1;
    return {
      official: element.text,
      status: "missing",
      matchedText: "",
      missingText: element.text,
      similarity: 0,
    };
  });
  let unrecognizedExtras = isList
    ? candidates.filter((_, index) => !usedCandidates.has(index))
    : [];
  const incorrectTerms = knownIncorrectTerms(card).filter((term) =>
    normalizeAnswerText(enteredAnswer, options).includes(
      normalizeAnswerText(term, options),
    ),
  );
  const atomicExpected = normalizeAnswerText(elements[0]?.text, options).split(" ");
  const atomicAnswer = normalizeAnswerText(enteredAnswer, options).split(" ");
  const clearlyIncorrect =
    correctCount === 0 &&
    incompleteCount === 0 &&
    missingCount === 1 &&
    elements.length === 1 &&
    atomicExpected.length === 1 &&
    atomicAnswer.length === 1;
  if (clearlyIncorrect) {
    results[0] = { ...results[0], status: "incorrect", missingText: "" };
    missingCount = 0;
    unrecognizedExtras = [];
  }
  const completionPercent = Math.round(
    (correctCount / Math.max(elements.length, 1)) * 100,
  );
  const freeTextHasUnmatchedTerms =
    !isList &&
    elements.length === 1 &&
    results[0]?.status === "correct" &&
    tokenCoverage(elements[0].text, enteredAnswer, options).expectedTokenCount !==
      tokenCoverage(elements[0].text, enteredAnswer, options).answerTokenCount;
  const freeTextUnmatched =
    !isList &&
    elements.length === 1 &&
    correctCount === 0 &&
    incompleteCount === 0 &&
    missingCount === 1 &&
    !clearlyIncorrect;
  if (freeTextUnmatched) {
    results[0] = {
      ...results[0],
      status: "unverified",
      missingText: "",
    };
    missingCount = 0;
  }
  const inconclusive =
    unrecognizedExtras.length > 0 ||
    freeTextHasUnmatchedTerms ||
    freeTextUnmatched;
  const status =
    incorrectTerms.length || clearlyIncorrect
      ? "incorrect"
      : inconclusive
        ? "inconclusive"
        : incompleteCount && correctCount === 0
          ? "incomplete"
          : incompleteCount || missingCount
            ? "partial"
            : "correct";
  const message =
    status === "correct"
      ? `Você identificou corretamente ${correctCount} de ${elements.length} elemento(s).`
      : status === "partial"
        ? `Você identificou corretamente ${correctCount} de ${elements.length} elemento(s), com ${incompleteCount} incompleto(s) e ${missingCount} ausente(s).`
        : status === "incomplete"
          ? `A resposta está incompleta: nenhum elemento foi identificado por inteiro e ${incompleteCount} ficou(aram) parcial(is).`
        : status === "incorrect"
          ? "A resposta não corresponde ao conteúdo esperado para este cartão."
          : "A comparação local encontrou divergências, mas não consegue confirmar equivalência semântica com segurança. Consulte a resposta oficial.";
  const hasApproximateMatch = elements.some((element) =>
    results.some(
      (item) =>
        item.official === element.text &&
        item.matchedText &&
        scoreElement(element, item.matchedText, options).typoMatched,
    ),
  );
  return {
    id: `flashcard_attempt_${attemptedAt.getTime()}_${Math.random().toString(16).slice(2)}`,
    attemptedAt: attemptedAt.toISOString(),
    submittedAnswer: enteredAnswer,
    officialAnswer: String(card.back || ""),
    status,
    completionPercent,
    confidence:
      status === "inconclusive" ? "low" : hasApproximateMatch ? "medium" : "high",
    correctCount,
    incompleteCount,
    missingCount,
    unverifiedCount: freeTextUnmatched ? 1 : 0,
    incorrectCount: incorrectTerms.length + (clearlyIncorrect ? 1 : 0),
    incorrectTerms,
    unrecognizedExtras,
    elements: results,
    message,
    method: "local-text",
    semanticAnalysis: "not-configured",
  };
}

export function recordFlashcardAttempt(card, answerAttempt) {
  if (!answerAttempt?.id || !answerAttempt.submittedAnswer) {
    throw new Error("A tentativa corrigida não contém uma resposta válida.");
  }
  const entry = {
    id: answerAttempt.id,
    attemptedAt: answerAttempt.attemptedAt,
    submittedAnswer: answerAttempt.submittedAnswer,
    officialAnswer: answerAttempt.officialAnswer,
    answerAttempt,
    rating: null,
    nextReviewDate: null,
  };
  const history = [...(card.history || [])];
  const existingIndex = history.findIndex((entry) => entry.id === answerAttempt.id);
  if (existingIndex >= 0) {
    history[existingIndex] = {
      ...history[existingIndex],
      attemptedAt: entry.attemptedAt,
      submittedAnswer: entry.submittedAnswer,
      officialAnswer: entry.officialAnswer,
      answerAttempt,
    };
  } else {
    history.push(entry);
  }
  return {
    ...card,
    updatedAt: answerAttempt.attemptedAt,
    history,
  };
}

export function recordFlashcardSessionAttempt(
  card,
  {
    sessionId,
    reviewStageId = "",
    reviewStageType = "",
    attempt,
    attemptNumber,
  },
) {
  if (!sessionId || !attempt?.id || !attempt.submittedAnswer) {
    throw new Error("A tentativa da sessão não contém os dados necessários.");
  }
  const history = [...(card.history || [])];
  let index = history.findIndex(
    (entry) =>
      entry.activityType === "flashcard-review" &&
      entry.sessionId === sessionId,
  );
  if (index < 0) {
    index = history.length;
    history.push({
      id: sessionId,
      sessionId,
      activityType: "flashcard-review",
      reviewStageId: reviewStageId || "",
      reviewStageType: reviewStageType || "",
      subjectId: card.subjectId || "",
      topicId: card.topicId || "",
      subjectLabel: card.subjectLabel || "",
      topicLabel: card.topicLabel || "",
      startedAt: attempt.attemptedAt,
      attempts: [],
      reviewedAt: null,
      rating: null,
      nextReviewDate: null,
    });
  }
  const entry = history[index];
  const attempts = [...(entry.attempts || [])];
  const existingAttemptIndex = attempts.findIndex(
    (item) => item.id === attempt.id,
  );
  const attemptEntry = { ...attempt, attemptNumber };
  if (existingAttemptIndex >= 0) attempts[existingAttemptIndex] = attemptEntry;
  else attempts.push(attemptEntry);
  history[index] = {
    ...entry,
    reviewStageId: reviewStageId || entry.reviewStageId || "",
    reviewStageType: reviewStageType || entry.reviewStageType || "",
    attempts,
  };
  return {
    ...card,
    updatedAt: attempt.attemptedAt,
    history,
  };
}

export function completeFlashcardSession(
  card,
  {
    sessionId,
    reviewStageId = "",
    reviewStageType = "",
    now = new Date(),
    rating,
    outcome,
    consulted = false,
  },
) {
  if (!sessionId) throw new Error("A sessão de flashcards não foi identificada.");
  if (!FLASHCARD_RATINGS.some((item) => item.id === rating)) {
    throw new Error(`Avaliação de flashcard inválida: ${rating}`);
  }
  const history = [...(card.history || [])];
  let index = history.findIndex(
    (entry) =>
      entry.activityType === "flashcard-review" &&
      entry.sessionId === sessionId,
  );
  if (index >= 0 && history[index].reviewedAt) return card;
  const reviewedDate = localDateISO(now);
  const entry = index >= 0
    ? history[index]
    : {
        id: sessionId,
        sessionId,
        activityType: "flashcard-review",
        subjectId: card.subjectId || "",
        topicId: card.topicId || "",
        subjectLabel: card.subjectLabel || "",
        topicLabel: card.topicLabel || "",
        startedAt: now.toISOString(),
        attempts: [],
      };
  const attempts = entry.attempts || [];
  const usedAttempts = attempts.filter(
    (attempt) => attempt.status !== "inconclusive",
  );
  const firstTryCorrect =
    usedAttempts.length === 1 && outcome === "correct-first";
  const secondTryCorrect =
    usedAttempts.length >= 2 && outcome === "correct-second";
  const finalEntry = {
    ...entry,
    id: sessionId,
    reviewStageId: reviewStageId || entry.reviewStageId || "",
    reviewStageType: reviewStageType || entry.reviewStageType || "",
    reviewedAt: now.toISOString(),
    reviewedDate,
    rating,
    outcome,
    consulted: Boolean(consulted),
    attemptCount: usedAttempts.length,
    firstTryCorrect,
    secondTryCorrect,
    incorrect: outcome === "incorrect",
    intervalDays: entry.intervalDays ?? null,
    nextReviewDate: entry.nextReviewDate || null,
  };
  if (index < 0) {
    index = history.length;
    history.push(finalEntry);
  } else {
    history[index] = finalEntry;
  }
  const positive = rating === "good" || rating === "easy";
  return {
    ...card,
    updatedAt: now.toISOString(),
    schedule: {
      ...card.schedule,
      lastReviewedAt: now.toISOString(),
      lastReviewedDate: reviewedDate,
      nextReviewDate: card.schedule?.nextReviewDate || null,
      repetitions: (Number(card.schedule?.repetitions) || 0) + 1,
      positiveReviews:
        (Number(card.schedule?.positiveReviews) || 0) + (positive ? 1 : 0),
      negativeReviews:
        (Number(card.schedule?.negativeReviews) || 0) + (positive ? 0 : 1),
      lastRating: rating,
    },
    history,
  };
}

export function flashcardTopicActivity(cards, { subjectId = "", topicId = "" } = {}, today = localDateISO()) {
  const allCards = normalizeFlashcards(cards).filter((card) => !card.archived);
  const matchingCards = allCards.filter(
    (card) =>
      (!subjectId || card.subjectId === String(subjectId)) &&
      (!topicId || card.topicId === String(topicId)),
  );
  const activities = allCards.flatMap((card) =>
    card.history
      .filter(
        (entry) =>
          (entry.activityType === "flashcard-review" ||
            (entry.reviewedAt && entry.rating)) &&
          entry.reviewedAt &&
          (!subjectId ||
            String(entry.subjectId || card.subjectId) === String(subjectId)) &&
          (!topicId ||
            String(entry.topicId || card.topicId) === String(topicId)),
      )
      .map((entry) => ({
        ...entry,
        sessionId: entry.sessionId || entry.id,
        cardId: card.id,
      })),
  );
  activities.sort(
    (left, right) =>
      new Date(right.reviewedAt).getTime() -
      new Date(left.reviewedAt).getTime(),
  );
  const latestSessionId = activities[0]?.sessionId;
  const latestSession = activities.filter(
    (entry) => entry.sessionId === latestSessionId,
  );
  return {
    reviewed: activities.length > 0,
    lastReviewedAt: activities[0]?.reviewedAt || null,
    totalCards: matchingCards.length,
    neverReviewed: matchingCards.filter(
      (card) => flashcardStatus(card, today) === "new",
    ).length,
    cardsReviewed: new Set(latestSession.map((entry) => entry.cardId)).size,
    correctFirstTry: latestSession.filter((entry) => entry.firstTryCorrect).length,
    correctSecondTry: latestSession.filter((entry) => entry.secondTryCorrect).length,
    incorrect: latestSession.filter((entry) => entry.incorrect).length,
    consulted: latestSession.filter((entry) => entry.consulted).length,
  };
}

export function normalizeFlashcards(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((card) => card && typeof card === "object" && card.id)
    .map((card) => {
      const history = Array.isArray(card.history) ? card.history : [];
      const validReviews = history.filter(
        (entry) =>
          entry?.reviewedAt ||
          (entry?.rating && (entry?.reviewedDate || entry?.nextReviewDate)),
      );
      const latestReview = validReviews
        .slice()
        .sort(
          (left, right) =>
            new Date(right.reviewedAt || right.reviewedDate).getTime() -
            new Date(left.reviewedAt || left.reviewedDate).getTime(),
        )[0];
      const savedSchedule = card.schedule || {};
      const repetitions = Math.max(
        0,
        Number(savedSchedule.repetitions) || 0,
        validReviews.length,
      );
      return {
        ...card,
        schemaVersion: FLASHCARD_STATE_VERSION,
        subjectId: card.subjectId ? String(card.subjectId) : "",
        topicId: card.topicId ? String(card.topicId) : "",
        tags: Array.isArray(card.tags)
          ? card.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : String(card.tags || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
        archived: Boolean(card.archived),
        schedule: {
          lastReviewedAt:
            savedSchedule.lastReviewedAt || latestReview?.reviewedAt || null,
          lastReviewedDate:
            savedSchedule.lastReviewedDate ||
            latestReview?.reviewedDate ||
            null,
          nextReviewDate:
            savedSchedule.nextReviewDate || latestReview?.nextReviewDate || null,
          repetitions,
          positiveReviews: Math.max(
            0,
            Number(savedSchedule.positiveReviews) || 0,
          ),
          negativeReviews: Math.max(
            0,
            Number(savedSchedule.negativeReviews) || 0,
          ),
          lastRating: savedSchedule.lastRating || latestReview?.rating || null,
          intervalDays: Math.max(
            0,
            Number(savedSchedule.intervalDays) ||
              Number(latestReview?.intervalDays) ||
              0,
          ),
        },
        history,
        correctionCriteria:
          card.correctionCriteria && typeof card.correctionCriteria === "object"
            ? card.correctionCriteria
            : {},
      };
    });
}

export function mergeCompletionFlashcards(
  cards,
  drafts,
  {
    examId = "",
    subjectId,
    subjectLabel = "",
    topicOptions = [],
    sourceBlockId = "",
    now = new Date().toISOString(),
  },
) {
  const topicsById = new Map(
    topicOptions.map((topic) => [String(topic.id), topic]),
  );
  const merged = new Map(
    normalizeFlashcards(cards).map((card) => [String(card.id), card]),
  );
  drafts.forEach((draft) => {
    const id = String(draft.id || "");
    const front = String(draft.front || "").trim();
    const back = String(draft.back || "").trim();
    const topic = topicsById.get(String(draft.topicId || ""));
    if (!id || !subjectId || !front || !back || !topic) {
      throw new Error("Cada flashcard precisa de frente, verso e assunto válido.");
    }
    const previous = merged.get(id);
    merged.set(id, {
      ...(previous || {}),
      id,
      schemaVersion: FLASHCARD_STATE_VERSION,
      examKey: examId,
      subjectId: String(subjectId),
      topicId: String(topic.id),
      subjectLabel,
      topicLabel: topic.title,
      front,
      back,
      notes: previous?.notes || "",
      tags: previous?.tags || [],
      archived: Boolean(previous?.archived),
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      sourceCompletionBlockId:
        previous?.sourceCompletionBlockId || sourceBlockId,
      schedule: previous?.schedule || {
        lastReviewedAt: null,
        lastReviewedDate: null,
        nextReviewDate: null,
        repetitions: 0,
        positiveReviews: 0,
        negativeReviews: 0,
        lastRating: null,
        intervalDays: 0,
      },
      history: previous?.history || [],
    });
  });
  return [...merged.values()];
}

export function flashcardStatus(card) {
  if (card.archived) return "archived";
  const normalized = normalizeFlashcards([card])[0];
  return normalized?.schedule?.repetitions ? "reviewed" : "new";
}

export function pendingFlashcardsForTarget(
  cards,
  { examId = "", subjectId = "", topicId = "" } = {},
  today = localDateISO(),
  { includeNew = false, statuses = null } = {},
) {
  return normalizeFlashcards(cards).filter(
    (card) =>
      !card.archived &&
      (!examId ||
        !String(card.examId || card.examKey || "") ||
        String(card.examId || card.examKey) === String(examId)) &&
      (!subjectId || card.subjectId === String(subjectId)) &&
      (!topicId || card.topicId === String(topicId)) &&
      (Array.isArray(statuses)
        ? statuses.includes(flashcardStatus(card))
        : includeNew && flashcardStatus(card) === "new"),
  );
}

function normalizedReviewDate(value) {
  const raw = String(value || "").trim();
  const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDate?.[1] || "";
}

function hasCompletedReviewStage(card, reviewId) {
  return normalizeFlashcards([card])[0].history.some(
    (entry) =>
      entry.reviewedAt &&
      String(entry.reviewStageId || entry.reviewId || "") ===
        String(reviewId),
  );
}

export function prioritizeFlashcardsForReview(cards) {
  const historyPriority = (card) => {
    const entries = normalizeFlashcards([card])[0].history;
    const mistakes = entries.reduce((score, entry) => {
      const attempts = Array.isArray(entry.attempts) ? entry.attempts : [];
      return (
        score +
        (entry.incorrect || entry.outcome === "incorrect" ? 100 : 0) +
        attempts.filter(
          (attempt) =>
            attempt.status === "incorrect" || attempt.status === "incomplete",
        ).length *
          20 +
        (entry.rating === "again" ? 40 : entry.rating === "hard" ? 20 : 0)
      );
    }, 0);
    return mistakes;
  };
  return [...cards].sort(
    (left, right) =>
      historyPriority(right) - historyPriority(left) ||
      String(left.front || "").localeCompare(String(right.front || ""), "pt-BR"),
  );
}

export function flashcardsForReviewStage(
  cards,
  review,
  { examId = "", today = localDateISO() } = {},
) {
  const dueDate = normalizedReviewDate(review?.date);
  if (
    !review?.id ||
    !dueDate ||
    dueDate > today ||
    (examId &&
      review.examId &&
      String(review.examId) !== String(examId))
  ) {
    return [];
  }
  const subjectId = String(review.subjectId || "");
  const topicId = String(review.topicId || "");
  if (!subjectId) return [];
  const uniqueCards = new Map(
    normalizeFlashcards(cards).map((card) => [String(card.id), card]),
  );
  const eligible = [...uniqueCards.values()].filter((card) => {
    const cardExamId = String(card.examId || card.examKey || "");
    return (
      !card.archived &&
      (!examId || !cardExamId || cardExamId === String(examId)) &&
      card.subjectId === subjectId &&
      card.topicId === topicId &&
      !hasCompletedReviewStage(card, review.id)
    );
  });
  return prioritizeFlashcardsForReview(eligible);
}

export function flashcardNeedsAttention(card) {
  const normalized = normalizeFlashcards([card])[0];
  return (
    normalized.schedule.lastRating === "again" ||
    normalized.schedule.lastRating === "hard" ||
    normalized.history.some(
      (entry) =>
        entry.incorrect ||
        entry.outcome === "incorrect" ||
        entry.rating === "again" ||
        entry.rating === "hard" ||
        (entry.attempts || []).some(
          (attempt) =>
            attempt.status === "incorrect" || attempt.status === "incomplete",
        ),
    )
  );
}

export function resolveReviewFlashcardTarget(review, roadmap) {
  const title = String(review?.title || "").toLocaleLowerCase("pt-BR");
  const subject =
    roadmap.find((item) => item.id === String(review?.subjectId || "")) ||
    roadmap.find((item) =>
      title.startsWith(`${String(item.subject || "").toLocaleLowerCase("pt-BR")}:`),
    );
  if (!subject) return null;
  const explicitTopicId = String(review?.topicId || "");
  const remainingTitle = title.startsWith(
    `${String(subject.subject || "").toLocaleLowerCase("pt-BR")}:`,
  )
    ? title.slice(String(subject.subject || "").length + 1).trim()
    : title;
  const topic =
    subject.topics?.find((item) => item.id === explicitTopicId) ||
    subject.topics?.find(
      (item) => String(item.title || "").toLocaleLowerCase("pt-BR") === remainingTitle,
    );
  return { subjectId: subject.id, topicId: topic?.id || "" };
}

export function groupFlashcardDashboardActivities({
  traditionalReviews = [],
  cards = [],
  roadmap = [],
  examId = "",
  today = localDateISO(),
}) {
  const groups = new Map();
  const getGroup = ({ contextExamId, subjectId, topicId }) => {
    const key = `${contextExamId || ""}|${subjectId || ""}|${topicId || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        examId: contextExamId || "",
        subjectId: subjectId || "",
        topicId: topicId || "",
        subject: "",
        topic: "",
        traditional: [],
        flashcardStages: [],
      });
    }
    return groups.get(key);
  };

  traditionalReviews.forEach(({ review, status }) => {
    if (!review?.id || !["overdue", "due"].includes(status)) return;
    const target = resolveReviewFlashcardTarget(review, roadmap);
    const subjectId = target?.subjectId || String(review.subjectId || "");
    const topicId = target?.topicId || String(review.topicId || "");
    if (!subjectId) return;
    const subject = roadmap.find((item) => item.id === subjectId);
    const topic = subject?.topics?.find((item) => item.id === topicId);
    const group = getGroup({
      contextExamId: review.examId || examId,
      subjectId,
      topicId,
    });
    group.subject = subject?.subject || review.title || "Matéria";
    group.topic = topic?.title || review.topic || "";
    if (
      review.status !== "concluida" &&
      !group.traditional.some((item) => item.id === review.id)
    ) {
      group.traditional.push({ ...review, activityStatus: status });
    }
    const stageCards = flashcardsForReviewStage(cards, review, {
      examId,
      today,
    });
    if (stageCards.length) {
      group.flashcardStages.push({
        reviewId: review.id,
        reviewType: review.type,
        reviewDate: review.date,
        activityStatus: status,
        cards: stageCards,
      });
    }
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      traditional: group.traditional.sort(
        (left, right) =>
          String(left.date || "").localeCompare(String(right.date || "")) ||
          String(left.type || "").localeCompare(String(right.type || ""), "pt-BR"),
      ),
      flashcardStages: [
        ...new Map(
          group.flashcardStages.map((stage) => [stage.reviewId, stage]),
        ).values(),
      ],
    }))
    .sort((left, right) => {
      const priority = (group) =>
        group.traditional.some(
          (review) => review.activityStatus === "overdue",
        ) ||
        group.flashcardStages.some((stage) => stage.activityStatus === "overdue")
          ? 0
          : group.traditional.length || group.flashcardStages.length
            ? 1
            : 2;
      return (
        priority(left) - priority(right) ||
        left.subject.localeCompare(right.subject, "pt-BR") ||
        left.topic.localeCompare(right.topic, "pt-BR")
      );
    })
    .filter((group) => group.traditional.length || group.flashcardStages.length);
}

export function getFlashcardSummary(cards) {
  const activeCards = normalizeFlashcards(cards).filter((card) => !card.archived);
  const counts = activeCards.reduce(
    (result, card) => {
      const status = flashcardStatus(card);
      result[status] += 1;
      if (status !== "new") result.reviewedEver += 1;
      return result;
    },
    { new: 0, reviewed: 0, reviewedEver: 0 },
  );
  return {
    total: activeCards.length,
    ...counts,
    reviewedEver: counts.reviewedEver,
    completion:
      activeCards.length === 0
        ? 0
        : Math.round((counts.reviewedEver / activeCards.length) * 100),
  };
}

export function recordFlashcardReview(
  card,
  rating,
  now = new Date(),
  answerAttempt = null,
) {
  if (!FLASHCARD_RATINGS.some((item) => item.id === rating)) {
    throw new Error(`Avaliação de flashcard inválida: ${rating}`);
  }
  const reviewedDate = localDateISO(now);
  const historyEntry = {
    id: `flashcard_review_${now.getTime()}_${Math.random().toString(16).slice(2)}`,
    reviewedAt: now.toISOString(),
    reviewedDate,
    rating,
    answerAttempt,
    correction: answerAttempt
      ? {
          status: answerAttempt.status,
          completionPercent: answerAttempt.completionPercent,
          confidence: answerAttempt.confidence,
          correctCount: answerAttempt.correctCount,
          incompleteCount: answerAttempt.incompleteCount,
          missingCount: answerAttempt.missingCount,
          incorrectCount: answerAttempt.incorrectCount,
          autoRating: answerAttempt.status,
        }
      : null,
    intervalDays: card.schedule?.intervalDays || 0,
    nextReviewDate: null,
  };
  const existingAttemptIndex = answerAttempt
    ? (card.history || []).findIndex((entry) => entry.id === answerAttempt.id)
    : -1;
  if (existingAttemptIndex >= 0) {
    historyEntry.id = answerAttempt.id;
  }
  const history = [...(card.history || [])];
  const reviewedEntry = {
    ...historyEntry,
    submittedAnswer: answerAttempt?.submittedAnswer || null,
    officialAnswer: answerAttempt?.officialAnswer || card.back,
    answerAttempt: answerAttempt || null,
    correction: answerAttempt
      ? {
          status: answerAttempt.status,
          completionPercent: answerAttempt.completionPercent,
          confidence: answerAttempt.confidence,
          correctCount: answerAttempt.correctCount,
          incompleteCount: answerAttempt.incompleteCount,
          missingCount: answerAttempt.missingCount,
          incorrectCount: answerAttempt.incorrectCount,
          autoRating: answerAttempt.status,
        }
      : null,
  };
  if (existingAttemptIndex >= 0) history[existingAttemptIndex] = reviewedEntry;
  else history.push(reviewedEntry);
  const positive = rating === "good" || rating === "easy";
  return {
    ...card,
    updatedAt: now.toISOString(),
    schedule: {
      ...card.schedule,
      lastReviewedAt: now.toISOString(),
      lastReviewedDate: reviewedDate,
      nextReviewDate: card.schedule?.nextReviewDate || null,
      repetitions: (Number(card.schedule?.repetitions) || 0) + 1,
      positiveReviews:
        (Number(card.schedule?.positiveReviews) || 0) + (positive ? 1 : 0),
      negativeReviews:
        (Number(card.schedule?.negativeReviews) || 0) + (positive ? 0 : 1),
      lastRating: rating,
    },
    history,
  };
}
