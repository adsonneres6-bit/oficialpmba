import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tag,
  X,
} from "lucide-react";
import {
  FLASHCARD_STATE_VERSION,
  FLASHCARD_RATINGS,
  analyzeFlashcardAnswer,
  completeFlashcardSession,
  formatLocalDate,
  flashcardNeedsAttention,
  flashcardsForReviewStage,
  flashcardTopicActivity,
  getFlashcardSummary,
  localDateISO,
  normalizeFlashcards,
  pendingFlashcardsForTarget,
  recordFlashcardSessionAttempt,
  flashcardStatus,
} from "../lib/flashcards.js";

const EMPTY_FORM = {
  subjectId: "",
  topicId: "",
  front: "",
  back: "",
  notes: "",
  tags: "",
  difficulty: "",
  answerType: "free",
  requiredElementsText: "",
  incorrectTermsText: "",
  correctionNotes: "",
  ignoreAccents: true,
};

function Metric({ label, value, detail, tone = "stone" }) {
  const colors = {
    stone: "bg-stone-950 text-white",
    amber: "bg-amber-100 text-amber-950",
    red: "bg-red-100 text-red-900",
    green: "bg-emerald-100 text-emerald-900",
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}

function OfficialCorrectionText({ element }) {
  if (element.status !== "incomplete" || !element.missingText) {
    return element.official;
  }
  const start = element.official
    .toLocaleLowerCase("pt-BR")
    .indexOf(element.missingText.toLocaleLowerCase("pt-BR"));
  if (start < 0) return element.official;
  const end = start + element.missingText.length;
  return (
    <>
      {element.official.slice(0, start)}
      <mark className="rounded bg-red-200 px-0.5 font-bold text-red-950 underline decoration-2 underline-offset-2">
        {element.official.slice(start, end)}
      </mark>
      {element.official.slice(end)}
    </>
  );
}

function emptySchedule() {
  return {
    lastReviewedAt: null,
    lastReviewedDate: null,
    nextReviewDate: null,
    repetitions: 0,
    positiveReviews: 0,
    negativeReviews: 0,
    lastRating: null,
    intervalDays: 0,
  };
}

export default function Flashcards({
  cards,
  onCardsChange,
  onCommitCards,
  roadmap,
  activeExamKey,
  reviewStages = [],
  studyTarget,
  onStudyTargetConsumed,
}) {
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [sessionAnswers, setSessionAnswers] = useState({});
  const [sessionCorrections, setSessionCorrections] = useState({});
  const [sessionAttempts, setSessionAttempts] = useState({});
  const [correctionError, setCorrectionError] = useState("");
  const [showOfficial, setShowOfficial] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const correctedAnswersRef = useRef({});
  const ratedCardsRef = useRef(new Set());
  const correctionLockRef = useRef(false);
  const completionLockRef = useRef(new Set());

  const activeCards = useMemo(() => normalizeFlashcards(cards), [cards]);
  const today = localDateISO();
  const summary = useMemo(
    () => getFlashcardSummary(activeCards, today),
    [activeCards, today],
  );
  const cardsAvailableForStages = useMemo(() => {
    const available = new Map();
    reviewStages.forEach((review) =>
      flashcardsForReviewStage(activeCards, review, {
        examId: activeExamKey,
        today,
      }).forEach((card) => available.set(card.id, card)),
    );
    return [...available.values()];
  }, [activeCards, activeExamKey, reviewStages, today]);
  const cardsNeedingReinforcement = useMemo(
    () => activeCards.filter(flashcardNeedsAttention).length,
    [activeCards],
  );
  const availableTopics = useMemo(
    () =>
      roadmap
        .find((subject) => subject.id === form.subjectId)
        ?.topics?.map((topic) => ({ id: topic.id, title: topic.title })) || [],
    [form.subjectId, roadmap],
  );

  useEffect(() => {
    if (!studyTarget) return;
    const dueCards = studyTarget.reviewId
      ? flashcardsForReviewStage(
          activeCards,
          {
            id: studyTarget.reviewId,
            type: studyTarget.reviewType,
            date: studyTarget.reviewDate,
            subjectId: studyTarget.subjectId,
            topicId: studyTarget.topicId,
          },
          { examId: studyTarget.examId || activeExamKey, today },
        )
      : pendingFlashcardsForTarget(activeCards, studyTarget, today, {
          includeNew: Boolean(studyTarget.includeNew),
          statuses: studyTarget.statuses || null,
        });
    if (dueCards.length) beginSession(dueCards, studyTarget);
    onStudyTargetConsumed?.();
    // A review action is a one-shot request, not a live session dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyTarget]);

  const subjectFor = (card) =>
    roadmap.find((subject) => subject.id === card.subjectId);
  const topicFor = (card) =>
    subjectFor(card)?.topics?.find((topic) => topic.id === card.topicId);
  const hasMissingLink = (card) =>
    !subjectFor(card) || Boolean(card.topicId && !topicFor(card));

  const uniqueTags = useMemo(
    () => [...new Set(activeCards.flatMap((card) => card.tags || []))].sort(),
    [activeCards],
  );
  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return activeCards.filter((card) => {
      const status = flashcardStatus(card, today);
      const matchesSubject =
        subjectFilter === "all" || card.subjectId === subjectFilter;
      const matchesTopic = topicFilter === "all" || card.topicId === topicFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesTag =
        tagFilter === "all" || card.tags.includes(tagFilter);
      const correctedHistory = card.history.filter(
        (entry) => entry.answerAttempt,
      );
      const omissionAttempts = correctedHistory.filter(
        (entry) =>
          entry.answerAttempt.incompleteCount > 0 ||
          entry.answerAttempt.missingCount > 0,
      ).length;
      const hasLowPerformance = card.history.some(
        (entry) =>
          entry.rating === "again" ||
          (entry.answerAttempt &&
            entry.answerAttempt.completionPercent < 70),
      );
      const matchesPerformance =
        performanceFilter === "all" ||
        (performanceFilter === "omissions" && omissionAttempts >= 2) ||
        (performanceFilter === "low" && hasLowPerformance);
      const text = [
        card.front,
        card.back,
        card.notes,
        card.tags.join(" "),
        card.subjectLabel,
        card.topicLabel,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return (
        matchesSubject &&
        matchesTopic &&
        matchesStatus &&
        matchesTag &&
        matchesPerformance &&
        (!normalizedQuery || text.includes(normalizedQuery))
      );
    });
  }, [
    activeCards,
    query,
    performanceFilter,
    statusFilter,
    subjectFilter,
    tagFilter,
    today,
    topicFilter,
  ]);

  const sessionCard = session
    ? activeCards.find((card) => card.id === session.cardIds[session.index])
    : null;
  const sessionRated = session?.outcomes?.some(
    (outcome) => outcome.cardId === sessionCard?.id,
  );

  function beginSession(sessionCards, target = null) {
    const queue = [...new Map(sessionCards.map((card) => [card.id, card])).values()];
    if (!queue.length) return;
    setSession({
      id: `flashcard_session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      cardIds: queue.map((card) => card.id),
      index: 0,
      startedAt: new Date().toISOString(),
      outcomes: [],
      finished: false,
      reviewStageId: target?.reviewId || "",
      reviewType: target?.reviewType || "",
      reviewDate: target?.reviewDate || "",
    });
    setSessionAnswers({});
    setSessionCorrections({});
    setSessionAttempts({});
    setCorrectionError("");
    setShowOfficial(false);
    setSavingReview(false);
    correctedAnswersRef.current = {};
    ratedCardsRef.current.clear();
    setAnswerVisible(false);
  }

  async function commitCards(nextCards) {
    if (onCommitCards) return onCommitCards(nextCards);
    onCardsChange(nextCards);
    return { ok: true, source: "local" };
  }

  function startCard(card) {
    beginSession([card]);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, subjectId: roadmap[0]?.id || "" });
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(card) {
    setEditingId(card.id);
    setForm({
      subjectId: card.subjectId || "",
      topicId: card.topicId || "",
      front: card.front || "",
      back: card.back || "",
      notes: card.notes || "",
      tags: (card.tags || []).join(", "),
      difficulty: card.difficulty || "",
      answerType: card.correctionCriteria?.answerType || card.answerType || "free",
      requiredElementsText: (
        card.correctionCriteria?.requiredElements || card.requiredElements || []
      )
        .map((element) =>
          typeof element === "string"
            ? element
            : `${element.text || ""}${
                element.acceptedVariants?.length
                  ? ` = ${element.acceptedVariants.join(" | ")}`
                  : ""
              }`,
        )
        .join("\n"),
      incorrectTermsText: (
        card.correctionCriteria?.incorrectTerms || card.incorrectTerms || []
      ).join(", "),
      correctionNotes: card.correctionCriteria?.notes || "",
      ignoreAccents: card.correctionCriteria?.ignoreAccents !== false,
    });
    setFormError("");
    setFormOpen(true);
  }

  function saveCard(event) {
    event.preventDefault();
    const front = form.front.trim();
    const back = form.back.trim();
    if (!front || !back) {
      setFormError("Preencha a frente e o verso do cartão.");
      return;
    }
    if (!form.subjectId) {
      setFormError("Selecione uma matéria do edital ativo.");
      return;
    }
    const subject = roadmap.find((item) => item.id === form.subjectId);
    const topic = subject?.topics?.find((item) => item.id === form.topicId);
    const originalCard = activeCards.find((card) => card.id === editingId);
    if (
      !subject &&
      (!originalCard || originalCard.subjectId !== form.subjectId)
    ) {
      setFormError("A matéria selecionada não pertence ao edital ativo.");
      return;
    }
    if (
      subject &&
      form.topicId &&
      !topic &&
      (!originalCard ||
        originalCard.subjectId !== form.subjectId ||
        originalCard.topicId !== form.topicId)
    ) {
      setFormError("O assunto selecionado não pertence à matéria escolhida.");
      return;
    }
    const now = new Date().toISOString();
    const tags = [...new Set(form.tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
    const requiredElements = form.requiredElementsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [text, variants = ""] = line.split("=", 2);
        return {
          text: text.trim(),
          acceptedVariants: variants
            .split("|")
            .map((variant) => variant.trim())
            .filter(Boolean),
        };
      });
    const incorrectTerms = form.incorrectTermsText
      .split(/[,\r\n]+/)
      .map((term) => term.trim())
      .filter(Boolean);
    const correctionCriteria = {
      answerType: form.answerType,
      requiredElements,
      incorrectTerms,
      notes: form.correctionNotes.trim(),
      ignoreAccents: form.ignoreAccents,
    };
    if (editingId) {
      onCardsChange((current) =>
        normalizeFlashcards(current).map((card) =>
          card.id === editingId
            ? {
                ...card,
                subjectId: form.subjectId,
                topicId: form.topicId,
                subjectLabel: subject?.subject || originalCard.subjectLabel || "",
                topicLabel: topic?.title || originalCard.topicLabel || "",
                front,
                back,
                notes: form.notes.trim(),
                tags,
                difficulty: form.difficulty,
                answerType: form.answerType,
                correctionCriteria,
                updatedAt: now,
              }
            : card,
        ),
      );
    } else {
      const card = {
        id: `flashcard_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        schemaVersion: FLASHCARD_STATE_VERSION,
        examKey: activeExamKey,
        subjectId: form.subjectId,
        topicId: form.topicId,
        subjectLabel: subject.subject,
        topicLabel: topic?.title || "",
        front,
        back,
        notes: form.notes.trim(),
        tags,
        difficulty: form.difficulty,
        answerType: form.answerType,
        correctionCriteria,
        archived: false,
        createdAt: now,
        updatedAt: now,
        schedule: emptySchedule(),
        history: [],
      };
      onCardsChange((current) => [...normalizeFlashcards(current), card]);
    }
    setFormOpen(false);
    setFormError("");
  }

  function setArchived(cardId, archived) {
    onCardsChange((current) =>
      normalizeFlashcards(current).map((card) =>
        card.id === cardId
          ? { ...card, archived, updatedAt: new Date().toISOString() }
          : card,
      ),
    );
    setConfirmArchiveId(null);
  }

  function deleteCard(cardId) {
    onCardsChange((current) =>
      normalizeFlashcards(current).filter((card) => card.id !== cardId),
    );
    setConfirmDeleteId(null);
  }

  async function finalizeCurrentCard({
    rating,
    outcome,
    consulted = false,
    cardOverride = null,
    stayOnCard = false,
  }) {
    if (
      !session ||
      !sessionCard ||
      sessionRated ||
      ratedCardsRef.current.has(sessionCard.id) ||
      completionLockRef.current.has(sessionCard.id)
    ) {
      return false;
    }
    const now = new Date();
    completionLockRef.current.add(sessionCard.id);
    setSavingReview(true);
    setCorrectionError("");
    try {
      const updatedCard = completeFlashcardSession(
        cardOverride || sessionCard,
        {
          sessionId: session.id,
          reviewStageId: session.reviewStageId,
          reviewStageType: session.reviewType,
          now,
          rating,
          outcome,
          consulted,
        },
      );
      const nextCards = activeCards.map((card) =>
        card.id === sessionCard.id ? updatedCard : card,
      );
      const result = await commitCards(nextCards);
      if (!result?.ok) {
        throw new Error(
          "Não foi possível confirmar a gravação da revisão. Tente novamente.",
        );
      }
      ratedCardsRef.current.add(sessionCard.id);
      const attempts = sessionAttempts[sessionCard.id] || [];
      const nextOutcomes = [
        ...session.outcomes,
        {
          cardId: sessionCard.id,
          rating,
          outcome,
          attempts: attempts.filter((attempt) => attempt.status !== "inconclusive").length,
          consulted,
        },
      ];
      const isLast = session.index >= session.cardIds.length - 1;
      setSession({
        ...session,
        outcomes: nextOutcomes,
        index: isLast || stayOnCard ? session.index : session.index + 1,
        finished: isLast && !stayOnCard,
        finishedAt: isLast && !stayOnCard ? now.toISOString() : null,
      });
      setAnswerVisible(stayOnCard);
      setShowOfficial(stayOnCard);
      setCorrectionError("");
      return true;
    } catch (error) {
      setCorrectionError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a revisão. Tente novamente.",
      );
      return false;
    } finally {
      completionLockRef.current.delete(sessionCard.id);
      setSavingReview(false);
    }
  }

  async function rateCurrentCard(rating) {
    const attempts = sessionAttempts[sessionCard?.id] || [];
    const validAttempts = attempts.filter(
      (attempt) => attempt.status !== "inconclusive",
    );
    const outcome =
      sessionCorrections[sessionCard?.id]?.status === "correct"
        ? validAttempts.length > 1
          ? "correct-second"
          : "correct-first"
        : "consulted";
    await finalizeCurrentCard({ rating, outcome, consulted: outcome === "consulted" });
  }

  async function correctCurrentAnswer() {
    if (!sessionCard || correctionLockRef.current || sessionRated) return;
    const answer = String(sessionAnswers[sessionCard.id] || "").trim();
    if (!answer || correctedAnswersRef.current[sessionCard.id] === answer) return;
    correctionLockRef.current = true;
    setSavingReview(true);
    setCorrectionError("");
    try {
      const result = analyzeFlashcardAnswer(sessionCard, answer, new Date());
      const attempts = sessionAttempts[sessionCard.id] || [];
      const validAttempts = attempts.filter(
        (attempt) => attempt.status !== "inconclusive",
      );
      const attemptNumber = validAttempts.length + 1;
      const cardWithAttempt = recordFlashcardSessionAttempt(sessionCard, {
        sessionId: session.id,
        reviewStageId: session.reviewStageId,
        reviewStageType: session.reviewType,
        attempt: result,
        attemptNumber,
      });
      if (result.status !== "correct" && result.status !== "inconclusive" && attemptNumber >= 2) {
        const completedCard = completeFlashcardSession(cardWithAttempt, {
          sessionId: session.id,
          reviewStageId: session.reviewStageId,
          reviewStageType: session.reviewType,
          now: new Date(),
          rating: "again",
          outcome: "incorrect",
        });
        const nextCards = activeCards.map((card) =>
          card.id === sessionCard.id ? completedCard : card,
        );
        const saveResult = await commitCards(nextCards);
        if (!saveResult?.ok) {
          throw new Error(
            "A segunda tentativa não foi salva. O texto foi preservado; tente corrigir novamente.",
          );
        }
        const nextAttempts = [...attempts, result];
        setSessionAttempts((current) => ({
          ...current,
          [sessionCard.id]: nextAttempts,
        }));
        setSessionCorrections((current) => ({
          ...current,
          [sessionCard.id]: result,
        }));
        correctedAnswersRef.current[sessionCard.id] = answer;
        ratedCardsRef.current.add(sessionCard.id);
        const nextOutcomes = [
          ...session.outcomes,
          {
            cardId: sessionCard.id,
            rating: "again",
            outcome: "incorrect",
            attempts: 2,
            consulted: false,
          },
        ];
        setSession({
          ...session,
          outcomes: nextOutcomes,
        });
        setShowOfficial(true);
        setAnswerVisible(true);
        return;
      }
      const nextCards = activeCards.map((card) =>
        card.id === sessionCard.id ? cardWithAttempt : card,
      );
      const saveResult = await commitCards(nextCards);
      if (!saveResult?.ok) {
        throw new Error(
          "Não foi possível salvar a tentativa. O texto foi preservado; tente novamente.",
        );
      }
      const nextAttempts = [...attempts, result];
      setSessionAttempts((current) => ({
        ...current,
        [sessionCard.id]: nextAttempts,
      }));
      setSessionCorrections((current) => ({
        ...current,
        [sessionCard.id]: result,
      }));
      correctedAnswersRef.current[sessionCard.id] = answer;
      setShowOfficial(result.status === "correct");
      setAnswerVisible(true);
    } catch (error) {
      setCorrectionError(
        error instanceof Error
          ? error.message
          : "Não foi possível analisar a resposta. Tente novamente.",
      );
    } finally {
      correctionLockRef.current = false;
      setSavingReview(false);
    }
  }

  async function revealOfficialAnswer() {
    const saved = await finalizeCurrentCard({
      rating: "again",
      outcome: "consulted",
      consulted: true,
      stayOnCard: true,
    });
    if (saved) {
      setShowOfficial(true);
      setAnswerVisible(true);
    }
  }

  function retryCurrentAnswer() {
    if (!sessionCard) return;
    correctedAnswersRef.current[sessionCard.id] = "";
    setSessionAnswers((current) => ({ ...current, [sessionCard.id]: "" }));
    setCorrectionError("");
    setShowOfficial(false);
    setAnswerVisible(false);
  }

  function moveSession(direction) {
    if (!session) return;
    const nextIndex = Math.max(
      0,
      Math.min(session.cardIds.length - 1, session.index + direction),
    );
    setSession({ ...session, index: nextIndex });
    setAnswerVisible(
      Boolean(sessionCorrections[session.cardIds[nextIndex]]),
    );
    const nextCardId = session.cardIds[nextIndex];
    const nextAttempts = sessionAttempts[nextCardId] || [];
    setShowOfficial(
      sessionCorrections[nextCardId]?.status === "correct" ||
        nextAttempts.filter((attempt) => attempt.status !== "inconclusive")
          .length >= 2 ||
        session.outcomes.some(
          (outcome) =>
            outcome.cardId === nextCardId && outcome.consulted,
        ),
    );
  }

  function finishSession() {
    setSession(null);
    setSessionAnswers({});
    setSessionCorrections({});
    setSessionAttempts({});
    setCorrectionError("");
    setShowOfficial(false);
    setAnswerVisible(false);
  }

  if (session?.finished) {
    const tally = Object.fromEntries(
      FLASHCARD_RATINGS.map((rating) => [
        rating.id,
        session.outcomes.filter((outcome) => outcome.rating === rating.id).length,
      ]),
    );
    const attemptTally = {
      firstTryCorrect: session.outcomes.filter(
        (outcome) => outcome.outcome === "correct-first",
      ).length,
      secondTryCorrect: session.outcomes.filter(
        (outcome) => outcome.outcome === "correct-second",
      ).length,
      incorrect: session.outcomes.filter(
        (outcome) => outcome.outcome === "incorrect",
      ).length,
      consulted: session.outcomes.filter((outcome) => outcome.consulted).length,
    };
    const studiedIds = new Set(session.outcomes.map((outcome) => outcome.cardId));
    const studiedCards = [...studiedIds]
      .map((cardId) => activeCards.find((card) => card.id === cardId))
      .filter(Boolean);
    const stillPending = session.cardIds.filter(
      (cardId) => !studiedIds.has(cardId),
    ).length;
    const reviewedSubjects = [
      ...new Set(
        studiedCards.map(
          (card) => subjectFor(card)?.subject || card.subjectLabel || "Matéria removida",
        ),
      ),
    ];
    const reviewedTopics = [
      ...new Set(
        studiedCards
          .map((card) => topicFor(card)?.title || card.topicLabel)
          .filter(Boolean),
      ),
    ];
    const elapsedSeconds = Math.max(
      0,
      Math.floor(
        (new Date(session.finishedAt || new Date()).getTime() -
          new Date(session.startedAt).getTime()) /
          1000,
      ),
    );
    return (
      <section className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900">Flashcards</p>
            <h2 className="text-2xl font-black">Resumo da sessão</h2>
          </div>
          <button
            onClick={finishSession}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            Voltar à biblioteca
          </button>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Cartões estudados" value={studiedIds.size} detail="Nesta sessão" />
          <Metric label="Acerto na 1ª" value={attemptTally.firstTryCorrect} detail="Recuperação imediata" tone="green" />
          <Metric label="Acerto na 2ª" value={attemptTally.secondTryCorrect} detail="Após nova tentativa" tone="amber" />
          <Metric label="Incorretos" value={attemptTally.incorrect} detail="Duas tentativas" tone="red" />
          <Metric label="Consultas" value={attemptTally.consulted} detail="Sem acerto presumido" tone="amber" />
          {FLASHCARD_RATINGS.map((rating) => (
            <Metric
              key={rating.id}
              label={rating.label}
              value={tally[rating.id]}
              detail="Avaliações registradas"
            />
          ))}
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-600">
            Tempo de sessão: {Math.floor(elapsedSeconds / 60)} min{" "}
            {elapsedSeconds % 60} s
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Matérias: {reviewedSubjects.join(", ") || "—"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Assuntos: {reviewedTopics.join(", ") || "—"}
          </p>
          <p className="font-semibold text-stone-800">
            {stillPending} cartão(ões) desta sessão não foram concluídos.
            {session.reviewType
              ? ` A etapa compartilhada ${session.reviewType} continua pendente para esses cartões.`
              : " Eles permanecem disponíveis para estudo; nenhuma agenda individual foi criada."}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            O histórico e as avaliações foram salvos ao responder cada cartão.
          </p>
          <button
            onClick={finishSession}
            className="mt-5 rounded-2xl bg-stone-950 px-5 py-3 font-semibold text-white"
          >
            Concluir
          </button>
        </div>
      </section>
    );
  }

  if (session && sessionCard) {
    const subject = subjectFor(sessionCard);
    const topic = topicFor(sessionCard);
    const currentAnswer = sessionAnswers[sessionCard.id] || "";
    const currentCorrection = sessionCorrections[sessionCard.id];
    const hasAnswerDraft = Boolean(currentAnswer.trim());
    const resultTone = {
      correct: "border-emerald-300 bg-emerald-50 text-emerald-950",
      incomplete: "border-amber-300 bg-amber-50 text-amber-950",
      missing: "border-red-300 bg-red-50 text-red-950",
      incorrect: "border-red-300 bg-red-50 text-red-950",
      unverified: "border-amber-300 bg-amber-50 text-amber-950",
    };
    return (
      <section className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={finishSession}
            disabled={savingReview}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600"
          >
            <ArrowLeft size={16} /> Sair da sessão
          </button>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-950">
            Cartão {session.index + 1} de {session.cardIds.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-amber-800 transition-all"
            style={{
              width: `${Math.round((session.outcomes.length / session.cardIds.length) * 100)}%`,
            }}
          />
        </div>
        {savingReview && (
          <p role="status" aria-live="polite" className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-900">
            Salvando a tentativa e a revisão…
          </p>
        )}
        <article className="min-h-[270px] rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Frente
          </p>
          <p className="mt-4 whitespace-pre-wrap text-xl font-semibold leading-relaxed text-stone-950">
            {sessionCard.front}
          </p>
          <p className="mt-6 text-sm text-stone-500">
            Tente recuperar a resposta antes de revelá-la.
          </p>
          {!answerVisible && !sessionRated && (
            <div className="mt-6 space-y-3">
              <label
                htmlFor="flashcard-typed-answer"
                className="block text-sm font-bold text-stone-800"
              >
                Sua resposta (opcional)
              </label>
              <textarea
                id="flashcard-typed-answer"
                rows={4}
                value={currentAnswer}
                disabled={savingReview}
                onChange={(event) => {
                  setSessionAnswers((current) => ({
                    ...current,
                    [sessionCard.id]: event.target.value,
                  }));
                  setCorrectionError("");
                }}
                autoComplete="off"
                className="w-full rounded-2xl border border-stone-300 bg-white p-4 text-base leading-relaxed text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200"
                placeholder="Digite com suas próprias palavras..."
              />
              <p className="text-xs text-stone-500">
                A comparação é local e não usa uma API de IA. Ao corrigir, sua
                tentativa é registrada no histórico persistente deste cartão.
              </p>
              {correctionError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {correctionError} O texto foi preservado; corrija-o ou tente
                  novamente.
                </p>
              )}
            </div>
          )}
          {answerVisible && (
            <div className="mt-7 border-t border-stone-200 pt-6">
              {currentCorrection && (
                <p className="mb-3 rounded-xl bg-stone-100 px-3 py-2 text-sm font-bold text-stone-800">
                  {currentCorrection.status === "inconclusive"
                    ? "Análise inconclusiva • tentativa não contabilizada"
                    : `Tentativa ${
                        (sessionAttempts[sessionCard.id] || []).filter(
                          (attempt) => attempt.status !== "inconclusive",
                        ).length
                      } de 2${
                        currentCorrection.status === "correct"
                          ? (sessionAttempts[sessionCard.id] || []).filter(
                              (attempt) => attempt.status !== "inconclusive",
                            ).length === 1
                            ? " • acerto na primeira tentativa"
                            : " • acerto na segunda tentativa"
                          : ""
                      }`}
                </p>
              )}
              {currentCorrection && (
                <section
                  aria-labelledby="flashcard-correction-heading"
                  className="mb-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      id="flashcard-correction-heading"
                      className="text-lg font-black text-stone-950"
                    >
                      Resultado da resposta
                    </h3>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-bold text-stone-800">
                      Elementos completos: {currentCorrection.correctCount}/
                      {currentCorrection.elements.length} (
                      {currentCorrection.completionPercent}%)
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-stone-700">
                    {currentCorrection.message}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-stone-600">
                    Confiança da análise:{" "}
                    {{
                      high: "alta",
                      medium: "moderada",
                      low: "baixa",
                    }[currentCorrection.confidence] || "não determinada"}
                    . A completude conta apenas elementos reconhecidos por
                    inteiro.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-stone-600">
                    {currentCorrection.correctCount} corretos •{" "}
                    {currentCorrection.incompleteCount} incompletos •{" "}
                    {currentCorrection.missingCount} ausentes •{" "}
                    {currentCorrection.unverifiedCount || 0} inconclusivos •{" "}
                    {currentCorrection.incorrectCount} incorreto(s)
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-stone-700">
                    <span>Verde: reconhecido</span>
                    <span>Amarelo: incompleto</span>
                    <span>Vermelho: ausente ou incorreto</span>
                  </div>
                  {showOfficial && <div className="mt-4 grid gap-3">
                    {currentCorrection.elements.map((element, index) => (
                      <div
                        key={`${element.official}-${index}`}
                        className={`rounded-2xl border p-4 ${resultTone[element.status] || "border-stone-200 bg-white text-stone-800"}`}
                        aria-label={`${{
                          correct: "Correto",
                          incomplete: "Incompleto",
                          missing: "Ausente",
                          incorrect: "Incorreto",
                          unverified: "Inconclusivo",
                        }[element.status]}: ${element.official}`}
                      >
                        <p className="text-xs font-black uppercase tracking-wide">
                          {{
                            correct: "Correto",
                            incomplete: "Parcial / incompleto",
                            missing: "Ausente",
                            incorrect: "Incorreto",
                            unverified: "Inconclusivo",
                          }[element.status]}
                        </p>
                        <p className="mt-1 font-bold">{element.official}</p>
                        {element.matchedText && (
                          <p className="mt-2 text-sm">
                            <b>Você mencionou:</b> {element.matchedText}
                          </p>
                        )}
                        {element.missingText && (
                          <p className="mt-2 text-sm">
                            <b>
                              {element.status === "incomplete"
                                ? "Complemento que faltou:"
                                : "Não identificado na resposta:"}
                            </b>{" "}
                            <span className="rounded bg-red-100 px-1 font-semibold text-red-950 underline decoration-2 underline-offset-2">
                              {element.missingText}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>}
                  {!showOfficial && currentCorrection.status !== "inconclusive" && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                      Há elementos ausentes ou incompletos. Você ainda pode
                      revisar sua resposta sem ver o gabarito.
                    </p>
                  )}
                  {currentCorrection.unrecognizedExtras.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                      <b>Trecho não reconhecido (análise inconclusiva):</b>{" "}
                      {currentCorrection.unrecognizedExtras.join("; ")}. A
                      comparação local não pode afirmar se o trecho é
                      contraditório; confira a resposta oficial.
                    </div>
                  )}
                  {currentCorrection.incorrectTerms.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
                      <b>Termo incorreto conforme critérios do cartão:</b>{" "}
                      {currentCorrection.incorrectTerms.join(", ")}
                    </div>
                  )}
                  {currentCorrection.unverifiedCount > 0 && (
                    <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
                      A comparação local não permite confirmar se sua resposta
                      expressa a mesma ideia. Compare com a resposta oficial e
                      avalie seu desempenho.
                    </p>
                  )}
                  {sessionCard.correctionCriteria?.notes && (
                    <p className="mt-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-950">
                      <b>Critério de correção:</b>{" "}
                      {sessionCard.correctionCriteria.notes}
                    </p>
                  )}
                  <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                    <h4 className="font-black">O que você respondeu</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
                      {currentCorrection.submittedAnswer}
                    </p>
                  </div>
                </section>
              )}
              {showOfficial && (
              <>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Resposta oficial
              </p>
              {!currentCorrection && (
                <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-stone-800">
                  {sessionCard.back}
                </p>
              )}
              {currentCorrection && (
                <div className="mt-3 space-y-2">
                  {currentCorrection.elements.map((element, index) => (
                    <p
                      key={`official-${element.official}-${index}`}
                      className={`rounded-xl p-3 text-base leading-relaxed ${resultTone[element.status] || "bg-stone-50 text-stone-800"}`}
                    >
                      <OfficialCorrectionText element={element} />
                    </p>
                  ))}
                </div>
              )}
              </>
              )}
              {sessionCard.notes && (
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                  {sessionCard.notes}
                </p>
              )}
            </div>
          )}
          {confirmDeleteId && (
            <div
              role="alertdialog"
              aria-label="Confirmar exclusão permanente"
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-950"
            >
              <span>
                Excluir permanentemente este cartão e todo o histórico associado?
              </span>
              <button
                onClick={() => deleteCard(confirmDeleteId)}
                className="rounded-lg bg-red-800 px-3 py-2 font-semibold text-white"
              >
                Excluir permanentemente
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-red-200 px-3 py-2 font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}
        </article>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-500">
          <span>
            {subject?.subject || sessionCard.subjectLabel || "Matéria removida"}
            {(topic?.title || sessionCard.topicLabel) &&
              ` • ${topic?.title || sessionCard.topicLabel}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => moveSession(-1)}
              disabled={session.index === 0 || savingReview}
              aria-label="Cartão anterior"
              className="rounded-xl border border-stone-200 bg-white p-2 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => moveSession(1)}
              disabled={
                session.index >= session.cardIds.length - 1 || savingReview
              }
              aria-label="Próximo cartão"
              className="rounded-xl border border-stone-200 bg-white p-2 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {!answerVisible && !sessionRated && (
          <div className="space-y-2">
            <button
              disabled={savingReview}
              onClick={
                hasAnswerDraft
                  ? correctCurrentAnswer
                  : revealOfficialAnswer
              }
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-bold text-white ${
                hasAnswerDraft ? "bg-amber-800" : "bg-stone-950"
              }`}
            >
              {hasAnswerDraft ? (
                <>
                  <Check size={18} /> Corrigir resposta
                </>
              ) : (
                <>
                  <Eye size={18} /> Consultar resposta oficial
                </>
              )}
            </button>
            {hasAnswerDraft && (
              <button
                disabled={savingReview}
                onClick={() => {
                  setSessionAnswers((current) => ({
                    ...current,
                    [sessionCard.id]: "",
                  }));
                  revealOfficialAnswer();
                }}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600"
              >
                Descartar rascunho e consultar resposta
              </button>
            )}
          </div>
        )}
        {answerVisible &&
          currentCorrection &&
          !sessionRated &&
          currentCorrection.status !== "correct" &&
          !showOfficial && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              disabled={savingReview}
              onClick={retryCurrentAnswer}
              className="rounded-2xl bg-amber-800 px-5 py-4 font-bold text-white disabled:opacity-50"
            >
              Tentar novamente
            </button>
            <button
              disabled={savingReview}
              onClick={revealOfficialAnswer}
              className="rounded-2xl border border-stone-300 bg-white px-5 py-4 font-bold text-stone-800 disabled:opacity-50"
            >
              Ver resposta
            </button>
          </div>
        )}
        {correctionError && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {correctionError}
          </p>
        )}
        {sessionRated && (
          <div className="space-y-2">
            <p className="rounded-2xl bg-emerald-50 p-4 text-center font-semibold text-emerald-900">
              {session.outcomes.find(
                (outcome) => outcome.cardId === sessionCard.id,
              )?.consulted
                ? "Consulta registrada como revisão, sem contabilizar acerto."
                : session.outcomes.find(
                    (outcome) => outcome.cardId === sessionCard.id,
                  )?.outcome === "incorrect"
                  ? "Duas tentativas incorretas. Revisão individual agendada para amanhã."
                  : "Avaliação registrada e próxima revisão atualizada."}
            </p>
            {session.index === session.cardIds.length - 1 ? (
              <button
                onClick={() =>
                  setSession({
                    ...session,
                    finished: true,
                    finishedAt: new Date().toISOString(),
                  })
                }
                className="w-full rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white"
              >
                Concluir sessão
              </button>
            ) : (
              <button
                onClick={() => moveSession(1)}
                className="w-full rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white"
              >
                Próximo cartão
              </button>
            )}
          </div>
        )}
        {!sessionRated && answerVisible && showOfficial && (
          <div>
            <p className="mb-3 text-center text-sm font-bold text-stone-700">
              Como você se saiu?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FLASHCARD_RATINGS.map((rating, index) => (
                <button
                  key={rating.id}
                  disabled={savingReview}
                  onClick={() => rateCurrentCard(rating.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${
                    index === 0
                      ? "border-red-200 bg-red-50 text-red-900"
                      : index === 1
                        ? "border-orange-200 bg-orange-50 text-orange-900"
                        : index === 2
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-sky-200 bg-sky-50 text-sky-900"
                  }`}
                >
                  <span className="block font-black">{rating.label}</span>
                  <span className="mt-1 block text-xs">{rating.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  const selectedSubjectTopics =
    subjectFilter === "all"
      ? roadmap.flatMap((subject) =>
          (subject.topics || []).map((topic) => ({
            id: topic.id,
            label: `${subject.subject} • ${topic.title}`,
          })),
        )
      : (roadmap.find((subject) => subject.id === subjectFilter)?.topics || []).map(
          (topic) => ({ id: topic.id, label: topic.title }),
        );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900">Memorização ativa</p>
          <h2 className="text-3xl font-black tracking-tight">Flashcards</h2>
          <p className="mt-1 text-sm text-stone-500">
            O cronograma do assunto define as etapas; cada cartão preserva o próprio histórico e recebe prioridade por dificuldade.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          disabled={!roadmap.length}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} /> Novo flashcard
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Total" value={summary.total} detail="Cartões ativos" />
        <Metric label="Novos" value={summary.new} detail="Nunca revisados" tone="amber" />
        <Metric label="Etapas atuais" value={cardsAvailableForStages.length} detail="Cartões disponíveis no cronograma do assunto" tone="amber" />
        <Metric label="Para reforço" value={cardsNeedingReinforcement} detail="Histórico com erros ou avaliação difícil" tone="red" />
        <Metric label="Revisados" value={summary.reviewedEver} detail={`${summary.completion}% do total já estudado`} tone="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-black">Progresso das revisões</p>
              <p className="mt-1 text-sm text-stone-500">
                Cartões com revisão efetiva registrada.
              </p>
            </div>
            <span className="text-xl font-black">{summary.completion}%</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-emerald-700"
              style={{ width: `${summary.completion}%` }}
            />
          </div>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5">
          <p className="font-black">Cartões por matéria</p>
          {roadmap.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              Não há matérias no edital ativo.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {roadmap.map((subject) => (
                <span
                  key={subject.id}
                  className="rounded-full bg-stone-100 px-3 py-1.5 text-sm"
                >
                  {subject.subject}:{" "}
                  <b>
                    {activeCards.filter(
                      (card) => !card.archived && card.subjectId === subject.id,
                    ).length}
                  </b>
                </span>
              ))}
              {activeCards.some((card) => !subjectFor(card)) && (
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-950">
                  Associação removida:{" "}
                  <b>{activeCards.filter(hasMissingLink).length}</b>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-stone-950/50 p-4 pt-10">
          <form
            onSubmit={saveCard}
            className="w-full max-w-2xl space-y-4 rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black">
                  {editingId ? "Editar flashcard" : "Novo flashcard"}
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Cadastre seu próprio conteúdo. As avaliações anteriores são preservadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Cancelar edição"
                className="rounded-xl p-2 hover:bg-stone-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Matéria *
                <select
                  required
                  value={form.subjectId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      subjectId: event.target.value,
                      topicId: "",
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"
                >
                  <option value="">Selecione uma matéria</option>
                  {editingId &&
                    form.subjectId &&
                    !roadmap.some((item) => item.id === form.subjectId) && (
                      <option value={form.subjectId}>
                        Matéria removida — {activeCards.find((card) => card.id === editingId)?.subjectLabel || form.subjectId}
                      </option>
                    )}
                  {roadmap.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.subject}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Assunto
                <select
                  value={form.topicId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, topicId: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"
                >
                  <option value="">Sem assunto específico</option>
                  {editingId &&
                    form.topicId &&
                    !availableTopics.some((topic) => topic.id === form.topicId) && (
                      <option value={form.topicId}>
                        Assunto removido — {activeCards.find((card) => card.id === editingId)?.topicLabel || form.topicId}
                      </option>
                    )}
                  {availableTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Frente *
              <textarea
                required
                rows={3}
                value={form.front}
                onChange={(event) =>
                  setForm((current) => ({ ...current, front: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3"
                placeholder="Digite a pergunta, termo ou conceito"
              />
            </label>
            <label className="block text-sm font-semibold">
              Verso *
              <textarea
                required
                rows={4}
                value={form.back}
                onChange={(event) =>
                  setForm((current) => ({ ...current, back: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3"
                placeholder="Digite a resposta ou explicação"
              />
            </label>
            <label className="block text-sm font-semibold">
              Observação complementar
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Tags (separe por vírgula)
                <input
                  value={form.tags}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tags: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3"
                  placeholder="Ex.: importante, revisar"
                />
              </label>
              <label className="text-sm font-semibold">
                Dificuldade inicial
                <select
                  value={form.difficulty}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      difficulty: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"
                >
                  <option value="">Não definida</option>
                  <option value="facil">Fácil</option>
                  <option value="media">Média</option>
                  <option value="dificil">Difícil</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Formato da resposta
              <select
                value={form.answerType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    answerType: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-3"
              >
                <option value="free">Resposta livre</option>
                <option value="list">Lista de elementos</option>
                <option value="objective">Resposta objetiva / terminologia rigorosa</option>
              </select>
            </label>
            <details className="rounded-2xl border border-stone-200 p-4">
              <summary className="cursor-pointer font-bold">
                Critérios opcionais de correção
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                A correção local não presume sinônimos jurídicos. Cadastre aqui
                elementos obrigatórios e variações que você aceita.
              </p>
              <label className="mt-3 block text-sm font-semibold">
                Elementos obrigatórios (um por linha)
                <textarea
                  rows={4}
                  value={form.requiredElementsText}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requiredElementsText: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 font-normal"
                  placeholder={"Soberania\nCidadania\nPluralismo político = pluralismo na política"}
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.ignoreAccents}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ignoreAccents: event.target.checked,
                    }))
                  }
                />
                Tratar diferenças de acentuação como equivalentes
              </label>
              <label className="mt-3 block text-sm font-semibold">
                Termos sabidamente incorretos ou contraditórios
                <input
                  value={form.incorrectTermsText}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      incorrectTermsText: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 font-normal"
                  placeholder="Separe por vírgula"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold">
                Observações sobre a correção
                <textarea
                  rows={2}
                  value={form.correctionNotes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      correctionNotes: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 font-normal"
                />
              </label>
            </details>
            {formError && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-stone-200 px-4 py-3 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-5 py-3 font-bold text-white"
              >
                <Check size={17} /> Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-black">Biblioteca de flashcards</h3>
          <p className="mt-1 text-sm text-stone-500">
            Consulte os cartões ou estude somente os que já estão na data de revisão.
          </p>
        </div>
        <div className="grid gap-2 rounded-3xl border border-stone-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="relative sm:col-span-2 xl:col-span-1">
            <Search size={16} className="absolute left-3 top-3.5 text-stone-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar cartões"
              className="w-full rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={subjectFilter}
            onChange={(event) => {
              setSubjectFilter(event.target.value);
              setTopicFilter("all");
            }}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Todas as matérias</option>
            {roadmap.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.subject}
              </option>
            ))}
          </select>
          <select
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Todos os assuntos</option>
            {selectedSubjectTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Todas as situações</option>
            <option value="new">Novo</option>
            <option value="reviewed">Revisado (histórico registrado)</option>
            <option value="archived">Arquivado</option>
          </select>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Todas as tags</option>
            {uniqueTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={performanceFilter}
            onChange={(event) => setPerformanceFilter(event.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Todo o desempenho</option>
            <option value="omissions">Com omissões recorrentes (2+)</option>
            <option value="low">Baixo desempenho</option>
          </select>
        </div>

        {roadmap.length === 0 ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950">
            Cadastre ou selecione um edital com matérias para começar. Nenhuma matéria ou assunto fictício será criado.
          </div>
        ) : activeCards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <BookOpen className="mx-auto text-stone-400" size={28} />
            <p className="mt-3 font-bold">Sua biblioteca ainda está vazia.</p>
            <p className="mt-1 text-sm text-stone-500">
              Cadastre manualmente a frente e o verso do primeiro cartão.
            </p>
            <button
              onClick={openCreateForm}
              className="mt-4 rounded-xl bg-stone-950 px-4 py-2.5 font-semibold text-white"
            >
              Criar primeiro flashcard
            </button>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500">
            Nenhum cartão corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {filteredCards.map((card) => {
              const status = flashcardStatus(card, today);
              const archived = status === "archived";
              const subject = subjectFor(card);
              const topic = topicFor(card);
              return (
                <article
                  key={card.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${
                    hasMissingLink(card)
                      ? "border-amber-300"
                      : "border-stone-200"
                  } ${archived ? "opacity-70" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        status === "reviewed"
                          ? "bg-emerald-100 text-emerald-900"
                              : status === "archived"
                                ? "bg-stone-200 text-stone-700"
                                : "bg-sky-100 text-sky-900"
                      }`}
                    >
                      {{
                        new: "Novo",
                        reviewed: "Revisado",
                        archived: "Arquivado",
                      }[status]}
                    </span>
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
                      >
                        <Tag size={11} /> {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap font-bold text-stone-950">
                    {card.front}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    {subject?.subject || card.subjectLabel || "Matéria não encontrada"}
                    {(topic?.title || card.topicLabel) &&
                      ` • ${topic?.title || card.topicLabel}`}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {card.schedule.repetitions
                      ? `Última revisão efetiva: ${formatLocalDate(card.schedule.lastReviewedDate)} • ${card.schedule.repetitions} revisão(ões) registrada(s)`
                      : "Nunca revisado efetivamente"}
                  </p>
                  {hasMissingLink(card) && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-950">
                      A matéria ou o assunto original não está mais no edital ativo. O cartão e seu histórico foram preservados; edite a associação ou arquive-o.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!archived && (
                      <button
                        onClick={() => startCard(card)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
                      >
                        <RotateCcw size={15} /> Estudar
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(card)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold"
                    >
                      <Pencil size={15} /> Editar
                    </button>
                    {archived ? (
                      <button
                        onClick={() => setArchived(card.id, false)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800"
                      >
                        <RotateCcw size={15} /> Restaurar
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmArchiveId(card.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-600"
                      >
                        <Archive size={15} /> Arquivar
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(card.id)}
                      className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-800"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {summary.new > 0 && (
            <button
              onClick={() =>
                beginSession(
                  pendingFlashcardsForTarget(
                    activeCards,
                    {},
                    today,
                    { includeNew: true },
                  ),
                )
              }
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-800 px-5 py-3 font-bold text-white"
            >
              <RotateCcw size={17} /> Estudar cartões novos ({summary.new})
            </button>
          )}
          {confirmArchiveId && (
            <div
              role="alertdialog"
              aria-label="Confirmar arquivamento"
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-stone-100 p-3 text-sm"
            >
              <span>Arquivar este cartão e preservar seu histórico?</span>
              <button
                onClick={() => setArchived(confirmArchiveId, true)}
                className="rounded-lg bg-stone-950 px-3 py-2 font-semibold text-white"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmArchiveId(null)}
                className="rounded-lg border border-stone-300 px-3 py-2 font-semibold"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
