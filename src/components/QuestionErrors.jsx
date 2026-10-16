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
  filterQuestionErrors,
  makeQuestionAttempt,
  normalizeQuestionErrors,
  QUESTION_ERROR_CATEGORIES,
  questionAlternativeLabel,
  questionErrorPerformance,
  summarizeQuestionErrors,
  validateQuestionErrorDraft,
} from "../lib/questionErrors.js";

const newAlternative = () => ({
  id: `option_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  text: "",
  isCorrect: false,
});
const emptyDraft = (examId = "") => ({
  id: `question_error_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  examId,
  questionType: "multiple-choice",
  subjectId: "",
  topicId: "",
  bank: "",
  year: "",
  identification: "",
  source: "",
  statement: "",
  alternatives: [
    newAlternative(),
    newAlternative(),
    newAlternative(),
    newAlternative(),
  ],
  originalAlternativeId: "",
  errorCategory: "",
  errorReason: "",
  correctExplanation: "",
});
const trueFalseAlternatives = () => [
  { id: "true", text: "Certo", isCorrect: false },
  { id: "false", text: "Errado", isCorrect: false },
];
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
    query: "",
  });
  const [sessionIds, setSessionIds] = useState(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState("");
  const [answer, setAnswer] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
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
  const filtered = useMemo(
    () =>
      filterQuestionErrors(records, {
        ...filters,
        includeArchived: filters.status === "archived",
      }),
    [records, filters],
  );
  const stats = useMemo(() => summarizeQuestionErrors(records), [records]);
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
    if (!message) return undefined;
    const timeout = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timeout);
  }, [message]);

  function setField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function setQuestionType(questionType) {
    setDraft((current) => ({
      ...current,
      questionType,
      alternatives:
        questionType === "true-false"
          ? trueFalseAlternatives()
          : [
              newAlternative(),
              newAlternative(),
              newAlternative(),
              newAlternative(),
            ],
      originalAlternativeId: "",
    }));
  }
  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft(activeExamId));
    setFormError("");
    setFormOpen(true);
    setSessionIds(null);
  }
  function openEdit(item) {
    setEditingId(item.id);
    setDraft({
      ...emptyDraft(item.examId),
      ...item,
      alternatives: item.alternatives.map((option) => ({ ...option })),
    });
    setFormError("");
    setFormOpen(true);
    setSessionIds(null);
  }
  async function saveQuestion(event) {
    event.preventDefault();
    const validation = validateQuestionErrorDraft(draft, roadmap, activeExamId);
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
    const record = {
      ...draft,
      id: editingId || draft.id,
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
      topicLabel: topic?.title || previous?.topicLabel || "",
      alternatives: draft.alternatives.map((option, index) => ({
        ...option,
        label: questionAlternativeLabel(index),
      })),
      year: draft.year ? Number(draft.year) : null,
      archived: previous?.archived || false,
      attempts: previous?.attempts || [],
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    const updated = {
      ...selectedRecord,
      attempts: [...selectedRecord.attempts, attempt],
      updatedAt: new Date().toISOString(),
    };
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
            <Plus size={17} /> Cadastrar questão
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
          <p className="mt-5 whitespace-pre-wrap text-lg font-bold leading-relaxed">
            {selectedRecord.statement}
          </p>
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
                  <b>Por que está certa:</b> {selectedRecord.correctExplanation}
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
          {selectedRecord.alternatives.filter((option) => option.isCorrect)
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
            {answer ? (
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
              {editingId ? "Editar questão" : "Cadastrar questão errada"}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Fechar formulário"
            >
              <X />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold">
              Matéria
              <select
                required
                value={draft.subjectId}
                onChange={(event) => {
                  setField("subjectId", event.target.value);
                  setField("topicId", "");
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
                value={draft.topicId}
                onChange={(event) => setField("topicId", event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              >
                <option value="">Selecione</option>
                {(selectedSubject?.topics || []).map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
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
            <label className="text-sm font-semibold">
              Identificação da questão (opcional)
              <input
                value={draft.identification}
                onChange={(event) =>
                  setField("identification", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Fonte (opcional)
              <input
                value={draft.source}
                onChange={(event) => setField("source", event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 p-3"
              />
            </label>
          </div>
          <label className="block text-sm font-bold">
            Enunciado
            <textarea
              required
              rows={5}
              value={draft.statement}
              onChange={(event) => setField("statement", event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 p-3 font-normal"
            />
          </label>
          <fieldset className="flex flex-wrap gap-4 rounded-2xl border border-stone-200 p-3">
            <legend className="px-1 text-sm font-bold">Tipo de questão</legend>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="question-type"
                checked={draft.questionType !== "true-false"}
                onChange={() => setQuestionType("multiple-choice")}
              />{" "}
              Múltipla escolha
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="radio"
                name="question-type"
                checked={draft.questionType === "true-false"}
                onChange={() => setQuestionType("true-false")}
              />{" "}
              Certo ou Errado
            </label>
          </fieldset>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-black">
                {draft.questionType === "true-false"
                  ? "Respostas"
                  : "Alternativas"}
              </h4>
              {draft.questionType !== "true-false" && (
                <button
                  type="button"
                  disabled={draft.alternatives.length >= 5}
                  onClick={() =>
                    setField("alternatives", [
                      ...draft.alternatives,
                      newAlternative(),
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-bold disabled:opacity-40"
                >
                  <Plus size={16} /> Adicionar alternativa
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {draft.alternatives.map((option, index) => (
                <div
                  key={option.id}
                  className="flex items-start gap-2 rounded-xl border border-stone-200 p-2"
                >
                  {draft.questionType === "true-false" ? (
                    <span className="flex-1 pt-2 font-semibold">
                      {option.text}
                    </span>
                  ) : (
                    <>
                      <span className="pt-3 font-black">
                        {questionAlternativeLabel(index)}.
                      </span>
                      <textarea
                        aria-label={`Texto da alternativa ${questionAlternativeLabel(index)}`}
                        rows={2}
                        value={option.text}
                        onChange={(event) =>
                          setField(
                            "alternatives",
                            draft.alternatives.map((item) =>
                              item.id === option.id
                                ? { ...item, text: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="min-w-0 flex-1 rounded-lg border border-stone-200 p-2"
                      />
                    </>
                  )}
                  <label className="flex items-center gap-1 pt-3 text-xs font-semibold">
                    <input
                      type="radio"
                      name="correct-alternative"
                      checked={option.isCorrect}
                      onChange={() =>
                        setField(
                          "alternatives",
                          draft.alternatives.map((item) => ({
                            ...item,
                            isCorrect: item.id === option.id,
                          })),
                        )
                      }
                    />{" "}
                    Correta
                  </label>
                  {draft.questionType !== "true-false" && (
                    <button
                      type="button"
                      aria-label={`Remover alternativa ${questionAlternativeLabel(index)}`}
                      disabled={draft.alternatives.length <= 4}
                      onClick={() => {
                        setField(
                          "alternatives",
                          draft.alternatives.filter(
                            (item) => item.id !== option.id,
                          ),
                        );
                        if (draft.originalAlternativeId === option.id)
                          setField("originalAlternativeId", "");
                      }}
                      className="pt-3 text-red-700 disabled:opacity-30"
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <label className="block text-sm font-semibold">
            Resposta que eu marquei (opcional)
            <select
              value={draft.originalAlternativeId}
              onChange={(event) =>
                setField("originalAlternativeId", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-stone-200 p-3"
            >
              <option value="">Não lembro / não informar</option>
              {draft.alternatives.map((option, index) => (
                <option key={option.id} value={option.id}>
                  {draft.questionType === "true-false"
                    ? option.text
                    : questionAlternativeLabel(index)}
                </option>
              ))}
            </select>
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
              Por que a alternativa correta está certa?
              <textarea
                rows={4}
                value={draft.correctExplanation}
                onChange={(event) =>
                  setField("correctExplanation", event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-stone-200 p-3 font-normal"
              />
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
                        {item.bank && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1">
                            {item.bank}
                            {item.year ? ` · ${item.year}` : ""}
                          </span>
                        )}
                        <span className="rounded-full bg-sky-100 px-2.5 py-1">
                          {performance.attempts
                            ? `${performance.attempts} tentativa(s)`
                            : "Não revisada"}
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
                      <p className="mt-3 whitespace-pre-wrap font-bold">
                        {item.statement}
                      </p>
                      {(item.originalErrorReason || item.errorReason) && (
                        <p className="mt-2 line-clamp-2 text-sm text-stone-600">
                          <b>Meu erro:</b>{" "}
                          {item.originalErrorReason || item.errorReason}
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
