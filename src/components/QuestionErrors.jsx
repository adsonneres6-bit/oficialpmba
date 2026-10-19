import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  filterQuestionErrorsByStudyMethod,
  filterQuestionErrors,
  completeQuestionLearningReview,
  getQuestionLearningReviewStatus,
  makeQuestionAttempt,
  normalizeQuestionErrors,
  QUESTION_ERROR_CATEGORIES,
  questionAlternativeLabel,
  questionErrorPerformance,
  questionLearningReviewDueAt,
  summarizeQuestionErrors,
  validateQuestionErrorDraft,
} from "../lib/questionErrors.js";

const emptyDraft = (examId = "") => ({
  id: `question_error_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  examId,
  studyMethod: "",
  questionType: "multiple-choice",
  subjectId: "",
  topicId: "",
  topicKind: "official",
  topicLabel: "",
  subtopic: "",
  bank: "",
  year: "",
  identification: "",
  source: "",
  statement: "",
  alternatives: [],
  originalAlternativeId: "",
  errorCategory: "",
  errorReason: "",
  correctExplanation: "",
});
const answerLabel = (item, id) => {
  const option = item.alternatives.find((entry) => entry.id === id);
  if (!option) return "alternativa removida";
  return item.questionType === "true-false"
    ? option.text
    : questionAlternativeLabel(item.alternatives.indexOf(option));
};

export default function QuestionErrors({
  questions,
  exams,
  activeExamId,
  roadmap,
  onCommitQuestions,
  reviewTarget,
  onReviewTargetConsumed,
  activeStudySession,
  studySessions = [],
}) {
  const [draft, setDraft] = useState(() => emptyDraft(activeExamId));
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [filters, setFilters] = useState({
    examId: activeExamId || "all",
    subjectId: "all",
    topicId: "all",
    bank: "all",
    status: "active",
    performance: "all",
    category: "all",
    studyMethod: "all",
    query: "",
  });
  const [sessionIds, setSessionIds] = useState(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState("");
  const [answer, setAnswer] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [expandedStatements, setExpandedStatements] = useState(() => new Set());
  const [visibleErrorReasons, setVisibleErrorReasons] = useState(() => new Set());
  const lock = useRef(false);
  const sessionIdRef = useRef("");
  const attemptRetryRef = useRef(null);
  const records = useMemo(
    () => normalizeQuestionErrors(questions),
    [questions],
  );
  const activeSubjects = useMemo(
    () =>
      roadmap.map((subject) => ({
        id: subject.id,
        label: subject.subject,
        topics: subject.topics || [],
      })),
    [roadmap],
  );
  const selectedSubject = activeSubjects.find(
    (subject) => subject.id === draft.subjectId,
  );
  const studyMethodBySessionId = useMemo(() => {
    const methods = new Map();
    studySessions.forEach((session) => {
      if (
        session?.studySessionId &&
        ["traditional", "reverse"].includes(session.studyMethod)
      ) {
        methods.set(session.studySessionId, session.studyMethod);
      }
    });
    return methods;
  }, [studySessions]);
  const filtered = useMemo(() => {
    const results = filterQuestionErrors(records, {
        ...filters,
        includeArchived: filters.status === "archived",
      });
    return filterQuestionErrorsByStudyMethod(
      results,
      filters.studyMethod,
      studySessions,
    );
  }, [records, filters, studySessions]);
  const stats = useMemo(() => summarizeQuestionErrors(records), [records]);
  const learningTimeline = useMemo(() => {
    const entries = records
      .filter((item) => !item.archived && item.learningReviewDueAt)
      .map((item) => ({
        item,
        status: getQuestionLearningReviewStatus(item),
        dueDate: new Date(item.learningReviewDueAt),
      }))
      .filter((entry) => entry.status)
      .sort((a, b) => a.dueDate - b.dueDate);
    return {
      entries: entries.filter((entry) => entry.status.state !== "completed").slice(0, 5),
      today: entries.filter((entry) => entry.status.state === "today").length,
      overdue: entries.filter((entry) => entry.status.state === "overdue").length,
      reinforcement: entries.filter((entry) => entry.item.learningReviewNeedsReinforcement).length,
      completed: entries.filter((entry) => entry.status.state === "completed").length,
    };
  }, [records]);
  const selectedRecord = sessionIds
    ? records.find((item) => item.id === sessionIds[sessionIndex])
    : null;
  const bankOptions = [
    ...new Set(
      records
        .filter(
          (item) =>
            !item.archived &&
            (!filters.examId ||
              filters.examId === "all" ||
              !item.examId ||
              item.examId === filters.examId),
        )
        .map((item) => item.bank)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  useEffect(() => {
    if (!reviewTarget) return;
    setFilters((current) => ({
      ...current,
      examId: reviewTarget.examId || activeExamId || "all",
      subjectId: reviewTarget.subjectId || "all",
      topicId: reviewTarget.topicId || "all",
      status: "active",
    }));
    const candidates = filterQuestionErrors(records, {
      examId: reviewTarget.examId || activeExamId,
      subjectId: reviewTarget.subjectId,
      topicId: reviewTarget.topicId,
      performance: "reinforcement",
    });
    if (candidates.length) {
      sessionIdRef.current = `question_session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setSessionIds(candidates.map((item) => item.id));
      setSessionIndex(0);
      setSelectedAlternativeId("");
      setAnswer(null);
    }
    onReviewTargetConsumed?.();
  }, [reviewTarget]); // One-shot dashboard request.

  useEffect(() => {
    if (
      !activeStudySession?.studySessionId ||
      !["traditional", "reverse"].includes(activeStudySession.studyMethod)
    ) return;
    const nextDraft = emptyDraft(activeExamId);
    nextDraft.subjectId = activeStudySession.subjectId || "";
    nextDraft.topicId = activeStudySession.topicId || "";
    nextDraft.topicLabel = activeStudySession.topic || "";
    nextDraft.studyMethod = activeStudySession.studyMethod || "";
    setDraft(nextDraft);
    setEditingId(null);
    setFormError("");
    setFormOpen(true);
  }, [activeStudySession?.studySessionId]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timeout);
  }, [message]);

  function setField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function openCreate() {
    setEditingId(null);
    const nextDraft = emptyDraft(activeExamId);
    if (activeStudySession) {
      nextDraft.subjectId = activeStudySession.subjectId || "";
      nextDraft.topicId = activeStudySession.topicId || "";
      nextDraft.topicLabel = activeStudySession.topic || "";
      nextDraft.studyMethod = activeStudySession.studyMethod || "";
    }
    setDraft(nextDraft);
    setFormError("");
    setFormOpen(true);
    setSessionIds(null);
  }
  function openEdit(item) {
    setEditingId(item.id);
    setDraft({
      ...emptyDraft(item.examId),
      ...item,
      topicKind: item.topicKind === "custom" ? "custom" : "official",
      alternatives: (item.alternatives || []).map((option) => ({ ...option })),
    });
    setFormError("");
    setFormOpen(true);
    setSessionIds(null);
  }
  async function saveQuestion(event) {
    event.preventDefault();
    const validation = validateQuestionErrorDraft(
      draft,
      roadmap,
      draft.studyMethod === "reverse",
      !editingId && !activeStudySession?.studyMethod,
    );
    if (validation) {
      setFormError(validation);
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFormError("");
    const subject = activeSubjects.find((item) => item.id === draft.subjectId);
    const topic = subject?.topics.find((item) => item.id === draft.topicId);
    const previous = records.find((item) => item.id === editingId);
    const isCustomTopic = draft.topicKind === "custom";
    const learnedAt = new Date();
    const learningTextChanged =
      !previous ||
      String(previous.correctExplanation || "").trim() !==
        draft.correctExplanation.trim();
    const reviewMethod =
      previous?.studyMethod || draft.studyMethod || activeStudySession?.studyMethod;
    const methodChangedToReverse =
      Boolean(previous) &&
      previous.studyMethod !== "reverse" &&
      draft.studyMethod === "reverse";
    const scheduleLearningReview =
      draft.studyMethod === "reverse" &&
      (learningTextChanged || methodChangedToReverse);
    const learningReviewDueAt = scheduleLearningReview
      ? questionLearningReviewDueAt(
          { ...previous, ...draft, learningReviewDueAt: null },
          reviewMethod,
          learnedAt,
        )
      : previous?.learningReviewDueAt || null;
    const record = {
      ...draft,
      id: editingId || draft.id,
      topicId: isCustomTopic ? null : draft.topicId,
      topicKind: isCustomTopic ? "custom" : "official",
      topicLabel: isCustomTopic
        ? draft.topicLabel.trim()
        : topic?.title || previous?.topicLabel || "",
      originalErrorReason:
        previous?.originalErrorReason ??
        previous?.errorReason ??
        draft.errorReason,
      originalErrorCategory:
        previous?.originalErrorCategory ??
        previous?.errorCategory ??
        draft.errorCategory,
      examId: previous?.examId || activeExamId || draft.examId,
      subjectLabel: subject?.label || previous?.subjectLabel || "",
      alternatives: draft.alternatives.map((option, index) => ({
        ...option,
        label: questionAlternativeLabel(index),
      })),
      year: draft.year ? Number(draft.year) : null,
      archived: previous?.archived || false,
      attempts: previous?.attempts || [],
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      studySessionId: previous
        ? previous.studySessionId || null
        : activeStudySession?.studySessionId || null,
      sourceBlockId:
        previous
          ? previous.sourceBlockId || null
          : activeStudySession?.sourceBlockId || activeStudySession?.id || null,
      studyMethod: previous
        ? previous.studyMethod || draft.studyMethod || null
        : activeStudySession?.studyMethod || draft.studyMethod || null,
      ...(learningReviewDueAt
        ? {
            learningReviewDueAt,
            learningReviewScheduledAt: scheduleLearningReview
              ? learnedAt.toISOString()
              : previous?.learningReviewScheduledAt || learnedAt.toISOString(),
            learningReviewStage: scheduleLearningReview
              ? 0
              : previous?.learningReviewStage || 0,
            learningReviewNeedsReinforcement: scheduleLearningReview
              ? false
              : Boolean(previous?.learningReviewNeedsReinforcement),
            learningReviewHistory: previous?.learningReviewHistory || [],
            learningReviewCompletedAt: scheduleLearningReview
              ? null
              : previous?.learningReviewCompletedAt || null,
            learningReviewCycleCompletedAt: scheduleLearningReview
              ? null
              : previous?.learningReviewCycleCompletedAt || null,
          }
        : {}),
    };
    const next = editingId
      ? records.map((item) => (item.id === editingId ? record : item))
      : [record, ...records];
    try {
      const result = await onCommitQuestions(next);
      if (!result?.ok)
        throw result?.error || new Error("Persistência não confirmada");
      setFormOpen(false);
      setEditingId(null);
      setMessage(
        editingId
          ? "Questão atualizada com sucesso."
          : "Questão cadastrada com sucesso.",
      );
    } catch (error) {
      console.error("Falha ao salvar questão errada:", error);
      setFormError(
        "Não foi possível salvar no armazenamento. Seus dados continuam no formulário; tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function archiveQuestion(item) {
    await persistQuestionList(
      records.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              archived: !entry.archived,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
      item.archived
        ? "Questão restaurada com sucesso."
        : "Questão arquivada com sucesso.",
    );
  }
  async function persistQuestionList(next, successMessage) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await onCommitQuestions(next);
      if (!result?.ok)
        throw result?.error || new Error("Persistência não confirmada");
      setDeleteId(null);
      setMessage(successMessage);
    } catch (error) {
      console.error("Falha ao atualizar questões erradas:", error);
      setMessage(
        "Não foi possível concluir a operação. Os dados foram mantidos; tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function startSession(items = filtered) {
    items = items.filter((item) => !item.archived);
    if (!items.length) {
      setMessage("Nenhuma questão corresponde aos filtros selecionados.");
      return;
    }
    sessionIdRef.current = `question_session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setSessionIds(items.map((item) => item.id));
    setSessionIndex(0);
    setSelectedAlternativeId("");
    setAnswer(null);
    setFormOpen(false);
  }
  async function confirmAnswer() {
    if (!selectedRecord || !selectedAlternativeId || answer || lock.current)
      return;
    let attempt;
    const retryKey = `${selectedRecord.id}:${sessionIdRef.current}:${selectedAlternativeId}`;
    try {
      attempt =
        attemptRetryRef.current?.key === retryKey
          ? attemptRetryRef.current.attempt
          : makeQuestionAttempt(
              selectedRecord,
              selectedAlternativeId,
              sessionIdRef.current,
            );
      attemptRetryRef.current = { key: retryKey, attempt };
    } catch {
      setMessage(
        "Esta questão está sem um gabarito válido. Edite o cadastro antes de revisar.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    const attemptedRecord = {
      ...selectedRecord,
      attempts: [...selectedRecord.attempts, attempt],
    };
    const updated = selectedRecord.learningReviewDueAt
      ? completeQuestionLearningReview(attemptedRecord, attempt.correct)
      : { ...attemptedRecord, updatedAt: new Date().toISOString() };
    try {
      const result = await onCommitQuestions(
        records.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (!result?.ok)
        throw result?.error || new Error("Persistência não confirmada");
      attemptRetryRef.current = null;
      setAnswer(attempt);
    } catch (error) {
      console.error("Falha ao salvar tentativa de questão:", error);
      setMessage(
        "Não foi possível registrar a tentativa. A resposta não foi marcada como concluída; tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function completeLearningReview(item, remembered) {
    if (!item.learningReviewDueAt || item.learningReviewCompletedAt || item.learningReviewCycleCompletedAt) {
      closeSession();
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const updated = completeQuestionLearningReview(item, remembered);
    try {
      const result = await onCommitQuestions(
        records.map((record) => (record.id === updated.id ? updated : record)),
      );
      if (!result?.ok)
        throw result?.error || new Error("Persistência não confirmada");
      closeSession();
      setMessage(
        remembered
          ? updated.learningReviewCycleCompletedAt
            ? "Ciclo de revisão concluído."
            : "Revisão concluída; próxima data programada."
          : "Aprendizado marcado para reforço amanhã.",
      );
    } catch (error) {
      console.error("Falha ao concluir revisão do aprendizado:", error);
      setMessage("Não foi possível salvar a conclusão da revisão. Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function moveSession(delta) {
    const nextIndex = sessionIndex + delta;
    if (nextIndex < 0 || nextIndex >= (sessionIds || []).length) return;
    setSessionIndex(nextIndex);
    setSelectedAlternativeId("");
    setAnswer(null);
    setMessage("");
  }
  function closeSession() {
    setSessionIds(null);
    setSelectedAlternativeId("");
    setAnswer(null);
  }

  return (
    <section className="space-y-5">
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 top-3 z-[100] mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-900 shadow-lg sm:inset-x-auto sm:right-6"
        >
          {message}
        </div>
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Erros de Questões</h2>
          <p className="mt-1 text-sm text-stone-500">
            Refaça questões, registre seu raciocínio e acompanhe sua evolução.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => startSession()}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 font-semibold"
          >
            <RotateCcw size={16} /> Refazer questões ({filtered.length})
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 font-bold text-white"
          >
            <Plus size={17} /> Registrar aprendizado
          </button>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["Total", stats.total],
          ["Não revisadas", stats.new],
          ["Ainda errando", stats.stillMissed],
          ["Já acertadas", stats.correctInReview],
          ["Reforço", stats.reinforcement],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-stone-500">{label}</p>
            <p className="text-xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-emerald-950">Revisões do estudo reverso</h3>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white px-2.5 py-1 text-amber-800">Hoje: {learningTimeline.today}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-red-700">Atrasadas: {learningTimeline.overdue}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-orange-800">Reforço: {learningTimeline.reinforcement}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-emerald-800">Ciclo concluído: {learningTimeline.completed}</span>
          </div>
        </div>
        {learningTimeline.entries.length ? (
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {learningTimeline.entries.map(({ item, status, dueDate }) => (
              <li key={item.id} className="min-w-0 rounded-2xl border border-emerald-100 bg-white p-3">
                <p className="text-xs font-bold text-stone-500">{dueDate.toLocaleDateString("pt-BR")}</p>
                <p className="mt-1 truncate text-sm font-bold text-stone-900">
                  {item.subjectLabel} · {item.topicLabel}
                </p>
                <p className={`mt-1 text-xs font-semibold ${status.state === "overdue" ? "text-red-700" : status.state === "reinforcement" ? "text-orange-800" : "text-emerald-800"}`}>
                  {status.label}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-stone-600">Nenhuma revisão programada no momento.</p>
        )}
      </section>
      <div className="grid gap-2 rounded-3xl border border-stone-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative sm:col-span-2 xl:col-span-1">
          <Search
            size={16}
            className="absolute left-3 top-3.5 text-stone-400"
          />
          <input
            value={filters.query}
            onChange={(event) =>
              setFilters((value) => ({ ...value, query: event.target.value }))
            }
            placeholder="Pesquisar enunciado"
            className="w-full rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          aria-label="Edital"
          value={filters.examId}
          onChange={(event) =>
            setFilters((value) => ({ ...value, examId: event.target.value }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Todos os editais</option>
          {exams.map((exam) => (
            <option key={exam.key} value={exam.key}>
              {exam.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Matéria"
          value={filters.subjectId}
          onChange={(event) =>
            setFilters((value) => ({
              ...value,
              subjectId: event.target.value,
              topicId: "all",
            }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Todas as matérias</option>
          {activeSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Assunto"
          value={filters.topicId}
          onChange={(event) =>
            setFilters((value) => ({ ...value, topicId: event.target.value }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Todos os assuntos</option>
          {activeSubjects
            .filter(
              (subject) =>
                filters.subjectId === "all" || subject.id === filters.subjectId,
            )
            .flatMap((subject) =>
              subject.topics.map((topic) => (
                <option key={`${subject.id}:${topic.id}`} value={topic.id}>
                  {subject.label} · {topic.title}
                </option>
              )),
            )}
        </select>
        <select
          aria-label="Banca"
          value={filters.bank}
          onChange={(event) =>
            setFilters((value) => ({ ...value, bank: event.target.value }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Todas as bancas</option>
          {bankOptions.map((bank) => (
            <option key={bank}>{bank}</option>
          ))}
        </select>
        <select
          aria-label="Situação"
          value={filters.status}
          onChange={(event) =>
            setFilters((value) => ({ ...value, status: event.target.value }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="active">Ativas</option>
          <option value="new">Não revisadas</option>
          <option value="reviewed">Já revisadas</option>
          <option value="archived">Arquivadas</option>
        </select>
        <select
          aria-label="Desempenho"
          value={filters.performance}
          onChange={(event) =>
            setFilters((value) => ({
              ...value,
              performance: event.target.value,
            }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Todo desempenho</option>
          <option value="reinforcement">Precisam de reforço</option>
          <option value="incorrect">Com erro em revisão</option>
          <option value="correct">Acertadas em revisão</option>
        </select>
        <select
          aria-label="Categoria do erro"
          value={filters.category}
          onChange={(event) =>
            setFilters((value) => ({ ...value, category: event.target.value }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Todas as categorias</option>
          {QUESTION_ERROR_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select
          aria-label="Método de estudo"
          value={filters.studyMethod}
          onChange={(event) =>
            setFilters((value) => ({ ...value, studyMethod: event.target.value }))
          }
          className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">Método de estudo: todos os registros</option>
          <option value="traditional">Somente estudo tradicional</option>
          <option value="reverse">Somente estudo reverso</option>
        </select>
      </div>
      {sessionIds && selectedRecord ? (
        <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-stone-500">
              Questão {sessionIndex + 1} de {sessionIds.length}
            </p>
            <button
              onClick={closeSession}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold"
            >
              Encerrar sessão
            </button>
          </div>
          {selectedRecord.statement && (
            <p className="mt-5 whitespace-pre-wrap text-lg font-bold leading-relaxed">
              {selectedRecord.statement}
            </p>
          )}
          {selectedRecord.alternatives.length ? (
          <div className="mt-5 space-y-2">
            {selectedRecord.alternatives.map((option, index) => {
              const correctId =
                selectedRecord.alternatives.filter((item) => item.isCorrect)
                  .length === 1
                  ? selectedRecord.alternatives.find((item) => item.isCorrect)
                      ?.id
                  : "";
              const selected = selectedAlternativeId === option.id;
              const tone =
                answer && option.id === correctId
                  ? "border-emerald-500 bg-emerald-50"
                  : answer && selected && !answer.correct
                    ? "border-red-400 bg-red-50"
                    : selected
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200";
              return (
                <button
                  key={option.id}
                  disabled={Boolean(answer) || busy}
                  onClick={() => setSelectedAlternativeId(option.id)}
                  className={`flex w-full gap-3 rounded-2xl border p-4 text-left ${tone}`}
                >
                  {selectedRecord.questionType !== "true-false" && (
                    <span className="font-black">
                      {questionAlternativeLabel(index)}.
                    </span>
                  )}
                  <span className="whitespace-pre-wrap">{option.text}</span>
                  {answer && option.id === correctId && (
                    <Check
                      className="ml-auto shrink-0 text-emerald-700"
                      size={18}
                    />
                  )}
                </button>
              );
            })}
          </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-emerald-950">
              <p className="font-black">Revisão pelo estudo reverso</p>
              <p className="mt-2 text-sm">Tente recordar o conceito antes de consultar sua anotação.</p>
              {selectedRecord.correctExplanation && (
                <p className="mt-3 whitespace-pre-wrap"><b>O que aprendi:</b> {selectedRecord.correctExplanation}</p>
              )}
              {(selectedRecord.originalErrorReason || selectedRecord.errorReason) && (
                <p className="mt-3 whitespace-pre-wrap"><b>Meu erro:</b> {selectedRecord.originalErrorReason || selectedRecord.errorReason}</p>
              )}
            </div>
          )}
          {answer && (
            <div
              className={`mt-4 rounded-2xl p-4 ${answer.correct ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`}
            >
              <p className="font-black">
                {answer.correct ? "Resposta correta." : "Resposta incorreta."}
              </p>
              <p className="mt-2">
                Você marcou{" "}
                {answerLabel(selectedRecord, answer.selectedAlternativeId)};
                gabarito:{" "}
                {answerLabel(selectedRecord, answer.correctAlternativeId)}.
              </p>
              {selectedRecord.originalAlternativeId && (
                <p className="mt-2">
                  Alternativa marcada originalmente:{" "}
                  {answerLabel(
                    selectedRecord,
                    selectedRecord.originalAlternativeId,
                  )}
                </p>
              )}
              {selectedRecord.correctExplanation && (
                <p className="mt-2 whitespace-pre-wrap">
                  <b>O que aprendi:</b> {selectedRecord.correctExplanation}
                </p>
              )}
              {(selectedRecord.originalErrorReason ||
                selectedRecord.errorReason) && (
                <p className="mt-2 whitespace-pre-wrap">
                  <b>Meu erro original (anotação):</b>{" "}
                  {selectedRecord.originalErrorReason ||
                    selectedRecord.errorReason}
                </p>
              )}
              {(selectedRecord.originalErrorCategory ||
                selectedRecord.errorCategory) && (
                <p className="mt-2">
                  <b>Categoria anotada:</b>{" "}
                  {selectedRecord.originalErrorCategory ||
                    selectedRecord.errorCategory}
                </p>
              )}
              <p className="mt-2 text-sm">
                Histórico: {questionErrorPerformance(selectedRecord).correct}{" "}
                acerto(s) · {questionErrorPerformance(selectedRecord).incorrect}{" "}
                erro(s) em {questionErrorPerformance(selectedRecord).attempts}{" "}
                tentativa(s).
              </p>
            </div>
          )}
          {selectedRecord.alternatives.length > 0 && selectedRecord.alternatives.filter((option) => option.isCorrect)
            .length !== 1 && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              Questão sem gabarito válido. Corrija o cadastro antes de
              responder.
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <button
              disabled={sessionIndex === 0 || busy}
              onClick={() => moveSession(-1)}
              className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-4 py-2.5 font-semibold disabled:opacity-40"
            >
              <ChevronLeft size={17} /> Anterior
            </button>
            {!selectedRecord.alternatives.length ? (
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => completeLearningReview(selectedRecord, true)}
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  Lembrei
                </button>
                <button
                  disabled={busy}
                  onClick={() => completeLearningReview(selectedRecord, false)}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 font-bold text-amber-950 disabled:opacity-50"
                >
                  Precisa de reforço
                </button>
              </div>
            ) : answer ? (
              <button
                onClick={() => moveSession(1)}
                disabled={sessionIndex >= sessionIds.length - 1}
                className="inline-flex items-center gap-1 rounded-xl bg-stone-950 px-4 py-2.5 font-bold text-white disabled:opacity-40"
              >
                Próxima questão <ChevronRight size={17} />
              </button>
            ) : (
              <button
                onClick={confirmAnswer}
                disabled={
                  !selectedAlternativeId ||
                  busy ||
                  selectedRecord.alternatives.filter(
                    (option) => option.isCorrect,
                  ).length !== 1
                }
                className="rounded-xl bg-stone-950 px-4 py-2.5 font-bold text-white disabled:opacity-40"
              >
                {busy ? "Registrando…" : "Confirmar resposta"}
              </button>
            )}
          </div>
        </article>
      ) : formOpen ? (
        <form
          onSubmit={saveQuestion}
          className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black">
              {editingId ? "Editar aprendizado" : "Registrar aprendizado"}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Fechar formulário"
            >
              <X />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(!activeStudySession || editingId) && (
            <label className="text-sm font-semibold">
              Método de estudo
              <select
                required={!editingId && !activeStudySession?.studyMethod}
                disabled={Boolean(activeStudySession?.studyMethod && !editingId)}
                value={draft.studyMethod || ""}
                onChange={(event) =>
                  setField("studyMethod", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-stone-200 p-3 disabled:bg-stone-100"
              >
                <option value="">Selecione o método</option>
                <option value="traditional">Estudo tradicional</option>
                <option value="reverse">Estudo reverso</option>
              </select>
              {activeStudySession?.studyMethod && !editingId && (
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  Método definido pela sessão ativa.
                </span>
              )}
            </label>
            )}
            <label className="text-sm font-semibold">
              Matéria
              <select
                required
                value={draft.subjectId}
                onChange={(event) => {
                  setField("subjectId", event.target.value);
                  setField("topicId", "");
                  setField("topicKind", "official");
                  setField("topicLabel", "");
                }}
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              >
                <option value="">Selecione</option>
                {activeSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Assunto
              <select
                required
                value={
                  draft.topicKind === "custom"
                    ? "__custom_topic__"
                    : draft.topicId
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setField(
                    "topicKind",
                    value === "__custom_topic__" ? "custom" : "official",
                  );
                  setField(
                    "topicId",
                    value === "__custom_topic__" ? "" : value,
                  );
                  if (value !== "__custom_topic__") setField("topicLabel", "");
                }}
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              >
                <option value="">Selecione</option>
                {(selectedSubject?.topics || []).map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
                <option value="__custom_topic__">Assunto personalizado</option>
              </select>
              {draft.topicKind === "custom" && (
                <input
                  required
                  value={draft.topicLabel}
                  onChange={(event) => setField("topicLabel", event.target.value)}
                  placeholder="Ex.: Referências de células no Excel — tecla F4"
                  aria-label="Assunto personalizado"
                  className="mt-2 w-full rounded-xl border border-stone-200 p-3"
                />
              )}
            </label>
            <label className="text-sm font-semibold">
              Subtópico (opcional)
              <input
                value={draft.subtopic || ""}
                onChange={(event) => setField("subtopic", event.target.value)}
                placeholder="Ex.: Tecla F4"
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Banca (opcional)
              <input
                value={draft.bank}
                onChange={(event) => setField("bank", event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Ano
              <input
                type="number"
                min="1900"
                max="2100"
                value={draft.year || ""}
                onChange={(event) => setField("year", event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              />
            </label>
          </div>
          <label className="block text-sm font-bold">
            Enunciado (opcional)
            <textarea
              rows={5}
              value={draft.statement}
              onChange={(event) => setField("statement", event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 p-3 font-normal"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-bold">
              Meu erro
              <textarea
                rows={4}
                value={draft.errorReason}
                onChange={(event) =>
                  setField("errorReason", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-stone-200 p-3 font-normal"
              />
              <select
                aria-label="Categoria do erro"
                value={draft.errorCategory}
                onChange={(event) =>
                  setField("errorCategory", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-stone-200 p-3 font-normal"
              >
                <option value="">Categoria opcional</option>
                {QUESTION_ERROR_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              O que aprendi
              <textarea
                required={draft.studyMethod === "reverse"}
                rows={3}
                value={draft.correctExplanation}
                onChange={(event) =>
                  setField("correctExplanation", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-stone-200 p-3 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Registre brevemente o conceito, a regra ou a informação que você aprendeu ao corrigir esta questão.
              </span>
            </label>
          </div>
          {formError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"
            >
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-stone-200 px-4 py-2.5 font-semibold"
            >
              Cancelar
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-stone-950 px-5 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar questão"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {filtered.length ? (
            filtered.map((item) => {
              const performance = questionErrorPerformance(item);
              const studyMethod = item.studySessionId
                ? studyMethodBySessionId.get(item.studySessionId)
                : ["traditional", "reverse"].includes(item.studyMethod)
                  ? item.studyMethod
                  : null;
              const learningReviewStatus = getQuestionLearningReviewStatus(item);
              return (
                <article
                  key={item.id}
                  className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-stone-100 px-2.5 py-1">
                          {item.subjectLabel} · {item.topicLabel}
                        </span>
                        {item.subtopic && (
                          <span className="rounded-full bg-stone-50 px-2.5 py-1 text-stone-600">
                            {item.subtopic}
                          </span>
                        )}
                        {studyMethod && (
                          <span
                            className={`rounded-full px-2.5 py-1 ${studyMethod === "reverse" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}
                          >
                            {studyMethod === "reverse"
                              ? "Estudo reverso"
                              : "Estudo tradicional"}
                          </span>
                        )}
                        {(item.bank || item.year) && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1">
                            {[item.bank, item.year].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        <span className="rounded-full bg-sky-100 px-2.5 py-1">
                          {performance.attempts ? `${performance.attempts} tentativa(s)` : "Não revisada"}
                        </span>
                        {performance.needsReinforcement && (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">
                            Precisa de reforço
                          </span>
                        )}
                        {item.archived && (
                          <span className="rounded-full bg-stone-200 px-2.5 py-1">
                            Arquivada
                          </span>
                        )}
                      </div>
                      {item.statement && (
                        <div className="mt-2">
                          <p className="whitespace-pre-wrap font-bold">
                            <span className={expandedStatements.has(item.id) ? "" : "line-clamp-3"}>
                              {item.statement}
                            </span>
                          </p>
                          {(item.statement.length > 160 || item.statement.split("\n").length > 3) && (
                            <button
                              type="button"
                              aria-expanded={expandedStatements.has(item.id)}
                              onClick={() => setExpandedStatements((current) => {
                                const next = new Set(current);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              })}
                              className="mt-1 text-sm font-bold text-stone-700 underline underline-offset-2"
                            >
                              {expandedStatements.has(item.id) ? "Recolher enunciado" : "Ver enunciado completo"}
                            </button>
                          )}
                        </div>
                      )}
                      {item.correctExplanation && (
                        <p className="mt-2 whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-950">
                          <b>O que aprendi:</b> {item.correctExplanation}
                        </p>
                      )}
                      {(item.originalErrorReason || item.errorReason) && (
                        <div className="mt-2">
                          <button
                            type="button"
                            aria-expanded={visibleErrorReasons.has(item.id)}
                            onClick={() => setVisibleErrorReasons((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })}
                            className="text-sm font-semibold text-stone-600 underline underline-offset-2"
                          >
                            {visibleErrorReasons.has(item.id) ? "Ocultar motivo do erro" : "Ver motivo do erro"}
                          </button>
                          {visibleErrorReasons.has(item.id) && (
                            <section className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                              <h3 className="text-xs font-black uppercase tracking-wide text-stone-600">Meu erro</h3>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                                {item.originalErrorReason || item.errorReason}
                              </p>
                            </section>
                          )}
                        </div>
                      )}
                      {learningReviewStatus && (
                        <p className={`mt-2 text-xs font-semibold ${
                          learningReviewStatus.state === "completed"
                            ? "text-emerald-700"
                            : learningReviewStatus.state === "overdue"
                              ? "text-red-700"
                              : learningReviewStatus.state === "reinforcement"
                                ? "text-orange-800"
                              : learningReviewStatus.state === "today" || learningReviewStatus.state === "tomorrow"
                                ? "text-amber-800"
                                : "text-sky-700"
                        }`}>
                          {learningReviewStatus.label}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-stone-500">
                        Acertos: {performance.correct} · Erros:{" "}
                        {performance.incorrect}
                        {performance.last
                          ? ` · Última tentativa ${new Date(performance.last.attemptedAt).toLocaleString("pt-BR")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={item.archived}
                        onClick={() => startSession([item])}
                        className="inline-flex items-center gap-1 rounded-lg bg-stone-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                      >
                        <BookOpenCheck size={15} /> Refazer
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-lg border border-stone-200 p-2"
                        aria-label="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => archiveQuestion(item)}
                        className="rounded-lg border border-stone-200 p-2"
                        aria-label={item.archived ? "Restaurar" : "Arquivar"}
                      >
                        <Archive size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-700"
                        aria-label="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {item.attempts?.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-bold">
                        Histórico de tentativas
                      </summary>
                      <ol className="mt-2 space-y-1 text-sm text-stone-600">
                        {item.attempts.map((attempt) => (
                          <li key={attempt.id}>
                            {new Date(attempt.attemptedAt).toLocaleString(
                              "pt-BR",
                            )}{" "}
                            · resposta{" "}
                            {attempt.selectedAlternativeLabel ||
                              questionAlternativeLabel(
                                item.alternatives.findIndex(
                                  (option) =>
                                    option.id === attempt.selectedAlternativeId,
                                ),
                              )}{" "}
                            · {attempt.correct ? "acerto" : "erro"} · tentativa{" "}
                            {attempt.attemptNumber}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
              Nenhuma questão corresponde aos filtros selecionados.
            </div>
          )}
        </div>
      )}
      {deleteId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-black">Excluir esta questão?</h3>
            <p className="mt-2 text-sm text-stone-600">
              A questão e seu histórico serão removidos definitivamente.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={busy}
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 font-semibold"
              >
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  persistQuestionList(
                    records.filter((item) => item.id !== deleteId),
                    "Questão excluída com sucesso.",
                  )
                }
                className="rounded-xl bg-red-800 px-4 py-2.5 font-bold text-white"
              >
                {busy ? "Excluindo…" : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
