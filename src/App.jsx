import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  Home,
  NotebookPen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
  Zap,
} from "lucide-react";

const APP_VERSION = "V4";
const ROADMAP_VERSION = "EMPTY_V1";
const USER_PROFILE_KEY = "usuario_principal";
const ACTIVE_EXAM_KEY = "";
const STORAGE_PROFILE_KEY = `${USER_PROFILE_KEY}__${ACTIVE_EXAM_KEY}`;
const PROFILE_INDEX_KEY = `${USER_PROFILE_KEY}__profile_index`;
const ACTIVE_EXAM_LOCAL_KEY = `study_app_active_exam__${USER_PROFILE_KEY}`;
const EXAM_OPTIONS = [];
function slugifyExamKey(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || `edital_${Date.now()}`
  );
}

function storageKeyForExam(examKey) {
  return `${USER_PROFILE_KEY}__${examKey}`;
}

function localCacheKeyForExam(examKey) {
  return `study_app_state_cache__${storageKeyForExam(examKey)}`;
}

function ackKeyForExam(examKey) {
  return `study_app_previous_day_question_alert_ack__${storageKeyForExam(examKey)}`;
}

function getLocalActiveExamKey() {
  if (typeof window === "undefined") return ACTIVE_EXAM_KEY;
  return localStorage.getItem(ACTIVE_EXAM_LOCAL_KEY) || ACTIVE_EXAM_KEY;
}

function setLocalActiveExamKey(examKey) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_EXAM_LOCAL_KEY, examKey || ACTIVE_EXAM_KEY);
}

function findExamDefinition(examKey, customExams = []) {
  return (
    [...EXAM_OPTIONS, ...normalizeCustomExamList(customExams)].find(
      (exam) => exam.key === examKey,
    ) || null
  );
}

function normalizeCustomExamList(value) {
  return Array.isArray(value)
    ? value.filter((item) => item?.key && item?.label)
    : [];
}

function normalizeDeletedBuiltInExamKeys(value) {
  const builtInKeys = new Set(EXAM_OPTIONS.map((item) => item.key));
  return Array.isArray(value)
    ? [...new Set(value.filter((key) => builtInKeys.has(key)))]
    : [];
}

function visibleExamOptions(deletedBuiltInExamKeys = []) {
  const deleted = new Set(
    normalizeDeletedBuiltInExamKeys(deletedBuiltInExamKeys),
  );
  return EXAM_OPTIONS.filter((exam) => !deleted.has(exam.key));
}

function allAvailableExams(customExams = [], deletedBuiltInExamKeys = []) {
  return [
    ...visibleExamOptions(deletedBuiltInExamKeys),
    ...normalizeCustomExamList(customExams),
  ];
}
const SUPABASE_TABLE = "study_app_states";
const LOCAL_CACHE_KEY = `study_app_state_cache__${STORAGE_PROFILE_KEY}`;
const DEVICE_ID_KEY = "study_app_device_id";
const PREVIOUS_DAY_QUESTION_ALERT_ACK_KEY = `study_app_previous_day_question_alert_ack__${STORAGE_PROFILE_KEY}`;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

const WEEK_DAYS = [
  ["segunda", "Segunda"],
  ["terca", "Terça"],
  ["quarta", "Quarta"],
  ["quinta", "Quinta"],
  ["sexta", "Sexta"],
  ["sabado", "Sábado"],
  ["domingo", "Domingo"],
];
const DAY_LABELS = Object.fromEntries(WEEK_DAYS);
const SYSTEM_TODAY = new Date();
const TODAY = `${SYSTEM_TODAY.getFullYear()}-${String(SYSTEM_TODAY.getMonth() + 1).padStart(2, "0")}-${String(SYSTEM_TODAY.getDate()).padStart(2, "0")}`;
const TODAY_DAY_KEY = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
][SYSTEM_TODAY.getDay()];
const TODAY_LABEL = `${DAY_LABELS[TODAY_DAY_KEY]}, ${String(SYSTEM_TODAY.getDate()).padStart(2, "0")}/${String(SYSTEM_TODAY.getMonth() + 1).padStart(2, "0")}/${SYSTEM_TODAY.getFullYear()}`;
const STUDY_DAYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const WEEK_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);
const MANUAL_SPECIAL_BLOCKS = [
  {
    id: "simulado",
    subject: "Simulado do ciclo",
    topic: "Resolver simulado e controlar tempo",
    type: "Simulado",
  },
  {
    id: "caderno_erros",
    subject: "Revisão de erros",
    topic: "Resolver e revisar erros do ciclo",
    type: "Revisão",
  },
  {
    id: "planejamento",
    subject: "Planejamento do ciclo",
    topic: "Gerar e ajustar o próximo ciclo",
    type: "Planejamento",
  },
];
const CURRENT_WEEK = null;

const palette = [
  "from-stone-900 to-amber-900",
  "from-zinc-900 to-stone-700",
  "from-amber-900 to-stone-700",
  "from-neutral-900 to-stone-600",
  "from-slate-900 to-stone-700",
];

const motivationalMessages = [
  "Cada dia de estudo aproxima você da aprovação. Continue avançando, mesmo sem aplausos.",
  "A disciplina diária desenvolve a resistência necessária para vencer. Pequenos avanços diários geram grandes conquistas.",
  "O esforço silencioso prepara você para oportunidades maiores. O progresso acumulado sempre supera a pressa.",
  "A constância mostra quem realmente está comprometido com o sonho. Não troque um objetivo duradouro por um conforto momentâneo.",
  "Sua dedicação fortalece sua mentalidade. Mantenha o foco no que realmente importa.",
  "O sacrifício de hoje forma a base de grandes resultados. Seu futuro agradecerá pelas escolhas feitas hoje.",
  "A rotina bem executada transforma potencial em resultado. Os resultados aparecem para quem permanece no caminho.",
  "A preparação correta constrói um futuro mais sólido. A diferença está em continuar quando fica difícil.",
  "Seu compromisso cria vantagens que poucos estão dispostos a conquistar. A vitória costuma ser construída longe dos holofotes.",
  "A persistência nos dias difíceis aumenta suas chances de alcançar seus objetivos. Quem persiste por mais tempo costuma chegar mais longe.",
];

const roadmapSeed = [];

const fixedWeekOnePlan = {
  segunda: ["portugues", "direito_constitucional"],
  terca: ["matematica", "historia_bahia"],
  quarta: ["direito_penal", "geografia_bahia"],
  quinta: ["direito_administrativo", "direitos_humanos"],
  sexta: ["portugues", "igualdade_racial_genero", "informatica"],
  sabado: ["matematica", "direito_penal_militar", "atualidades"],
};

const sundayWeekOnePlan = [
  {
    id: "domingo-simulado",
    subjectId: "simulado",
    subject: "Simulado",
    topic: "Simulado do ciclo",
    type: "Simulado",
    minutes: 120,
  },
  {
    id: "domingo-erros",
    subjectId: "caderno_erros",
    subject: "Caderno de Erros",
    topic: "Resolver e revisar erros do ciclo",
    type: "Correção",
    minutes: 60,
  },
  {
    id: "domingo-planejamento",
    subjectId: "planejamento",
    subject: "Planejamento do Ciclo",
    topic: "Gerar e ajustar o próximo ciclo",
    type: "Planejamento",
    minutes: 30,
  },
];

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cls(...items) {
  return items.filter(Boolean).join(" ");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || uid("item")
  );
}

function toBRDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function parseISODate(value) {
  const [year, month, day] = String(value || TODAY)
    .slice(0, 10)
    .split("-")
    .map(Number);
  return new Date(
    year || SYSTEM_TODAY.getFullYear(),
    (month || SYSTEM_TODAY.getMonth() + 1) - 1,
    day || SYSTEM_TODAY.getDate(),
  );
}

function isValidISODate(value) {
  if (!value) return false;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isoToBR(value) {
  if (!isValidISODate(value)) return "Data não definida";
  return toBRDate(parseISODate(value));
}

function daysUntilExamDate(value) {
  if (!isValidISODate(value)) return null;
  const examDate = parseISODate(value);
  const today = new Date(
    SYSTEM_TODAY.getFullYear(),
    SYSTEM_TODAY.getMonth(),
    SYSTEM_TODAY.getDate(),
  );
  const diffMs = examDate.getTime() - today.getTime();
  return Math.ceil(diffMs / 86400000);
}

function dateToLocalISO(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isoDateFromAny(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

  const isoDateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoDateOnly) return isoDateOnly[1];

  // Quando o valor tem hora/timezone, não use apenas o prefixo YYYY-MM-DD.
  // Ex.: 08/06 às 22h no Brasil pode virar 2026-06-09T01:00:00Z no Supabase.
  // Por isso convertemos para a data local do navegador antes de comparar com "hoje".
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return dateToLocalISO(parsed);

  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  return "";
}

function questionSessionISODate(session) {
  return (
    isoDateFromAny(session?.studyDate) ||
    isoDateFromAny(session?.localDate) ||
    isoDateFromAny(session?.date) ||
    isoDateFromAny(session?.completedAt) ||
    isoDateFromAny(session?.createdAt) ||
    isoDateFromAny(session?.updatedAt)
  );
}

function sumQuestionSessionsForDate(questionSessions = [], isoDate) {
  const sessions = questionSessions.filter(
    (session) => questionSessionISODate(session) === isoDate,
  );
  const doneQuestions = sessions.reduce(
    (sum, session) =>
      sum +
      Number(session.done || session.totalQuestions || session.feitas || 0),
    0,
  );
  const correctQuestions = sessions.reduce(
    (sum, session) =>
      sum +
      Number(
        session.correct || session.correctQuestions || session.acertos || 0,
      ),
    0,
  );
  return { sessions, doneQuestions, correctQuestions };
}

function uniqueStudyBlocksForTotals(...groups) {
  const map = new Map();
  groups
    .flat()
    .filter(Boolean)
    .forEach((item) => {
      const key =
        item.id ||
        `${item.week || ""}-${item.dayKey || ""}-${item.subjectId || item.subject || ""}-${item.topicId || item.topic || ""}`;
      const previous = map.get(key);
      const previousSeconds = Number(
        previous?.elapsedSeconds || previous?.baseElapsedSeconds || 0,
      );
      const currentSeconds = Number(
        item.elapsedSeconds || item.baseElapsedSeconds || 0,
      );
      if (!previous || currentSeconds >= previousSeconds) map.set(key, item);
    });
  return Array.from(map.values());
}

function offsetISODate(value, offsetDays) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + offsetDays);
  return dateToLocalISO(date);
}

function countStudyStreak({
  weeklySchedule = [],
  effectiveWeeklySchedule = [],
  schedule = [],
  questionSessions = [],
  studyStartDate = DEFAULT_STUDY_START_DATE,
} = {}) {
  const studyDates = new Set();

  uniqueStudyBlocksForTotals(
    weeklySchedule,
    effectiveWeeklySchedule,
    schedule,
  ).forEach((item) => {
    const seconds = Math.max(
      Number(item?.elapsedSeconds || 0),
      Number(item?.baseElapsedSeconds || 0),
    );
    const hasStudy = item?.status === "concluido" || seconds > 0;
    if (!hasStudy) return;

    const explicitDate =
      isoDateFromAny(item.completedAt) ||
      isoDateFromAny(item.completedFromCarryoverAt) ||
      isoDateFromAny(item.updatedAt) ||
      isoDateFromAny(item.date);

    const plannedDate =
      item.week && item.dayKey
        ? isoDateForCycleWeekDay(item.week, item.dayKey, studyStartDate)
        : "";

    const isoDate = explicitDate || plannedDate;
    if (isoDate) studyDates.add(isoDate);
  });

  questionSessions.forEach((session) => {
    const total = Number(
      session?.done || session?.totalQuestions || session?.feitas || 0,
    );
    if (total <= 0) return;
    const isoDate = questionSessionISODate(session);
    if (isoDate) studyDates.add(isoDate);
  });

  if (!studyDates.size) return 0;

  const yesterday = offsetISODate(TODAY, -1);
  let cursor = studyDates.has(TODAY)
    ? TODAY
    : studyDates.has(yesterday)
      ? yesterday
      : "";
  if (!cursor) return 0;

  let streak = 0;
  while (studyDates.has(cursor)) {
    streak += 1;
    cursor = offsetISODate(cursor, -1);
  }
  return streak;
}

function parseBRDate(value) {
  const [day, month, year] = String(value || "")
    .split("/")
    .map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function addDaysISO(value, days) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toBRDate(date);
}

function formatElapsed(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const h = String(Math.floor(value / 3600)).padStart(2, "0");
  const m = String(Math.floor((value % 3600) / 60)).padStart(2, "0");
  const s = String(value % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatHours(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function parseSimulatedTimeToMinutes(value) {
  const text = String(value || "")
    .trim()
    .replace(",", ".");
  if (!text) return 0;
  if (text.includes(":")) {
    const [hours, minutes] = text.split(":").map(Number);
    return Math.max(0, (Number(hours) || 0) * 60 + (Number(minutes) || 0));
  }
  if (text.includes(".")) {
    const [hours, minutes] = text.split(".");
    return Math.max(0, (Number(hours) || 0) * 60 + (Number(minutes) || 0));
  }
  const numeric = Number(text) || 0;
  if (numeric > 0 && numeric <= 12) return numeric * 60;
  return Math.max(0, numeric);
}

function formatMinutesAsTime(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest}min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

function dailyQuestionTarget(config) {
  return Math.max(
    0,
    Number(config?.questionMinutes || config?.dailyQuestions || 30) || 0,
  );
}

function nextISODate(value) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeQuestionCarryovers(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: item.id || uid("question-carry"),
      date: String(item.date || "").slice(0, 10),
      fromDate: String(item.fromDate || "").slice(0, 10),
      missingQuestions: Math.max(0, Number(item.missingQuestions || 0) || 0),
      baseQuestions: Math.max(0, Number(item.baseQuestions || 0) || 0),
      doneQuestions: Math.max(0, Number(item.doneQuestions || 0) || 0),
      status: item.status || "pendente",
      createdAt: item.createdAt || new Date().toISOString(),
    }))
    .filter(
      (item) =>
        item.date && item.missingQuestions > 0 && item.status !== "concluido",
    );
}

function questionCarryoverForDate(carryovers, isoDate) {
  return normalizeQuestionCarryovers(carryovers)
    .filter((item) => item.date === isoDate)
    .reduce((sum, item) => sum + Number(item.missingQuestions || 0), 0);
}

function normalizeQuestionItem(item, config) {
  if (item?.subjectId === "questoes") return null;
  return { ...item, questionsTarget: Number(item.questionsTarget || 0) };
}

function normalizeScheduleItems(items, config) {
  return (items || [])
    .map((item) => normalizeQuestionItem(item, config))
    .filter(Boolean);
}

function withDistributedQuestionTargets(items, config, roadmap, options = {}) {
  const baseDaily = dailyQuestionTarget(config);
  const studyStartDate = options.studyStartDate || DEFAULT_STUDY_START_DATE;
  const carryovers = normalizeQuestionCarryovers(
    options.questionCarryovers || [],
  );
  const grouped = new Map();
  (items || [])
    .filter((item) => item.subjectId !== "questoes")
    .forEach((item) => {
      const key = `${item.week}-${item.dayKey}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
  const targets = new Map();
  grouped.forEach((dayItems) => {
    const first = dayItems[0] || {};
    const dayIsoDate = isoDateForCycleWeekDay(
      first.week || 1,
      first.dayKey || TODAY_DAY_KEY,
      studyStartDate,
    );
    const carriedQuestions = questionCarryoverForDate(carryovers, dayIsoDate);
    const daily = baseDaily + carriedQuestions;
    const subjects = dayItems
      .filter((item) => item.type === "Estudo" && !isSundayFixedBlock(item))
      .map((item) => getSubject(roadmap, item.subjectId))
      .filter(Boolean);
    const distribution = distributeDailyQuestions(subjects, daily);
    dayItems.forEach((item) =>
      targets.set(item.id, distribution[item.subjectId] || 0),
    );
  });
  return (items || [])
    .filter((item) => item.subjectId !== "questoes")
    .map((item) => ({
      ...item,
      questionsTarget:
        targets.get(item.id) ?? Number(item.questionsTarget || 0),
    }));
}

function isSundayFixedBlock(item) {
  return (
    item?.dayKey === "domingo" &&
    ["simulado", "caderno_erros", "planejamento"].includes(item?.subjectId)
  );
}

function withRecalculatedStudyMinutes(items, config, roadmap) {
  const dailyStudyMinutes = Math.max(
    60,
    Number(config?.dailyStudyMinutes) || 180,
  );
  const grouped = new Map();

  (items || []).forEach((item) => {
    const key = `${item.week || 1}-${item.dayKey || "sem_dia"}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  const minutesById = new Map();

  grouped.forEach((dayItems) => {
    const editableStudyItems = dayItems.filter(
      (item) =>
        item.subjectId !== "questoes" &&
        item.type === "Estudo" &&
        !isSundayFixedBlock(item),
    );

    if (editableStudyItems.length) {
      const minutesPerBlock = Math.max(
        30,
        Math.round(dailyStudyMinutes / editableStudyItems.length),
      );
      editableStudyItems.forEach((item) =>
        minutesById.set(item.id, minutesPerBlock),
      );
      return;
    }

    const sundayFixedItems = dayItems.filter(isSundayFixedBlock);
    if (sundayFixedItems.length) {
      const minutesPerBlock = Math.max(
        30,
        Math.round(dailyStudyMinutes / sundayFixedItems.length),
      );
      sundayFixedItems.forEach((item) =>
        minutesById.set(item.id, minutesPerBlock),
      );
    }
  });

  return (items || []).map((item) =>
    minutesById.has(item.id)
      ? { ...item, minutes: minutesById.get(item.id) }
      : item,
  );
}

function hoursToStudyMinutes(hours) {
  const parsed = Number(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return String(Math.round(parsed * 60));
}

function planAmountLabel(item) {
  return `${Number(item?.minutes || 0)}min • ${Number(item?.questionsTarget || 0)} questões`;
}

function liveElapsedSeconds(item) {
  const base =
    Number(item?.baseElapsedSeconds ?? item?.elapsedSeconds ?? 0) || 0;
  if (item?.status !== "andamento" || !item?.timerStartedAt)
    return Number(item?.elapsedSeconds || base || 0);
  const startedAt = Number(item.timerStartedAt) || 0;
  if (!startedAt) return Number(item?.elapsedSeconds || base || 0);
  return Math.max(0, base + Math.floor((Date.now() - startedAt) / 1000));
}

function simulatedNumber(title) {
  const match = String(title || "").match(/simulado[ ]*([0-9]+)/i);
  return match ? Number(match[1]) : 9999;
}

function defaultSimulatedTitle(tests = []) {
  const maxNumber = tests.reduce(
    (max, test) =>
      Math.max(
        max,
        simulatedNumber(test.title) === 9999 ? 0 : simulatedNumber(test.title),
      ),
    0,
  );
  return `Simulado ${maxNumber + 1}`;
}

function sortSimulatedTests(tests = []) {
  return [...tests].sort(
    (a, b) =>
      simulatedNumber(a.title) - simulatedNumber(b.title) ||
      String(a.date || "").localeCompare(String(b.date || "")),
  );
}

function essayStatus(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  if (value < 50) return { label: "Reprovado", tone: "red" };
  if (value < 60) return { label: "Na média", tone: "amber" };
  if (value < 70) return { label: "Bom", tone: "amber" };
  return { label: "Excelente", tone: "green" };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function dayLabel(dayKey) {
  return WEEK_DAYS.find(([key]) => key === dayKey)?.[1] || dayKey;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

const DEFAULT_STUDY_START_DATE = "2026-06-08";

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function currentCycleWeek(
  date = SYSTEM_TODAY,
  studyStartDate = DEFAULT_STUDY_START_DATE,
) {
  const start = startOfDay(
    studyStartDate instanceof Date
      ? studyStartDate
      : parseISODate(studyStartDate || DEFAULT_STUDY_START_DATE),
  );
  const today = startOfDay(date);
  if (today < start) return 1;
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const diffWeeks = Math.floor((today - startMonday) / (7 * 86400000));
  return Math.min(12, Math.max(1, diffWeeks + 1));
}

function removeRetroactiveItemsFromCurrentWeek(
  items,
  studyStartDate = DEFAULT_STUDY_START_DATE,
) {
  const currentWeek = currentCycleWeek(SYSTEM_TODAY, studyStartDate);
  const todayIndex = WEEK_DAYS.findIndex(([key]) => key === TODAY_DAY_KEY);

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (Number(item.week) !== Number(currentWeek)) return true;
    const itemDayIndex = WEEK_DAYS.findIndex(([key]) => key === item.dayKey);
    if (itemDayIndex < 0) return true;
    return itemDayIndex >= todayIndex;
  });
}

function isoDateForCycleWeekDay(
  week = 1,
  dayKey = TODAY_DAY_KEY,
  studyStartDate = DEFAULT_STUDY_START_DATE,
) {
  const start = startOfDay(
    studyStartDate instanceof Date
      ? studyStartDate
      : parseISODate(studyStartDate || DEFAULT_STUDY_START_DATE),
  );
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const dayIndex = Math.max(
    0,
    WEEK_DAYS.findIndex(([key]) => key === dayKey),
  );
  const date = new Date(startMonday);
  date.setDate(
    startMonday.getDate() + (Math.max(1, Number(week) || 1) - 1) * 7 + dayIndex,
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function motivationalMessageForToday() {
  const index = dayOfYear(SYSTEM_TODAY) % motivationalMessages.length;
  return motivationalMessages[index];
}

function ConfettiBurst({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 44 }, (_, index) => index);
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {particles.map((index) => {
        const x = ((index * 37) % 100) - 50;
        const y = -80 - ((index * 19) % 160);
        const rotate = (index * 29) % 360;
        const delay = (index % 8) * 0.035;
        return (
          <motion.span
            key={index}
            initial={{
              opacity: 0,
              scale: 0.5,
              x: "50vw",
              y: "52vh",
              rotate: 0,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.15, 1, 0.8],
              x: `calc(50vw + ${x * 8}px)`,
              y: `calc(52vh + ${y * 4}px)`,
              rotate,
            }}
            transition={{ duration: 3.2, delay, ease: "easeOut" }}
            className={cls(
              "absolute h-3 w-3 rounded",
              index % 4 === 0
                ? "bg-amber-400"
                : index % 4 === 1
                  ? "bg-emerald-500"
                  : index % 4 === 2
                    ? "bg-red-400"
                    : "bg-stone-900",
            )}
          />
        );
      })}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1.08, 1, 0.95] }}
        transition={{ duration: 3.8 }}
        className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-amber-200 bg-white/95 p-6 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-700 text-white">
          <Trophy />
        </div>
        <h2 className="mt-4 text-2xl font-black text-stone-950">
          Assunto concluído!
        </h2>
        <p className="mt-2 text-sm font-semibold text-stone-600">
          Mais um bloco vencido no caminho da aprovação.
        </p>
      </motion.div>
    </div>
  );
}

function nextStudyDayKey(dayKey) {
  const index = STUDY_DAYS.indexOf(dayKey);
  if (index === -1 || dayKey === "sabado") return "segunda";
  return STUDY_DAYS[index + 1] || "segunda";
}

function previousStudyDayKey(dayKey) {
  if (dayKey === "segunda" || dayKey === "domingo") return "sabado";
  const index = STUDY_DAYS.indexOf(dayKey);
  if (index <= 0) return null;
  return STUDY_DAYS[index - 1];
}

function getSubject(roadmap, id) {
  return roadmap.find((subject) => subject.id === id) || null;
}

function getTopic(roadmap, subjectId, topicId) {
  return (
    getSubject(roadmap, subjectId)?.topics.find(
      (topic) => topic.id === topicId,
    ) || null
  );
}

function pendingTopicsForSubject(subject) {
  const pending = subject.topics.filter((topic) => !topic.done);
  if (pending.length > 0) return pending;
  if (subject.topics.length === 0)
    return [
      {
        id: `${subject.id}_sem_assunto`,
        title: "Assunto a definir",
        done: false,
        priority: subject.priority || "Média",
        difficulty: "Média",
        virtual: true,
      },
    ];
  return [];
}

function estimateStaticTopicMinutes(topic) {
  if (topic?.difficulty === "Alta") return 60;
  if (topic?.difficulty === "Baixa") return 30;
  return 40;
}

function distributeDailyQuestions(subjects, dailyQuestions) {
  const totalQuestions = Math.max(0, Number(dailyQuestions) || 0);
  if (!subjects.length || totalQuestions <= 0) return {};
  const totalWeight =
    subjects.reduce((sum, subject) => sum + Number(subject.weight || 1), 0) ||
    subjects.length;
  const raw = subjects.map((subject) => {
    const exact = (totalQuestions * Number(subject.weight || 1)) / totalWeight;
    return {
      id: subject.id,
      base: Math.floor(exact),
      rest: exact - Math.floor(exact),
      weight: Number(subject.weight || 1),
    };
  });
  let allocated = raw.reduce((sum, item) => sum + item.base, 0);
  raw.sort((a, b) => b.rest - a.rest || b.weight - a.weight);
  let index = 0;
  while (allocated < totalQuestions) {
    raw[index % raw.length].base += 1;
    allocated += 1;
    index += 1;
  }
  return Object.fromEntries(raw.map((item) => [item.id, item.base]));
}

function fixedWeekOneScheduleFromRoadmap(roadmap, options = {}) {
  const dailyQuestions = Number(
    options.questionMinutes || options.dailyQuestions || 30,
  );
  const items = [];
  const topicCursorBySubject = {};
  Object.entries(fixedWeekOnePlan).forEach(([dayKey, subjectIds]) => {
    const daySubjects = subjectIds
      .map((subjectId) => getSubject(roadmap, subjectId))
      .filter(Boolean);
    const questionTargets = distributeDailyQuestions(
      daySubjects,
      dailyQuestions,
    );
    daySubjects.forEach((subject) => {
      const pendingTopics = pendingTopicsForSubject(subject);
      const cursor = topicCursorBySubject[subject.id] || 0;
      const topic = pendingTopics[cursor % Math.max(1, pendingTopics.length)];
      topicCursorBySubject[subject.id] = cursor + 1;
      items.push({
        id: `fixed-w1-${dayKey}-${subject.id}`,
        week: 1,
        dayKey,
        dayLabel: dayLabel(dayKey),
        subjectId: subject.id,
        topicId: topic?.id || null,
        topicIds: topic ? [topic.id] : [],
        subject: subject.subject,
        topic: topic?.title || "Assunto a definir",
        type: "Estudo",
        minutes: estimateStaticTopicMinutes(topic),
        questionsTarget: questionTargets[subject.id] || 0,
        status: "pendente",
        elapsedSeconds: 0,
        plannedBy: "semana_1_base",
        plannedWeight: subject.weight,
        plannedTopicsCount: 1,
      });
    });
  });
  sundayWeekOnePlan.forEach((item) =>
    items.push({
      ...item,
      id: `fixed-w1-${item.id}`,
      week: 1,
      dayKey: "domingo",
      dayLabel: "Domingo",
      topicIds: [],
      status: "pendente",
      elapsedSeconds: 0,
    }),
  );
  return items;
}

function hydrateSchedule(schedule, roadmap) {
  return (schedule || []).map((item) => {
    const subject = getSubject(roadmap, item.subjectId);
    const topicIds = Array.isArray(item.topicIds)
      ? item.topicIds
      : item.topicId
        ? [item.topicId]
        : [];
    const topics = topicIds
      .map((topicId) => getTopic(roadmap, item.subjectId, topicId))
      .filter(Boolean);
    const topic = getTopic(roadmap, item.subjectId, item.topicId) || topics[0];
    return {
      ...item,
      topicIds,
      subject: item.subject || subject?.subject || "Atividade",
      topic:
        item.topic ||
        (topics.length
          ? topics.map((entry) => entry.title).join(" + ")
          : topic?.title || "Sem assunto vinculado"),
      status: item.status || "pendente",
      elapsedSeconds: Number(item.elapsedSeconds || 0),
      timerStartedAt: item.timerStartedAt || null,
      completedAt: item.completedAt || null,
    };
  });
}

function isSundayStudyActivity(item) {
  return ["simulado", "caderno_erros", "planejamento"].includes(
    item?.subjectId,
  );
}

function shouldShowInStudyDay(item, dayKey) {
  if (!item) return false;
  if (dayKey === "domingo") return true;
  return !isSundayStudyActivity(item);
}

function todayScheduleFromWeekly(
  weeklySchedule,
  roadmap,
  studyStartDate = DEFAULT_STUDY_START_DATE,
) {
  const week = currentCycleWeek(SYSTEM_TODAY, studyStartDate);
  return hydrateSchedule(
    (weeklySchedule || []).filter(
      (item) =>
        Number(item.week) === week &&
        item.dayKey === TODAY_DAY_KEY &&
        shouldShowInStudyDay(item, TODAY_DAY_KEY),
    ),
    roadmap,
  );
}

function scheduleFromWeekly(weeklySchedule, roadmap, week, dayKey) {
  return hydrateSchedule(
    (weeklySchedule || []).filter(
      (item) =>
        Number(item.week) === Number(week) &&
        item.dayKey === dayKey &&
        shouldShowInStudyDay(item, dayKey),
    ),
    roadmap,
  );
}

function isScheduleFromToday(schedule) {
  return (
    Array.isArray(schedule) &&
    schedule.length > 0 &&
    schedule.every((item) => item.dayKey === TODAY_DAY_KEY)
  );
}

function carryoverFromPreviousSchedule(
  previousSchedule,
  currentDayKey,
  studyStartDate = DEFAULT_STUDY_START_DATE,
) {
  const previousDay = previousStudyDayKey(currentDayKey);
  const currentWeek = currentCycleWeek(SYSTEM_TODAY, studyStartDate);
  if (!previousDay || previousDay === currentDayKey) return [];
  if (currentWeek === 1 && previousDay === "sabado") return [];
  const targetDay = nextStudyDayKey(previousDay);
  return (previousSchedule || [])
    .filter(
      (item) =>
        item.dayKey === previousDay &&
        (Number(item.week || currentWeek) === currentWeek ||
          (previousDay === "sabado" &&
            Number(item.week || 0) === currentWeek - 1)) &&
        item.status !== "concluido" &&
        !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
          item.subjectId,
        ),
    )
    .map((item) => ({
      ...item,
      id: `carry-${previousDay}-${targetDay}-${item.subjectId}-${item.topicId || "sem_assunto"}`,
      week: currentCycleWeek(SYSTEM_TODAY, studyStartDate),
      dayKey: targetDay,
      dayLabel: dayLabel(targetDay),
      carryover: true,
      carryoverFrom: "dia anterior",
      carryoverOriginalDay: dayLabel(previousDay),
      carryoverLabel: "Pendente do dia anterior",
      status: "pendente",
      elapsedSeconds: 0,
      timerStartedAt: null,
      baseElapsedSeconds: 0,
      completedAt: null,
    }));
}

function carryoverFromSaturdayBase(
  weeklySchedule,
  currentDayKey,
  studyStartDate = DEFAULT_STUDY_START_DATE,
) {
  const currentWeek = currentCycleWeek(SYSTEM_TODAY, studyStartDate);
  if (currentWeek === 1) return [];
  if (!["domingo", "segunda"].includes(currentDayKey)) return [];
  return (weeklySchedule || [])
    .filter(
      (item) =>
        Number(item.week) === currentWeek - 1 &&
        item.dayKey === "sabado" &&
        item.status !== "concluido" &&
        !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
          item.subjectId,
        ),
    )
    .map((item) => ({
      ...item,
      id: `carry-sabado-segunda-${item.subjectId}-${item.topicId || "sem_assunto"}`,
      week: currentWeek,
      dayKey: "segunda",
      dayLabel: "Segunda",
      carryover: true,
      carryoverFrom: "Sábado",
      status: "pendente",
      elapsedSeconds: 0,
      timerStartedAt: null,
      baseElapsedSeconds: 0,
    }));
}

function mergeUniqueScheduleItems(baseItems, extraItems) {
  const keys = new Set(
    (baseItems || []).map(
      (item) =>
        `${item.week}-${item.dayKey}-${item.subjectId}-${item.topicId || item.id}-${item.carryover ? "carry" : "base"}`,
    ),
  );
  const merged = [...(baseItems || [])];
  (extraItems || []).forEach((item) => {
    const key = `${item.week}-${item.dayKey}-${item.subjectId}-${item.topicId || item.id}-${item.carryover ? "carry" : "base"}`;
    if (!keys.has(key)) {
      keys.add(key);
      merged.push(item);
    }
  });
  return merged;
}

function subjectCycleCoverage(subject, items = []) {
  const totalTopics = subject?.topics?.length || 0;
  const validTopicIds = new Set(
    (subject?.topics || []).map((topic) => topic.id),
  );
  const dayOrder = Object.fromEntries(
    WEEK_DAYS.map(([key], index) => [key, index]),
  );
  const orderedItems = [...items].sort(
    (a, b) =>
      Number(a.week || 0) - Number(b.week || 0) ||
      Number(dayOrder[a.dayKey] || 0) - Number(dayOrder[b.dayKey] || 0),
  );
  const covered = new Set();
  let completedAtItem = null;
  orderedItems.forEach((item) => {
    const topicIds =
      Array.isArray(item.topicIds) && item.topicIds.length
        ? item.topicIds
        : item.topicId
          ? [item.topicId]
          : [];
    topicIds.forEach((topicId) => {
      if (validTopicIds.has(topicId)) covered.add(topicId);
    });
    if (!completedAtItem && totalTopics > 0 && covered.size >= totalTopics)
      completedAtItem = item;
  });
  return {
    totalTopics,
    coveredTopics: covered.size,
    missingTopics: Math.max(0, totalTopics - covered.size),
    completedAtItem,
    completed: Boolean(completedAtItem),
    percent: totalTopics ? Math.round((covered.size / totalTopics) * 100) : 0,
  };
}

function cycleCoverageMessage(subject, items = [], context = "nos 12 ciclos") {
  const coverage = subjectCycleCoverage(subject, items);
  if (!coverage.totalTopics)
    return "Essa matéria ainda não tem tópicos cadastrados.";
  if (coverage.completed)
    return `Zera o ciclo na Ciclo ${coverage.completedAtItem.week}, ${dayLabel(coverage.completedAtItem.dayKey)}. Até esse ponto, todos os ${coverage.totalTopics} tópicos aparecem pelo menos uma vez.`;
  return `Não zera o ciclo ${context}: cobre ${coverage.coveredTopics}/${coverage.totalTopics} tópicos (${coverage.percent}%) e ainda ficam ${coverage.missingTopics} tópico(s) sem aparecer.`;
}

function subjectCycleTopicDetails(subject, items = []) {
  const validTopics = subject?.topics || [];
  const coveredIds = new Set();
  (items || []).forEach((item) => {
    const topicIds =
      Array.isArray(item.topicIds) && item.topicIds.length
        ? item.topicIds
        : item.topicId
          ? [item.topicId]
          : [];
    topicIds.forEach((topicId) => coveredIds.add(topicId));
  });
  const missingTopics = validTopics.filter(
    (topic) => !coveredIds.has(topic.id),
  );
  const coveredTopics = validTopics.filter((topic) => coveredIds.has(topic.id));
  const plannedItems = (items || []).filter(
    (item) =>
      item.topicId || (Array.isArray(item.topicIds) && item.topicIds.length),
  );
  return { coveredIds, missingTopics, coveredTopics, plannedItems };
}

function reviewStatus(review) {
  if (review.status === "concluida") return "concluida";
  if (review.status === "andamento") return "andamento";
  const today = parseISODate(TODAY);
  const date = parseBRDate(review.date);
  if (!date) return "próxima";
  if (date < today) return "vencida";
  if (date.getTime() === today.getTime()) return "atual";
  return "próxima";
}

function topicPerformanceScore(subjectId, topicId, questionSessions = []) {
  const sessions = questionSessions.filter(
    (session) =>
      session.subjectId === subjectId &&
      (session.topicId === topicId ||
        (Array.isArray(session.topicIds) &&
          session.topicIds.includes(topicId))),
  );
  const done = sessions.reduce(
    (sum, session) => sum + Number(session.done || 0),
    0,
  );
  const correct = sessions.reduce(
    (sum, session) => sum + Number(session.correct || 0),
    0,
  );
  const wrong = Math.max(0, done - correct);
  const accuracy = done ? Math.round((correct / done) * 100) : 100;
  return done > 0 ? wrong * 3 + Math.max(0, 75 - accuracy) : 0;
}

function topicPriorityValue(topic) {
  const priority = topic?.priority || "Média";
  if (priority === "Alta") return 3;
  if (priority === "Média") return 2;
  return 1;
}

function topicDifficultyValue(topic) {
  const difficulty = topic?.difficulty || "Média";
  if (difficulty === "Alta") return 3;
  if (difficulty === "Média") return 2;
  return 1;
}

function topicStatsForRanking(subjectId, topicId, questionSessions = []) {
  const sessions = questionSessions.filter(
    (session) =>
      session.subjectId === subjectId &&
      (session.topicId === topicId ||
        (Array.isArray(session.topicIds) &&
          session.topicIds.includes(topicId))),
  );
  const done = sessions.reduce(
    (sum, session) => sum + Number(session.done || 0),
    0,
  );
  const correct = sessions.reduce(
    (sum, session) => sum + Number(session.correct || 0),
    0,
  );
  const accuracy = done ? Math.round((correct / done) * 100) : 0;
  const confidence = done <= 10 ? 0 : done <= 30 ? 1 : 2;
  return { done, correct, accuracy, confidence, hasPerformance: done > 0 };
}

function subjectReadyForReorder(subject, questionSessions = []) {
  const topics = subject?.topics || [];
  if (!topics.length) return false;
  return topics.every(
    (topic) =>
      topicStatsForRanking(subject.id, topic.id, questionSessions)
        .hasPerformance,
  );
}

function rankTopicsByPerformance(
  subjectId,
  topics = [],
  questionSessions = [],
) {
  return [...topics].sort((a, b) => {
    const aStats = topicStatsForRanking(subjectId, a.id, questionSessions);
    const bStats = topicStatsForRanking(subjectId, b.id, questionSessions);
    if (aStats.confidence !== bStats.confidence)
      return bStats.confidence - aStats.confidence;
    if (aStats.accuracy !== bStats.accuracy)
      return aStats.accuracy - bStats.accuracy;
    const aPri = topicPriorityValue(a);
    const bPri = topicPriorityValue(b);
    if (aPri !== bPri) return bPri - aPri;
    return 0;
  });
}

function sortTopicsForNextCycle(subject, questionSessions = []) {
  const topics = subject?.topics || [];
  if (!subjectReadyForReorder(subject, questionSessions)) return [...topics];
  return rankTopicsByPerformance(subject.id, topics, questionSessions);
}

function sortTopicsByPriority(subjectId, topics = [], questionSessions = []) {
  return [...topics].sort(
    (a, b) =>
      topicPriorityValue(b) - topicPriorityValue(a) ||
      topicPerformanceScore(subjectId, b.id, questionSessions) -
        topicPerformanceScore(subjectId, a.id, questionSessions) ||
      topicDifficultyValue(b) - topicDifficultyValue(a),
  );
}

function sortedTopicsForSubject(
  subject,
  usedTopicIdsBySubject,
  questionSessions = [],
) {
  const allTopics = subject.topics || [];
  if (!usedTopicIdsBySubject[subject.id])
    usedTopicIdsBySubject[subject.id] = new Set();
  const unusedTopics = allTopics.filter(
    (topic) => !usedTopicIdsBySubject[subject.id].has(topic.id),
  );
  if (unusedTopics.length > 0)
    return sortTopicsByPriority(subject.id, unusedTopics, questionSessions);
  usedTopicIdsBySubject[subject.id].clear();
  return sortTopicsByPriority(subject.id, allTopics, questionSessions);
}

function pickNextTopicsForPlan(
  subject,
  usedTopicIdsBySubject,
  subjectMinutes,
  maxTopicsByMode,
  questionSessions = [],
) {
  const pendingTopics = sortedTopicsForSubject(
    subject,
    usedTopicIdsBySubject,
    questionSessions,
  );
  if (!usedTopicIdsBySubject[subject.id])
    usedTopicIdsBySubject[subject.id] = new Set();
  const selectedTopics = [];
  let usedMinutes = 0;
  for (const topic of pendingTopics) {
    const estimated = estimateStaticTopicMinutes(topic);
    if (selectedTopics.length >= maxTopicsByMode) break;
    if (selectedTopics.length > 0 && usedMinutes + estimated > subjectMinutes)
      break;
    selectedTopics.push(topic);
    usedMinutes += estimated;
    usedTopicIdsBySubject[subject.id].add(topic.id);
  }
  const finalTopics = selectedTopics.length
    ? selectedTopics
    : pendingTopics.slice(0, 1);
  finalTopics.forEach((topic) =>
    usedTopicIdsBySubject[subject.id].add(topic.id),
  );
  return { finalTopics, usedMinutes };
}

function buildTwelveWeekSchedule(
  roadmap,
  scheduleConfig = defaultScheduleConfig(),
  settings = defaultSettings(),
  questionSessions = [],
) {
  const dailyQuestions = dailyQuestionTarget(scheduleConfig);
  const dailyStudyMinutes = Math.max(
    60,
    Number(scheduleConfig.dailyStudyMinutes) || 180,
  );
  const subjectsPerDay = Math.max(
    1,
    Number(scheduleConfig.subjectsPerDay) || 2,
  );
  const availableMinutes = Math.max(30, dailyStudyMinutes);
  const allItems = [];
  const usedTopicIdsBySubject = {};
  const subjectUseCount = {};
  const subjectLastWeek = {};
  const subjectLastDayIndex = {};
  const currentWeek = currentCycleWeek(
    SYSTEM_TODAY,
    settings?.studyStartDate || DEFAULT_STUDY_START_DATE,
  );
  const todayIndex = WEEK_DAYS.findIndex(([key]) => key === TODAY_DAY_KEY);

  for (let week = 1; week <= 12; week += 1) {
    const weeklyUseCount = {};
    STUDY_DAYS.forEach((dayKey, dayIndex) => {
      if (
        week === currentWeek &&
        WEEK_DAYS.findIndex(([key]) => key === dayKey) < todayIndex
      ) {
        return;
      }

      const selectedSubjects = [];
      while (selectedSubjects.length < subjectsPerDay) {
        const candidates = roadmap
          .map((subject) => {
            const totalTopics = subject.topics?.length || 0;
            const usedCount = usedTopicIdsBySubject[subject.id]?.size || 0;
            const hasUnusedTopics = totalTopics > 0 && usedCount < totalTopics;
            const highPriorityMissing = (subject.topics || []).filter(
              (topic) =>
                topic.priority === "Alta" &&
                !usedTopicIdsBySubject[subject.id]?.has(topic.id),
            ).length;
            const mediumPriorityMissing = (subject.topics || []).filter(
              (topic) =>
                topic.priority === "Média" &&
                !usedTopicIdsBySubject[subject.id]?.has(topic.id),
            ).length;
            const neverStudied = !subjectUseCount[subject.id];
            const lastWeek = subjectLastWeek[subject.id] || 0;
            const lastDayIndex = subjectLastDayIndex[subject.id];
            const repeatedYesterday =
              lastWeek === week && lastDayIndex === dayIndex - 1;
            const sameWeekSpacing =
              lastWeek === week
                ? Math.max(0, dayIndex - Number(lastDayIndex || 0))
                : 6;
            const spacingBonus = Math.min(
              6,
              Math.max(0, week - lastWeek + sameWeekSpacing / 3),
            );
            const coverageBonus = neverStudied ? 12 : 0;
            const unusedBonus = hasUnusedTopics ? 8 : 0;
            const priorityCoverageBonus =
              highPriorityMissing > 0
                ? 18 + highPriorityMissing * 2
                : mediumPriorityMissing > 0
                  ? 6 + mediumPriorityMissing
                  : 0;
            const weaknessBonus =
              totalTopics > 0 && !hasUnusedTopics
                ? Math.max(
                    ...subject.topics.map((topic) =>
                      topicPerformanceScore(
                        subject.id,
                        topic.id,
                        questionSessions,
                      ),
                    ),
                    0,
                  ) / 10
                : 0;
            const weightScore = Number(subject.weight || 1) * 3.2;
            const usePenalty =
              (subjectUseCount[subject.id] || 0) * 0.65 +
              (weeklyUseCount[subject.id] || 0) * 3.5 +
              (repeatedYesterday ? 4 : 0) +
              1;
            return {
              ...subject,
              score:
                (weightScore +
                  coverageBonus +
                  unusedBonus +
                  priorityCoverageBonus +
                  spacingBonus +
                  weaknessBonus) /
                usePenalty,
            };
          })
          .filter(
            (subject) =>
              !selectedSubjects.some((selected) => selected.id === subject.id),
          )
          .sort(
            (a, b) =>
              b.score - a.score ||
              Number(b.weight || 0) - Number(a.weight || 0),
          );
        if (!candidates.length) break;
        const selected = candidates[0];
        selectedSubjects.push(selected);
        subjectUseCount[selected.id] = (subjectUseCount[selected.id] || 0) + 1;
        weeklyUseCount[selected.id] = (weeklyUseCount[selected.id] || 0) + 1;
        subjectLastWeek[selected.id] = week;
        subjectLastDayIndex[selected.id] = dayIndex;
      }

      const totalWeight =
        selectedSubjects.reduce(
          (sum, subject) => sum + Number(subject.weight || 1),
          0,
        ) ||
        selectedSubjects.length ||
        1;
      const questionTargets = distributeDailyQuestions(
        selectedSubjects,
        dailyQuestions,
      );
      selectedSubjects.forEach((subject) => {
        const subjectMinutes = Math.max(
          40,
          Math.round(
            (availableMinutes * Number(subject.weight || 1)) / totalWeight,
          ),
        );
        const manualLimit = Number(
          scheduleConfig.topicLimits?.[subject.id] || 0,
        );
        const maxTopicsByMode =
          scheduleConfig.mode === "manual" && manualLimit > 0 ? manualLimit : 1;
        const { finalTopics, usedMinutes } = pickNextTopicsForPlan(
          subject,
          usedTopicIdsBySubject,
          subjectMinutes,
          maxTopicsByMode,
          questionSessions,
        );
        allItems.push({
          id: `auto-w${week}-${dayKey}-${subject.id}-${finalTopics.map((topic) => topic.id).join("_")}`,
          week,
          dayKey,
          dayLabel: dayLabel(dayKey),
          subjectId: subject.id,
          topicId: finalTopics[0]?.id || null,
          topicIds: finalTopics.map((topic) => topic.id),
          subject: subject.subject,
          topic:
            finalTopics.map((topic) => topic.title).join(" + ") ||
            "Assunto a definir",
          type: "Estudo",
          minutes: Math.max(
            30,
            usedMinutes || estimateStaticTopicMinutes(finalTopics[0]),
          ),
          questionsTarget: questionTargets[subject.id] || 0,
          status: "pendente",
          elapsedSeconds: 0,
          plannedBy: "ciclo_12_semanas",
          plannedWeight: subject.weight,
          plannedTopicsCount: finalTopics.length,
        });
      });
    });

    sundayWeekOnePlan.forEach((item) =>
      allItems.push({
        ...item,
        id: `auto-w${week}-${item.id}`,
        week,
        dayKey: "domingo",
        dayLabel: "Domingo",
        topicIds: [],
        status: "pendente",
        elapsedSeconds: 0,
        topic:
          item.subjectId === "planejamento"
            ? `Gerar e ajustar o Ciclo ${week + 1}`
            : item.topic,
      }),
    );
  }

  return allItems;
}

function defaultScheduleConfig() {
  return {
    subjectsPerDay: "2",
    dailyStudyMinutes: "240",
    questionMinutes: "50",
    mode: "peso",
    topicLimits: {},
  };
}

function syncWeeklyQuestionsWithDaily(settings, scheduleConfig) {
  const daily = dailyQuestionTarget(scheduleConfig);
  if (!daily) return settings;
  return { ...settings, weeklyQuestions: String(daily * STUDY_DAYS.length) };
}

function defaultSettings() {
  return {
    studentName: "",
    dailyHours: "4",
    weeklyQuestions: "300",
    examDate: "",
    studyStartDate: TODAY,
  };
}

function createInitialState(examOverride = null) {
  const roadmap = clone(examOverride?.roadmap || roadmapSeed);
  const scheduleConfig = defaultScheduleConfig();
  const settings = syncWeeklyQuestionsWithDaily(
    defaultSettings(),
    scheduleConfig,
  );
  const hasRoadmap = Array.isArray(roadmap) && roadmap.length > 0;
  const weeklySchedule = hasRoadmap
    ? buildTwelveWeekSchedule(roadmap, scheduleConfig, settings, [])
    : [];
  const schedule = hasRoadmap
    ? scheduleFromWeekly(weeklySchedule, roadmap, 1, TODAY_DAY_KEY)
    : [];

  const activeExamKey = examOverride?.key || ACTIVE_EXAM_KEY;
  return {
    roadmapVersion: examOverride?.roadmapVersion || ROADMAP_VERSION,
    profileKey: USER_PROFILE_KEY,
    activeExamKey,
    storageProfileKey: storageKeyForExam(activeExamKey),
    customExams: normalizeCustomExamList(examOverride?.customExams),
    deletedBuiltInExamKeys: normalizeDeletedBuiltInExamKeys(
      examOverride?.deletedBuiltInExamKeys,
    ),
    view: "dashboard",
    currentStudyIsoDate: TODAY,
    currentStudyDayKey: TODAY_DAY_KEY,
    currentStudyWeek: 1,
    lastStudyDayKey: TODAY_DAY_KEY,
    lastScheduleSnapshot: schedule,
    schedule,
    weeklySchedule,
    roadmap,
    errors: [],
    reviews: [],
    notes: [],
    questionSessions: [],
    simulatedTests: [],
    questionCarryovers: [],
    settings,
    scheduleConfig,
  };
}

function normalizeLoadedState(value) {
  const loaded = value && typeof value === "object" ? value : {};
  const loadedCustomExams = normalizeCustomExamList(loaded.customExams);
  const loadedDeletedBuiltInExamKeys = normalizeDeletedBuiltInExamKeys(
    loaded.deletedBuiltInExamKeys,
  );
  const candidateActiveExamKey =
    loaded.activeExamKey || getLocalActiveExamKey() || ACTIVE_EXAM_KEY;
  const availableExams = allAvailableExams(
    loadedCustomExams,
    loadedDeletedBuiltInExamKeys,
  );
  const activeExamKey = availableExams.some(
    (exam) => exam.key === candidateActiveExamKey,
  )
    ? candidateActiveExamKey
    : availableExams[0]?.key || ACTIVE_EXAM_KEY;
  const examDefinition = findExamDefinition(activeExamKey, loadedCustomExams);
  const initial = createInitialState({
    ...examDefinition,
    customExams: loadedCustomExams,
  });
  const expectedRoadmapVersion =
    examDefinition?.roadmapVersion || ROADMAP_VERSION;
  const isCustomExam =
    activeExamKey !== ACTIVE_EXAM_KEY || Boolean(loaded.customExam);
  const hasLoadedRoadmap =
    Array.isArray(loaded.roadmap) && loaded.roadmap.length > 0;
  const isCurrentRoadmap =
    loaded.roadmapVersion === expectedRoadmapVersion ||
    loaded.roadmapVersion === ROADMAP_VERSION ||
    isCustomExam;
  const roadmapData =
    (isCurrentRoadmap || isCustomExam) && hasLoadedRoadmap
      ? loaded.roadmap
      : initial.roadmap;
  const scheduleConfig = {
    ...defaultScheduleConfig(),
    ...(isCurrentRoadmap ? loaded.scheduleConfig || {} : {}),
  };
  const mergedSettings = {
    ...defaultSettings(),
    ...(initial.settings || {}),
    ...(loaded.settings || {}),
  };
  const calculatedCurrentWeek = currentCycleWeek(
    SYSTEM_TODAY,
    mergedSettings.studyStartDate,
  );
  const loadedStudyIsoDate =
    loaded.currentStudyIsoDate || loaded.currentStudyDate || "";
  const isSameStudyDate = loadedStudyIsoDate === TODAY;
  return {
    ...initial,
    ...loaded,
    roadmapVersion: loaded.roadmapVersion || expectedRoadmapVersion,
    profileKey: USER_PROFILE_KEY,
    activeExamKey,
    storageProfileKey:
      loaded.storageProfileKey || storageKeyForExam(activeExamKey),
    customExams: loadedCustomExams,
    deletedBuiltInExamKeys: loadedDeletedBuiltInExamKeys,
    currentStudyIsoDate: TODAY,
    view: loaded.view || initial.view,
    currentStudyDayKey: isSameStudyDate
      ? loaded.currentStudyDayKey || TODAY_DAY_KEY
      : TODAY_DAY_KEY,
    currentStudyWeek: isSameStudyDate
      ? Number(loaded.currentStudyWeek || calculatedCurrentWeek)
      : calculatedCurrentWeek,
    roadmap: roadmapData,
    schedule: hydrateSchedule(
      withDistributedQuestionTargets(
        normalizeScheduleItems(
          isCurrentRoadmap && isSameStudyDate && Array.isArray(loaded.schedule)
            ? loaded.schedule
            : todayScheduleFromWeekly(
                initial.weeklySchedule,
                roadmapData,
                mergedSettings.studyStartDate,
              ),
          scheduleConfig,
        ),
        scheduleConfig,
        roadmapData,
      ),
      roadmapData,
    ),
    weeklySchedule: withDistributedQuestionTargets(
      normalizeScheduleItems(
        isCurrentRoadmap && Array.isArray(loaded.weeklySchedule)
          ? loaded.weeklySchedule
          : initial.weeklySchedule,
        scheduleConfig,
      ),
      scheduleConfig,
      roadmapData,
    ),
    errors: Array.isArray(loaded.errors) ? loaded.errors : [],
    reviews: Array.isArray(loaded.reviews) ? loaded.reviews : [],
    notes: Array.isArray(loaded.notes) ? loaded.notes : [],
    questionSessions: Array.isArray(loaded.questionSessions)
      ? loaded.questionSessions
      : [],
    simulatedTests: Array.isArray(loaded.simulatedTests)
      ? loaded.simulatedTests
      : [],
    questionCarryovers: normalizeQuestionCarryovers(loaded.questionCarryovers),
    settings: mergedSettings,
    scheduleConfig,
  };
}
function getDeviceId() {
  // Chave composta: mesmo usuário + edital ativo.
  // Isso separa os dados por concurso e evita apagar Supabase ao trocar edital.
  return storageKeyForExam(getLocalActiveExamKey());
}

function loadStateFromLocalCache() {
  if (typeof window === "undefined") return createInitialState();
  try {
    const activeExamKey = getLocalActiveExamKey();
    const cached =
      localStorage.getItem(localCacheKeyForExam(activeExamKey)) ||
      localStorage.getItem(LOCAL_CACHE_KEY);
    return cached
      ? normalizeLoadedState(JSON.parse(cached))
      : createInitialState(findExamDefinition(activeExamKey));
  } catch (error) {
    console.error("Erro ao carregar cache local:", error);
    return createInitialState();
  }
}
function saveStateToLocalCache(state) {
  if (typeof window === "undefined") return;
  try {
    const examKey = state?.activeExamKey || ACTIVE_EXAM_KEY;
    setLocalActiveExamKey(examKey);
    localStorage.setItem(localCacheKeyForExam(examKey), JSON.stringify(state));
  } catch (error) {
    console.error("Erro ao salvar cache local:", error);
  }
}
async function loadProfileIndexFromSupabase() {
  const localActiveExamKey = getLocalActiveExamKey();
  const fallback = {
    activeExamKey: localActiveExamKey,
    customExams: [],
    deletedBuiltInExamKeys: [],
  };
  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("state")
    .eq("device_id", PROFILE_INDEX_KEY)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar índice de editais:", error);
    return fallback;
  }

  const indexState = data?.state || {};
  const customExams = normalizeCustomExamList(indexState.customExams);
  const deletedBuiltInExamKeys = normalizeDeletedBuiltInExamKeys(
    indexState.deletedBuiltInExamKeys,
  );
  const availableExams = allAvailableExams(customExams, deletedBuiltInExamKeys);
  const candidateActiveExamKey =
    indexState.activeExamKey || localActiveExamKey || ACTIVE_EXAM_KEY;
  const activeExamKey = availableExams.some(
    (exam) => exam.key === candidateActiveExamKey,
  )
    ? candidateActiveExamKey
    : availableExams[0]?.key || ACTIVE_EXAM_KEY;
  setLocalActiveExamKey(activeExamKey);
  return { activeExamKey, customExams, deletedBuiltInExamKeys };
}

async function saveProfileIndexToSupabase(
  activeExamKey,
  customExams,
  deletedBuiltInExamKeys = [],
) {
  setLocalActiveExamKey(activeExamKey || ACTIVE_EXAM_KEY);
  if (!supabase) return;
  const state = {
    profileKey: USER_PROFILE_KEY,
    activeExamKey: activeExamKey || ACTIVE_EXAM_KEY,
    customExams: normalizeCustomExamList(customExams),
    deletedBuiltInExamKeys: normalizeDeletedBuiltInExamKeys(
      deletedBuiltInExamKeys,
    ),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from(SUPABASE_TABLE).upsert(
    {
      device_id: PROFILE_INDEX_KEY,
      app_version: APP_VERSION,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" },
  );
  if (error) console.error("Erro ao salvar índice de editais:", error);
}

async function loadStateFromSupabase() {
  if (!supabase) return null;

  const profileIndex = await loadProfileIndexFromSupabase();
  const activeExamKey = profileIndex.activeExamKey || ACTIVE_EXAM_KEY;
  const customExams = normalizeCustomExamList(profileIndex.customExams);
  const deletedBuiltInExamKeys = normalizeDeletedBuiltInExamKeys(
    profileIndex.deletedBuiltInExamKeys,
  );
  const deviceId = storageKeyForExam(activeExamKey);

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("state")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar do Supabase:", error);
    return null;
  }

  if (data?.state) {
    return normalizeLoadedState({
      ...data.state,
      activeExamKey,
      storageProfileKey: deviceId,
      customExams: normalizeCustomExamList(data.state.customExams).length
        ? data.state.customExams
        : customExams,
      deletedBuiltInExamKeys: normalizeDeletedBuiltInExamKeys(
        data.state.deletedBuiltInExamKeys,
      ).length
        ? data.state.deletedBuiltInExamKeys
        : deletedBuiltInExamKeys,
    });
  }

  const examDefinition = findExamDefinition(activeExamKey, customExams);
  if (activeExamKey !== ACTIVE_EXAM_KEY || examDefinition?.key) {
    return createInitialState({
      ...examDefinition,
      customExams,
      deletedBuiltInExamKeys,
    });
  }

  return null;
}
async function saveStateToSupabase(state) {
  const activeExamKey = state?.activeExamKey || ACTIVE_EXAM_KEY;
  const storageProfileKey =
    state?.storageProfileKey || storageKeyForExam(activeExamKey);
  const stateToSave = {
    ...state,
    profileKey: USER_PROFILE_KEY,
    activeExamKey,
    storageProfileKey,
    customExams: normalizeCustomExamList(state?.customExams),
    deletedBuiltInExamKeys: normalizeDeletedBuiltInExamKeys(
      state?.deletedBuiltInExamKeys,
    ),
    roadmapVersion: state?.roadmapVersion || ROADMAP_VERSION,
  };

  saveStateToLocalCache(stateToSave);
  await saveProfileIndexToSupabase(
    activeExamKey,
    stateToSave.customExams,
    stateToSave.deletedBuiltInExamKeys,
  );
  if (!supabase) return { ok: false, source: "local" };

  const deviceId = storageProfileKey;
  const { error } = await supabase.from(SUPABASE_TABLE).upsert(
    {
      device_id: deviceId,
      app_version: APP_VERSION,
      state: stateToSave,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "device_id" },
  );

  if (error) {
    console.error("Erro ao salvar no Supabase:", error);
    return { ok: false, source: "supabase", error };
  }

  return { ok: true, source: "supabase" };
}

function Card({ children, className = "" }) {
  return (
    <div
      className={cls(
        "rounded-3xl border border-stone-200/80 bg-white/90 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StudyCard({ children, completed = false, className = "" }) {
  return (
    <div
      className={cls(
        "rounded-3xl border shadow-sm transition",
        completed
          ? "border-emerald-300 bg-emerald-100/90 text-stone-950 ring-1 ring-emerald-200"
          : "border-stone-200/80 bg-white/90",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Progress({ value }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampPercent(value)}%` }}
        transition={{ duration: 0.45 }}
        className="h-full rounded-full bg-gradient-to-r from-stone-950 via-amber-900 to-stone-700"
      />
    </div>
  );
}

function Stat({ icon: Icon, title, value, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-stone-500">{title}</p>
          <p className="mt-2 break-words text-3xl font-black tracking-tight text-stone-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-stone-500">{hint}</p>
        </div>
        <div className="rounded-2xl bg-stone-950 p-3 text-white">
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-stone-950">
        <Icon size={22} />
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
    </div>
  );
}

function Badge({ children, tone = "stone" }) {
  const tones = {
    stone: "border-stone-200 bg-stone-100 text-stone-700",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-100 bg-red-50 text-red-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        tones[tone] || tones.stone,
      )}
    >
      {children}
    </span>
  );
}

function VersionToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return undefined;

    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
      className="fixed bottom-5 right-5 z-[9999] rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 shadow-2xl"
    >
      Sistema atualizado {APP_VERSION} — salvamento Supabase
    </motion.div>
  );
}

function CompletionModal({ block, form, setForm, onClose, onConfirm }) {
  const total = Math.max(0, Number(form.totalQuestions) || 0);
  const correct = Math.max(
    0,
    Math.min(total, Number(form.correctQuestions) || 0),
  );
  const wrong = Math.max(0, total - correct);
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const target = Math.max(0, Number(block.questionsTarget) || 0);
  const missing = target > 0 ? Math.max(0, target - total) : 0;
  const needsReason = missing > 0 && !form.missingReason;

  if (needsReason && form.showReasonStep) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-900">
                  Questões pendentes
                </p>
                <h3 className="mt-1 text-xl font-black text-stone-950">
                  Faltaram {missing} questão(ões)
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Meta: {target} • Feitas: {total}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-2xl border border-stone-200 bg-white p-2 text-stone-500 hover:bg-stone-50"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 text-sm font-semibold text-stone-700">
              Por que faltaram essas {missing} questão(ões)?
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <button
                onClick={() => {
                  setForm((c) => ({ ...c, missingReason: "sem_questoes" }));
                  onConfirm();
                }}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left hover:bg-stone-100"
              >
                <p className="font-bold text-stone-900">
                  Não encontrei questões desse assunto
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Assunto concluído. As {missing} questão(ões) não serão
                  acumuladas no próximo dia.
                </p>
              </button>
              <button
                onClick={() => {
                  setForm((c) => ({ ...c, missingReason: "vou_depois" }));
                  onConfirm();
                }}
                className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-left hover:bg-amber-100"
              >
                <p className="font-bold text-amber-900">Vou fazer depois</p>
                <p className="mt-1 text-xs text-amber-700">
                  As {missing} questão(ões) serão acumuladas na meta do próximo
                  dia.
                </p>
              </button>
            </div>
            <button
              onClick={() => setForm((c) => ({ ...c, showReasonStep: false }))}
              className="mt-4 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-600"
            >
              Voltar
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.96, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 12 }}
          className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-900">
                Concluir estudo
              </p>
              <h3 className="mt-1 text-2xl font-black text-stone-950">
                {block.subject}
              </h3>
              <p className="text-sm text-stone-500">
                Assunto do dia: {block.topic}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl border border-stone-200 bg-white p-2 text-stone-500 hover:bg-stone-50"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Questões feitas
              </label>
              <input
                value={form.totalQuestions}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    totalQuestions: event.target.value,
                  }))
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Ex: 30"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Acertos
              </label>
              <input
                value={form.correctQuestions}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    correctQuestions: event.target.value,
                  }))
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Ex: 15"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Erros calculados
              </label>
              <div className="mt-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700">
                <b>{wrong}</b> erros
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              <b>{correct}</b> acertos
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
              <b>{wrong}</b> erros
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
              <b>{percent}%</b> aproveitamento
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
              Anotações do assunto
            </label>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="mt-2 h-28 w-full rounded-2xl border border-stone-200 px-4 py-3"
              placeholder="O que você estudou, o que entendeu, pontos de atenção..."
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Erro principal
              </label>
              <textarea
                value={form.errorText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    errorText: event.target.value,
                  }))
                }
                className="mt-2 h-24 w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Opcional: descreva um erro específico para enviar ao Caderno de Erros."
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                Correção
              </label>
              <textarea
                value={form.fixText}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fixText: event.target.value,
                  }))
                }
                className="mt-2 h-24 w-full rounded-2xl border border-stone-200 px-4 py-3"
                placeholder="Opcional: como corrigir esse erro."
              />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const t = Math.max(0, Number(form.totalQuestions) || 0);
                const tgt = Math.max(0, Number(block.questionsTarget) || 0);
                if (tgt > 0 && t < tgt) {
                  setForm((c) => ({ ...c, showReasonStep: true }));
                } else {
                  onConfirm();
                }
              }}
              className="rounded-2xl bg-emerald-700 px-5 py-3 font-semibold text-white"
            >
              <CheckCircle2 size={16} className="inline" /> Salvar e concluir
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function stripNoteMarkup(text) {
  return String(text || "")
    .replace(/\[\[([\s\S]+?)\]\]/g, "$1")
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "$1")
    .replace(/___([\s\S]+?)___/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/==([\s\S]+?)==/g, "$1");
}

function splitInlineNoteMarkup(line) {
  const segments = [];
  const pattern =
    /(\[\[[\s\S]+?\]\]|\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|==[\s\S]+?==)/g;
  let lastIndex = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("[[") && token.endsWith("]]")) {
      segments.push({ type: "keyword", text: token.slice(2, -2) });
    } else if (token.startsWith("***") && token.endsWith("***")) {
      segments.push({ type: "bold", text: token.slice(3, -3) });
    } else if (token.startsWith("___") && token.endsWith("___")) {
      segments.push({ type: "bold", text: token.slice(3, -3) });
    } else if (token.startsWith("**") && token.endsWith("**")) {
      segments.push({ type: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("__") && token.endsWith("__")) {
      segments.push({ type: "underline", text: token.slice(2, -2) });
    } else if (token.startsWith("==") && token.endsWith("==")) {
      segments.push({ type: "highlight", text: token.slice(2, -2) });
    } else {
      segments.push({ type: "text", text: token });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < line.length) {
    segments.push({ type: "text", text: line.slice(lastIndex) });
  }
  return segments;
}

function FormattedNoteText({ text, compact = false }) {
  const safeText = String(text || "");
  const lines = safeText.split(/\r?\n/);
  return (
    <div
      className={cls(
        "whitespace-pre-wrap break-words",
        compact ? "text-sm leading-6" : "text-base leading-8",
      )}
    >
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className={line.trim() ? "" : "min-h-5"}>
          {splitInlineNoteMarkup(line).map((segment, index) => {
            if (segment.type === "bold") {
              return (
                <strong key={index} className="font-black text-stone-950">
                  {segment.text}
                </strong>
              );
            }
            if (segment.type === "underline") {
              return (
                <span
                  key={index}
                  className="font-semibold underline decoration-amber-500 decoration-2 underline-offset-4"
                >
                  {segment.text}
                </span>
              );
            }
            if (segment.type === "highlight") {
              return (
                <mark
                  key={index}
                  className="rounded-md bg-amber-200 px-1 font-semibold text-stone-950"
                >
                  {segment.text}
                </mark>
              );
            }
            if (segment.type === "keyword") {
              return (
                <mark
                  key={index}
                  className="rounded-md bg-emerald-100 px-1 font-black text-emerald-900 ring-1 ring-emerald-200"
                >
                  {segment.text}
                </mark>
              );
            }
            return <React.Fragment key={index}>{segment.text}</React.Fragment>;
          })}
        </div>
      ))}
    </div>
  );
}

function notePlainPreview(text, maxLength = 260) {
  const clean = stripNoteMarkup(text).replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

export default function App() {
  const initial = useMemo(() => loadStateFromLocalCache(), []);
  const normalizedInitialView = [
    "performance",
    "tomorrow",
    "final-stretch",
  ].includes(initial.view)
    ? "dashboard"
    : initial.view || "dashboard";
  const [view, setView] = useState(normalizedInitialView);
  const [currentStudyDayKey, setCurrentStudyDayKey] = useState(
    initial.currentStudyDayKey || TODAY_DAY_KEY,
  );
  const [currentStudyWeek, setCurrentStudyWeek] = useState(
    Number(
      initial.currentStudyWeek ||
        currentCycleWeek(SYSTEM_TODAY, initial.settings?.studyStartDate),
    ),
  );
  const [schedule, setSchedule] = useState(initial.schedule);
  const [weeklySchedule, setWeeklySchedule] = useState(
    initial.weeklySchedule || [],
  );
  const [roadmap, setRoadmap] = useState(initial.roadmap);
  const [customExams, setCustomExams] = useState(
    normalizeCustomExamList(initial.customExams),
  );
  const [deletedBuiltInExamKeys, setDeletedBuiltInExamKeys] = useState(
    normalizeDeletedBuiltInExamKeys(initial.deletedBuiltInExamKeys),
  );
  const [activeExamKeyState, setActiveExamKeyState] = useState(
    initial.activeExamKey || ACTIVE_EXAM_KEY,
  );
  const [storageProfileKeyState, setStorageProfileKeyState] = useState(
    initial.storageProfileKey || STORAGE_PROFILE_KEY,
  );
  const [errors, setErrors] = useState(initial.errors || []);
  const [reviews, setReviews] = useState(initial.reviews || []);
  const [notes, setNotes] = useState(initial.notes || []);
  const [viewingNote, setViewingNote] = useState(null);
  const noteTextAreaRef = useRef(null);
  const [questionSessions, setQuestionSessions] = useState(
    initial.questionSessions || [],
  );
  const [simulatedTests, setSimulatedTests] = useState(
    initial.simulatedTests || [],
  );
  const [questionCarryovers, setQuestionCarryovers] = useState(
    normalizeQuestionCarryovers(initial.questionCarryovers),
  );
  const [settings, setSettings] = useState({
    ...defaultSettings(),
    ...(initial.settings || {}),
  });
  const dashboardStudentName = settings.studentName?.trim();
  const dashboardTitle = dashboardStudentName
    ? `Vá e Vença ${dashboardStudentName}`
    : "Vá e Vença";
  const effectiveCycleWeek = useMemo(
    () => currentCycleWeek(SYSTEM_TODAY, settings.studyStartDate),
    [settings.studyStartDate],
  );
  const [scheduleConfig, setScheduleConfig] = useState({
    ...defaultScheduleConfig(),
    ...(initial.scheduleConfig || {}),
  });
  const [cycleDraftConfig, setCycleDraftConfig] = useState({
    ...defaultScheduleConfig(),
    ...(initial.scheduleConfig || {}),
  });
  const [weeklyDayFilter, setWeeklyDayFilter] = useState(TODAY_DAY_KEY);
  const [weeklyWeekFilter, setWeeklyWeekFilter] = useState(
    currentCycleWeek(SYSTEM_TODAY, initial.settings?.studyStartDate),
  );
  const [scheduleWeekFilter, setScheduleWeekFilter] = useState(
    currentCycleWeek(SYSTEM_TODAY, initial.settings?.studyStartDate),
  );
  const [scheduleDayFilter, setScheduleDayFilter] = useState("all");
  const [scheduleSubjectFrequencyFilter, setScheduleSubjectFrequencyFilter] =
    useState("all");
  const [prioritySwap, setPrioritySwap] = useState({
    missingTopicId: "",
    replaceItemId: "",
  });
  const [prioritySwapMessage, setPrioritySwapMessage] = useState("");
  const [manualScheduleOpen, setManualScheduleOpen] = useState(false);
  const [manualScheduleWeek, setManualScheduleWeek] = useState(
    currentCycleWeek(SYSTEM_TODAY, initial.settings?.studyStartDate),
  );
  const [manualScheduleDraft, setManualScheduleDraft] = useState({});
  const [manualScheduleMessage, setManualScheduleMessage] = useState("");
  const [reportWeekFilter, setReportWeekFilter] = useState(
    currentCycleWeek(SYSTEM_TODAY, initial.settings?.studyStartDate),
  );
  const [reportDayFilter, setReportDayFilter] = useState("all");
  const [roadmapSubject, setRoadmapSubject] = useState("all");
  const [roadmapStatus, setRoadmapStatus] = useState("todos");
  const [roadmapPriority, setRoadmapPriority] = useState("todas");
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState("atual");
  const [errorSubjectFilter, setErrorSubjectFilter] = useState("all");
  const [errorStatusFilter, setErrorStatusFilter] = useState("pendentes");
  const [errorFormOpen, setErrorFormOpen] = useState(false);
  const [errorForm, setErrorForm] = useState({
    subjectId: "",
    topicId: "",
    error: "",
    fix: "",
  });
  const [errorFormMessage, setErrorFormMessage] = useState("");
  const [correctionForm, setCorrectionForm] = useState({ id: null, fix: "" });
  const [viewingError, setViewingError] = useState(null);
  const [editingErrorId, setEditingErrorId] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    subjectId: "",
    topicId: "",
    done: "",
    correct: "",
    time: "",
    notes: "",
  });
  const [questionFilterSubject, setQuestionFilterSubject] = useState("all");
  const [questionFilterTopic, setQuestionFilterTopic] = useState("all");
  const [simulatedForm, setSimulatedForm] = useState({
    title: defaultSimulatedTitle(initial.simulatedTests || []),
    total: "",
    correct: "",
    essayScore: "",
    timeSpent: "",
    date: toBRDate(parseISODate(TODAY)),
    notes: "",
    subjects: {},
  });
  const [simulatedMessage, setSimulatedMessage] = useState("");
  const [simulatedCompareA, setSimulatedCompareA] = useState("");
  const [simulatedCompareB, setSimulatedCompareB] = useState("");
  const [simulatedSubjectsOpen, setSimulatedSubjectsOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    subjectId: "",
    topicId: "",
    title: "",
    text: "",
  });
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteSubjectFilter, setNoteSubjectFilter] = useState("all");
  const [noteTopicFilter, setNoteTopicFilter] = useState("all");
  const [noteSearch, setNoteSearch] = useState("");
  const [noteFormMessage, setNoteFormMessage] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [importMode, setImportMode] = useState("manual");
  const [importForm, setImportForm] = useState({ subject: "", topics: [""] });
  const [importMessage, setImportMessage] = useState("");
  const [examCreatorOpen, setExamCreatorOpen] = useState(false);
  const [examCreatorMode, setExamCreatorMode] = useState("manual");
  const [examCreatorMessage, setExamCreatorMessage] = useState("");

  const [editingExamKey, setEditingExamKey] = useState(null);
  const [examForm, setExamForm] = useState({
    label: "",
    noExamDate: false,
    examDate: "",
    subjects: [{ subject: "", weight: "3", topics: [""] }],
  });
  const [pdfImportText, setPdfImportText] = useState("");
  const [pdfImportFileName, setPdfImportFileName] = useState("");
  const [pdfCargoOptions, setPdfCargoOptions] = useState([]);
  const [selectedPdfCargoKeys, setSelectedPdfCargoKeys] = useState([]);
  const [pdfImportMessage, setPdfImportMessage] = useState("");
  const [pdfPreviewReady, setPdfPreviewReady] = useState(false);
  const [completionBlock, setCompletionBlock] = useState(null);
  const [completionForm, setCompletionForm] = useState({
    notes: "",
    totalQuestions: "",
    correctQuestions: "",
    errorText: "",
    fixText: "",
    missingReason: "",
    showReasonStep: false,
  });
  const [questionsExcusedToday, setQuestionsExcusedToday] = useState(0);
  const [motivationOpen, setMotivationOpen] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const dailyMotivation = useMemo(() => motivationalMessageForToday(), []);
  const [activeBlockId, setActiveBlockId] = useState(
    () =>
      initial.schedule.find((item) => item.status === "andamento")?.id || null,
  );
  const activeTimerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [cloudLoading, setCloudLoading] = useState(Boolean(supabase));
  const [cloudStatus, setCloudStatus] = useState(
    supabase
      ? "Conectando ao Supabase..."
      : "Supabase não configurado; usando cache local.",
  );
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [
    dismissedPreviousDayQuestionAlertId,
    setDismissedPreviousDayQuestionAlertId,
  ] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(PREVIOUS_DAY_QUESTION_ALERT_ACK_KEY) || "";
  });

  function applyLoadedState(nextState) {
    const normalized = normalizeLoadedState(nextState);
    setView(normalized.view || "dashboard");
    setCurrentStudyDayKey(normalized.currentStudyDayKey || TODAY_DAY_KEY);
    setCustomExams(normalizeCustomExamList(normalized.customExams));
    setDeletedBuiltInExamKeys(
      normalizeDeletedBuiltInExamKeys(normalized.deletedBuiltInExamKeys),
    );
    setActiveExamKeyState(normalized.activeExamKey || ACTIVE_EXAM_KEY);
    setStorageProfileKeyState(
      normalized.storageProfileKey ||
        storageKeyForExam(normalized.activeExamKey || ACTIVE_EXAM_KEY),
    );
    setCurrentStudyWeek(
      Number(normalized.currentStudyWeek || effectiveCycleWeek),
    );
    setSchedule(normalized.schedule);
    setWeeklySchedule(
      removeRetroactiveItemsFromCurrentWeek(
        normalized.weeklySchedule || [],
        normalized.settings?.studyStartDate || DEFAULT_STUDY_START_DATE,
      ),
    );
    setRoadmap(normalized.roadmap);
    setErrors(normalized.errors || []);
    setReviews(normalized.reviews || []);
    setNotes(normalized.notes || []);
    setQuestionSessions(normalized.questionSessions || []);
    setSimulatedTests(normalized.simulatedTests || []);
    setQuestionCarryovers(
      normalizeQuestionCarryovers(normalized.questionCarryovers),
    );
    setSettings({ ...defaultSettings(), ...(normalized.settings || {}) });
    setScheduleConfig({
      ...defaultScheduleConfig(),
      ...(normalized.scheduleConfig || {}),
    });
    setCycleDraftConfig({
      ...defaultScheduleConfig(),
      ...(normalized.scheduleConfig || {}),
    });
    setActiveBlockId(
      normalized.schedule.find((item) => item.status === "andamento")?.id ||
        null,
    );
  }

  function openConfirmDialog({
    title,
    message,
    confirmLabel = "Sim",
    cancelLabel = "Não",
    tone = "red",
    onConfirm,
  }) {
    setConfirmDialog({
      title,
      message,
      confirmLabel,
      cancelLabel,
      tone,
      onConfirm,
    });
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
  }

  async function confirmPendingAction() {
    const action = confirmDialog?.onConfirm;
    setConfirmDialog(null);
    if (typeof action === "function") await action();
  }

  function dismissPreviousDayQuestionGoalPopup() {
    const alertId = previousDayQuestionGoalReport?.iso || "";
    setDismissedPreviousDayQuestionAlertId(alertId);
    if (typeof window !== "undefined") {
      localStorage.setItem(PREVIOUS_DAY_QUESTION_ALERT_ACK_KEY, alertId);
    }
  }

  const appState = useMemo(() => {
    const activeExamDefinition =
      allAvailableExams(customExams, deletedBuiltInExamKeys).find(
        (exam) => exam.key === activeExamKeyState,
      ) || findExamDefinition(activeExamKeyState, customExams);
    return {
      roadmapVersion:
        activeExamDefinition?.roadmapVersion ||
        (activeExamKeyState === ACTIVE_EXAM_KEY
          ? ROADMAP_VERSION
          : `CUSTOM_${activeExamKeyState.toUpperCase()}`),
      profileKey: USER_PROFILE_KEY,
      activeExamKey: activeExamKeyState,
      storageProfileKey: storageProfileKeyState,
      customExams,
      view,
      currentStudyIsoDate: TODAY,
      currentStudyDayKey,
      currentStudyWeek,
      lastStudyDayKey: currentStudyDayKey,
      lastScheduleSnapshot: schedule,
      schedule,
      weeklySchedule: removeRetroactiveItemsFromCurrentWeek(
        weeklySchedule,
        settings?.studyStartDate || DEFAULT_STUDY_START_DATE,
      ),
      roadmap,
      errors,
      reviews,
      notes,
      questionSessions,
      simulatedTests,
      questionCarryovers,
      settings,
      scheduleConfig,
    };
  }, [
    view,
    currentStudyDayKey,
    currentStudyWeek,
    schedule,
    weeklySchedule,
    roadmap,
    errors,
    reviews,
    notes,
    questionSessions,
    simulatedTests,
    questionCarryovers,
    settings,
    scheduleConfig,
    customExams,
    activeExamKeyState,
    storageProfileKeyState,
  ]);

  useEffect(() => {
    let active = true;
    async function hydrateFromCloud() {
      if (!supabase) return;
      setCloudStatus("Carregando dados do Supabase...");
      const savedState = await loadStateFromSupabase();
      if (!active) return;
      if (savedState) {
        applyLoadedState(savedState);
        setCloudStatus("Dados carregados do Supabase.");
      } else {
        setCloudStatus(
          "Nenhum registro no Supabase; usando estado inicial/cache local.",
        );
      }
      setCloudLoading(false);
    }
    hydrateFromCloud();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cloudLoading) return undefined;

    const timeout = setTimeout(async () => {
      const portugues = appState.roadmap.find(
        (s) => s.id === "lingua_portuguesa",
      );

      console.log(
        "Português:",
        portugues?.topics.find((t) => t.title.includes("Reconhecimento")),
      );

      const result = await saveStateToSupabase(appState);

      console.log("Resultado:", result);

      setCloudStatus(
        result.ok
          ? `Salvo no Supabase às ${new Date().toLocaleTimeString("pt-BR")}`
          : result.source === "local"
            ? "Supabase não configurado; salvo somente no cache local."
            : "Falha ao salvar no Supabase; backup local atualizado.",
      );
    }, 1500);

    return () => clearTimeout(timeout);
  }, [appState, cloudLoading]);

  const subjectsList = useMemo(
    () =>
      roadmap.map((subject, index) => ({
        id: subject.id,
        name: subject.subject,
        weight: Number(subject.weight || 3),
        color: palette[index % palette.length],
      })),
    [roadmap],
  );
  const subjectMap = useMemo(
    () =>
      Object.fromEntries(subjectsList.map((subject) => [subject.id, subject])),
    [subjectsList],
  );

  const effectiveWeeklySchedule = useMemo(() => {
    return withDistributedQuestionTargets(
      normalizeScheduleItems(
        removeRetroactiveItemsFromCurrentWeek(
          weeklySchedule,
          settings.studyStartDate || DEFAULT_STUDY_START_DATE,
        ),
        scheduleConfig,
      ),
      scheduleConfig,
      roadmap,
      { questionCarryovers, studyStartDate: settings.studyStartDate },
    );
  }, [
    scheduleConfig.questionMinutes,
    weeklySchedule,
    roadmap,
    questionCarryovers,
    settings.studyStartDate,
  ]);

  const roadmapStats = useMemo(() => {
    const topics = roadmap.flatMap((subject) =>
      subject.topics.map((topic) => ({
        ...topic,
        subject: subject.subject,
        subjectId: subject.id,
        weight: subject.weight,
      })),
    );
    const done = topics.filter((topic) => topic.done).length;
    const highPending = topics.filter(
      (topic) => !topic.done && topic.priority === "Alta",
    ).length;
    const mediumPending = topics.filter(
      (topic) => !topic.done && topic.priority === "Média",
    ).length;
    const lowPending = topics.filter(
      (topic) => !topic.done && topic.priority === "Baixa",
    ).length;
    const hardestPending = topics.filter(
      (topic) => !topic.done && topic.difficulty === "Alta",
    ).length;
    const mediumDifficultyPending = topics.filter(
      (topic) => !topic.done && topic.difficulty === "Média",
    ).length;
    const lowDifficultyPending = topics.filter(
      (topic) => !topic.done && topic.difficulty === "Baixa",
    ).length;
    const priorityScore = { Alta: 3, Média: 2, Baixa: 1 };
    const nextTopic =
      [...topics]
        .filter((topic) => !topic.done)
        .sort(
          (a, b) =>
            (priorityScore[b.priority] || 0) -
              (priorityScore[a.priority] || 0) ||
            Number(b.weight || 0) - Number(a.weight || 0),
        )[0] || null;
    return {
      total: topics.length,
      done,
      percent: topics.length ? Math.round((done / topics.length) * 100) : 0,
      highPending,
      mediumPending,
      lowPending,
      hardestPending,
      mediumDifficultyPending,
      lowDifficultyPending,
      nextTopic,
    };
  }, [roadmap]);

  const selectedRoadmapStats = useMemo(() => {
    const selectedSubjects =
      roadmapSubject === "all"
        ? roadmap
        : roadmap.filter((subject) => subject.id === roadmapSubject);
    const topics = selectedSubjects.flatMap((subject) =>
      subject.topics.map((topic) => ({
        ...topic,
        subject: subject.subject,
        subjectId: subject.id,
        weight: subject.weight,
      })),
    );
    const done = topics.filter((topic) => topic.done).length;
    const highPending = topics.filter(
      (topic) => !topic.done && topic.priority === "Alta",
    ).length;
    const mediumPending = topics.filter(
      (topic) => !topic.done && topic.priority === "Média",
    ).length;
    const lowPending = topics.filter(
      (topic) => !topic.done && topic.priority === "Baixa",
    ).length;
    const hardestPending = topics.filter(
      (topic) => !topic.done && topic.difficulty === "Alta",
    ).length;
    const mediumDifficultyPending = topics.filter(
      (topic) => !topic.done && topic.difficulty === "Média",
    ).length;
    const lowDifficultyPending = topics.filter(
      (topic) => !topic.done && topic.difficulty === "Baixa",
    ).length;
    return {
      total: topics.length,
      done,
      percent: topics.length ? Math.round((done / topics.length) * 100) : 0,
      highPending,
      mediumPending,
      lowPending,
      hardestPending,
      mediumDifficultyPending,
      lowDifficultyPending,
      label:
        roadmapSubject === "all"
          ? "todas as matérias"
          : selectedSubjects[0]?.subject || "matéria",
    };
  }, [roadmap, roadmapSubject]);

  const stats = useMemo(() => {
    const questionsDone = questionSessions.reduce(
      (sum, session) => sum + Number(session.done || 0),
      0,
    );
    const questionsCorrect = questionSessions.reduce(
      (sum, session) => sum + Number(session.correct || 0),
      0,
    );
    const questionsWrong = Math.max(0, questionsDone - questionsCorrect);
    const accuracy = questionsDone
      ? Math.round((questionsCorrect / questionsDone) * 100)
      : 0;
    const pendingErrors = errors.filter(
      (item) => item.status !== "resolvido",
    ).length;
    const completedToday = schedule.filter(
      (item) => item.status === "concluido",
    ).length;
    const studiedSeconds = uniqueStudyBlocksForTotals(
      weeklySchedule,
      effectiveWeeklySchedule,
      schedule,
    ).reduce(
      (sum, item) =>
        sum +
        Math.max(
          Number(item.elapsedSeconds || 0),
          Number(item.baseElapsedSeconds || 0),
        ),
      0,
    );
    return {
      progress: roadmapStats.percent,
      accuracy,
      pendingErrors,
      completedToday,
      questionsDone,
      questionsCorrect,
      questionsWrong,
      studiedSeconds,
      studyStreak: countStudyStreak({
        weeklySchedule,
        effectiveWeeklySchedule,
        schedule,
        questionSessions,
        studyStartDate: settings.studyStartDate,
      }),
    };
  }, [
    effectiveWeeklySchedule,
    errors,
    questionSessions,
    roadmapStats.percent,
    schedule,
    settings.studyStartDate,
    weeklySchedule,
  ]);

  const subjectPerformance = useMemo(
    () =>
      subjectsList.map((subject) => {
        const subjectData = getSubject(roadmap, subject.id);
        const topics = subjectData?.topics || [];
        const topicProgress = topics.length
          ? Math.round(
              (topics.filter((topic) => topic.done).length / topics.length) *
                100,
            )
          : 0;
        const sessions = questionSessions.filter(
          (session) => session.subjectId === subject.id,
        );
        const totalQuestions = sessions.reduce(
          (sum, session) => sum + Number(session.done || 0),
          0,
        );
        const totalCorrect = sessions.reduce(
          (sum, session) => sum + Number(session.correct || 0),
          0,
        );
        const accuracy = totalQuestions
          ? Math.round((totalCorrect / totalQuestions) * 100)
          : 0;
        const pendingErrors = errors.filter(
          (error) =>
            error.subjectId === subject.id && error.status !== "resolvido",
        ).length;
        return {
          ...subject,
          progress: topicProgress,
          accuracy,
          pendingErrors,
          totalQuestions,
        };
      }),
    [errors, questionSessions, roadmap, subjectsList],
  );

  useEffect(() => {
    if (!motivationOpen) return undefined;
    const timeout = setTimeout(() => setMotivationOpen(false), 4500);
    return () => clearTimeout(timeout);
  }, [motivationOpen]);

  useEffect(() => {
    if (!celebration) return undefined;
    const timeout = setTimeout(() => setCelebration(null), 4200);
    return () => clearTimeout(timeout);
  }, [celebration]);

  useEffect(() => {
    setSchedule((current) =>
      withDistributedQuestionTargets(
        normalizeScheduleItems(current, scheduleConfig),
        scheduleConfig,
        roadmap,
        { questionCarryovers, studyStartDate: settings.studyStartDate },
      ),
    );
    setWeeklySchedule((current) =>
      removeRetroactiveItemsFromCurrentWeek(
        withDistributedQuestionTargets(
          normalizeScheduleItems(current, scheduleConfig),
          scheduleConfig,
          roadmap,
          { questionCarryovers, studyStartDate: settings.studyStartDate },
        ),
        settings.studyStartDate || DEFAULT_STUDY_START_DATE,
      ),
    );
  }, [
    scheduleConfig.questionMinutes,
    roadmap,
    questionCarryovers,
    settings.studyStartDate,
  ]);

  useEffect(() => {
    activeTimerRef.current = activeBlockId;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (!activeBlockId) return undefined;
    timerIntervalRef.current = setInterval(() => {
      setSchedule((current) =>
        current.map((item) =>
          item.id === activeBlockId && item.status === "andamento"
            ? { ...item, elapsedSeconds: liveElapsedSeconds(item) }
            : item,
        ),
      );
    }, 1000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeBlockId]);

  useEffect(() => {
    const initialIsoDate = TODAY;
    const interval = setInterval(() => {
      const now = new Date();
      const currentIsoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (currentIsoDate !== initialIsoDate) {
        window.location.reload();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentDaySchedule = scheduleFromWeekly(
      effectiveWeeklySchedule,
      roadmap,
      currentStudyWeek,
      currentStudyDayKey,
    ).sort(
      (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
    );
    setSchedule((current) => {
      const currentToday = current.filter(
        (item) =>
          item.dayKey === currentStudyDayKey &&
          Number(item.week) === Number(currentStudyWeek),
      );
      const existingCarryovers = currentToday.filter((item) => item.carryover);
      const expectedSchedule = mergeUniqueScheduleItems(
        currentDaySchedule,
        existingCarryovers,
      ).sort(
        (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
      );
      if (!expectedSchedule.length) return current;
      const merged = expectedSchedule.map((expected) => {
        const saved = currentToday.find(
          (item) =>
            item.id === expected.id ||
            (item.week === expected.week &&
              item.dayKey === expected.dayKey &&
              item.subjectId === expected.subjectId &&
              item.topicId === expected.topicId &&
              Boolean(item.carryover) === Boolean(expected.carryover)),
        );
        return saved
          ? {
              ...expected,
              status: saved.status,
              elapsedSeconds: liveElapsedSeconds(saved),
              completedAt: saved.completedAt || null,
              timerStartedAt: saved.timerStartedAt || null,
              baseElapsedSeconds:
                saved.baseElapsedSeconds || saved.elapsedSeconds || 0,
            }
          : expected;
      });
      const currentIds = currentToday
        .map((item) => `${item.id}:${item.status}:${item.elapsedSeconds || 0}`)
        .join("|");
      const mergedIds = merged
        .map((item) => `${item.id}:${item.status}:${item.elapsedSeconds || 0}`)
        .join("|");
      return currentIds === mergedIds ? current : merged;
    });
  }, [effectiveWeeklySchedule, roadmap, currentStudyDayKey, currentStudyWeek]);

  const selectedErrorSubjectTopics =
    getSubject(roadmap, errorForm.subjectId)?.topics || [];
  const selectedQuestionSubjectTopics =
    getSubject(roadmap, questionForm.subjectId)?.topics || [];
  const questionFilterTopics = (() => {
    if (questionFilterSubject === "all") return [];
    const allTopics = getSubject(roadmap, questionFilterSubject)?.topics || [];
    const topicIdsWithSessions = new Set(
      questionSessions
        .filter((s) => s.subjectId === questionFilterSubject)
        .flatMap((s) =>
          Array.isArray(s.topicIds) && s.topicIds.length
            ? s.topicIds
            : s.topicId
              ? [s.topicId]
              : [],
        ),
    );
    return allTopics.filter((t) => topicIdsWithSessions.has(t.id));
  })();
  const selectedNoteSubjectTopics =
    getSubject(roadmap, noteForm.subjectId)?.topics || [];
  const noteFilterTopics =
    noteSubjectFilter === "all"
      ? []
      : getSubject(roadmap, noteSubjectFilter)?.topics || [];
  const filteredErrors = errors
    .filter((item) =>
      [item.subject, item.topic, item.error, item.fix]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .filter(
      (item) =>
        errorSubjectFilter === "all" || item.subjectId === errorSubjectFilter,
    )
    .filter(
      (item) =>
        errorStatusFilter === "todos" ||
        (errorStatusFilter === "pendentes"
          ? item.status !== "resolvido"
          : item.status === "resolvido"),
    );
  const filteredQuestionSessions = questionSessions
    .filter(
      (session) =>
        questionFilterSubject === "all" ||
        session.subjectId === questionFilterSubject,
    )
    .filter(
      (session) =>
        questionFilterTopic === "all" ||
        session.topicId === questionFilterTopic ||
        (Array.isArray(session.topicIds) &&
          session.topicIds.includes(questionFilterTopic)),
    );
  const filteredNotes = notes
    .filter(
      (note) =>
        noteSubjectFilter === "all" || note.subjectId === noteSubjectFilter,
    )
    .filter(
      (note) => noteTopicFilter === "all" || note.topicId === noteTopicFilter,
    )
    .filter((note) =>
      [note.subject, note.topic, note.title, note.text]
        .join(" ")
        .toLowerCase()
        .includes(noteSearch.toLowerCase()),
    );

  const questionSummary = useMemo(() => {
    const done = filteredQuestionSessions.reduce(
      (sum, session) => sum + Number(session.done || 0),
      0,
    );
    const correct = filteredQuestionSessions.reduce(
      (sum, session) => sum + Number(session.correct || 0),
      0,
    );
    const wrong = Math.max(0, done - correct);
    if (questionFilterSubject === "all") {
      const subjectSummaries = subjectsList
        .map((subject) => {
          const sessions = questionSessions.filter(
            (session) => session.subjectId === subject.id,
          );
          const subjectDone = sessions.reduce(
            (sum, session) => sum + Number(session.done || 0),
            0,
          );
          const subjectCorrect = sessions.reduce(
            (sum, session) => sum + Number(session.correct || 0),
            0,
          );
          const subjectAccuracy = subjectDone
            ? Math.round((subjectCorrect / subjectDone) * 100)
            : null;
          return {
            ...subject,
            done: subjectDone,
            correct: subjectCorrect,
            accuracy: subjectAccuracy,
          };
        })
        .filter((subject) => subject.done > 0);
      const accuracy = subjectSummaries.length
        ? Math.round(
            subjectSummaries.reduce(
              (sum, subject) => sum + subject.accuracy,
              0,
            ) / subjectSummaries.length,
          )
        : 0;
      const weightedAccuracy = done ? Math.round((correct / done) * 100) : 0;
      const weakest = subjectSummaries.length
        ? [...subjectSummaries].sort((a, b) => a.accuracy - b.accuracy)[0]
        : null;
      const message =
        subjectSummaries.length === 0
          ? "Ainda não há questões registradas."
          : weakest && weakest.accuracy < 60
            ? `A média equilibrada entre matérias está em ${accuracy}%. Atenção: ${weakest.name} está em ${weakest.accuracy}%, abaixo do esperado. Priorize essa matéria antes de confiar no aproveitamento geral.`
            : weakest && weakest.accuracy < 75
              ? `A média equilibrada entre matérias está em ${accuracy}%. O geral ponderado por questões está em ${weightedAccuracy}%, mas ${weakest.name} está em ${weakest.accuracy}% e merece reforço.`
              : `A média equilibrada entre matérias está em ${accuracy}%. Seu geral ponderado por questões está em ${weightedAccuracy}%. Continue revisando para manter o desempenho.`;
      return {
        done,
        correct,
        wrong,
        accuracy,
        weightedAccuracy,
        label: "todas as matérias",
        message,
        weakest,
      };
    }
    const accuracy = done ? Math.round((correct / done) * 100) : 0;
    const subjectLabel =
      subjectMap[questionFilterSubject]?.name || "matéria selecionada";
    const topicLabel =
      questionFilterTopic === "all"
        ? ""
        : ` > ${getTopic(roadmap, questionFilterSubject, questionFilterTopic)?.title || "assunto selecionado"}`;
    const label = `${subjectLabel}${topicLabel}`;
    const message =
      done === 0
        ? `Ainda não há questões registradas para ${label}.`
        : accuracy >= 80
          ? `Seu aproveitamento em ${label} está em ${accuracy}%. Excelente, mantenha a revisão para não cair.`
          : accuracy >= 60
            ? `Seu aproveitamento em ${label} está em ${accuracy}%. Está razoável, mas ainda dá para melhorar com revisão dos erros.`
            : `Seu aproveitamento em ${label} está em ${accuracy}%. Está abaixo do esperado, você precisa revisar os erros e refazer questões desse conteúdo.`;
    return {
      done,
      correct,
      wrong,
      accuracy,
      weightedAccuracy: accuracy,
      label,
      message,
      weakest: null,
    };
  }, [
    filteredQuestionSessions,
    questionFilterSubject,
    questionFilterTopic,
    questionSessions,
    roadmap,
    subjectMap,
    subjectsList,
  ]);

  const orderedSimulatedTests = useMemo(
    () => sortSimulatedTests(simulatedTests),
    [simulatedTests],
  );
  const simulatedSummary = useMemo(() => {
    const totalTests = simulatedTests.length;
    const totalQuestions = simulatedTests.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0,
    );
    const totalCorrect = simulatedTests.reduce(
      (sum, item) => sum + Number(item.correct || 0),
      0,
    );
    const totalWrong = Math.max(0, totalQuestions - totalCorrect);
    const accuracy = totalQuestions
      ? Math.round((totalCorrect / totalQuestions) * 100)
      : 0;
    const essayScores = simulatedTests
      .map((item) => Number(item.essayScore || 0))
      .filter((value) => value > 0);
    const averageEssay = essayScores.length
      ? Math.round(
          essayScores.reduce((sum, value) => sum + value, 0) /
            essayScores.length,
        )
      : 0;
    return {
      totalTests,
      totalQuestions,
      totalCorrect,
      totalWrong,
      accuracy,
      averageEssay,
    };
  }, [simulatedTests]);
  const simulatedSubjectSummary = useMemo(
    () =>
      subjectsList
        .map((subject) => {
          const totals = simulatedTests.reduce(
            (acc, test) => {
              const entry = test.subjects?.[subject.id] || {};
              return {
                total: acc.total + Number(entry.total || 0),
                correct: acc.correct + Number(entry.correct || 0),
              };
            },
            { total: 0, correct: 0 },
          );
          const wrong = Math.max(0, totals.total - totals.correct);
          const accuracy = totals.total
            ? Math.round((totals.correct / totals.total) * 100)
            : 0;
          return {
            ...subject,
            total: totals.total,
            correct: totals.correct,
            wrong,
            accuracy,
          };
        })
        .filter((subject) => subject.total > 0 || subject.correct > 0),
    [simulatedTests, subjectsList],
  );
  const compareSimulatedA =
    simulatedTests.find((item) => item.id === simulatedCompareA) || null;
  const compareSimulatedB =
    simulatedTests.find((item) => item.id === simulatedCompareB) || null;
  const singleSimulatedDetail =
    compareSimulatedA && !compareSimulatedB ? compareSimulatedA : null;
  const simulatedComparison = useMemo(() => {
    if (!compareSimulatedA || !compareSimulatedB) return null;
    const subjectRows = subjectsList
      .map((subject) => {
        const a = compareSimulatedA.subjects?.[subject.id] || {};
        const b = compareSimulatedB.subjects?.[subject.id] || {};
        const aTotal = Number(a.total || 0);
        const bTotal = Number(b.total || 0);
        const aCorrect = Number(a.correct || 0);
        const bCorrect = Number(b.correct || 0);
        const aAccuracy = aTotal ? Math.round((aCorrect / aTotal) * 100) : 0;
        const bAccuracy = bTotal ? Math.round((bCorrect / bTotal) * 100) : 0;
        return {
          id: subject.id,
          name: subject.name,
          aTotal,
          bTotal,
          aCorrect,
          bCorrect,
          aWrong: Math.max(0, aTotal - aCorrect),
          bWrong: Math.max(0, bTotal - bCorrect),
          aAccuracy,
          bAccuracy,
          deltaCorrect: bCorrect - aCorrect,
          deltaAccuracy: bAccuracy - aAccuracy,
        };
      })
      .filter(
        (row) =>
          row.aTotal > 0 ||
          row.bTotal > 0 ||
          row.aCorrect > 0 ||
          row.bCorrect > 0,
      );
    const bestEvolution = subjectRows.length
      ? [...subjectRows].sort(
          (a, b) =>
            b.deltaAccuracy - a.deltaAccuracy ||
            b.deltaCorrect - a.deltaCorrect,
        )[0]
      : null;
    const worstEvolution = subjectRows.length
      ? [...subjectRows].sort(
          (a, b) =>
            a.deltaAccuracy - b.deltaAccuracy ||
            a.deltaCorrect - b.deltaCorrect,
        )[0]
      : null;
    return {
      deltaCorrect: compareSimulatedB.correct - compareSimulatedA.correct,
      deltaWrong: compareSimulatedB.wrong - compareSimulatedA.wrong,
      deltaAccuracy: compareSimulatedB.accuracy - compareSimulatedA.accuracy,
      deltaEssay: compareSimulatedB.essayScore - compareSimulatedA.essayScore,
      deltaTime:
        compareSimulatedB.timeSpentMinutes - compareSimulatedA.timeSpentMinutes,
      betterAccuracy:
        compareSimulatedA.accuracy === compareSimulatedB.accuracy
          ? "Empate"
          : compareSimulatedB.accuracy > compareSimulatedA.accuracy
            ? compareSimulatedB.title
            : compareSimulatedA.title,
      betterEssay:
        compareSimulatedA.essayScore === compareSimulatedB.essayScore
          ? "Empate"
          : compareSimulatedB.essayScore > compareSimulatedA.essayScore
            ? compareSimulatedB.title
            : compareSimulatedA.title,
      subjectRows,
      bestEvolution,
      worstEvolution,
    };
  }, [compareSimulatedA, compareSimulatedB, subjectsList]);

  const sortedReviews = useMemo(
    () =>
      [...reviews].sort((a, b) => {
        const order = {
          vencida: 0,
          atual: 1,
          andamento: 2,
          próxima: 3,
          concluida: 4,
        };
        return (
          (order[reviewStatus(a)] ?? 9) - (order[reviewStatus(b)] ?? 9) ||
          (parseBRDate(a.date)?.getTime() || 0) -
            (parseBRDate(b.date)?.getTime() || 0)
        );
      }),
    [reviews],
  );
  const filteredReviews = useMemo(
    () =>
      sortedReviews.filter((review) => {
        const status = reviewStatus(review);
        if (reviewFilter === "atual")
          return status === "atual" || status === "andamento";
        if (reviewFilter === "vencidas") return status === "vencida";
        if (reviewFilter === "concluidas") return status === "concluida";
        return status !== "concluida" && review.type === reviewFilter;
      }),
    [reviewFilter, sortedReviews],
  );
  const overdueReviews = useMemo(
    () => sortedReviews.filter((review) => reviewStatus(review) === "vencida"),
    [sortedReviews],
  );
  const todayReviews = useMemo(
    () =>
      sortedReviews.filter((review) =>
        ["atual", "andamento"].includes(reviewStatus(review)),
      ),
    [sortedReviews],
  );
  const completedTodayReviews = useMemo(
    () =>
      sortedReviews.filter(
        (review) =>
          review.status === "concluida" &&
          review.date === toBRDate(parseISODate(TODAY)),
      ),
    [sortedReviews],
  );
  const nextPendingReview = useMemo(
    () =>
      sortedReviews
        .filter((review) => reviewStatus(review) === "próxima")
        .sort(
          (a, b) =>
            (parseBRDate(a.date)?.getTime() || 0) -
            (parseBRDate(b.date)?.getTime() || 0),
        )[0] || null,
    [sortedReviews],
  );
  const weekDaysForSelectedWeek = useMemo(
    () =>
      effectiveWeeklySchedule.filter(
        (item) => Number(item.week) === Number(weeklyWeekFilter),
      ),
    [effectiveWeeklySchedule, weeklyWeekFilter],
  );
  const weeklyPlan = useMemo(() => {
    const plan = WEEK_DAYS.map(([key, label]) => ({ key, label, items: [] }));
    const addItem = (dayKey, item) => {
      const day = plan.find((entry) => entry.key === dayKey);
      if (day) day.items.push(item);
    };
    weekDaysForSelectedWeek.forEach((item) =>
      addItem(item.dayKey, { ...item, origin: `Ciclo ${item.week}` }),
    );
    if (!plan.find((entry) => entry.key === "domingo")?.items.length)
      addItem("domingo", {
        id: `sunday-review-${weeklyWeekFilter}`,
        week: weeklyWeekFilter,
        dayKey: "domingo",
        subject: "Revisões e manutenção",
        topic: "Revisões vencidas, caderno de erros e anotações",
        type: "Revisão",
        minutes: 60,
        status: overdueReviews.length > 0 ? "pendente" : "livre",
        origin: "Domingo sem ciclo novo",
      });
    return plan;
  }, [overdueReviews.length, weekDaysForSelectedWeek, weeklyWeekFilter]);
  const selectedWeeklyDayRaw =
    weeklyPlan.find((day) => day.key === weeklyDayFilter) || weeklyPlan[0];
  const selectedWeeklyDay = useMemo(
    () => ({
      ...selectedWeeklyDayRaw,
      items: [...(selectedWeeklyDayRaw?.items || [])].sort(
        (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
      ),
    }),
    [selectedWeeklyDayRaw],
  );
  const overdueStudyItems = useMemo(
    () =>
      effectiveWeeklySchedule.filter(
        (item) => item.carryover && item.status !== "concluido",
      ),
    [effectiveWeeklySchedule],
  );
  const dashboardStudyItems = useMemo(
    () =>
      schedule
        .filter((item) => item.status !== "concluido")
        .sort(
          (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
        ),
    [schedule],
  );
  const scheduleWeekItems = useMemo(
    () =>
      effectiveWeeklySchedule.filter(
        (item) =>
          scheduleWeekFilter === "all" ||
          Number(item.week) === Number(scheduleWeekFilter),
      ),
    [effectiveWeeklySchedule, scheduleWeekFilter],
  );
  const scheduleSubjectFrequency = useMemo(() => {
    const studyItems = scheduleWeekItems.filter(
      (item) =>
        !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
          item.subjectId,
        ),
    );
    return subjectsList.map((subject) => {
      const items = studyItems.filter((item) => item.subjectId === subject.id);
      const subjectData = getSubject(roadmap, subject.id);
      const cycle = subjectCycleCoverage(subjectData, items);
      return { ...subject, count: items.length, items, cycle };
    });
  }, [scheduleWeekItems, subjectsList, roadmap]);
  const selectedScheduleSubjectFrequency = useMemo(
    () =>
      scheduleSubjectFrequencyFilter === "all"
        ? null
        : scheduleSubjectFrequency.find(
            (subject) => subject.id === scheduleSubjectFrequencyFilter,
          ) || null,
    [scheduleSubjectFrequency, scheduleSubjectFrequencyFilter],
  );
  const filteredRoadmap = roadmap
    .filter((item) => roadmapSubject === "all" || item.id === roadmapSubject)
    .map((item) => ({
      ...item,
      topics: item.topics.filter(
        (topic) =>
          (roadmapStatus === "todos" ||
            (roadmapStatus === "concluidos" ? topic.done : !topic.done)) &&
          (roadmapPriority === "todas" || topic.priority === roadmapPriority),
      ),
    }));
  const weeklyGoalReport = useMemo(() => {
    const plannedQuestions = Math.max(0, Number(settings.weeklyQuestions) || 0);
    const now = new Date();
    const start = new Date(now);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const sessionsThisWeek = questionSessions.filter((session) => {
      const isoDate = questionSessionISODate(session);
      if (!isoDate) return false;
      const date = parseISODate(isoDate);
      return (
        date && !Number.isNaN(date.getTime()) && date >= start && date < end
      );
    });
    const doneQuestions = sessionsThisWeek.reduce(
      (sum, session) => sum + Number(session.done || 0),
      0,
    );
    const correctQuestions = sessionsThisWeek.reduce(
      (sum, session) => sum + Number(session.correct || 0),
      0,
    );
    const wrongQuestions = Math.max(0, doneQuestions - correctQuestions);
    const missingQuestions = Math.max(0, plannedQuestions - doneQuestions);
    const extraQuestions = Math.max(0, doneQuestions - plannedQuestions);
    const percent = plannedQuestions
      ? Math.min(999, Math.round((doneQuestions / plannedQuestions) * 100))
      : 0;
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
    const dailyNeeded =
      missingQuestions && daysLeft ? Math.ceil(missingQuestions / daysLeft) : 0;
    const accuracy = doneQuestions
      ? Math.round((correctQuestions / doneQuestions) * 100)
      : 0;
    const message =
      plannedQuestions === 0
        ? "Defina uma meta de questões do ciclo nas Configurações."
        : missingQuestions === 0
          ? `Meta do ciclo batida. Você fez ${doneQuestions} questão(ões), ${extraQuestions > 0 ? `${extraQuestions} acima da meta.` : "exatamente dentro da meta."}`
          : `Faltam ${missingQuestions} questão(ões) para bater a meta. Ritmo sugerido: ${dailyNeeded} por dia até fechar o ciclo.`;
    return {
      plannedQuestions,
      doneQuestions,
      correctQuestions,
      wrongQuestions,
      missingQuestions,
      extraQuestions,
      percent,
      daysLeft,
      dailyNeeded,
      accuracy,
      message,
    };
  }, [questionSessions, settings.weeklyQuestions]);

  const dailyQuestionGoalReport = useMemo(() => {
    const baseQuestions = dailyQuestionTarget(scheduleConfig);
    const carriedQuestions = questionCarryoverForDate(
      questionCarryovers,
      TODAY,
    );
    const plannedQuestions = baseQuestions + carriedQuestions;
    const {
      sessions: sessionsToday,
      doneQuestions,
      correctQuestions,
    } = sumQuestionSessionsForDate(questionSessions, TODAY);
    const missingQuestions = Math.max(0, plannedQuestions - doneQuestions);
    const percent = plannedQuestions
      ? Math.min(999, Math.round((doneQuestions / plannedQuestions) * 100))
      : 0;
    return {
      baseQuestions,
      carriedQuestions,
      plannedQuestions,
      doneQuestions,
      correctQuestions,
      wrongQuestions: Math.max(0, doneQuestions - correctQuestions),
      missingQuestions,
      percent,
    };
  }, [questionSessions, scheduleConfig, questionCarryovers]);

  const examCountdown = useMemo(() => {
    const daysLeft = daysUntilExamDate(settings.examDate);
    let phase = "Configure a data da prova";
    let tone = "stone";
    if (daysLeft !== null) {
      phase =
        daysLeft <= 0
          ? "É hoje"
          : daysLeft <= 15
            ? "Reta final"
            : daysLeft <= 45
              ? "Consolidação"
              : "Construção de base";
      tone = daysLeft <= 15 ? "red" : daysLeft <= 45 ? "amber" : "green";
    }
    return {
      daysLeft,
      phase,
      tone,
      dateLabel: isoToBR(settings.examDate),
    };
  }, [settings.examDate]);

  const previousDayQuestionGoalReport = useMemo(() => {
    const yesterday = parseISODate(TODAY);
    yesterday.setDate(yesterday.getDate() - 1);
    const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const label = toBRDate(yesterday);
    const plannedQuestions = dailyQuestionTarget(scheduleConfig);
    const { sessions: sessionsYesterday, doneQuestions } =
      sumQuestionSessionsForDate(questionSessions, iso);
    const missingQuestions = Math.max(0, plannedQuestions - doneQuestions);
    return {
      iso,
      label,
      plannedQuestions,
      doneQuestions,
      missingQuestions,
      missed:
        plannedQuestions > 0 &&
        missingQuestions > 0 &&
        sessionsYesterday.length > 0,
    };
  }, [questionSessions, scheduleConfig]);

  const shouldShowPreviousDayQuestionGoalPopup =
    view === "dashboard" &&
    previousDayQuestionGoalReport.missed &&
    dismissedPreviousDayQuestionAlertId !== previousDayQuestionGoalReport.iso;

  const topicQuestionPerformance = useMemo(() => {
    return subjectsList
      .map((subject) => {
        const topics = getSubject(roadmap, subject.id)?.topics || [];
        return topics.map((topic) => {
          const sessions = questionSessions.filter(
            (session) =>
              session.subjectId === subject.id &&
              (session.topicId === topic.id ||
                (Array.isArray(session.topicIds) &&
                  session.topicIds.includes(topic.id))),
          );
          const done = sessions.reduce(
            (sum, session) => sum + Number(session.done || 0),
            0,
          );
          const correct = sessions.reduce(
            (sum, session) => sum + Number(session.correct || 0),
            0,
          );
          const wrong = Math.max(0, done - correct);
          const accuracy = done ? Math.round((correct / done) * 100) : null;
          return {
            subjectId: subject.id,
            subject: subject.name,
            topicId: topic.id,
            topic: topic.title,
            done,
            correct,
            wrong,
            accuracy,
          };
        });
      })
      .flat()
      .filter((item) => item.done > 0)
      .sort(
        (a, b) =>
          (a.accuracy ?? 999) - (b.accuracy ?? 999) || b.wrong - a.wrong,
      );
  }, [questionSessions, roadmap, subjectsList]);

  const topicIntelligence = useMemo(() => {
    return subjectsList
      .map((subject) => {
        const subjectData = getSubject(roadmap, subject.id);
        const topics = subjectData?.topics || [];
        return topics.map((topic) => {
          const sessions = questionSessions.filter(
            (session) =>
              session.subjectId === subject.id &&
              (session.topicId === topic.id ||
                (Array.isArray(session.topicIds) &&
                  session.topicIds.includes(topic.id))),
          );
          const done = sessions.reduce(
            (sum, session) => sum + Number(session.done || 0),
            0,
          );
          const correct = sessions.reduce(
            (sum, session) => sum + Number(session.correct || 0),
            0,
          );
          const wrong = Math.max(0, done - correct);
          const topicErrors = errors.filter(
            (error) =>
              error.subjectId === subject.id && error.topicId === topic.id,
          );
          const pendingErrors = topicErrors.filter(
            (error) => error.status !== "resolvido",
          ).length;
          const topicReviews = reviews.filter(
            (review) =>
              review.subjectId === subject.id &&
              (review.topicId === topic.id ||
                review.title?.includes(topic.title)),
          );
          const pendingReviews = topicReviews.filter(
            (review) => reviewStatus(review) !== "concluida",
          ).length;
          const topicNotes = notes.filter(
            (note) =>
              note.subjectId === subject.id && note.topicId === topic.id,
          ).length;
          const accuracy = done ? Math.round((correct / done) * 100) : null;
          const score =
            pendingErrors * 12 +
            pendingReviews * 5 +
            wrong * 3 +
            (done === 0 ? 6 : 0) +
            (accuracy !== null ? Math.max(0, 80 - accuracy) : 10);
          return {
            subjectId: subject.id,
            subject: subject.name,
            topicId: topic.id,
            topic: topic.title,
            done,
            correct,
            wrong,
            accuracy,
            pendingErrors,
            pendingReviews,
            notes: topicNotes,
            completed: Boolean(topic.done),
            score,
          };
        });
      })
      .flat()
      .sort((a, b) => b.score - a.score || b.pendingErrors - a.pendingErrors);
  }, [errors, notes, questionSessions, reviews, roadmap, subjectsList]);

  const riskData = useMemo(() => {
    return subjectPerformance
      .map((subject) => {
        const subjectData = getSubject(roadmap, subject.id);
        const totalTopics = subjectData?.topics.length || 0;
        const pendingTopics =
          subjectData?.topics.filter((topic) => !topic.done).length || 0;
        const completedTopics = Math.max(0, totalTopics - pendingTopics);
        const pendingRate = totalTopics ? pendingTopics / totalTopics : 1;
        const accuracyRisk =
          subject.totalQuestions === 0
            ? 18
            : Math.max(0, 80 - subject.accuracy) / 2;
        const errorRisk = Math.min(18, subject.pendingErrors * 4);
        const progressRisk = Math.round(pendingRate * 20);
        const weightRisk = Number(subject.weight || 1) * 6;
        const score = Math.round(
          weightRisk + accuracyRisk + errorRisk + progressRisk,
        );
        const level =
          score >= 70
            ? "Crítico"
            : score >= 55
              ? "Alto"
              : score >= 38
                ? "Médio"
                : "Baixo";
        const tone =
          score >= 70
            ? "red"
            : score >= 55
              ? "red"
              : score >= 38
                ? "amber"
                : "green";
        const explanation =
          subject.totalQuestions === 0
            ? "Sem questões registradas; o sistema mantém alerta até existir desempenho real."
            : subject.accuracy < 60
              ? "Aproveitamento abaixo do esperado em questões."
              : subject.accuracy < 75
                ? "Aproveitamento razoável, mas ainda precisa reforço."
                : "Aproveitamento bom; mantenha revisão para não cair.";
        return {
          ...subject,
          score,
          level,
          tone,
          pendingTopics,
          completedTopics,
          totalTopics,
          accuracyRisk: Math.round(accuracyRisk),
          errorRisk,
          progressRisk,
          weightRisk,
          explanation,
        };
      })
      .sort((a, b) => b.score - a.score || b.weight - a.weight);
  }, [roadmap, subjectPerformance]);

  const tomorrowRecommendation = useMemo(() => {
    const pendingCarryovers = schedule.filter(
      (item) =>
        item.status !== "concluido" &&
        !["simulado", "caderno_erros", "planejamento"].includes(item.subjectId),
    );
    if (pendingCarryovers.length > 0) {
      return pendingCarryovers
        .slice(0, Number(scheduleConfig.subjectsPerDay || 2))
        .map((item) => ({
          subject: item.subject,
          topic: item.topic,
          reason:
            "Bloco atual ainda pendente. Resolva antes de avançar para assunto novo.",
          tone: "red",
        }));
    }
    const weakTopics = topicIntelligence
      .filter(
        (item) =>
          !item.completed ||
          item.pendingErrors > 0 ||
          (item.accuracy !== null && item.accuracy < 70),
      )
      .slice(0, Number(scheduleConfig.subjectsPerDay || 2));
    if (weakTopics.length > 0) {
      return weakTopics.map((item) => ({
        subject: item.subject,
        topic: item.topic,
        reason:
          item.pendingErrors > 0
            ? `${item.pendingErrors} erro(s) pendente(s) nesse assunto.`
            : item.accuracy !== null && item.accuracy < 70
              ? `Aproveitamento em questões: ${item.accuracy}%.`
              : "Assunto ainda pendente no edital.",
        tone:
          item.pendingErrors > 0 ||
          (item.accuracy !== null && item.accuracy < 70)
            ? "amber"
            : "stone",
      }));
    }
    return riskData
      .slice(0, Number(scheduleConfig.subjectsPerDay || 2))
      .map((subject) => ({
        subject: subject.name,
        topic: "Revisar pontos fracos e resolver questões.",
        reason: subject.explanation,
        tone: subject.tone,
      }));
  }, [riskData, schedule, scheduleConfig.subjectsPerDay, topicIntelligence]);

  const finalStretchPlan = useMemo(() => {
    const daysLeft = examCountdown.daysLeft ?? 0;
    const phase =
      daysLeft <= 20
        ? "Reta final"
        : daysLeft <= 55
          ? "Consolidação por questões"
          : "Construção de base";
    const dailyFocus =
      daysLeft <= 20
        ? "80% questões e revisão de erros; 20% teoria pontual."
        : daysLeft <= 55
          ? "60% questões; 40% teoria dos assuntos fracos."
          : "70% teoria orientada pelo edital; 30% questões.";
    return { daysLeft, phase, dailyFocus };
  }, [examCountdown.daysLeft]);

  const completedStudyHistory = useMemo(() => {
    const source = mergeUniqueScheduleItems(weeklySchedule, schedule);
    return source
      .filter(
        (item) =>
          item.status === "concluido" &&
          !item.carryover &&
          !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
            item.subjectId,
          ),
      )
      .map((item) => ({
        ...item,
        completedDateLabel: item.completedAt
          ? toBRDate(new Date(item.completedAt))
          : item.completedFromCarryoverAt || "sem data",
      }))
      .sort(
        (a, b) =>
          Number(b.week || 0) - Number(a.week || 0) ||
          new Date(b.completedAt || 0) - new Date(a.completedAt || 0),
      );
  }, [schedule, weeklySchedule]);

  const filteredCompletedStudyHistory = useMemo(
    () =>
      completedStudyHistory
        .filter((item) => Number(item.week) === Number(reportWeekFilter))
        .filter(
          (item) =>
            reportDayFilter === "all" || item.dayKey === reportDayFilter,
        ),
    [completedStudyHistory, reportWeekFilter, reportDayFilter],
  );

  const todayPendingStudyItems = useMemo(
    () =>
      schedule
        .filter(
          (item) =>
            item.status !== "concluido" &&
            !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
              item.subjectId,
            ),
        )
        .sort(
          (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
        ),
    [schedule],
  );

  const reportData = useMemo(() => {
    const withAccuracy = subjectPerformance.filter(
      (subject) => subject.totalQuestions > 0,
    );
    const best = withAccuracy.length
      ? [...withAccuracy].sort((a, b) => b.accuracy - a.accuracy)[0]
      : null;
    const worst = withAccuracy.length
      ? [...withAccuracy].sort((a, b) => a.accuracy - b.accuracy)[0]
      : null;
    const mostDelayed = roadmap
      .map((item) => ({
        ...item,
        pending: item.topics.filter((topic) => !topic.done).length,
        total: item.topics.length,
      }))
      .filter((item) => item.total > 0)
      .sort(
        (a, b) =>
          b.pending / b.total - a.pending / a.total || b.weight - a.weight,
      )[0];
    const topError = Object.entries(
      errors.reduce(
        (acc, item) => ({
          ...acc,
          [item.subject || "Sem matéria"]:
            (acc[item.subject || "Sem matéria"] || 0) + 1,
        }),
        {},
      ),
    ).sort((a, b) => b[1] - a[1])[0];
    const nextToday = todayPendingStudyItems[0];
    return {
      best: best?.name || "—",
      worst: worst?.name || "—",
      mostDelayed: mostDelayed?.subject || "—",
      topError: topError ? `${topError[0]} (${topError[1]})` : "—",
      nextSuggestion: nextToday
        ? `${nextToday.subject}: ${nextToday.topic}`
        : "Todos os blocos de hoje foram concluídos",
      nextReason: nextToday?.carryover
        ? "Pendente do dia anterior que deve ser resolvida antes do estudo normal."
        : nextToday
          ? "Próximo bloco pendente no Estudo do Dia."
          : "Não há bloco pendente para hoje.",
      diagnosis:
        roadmapStats.done === 0 &&
        stats.questionsDone === 0 &&
        errors.length === 0
          ? "O sistema está zerado. O primeiro objetivo é gerar dados: concluir blocos, registrar questões e criar revisões."
          : "Já existe progresso suficiente para ajustar prioridade por peso, erro e aproveitamento.",
    };
  }, [
    errors,
    roadmap,
    roadmapStats.done,
    stats.questionsDone,
    subjectPerformance,
    todayPendingStudyItems,
  ]);

  const nav = [
    ["dashboard", Home, "Painel"],
    ["today", CalendarDays, "Estudo do Dia"],
    ["weekly", CalendarDays, "Planejamento do Ciclo"],
    ["schedule", Clock, "Cronograma"],
    ["subjects", BookOpen, "Matérias"],
    ["questions", CheckSquare, "Questões"],
    ["simulated", Trophy, "Simulado"],
    ["reviews", RotateCcw, "Revisões"],
    ["errors", AlertTriangle, "Erros"],
    ["notes", NotebookPen, "Anotações"],
    ["weights", BarChart3, "Pesos"],
    ["report", FileText, "Relatório"],
    ["exam-switch", FileSpreadsheet, "Editais"],
    ["settings", Settings, "Configurações"],
  ];

  function estimateTopicMinutes(topic) {
    return estimateStaticTopicMinutes(topic);
  }

  function scheduleRecommendation(subject, selectedTopics, subjectMinutes) {
    if (!selectedTopics.length)
      return "Nenhum assunto pendente para essa matéria.";
    const totalEstimated = selectedTopics.reduce(
      (sum, topic) => sum + estimateTopicMinutes(topic),
      0,
    );
    if (selectedTopics.length === 1)
      return `O sistema selecionou 1 assunto porque ele cabe melhor em ${subjectMinutes} minutos com resumo e questões.`;
    if (totalEstimated <= subjectMinutes)
      return `O sistema selecionou ${selectedTopics.length} assuntos porque eles cabem nos ${subjectMinutes} minutos previstos para ${subject.subject}.`;
    return `O sistema reduziu para ${selectedTopics.length} assunto(s) para não estourar o tempo de estudo, resumo e questões.`;
  }

  function generateWeeklySchedule(configOverride = scheduleConfig) {
    const targetConfig = {
      ...defaultScheduleConfig(),
      ...(configOverride || {}),
    };

    // Gera o ciclo completo, mas não agenda retroativamente os dias que já passaram
    // na semana atual. Mantém os demais ciclos e os blocos especiais de domingo.
    const currentWeek = currentCycleWeek(
      SYSTEM_TODAY,
      settings?.studyStartDate || DEFAULT_STUDY_START_DATE,
    );
    const todayIndex = WEEK_DAYS.findIndex(([key]) => key === TODAY_DAY_KEY);

    const generated = removeRetroactiveItemsFromCurrentWeek(
      buildTwelveWeekSchedule(
        roadmap,
        targetConfig,
        settings,
        questionSessions,
      ),
      settings?.studyStartDate || DEFAULT_STUDY_START_DATE,
    );
    setWeeklySchedule((current) => {
      const progressItems = current.filter(
        (item) => item.status === "concluido" || item.carryover,
      );
      return generated.map((item) => {
        const progressItem = progressItems.find(
          (saved) =>
            saved.id === item.id ||
            (saved.week === item.week &&
              saved.dayKey === item.dayKey &&
              saved.subjectId === item.subjectId &&
              saved.topicId === item.topicId),
        );
        return progressItem
          ? {
              ...item,
              status: progressItem.status,
              completedAt: progressItem.completedAt,
              elapsedSeconds:
                progressItem.elapsedSeconds || item.elapsedSeconds,
              carryover: progressItem.carryover,
              carryoverFrom: progressItem.carryoverFrom,
            }
          : item;
      });
    });
    const todayGenerated = todayScheduleFromWeekly(generated, roadmap);
    const hasProgress = schedule.some(
      (item) =>
        item.status === "andamento" ||
        item.status === "concluido" ||
        Number(item.elapsedSeconds || 0) > 0,
    );
    if (!hasProgress) setSchedule(todayGenerated);
    setView("schedule");
  }

  function prioritizeMissingTopic(subjectId, missingTopicId, replaceItemId) {
    const subject = getSubject(roadmap, subjectId);
    const missingTopic = getTopic(roadmap, subjectId, missingTopicId);
    if (!subject || !missingTopic) {
      setPrioritySwapMessage("Selecione o tópico que deseja priorizar.");
      return;
    }
    const subjectItems = effectiveWeeklySchedule.filter(
      (item) =>
        item.subjectId === subjectId &&
        !item.carryover &&
        !["simulado", "caderno_erros", "planejamento"].includes(item.subjectId),
    );
    const targetItem =
      subjectItems.find((item) => item.id === replaceItemId) ||
      subjectItems[subjectItems.length - 1];
    if (!targetItem) {
      setPrioritySwapMessage(
        "Não existe bloco dessa matéria no cronograma para substituir.",
      );
      return;
    }
    const newId = `${targetItem.id}-priorizado-${missingTopic.id}`;
    const replacement = {
      ...targetItem,
      id: newId,
      topicId: missingTopic.id,
      topicIds: [missingTopic.id],
      topic: missingTopic.title,
      priorityForced: true,
      replacedTopic: targetItem.topic,
      replacedTopicId: targetItem.topicId,
      status:
        targetItem.status === "concluido" ? targetItem.status : "pendente",
    };
    setWeeklySchedule((current) =>
      current.map((item) => (item.id === targetItem.id ? replacement : item)),
    );
    setSchedule((current) =>
      current.map((item) => (item.id === targetItem.id ? replacement : item)),
    );
    setPrioritySwap({ missingTopicId: "", replaceItemId: "" });
    setPrioritySwapMessage(
      `${missingTopic.title} foi priorizado na Ciclo ${targetItem.week}, ${dayLabel(targetItem.dayKey)}. Ele entrou no lugar de ${targetItem.topic}.`,
    );
  }

  function updateScheduleTopicLimit(subjectId, value) {
    setCycleDraftConfig((current) => ({
      ...current,
      topicLimits: { ...current.topicLimits, [subjectId]: value },
    }));
  }

  function recalculateItemsForConfig(items, config) {
    return withRecalculatedStudyMinutes(
      withDistributedQuestionTargets(
        normalizeScheduleItems(items, config),
        config,
        roadmap,
      ),
      config,
      roadmap,
    );
  }

  function saveCycleConfig() {
    const previousSubjectsPerDay = String(scheduleConfig.subjectsPerDay || "");
    const nextSubjectsPerDay = String(cycleDraftConfig.subjectsPerDay || "");
    const previousMinutes = String(scheduleConfig.dailyStudyMinutes || "");
    const nextMinutes = String(cycleDraftConfig.dailyStudyMinutes || "");
    const subjectsPerDayChanged = previousSubjectsPerDay !== nextSubjectsPerDay;
    const minutesChanged = previousMinutes !== nextMinutes;

    setScheduleConfig(cycleDraftConfig);
    setSettings((current) =>
      syncWeeklyQuestionsWithDaily(
        {
          ...current,
          dailyHours: String(
            Math.round(
              (Number(cycleDraftConfig.dailyStudyMinutes) || 180) / 60,
            ),
          ),
        },
        cycleDraftConfig,
      ),
    );
    setSchedule((current) =>
      recalculateItemsForConfig(current, cycleDraftConfig),
    );
    setWeeklySchedule((current) =>
      recalculateItemsForConfig(current, cycleDraftConfig),
    );
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1800);

    if (subjectsPerDayChanged) {
      openConfirmDialog({
        title: "Atualizar ciclo?",
        message: `Você mudou de ${previousSubjectsPerDay || "-"} para ${nextSubjectsPerDay || "-"} matéria(s) por dia. Deseja atualizar o cronograma do ciclo agora com essa nova configuração?`,
        confirmLabel: "Atualizar",
        cancelLabel: "Agora não",
        tone: "amber",
        onConfirm: () => generateWeeklySchedule(cycleDraftConfig),
      });
    } else if (minutesChanged) {
      openConfirmDialog({
        title: "Recalcular tempos?",
        message: `Você mudou o tempo diário de ${previousMinutes || "-"} para ${nextMinutes || "-"} minutos. Deseja recalcular o cronograma do ciclo agora mantendo as mesmas matérias e assuntos?`,
        confirmLabel: "Recalcular",
        cancelLabel: "Agora não",
        tone: "amber",
        onConfirm: () => {
          setSchedule((current) =>
            recalculateItemsForConfig(current, cycleDraftConfig),
          );
          setWeeklySchedule((current) =>
            recalculateItemsForConfig(current, cycleDraftConfig),
          );
        },
      });
    }
  }

  function subjectsPerDaySlots(config = scheduleConfig) {
    return Math.max(1, Number(config.subjectsPerDay) || 2);
  }

  function emptyManualDraft(slots = subjectsPerDaySlots()) {
    return Object.fromEntries(
      WEEK_DAYS.map(([dayKey]) => [
        dayKey,
        Array.from({ length: slots }, () => ({ subjectId: "", topicId: "" })),
      ]),
    );
  }

  function topicOptionsForManualSubject(subjectId) {
    const special = MANUAL_SPECIAL_BLOCKS.find((item) => item.id === subjectId);
    if (special) return [{ id: special.id, title: special.topic }];
    return getSubject(roadmap, subjectId)?.topics || [];
  }

  function nextTopicForManualSubject(
    subjectId,
    week,
    usedTopicIds = new Set(),
  ) {
    const subject = getSubject(roadmap, subjectId);
    if (!subject) return "";
    const usedBefore = new Set(
      effectiveWeeklySchedule
        .filter(
          (item) =>
            item.subjectId === subjectId &&
            Number(item.week || 0) < Number(week || manualScheduleWeek),
        )
        .flatMap((item) =>
          Array.isArray(item.topicIds) && item.topicIds.length
            ? item.topicIds
            : item.topicId
              ? [item.topicId]
              : [],
        ),
    );
    const ordered = sortTopicsForNextCycle(subject, questionSessions);
    return (
      ordered.find(
        (topic) =>
          !usedBefore.has(topic.id) &&
          !usedTopicIds.has(`${subjectId}:${topic.id}`),
      )?.id ||
      ordered.find((topic) => !usedTopicIds.has(`${subjectId}:${topic.id}`))
        ?.id ||
      ordered[0]?.id ||
      ""
    );
  }

  function draftFromWeek(week, slots = subjectsPerDaySlots()) {
    const draft = emptyManualDraft(slots);
    WEEK_DAYS.forEach(([dayKey]) => {
      const items = effectiveWeeklySchedule
        .filter(
          (item) =>
            Number(item.week) === Number(week) &&
            item.dayKey === dayKey &&
            !item.carryover,
        )
        .slice(0, slots);
      draft[dayKey] = Array.from({ length: slots }, (_, index) => {
        const item = items[index];
        if (!item) return { subjectId: "", topicId: "" };
        const topicId =
          item.topicId ||
          (Array.isArray(item.topicIds) && item.topicIds.length
            ? item.topicIds[0]
            : "") ||
          (MANUAL_SPECIAL_BLOCKS.some(
            (special) => special.id === item.subjectId,
          )
            ? item.subjectId
            : "");
        return { subjectId: item.subjectId || "", topicId };
      });
    });
    return draft;
  }

  function openManualScheduleEditor(
    week = scheduleWeekFilter === "all"
      ? effectiveCycleWeek
      : Number(scheduleWeekFilter),
  ) {
    const targetWeek = Number(week) || effectiveCycleWeek;
    setManualScheduleWeek(targetWeek);
    setManualScheduleDraft(draftFromWeek(targetWeek));
    setManualScheduleMessage("");
    setManualScheduleOpen(true);
  }

  function updateManualScheduleDraft(dayKey, index, field, value) {
    setManualScheduleDraft((current) => {
      const slots = subjectsPerDaySlots();
      const next = { ...emptyManualDraft(slots), ...(current || {}) };
      const daySlots = [...(next[dayKey] || [])];
      const currentSlot = daySlots[index] || { subjectId: "", topicId: "" };
      const updated = { ...currentSlot, [field]: value };
      if (field === "subjectId") {
        const topics = topicOptionsForManualSubject(value);
        updated.topicId = topics[0]?.id || "";
      }
      daySlots[index] = updated;
      next[dayKey] = daySlots;
      return next;
    });
  }

  function suggestedManualDraftForWeek(week = manualScheduleWeek) {
    const slots = subjectsPerDaySlots();
    const draft = emptyManualDraft(slots);
    const editableDays = WEEK_DAYS.filter(([dayKey]) => dayKey !== "domingo");
    const rankedSubjects = [...subjectRiskRanking].filter((subject) =>
      roadmap.some((entry) => entry.id === subject.id),
    );
    const fallbackSubjects = [...roadmap].sort(
      (a, b) => Number(b.weight || 0) - Number(a.weight || 0),
    );
    const subjectPool = rankedSubjects.length
      ? rankedSubjects
          .map((subject) => getSubject(roadmap, subject.id))
          .filter(Boolean)
      : fallbackSubjects;
    const usedDaySubjects = {};
    let pointer = 0;

    editableDays.forEach(([dayKey]) => {
      usedDaySubjects[dayKey] = new Set();
      draft[dayKey] = Array.from({ length: slots }, () => {
        let chosen = null;
        for (let attempt = 0; attempt < subjectPool.length; attempt += 1) {
          const candidate =
            subjectPool[(pointer + attempt) % subjectPool.length];
          if (!candidate) continue;
          if (!usedDaySubjects[dayKey].has(candidate.id)) {
            chosen = candidate;
            pointer = pointer + attempt + 1;
            break;
          }
        }
        chosen = chosen || subjectPool[pointer % subjectPool.length];
        if (!chosen) return { subjectId: "", topicId: "" };
        usedDaySubjects[dayKey].add(chosen.id);
        return { subjectId: chosen.id, topicId: "" };
      });
    });
    draft.domingo = [];
    return draft;
  }

  function applyPerformanceSuggestionToManualDraft() {
    const hasPerformanceData =
      questionSessions.length > 0 || errors.length > 0 || reviews.length > 0;
    setManualScheduleDraft(suggestedManualDraftForWeek(manualScheduleWeek));
    setManualScheduleMessage(
      hasPerformanceData
        ? `Sugestão criada para a Ciclo ${manualScheduleWeek} priorizando matérias com menor desempenho, mais erros e menor progresso. O domingo continua fixo.`
        : `Sugestão criada para a Ciclo ${manualScheduleWeek} com base nos pesos do edital. Depois que você registrar questões e erros, esse botão passa a priorizar desempenho também. O domingo continua fixo.`,
    );
  }

  function buildManualWeeklyItems(week, draft) {
    const slots = subjectsPerDaySlots();
    const dailyStudyMinutes = Math.max(
      60,
      Number(scheduleConfig.dailyStudyMinutes) || 180,
    );
    const minutesPerBlock = Math.max(30, Math.round(dailyStudyMinutes / slots));
    const sundayMinutes = Math.max(
      30,
      Math.round(dailyStudyMinutes / MANUAL_SPECIAL_BLOCKS.length),
    );
    const items = [];
    const usedTopics = new Set();

    WEEK_DAYS.filter(([dayKey]) => dayKey !== "domingo").forEach(([dayKey]) => {
      const daySlots = (draft?.[dayKey] || []).slice(0, slots);
      daySlots.forEach((slot, index) => {
        if (!slot?.subjectId) return;
        const subject = getSubject(roadmap, slot.subjectId);
        if (!subject) return;
        const autoTopicId = nextTopicForManualSubject(
          subject.id,
          week,
          usedTopics,
        );
        if (autoTopicId) usedTopics.add(`${subject.id}:${autoTopicId}`);
        const topic =
          getTopic(roadmap, subject.id, autoTopicId) || subject.topics?.[0];
        items.push({
          id: `manual-w${week}-${dayKey}-${index}-${subject.id}-${topic?.id || "sem_topico"}`,
          week: Number(week),
          dayKey,
          dayLabel: dayLabel(dayKey),
          subjectId: subject.id,
          topicId: topic?.id || null,
          topicIds: topic?.id ? [topic.id] : [],
          subject: subject.subject,
          topic: topic?.title || "Assunto a definir",
          type: "Estudo",
          minutes: minutesPerBlock,
          questionsTarget: 0,
          status: "pendente",
          elapsedSeconds: 0,
          plannedBy: "manual",
          plannedWeight: subject.weight,
          manualSlot: index + 1,
        });
      });
    });

    MANUAL_SPECIAL_BLOCKS.forEach((special, index) => {
      items.push({
        id: `manual-w${week}-domingo-${index}-${special.id}`,
        week: Number(week),
        dayKey: "domingo",
        dayLabel: dayLabel("domingo"),
        subjectId: special.id,
        topicId: special.id,
        topicIds: [],
        subject: special.subject,
        topic:
          special.id === "planejamento"
            ? `Gerar e ajustar o Ciclo ${Number(week) + 1}`
            : special.topic,
        type: special.type,
        minutes: sundayMinutes,
        questionsTarget: 0,
        status: "pendente",
        elapsedSeconds: 0,
        plannedBy: "manual-fixo",
        manualSlot: index + 1,
      });
    });

    return withDistributedQuestionTargets(items, scheduleConfig, roadmap);
  }

  function saveManualSchedule() {
    const newWeekItems = buildManualWeeklyItems(
      manualScheduleWeek,
      manualScheduleDraft,
    );
    setWeeklySchedule((current) => {
      const next = [
        ...current.filter(
          (item) => Number(item.week) !== Number(manualScheduleWeek),
        ),
        ...newWeekItems,
      ].sort(
        (a, b) =>
          Number(a.week || 0) - Number(b.week || 0) ||
          WEEK_DAYS.findIndex(([key]) => key === a.dayKey) -
            WEEK_DAYS.findIndex(([key]) => key === b.dayKey) ||
          Number(a.manualSlot || 0) - Number(b.manualSlot || 0),
      );

      if (Number(manualScheduleWeek) === effectiveCycleWeek) {
        const todayItems = scheduleFromWeekly(
          next,
          roadmap,
          manualScheduleWeek,
          TODAY_DAY_KEY,
        );
        setSchedule(todayItems);
      }
      return next;
    });
    setScheduleWeekFilter(Number(manualScheduleWeek));
    setManualScheduleOpen(false);
    setManualScheduleMessage(`Ciclo ${manualScheduleWeek} salva manualmente.`);
  }

  function copyManualWeekToNext() {
    const nextWeek = Math.min(12, Number(manualScheduleWeek) + 1);
    setManualScheduleWeek(nextWeek);
    setManualScheduleDraft((current) => ({
      ...emptyManualDraft(subjectsPerDaySlots()),
      ...(current || {}),
    }));
    setManualScheduleMessage(
      `Modelo copiado para a Ciclo ${nextWeek}. Ajuste o que quiser e salve.`,
    );
  }

  function addReview(subjectId, topicTitle) {
    const subject = subjectMap[subjectId];
    if (!subject || !topicTitle) return;
    const title = `${subject.name}: ${topicTitle}`;
    const plans = [
      { type: "24 horas", days: 1 },
      { type: "7 dias", days: 7 },
      { type: "15 dias", days: 15 },
      { type: "30 dias", days: 30 },
    ];
    setReviews((current) => {
      const existing = new Set(
        current.map((review) => `${review.title}-${review.type}`),
      );
      const next = plans
        .filter((plan) => !existing.has(`${title}-${plan.type}`))
        .map((plan) => ({
          id: uid("review"),
          title,
          date: addDaysISO(TODAY, plan.days),
          type: plan.type,
          status: "pendente",
        }));
      return [...current, ...next];
    });
  }

  function startReview(id) {
    setReviews((current) =>
      current.map((review) =>
        review.id === id ? { ...review, status: "andamento" } : review,
      ),
    );
  }

  function completeReview(id) {
    setReviews((current) =>
      current.map((review) =>
        review.id === id
          ? {
              ...review,
              status: "concluida",
              completedAt: new Date().toISOString(),
            }
          : review,
      ),
    );
  }

  function moveStudyToNextDay() {
    const sourceDayKey =
      schedule.find((item) => item.dayKey)?.dayKey ||
      currentStudyDayKey ||
      TODAY_DAY_KEY;
    const sourceWeek = Number(
      schedule.find((item) => item.week)?.week ||
        currentStudyWeek ||
        effectiveCycleWeek,
    );
    const targetDayKey = nextStudyDayKey(sourceDayKey);
    const targetWeek =
      sourceDayKey === "sabado" && targetDayKey === "segunda"
        ? Math.min(12, sourceWeek + 1)
        : sourceWeek;
    const pendingCount = schedule.filter(
      (item) =>
        item.status !== "concluido" &&
        !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
          item.subjectId,
        ),
    ).length;

    openConfirmDialog({
      title: "Mudar para o próximo dia?",
      message: pendingCount
        ? `Os ${pendingCount} bloco(s) não concluído(s) vão entrar no próximo dia como "Pendente do dia anterior". ${dailyQuestionGoalReport.missingQuestions > 0 ? `Também serão levadas ${dailyQuestionGoalReport.missingQuestions} questão(ões) pendente(s) para a meta do próximo dia.` : ""}`
        : `O sistema vai carregar o próximo dia de estudo do cronograma. ${dailyQuestionGoalReport.missingQuestions > 0 ? `Também serão levadas ${dailyQuestionGoalReport.missingQuestions} questão(ões) pendente(s) para a meta do próximo dia.` : ""}`,
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "amber",
      onConfirm: () =>
        moveStudyToNextDayNow(
          sourceDayKey,
          sourceWeek,
          targetDayKey,
          targetWeek,
        ),
    });
  }

  function moveStudyToNextDayNow(
    sourceDayKey,
    sourceWeek,
    targetDayKey,
    targetWeek,
  ) {
    if (activeTimerRef.current) {
      activeTimerRef.current = null;
      setActiveBlockId(null);
    }

    const targetBaseSchedule = scheduleFromWeekly(
      effectiveWeeklySchedule,
      roadmap,
      targetWeek,
      targetDayKey,
    );

    const carryovers = schedule
      .filter(
        (item) =>
          item.status !== "concluido" &&
          !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
            item.subjectId,
          ),
      )
      .map((item) => ({
        ...item,
        id: `carry-manual-w${sourceWeek}-${sourceDayKey}-to-w${targetWeek}-${targetDayKey}-${item.subjectId}-${item.topicId || item.id}`,
        week: targetWeek,
        dayKey: targetDayKey,
        dayLabel: dayLabel(targetDayKey),
        carryover: true,
        carryoverFrom: "dia anterior",
        carryoverOriginalDay: dayLabel(sourceDayKey),
        carryoverLabel: "Pendente do dia anterior",
        status: "pendente",
        elapsedSeconds: 0,
        baseElapsedSeconds: 0,
        timerStartedAt: null,
        completedAt: null,
      }));

    const targetDate = isoDateForCycleWeekDay(
      targetWeek,
      targetDayKey,
      settings.studyStartDate,
    );
    const sourceDate = isoDateForCycleWeekDay(
      sourceWeek,
      sourceDayKey,
      settings.studyStartDate,
    );
    const missingQuestionsToCarry = Math.max(
      0,
      Number(dailyQuestionGoalReport.missingQuestions || 0) -
        questionsExcusedToday,
    );
    const nextQuestionCarryovers = (() => {
      const normalized = normalizeQuestionCarryovers(questionCarryovers);
      const withoutSameSource = normalized.filter(
        (item) => !(item.date === targetDate && item.fromDate === sourceDate),
      );
      if (missingQuestionsToCarry <= 0) return withoutSameSource;
      return [
        ...withoutSameSource,
        {
          id: `question-carry-${sourceDate}-to-${targetDate}`,
          date: targetDate,
          fromDate: sourceDate,
          baseQuestions: dailyQuestionGoalReport.baseQuestions,
          doneQuestions: dailyQuestionGoalReport.doneQuestions,
          missingQuestions: missingQuestionsToCarry,
          status: "pendente",
          createdAt: new Date().toISOString(),
        },
      ];
    })();

    const nextSchedule = withDistributedQuestionTargets(
      mergeUniqueScheduleItems(targetBaseSchedule, carryovers),
      scheduleConfig,
      roadmap,
      {
        questionCarryovers: nextQuestionCarryovers,
        studyStartDate: settings.studyStartDate,
      },
    ).sort(
      (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
    );

    setQuestionCarryovers(nextQuestionCarryovers);
    setWeeklySchedule((current) => {
      const withoutOldTargetDay = normalizeScheduleItems(
        current,
        scheduleConfig,
      ).filter(
        (item) =>
          !(
            Number(item.week) === Number(targetWeek) &&
            item.dayKey === targetDayKey
          ),
      );
      const updated = mergeUniqueScheduleItems(
        withoutOldTargetDay,
        nextSchedule,
      );
      return withDistributedQuestionTargets(updated, scheduleConfig, roadmap, {
        questionCarryovers: nextQuestionCarryovers,
        studyStartDate: settings.studyStartDate,
      });
    });

    setCurrentStudyDayKey(targetDayKey);
    setCurrentStudyWeek(targetWeek);
    setWeeklyDayFilter(targetDayKey);
    setWeeklyWeekFilter(targetWeek);
    setSchedule(nextSchedule);
    setQuestionsExcusedToday(0);
    setView("today");
  }

  function rescuePreviousDayPendencies() {
    const targetDayKey = currentStudyDayKey || TODAY_DAY_KEY;
    const targetWeek = Number(currentStudyWeek || effectiveCycleWeek || 1);
    const sourceDayKey = previousStudyDayKey(targetDayKey);
    const sourceWeek =
      targetDayKey === "segunda" ? Math.max(1, targetWeek - 1) : targetWeek;

    const previousItems = normalizeScheduleItems(
      effectiveWeeklySchedule,
      scheduleConfig,
    ).filter(
      (item) =>
        Number(item.week) === Number(sourceWeek) &&
        item.dayKey === sourceDayKey &&
        item.status !== "concluido" &&
        !item.carryover &&
        !["questoes", "simulado", "caderno_erros", "planejamento"].includes(
          item.subjectId,
        ),
    );

    const missingQuestionsToCarry = Math.max(
      0,
      Number(previousDayQuestionGoalReport?.missingQuestions || 0),
    );

    if (!previousItems.length && missingQuestionsToCarry <= 0) {
      openConfirmDialog({
        title: "Nada para resgatar",
        message:
          "Não encontrei bloco pendente nem questões faltantes do dia anterior para trazer para hoje.",
        confirmLabel: "Entendi",
        cancelLabel: "Fechar",
        tone: "stone",
        onConfirm: () => {},
      });
      return;
    }

    openConfirmDialog({
      title: "Resgatar pendências para hoje?",
      message: `${previousItems.length ? `${previousItems.length} bloco(s) pendente(s) de ${dayLabel(sourceDayKey)} serão adicionados ao estudo de hoje.` : "Nenhum bloco pendente encontrado."} ${missingQuestionsToCarry > 0 ? `${missingQuestionsToCarry} questão(ões) faltante(s) também serão somadas à meta de hoje.` : ""}`,
      confirmLabel: "Resgatar",
      cancelLabel: "Cancelar",
      tone: "amber",
      onConfirm: () =>
        rescuePreviousDayPendenciesNow(
          previousItems,
          sourceDayKey,
          sourceWeek,
          targetDayKey,
          targetWeek,
          missingQuestionsToCarry,
        ),
    });
  }

  function rescuePreviousDayPendenciesNow(
    previousItems,
    sourceDayKey,
    sourceWeek,
    targetDayKey,
    targetWeek,
    missingQuestionsToCarry,
  ) {
    const sourceDate = isoDateForCycleWeekDay(
      sourceWeek,
      sourceDayKey,
      settings.studyStartDate,
    );
    const targetDate = isoDateForCycleWeekDay(
      targetWeek,
      targetDayKey,
      settings.studyStartDate,
    );

    const carryovers = previousItems.map((item) => ({
      ...item,
      id: `carry-rescue-w${sourceWeek}-${sourceDayKey}-to-w${targetWeek}-${targetDayKey}-${item.subjectId}-${item.topicId || item.id}`,
      week: targetWeek,
      dayKey: targetDayKey,
      dayLabel: dayLabel(targetDayKey),
      carryover: true,
      carryoverFrom: "dia anterior",
      carryoverOriginalDay: dayLabel(sourceDayKey),
      carryoverLabel: "Pendente do dia anterior",
      status: "pendente",
      elapsedSeconds: 0,
      baseElapsedSeconds: 0,
      timerStartedAt: null,
      completedAt: null,
    }));

    const nextQuestionCarryovers = (() => {
      const normalized = normalizeQuestionCarryovers(questionCarryovers);
      const withoutSameSource = normalized.filter(
        (item) => !(item.date === targetDate && item.fromDate === sourceDate),
      );
      if (missingQuestionsToCarry <= 0) return withoutSameSource;
      return [
        ...withoutSameSource,
        {
          id: `question-carry-rescue-${sourceDate}-to-${targetDate}`,
          date: targetDate,
          fromDate: sourceDate,
          baseQuestions:
            previousDayQuestionGoalReport?.plannedQuestions ||
            dailyQuestionTarget(scheduleConfig),
          doneQuestions: previousDayQuestionGoalReport?.doneQuestions || 0,
          missingQuestions: missingQuestionsToCarry,
          status: "pendente",
          createdAt: new Date().toISOString(),
        },
      ];
    })();

    const mergedToday = mergeUniqueScheduleItems(schedule, carryovers).sort(
      (a, b) => Number(Boolean(b.carryover)) - Number(Boolean(a.carryover)),
    );

    const redistributedToday = withDistributedQuestionTargets(
      mergedToday,
      scheduleConfig,
      roadmap,
      {
        questionCarryovers: nextQuestionCarryovers,
        studyStartDate: settings.studyStartDate,
      },
    );

    setQuestionCarryovers(nextQuestionCarryovers);
    setSchedule(redistributedToday);
    setWeeklySchedule((current) => {
      const base = normalizeScheduleItems(current, scheduleConfig).filter(
        (item) =>
          !(
            Number(item.week) === Number(targetWeek) &&
            item.dayKey === targetDayKey &&
            carryovers.some(
              (carry) =>
                carry.subjectId === item.subjectId &&
                (carry.topicId || carry.id) === (item.topicId || item.id) &&
                Boolean(item.carryover),
            )
          ),
      );
      return withDistributedQuestionTargets(
        mergeUniqueScheduleItems(base, redistributedToday),
        scheduleConfig,
        roadmap,
        {
          questionCarryovers: nextQuestionCarryovers,
          studyStartDate: settings.studyStartDate,
        },
      );
    });
    setView("today");
  }

  function startBlock(id) {
    activeTimerRef.current = id;
    setActiveBlockId(id);
    const now = Date.now();
    setSchedule((current) =>
      current.map((item) => {
        if (item.id === id)
          return {
            ...item,
            status: "andamento",
            timerStartedAt: now,
            baseElapsedSeconds: liveElapsedSeconds(item),
            elapsedSeconds: liveElapsedSeconds(item),
          };
        if (item.status === "andamento") {
          const elapsed = liveElapsedSeconds(item);
          return {
            ...item,
            status: "pausado",
            timerStartedAt: null,
            baseElapsedSeconds: elapsed,
            elapsedSeconds: elapsed,
          };
        }
        return item;
      }),
    );
  }

  function pauseBlock(id) {
    if (activeTimerRef.current === id) {
      activeTimerRef.current = null;
      setActiveBlockId(null);
    }
    setSchedule((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const elapsed = liveElapsedSeconds(item);
        return {
          ...item,
          status: "pausado",
          timerStartedAt: null,
          baseElapsedSeconds: elapsed,
          elapsedSeconds: elapsed,
        };
      }),
    );
  }

  function openCompletionModal(id) {
    const block = schedule.find((item) => item.id === id);
    if (!block || block.status === "concluido") return;
    setCompletionBlock(block);
    setCompletionForm({
      notes: "",
      totalQuestions: block.questionsTarget
        ? String(block.questionsTarget)
        : "",
      correctQuestions: "",
      errorText: "",
      fixText: "",
      missingReason: "",
      showReasonStep: false,
    });
  }

  function confirmCompletion() {
    if (!completionBlock) return;
    const total = Math.max(0, Number(completionForm.totalQuestions) || 0);
    const correct = Math.max(
      0,
      Math.min(total, Number(completionForm.correctQuestions) || 0),
    );
    const wrong = Math.max(0, total - correct);
    const completedAt = new Date().toISOString();
    const completedAtBR = toBRDate(new Date());
    const topicIds =
      Array.isArray(completionBlock.topicIds) && completionBlock.topicIds.length
        ? completionBlock.topicIds
        : completionBlock.topicId
          ? [completionBlock.topicId]
          : [];
    const isSameCarryover = (item) =>
      item.week === completionBlock.week &&
      item.dayKey === completionBlock.dayKey &&
      item.subjectId === completionBlock.subjectId &&
      item.topicId === completionBlock.topicId &&
      Boolean(item.carryover) === Boolean(completionBlock.carryover);
    const isSameBase = (item) =>
      item.id === completionBlock.id || isSameCarryover(item);
    const isSourceSaturdayBlock = (item) =>
      completionBlock.carryover &&
      completionBlock.carryoverFrom === "Sábado" &&
      item.week === completionBlock.week - 1 &&
      item.dayKey === "sabado" &&
      item.subjectId === completionBlock.subjectId &&
      item.topicId === completionBlock.topicId &&
      !item.carryover;
    const isLinkedCarryover = (item) =>
      completionBlock.carryover &&
      item.week === completionBlock.week &&
      item.dayKey === completionBlock.dayKey &&
      item.subjectId === completionBlock.subjectId &&
      item.topicId === completionBlock.topicId &&
      item.carryover;
    activeTimerRef.current = null;
    setActiveBlockId(null);
    setSchedule((current) =>
      current.map((item) => {
        if (!(isSameBase(item) || isLinkedCarryover(item))) return item;
        const elapsed = liveElapsedSeconds(item);
        return {
          ...item,
          status: "concluido",
          elapsedSeconds: elapsed,
          timerStartedAt: null,
          baseElapsedSeconds: elapsed,
          completedAt,
        };
      }),
    );
    setWeeklySchedule((current) => {
      let foundCarryover = false;
      const next = current.map((item) => {
        if (isSameBase(item) || isLinkedCarryover(item)) {
          foundCarryover = true;
          const elapsed =
            item.id === completionBlock.id
              ? liveElapsedSeconds(completionBlock)
              : liveElapsedSeconds(item);
          return {
            ...item,
            status: "concluido",
            completedAt,
            elapsedSeconds: elapsed,
            timerStartedAt: null,
            baseElapsedSeconds: elapsed,
          };
        }
        if (isSourceSaturdayBlock(item)) {
          const elapsed = liveElapsedSeconds(completionBlock);
          return {
            ...item,
            status: "concluido",
            completedAt,
            completedFromCarryover: true,
            completedFromCarryoverDay: dayLabel(completionBlock.dayKey),
            completedFromCarryoverAt: completedAtBR,
            elapsedSeconds: elapsed,
            timerStartedAt: null,
            baseElapsedSeconds: elapsed,
          };
        }
        return item;
      });
      if (!foundCarryover && completionBlock.carryover) {
        const elapsed = liveElapsedSeconds(completionBlock);
        next.push({
          ...completionBlock,
          status: "concluido",
          completedAt,
          elapsedSeconds: elapsed,
          timerStartedAt: null,
          baseElapsedSeconds: elapsed,
        });
      }
      return next;
    });
    if (
      completionBlock.subjectId &&
      completionBlock.subjectId !== "questoes" &&
      topicIds.length
    ) {
      const topicTitles = topicIds
        .map(
          (topicId) =>
            getTopic(roadmap, completionBlock.subjectId, topicId)?.title,
        )
        .filter(Boolean);
      setRoadmap((current) =>
        current.map((subject) =>
          subject.id === completionBlock.subjectId
            ? {
                ...subject,
                topics: subject.topics.map((topic) =>
                  topicIds.includes(topic.id)
                    ? { ...topic, done: true }
                    : topic,
                ),
              }
            : subject,
        ),
      );
      topicTitles.forEach((title) =>
        addReview(completionBlock.subjectId, title),
      );
    }
    if (total > 0 && completionBlock.subjectId !== "questoes") {
      setQuestionSessions((current) =>
        current.some((session) => session.sourceBlockId === completionBlock.id)
          ? current
          : [
              {
                id: uid("question"),
                subjectId: completionBlock.subjectId,
                subject: completionBlock.subject,
                topicId: completionBlock.topicId,
                topicIds,
                topic: completionBlock.topic,
                done: total,
                correct,
                wrong,
                time: Math.round(liveElapsedSeconds(completionBlock) / 60),
                notes: "",
                source: "completion",
                sourceBlockId: completionBlock.id,
                date: TODAY,
                studyDate: TODAY,
                localDate: TODAY,
                completedAt,
                createdAt: completedAt,
              },
              ...current,
            ],
      );
    }
    if (completionForm.notes.trim() && completionBlock.subjectId !== "questoes")
      setNotes((current) =>
        current.some((note) => note.sourceBlockId === completionBlock.id)
          ? current
          : [
              {
                id: uid("note"),
                title: completionBlock.topic,
                text: completionForm.notes.trim(),
                subjectId: completionBlock.subjectId,
                subject: completionBlock.subject,
                topicId: completionBlock.topicId,
                topic: completionBlock.topic,
                sourceBlockId: completionBlock.id,
                createdAt: completedAt,
                updatedAt: completedAt,
              },
              ...current,
            ],
      );
    if (
      completionForm.errorText.trim() &&
      completionBlock.subjectId !== "questoes"
    ) {
      const hasFix = Boolean(completionForm.fixText.trim());
      setErrors((current) =>
        current.some((error) => error.sourceBlockId === completionBlock.id)
          ? current
          : [
              {
                id: uid("error"),
                subjectId: completionBlock.subjectId,
                subject: completionBlock.subject,
                topicId: completionBlock.topicId,
                topic: completionBlock.topic,
                kind: "Manual do estudo",
                status: hasFix ? "resolvido" : "pendente",
                error: completionForm.errorText.trim(),
                fix: completionForm.fixText.trim(),
                sourceBlockId: completionBlock.id,
                createdAt: completedAt,
                resolvedAt: hasFix ? completedAt : null,
              },
              ...current,
            ],
      );
    }
    if (
      completionForm.missingReason === "sem_questoes" &&
      completionBlock.questionsTarget > 0
    ) {
      const excused = Math.max(
        0,
        Number(completionBlock.questionsTarget || 0) - total,
      );
      if (excused > 0) {
        setQuestionsExcusedToday((c) => c + excused);
      }
    }
    setCompletionBlock(null);
    setCelebration({
      id: uid("celebration"),
      subject: completionBlock.subject,
      topic: completionBlock.topic,
    });
  }

  function resetBlock(id) {
    if (!block) return;

    openConfirmDialog({
      title: "Deseja resetar?",
      message: `Essa ação vai zerar o cronômetro e voltar o bloco "${block.subject || "Estudo"}" para pendente.`,
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "red",
      onConfirm: () => resetBlockNow(id),
    });
  }

  async function resetBlockNow(id) {
    const block =
      schedule.find((item) => item.id === id) ||
      weeklySchedule.find((item) => item.id === id);
    if (!block) return;

    if (activeTimerRef.current === id) {
      activeTimerRef.current = null;
      setActiveBlockId(null);
    }

    const topicIds =
      Array.isArray(block.topicIds) && block.topicIds.length
        ? block.topicIds
        : block.topicId
          ? [block.topicId]
          : [];

    const itemTopicIds = (item) =>
      Array.isArray(item.topicIds) && item.topicIds.length
        ? item.topicIds
        : item.topicId
          ? [item.topicId]
          : [];

    const sameTopic = (item) => {
      const ids = itemTopicIds(item);
      if (!topicIds.length && !ids.length) return item.topic === block.topic;
      return ids.some((topicId) => topicIds.includes(topicId));
    };

    const isSameBlock = (item) =>
      item.id === id ||
      item.id === block.id ||
      (Number(item.week) === Number(block.week) &&
        item.dayKey === block.dayKey &&
        item.subjectId === block.subjectId &&
        sameTopic(item) &&
        Boolean(item.carryover) === Boolean(block.carryover));

    const isSourceSaturdayBlock = (item) =>
      block.carryover &&
      block.carryoverFrom === "Sábado" &&
      Number(item.week) === Number(block.week) - 1 &&
      item.dayKey === "sabado" &&
      item.subjectId === block.subjectId &&
      sameTopic(item) &&
      !item.carryover;

    const isLinkedCarryover = (item) =>
      item.subjectId === block.subjectId &&
      sameTopic(item) &&
      item.carryover &&
      item.carryoverFrom === dayLabel(block.dayKey);

    const resetPayload = {
      status: "pendente",
      elapsedSeconds: 0,
      timerStartedAt: null,
      baseElapsedSeconds: 0,
      completedAt: null,
      completedFromCarryover: false,
      completedFromCarryoverDay: null,
      completedFromCarryoverAt: null,
    };

    const resetItem = (item) =>
      isSameBlock(item) ||
      isSourceSaturdayBlock(item) ||
      isLinkedCarryover(item)
        ? { ...item, ...resetPayload }
        : item;

    const nextSchedule = schedule.map(resetItem);
    const nextWeeklySchedule = weeklySchedule.map(resetItem);

    const nextRoadmap =
      block.subjectId && block.subjectId !== "questoes" && topicIds.length
        ? roadmap.map((subject) =>
            subject.id === block.subjectId
              ? {
                  ...subject,
                  topics: subject.topics.map((topic) =>
                    topicIds.includes(topic.id)
                      ? { ...topic, done: false }
                      : topic,
                  ),
                }
              : subject,
          )
        : roadmap;

    const isGeneratedByThisBlock = (entry) => {
      if (entry.sourceBlockId === id || entry.sourceBlockId === block.id)
        return true;
      if (entry.subjectId !== block.subjectId) return false;
      const entryTopicIds =
        Array.isArray(entry.topicIds) && entry.topicIds.length
          ? entry.topicIds
          : entry.topicId
            ? [entry.topicId]
            : [];
      if (entryTopicIds.some((topicId) => topicIds.includes(topicId)))
        return true;
      return Boolean(block.topic && entry.topic === block.topic);
    };

    const nextQuestionSessions = questionSessions.filter(
      (session) => !isGeneratedByThisBlock(session),
    );
    const nextNotes = notes.filter((note) => !isGeneratedByThisBlock(note));
    const nextErrors = errors.filter((error) => !isGeneratedByThisBlock(error));

    const topicTitles = topicIds
      .map((topicId) => getTopic(roadmap, block.subjectId, topicId)?.title)
      .filter(Boolean);

    const nextReviews = reviews.filter((review) => {
      if (review.subjectId && review.subjectId !== block.subjectId) return true;
      const reviewText =
        `${review.title || ""} ${review.topic || ""}`.toLowerCase();
      const subjectText = String(block.subject || "").toLowerCase();
      const matchesTopic =
        topicTitles.some((title) =>
          reviewText.includes(String(title).toLowerCase()),
        ) ||
        (block.topic && reviewText.includes(String(block.topic).toLowerCase()));
      const matchesSubject =
        !subjectText ||
        reviewText.includes(subjectText) ||
        review.subjectId === block.subjectId;
      return !(matchesTopic && matchesSubject);
    });

    setSchedule(nextSchedule);
    setWeeklySchedule(nextWeeklySchedule);
    setRoadmap(nextRoadmap);
    setQuestionSessions(nextQuestionSessions);
    setNotes(nextNotes);
    setErrors(nextErrors);
    setReviews(nextReviews);
    setCompletionBlock(null);
  }

  function solveError(id) {
    const now = new Date().toISOString();
    setErrors((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const nextItem = {
          ...item,
          status: item.status === "resolvido" ? "pendente" : "resolvido",
          resolvedAt: item.status === "resolvido" ? null : now,
        };
        setViewingError((currentViewing) =>
          currentViewing?.id === id ? nextItem : currentViewing,
        );
        return nextItem;
      }),
    );
  }

  function deleteError(id) {
    const item = errors.find((entry) => entry.id === id);
    openConfirmDialog({
      title: "Deseja apagar?",
      message: `Essa ação vai apagar o erro${item?.subject ? ` de ${item.subject}` : ""}.`,
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "red",
      onConfirm: () => deleteErrorNow(id),
    });
  }

  function deleteErrorNow(id) {
    setErrors((current) => current.filter((item) => item.id !== id));
    setViewingError((current) => (current?.id === id ? null : current));
  }

  function openErrorForm() {
    setEditingErrorId(null);
    setErrorFormOpen(true);
    setErrorForm({ subjectId: "", topicId: "", error: "", fix: "" });
    setErrorFormMessage("");
  }

  function openEditError(item) {
    setViewingError(null);
    setEditingErrorId(item.id);
    setErrorFormOpen(true);
    setErrorForm({
      subjectId: item.subjectId || "",
      topicId: item.topicId || "",
      error: item.error || "",
      fix: item.fix || "",
    });
    setErrorFormMessage("");
  }

  function openViewError(item) {
    setViewingError(item);
    setCorrectionForm({ id: null, fix: "" });
  }

  function closeViewError() {
    setViewingError(null);
    setCorrectionForm({ id: null, fix: "" });
  }

  function saveError() {
    const subject = subjectMap[errorForm.subjectId];
    const topic = getTopic(roadmap, errorForm.subjectId, errorForm.topicId);
    if (!subject)
      return setErrorFormMessage("Selecione a matéria para salvar o erro.");
    if (!topic)
      return setErrorFormMessage("Selecione o assunto para salvar o erro.");
    if (!errorForm.error.trim())
      return setErrorFormMessage("O campo erro é obrigatório.");
    const hasFix = Boolean(errorForm.fix.trim());
    if (editingErrorId)
      setErrors((current) =>
        current.map((item) =>
          item.id === editingErrorId
            ? {
                ...item,
                subjectId: subject.id,
                subject: subject.name,
                topicId: topic.id,
                topic: topic.title,
                error: errorForm.error.trim(),
                fix: errorForm.fix.trim(),
                status: hasFix ? item.status : "pendente",
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    else
      setErrors((current) => [
        {
          id: uid("error"),
          subjectId: subject.id,
          subject: subject.name,
          topicId: topic.id,
          topic: topic.title,
          kind: "Manual",
          status: hasFix ? "resolvido" : "pendente",
          error: errorForm.error.trim(),
          fix: errorForm.fix.trim(),
          createdAt: new Date().toISOString(),
          resolvedAt: hasFix ? new Date().toISOString() : null,
        },
        ...current,
      ]);
    setErrorFormOpen(false);
    setEditingErrorId(null);
    setErrorForm({ subjectId: "", topicId: "", error: "", fix: "" });
    setErrorFormMessage("");
  }

  function openCorrectionForm(item) {
    setCorrectionForm({ id: item.id, fix: item.fix || "" });
  }

  function saveCorrection() {
    if (!correctionForm.id || !correctionForm.fix.trim()) return;
    const fix = correctionForm.fix.trim();
    const resolvedAt = new Date().toISOString();
    setErrors((current) =>
      current.map((item) => {
        if (item.id !== correctionForm.id) return item;
        const nextItem = {
          ...item,
          fix,
          status: "resolvido",
          resolvedAt,
        };
        setViewingError((currentViewing) =>
          currentViewing?.id === item.id ? nextItem : currentViewing,
        );
        return nextItem;
      }),
    );
    setCorrectionForm({ id: null, fix: "" });
  }

  function toggleRoadmapTopic(subjectId, topicId) {
    let nextTopic = null;
    setRoadmap((current) =>
      current.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              topics: subject.topics.map((topic) => {
                if (topic.id !== topicId) return topic;
                nextTopic = { ...topic, done: !topic.done };
                return nextTopic;
              }),
            }
          : subject,
      ),
    );
    if (nextTopic?.done) addReview(subjectId, nextTopic.title);
  }

  function changeRoadmapPriority(subjectId, topicId, priority) {
    setRoadmap((current) =>
      current.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              topics: subject.topics.map((topic) =>
                topic.id === topicId ? { ...topic, priority } : topic,
              ),
            }
          : subject,
      ),
    );
  }

  function registerQuestions() {
    const done = Math.max(0, Number(questionForm.done) || 0);
    const correct = Math.max(
      0,
      Math.min(done, Number(questionForm.correct) || 0),
    );
    if (!questionForm.subjectId || done <= 0) return;
    const topic = questionForm.topicId
      ? getTopic(roadmap, questionForm.subjectId, questionForm.topicId)
      : null;
    setQuestionSessions((current) => [
      {
        id: uid("question"),
        subjectId: questionForm.subjectId,
        subject: subjectMap[questionForm.subjectId]?.name || "Matéria",
        topicId: topic?.id || "manual",
        topicIds: topic?.id ? [topic.id] : [],
        topic: topic?.title || "Bateria manual",
        done,
        correct,
        wrong: done - correct,
        time: Number(questionForm.time || 0),
        notes: questionForm.notes,
        source: "manual",
        date: TODAY,
        studyDate: TODAY,
        localDate: TODAY,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setQuestionForm({
      subjectId: "",
      topicId: "",
      done: "",
      correct: "",
      time: "",
      notes: "",
    });
  }

  function updateSimulatedSubject(subjectId, field, value) {
    setSimulatedForm((current) => ({
      ...current,
      subjects: {
        ...current.subjects,
        [subjectId]: {
          ...(current.subjects?.[subjectId] || {}),
          [field]: value,
        },
      },
    }));
  }

  function saveSimulatedTest() {
    const title = simulatedForm.title.trim();
    const total = Math.max(0, Number(simulatedForm.total) || 0);
    const correct = Math.max(
      0,
      Math.min(total, Number(simulatedForm.correct) || 0),
    );
    const essayScore = Math.max(
      0,
      Math.min(100, Number(simulatedForm.essayScore) || 0),
    );
    const timeSpentMinutes = parseSimulatedTimeToMinutes(
      simulatedForm.timeSpent,
    );
    if (!title) return setSimulatedMessage("Informe o título do simulado.");
    if (total <= 0)
      return setSimulatedMessage("Informe o total de questões do simulado.");
    const subjects = Object.fromEntries(
      subjectsList
        .map((subject) => {
          const entry = simulatedForm.subjects?.[subject.id] || {};
          const subjectTotal = Math.max(0, Number(entry.total) || 0);
          const subjectCorrect = Math.max(
            0,
            Math.min(subjectTotal || correct, Number(entry.correct) || 0),
          );
          return [
            subject.id,
            {
              subjectId: subject.id,
              subject: subject.name,
              total: subjectTotal,
              correct: subjectCorrect,
              wrong: Math.max(0, subjectTotal - subjectCorrect),
            },
          ];
        })
        .filter(([, entry]) => entry.total > 0 || entry.correct > 0),
    );
    const subjectTotalSum = Object.values(subjects).reduce(
      (sum, entry) => sum + Number(entry.total || 0),
      0,
    );
    const subjectCorrectSum = Object.values(subjects).reduce(
      (sum, entry) => sum + Number(entry.correct || 0),
      0,
    );
    if (subjectTotalSum > 0 && subjectTotalSum !== total)
      return setSimulatedMessage(
        "A soma das questões por matéria precisa bater com o total do simulado.",
      );
    if (subjectCorrectSum > correct)
      return setSimulatedMessage(
        "A soma dos acertos por matéria não pode ser maior que o total de acertos do simulado.",
      );
    const newTest = {
      id: uid("simulado"),
      title,
      type: "Simulado",
      total,
      correct,
      wrong: total - correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      essayScore,
      essayStatus: essayStatus(essayScore).label,
      timeSpentMinutes,
      date: simulatedForm.date || toBRDate(new Date()),
      notes: simulatedForm.notes.trim(),
      subjects,
      createdAt: new Date().toISOString(),
    };
    setSimulatedTests((current) => [newTest, ...current]);
    setSimulatedForm({
      title: defaultSimulatedTitle([newTest, ...simulatedTests]),
      total: "",
      correct: "",
      essayScore: "",
      timeSpent: "",
      date: toBRDate(parseISODate(TODAY)),
      notes: "",
      subjects: {},
    });
    setSimulatedMessage("");
  }

  function deleteSimulatedTest(id) {
    const test = simulatedTests.find((item) => item.id === id);
    openConfirmDialog({
      title: "Deseja apagar?",
      message: `Essa ação vai apagar o simulado${test?.title ? ` "${test.title}"` : ""}.`,
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "red",
      onConfirm: () => deleteSimulatedTestNow(id),
    });
  }

  function deleteSimulatedTestNow(id) {
    setSimulatedTests((current) => current.filter((item) => item.id !== id));
    if (simulatedCompareA === id) setSimulatedCompareA("");
    if (simulatedCompareB === id) setSimulatedCompareB("");
    setSimulatedSubjectsOpen(false);
  }

  function clearSimulatedSelection() {
    setSimulatedCompareA("");
    setSimulatedCompareB("");
  }

  function simulatedDetailSubjects(test) {
    return Object.values(test?.subjects || {}).sort((a, b) => {
      const accuracyA = Number(a.total || 0)
        ? Number(a.correct || 0) / Number(a.total || 1)
        : 0;
      const accuracyB = Number(b.total || 0)
        ? Number(b.correct || 0) / Number(b.total || 1)
        : 0;
      return (
        accuracyB - accuracyA || Number(b.correct || 0) - Number(a.correct || 0)
      );
    });
  }

  function openNoteForm() {
    setEditingNoteId(null);
    setNoteFormOpen(true);
    setNoteForm({ subjectId: "", topicId: "", title: "", text: "" });
    setNoteFormMessage("");
  }

  function openEditNote(note) {
    setEditingNoteId(note.id);
    setNoteFormOpen(true);
    setNoteForm({
      subjectId: note.subjectId || "",
      topicId: note.topicId || "",
      title: note.title || "",
      text: note.text || "",
    });
    setNoteFormMessage("");
  }

  function openViewNote(note) {
    setViewingNote(note);
  }

  function closeViewNote() {
    setViewingNote(null);
  }

  function editViewingNote() {
    if (!viewingNote) return;
    const note = viewingNote;
    setViewingNote(null);
    openEditNote(note);
  }

  function wrapNoteSelection(
    prefix,
    suffix = prefix,
    fallback = "palavra-chave",
  ) {
    const textarea = noteTextAreaRef.current;
    const currentText = noteForm.text || "";
    if (!textarea) {
      setNoteForm((current) => ({
        ...current,
        text: `${currentText}${prefix}${fallback}${suffix}`,
      }));
      return;
    }

    const start = textarea.selectionStart ?? currentText.length;
    const end = textarea.selectionEnd ?? currentText.length;
    const selected = currentText.slice(start, end);
    let nextText = currentText;
    let nextStart = start;
    let nextEnd = end;

    const beforeSelection = currentText.slice(start - prefix.length, start);
    const afterSelection = currentText.slice(end, end + suffix.length);
    const selectionAlreadyWrapped =
      selected.startsWith(prefix) &&
      selected.endsWith(suffix) &&
      selected.length >= prefix.length + suffix.length;
    const selectionIsInsideWrapper =
      beforeSelection === prefix && afterSelection === suffix;

    if (selectionAlreadyWrapped) {
      const inner = selected.slice(
        prefix.length,
        selected.length - suffix.length,
      );
      nextText = `${currentText.slice(0, start)}${inner}${currentText.slice(end)}`;
      nextEnd = start + inner.length;
    } else if (selected && selectionIsInsideWrapper) {
      nextText = `${currentText.slice(0, start - prefix.length)}${selected}${currentText.slice(end + suffix.length)}`;
      nextStart = start - prefix.length;
      nextEnd = nextStart + selected.length;
    } else {
      const textToWrap = selected || fallback;
      nextText = `${currentText.slice(0, start)}${prefix}${textToWrap}${suffix}${currentText.slice(end)}`;
      nextStart = start + prefix.length;
      nextEnd = nextStart + textToWrap.length;
    }

    setNoteForm((current) => ({ ...current, text: nextText }));
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextStart, nextEnd);
    }, 0);
  }

  function removeNoteSelectionMarkup() {
    const textarea = noteTextAreaRef.current;
    const currentText = noteForm.text || "";
    if (!textarea) {
      setNoteForm((current) => ({
        ...current,
        text: stripNoteMarkup(currentText),
      }));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? currentText.length;
    const hasSelection = end > start;
    const selected = hasSelection ? currentText.slice(start, end) : currentText;
    const clean = stripNoteMarkup(selected);
    const nextText = hasSelection
      ? `${currentText.slice(0, start)}${clean}${currentText.slice(end)}`
      : clean;
    const nextStart = hasSelection ? start : 0;
    const nextEnd = nextStart + clean.length;
    setNoteForm((current) => ({ ...current, text: nextText }));
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextStart, nextEnd);
    }, 0);
  }

  function saveNote() {
    const subject = subjectMap[noteForm.subjectId];
    const topic = getTopic(roadmap, noteForm.subjectId, noteForm.topicId);
    if (!subject)
      return setNoteFormMessage("Selecione a matéria para salvar a anotação.");
    if (!topic)
      return setNoteFormMessage("Selecione o assunto para salvar a anotação.");
    if (!noteForm.text.trim())
      return setNoteFormMessage("O campo anotação é obrigatório.");
    const payload = {
      subjectId: subject.id,
      subject: subject.name,
      topicId: topic.id,
      topic: topic.title,
      title: noteForm.title.trim() || topic.title,
      text: noteForm.text.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (editingNoteId)
      setNotes((current) =>
        current.map((note) =>
          note.id === editingNoteId ? { ...note, ...payload } : note,
        ),
      );
    else
      setNotes((current) => [
        { id: uid("note"), ...payload, createdAt: new Date().toISOString() },
        ...current,
      ]);
    setNoteFormOpen(false);
    setEditingNoteId(null);
    setNoteForm({ subjectId: "", topicId: "", title: "", text: "" });
    setNoteFormMessage("");
  }

  function deleteNote(id) {
    const note = notes.find((item) => item.id === id);
    openConfirmDialog({
      title: "Deseja apagar?",
      message: `Essa ação vai apagar a anotação${note?.title ? ` "${note.title}"` : ""}.`,
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "red",
      onConfirm: () => deleteNoteNow(id),
    });
  }

  function deleteNoteNow(id) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  function saveSettings() {
    const nextDailyStudyMinutes = hoursToStudyMinutes(settings.dailyHours);

    if (nextDailyStudyMinutes) {
      const nextConfig = {
        ...scheduleConfig,
        dailyStudyMinutes: nextDailyStudyMinutes,
      };
      setScheduleConfig(nextConfig);
      setCycleDraftConfig((current) => ({
        ...current,
        dailyStudyMinutes: nextDailyStudyMinutes,
      }));
      setSettings((current) =>
        syncWeeklyQuestionsWithDaily(current, nextConfig),
      );
      setSchedule((current) => recalculateItemsForConfig(current, nextConfig));
      setWeeklySchedule((current) =>
        recalculateItemsForConfig(current, nextConfig),
      );
    }

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 1800);
  }

  function upsertImportedSubject(subjectName, topicLines) {
    const cleanSubject = subjectName.trim();
    const topics = topicLines
      .map((topic) => String(topic || "").trim())
      .filter(Boolean);
    if (!cleanSubject || topics.length === 0)
      return setImportMessage(
        "Informe a matéria e pelo menos um assunto para importar.",
      );
    const subjectId = makeId(cleanSubject);
    setRoadmap((current) => {
      const existing = current.find((item) => item.id === subjectId);
      if (existing) {
        const existingTitles = new Set(
          existing.topics.map((topic) => topic.title.toLowerCase()),
        );
        const newTopics = topics
          .filter((topic) => !existingTitles.has(topic.toLowerCase()))
          .map((topic) => ({
            id: uid(subjectId),
            title: topic,
            done: false,
            priority: "Média",
            difficulty: "Média",
          }));
        return current.map((item) =>
          item.id === subjectId
            ? { ...item, topics: [...item.topics, ...newTopics] }
            : item,
        );
      }
      return [
        ...current,
        {
          id: subjectId,
          subject: cleanSubject,
          weight: 3,
          priority: "Média",
          status: "Aguardando início",
          reason: "Matéria importada nas configurações.",
          topics: topics.map((topic) => ({
            id: uid(subjectId),
            title: topic,
            done: false,
            priority: "Média",
            difficulty: "Média",
          })),
        },
      ];
    });
    setImportMessage(
      `${topics.length} assunto(s) importado(s) para ${cleanSubject}.`,
    );
    setImportForm({ subject: "", topics: [""] });
  }

  function importManualSubjects() {
    upsertImportedSubject(importForm.subject, importForm.topics);
  }

  function updateImportTopic(index, value) {
    setImportForm((current) => ({
      ...current,
      topics: current.topics.map((topic, topicIndex) =>
        topicIndex === index ? value : topic,
      ),
    }));
  }

  function addImportTopicInput() {
    setImportForm((current) => ({
      ...current,
      topics: [...current.topics, ""],
    }));
  }

  function removeImportTopicInput(index) {
    setImportForm((current) => {
      const nextTopics = current.topics.filter(
        (_, topicIndex) => topicIndex !== index,
      );
      return { ...current, topics: nextTopics.length ? nextTopics : [""] };
    });
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          blankrows: false,
        });
        const subjectName = String(rows[0]?.[0] || "").trim();
        const topics = rows
          .slice(2)
          .map((row) => String(row?.[0] || ""))
          .filter(Boolean);
        upsertImportedSubject(subjectName, topics);
      } catch {
        setImportMessage(
          "Não foi possível importar o arquivo. Use a matéria na célula A1 e os assuntos da célula A3 para baixo.",
        );
      }
      event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  }

  function updateExamSubject(index, field, value) {
    setExamForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject, subjectIndex) =>
        subjectIndex === index ? { ...subject, [field]: value } : subject,
      ),
    }));
  }

  function updateExamTopic(subjectIndex, topicIndex, field, value) {
    setExamForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject, currentSubjectIndex) =>
        currentSubjectIndex === subjectIndex
          ? {
              ...subject,
              topics: subject.topics.map((topic, currentTopicIndex) =>
                currentTopicIndex === topicIndex
                  ? { ...topic, [field]: value }
                  : topic,
              ),
            }
          : subject,
      ),
    }));
  }

  function addExamSubject() {
    setExamForm((current) => ({
      ...current,
      subjects: [
        ...current.subjects,
        { subject: "", weight: "3", topics: [{ text: "", priority: "Média" }] },
      ],
    }));
  }

  function removeExamSubject(index) {
    setExamForm((current) => ({
      ...current,
      subjects: current.subjects.filter(
        (_, subjectIndex) => subjectIndex !== index,
      ),
    }));
  }

  function addExamTopic(subjectIndex) {
    setExamForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject, index) =>
        index === subjectIndex
          ? {
              ...subject,
              topics: [...subject.topics, { text: "", priority: "Média" }],
            }
          : subject,
      ),
    }));
  }

  function removeExamTopic(subjectIndex, topicIndex) {
    setExamForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject, index) =>
        index === subjectIndex
          ? {
              ...subject,
              topics: subject.topics.filter(
                (_, currentTopicIndex) => currentTopicIndex !== topicIndex,
              ),
            }
          : subject,
      ),
    }));
  }

  function buildRoadmapFromExamForm(form) {
    return form.subjects
      .map((subject, subjectIndex) => {
        const name = String(subject.subject || "").trim();
        const rawTopics = (subject.topics || [])
          .map((topic) =>
            typeof topic === "object" && topic !== null
              ? {
                  text: String(topic.text || "").trim(),
                  priority: topic.priority || "Média",
                }
              : { text: String(topic || "").trim(), priority: "Média" },
          )
          .filter((t) => t.text);
        if (!name || rawTopics.length === 0) return null;
        const subjectId = slugifyExamKey(name) || `materia_${subjectIndex + 1}`;
        return {
          id: subjectId,
          subject: name,
          weight: Math.max(1, Number(subject.weight || 3)),
          priority:
            Number(subject.weight || 3) >= 10
              ? "Alta"
              : Number(subject.weight || 3) >= 5
                ? "Média"
                : "Baixa",
          status: "Aguardando início",
          reason: "Matéria cadastrada em Novo Edital / Concurso.",
          topics: rawTopics.map((topic, topicIndex) => ({
            id: `${subjectId}_${topicIndex + 1}`,
            title: topic.text,
            done: false,
            priority: topic.priority || "Média",
            difficulty: "Média",
          })),
        };
      })
      .filter(Boolean);
  }

  async function activateExam(exam) {
    const key = exam.key;
    const storageProfileKey = storageKeyForExam(key);
    const cached =
      typeof window !== "undefined"
        ? localStorage.getItem(localCacheKeyForExam(key))
        : null;
    let nextState = null;

    if (supabase) {
      const { data } = await supabase
        .from(SUPABASE_TABLE)
        .select("state")
        .eq("device_id", storageProfileKey)
        .maybeSingle();
      if (data?.state) nextState = normalizeLoadedState(data.state);
    }

    if (!nextState && cached) {
      try {
        nextState = normalizeLoadedState(JSON.parse(cached));
      } catch {}
    }

    if (!nextState) {
      nextState = createInitialState({
        key,
        roadmapVersion: exam.roadmapVersion || `CUSTOM_${key.toUpperCase()}`,
        roadmap: exam.roadmap || roadmapSeed,
        customExams,
        deletedBuiltInExamKeys,
      });
      nextState.settings = {
        ...nextState.settings,
        examDate: exam.noExamDate
          ? ""
          : exam.examDate || nextState.settings.examDate,
      };
      nextState.customExam = !EXAM_OPTIONS.some((item) => item.key === key);
    }

    nextState = {
      ...nextState,
      activeExamKey: key,
      storageProfileKey,
      profileKey: USER_PROFILE_KEY,
      customExams,
      deletedBuiltInExamKeys,
    };
    applyLoadedState(nextState);
    await saveStateToSupabase(nextState);
    setView("dashboard");
  }

  function resetExamCreatorForm() {
    setEditingExamKey(null);
    setExamCreatorMessage("");
    setPdfImportText("");
    setPdfImportFileName("");
    setPdfCargoOptions([]);
    setSelectedPdfCargoKeys([]);
    setPdfImportMessage("");
    setPdfPreviewReady(false);
    setExamForm({
      label: "",
      noExamDate: false,
      examDate: "",
      subjects: [{ subject: "", weight: "3", topics: [""] }],
    });
  }

  function examToForm(exam) {
    const sourceRoadmap =
      Array.isArray(exam?.roadmap) && exam.roadmap.length
        ? exam.roadmap
        : roadmap;
    return {
      label: exam?.label || "",
      noExamDate: Boolean(exam?.noExamDate || !exam?.examDate),
      examDate: exam?.examDate || "",
      subjects: sourceRoadmap.map((subject) => ({
        subject: subject.subject || "",
        weight: String(subject.weight || 3),
        topics:
          Array.isArray(subject.topics) && subject.topics.length
            ? subject.topics
                .map((topic) => topic.title || topic)
                .filter(Boolean)
            : [""],
      })),
    };
  }

  function beginEditCustomExam(exam) {
    setEditingExamKey(exam.key);
    setExamForm(examToForm(exam));
    setExamCreatorMode("manual");
    setExamCreatorOpen(true);
    setExamCreatorMessage(
      "Editando edital. Ao salvar, a estrutura de matérias/assuntos desse edital será atualizada.",
    );
  }

  function confirmDeleteCustomExam(exam) {
    const visibleExams = allAvailableExams(customExams, deletedBuiltInExamKeys);
    if (visibleExams.length <= 1) {
      openConfirmDialog({
        title: "Não é possível apagar",
        message:
          "Você precisa manter pelo menos um edital/ciclo cadastrado no sistema.",
        confirmLabel: "Entendido",
        cancelLabel: "Fechar",
        tone: "amber",
        onConfirm: () => {},
      });
      return;
    }
    openConfirmDialog({
      title: "Deseja apagar este edital?",
      message: `Isso vai remover o edital "${exam.label}" da lista e apagar o histórico separado dele no Supabase. Se ele estiver ativo, o sistema mudará para outro edital disponível.`,
      confirmLabel: "Sim, apagar",
      cancelLabel: "Não",
      tone: "red",
      onConfirm: () => deleteCustomExam(exam),
    });
  }

  async function deleteCustomExam(exam) {
    const isBuiltInExam = EXAM_OPTIONS.some((item) => item.key === exam.key);
    const nextDeletedBuiltInExamKeys = isBuiltInExam
      ? normalizeDeletedBuiltInExamKeys([...deletedBuiltInExamKeys, exam.key])
      : normalizeDeletedBuiltInExamKeys(deletedBuiltInExamKeys);
    const nextCustomExams = isBuiltInExam
      ? customExams
      : customExams.filter((item) => item.key !== exam.key);
    const remainingExams = allAvailableExams(
      nextCustomExams,
      nextDeletedBuiltInExamKeys,
    );

    if (remainingExams.length === 0) {
      setExamCreatorMessage(
        "Você precisa manter pelo menos um edital/ciclo cadastrado.",
      );
      return;
    }

    const deletedStorageKey = storageKeyForExam(exam.key);
    setCustomExams(nextCustomExams);
    setDeletedBuiltInExamKeys(nextDeletedBuiltInExamKeys);

    if (typeof window !== "undefined") {
      localStorage.removeItem(localCacheKeyForExam(exam.key));
      localStorage.removeItem(ackKeyForExam(exam.key));
    }
    if (supabase) {
      await supabase
        .from(SUPABASE_TABLE)
        .delete()
        .eq("device_id", deletedStorageKey);
    }

    if (activeExamKeyState === exam.key) {
      const nextExam = remainingExams[0];
      const nextStorageKey = storageKeyForExam(nextExam.key);
      let nextState = null;

      if (supabase) {
        const { data } = await supabase
          .from(SUPABASE_TABLE)
          .select("state")
          .eq("device_id", nextStorageKey)
          .maybeSingle();
        if (data?.state) nextState = normalizeLoadedState(data.state);
      }

      if (!nextState && typeof window !== "undefined") {
        const cached = localStorage.getItem(localCacheKeyForExam(nextExam.key));
        if (cached) {
          try {
            nextState = normalizeLoadedState(JSON.parse(cached));
          } catch {}
        }
      }

      if (!nextState) {
        nextState = createInitialState({
          ...nextExam,
          customExams: nextCustomExams,
          deletedBuiltInExamKeys: nextDeletedBuiltInExamKeys,
        });
        nextState.settings = {
          ...nextState.settings,
          examDate: nextExam.noExamDate
            ? ""
            : nextExam.examDate || nextState.settings.examDate,
        };
        nextState.customExam = !EXAM_OPTIONS.some(
          (item) => item.key === nextExam.key,
        );
      }

      nextState = {
        ...nextState,
        activeExamKey: nextExam.key,
        storageProfileKey: nextStorageKey,
        profileKey: USER_PROFILE_KEY,
        customExams: nextCustomExams,
        deletedBuiltInExamKeys: nextDeletedBuiltInExamKeys,
      };
      applyLoadedState(nextState);
      await saveStateToSupabase(nextState);
      setView("dashboard");
    } else {
      const nextState = {
        ...appState,
        customExams: nextCustomExams,
        deletedBuiltInExamKeys: nextDeletedBuiltInExamKeys,
      };
      await saveStateToSupabase(nextState);
    }

    if (editingExamKey === exam.key) {
      resetExamCreatorForm();
      setExamCreatorOpen(false);
    }
  }

  async function createCustomExam() {
    const label = String(examForm.label || "").trim();
    if (!label)
      return setExamCreatorMessage("Informe o nome do concurso / edital.");
    if (!examForm.noExamDate && !examForm.examDate)
      return setExamCreatorMessage(
        "Informe a data da prova ou marque que ainda não há data definida.",
      );
    const roadmap = buildRoadmapFromExamForm(examForm);
    if (!roadmap.length)
      return setExamCreatorMessage(
        "Cadastre pelo menos uma matéria com assunto.",
      );
    const editing = customExams.find((item) => item.key === editingExamKey);
    const key = editing ? editing.key : slugifyExamKey(label);
    const versionSuffix = editing ? Number(editing.revision || 1) + 1 : 1;
    const exam = {
      key,
      label,
      board: "Personalizado",
      status: "personalizado",
      revision: versionSuffix,
      roadmapVersion: `CUSTOM_${key.toUpperCase()}_V${versionSuffix}`,
      examDate: examForm.noExamDate ? "" : examForm.examDate,
      noExamDate: examForm.noExamDate,
      roadmap,
    };
    const nextCustomExams = [
      ...customExams.filter((item) => item.key !== key),
      exam,
    ];
    setCustomExams(nextCustomExams);
    setExamCreatorMessage(
      editing
        ? "Edital atualizado. Salvando ciclo..."
        : "Edital criado. Ativando ciclo...",
    );
    const nextState = createInitialState({
      ...exam,
      customExams: nextCustomExams,
      deletedBuiltInExamKeys,
    });
    nextState.settings = {
      ...nextState.settings,
      examDate: exam.examDate || "",
    };
    nextState.customExam = true;
    nextState.customExams = nextCustomExams;
    nextState.deletedBuiltInExamKeys = deletedBuiltInExamKeys;
    if (editing && activeExamKeyState !== key) {
      await saveStateToSupabase({
        ...nextState,
        activeExamKey: key,
        storageProfileKey: storageKeyForExam(key),
      });
      const currentState = {
        ...appState,
        customExams: nextCustomExams,
        deletedBuiltInExamKeys,
      };
      setCustomExams(nextCustomExams);
      await saveStateToSupabase(currentState);
    } else {
      applyLoadedState(nextState);
      await saveStateToSupabase(nextState);
      setView("dashboard");
    }
    setExamCreatorOpen(false);
    resetExamCreatorForm();
  }

  function normalizePdfLine(line) {
    return String(line || "")
      .replace(/\s+/g, " ")
      .replace(/[•●▪]/g, "")
      .trim();
  }

  function normalizePdfText(text) {
    return String(text || "")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "\n")
      .replace(/[\t ]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function withoutAccents(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isMostlyUppercase(value) {
    const letters = withoutAccents(value).replace(/[^A-Za-z]/g, "");
    if (letters.length < 3) return false;
    const upper = letters.replace(/[^A-Z]/g, "").length;
    return upper / letters.length >= 0.75;
  }

  function cleanPdfCargoLabel(value) {
    return normalizePdfLine(value)
      .replace(/^\d+(\.\d+)*\s*[-–.]?\s*/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function canonicalPdfCargoLabel(rawLabel) {
    const value = withoutAccents(normalizePdfLine(rawLabel)).toUpperCase();

    if (/POLICIA MILITAR DA BAHIA\s*-\s*PMBA|\bPMBA\b/.test(value)) {
      return "POLÍCIA MILITAR DA BAHIA - PMBA";
    }

    if (
      /CORPO DE BOMBEIROS MILITAR DA BAHIA\s*-\s*CBMBA|\bCBMBA\b/.test(value)
    ) {
      return "CORPO DE BOMBEIROS MILITAR DA BAHIA - CBMBA";
    }

    if (
      /POLICIA MILITAR DO ESTADO DE SAO PAULO|POLICIA MILITAR DE SAO PAULO|\bPMSP\b|\bPMESP\b/.test(
        value,
      )
    ) {
      return "POLÍCIA MILITAR DO ESTADO DE SÃO PAULO - PMSP";
    }

    return "";
  }

  function detectCargosFromPdfText(text) {
    const normalizedText = normalizePdfText(text);
    const lines = normalizedText
      .split("\n")
      .map(normalizePdfLine)
      .filter(Boolean);

    const found = new Map();

    function addCargo(label, lineIndex = 0) {
      const canonical = canonicalPdfCargoLabel(label);
      if (!canonical) return;
      const key = slugifyExamKey(canonical) || `cargo_${found.size + 1}`;
      if (!found.has(key)) found.set(key, { key, label: canonical, lineIndex });
    }

    lines.forEach((line, index) => {
      const compact = normalizePdfLine(line);

      // Bahia costuma vir exatamente assim no edital. Quando as duas instituições
      // aparecem na mesma linha, registramos as duas separadamente.
      if (/POL[ÍI]CIA\s+MILITAR\s+DA\s+BAHIA\s*-\s*PMBA/i.test(compact)) {
        addCargo("POLÍCIA MILITAR DA BAHIA - PMBA", index);
      }
      if (
        /CORPO\s+DE\s+BOMBEIROS\s+MILITAR\s+DA\s+BAHIA\s*-\s*CBMBA/i.test(
          compact,
        )
      ) {
        addCargo("CORPO DE BOMBEIROS MILITAR DA BAHIA - CBMBA", index);
      }

      // São Paulo: usar a instituição como edital/ciclo, não expressões genéricas
      // como "Aluno-Soldado PM", para evitar falso positivo.
      if (
        /POL[ÍI]CIA\s+MILITAR\s+DO\s+ESTADO\s+DE\s+S[ÃA]O\s+PAULO/i.test(
          compact,
        )
      ) {
        addCargo("POLÍCIA MILITAR DO ESTADO DE SÃO PAULO - PMSP", index);
      }
    });

    // Reforço no texto inteiro para casos em que o PDF quebrou as linhas.
    const full = withoutAccents(normalizedText).toUpperCase();
    if (/POLICIA\s+MILITAR\s+DA\s+BAHIA\s*-\s*PMBA/.test(full)) {
      addCargo("POLÍCIA MILITAR DA BAHIA - PMBA", 0);
    }
    if (
      /CORPO\s+DE\s+BOMBEIROS\s+MILITAR\s+DA\s+BAHIA\s*-\s*CBMBA/.test(full)
    ) {
      addCargo("CORPO DE BOMBEIROS MILITAR DA BAHIA - CBMBA", 0);
    }
    if (/POLICIA\s+MILITAR\s+DO\s+ESTADO\s+DE\s+SAO\s+PAULO/.test(full)) {
      addCargo("POLÍCIA MILITAR DO ESTADO DE SÃO PAULO - PMSP", 0);
    }

    return Array.from(found.values()).slice(0, 6);
  }

  function pdfSubjectWeightByName(name) {
    const lower = withoutAccents(name).toLowerCase();
    if (lower.includes("portugues")) return "10";
    if (lower.includes("matematica")) return "8";
    if (lower.includes("historia")) return "8";
    if (lower.includes("geografia")) return "8";
    if (lower.includes("atualidade")) return "6";
    if (lower.includes("informatica")) return "5";
    if (lower.includes("constitucional")) return "5";
    if (lower.includes("administrativo")) return "5";
    if (lower.includes("penal militar")) return "5";
    if (lower.includes("penal")) return "5";
    if (lower.includes("humanos")) return "5";
    if (lower.includes("igualdade")) return "5";
    if (lower.includes("redacao") || lower.includes("discursiva")) return "8";
    return "3";
  }

  const ignoredPdfSubjectHeaders = new Set([
    "CONHECIMENTOS GERAIS",
    "CONHECIMENTOS ESPECIFICOS",
    "CONHECIMENTOS ESPECÍFICOS",
    "PROVA",
    "ANEXO",
    "CONTEUDO PROGRAMATICO",
    "CONTEÚDO PROGRAMÁTICO",
    "CARGO",
  ]);

  function looksLikePdfSubjectHeader(line) {
    const clean = normalizePdfLine(line).replace(/[:：]\s*$/, "");
    if (!clean || clean.length < 3 || clean.length > 90) return false;
    if (ignoredPdfSubjectHeaders.has(clean.toUpperCase())) return false;
    if (
      /^(\d+\.?|fl\.|p[aá]gina|cap[íi]tulo|edital|instru[cç][oõ]es)/i.test(
        clean,
      )
    )
      return false;
    if (!isMostlyUppercase(clean)) return false;
    return (
      /[:：]$/.test(line) ||
      /\b(PORTUGUESA|PORTUGU[ÊE]S|MATEM[ÁA]TICA|HIST[ÓO]RIA|GEOGRAFIA|ATUALIDADES|INFORM[ÁA]TICA|DIREITO|DIREITOS|ADMINISTRA[ÇC][ÃA]O|IGUALDADE|REDA[ÇC][ÃA]O)\b/i.test(
        clean,
      )
    );
  }

  function cleanPdfTopic(value) {
    return normalizePdfLine(value)
      .replace(/^\d+(\.\d+)*\s*[-–.)]?\s*/g, "")
      .replace(/^[a-z]\)\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitPdfTopics(block) {
    const normalized = normalizePdfLine(block)
      .replace(/\s+(\d+\.\s*)/g, "\n$1")
      .replace(/;\s*/g, "\n")
      .replace(/\.\s+(?=\d+\.)/g, "\n");
    const pieces = normalized
      .split(/\n+/)
      .flatMap((line) => line.split(/(?=\b\d+\.\s)/g))
      .map(cleanPdfTopic)
      .filter(
        (topic) =>
          topic && topic.length >= 3 && !looksLikePdfSubjectHeader(topic),
      );
    const unique = [];
    const seen = new Set();
    pieces.forEach((topic) => {
      const key = withoutAccents(topic).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(topic.replace(/[.;:]$/g, ""));
    });
    return unique.slice(0, 80);
  }

  function slicePdfTextForSelectedCargos(text, selectedKeys) {
    if (!selectedKeys?.length) return text;
    const lines = normalizePdfText(text).split("\n");
    const cargos = detectCargosFromPdfText(text).sort(
      (a, b) => a.lineIndex - b.lineIndex,
    );
    const selected = cargos.filter((cargo) => selectedKeys.includes(cargo.key));
    if (!selected.length) return text;
    const chunks = [];
    selected.forEach((cargo) => {
      const next = cargos.find(
        (item) =>
          item.lineIndex > cargo.lineIndex && !selectedKeys.includes(item.key),
      );
      const end = next ? next.lineIndex : lines.length;
      chunks.push(lines.slice(cargo.lineIndex, end).join("\n"));
    });
    return chunks.join("\n");
  }

  function parseSubjectsFromPdfText(text, selectedCargoKeys = []) {
    const scopedText = slicePdfTextForSelectedCargos(text, selectedCargoKeys);
    const lines = normalizePdfText(scopedText)
      .split("\n")
      .map(normalizePdfLine)
      .filter(Boolean);
    const subjects = [];
    let current = null;
    lines.forEach((line) => {
      const match = line.match(
        /^([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ0-9\s\/\-().]+)[:：]\s*(.*)$/,
      );
      const headerCandidate = match ? `${match[1]}:` : line;
      if (match && looksLikePdfSubjectHeader(headerCandidate)) {
        if (current) subjects.push(current);
        current = { subject: cleanPdfTopic(match[1]), body: match[2] || "" };
        return;
      }
      if (current) current.body += ` ${line}`;
    });
    if (current) subjects.push(current);

    const parsed = subjects
      .map((subject) => {
        const name = cleanPdfTopic(subject.subject);
        const topics = splitPdfTopics(subject.body);
        if (!name || topics.length === 0) return null;
        return { subject: name, weight: pdfSubjectWeightByName(name), topics };
      })
      .filter(Boolean);

    const merged = new Map();
    parsed.forEach((subject) => {
      const key = withoutAccents(subject.subject).toLowerCase();
      if (!merged.has(key)) merged.set(key, { ...subject, topics: [] });
      const currentSubject = merged.get(key);
      const existing = new Set(
        currentSubject.topics.map((topic) =>
          withoutAccents(topic).toLowerCase(),
        ),
      );
      subject.topics.forEach((topic) => {
        const topicKey = withoutAccents(topic).toLowerCase();
        if (!existing.has(topicKey)) {
          currentSubject.topics.push(topic);
          existing.add(topicKey);
        }
      });
    });

    return Array.from(merged.values()).filter(
      (subject) => subject.topics.length,
    );
  }

  async function extractTextFromPdfFile(file) {
    const pdfjsLib = await import(
      /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs"
    );
    if (pdfjsLib?.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
    }
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str || "").join(" ");
      pages.push(pageText);
    }
    return normalizePdfText(pages.join("\n"));
  }

  async function handleExamPdfFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPdfImportMessage("Lendo PDF do edital. Aguarde...");
    setPdfImportFileName(file.name);
    setPdfPreviewReady(false);
    setPdfCargoOptions([]);
    setSelectedPdfCargoKeys([]);
    try {
      const text = await extractTextFromPdfFile(file);
      if (!text || text.length < 100) throw new Error("empty-pdf-text");
      const cargos = detectCargosFromPdfText(text);
      setPdfImportText(text);
      setPdfCargoOptions(cargos);
      setSelectedPdfCargoKeys(cargos.length === 1 ? [cargos[0].key] : []);
      setPdfImportMessage(
        cargos.length
          ? `PDF lido. Encontrei ${cargos.length} possível(is) cargo(s). Selecione o cargo e gere a prévia.`
          : "PDF lido. Não encontrei cargos com segurança, mas você pode gerar a prévia com o texto completo.",
      );
    } catch (error) {
      setPdfImportMessage(
        "Não foi possível ler esse PDF no navegador. Tente outro PDF ou use Excel/CSV. PDFs escaneados/imagem precisam de OCR.",
      );
    }
    event.target.value = "";
  }

  function togglePdfCargoSelection(key) {
    setSelectedPdfCargoKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function generateExamPreviewFromPdf() {
    if (!pdfImportText)
      return setPdfImportMessage("Selecione e leia um PDF primeiro.");
    const selectedLabels = pdfCargoOptions
      .filter((cargo) => selectedPdfCargoKeys.includes(cargo.key))
      .map((cargo) => cargo.label);
    const subjects = parseSubjectsFromPdfText(
      pdfImportText,
      selectedPdfCargoKeys,
    );
    if (!subjects.length) {
      setPdfImportMessage(
        "Não consegui separar matérias e assuntos automaticamente. Use Manual ou Excel/CSV para revisar/cadastrar.",
      );
      return;
    }
    setExamForm((current) => ({
      ...current,
      label:
        current.label ||
        selectedLabels[0] ||
        pdfImportFileName.replace(/\.pdf$/i, ""),
      subjects,
    }));
    setPdfPreviewReady(true);
    setExamCreatorMode("manual");
    setExamCreatorMessage(
      `Prévia gerada com ${subjects.length} matéria(s). Revise abaixo e clique em salvar.`,
    );
    setPdfImportMessage(
      "Prévia gerada. Confira matérias, pesos e assuntos antes de salvar o edital.",
    );
  }

  function handleExamImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const data = new Uint8Array(loadEvent.target.result);

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          blankrows: false,
        });

        const groupedSubjects = new Map();
        const subjectWeights = new Map();

        let currentSubject = "";
        let currentWeight = "3";

        rows.forEach((row, index) => {
          const colA = String(row?.[0] || "").trim();
          const colB = String(row?.[1] || "").trim();
          const colC = String(row?.[2] || "").trim();
          const colD = String(row?.[3] || "").trim();

          if (index === 0 && colA.toLowerCase().includes("mat")) {
            return;
          }

          if (!colA && !colB && !colC && !colD) {
            return;
          }

          if (colA) {
            currentSubject = colA;
            currentWeight = colB || "3";
            subjectWeights.set(currentSubject, currentWeight);
          }

          if (!currentSubject || !colC) {
            return;
          }

          if (!groupedSubjects.has(currentSubject)) {
            groupedSubjects.set(currentSubject, []);
          }

          const priority = ["Alta", "Média", "Baixa"].includes(colD)
            ? colD
            : "Média";

          groupedSubjects.get(currentSubject).push({ text: colC, priority });
        });

        const subjects = Array.from(groupedSubjects.entries()).map(
          ([subject, topics]) => ({
            subject,
            weight: subjectWeights.get(subject) || "3",
            topics,
          }),
        );

        if (!subjects.length) {
          throw new Error("empty");
        }

        setExamForm((current) => ({
          ...current,
          subjects,
        }));

        setExamCreatorMode("manual");

        setExamCreatorMessage(
          `Arquivo importado com ${subjects.length} matéria(s). Revise e clique em Salvar.`,
        );
      } catch {
        setExamCreatorMessage(
          "Não foi possível importar. Use colunas: Matéria | Peso | Assunto | Prioridade.",
        );
      }

      event.target.value = "";
    };

    reader.readAsArrayBuffer(file);
  }

  function resetSystem() {
    openConfirmDialog({
      title: "Deseja resetar?",
      message:
        "Essa ação vai apagar o progresso, questões, erros, revisões, anotações e simulados salvos neste dispositivo.",
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "red",
      onConfirm: resetSystemNow,
    });
  }

  async function resetSystemNow() {
    // O reset deve remover também o edital importado/criado e os perfis salvos,
    // não apenas os registros de progresso.
    const fresh = createInitialState();
    const freshConfig = defaultScheduleConfig();
    const freshSettings = syncWeeklyQuestionsWithDaily(
      defaultSettings(),
      freshConfig,
    );
    const emptyProfileKey = storageKeyForExam(ACTIVE_EXAM_KEY);
    const resetState = {
      ...fresh,
      view: "dashboard",
      activeExamKey: ACTIVE_EXAM_KEY,
      storageProfileKey: emptyProfileKey,
      customExams: [],
      deletedBuiltInExamKeys: [],
      roadmap: [],
      schedule: [],
      weeklySchedule: [],
      errors: [],
      reviews: [],
      notes: [],
      questionSessions: [],
      simulatedTests: [],
      questionCarryovers: [],
      settings: freshSettings,
      scheduleConfig: freshConfig,
      currentStudyDayKey: TODAY_DAY_KEY,
      currentStudyWeek: 1,
      currentStudyIsoDate: TODAY,
    };

    activeTimerRef.current = null;
    setActiveBlockId(null);

    setSchedule([]);
    setWeeklySchedule([]);
    setRoadmap([]);
    setScheduleConfig(freshConfig);
    setCycleDraftConfig(freshConfig);
    setErrors([]);
    setReviews([]);
    setNotes([]);
    setQuestionSessions([]);
    setSimulatedTests([]);
    setQuestionCarryovers([]);
    setSettings(freshSettings);

    setCustomExams([]);
    setDeletedBuiltInExamKeys([]);
    setActiveExamKeyState(ACTIVE_EXAM_KEY);
    setStorageProfileKeyState(emptyProfileKey);

    setCurrentStudyDayKey(TODAY_DAY_KEY);
    setCurrentStudyWeek(1);
    setView("dashboard");
    setWeeklyDayFilter(TODAY_DAY_KEY);
    setWeeklyWeekFilter(1);
    setScheduleWeekFilter(1);
    setScheduleDayFilter("all");
    setScheduleSubjectFrequencyFilter("all");
    setRoadmapSubject("all");
    setRoadmapStatus("todos");
    setQuery("");
    setReviewFilter("atual");
    setErrorSubjectFilter("all");
    setErrorStatusFilter("pendentes");
    setErrorFormOpen(false);
    setErrorForm({ subjectId: "", topicId: "", error: "", fix: "" });
    setErrorFormMessage("");
    setCorrectionForm({ id: null, fix: "" });
    setEditingErrorId(null);
    setQuestionForm({
      subjectId: "",
      topicId: "",
      done: "",
      correct: "",
      time: "",
      notes: "",
    });
    setQuestionFilterSubject("all");
    setQuestionFilterTopic("all");
    setSimulatedForm({
      title: defaultSimulatedTitle([]),
      total: "",
      correct: "",
      essayScore: "",
      timeSpent: "",
      date: toBRDate(parseISODate(TODAY)),
      notes: "",
      subjects: {},
    });
    setSimulatedMessage("");
    setSimulatedCompareA("");
    setSimulatedCompareB("");
    setNoteForm({ subjectId: "", topicId: "", title: "", text: "" });
    setNoteFormOpen(false);
    setEditingNoteId(null);
    setNoteSubjectFilter("all");
    setNoteTopicFilter("all");
    setNoteSearch("");
    setNoteFormMessage("");
    setImportMode("manual");
    setImportForm({ subject: "", topics: [""] });
    setImportMessage("");
    setCompletionBlock(null);

    try {
      if (typeof window !== "undefined") {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith("study_app_state_cache__") ||
              key.startsWith("study_app_previous_day_question_alert_ack__"))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        localStorage.removeItem(ACTIVE_EXAM_LOCAL_KEY);
        localStorage.removeItem(LOCAL_CACHE_KEY);
        localStorage.removeItem(PREVIOUS_DAY_QUESTION_ALERT_ACK_KEY);
      }

      if (supabase) {
        // Apaga todos os registros vinculados a este perfil, incluindo o índice
        // que poderia reativar um edital antigo após F5.
        const { error: deleteError } = await supabase
          .from(SUPABASE_TABLE)
          .delete()
          .like("device_id", `${USER_PROFILE_KEY}__%`);

        if (deleteError) throw deleteError;

        // Grava um estado vazio explícito para que a hidratação não recupere
        // um estado antigo caso a tabela fique sem registro para o perfil-base.
        const saveResult = await saveStateToSupabase(resetState);
        if (!saveResult.ok) {
          throw saveResult.error || new Error("Não foi possível salvar o reset.");
        }
        setCloudStatus("Sistema resetado. Nenhum edital está ativo.");
      } else {
        saveStateToLocalCache(resetState);
        setCloudStatus("Sistema resetado no armazenamento local.");
      }
    } catch (error) {
      console.error("Erro ao resetar completamente o sistema:", error);
      setCloudStatus(
        "Reset local realizado, mas houve falha ao limpar/salvar no Supabase. Verifique o console e as permissões de exclusão.",
      );
    }
  }

  function restartCycleAtWeekOne() {
    openConfirmDialog({
      title: "Reiniciar ciclo no Ciclo 1?",
      message: `O ciclo será reiniciado hoje (${TODAY_LABEL}). O estudo do dia ficará no Ciclo 1, ${dayLabel(TODAY_DAY_KEY)}. Questões, erros, anotações e revisões não serão apagados.`,
      confirmLabel: "Sim",
      cancelLabel: "Não",
      tone: "amber",
      onConfirm: restartCycleAtWeekOneNow,
    });
  }

  function restartCycleAtWeekOneNow() {
    const nextSettings = { ...settings, studyStartDate: TODAY };
    const sourceWeekly = weeklySchedule.length
      ? weeklySchedule
      : buildTwelveWeekSchedule(
          roadmap,
          scheduleConfig,
          nextSettings,
          questionSessions,
        );
    const normalizedWeekly = withDistributedQuestionTargets(
      normalizeScheduleItems(sourceWeekly, scheduleConfig),
      scheduleConfig,
      roadmap,
    );
    const todayItems = scheduleFromWeekly(
      normalizedWeekly,
      roadmap,
      1,
      TODAY_DAY_KEY,
    );
    setSettings(nextSettings);
    setWeeklySchedule(normalizedWeekly);
    setSchedule(todayItems);
    setCurrentStudyDayKey(TODAY_DAY_KEY);
    setCurrentStudyWeek(1);
    setWeeklyDayFilter(TODAY_DAY_KEY);
    setWeeklyWeekFilter(1);
    setScheduleWeekFilter(1);
    setManualScheduleWeek(1);
    setReportWeekFilter(1);
    setScheduleDayFilter("all");
    setView("daily");
  }

  function buildBackupPayload() {
    const availableExamList = allAvailableExams(
      customExams,
      deletedBuiltInExamKeys,
    );
    const activeExam =
      availableExamList.find((exam) => exam.key === activeExamKeyState) ||
      findExamDefinition(activeExamKeyState, customExams);
    const normalizedState = {
      view,
      currentStudyDayKey,
      currentStudyWeek,
      schedule,
      weeklySchedule,
      roadmap,
      customExams,
      deletedBuiltInExamKeys,
      errors,
      reviews,
      notes,
      questionSessions,
      simulatedTests,
      questionCarryovers,
      settings,
      scheduleConfig,
      profileKey: USER_PROFILE_KEY,
      activeExamKey: activeExamKeyState,
      storageProfileKey: storageProfileKeyState,
      roadmapVersion:
        activeExam?.roadmapVersion ||
        (activeExamKeyState === ACTIVE_EXAM_KEY
          ? ROADMAP_VERSION
          : `CUSTOM_${activeExamKeyState.toUpperCase()}`),
    };

    return {
      backupVersion: "2.0",
      appName: "Sistema de Estudos",
      exportedAt: new Date().toISOString(),
      profileKey: USER_PROFILE_KEY,
      activeExamKey: activeExamKeyState,
      storageProfileKey: storageProfileKeyState,
      roadmapVersion: normalizedState.roadmapVersion,
      exam: {
        key: activeExamKeyState,
        title: activeExam?.title || settings.examTitle || "Edital ativo",
        examDate: settings.examDate || "",
        hasExamDate: Boolean(settings.examDate),
        isBuiltIn:
          activeExam?.source !== "custom" &&
          activeExamKeyState === ACTIVE_EXAM_KEY,
      },
      counts: {
        subjects: Array.isArray(roadmap) ? roadmap.length : 0,
        scheduleItems: Array.isArray(schedule) ? schedule.length : 0,
        weeklyScheduleItems: Array.isArray(weeklySchedule)
          ? weeklySchedule.length
          : 0,
        questionSessions: Array.isArray(questionSessions)
          ? questionSessions.length
          : 0,
        errors: Array.isArray(errors) ? errors.length : 0,
        reviews: Array.isArray(reviews) ? reviews.length : 0,
        notes: Array.isArray(notes) ? notes.length : 0,
        simulatedTests: Array.isArray(simulatedTests)
          ? simulatedTests.length
          : 0,
        customExams: Array.isArray(customExams) ? customExams.length : 0,
      },
      state: normalizedState,
    };
  }

  function exportBackup() {
    const payload = buildBackupPayload();
    const safeExamKey = String(payload.activeExamKey || "edital")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const dateKey = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-estudos-${safeExamKey || "edital"}-${dateKey}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const rawData = JSON.parse(String(loadEvent.target.result || "{}"));
        const data =
          rawData?.state && typeof rawData.state === "object"
            ? rawData.state
            : rawData;
        const importedActiveExamKey =
          rawData?.activeExamKey ||
          data.activeExamKey ||
          activeExamKeyState ||
          ACTIVE_EXAM_KEY;
        const importedStorageProfileKey =
          rawData?.storageProfileKey ||
          data.storageProfileKey ||
          storageKeyForExam(importedActiveExamKey);
        const importedCustomExams = normalizeCustomExamList(
          data.customExams || customExams,
        );
        const importedDeletedBuiltInExamKeys = normalizeDeletedBuiltInExamKeys(
          data.deletedBuiltInExamKeys || deletedBuiltInExamKeys,
        );
        const roadmapData = Array.isArray(data.roadmap)
          ? data.roadmap
          : clone(
              findExamDefinition(importedActiveExamKey, importedCustomExams)
                ?.roadmap || roadmapSeed,
            );
        const backupConfig = {
          ...defaultScheduleConfig(),
          ...(data.scheduleConfig || {}),
        };
        setActiveExamKeyState(importedActiveExamKey);
        setStorageProfileKeyState(importedStorageProfileKey);
        setLocalActiveExamKey(importedActiveExamKey);
        setCustomExams(importedCustomExams);
        setDeletedBuiltInExamKeys(importedDeletedBuiltInExamKeys);
        setRoadmap(roadmapData);
        setView(
          ["performance", "tomorrow", "final-stretch"].includes(data.view)
            ? "dashboard"
            : data.view || "dashboard",
        );
        setCurrentStudyDayKey(data.currentStudyDayKey || TODAY_DAY_KEY);
        setCurrentStudyWeek(
          Number(
            data.currentStudyWeek ||
              currentCycleWeek(SYSTEM_TODAY, data.settings?.studyStartDate),
          ),
        );
        setSchedule(
          hydrateSchedule(
            withDistributedQuestionTargets(
              normalizeScheduleItems(
                Array.isArray(data.schedule)
                  ? data.schedule
                  : todayScheduleFromWeekly(
                      fixedWeekOneScheduleFromRoadmap(
                        roadmapData,
                        backupConfig,
                      ),
                      roadmapData,
                    ),
                backupConfig,
              ),
              backupConfig,
              roadmapData,
            ),
            roadmapData,
          ),
        );
        setWeeklySchedule(
          removeRetroactiveItemsFromCurrentWeek(
            withDistributedQuestionTargets(
              normalizeScheduleItems(
                Array.isArray(data.weeklySchedule)
                  ? data.weeklySchedule
                  : fixedWeekOneScheduleFromRoadmap(roadmapData, backupConfig),
                backupConfig,
              ),
              backupConfig,
              roadmapData,
            ),
            data.settings?.studyStartDate || DEFAULT_STUDY_START_DATE,
          ),
        );
        setErrors(Array.isArray(data.errors) ? data.errors : []);
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setNotes(Array.isArray(data.notes) ? data.notes : []);
        setQuestionSessions(
          Array.isArray(data.questionSessions) ? data.questionSessions : [],
        );
        setSimulatedTests(
          Array.isArray(data.simulatedTests) ? data.simulatedTests : [],
        );
        setSettings({ ...defaultSettings(), ...(data.settings || {}) });
        setScheduleConfig(backupConfig);
        setCycleDraftConfig(backupConfig);
        setImportMessage("Backup restaurado com sucesso.");
      } catch {
        setImportMessage("Não foi possível importar o backup.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  const filteredReviewsLabels = [
    ["atual", "Atual"],
    ["vencidas", "Vencidas"],
    ["24 horas", "24 horas"],
    ["7 dias", "7 dias"],
    ["15 dias", "15 dias"],
    ["30 dias", "30 dias"],
    ["concluidas", "Concluídas"],
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f5eadb,transparent_32%),linear-gradient(135deg,#fafaf9,#f5f5f4_45%,#ede7de)] text-stone-950">
      <AnimatePresence>
        <VersionToast />
      </AnimatePresence>
      <ConfettiBurst active={celebration} />
      <div className="fixed left-5 bottom-5 z-[60] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-stone-200 bg-white/95 px-4 py-2 text-xs font-semibold text-stone-700 shadow-xl">
        {cloudStatus}
      </div>
      <AnimatePresence>
        {motivationOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-stone-950 text-amber-200">
                <Flame />
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-amber-900">
                Mensagem do dia
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-stone-950">
                {dailyMotivation}
              </h2>
              <button
                onClick={() => setMotivationOpen(false)}
                className="mt-5 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
              >
                Começar estudo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {completionBlock && (
        <CompletionModal
          block={completionBlock}
          form={completionForm}
          setForm={setCompletionForm}
          onClose={() => setCompletionBlock(null)}
          onConfirm={confirmCompletion}
        />
      )}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-700">
                <AlertTriangle />
              </div>
              <h2 className="mt-4 text-2xl font-black text-stone-950">
                {confirmDialog.title}
              </h2>
              {confirmDialog.message && (
                <p className="mt-2 text-sm font-semibold text-stone-600">
                  {confirmDialog.message}
                </p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={closeConfirmDialog}
                  className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-700 hover:bg-stone-50"
                >
                  {confirmDialog.cancelLabel || "Não"}
                </button>
                <button
                  onClick={confirmPendingAction}
                  className="rounded-2xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800"
                >
                  {confirmDialog.confirmLabel || "Sim"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {shouldShowPreviousDayQuestionGoalPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-700">
                <AlertTriangle />
              </div>
              <h2 className="mt-4 text-2xl font-black text-stone-950">
                Meta de questões do dia anterior
              </h2>
              <p className="mt-2 text-sm font-semibold text-stone-600">
                Você deixou questões pendentes em{" "}
                {previousDayQuestionGoalReport.label}.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-3">
                  <p className="text-xs font-semibold text-stone-500">Meta</p>
                  <p className="text-2xl font-black text-stone-950">
                    {previousDayQuestionGoalReport.plannedQuestions}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold text-emerald-700">
                    Feitas
                  </p>
                  <p className="text-2xl font-black text-emerald-700">
                    {previousDayQuestionGoalReport.doneQuestions}
                  </p>
                </div>
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700">Faltaram</p>
                  <p className="text-2xl font-black text-red-700">
                    {previousDayQuestionGoalReport.missingQuestions}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs font-bold text-stone-500">
                Data: {previousDayQuestionGoalReport.label}
              </p>
              <button
                onClick={dismissPreviousDayQuestionGoalPopup}
                className="mt-6 w-full rounded-2xl bg-stone-950 px-5 py-3 text-sm font-black text-white hover:bg-stone-800"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 p-3 shadow-sm backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900">
              Militar
            </p>
            <p className="text-sm font-black text-stone-950">Navegação</p>
          </div>
          <Badge tone="amber">{stats.progress}%</Badge>
        </div>

        <nav className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cls(
                "flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold transition",
                view === id
                  ? "bg-stone-950 text-white shadow-sm"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200",
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <aside className="fixed left-0 top-0 z-20 hidden h-dvh w-64 flex-col overflow-y-auto overscroll-contain border-r border-stone-200/80 bg-white/90 p-4 backdrop-blur-xl md:flex xl:w-72 xl:p-5">
        <div className="rounded-3xl bg-gradient-to-br from-stone-950 via-stone-800 to-amber-950 p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <Trophy />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber-100">
                Plano de estudos
              </p>
              <h1 className="text-xl font-black">Militar</h1>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-stone-200">
              <span>Progresso geral</span>
              <span>{stats.progress}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <div
                style={{ width: `${stats.progress}%` }}
                className="h-full rounded-full bg-amber-200"
              />
            </div>
          </div>
        </div>
        <nav className="mt-5 flex-1 space-y-1 pb-24">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cls(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition xl:px-4 xl:py-3",
                view === id
                  ? "bg-stone-950 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
              )}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="p-4 md:ml-64 md:p-6 xl:ml-72 xl:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 rounded-3xl border border-stone-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {TODAY_LABEL}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">
                {dashboardTitle}
              </h1>
              <p className="text-sm text-stone-500">
                Dashboard limpo, ciclo diário, revisão por peso, erros
                acionáveis e controle real de desempenho.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={stats.pendingErrors > 0 ? "red" : "green"}>
                {stats.pendingErrors} erros pendentes
              </Badge>
              <Badge tone="amber">
                Sequência: {stats.studyStreak} dia
                {stats.studyStreak === 1 ? "" : "s"}
              </Badge>
              <Badge tone="stone">Meta: {settings.dailyHours || 0}h/dia</Badge>
              {overdueStudyItems.length > 0 && (
                <Badge tone="red">
                  {overdueStudyItems.length} matéria(s) pendente(s) do dia
                  anterior
                </Badge>
              )}
            </div>
          </header>
          {view === "dashboard" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={Home}
                title="Painel geral"
                subtitle="Resumo do que importa para decidir o próximo estudo sem perder tempo."
              />
              {roadmap.length === 0 && (
                <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-stone-50 p-8 text-center">
                  <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-amber-900 px-4 py-2 text-white">
                    <FileSpreadsheet size={20} />
                    <span className="text-xs font-black uppercase tracking-[0.18em]">
                      Primeiro passo
                    </span>
                  </div>
                  <h2 className="mt-5 text-2xl font-black text-stone-950">
                    Crie ou importe o seu edital para começar
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm text-stone-600">
                    O sistema nasce vazio, sem matérias, assuntos ou cronograma.
                    Para iniciar seus estudos, cadastre o edital do seu concurso
                    manualmente ou importe a partir de uma planilha.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        resetExamCreatorForm();
                        setExamCreatorOpen(true);
                        setView("exam-switch");
                      }}
                      className="rounded-2xl bg-stone-950 px-6 py-3 font-bold text-white hover:bg-stone-800"
                    >
                      <Plus size={18} className="inline" /> Cadastrar edital
                    </button>
                    <button
                      onClick={() => {
                        resetExamCreatorForm();
                        setExamCreatorMode("arquivo");
                        setExamCreatorOpen(true);
                        setView("exam-switch");
                      }}
                      className="rounded-2xl border border-stone-300 bg-white px-6 py-3 font-bold text-stone-800 hover:bg-stone-50"
                    >
                      <Upload size={18} className="inline" /> Importar planilha
                    </button>
                  </div>
                </Card>
              )}
              {examCountdown.daysLeft !== null && (
                <Card
                  className={cls(
                    "overflow-hidden border p-0",
                    examCountdown.tone === "red"
                      ? "border-red-200 bg-red-50"
                      : examCountdown.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50",
                  )}
                >
                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">
                        Contagem regressiva da prova
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <p className="text-5xl font-black leading-none text-stone-950 md:text-6xl">
                          {examCountdown.daysLeft}
                        </p>
                        <div className="pb-1">
                          <p className="text-xl font-black text-stone-900">
                            {examCountdown.daysLeft === 1
                              ? "dia restante"
                              : "dias restantes"}
                          </p>
                          <p className="text-sm font-semibold text-stone-600">
                            Prova em {examCountdown.dateLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              {roadmap.length > 0 && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <Stat
                      icon={Target}
                      title="Progresso"
                      value={`${stats.progress}%`}
                      hint={`${roadmapStats.done} concluído(s) de ${roadmapStats.total} assunto(s)`}
                    />
                    <Stat
                      icon={CheckSquare}
                      title="Questões"
                      value={stats.questionsDone}
                      hint="total geral de questões"
                    />
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-stone-500">
                            Acertos/erros
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2 text-center">
                              <p className="text-xl font-black leading-none text-emerald-700">
                                {stats.questionsCorrect}
                              </p>
                              <p className="mt-1 text-[9px] font-bold uppercase leading-none tracking-normal text-emerald-700">
                                acertos
                              </p>
                            </div>
                            <div className="rounded-xl border border-red-100 bg-red-50 px-2 py-2 text-center">
                              <p className="text-xl font-black leading-none text-red-700">
                                {stats.questionsWrong}
                              </p>
                              <p className="mt-1 text-[9px] font-bold uppercase leading-none tracking-normal text-red-700">
                                erros
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 whitespace-nowrap text-[11px] font-semibold text-stone-500">
                            Aproveitamento: {stats.accuracy}%
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-950 p-2 text-white">
                          <CheckCircle2 size={16} />
                        </div>
                      </div>
                    </Card>
                    <Stat
                      icon={Clock}
                      title="Horas"
                      value={formatHours(stats.studiedSeconds)}
                      hint="tempo geral estudado até agora"
                    />
                    <Stat
                      icon={Flame}
                      title="Revisões"
                      value={reviews.length}
                      hint="geradas automaticamente"
                    />
                  </div>
                  <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
                    <Card className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <SectionTitle
                          icon={Zap}
                          title="O que estudar agora"
                          subtitle="Ordem adaptativa com base em peso, desempenho e pendências."
                        />
                        <Badge tone="amber">Aguardando desempenho</Badge>
                      </div>
                      <div className="mt-5 space-y-3">
                        {dashboardStudyItems.length === 0 ? (
                          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                            Todos os blocos de estudo de hoje foram concluídos.
                          </div>
                        ) : (
                          dashboardStudyItems.map((item) => (
                            <div
                              key={item.id}
                              className={cls(
                                "rounded-3xl border p-4 transition",
                                item.carryover
                                  ? "border-red-200 bg-red-50"
                                  : "border-stone-200 bg-stone-50/70",
                              )}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">
                                    {item.type} • {planAmountLabel(item)}
                                  </p>
                                  <h3 className="mt-1 font-black text-stone-950">
                                    {item.subject}
                                  </h3>
                                  <p className="text-sm text-stone-500">
                                    Assunto do dia: {item.topic}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    tone={
                                      item.status === "concluido"
                                        ? "green"
                                        : item.status === "andamento"
                                          ? "amber"
                                          : item.carryover
                                            ? "red"
                                            : "stone"
                                    }
                                  >
                                    {item.status === "concluido"
                                      ? "concluído"
                                      : item.carryover
                                        ? "pendente do dia anterior"
                                        : item.status}
                                  </Badge>
                                  <span className="rounded-2xl bg-white px-3 py-2 font-mono text-sm text-stone-700">
                                    {formatElapsed(item.elapsedSeconds)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                    <Card className="p-5">
                      <SectionTitle
                        icon={AlertTriangle}
                        title="Alertas inteligentes"
                        subtitle="Pendências que podem atrapalhar sua evolução."
                      />
                      <div className="mt-5 space-y-3">
                        {overdueStudyItems.length > 0 && (
                          <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-800">
                            <b>Pendentes do dia anterior:</b>{" "}
                            {overdueStudyItems.length} pendente(s) de{" "}
                            {overdueStudyItems[0].carryoverFrom}. Priorize antes
                            do estudo normal do dia.
                          </div>
                        )}
                        {overdueReviews.length > 0 && (
                          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                            <b>Revisões vencidas:</b>
                            <div className="mt-3 space-y-2">
                              {overdueReviews.slice(0, 4).map((review) => (
                                <div
                                  key={review.id}
                                  className="rounded-2xl bg-white/70 px-3 py-2"
                                >
                                  <p className="font-black">{review.title}</p>
                                  <p className="text-xs font-semibold">
                                    {review.type} • {review.date}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {overdueReviews.length > 4 && (
                              <p className="mt-2 text-xs font-bold">
                                +{overdueReviews.length - 4} revisão(ões)
                                vencida(s)
                              </p>
                            )}
                          </div>
                        )}
                        {todayReviews.length > 0 && (
                          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <b>Revisões de hoje</b>
                              <Badge tone="amber">
                                {todayReviews.length} hoje
                              </Badge>
                            </div>
                            <div className="mt-3 space-y-2">
                              {todayReviews.slice(0, 5).map((review) => (
                                <div
                                  key={review.id}
                                  className="rounded-2xl bg-white/80 px-3 py-2"
                                >
                                  <p className="font-black">{review.title}</p>
                                  <p className="text-xs font-semibold">
                                    {review.type} • {review.date}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {todayReviews.length > 5 && (
                              <p className="mt-2 text-xs font-bold">
                                +{todayReviews.length - 5} revisão(ões) de hoje
                              </p>
                            )}
                          </div>
                        )}
                        {completedTodayReviews.length > 0 && (
                          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <b>Revisões de hoje concluídas</b>
                              <Badge tone="green">
                                {completedTodayReviews.length} concluída(s)
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs font-semibold">
                              As revisões de hoje já foram feitas. Abaixo
                              aparece apenas a próxima revisão futura.
                            </p>
                          </div>
                        )}
                        {overdueReviews.length === 0 &&
                          todayReviews.length === 0 &&
                          nextPendingReview && (
                            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <b>Próxima revisão</b>
                              </div>
                              <div className="mt-3 rounded-2xl bg-white/80 px-3 py-2">
                                <p className="font-black">
                                  {nextPendingReview.title}
                                </p>
                                <p className="text-xs font-semibold">
                                  {nextPendingReview.type} •{" "}
                                  {nextPendingReview.date}
                                </p>
                              </div>
                            </div>
                          )}
                        {overdueReviews.length === 0 &&
                          todayReviews.length === 0 &&
                          !nextPendingReview && (
                            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                              <b>Sistema zerado:</b> comece pelo primeiro bloco
                              do Estudo do Dia.
                            </div>
                          )}
                        <div
                          className={cls(
                            "rounded-3xl border p-4 text-sm",
                            dailyQuestionGoalReport.missingQuestions === 0 &&
                              dailyQuestionGoalReport.plannedQuestions > 0
                              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-900",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <b>Meta de questões de hoje</b>
                            <Badge
                              tone={
                                dailyQuestionGoalReport.missingQuestions ===
                                  0 &&
                                dailyQuestionGoalReport.plannedQuestions > 0
                                  ? "green"
                                  : "amber"
                              }
                            >
                              {dailyQuestionGoalReport.percent}%
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-2xl bg-white/80 p-3">
                              <p className="text-xs font-semibold">Meta</p>
                              <p className="text-xl font-black">
                                {dailyQuestionGoalReport.plannedQuestions}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-3">
                              <p className="text-xs font-semibold">Feitas</p>
                              <p className="text-xl font-black">
                                {dailyQuestionGoalReport.doneQuestions}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 p-3">
                              <p className="text-xs font-semibold">Faltam</p>
                              <p className="text-xl font-black">
                                {dailyQuestionGoalReport.missingQuestions}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </motion.section>
          )}
          {view === "today" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={CalendarDays}
                title={`Estudo do Dia • ${dayLabel(currentStudyDayKey)} • Ciclo ${currentStudyWeek}`}
                subtitle="Iniciar roda o cronômetro do bloco; concluir abre o registro final do assunto."
              />
              <Card className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-stone-950">
                      Controle manual do dia
                    </p>
                    <p className="text-xs font-semibold text-stone-500">
                      Se um bloco ficou para trás, avance manualmente e ele
                      entrará como pendente do dia anterior.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      onClick={rescuePreviousDayPendencies}
                      className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-amber-800 shadow-sm hover:bg-amber-50"
                    >
                      Resgatar pendências para hoje
                    </button>
                    <button
                      onClick={moveStudyToNextDay}
                      className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-amber-700"
                    >
                      Mudar para o próximo dia
                    </button>
                  </div>
                </div>
              </Card>
              <div className="grid gap-4">
                {schedule.map((item) => (
                  <StudyCard
                    key={item.id}
                    completed={item.status === "concluido"}
                    className={cls(
                      "p-5",
                      item.carryover &&
                        item.status !== "concluido" &&
                        "border-red-200 bg-red-50",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              item.status === "concluido"
                                ? "green"
                                : item.status === "andamento"
                                  ? "amber"
                                  : item.carryover
                                    ? "red"
                                    : "stone"
                            }
                          >
                            {item.carryover
                              ? "pendente do dia anterior"
                              : item.status}
                          </Badge>
                          <Badge>{item.type}</Badge>
                          {item.carryover && (
                            <Badge tone="red">
                              {item.carryoverLabel ||
                                `pendente de ${item.carryoverFrom}`}
                            </Badge>
                          )}
                          <span className="text-xs font-semibold text-stone-400">
                            {item.minutes} minutos • {item.questionsTarget || 0}{" "}
                            questões planejadas
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-black">
                          {item.subject}
                        </h3>
                        <p className="text-sm text-stone-700">
                          Assunto do dia: {item.topic}
                        </p>
                        {item.carryover && item.status !== "concluido" && (
                          <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-red-700">
                            Pendente do dia anterior — concluir antes do estudo
                            normal.
                          </p>
                        )}
                        {item.carryover && item.status === "concluido" && (
                          <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-emerald-700">
                            Pendência resolvida neste ciclo.
                          </p>
                        )}
                        {item.completedFromCarryover && (
                          <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-emerald-700">
                            Esse atraso foi concluído na{" "}
                            {item.completedFromCarryoverDay}, dia{" "}
                            {item.completedFromCarryoverAt}.
                          </p>
                        )}
                        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                          <Progress
                            value={
                              item.status === "concluido"
                                ? 100
                                : item.status === "andamento"
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (item.elapsedSeconds /
                                          Math.max(1, item.minutes * 60)) *
                                          100,
                                      ),
                                    )
                                  : 0
                            }
                          />
                          <div
                            className={cls(
                              "rounded-2xl border px-4 py-2 font-mono text-sm font-bold",
                              item.status === "concluido"
                                ? "border-emerald-300 bg-white text-stone-950"
                                : "border-stone-200 bg-white text-stone-700",
                            )}
                          >
                            {formatElapsed(item.elapsedSeconds)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => startBlock(item.id)}
                          disabled={item.status === "concluido"}
                          className="rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white disabled:opacity-40"
                        >
                          <Play size={16} className="inline" />{" "}
                          {item.status === "andamento" ? "Iniciado" : "Iniciar"}
                        </button>
                        <button
                          onClick={() => pauseBlock(item.id)}
                          disabled={item.status !== "andamento"}
                          className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold disabled:opacity-40"
                        >
                          <Pause size={16} className="inline" /> Pausar
                        </button>
                        <button
                          onClick={() => openCompletionModal(item.id)}
                          disabled={item.status === "concluido"}
                          className="rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
                        >
                          {item.status === "concluido"
                            ? "Concluído"
                            : "Concluir"}
                        </button>
                        <button
                          onClick={() => resetBlock(item.id)}
                          className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 font-semibold text-red-700"
                        >
                          Resetar
                        </button>
                      </div>
                    </div>
                  </StudyCard>
                ))}
              </div>
            </motion.section>
          )}
          {view === "weekly" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={CalendarDays}
                title="Planejamento do Ciclo"
                subtitle="Veja o cronograma por ciclo e por dia, com matérias e assuntos planejados."
              />
              <Card className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setWeeklyDayFilter(key)}
                        className={cls(
                          "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                          weeklyDayFilter === key
                            ? "border-stone-950 bg-stone-950 text-white"
                            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                        )}
                      >
                        {key === TODAY_DAY_KEY ? `${label} - Hoje` : label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={weeklyWeekFilter}
                    onChange={(event) =>
                      setWeeklyWeekFilter(Number(event.target.value))
                    }
                    className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    {WEEK_NUMBERS.map((week) => (
                      <option key={week} value={week}>
                        Ciclo {week}
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
              <div className="grid gap-4 md:grid-cols-3">
                <Stat
                  icon={CalendarDays}
                  title="Ciclo/Dia"
                  value={`S${weeklyWeekFilter} • ${selectedWeeklyDay.label}`}
                  hint="filtro atual"
                />
                <Stat
                  icon={AlertTriangle}
                  title="Em atraso"
                  value={
                    selectedWeeklyDay.items.filter(
                      (item) => item.carryover && item.status !== "concluido",
                    ).length
                  }
                  hint="pendências ainda abertas"
                />
                <Stat
                  icon={Clock}
                  title="Tempo previsto"
                  value={`${selectedWeeklyDay.items.reduce((sum, item) => sum + Number(item.minutes || 0), 0)}min`}
                  hint="estimativa do dia"
                />
              </div>
              <div className="grid gap-4">
                {selectedWeeklyDay.items.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-stone-500">
                    Nenhum bloco planejado para {selectedWeeklyDay.label} na
                    ciclo {weeklyWeekFilter}. Gere o ciclo na aba Cronograma.
                  </Card>
                ) : (
                  selectedWeeklyDay.items.map((item) => (
                    <Card
                      key={`${selectedWeeklyDay.key}-${item.id}-${item.carryover ? "carry" : "base"}`}
                      className={cls(
                        "p-5",
                        item.carryover &&
                          "border-2 border-red-200 bg-red-50 shadow-sm ring-1 ring-red-100",
                        item.status === "concluido" &&
                          "border-emerald-200 bg-emerald-50",
                      )}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              tone={
                                item.status === "concluido"
                                  ? "green"
                                  : item.carryover
                                    ? "red"
                                    : "stone"
                              }
                            >
                              {item.status === "concluido"
                                ? "concluído"
                                : item.carryover
                                  ? "pendente do dia anterior"
                                  : item.status || "planejado"}
                            </Badge>
                            <Badge>{item.type}</Badge>
                            {item.carryover && item.status !== "concluido" && (
                              <Badge tone="red">
                                {item.carryoverLabel ||
                                  `pendente de ${item.carryoverFrom}`}
                              </Badge>
                            )}
                            {item.carryover && item.status === "concluido" && (
                              <Badge tone="green">atraso resolvido</Badge>
                            )}
                            {item.completedFromCarryover && (
                              <Badge tone="green">
                                concluído na {item.completedFromCarryoverDay} •{" "}
                                {item.completedFromCarryoverAt}
                              </Badge>
                            )}
                          </div>
                          <h3 className="mt-3 text-xl font-black text-stone-950">
                            {item.subject}
                          </h3>
                          <p className="text-sm text-stone-600">{item.topic}</p>
                          {item.carryover && item.status !== "concluido" && (
                            <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-red-700">
                              Pendente do dia anterior — concluir antes do
                              estudo normal.
                            </p>
                          )}
                          {item.carryover && item.status === "concluido" && (
                            <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-emerald-700">
                              Atraso resolvido neste ciclo.
                            </p>
                          )}
                          {item.completedFromCarryover && (
                            <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-emerald-700">
                              Esse atraso foi concluído na{" "}
                              {item.completedFromCarryoverDay}, dia{" "}
                              {item.completedFromCarryoverAt}.
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-stone-950">
                            {planAmountLabel(item)}
                          </p>
                          <p className="text-xs font-semibold text-stone-500">
                            tempo e questões planejadas
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </motion.section>
          )}
          {view === "schedule" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={Clock}
                title="Cronograma"
                subtitle="Cronograma de 12 ciclos gerado automaticamente, sem repetir assuntos antes de fechar o ciclo da matéria."
              />
              <Card className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-black">Ciclo do cronograma</h3>
                    <p className="text-sm text-stone-500">
                      Escolha o ciclo que deseja gerar ou visualizar.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={scheduleWeekFilter}
                      onChange={(event) =>
                        setScheduleWeekFilter(
                          event.target.value === "all"
                            ? "all"
                            : Number(event.target.value),
                        )
                      }
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold"
                    >
                      <option value="all">Todos os ciclos</option>
                      {WEEK_NUMBERS.map((week) => (
                        <option key={week} value={week}>
                          Ciclo {week}
                        </option>
                      ))}
                    </select>
                    <select
                      value={scheduleDayFilter}
                      onChange={(event) =>
                        setScheduleDayFilter(event.target.value)
                      }
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold"
                    >
                      <option value="all">Todos os dias</option>
                      {STUDY_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {dayLabel(day)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
              <div className="grid gap-4 md:grid-cols-4">
                <Stat
                  icon={BookOpen}
                  title="Matérias por dia"
                  value={scheduleConfig.subjectsPerDay}
                  hint="definido nas configurações"
                />
                <Stat
                  icon={Clock}
                  title="Tempo de estudo"
                  value={`${scheduleConfig.dailyStudyMinutes}min`}
                  hint="tempo diário planejado"
                />
                <Stat
                  icon={CheckSquare}
                  title="Questões do dia"
                  value={`${dailyQuestionTarget(scheduleConfig)} questões`}
                  hint="divididas entre as matérias do dia"
                />
                <Stat
                  icon={BarChart3}
                  title="Modo"
                  value={scheduleConfig.mode === "peso" ? "Peso" : "Manual"}
                  hint="geração do ciclo"
                />
              </div>
              <Card className="overflow-hidden p-0">
                <div className="border-b border-stone-200 bg-white p-5">
                  <SectionTitle
                    icon={CalendarDays}
                    title="Tabela do ciclo no cronograma"
                    subtitle="Visão rápida dos assuntos por dia."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <p className="w-full text-sm font-semibold text-stone-500">
                      {scheduleWeekFilter === "all"
                        ? `Mostrando o ciclo atual: Ciclo ${effectiveCycleWeek}`
                        : `Mostrando a Ciclo ${scheduleWeekFilter}`}
                    </p>
                    <button
                      onClick={() =>
                        openManualScheduleEditor(
                          scheduleWeekFilter === "all"
                            ? effectiveCycleWeek
                            : Number(scheduleWeekFilter),
                        )
                      }
                      className="rounded-2xl bg-stone-950 px-4 py-2 text-sm font-bold text-white"
                    >
                      <Edit3 size={15} className="inline" /> Editar cronograma
                    </button>
                    <button
                      onClick={() => {
                        const targetWeek =
                          scheduleWeekFilter === "all"
                            ? effectiveCycleWeek + 1
                            : Number(scheduleWeekFilter) + 1;
                        openManualScheduleEditor(
                          Math.min(12, Math.max(1, targetWeek)),
                        );
                        setManualScheduleDraft(
                          suggestedManualDraftForWeek(
                            Math.min(12, Math.max(1, targetWeek)),
                          ),
                        );
                      }}
                      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-950"
                    >
                      Sugerir próximo ciclo
                    </button>
                  </div>
                </div>
                {(() => {
                  const tableWeek =
                    scheduleWeekFilter === "all"
                      ? effectiveCycleWeek
                      : Number(scheduleWeekFilter);
                  const dayEntries = WEEK_DAYS.map(([dayKey, label]) => {
                    const items = effectiveWeeklySchedule.filter(
                      (item) =>
                        Number(item.week) === Number(tableWeek) &&
                        item.dayKey === dayKey,
                    );
                    return { dayKey, label, items };
                  });
                  const maxRows = Math.max(
                    1,
                    ...dayEntries.map((entry) => entry.items.length),
                  );
                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-[980px] w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-stone-950 text-white">
                            {dayEntries.map((entry) => (
                              <th
                                key={entry.dayKey}
                                className="border-r border-white/10 px-4 py-3 text-sm font-black"
                              >
                                {entry.label}
                                {entry.dayKey === TODAY_DAY_KEY && (
                                  <span className="ml-2 rounded-full bg-white/15 px-2 py-1 text-[10px] uppercase tracking-wide">
                                    Hoje
                                  </span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: maxRows }, (_, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className="border-b border-stone-100"
                            >
                              {dayEntries.map((entry) => {
                                const item = entry.items[rowIndex];
                                return (
                                  <td
                                    key={`${entry.dayKey}-${rowIndex}`}
                                    className="w-[14.28%] align-top border-r border-stone-100 bg-white p-4"
                                  >
                                    {item ? (
                                      <div
                                        className={cls(
                                          "rounded-2xl border p-3",
                                          item.carryover
                                            ? "border-red-200 bg-red-50"
                                            : item.status === "concluido"
                                              ? "border-emerald-200 bg-emerald-50"
                                              : "border-stone-200 bg-stone-50",
                                        )}
                                      >
                                        <div className="flex flex-wrap gap-2">
                                          {item.carryover && (
                                            <Badge tone="red">
                                              Pendente do dia anterior
                                            </Badge>
                                          )}
                                          {item.status === "concluido" && (
                                            <Badge tone="green">
                                              Concluído
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="mt-2 text-sm font-black text-stone-950">
                                          {item.subject}
                                        </p>
                                        <p className="mt-1 text-xs font-semibold leading-relaxed text-stone-600">
                                          {item.topic}
                                        </p>
                                      </div>
                                    ) : (
                                      <div
                                        className="min-h-[1px]"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>
              {manualScheduleMessage && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">
                  {manualScheduleMessage}
                </div>
              )}
              {manualScheduleOpen && (
                <Card className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <SectionTitle
                        icon={Edit3}
                        title="Editar cronograma manual"
                        subtitle={`Ciclo ${manualScheduleWeek}: escolha somente as matérias de segunda a sábado. Os assuntos são gerados automaticamente e o domingo fica fixo.`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={manualScheduleWeek}
                        onChange={(event) => {
                          const week = Number(event.target.value);
                          setManualScheduleWeek(week);
                          setManualScheduleDraft(draftFromWeek(week));
                          setManualScheduleMessage("");
                        }}
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold"
                      >
                        {WEEK_NUMBERS.map((week) => (
                          <option key={week} value={week}>
                            Ciclo {week}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={applyPerformanceSuggestionToManualDraft}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
                      >
                        Sugerir por desempenho
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-400">
                      Domingo fixo
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {MANUAL_SPECIAL_BLOCKS.map((special) => (
                        <div
                          key={special.id}
                          className="rounded-2xl border border-stone-200 bg-white p-3"
                        >
                          <p className="text-sm font-black text-stone-950">
                            {special.subject}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-stone-600">
                            {special.id === "planejamento"
                              ? `Gerar e ajustar o Ciclo ${Number(manualScheduleWeek) + 1}`
                              : special.topic}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-[980px] w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-stone-950 text-white">
                          {WEEK_DAYS.filter(
                            ([dayKey]) => dayKey !== "domingo",
                          ).map(([dayKey, label]) => (
                            <th
                              key={dayKey}
                              className="border-r border-white/10 px-4 py-3 text-sm font-black"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          { length: subjectsPerDaySlots() },
                          (_, slotIndex) => (
                            <tr
                              key={slotIndex}
                              className="border-b border-stone-100"
                            >
                              {WEEK_DAYS.filter(
                                ([dayKey]) => dayKey !== "domingo",
                              ).map(([dayKey]) => {
                                const slot = manualScheduleDraft?.[dayKey]?.[
                                  slotIndex
                                ] || {
                                  subjectId: "",
                                  topicId: "",
                                };
                                return (
                                  <td
                                    key={`${dayKey}-${slotIndex}`}
                                    className="w-[16.66%] align-top border-r border-stone-100 bg-white p-3"
                                  >
                                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-stone-400">
                                      Bloco {slotIndex + 1}
                                    </p>
                                    <select
                                      value={slot.subjectId}
                                      onChange={(event) =>
                                        updateManualScheduleDraft(
                                          dayKey,
                                          slotIndex,
                                          "subjectId",
                                          event.target.value,
                                        )
                                      }
                                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                                    >
                                      <option value="">Sem bloco</option>
                                      {subjectsList.map((subject) => (
                                        <option
                                          key={subject.id}
                                          value={subject.id}
                                        >
                                          {subject.name}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="mt-2 text-[11px] font-semibold leading-relaxed text-stone-500">
                                      O assunto será escolhido automaticamente
                                      ao salvar.
                                    </p>
                                  </td>
                                );
                              })}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      onClick={copyManualWeekToNext}
                      className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700"
                    >
                      Copiar para o próximo ciclo
                    </button>
                    <button
                      onClick={() => setManualScheduleOpen(false)}
                      className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveManualSchedule}
                      className="rounded-2xl bg-stone-950 px-5 py-3 text-sm font-bold text-white"
                    >
                      <Save size={16} className="inline" /> Salvar cronograma
                      manual
                    </button>
                  </div>
                </Card>
              )}
              <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
                <Card className="p-5">
                  <SectionTitle
                    icon={Target}
                    title="Frequência por matéria"
                    subtitle={
                      scheduleWeekFilter === "all"
                        ? "Veja quantas vezes cada matéria aparece nos 12 ciclos."
                        : "Veja quantas vezes cada matéria aparece no ciclo selecionado."
                    }
                  />
                  <div className="mt-5 space-y-4">
                    <select
                      value={scheduleSubjectFrequencyFilter}
                      onChange={(event) =>
                        setScheduleSubjectFrequencyFilter(event.target.value)
                      }
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                    >
                      <option value="all">Todas as matérias</option>
                      {subjectsList.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    {selectedScheduleSubjectFrequency ? (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="amber">
                                Peso {selectedScheduleSubjectFrequency.weight}
                              </Badge>
                              <Badge>
                                {selectedScheduleSubjectFrequency.count} vez(es)
                                no ciclo
                              </Badge>
                            </div>
                            <h3 className="mt-3 text-xl font-black text-stone-950">
                              {selectedScheduleSubjectFrequency.name}
                            </h3>
                            <p className="text-sm text-amber-900">
                              {scheduleWeekFilter === "all"
                                ? "Todos os ciclos"
                                : `Ciclo ${scheduleWeekFilter}`}
                            </p>
                          </div>
                          <p className="text-4xl font-black text-amber-950">
                            {selectedScheduleSubjectFrequency.count}
                          </p>
                        </div>
                        <div
                          className={cls(
                            "mt-4 rounded-2xl border p-4 text-sm font-semibold",
                            selectedScheduleSubjectFrequency.cycle.completed
                              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                              : "border-red-100 bg-red-50 text-red-700",
                          )}
                        >
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              tone={
                                selectedScheduleSubjectFrequency.cycle.completed
                                  ? "green"
                                  : "red"
                              }
                            >
                              {
                                selectedScheduleSubjectFrequency.cycle
                                  .coveredTopics
                              }
                              /
                              {
                                selectedScheduleSubjectFrequency.cycle
                                  .totalTopics
                              }{" "}
                              tópicos cobertos
                            </Badge>
                            <Badge>
                              {selectedScheduleSubjectFrequency.cycle.percent}%
                              do edital
                            </Badge>
                            {selectedScheduleSubjectFrequency.cycle
                              .completed && (
                              <Badge tone="green">ciclo zerado</Badge>
                            )}
                          </div>
                          <p className="mt-3">
                            {cycleCoverageMessage(
                              getSubject(
                                roadmap,
                                selectedScheduleSubjectFrequency.id,
                              ),
                              selectedScheduleSubjectFrequency.items,
                              scheduleWeekFilter === "all"
                                ? "nos 12 ciclos"
                                : `no ciclo ${scheduleWeekFilter}`,
                            )}
                          </p>
                        </div>
                        {(() => {
                          const subjectData = getSubject(
                            roadmap,
                            selectedScheduleSubjectFrequency.id,
                          );
                          const details = subjectCycleTopicDetails(
                            subjectData,
                            selectedScheduleSubjectFrequency.items,
                          );
                          return (
                            <div className="mt-4 rounded-3xl border border-stone-200 bg-white/80 p-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <h4 className="font-black text-stone-950">
                                    Tópicos fora do ciclo filtrado
                                  </h4>
                                  <p className="text-sm text-stone-500">
                                    Aqui aparece exatamente o que não entrou no
                                    cronograma selecionado. Você pode priorizar
                                    um deles trocando por um tópico já
                                    planejado.
                                  </p>
                                </div>
                                <Badge
                                  tone={
                                    details.missingTopics.length
                                      ? "red"
                                      : "green"
                                  }
                                >
                                  {details.missingTopics.length} fora
                                </Badge>
                              </div>
                              {details.missingTopics.length === 0 ? (
                                <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                                  Nenhum tópico ficou de fora nesse filtro.
                                </div>
                              ) : (
                                <div className="mt-4 space-y-3">
                                  {details.missingTopics.map((topic) => (
                                    <div
                                      key={topic.id}
                                      className="rounded-2xl border border-red-100 bg-red-50 p-3"
                                    >
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                          <div className="flex flex-wrap gap-2">
                                            <Badge tone="red">
                                              fora dos 12 ciclos
                                            </Badge>
                                            <Badge>{topic.priority}</Badge>
                                            <Badge>{topic.difficulty}</Badge>
                                          </div>
                                          <p className="mt-2 font-black text-stone-950">
                                            {topic.title}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() =>
                                            setPrioritySwap((current) => ({
                                              ...current,
                                              missingTopicId: topic.id,
                                            }))
                                          }
                                          className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
                                        >
                                          Priorizar este tópico
                                        </button>
                                      </div>
                                      {prioritySwap.missingTopicId ===
                                        topic.id && (
                                        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3">
                                          <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                                            Escolha qual tópico planejado será
                                            removido
                                          </label>
                                          <select
                                            value={prioritySwap.replaceItemId}
                                            onChange={(event) =>
                                              setPrioritySwap((current) => ({
                                                ...current,
                                                replaceItemId:
                                                  event.target.value,
                                              }))
                                            }
                                            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"
                                          >
                                            <option value="">
                                              Remover o último tópico planejado
                                              dessa matéria
                                            </option>
                                            {details.plannedItems.map(
                                              (item) => (
                                                <option
                                                  key={item.id}
                                                  value={item.id}
                                                >
                                                  Ciclo {item.week} •{" "}
                                                  {dayLabel(item.dayKey)} •{" "}
                                                  {item.topic}
                                                </option>
                                              ),
                                            )}
                                          </select>
                                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                                            <button
                                              onClick={() =>
                                                setPrioritySwap({
                                                  missingTopicId: "",
                                                  replaceItemId: "",
                                                })
                                              }
                                              className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              onClick={() =>
                                                prioritizeMissingTopic(
                                                  selectedScheduleSubjectFrequency.id,
                                                  topic.id,
                                                  prioritySwap.replaceItemId,
                                                )
                                              }
                                              className="cursor-pointer rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                                            >
                                              Confirmar troca
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {prioritySwapMessage && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                                  {prioritySwapMessage}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div className="mt-4 space-y-2">
                          {selectedScheduleSubjectFrequency.items.length ===
                          0 ? (
                            <div className="rounded-2xl bg-white/70 p-4 text-sm text-stone-500">
                              Essa matéria não aparece neste ciclo.
                            </div>
                          ) : (
                            selectedScheduleSubjectFrequency.items.map(
                              (item) => (
                                <div
                                  key={item.id}
                                  className="rounded-2xl border border-amber-100 bg-white/80 p-3 text-sm"
                                >
                                  <b>
                                    {item.dayLabel || dayLabel(item.dayKey)}
                                  </b>
                                  <p className="text-stone-600">{item.topic}</p>
                                </div>
                              ),
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {scheduleSubjectFrequency.map((subject) => (
                          <div
                            key={subject.id}
                            className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge tone="amber">
                                    Peso {subject.weight}
                                  </Badge>
                                  <Badge>{subject.count} vez(es)</Badge>
                                  <Badge
                                    tone={
                                      subject.cycle.completed ? "green" : "red"
                                    }
                                  >
                                    {subject.cycle.coveredTopics}/
                                    {subject.cycle.totalTopics} tópicos
                                  </Badge>
                                </div>
                                <h3 className="mt-2 font-black text-stone-950">
                                  {subject.name}
                                </h3>
                                <p
                                  className={cls(
                                    "mt-1 text-xs font-semibold",
                                    subject.cycle.completed
                                      ? "text-emerald-700"
                                      : "text-red-700",
                                  )}
                                >
                                  {subject.cycle.completed
                                    ? `Zera na S${subject.cycle.completedAtItem.week} • ${dayLabel(subject.cycle.completedAtItem.dayKey)}`
                                    : `Não zera: faltam ${subject.cycle.missingTopics} tópico(s)`}
                                </p>
                              </div>
                              <p className="text-3xl font-black text-stone-950">
                                {subject.count}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
                <Card className="p-5">
                  <SectionTitle
                    icon={CalendarDays}
                    title="Cronograma gerado"
                    subtitle={
                      scheduleWeekFilter === "all"
                        ? "Veja todos os blocos planejados nos 12 ciclos."
                        : "Veja todos os blocos planejados para o ciclo selecionado."
                    }
                  />
                  <div className="mt-4 grid gap-3">
                    {effectiveWeeklySchedule.filter(
                      (item) =>
                        (scheduleWeekFilter === "all" ||
                          Number(item.week) === Number(scheduleWeekFilter)) &&
                        (scheduleDayFilter === "all" ||
                          item.dayKey === scheduleDayFilter),
                    ).length === 0 ? (
                      <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                        Nenhum cronograma gerado para{" "}
                        {scheduleWeekFilter === "all"
                          ? "os 12 ciclos"
                          : `o ciclo ${scheduleWeekFilter}`}
                        .
                      </div>
                    ) : (
                      effectiveWeeklySchedule
                        .filter(
                          (item) =>
                            (scheduleWeekFilter === "all" ||
                              Number(item.week) ===
                                Number(scheduleWeekFilter)) &&
                            (scheduleDayFilter === "all" ||
                              item.dayKey === scheduleDayFilter),
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className={cls(
                              "rounded-2xl border p-4",
                              item.carryover
                                ? "border-red-200 bg-red-50"
                                : "border-stone-200 bg-stone-50",
                            )}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge
                                    tone={item.carryover ? "red" : "amber"}
                                  >
                                    {scheduleWeekFilter === "all"
                                      ? `S${item.week} • ${item.dayLabel || dayLabel(item.dayKey)}`
                                      : item.dayLabel || dayLabel(item.dayKey)}
                                  </Badge>
                                  <Badge>{item.type}</Badge>
                                  <Badge
                                    tone={
                                      item.status === "concluido"
                                        ? "green"
                                        : item.carryover
                                          ? "red"
                                          : "stone"
                                    }
                                  >
                                    {item.carryover
                                      ? "pendente do dia anterior"
                                      : item.status}
                                  </Badge>
                                  {item.plannedWeight && (
                                    <Badge>Peso {item.plannedWeight}</Badge>
                                  )}
                                </div>
                                <h3 className="mt-2 font-black text-stone-950">
                                  {item.subject}
                                </h3>
                                <p className="text-sm text-stone-600">
                                  {item.topic}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-black text-stone-950">
                                  {planAmountLabel(item)}
                                </p>
                                <p className="text-xs text-stone-500">
                                  planejado
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </Card>
              </div>
              <Card className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-black">
                      Gerar cronograma de 12 ciclos
                    </h3>
                    <p className="text-sm text-stone-500">
                      A geração usa peso, cobertura de matérias, assuntos ainda
                      não estudados e baixo desempenho em questões.
                    </p>
                  </div>
                  <button
                    onClick={generateWeeklySchedule}
                    className="rounded-2xl bg-stone-950 px-5 py-3 font-semibold text-white"
                  >
                    <Zap size={16} className="inline" /> Gerar 12 ciclos
                  </button>
                </div>
              </Card>
            </motion.section>
          )}
          {view === "subjects" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={BookOpen}
                title="Matérias"
                subtitle="Controle das matérias, assuntos, progresso, prioridade, pendentes e concluídos."
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat
                  icon={BookOpen}
                  title="Assuntos"
                  value={`${selectedRoadmapStats.done}/${selectedRoadmapStats.total}`}
                  hint={`concluídos em ${selectedRoadmapStats.label}`}
                />
                <Stat
                  icon={Target}
                  title="Progresso"
                  value={`${selectedRoadmapStats.percent}%`}
                  hint="baseado nos assuntos do filtro"
                />
                <Stat
                  icon={AlertTriangle}
                  title="Alta prioridade"
                  value={selectedRoadmapStats.highPending}
                  hint={`${selectedRoadmapStats.mediumPending} média • ${selectedRoadmapStats.lowPending} baixa`}
                />
                <Stat
                  icon={Zap}
                  title="Mais difíceis"
                  value={selectedRoadmapStats.hardestPending}
                  hint={`${selectedRoadmapStats.mediumDifficultyPending} média • ${selectedRoadmapStats.lowDifficultyPending} baixa`}
                />
              </div>
              <Card className="p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    value={roadmapSubject}
                    onChange={(event) => setRoadmapSubject(event.target.value)}
                    className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                  >
                    <option value="all">Todas as matérias</option>
                    {roadmap.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.subject}
                      </option>
                    ))}
                  </select>
                  <select
                    value={roadmapStatus}
                    onChange={(event) => setRoadmapStatus(event.target.value)}
                    className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                  >
                    <option value="todos">Todos os assuntos</option>
                    <option value="pendentes">Pendentes</option>
                    <option value="concluidos">Concluídos</option>
                  </select>
                  <select
                    value={roadmapPriority}
                    onChange={(event) => setRoadmapPriority(event.target.value)}
                    className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                  >
                    <option value="todas">Todas as prioridades</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
              </Card>
              <div className="grid gap-5">
                {filteredRoadmap.map((subject) => {
                  const originalSubject = getSubject(roadmap, subject.id);
                  const doneCount =
                    originalSubject?.topics.filter((topic) => topic.done)
                      .length || 0;
                  const totalCount = originalSubject?.topics.length || 0;
                  const percent = totalCount
                    ? Math.round((doneCount / totalCount) * 100)
                    : 0;
                  const performance = subjectPerformance.find(
                    (item) => item.id === subject.id,
                  );
                  return (
                    <Card key={subject.id} className="overflow-hidden">
                      <div className="border-b border-stone-200 bg-stone-50/80 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="amber">Peso {subject.weight}</Badge>
                              <Badge>{subject.priority}</Badge>
                              <Badge
                                tone={
                                  performance?.pendingErrors ? "red" : "green"
                                }
                              >
                                {performance?.pendingErrors || 0} erros
                              </Badge>
                              <Badge>
                                {doneCount}/{totalCount} tópicos
                              </Badge>
                              <Badge tone="red">
                                {
                                  (originalSubject?.topics || []).filter(
                                    (topic) =>
                                      !topic.done && topic.priority === "Alta",
                                  ).length
                                }{" "}
                                alta
                              </Badge>
                              <Badge tone="amber">
                                {
                                  (originalSubject?.topics || []).filter(
                                    (topic) =>
                                      !topic.done && topic.priority === "Média",
                                  ).length
                                }{" "}
                                média
                              </Badge>
                              <Badge>
                                {
                                  (originalSubject?.topics || []).filter(
                                    (topic) =>
                                      !topic.done && topic.priority === "Baixa",
                                  ).length
                                }{" "}
                                baixa
                              </Badge>
                            </div>
                            <h3 className="mt-3 text-xl font-black">
                              {subject.subject}
                            </h3>
                            <p className="text-sm text-stone-500">
                              {subject.reason}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-stone-500">
                              Aproveitamento:{" "}
                              {performance?.totalQuestions
                                ? `${performance.accuracy}%`
                                : "sem desempenho registrado"}{" "}
                              • Difíceis pendentes:{" "}
                              {
                                (originalSubject?.topics || []).filter(
                                  (topic) =>
                                    !topic.done && topic.difficulty === "Alta",
                                ).length
                              }
                            </p>
                          </div>
                          <div className="min-w-[240px]">
                            <div className="mb-2 flex justify-between text-xs text-stone-500">
                              <span>Assuntos concluídos</span>
                              <span>
                                {doneCount}/{totalCount}
                              </span>
                            </div>
                            <Progress value={percent} />
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {subject.topics.length === 0 ? (
                          <div className="p-5 text-sm text-stone-500">
                            Nenhum assunto nesse filtro.
                          </div>
                        ) : (
                          subject.topics.map((topic) => (
                            <div
                              key={topic.id}
                              className="grid gap-4 p-5 lg:grid-cols-[auto_1fr_150px_130px] lg:items-center"
                            >
                              <button
                                onClick={() =>
                                  toggleRoadmapTopic(subject.id, topic.id)
                                }
                                className={cls(
                                  "flex h-10 w-10 items-center justify-center rounded-2xl border",
                                  topic.done
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-stone-200 bg-white text-stone-400",
                                )}
                              >
                                <CheckCircle2 size={20} />
                              </button>
                              <div>
                                <h4
                                  className={cls(
                                    "font-black",
                                    topic.done && "line-through text-stone-400",
                                  )}
                                >
                                  {topic.title}
                                </h4>
                                <p className="text-sm text-stone-500">
                                  Dificuldade: {topic.difficulty} • Status:{" "}
                                  {topic.done ? "concluído" : "pendente"}
                                </p>
                              </div>
                              <select
                                value={topic.priority}
                                onChange={(event) =>
                                  changeRoadmapPriority(
                                    subject.id,
                                    topic.id,
                                    event.target.value,
                                  )
                                }
                                className="rounded-2xl border border-stone-200 px-3 py-2 text-sm"
                              >
                                <option>Alta</option>
                                <option>Média</option>
                                <option>Baixa</option>
                              </select>
                              <Badge
                                tone={
                                  topic.priority === "Alta"
                                    ? "red"
                                    : topic.priority === "Média"
                                      ? "amber"
                                      : "stone"
                                }
                              >
                                {topic.priority}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </motion.section>
          )}
          {view === "questions" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={CheckSquare}
                title="Questões"
                subtitle="Registre baterias por matéria, acertos, erros e observações. O tempo médio é em minutos por bateria."
              />
              <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
                <Card className="space-y-3 p-5">
                  <select
                    value={questionForm.subjectId}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        subjectId: event.target.value,
                        topicId: "",
                      }))
                    }
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                  >
                    <option value="">Selecione a matéria</option>
                    {subjectsList.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={questionForm.topicId}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        topicId: event.target.value,
                      }))
                    }
                    disabled={!questionForm.subjectId}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 disabled:bg-stone-100 disabled:text-stone-400"
                  >
                    <option value="">Assunto opcional</option>
                    {selectedQuestionSubjectTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      value={questionForm.done}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          done: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Questões feitas"
                      type="number"
                      min="0"
                    />
                    <input
                      value={questionForm.correct}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          correct: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Acertos"
                      type="number"
                      min="0"
                    />
                    <input
                      value={questionForm.time}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          time: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Tempo médio (min)"
                      type="number"
                      min="0"
                    />
                  </div>
                  <textarea
                    value={questionForm.notes}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className="h-28 w-full rounded-2xl border border-stone-200 px-4 py-3"
                    placeholder="Observação sobre a bateria..."
                  />
                  <button
                    onClick={registerQuestions}
                    className="rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                  >
                    <Save size={16} className="inline" /> Registrar bateria
                  </button>
                </Card>
                <Card className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="font-black">Histórico de questões</h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      <select
                        value={questionFilterSubject}
                        onChange={(event) => {
                          setQuestionFilterSubject(event.target.value);
                          setQuestionFilterTopic("all");
                        }}
                        className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                      >
                        <option value="all">Todas as matérias</option>
                        {subjectsList.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={questionFilterTopic}
                        onChange={(event) =>
                          setQuestionFilterTopic(event.target.value)
                        }
                        disabled={questionFilterSubject === "all"}
                        className="rounded-2xl border border-stone-200 px-4 py-3 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                      >
                        <option value="all">Todos os assuntos</option>
                        {questionFilterTopics.map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs font-semibold text-stone-500">
                        Total
                      </p>
                      <p className="mt-1 text-2xl font-black text-stone-950">
                        {questionSummary.done}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold text-emerald-700">
                        Acertos
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-700">
                        {questionSummary.correct}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="text-xs font-semibold text-red-700">
                        Erros
                      </p>
                      <p className="mt-1 text-2xl font-black text-red-700">
                        {questionSummary.wrong}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-semibold text-amber-900">
                        Aproveitamento
                      </p>
                      <p className="mt-1 text-2xl font-black text-amber-900">
                        {questionSummary.accuracy}%
                      </p>
                    </div>
                  </div>
                  <div
                    className={cls(
                      "mt-4 rounded-2xl border p-4 text-sm font-semibold",
                      questionSummary.done === 0
                        ? "border-stone-200 bg-stone-50 text-stone-600"
                        : questionSummary.accuracy >= 80
                          ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                          : questionSummary.accuracy >= 60
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-red-100 bg-red-50 text-red-700",
                    )}
                  >
                    {questionSummary.message}
                  </div>
                  <div className="mt-4 space-y-3">
                    {filteredQuestionSessions.length === 0 ? (
                      <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                        Nenhuma bateria encontrada para esse filtro.
                      </div>
                    ) : (
                      filteredQuestionSessions.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <b>
                                {session.subject ||
                                  subjectMap[session.subjectId]?.name ||
                                  "Matéria"}
                              </b>
                              <p className="text-stone-600">
                                Assunto: {session.topic || "Não informado"}
                              </p>
                              <p className="text-stone-500">
                                {session.correct}/{session.done} acertos •{" "}
                                {session.done
                                  ? Math.round(
                                      (session.correct / session.done) * 100,
                                    )
                                  : 0}
                                % de aproveitamento
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                {session.correct} acertos
                              </span>
                              <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                                {session.wrong} erros
                              </span>
                              {session.time > 0 && (
                                <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
                                  {session.time} min
                                </span>
                              )}
                            </div>
                          </div>
                          {session.notes && (
                            <p className="mt-3 rounded-xl bg-white p-3 text-xs text-stone-500">
                              {session.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </motion.section>
          )}
          {view === "simulated" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={Trophy}
                title="Simulados"
                subtitle="Registre simulados completos, redação, tempo gasto e desempenho por matéria."
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Stat
                  icon={Trophy}
                  title="Simulados"
                  value={simulatedSummary.totalTests}
                  hint="total registrado"
                />
                <Stat
                  icon={CheckSquare}
                  title="Questões"
                  value={simulatedSummary.totalQuestions}
                  hint="questões feitas em simulados"
                />
                <Stat
                  icon={CheckCircle2}
                  title="Acertos"
                  value={simulatedSummary.totalCorrect}
                  hint={`${simulatedSummary.totalWrong} erro(s)`}
                />
                <Stat
                  icon={BarChart3}
                  title="Aprov."
                  value={`${simulatedSummary.accuracy}%`}
                  hint="média geral objetiva"
                />
                <Stat
                  icon={FileText}
                  title="Redação"
                  value={simulatedSummary.averageEssay}
                  hint="pontuação média"
                />
              </div>
              <div className="grid gap-6 xl:grid-cols-[.95fr_1.05fr]">
                <Card className="space-y-4 p-5">
                  <div>
                    <h3 className="font-black">Novo simulado</h3>
                    <p className="text-sm text-stone-500">
                      Cadastre o resultado geral e detalhe por matéria para
                      comparar depois.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={simulatedForm.title}
                      onChange={(event) =>
                        setSimulatedForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3 md:col-span-2"
                      placeholder="Título do simulado"
                    />
                    <input
                      value={simulatedForm.total}
                      onChange={(event) =>
                        setSimulatedForm((current) => ({
                          ...current,
                          total: event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Total de questões"
                    />
                    <input
                      value={simulatedForm.correct}
                      onChange={(event) =>
                        setSimulatedForm((current) => ({
                          ...current,
                          correct: event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Total de acertos"
                    />
                    <input
                      value={simulatedForm.essayScore}
                      onChange={(event) =>
                        setSimulatedForm((current) => ({
                          ...current,
                          essayScore: event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      max="100"
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Redação 0 a 100"
                    />
                    <input
                      value={simulatedForm.timeSpent}
                      onChange={(event) =>
                        setSimulatedForm((current) => ({
                          ...current,
                          timeSpent: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Tempo gasto: 4, 2.20, 240..."
                    />
                    <input
                      value={simulatedForm.date}
                      onChange={(event) =>
                        setSimulatedForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Data do simulado"
                    />
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700">
                      <b>
                        {Math.max(
                          0,
                          Number(simulatedForm.total || 0) -
                            Math.min(
                              Number(simulatedForm.total || 0),
                              Number(simulatedForm.correct || 0),
                            ),
                        )}
                      </b>{" "}
                      erros calculados
                    </div>
                  </div>
                  <textarea
                    value={simulatedForm.notes}
                    onChange={(event) =>
                      setSimulatedForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className="h-24 w-full rounded-2xl border border-stone-200 px-4 py-3"
                    placeholder="Observação do simulado..."
                  />
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="font-black">Desempenho por matéria</h4>
                        <p className="text-sm text-stone-500">
                          Opcional: detalhe as questões e acertos por matéria.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setSimulatedSubjectsOpen((current) => !current)
                        }
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                      >
                        {simulatedSubjectsOpen
                          ? "Recolher matérias"
                          : "Adicionar desempenho por matéria"}
                      </button>
                    </div>
                    {simulatedSubjectsOpen && (
                      <div className="mt-4 grid gap-3">
                        {subjectsList.map((subject) => {
                          const entry =
                            simulatedForm.subjects?.[subject.id] || {};
                          const subjectWrong = Math.max(
                            0,
                            Number(entry.total || 0) -
                              Math.min(
                                Number(entry.total || 0),
                                Number(entry.correct || 0),
                              ),
                          );
                          return (
                            <div
                              key={subject.id}
                              className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-3 md:grid-cols-[1fr_110px_110px_90px] md:items-center"
                            >
                              <div>
                                <p className="font-semibold text-stone-900">
                                  {subject.name}
                                </p>
                                <p className="text-xs text-stone-500">
                                  Peso {subject.weight}
                                </p>
                              </div>
                              <input
                                value={entry.total || ""}
                                onChange={(event) =>
                                  updateSimulatedSubject(
                                    subject.id,
                                    "total",
                                    event.target.value,
                                  )
                                }
                                type="number"
                                min="0"
                                className="rounded-xl border border-stone-200 px-3 py-2"
                                placeholder="Questões"
                              />
                              <input
                                value={entry.correct || ""}
                                onChange={(event) =>
                                  updateSimulatedSubject(
                                    subject.id,
                                    "correct",
                                    event.target.value,
                                  )
                                }
                                type="number"
                                min="0"
                                className="rounded-xl border border-stone-200 px-3 py-2"
                                placeholder="Acertos"
                              />
                              <div className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-700">
                                {subjectWrong} erros
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {simulatedMessage && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      {simulatedMessage}
                    </div>
                  )}
                  <button
                    onClick={saveSimulatedTest}
                    className="w-full rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                  >
                    <Save size={16} className="inline" /> Salvar simulado
                  </button>
                </Card>
                <Card className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-black">Histórico de simulados</h3>
                      <p className="text-sm text-stone-500">
                        Compare evolução, acertos, redação e matérias
                        fortes/fracas.
                      </p>
                    </div>
                    <Badge tone="amber">
                      {simulatedTests.length} registro(s)
                    </Badge>
                  </div>
                  <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <h4 className="font-black">Comparar simulados</h4>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <select
                        value={simulatedCompareA}
                        onChange={(event) =>
                          setSimulatedCompareA(event.target.value)
                        }
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"
                      >
                        <option value="">Selecione um simulado</option>
                        {orderedSimulatedTests.map((test) => (
                          <option key={test.id} value={test.id}>
                            {test.title} • {test.date}
                          </option>
                        ))}
                      </select>
                      <select
                        value={simulatedCompareB}
                        onChange={(event) =>
                          setSimulatedCompareB(event.target.value)
                        }
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"
                      >
                        <option value="">Comparar com outro</option>
                        {orderedSimulatedTests.map((test) => (
                          <option key={test.id} value={test.id}>
                            {test.title} • {test.date}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={clearSimulatedSelection}
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                      >
                        Limpar
                      </button>
                    </div>
                    {singleSimulatedDetail && (
                      <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-900">
                              Análise individual
                            </p>
                            <h5 className="mt-2 text-2xl font-black text-stone-950">
                              {singleSimulatedDetail.title}
                            </h5>
                            <p className="text-sm font-semibold text-stone-600">
                              Data: {singleSimulatedDetail.date}
                            </p>
                          </div>
                          <Badge
                            tone={
                              singleSimulatedDetail.accuracy >= 80
                                ? "green"
                                : singleSimulatedDetail.accuracy >= 60
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {singleSimulatedDetail.accuracy}% aproveitamento
                          </Badge>
                        </div>
                        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                          <div className="min-w-0 rounded-2xl bg-white/80 p-4">
                            <p className="text-xs font-semibold text-stone-500">
                              Questões
                            </p>
                            <p className="mt-1 text-2xl font-black text-stone-950">
                              {singleSimulatedDetail.total}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-2xl bg-white/80 p-4">
                            <p className="text-xs font-semibold text-emerald-700">
                              Acertos
                            </p>
                            <p className="mt-1 text-2xl font-black text-emerald-700">
                              {singleSimulatedDetail.correct}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-2xl bg-white/80 p-4">
                            <p className="text-xs font-semibold text-red-700">
                              Erros
                            </p>
                            <p className="mt-1 text-2xl font-black text-red-700">
                              {singleSimulatedDetail.wrong}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-2xl bg-white/80 p-4">
                            <p className="text-xs font-semibold text-stone-500">
                              Redação
                            </p>
                            <p className="mt-1 whitespace-nowrap text-xl font-black text-stone-950">
                              {singleSimulatedDetail.essayScore}/100
                            </p>
                            <p className="text-[11px] font-bold text-stone-500">
                              mín. 50 •{" "}
                              {singleSimulatedDetail.essayStatus ||
                                essayStatus(singleSimulatedDetail.essayScore)
                                  .label}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-2xl bg-white/80 p-4">
                            <p className="text-xs font-semibold text-stone-500">
                              Tempo
                            </p>
                            <p className="mt-1 text-2xl font-black text-stone-950">
                              {formatMinutesAsTime(
                                singleSimulatedDetail.timeSpentMinutes,
                              )}
                            </p>
                          </div>
                        </div>
                        {simulatedDetailSubjects(singleSimulatedDetail).length >
                          0 && (
                          <div className="mt-5 rounded-3xl bg-white/80 p-4">
                            <h5 className="font-black text-stone-950">
                              Desempenho por matéria
                            </h5>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              {simulatedDetailSubjects(
                                singleSimulatedDetail,
                              ).map((entry) => {
                                const accuracy = entry.total
                                  ? Math.round(
                                      (entry.correct / entry.total) * 100,
                                    )
                                  : 0;
                                return (
                                  <div
                                    key={entry.subjectId}
                                    className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <b>{entry.subject}</b>
                                      <span
                                        className={cls(
                                          "rounded-full px-3 py-1 text-xs font-bold",
                                          accuracy >= 80
                                            ? "bg-emerald-50 text-emerald-700"
                                            : accuracy >= 60
                                              ? "bg-amber-50 text-amber-900"
                                              : "bg-red-50 text-red-700",
                                        )}
                                      >
                                        {accuracy}%
                                      </span>
                                    </div>
                                    <p className="mt-1 text-stone-600">
                                      {entry.correct}/{entry.total} acertos •{" "}
                                      {entry.wrong} erros
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {singleSimulatedDetail.notes && (
                          <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-stone-700">
                            <b>Observação:</b>
                            <br />
                            {singleSimulatedDetail.notes}
                          </div>
                        )}
                      </div>
                    )}
                    {compareSimulatedA &&
                      compareSimulatedB &&
                      simulatedComparison && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-4">
                            {[compareSimulatedA, compareSimulatedB].map(
                              (test, index) => (
                                <div
                                  key={test.id}
                                  className="rounded-3xl border border-stone-200 bg-white p-4"
                                >
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-400">
                                    {index === 0
                                      ? "Primeiro simulado selecionado"
                                      : "Segundo simulado selecionado"}
                                  </p>
                                  <h5 className="mt-2 text-xl font-black text-stone-950">
                                    {test.title}
                                  </h5>
                                  <p className="text-sm text-stone-500">
                                    Data: {test.date}
                                  </p>
                                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                                    <div className="rounded-2xl bg-stone-50 p-3 text-sm">
                                      <span className="text-stone-500">
                                        Acertos
                                      </span>
                                      <p className="text-xl font-black text-stone-950">
                                        {test.correct}/{test.total}
                                      </p>
                                    </div>
                                    <div className="rounded-2xl bg-stone-50 p-3 text-sm">
                                      <span className="text-stone-500">
                                        Erros
                                      </span>
                                      <p className="text-xl font-black text-red-700">
                                        {test.wrong}
                                      </p>
                                    </div>
                                    <div className="min-w-0 rounded-2xl bg-stone-50 p-3 text-sm">
                                      <span className="text-stone-500">
                                        Aprov.
                                      </span>
                                      <p className="text-xl font-black text-stone-950">
                                        {test.accuracy}%
                                      </p>
                                    </div>
                                    <div className="min-w-0 rounded-2xl bg-stone-50 p-3 text-sm">
                                      <span className="text-stone-500">
                                        Redação
                                      </span>
                                      <p className="whitespace-nowrap text-lg font-black text-stone-950">
                                        {test.essayScore}/100
                                      </p>
                                      <p className="text-[11px] font-semibold text-stone-500">
                                        mín. 50 •{" "}
                                        {test.essayStatus ||
                                          essayStatus(test.essayScore).label}
                                      </p>
                                    </div>
                                    <div className="rounded-2xl bg-stone-50 p-3 text-sm">
                                      <span className="text-stone-500">
                                        Tempo
                                      </span>
                                      <p className="text-xl font-black text-stone-950">
                                        {formatMinutesAsTime(
                                          test.timeSpentMinutes,
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ),
                            )}
                            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-900">
                                Diferença entre os simulados
                              </p>
                              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                                <div className="rounded-2xl bg-white/80 p-3 text-sm">
                                  <span className="text-stone-500">
                                    Acertos
                                  </span>
                                  <p
                                    className={cls(
                                      "text-xl font-black",
                                      simulatedComparison.deltaCorrect >= 0
                                        ? "text-emerald-700"
                                        : "text-red-700",
                                    )}
                                  >
                                    {simulatedComparison.deltaCorrect >= 0
                                      ? "+"
                                      : ""}
                                    {simulatedComparison.deltaCorrect}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-white/80 p-3 text-sm">
                                  <span className="text-stone-500">Erros</span>
                                  <p
                                    className={cls(
                                      "text-xl font-black",
                                      simulatedComparison.deltaWrong <= 0
                                        ? "text-emerald-700"
                                        : "text-red-700",
                                    )}
                                  >
                                    {simulatedComparison.deltaWrong >= 0
                                      ? "+"
                                      : ""}
                                    {simulatedComparison.deltaWrong}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-white/80 p-3 text-sm">
                                  <span className="text-stone-500">Aprov.</span>
                                  <p
                                    className={cls(
                                      "text-xl font-black",
                                      simulatedComparison.deltaAccuracy >= 0
                                        ? "text-emerald-700"
                                        : "text-red-700",
                                    )}
                                  >
                                    {simulatedComparison.deltaAccuracy >= 0
                                      ? "+"
                                      : ""}
                                    {simulatedComparison.deltaAccuracy}%
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-white/80 p-3 text-sm">
                                  <span className="text-stone-500">
                                    Redação
                                  </span>
                                  <p
                                    className={cls(
                                      "text-xl font-black",
                                      simulatedComparison.deltaEssay >= 0
                                        ? "text-emerald-700"
                                        : "text-red-700",
                                    )}
                                  >
                                    {simulatedComparison.deltaEssay >= 0
                                      ? "+"
                                      : ""}
                                    {simulatedComparison.deltaEssay}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-white/80 p-3 text-sm">
                                  <span className="text-stone-500">Tempo</span>
                                  <p className="text-xl font-black text-stone-950">
                                    {simulatedComparison.deltaTime >= 0
                                      ? "+"
                                      : ""}
                                    {simulatedComparison.deltaTime}min
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-stone-700">
                                <b>Melhor aproveitamento:</b>{" "}
                                {simulatedComparison.betterAccuracy}.{" "}
                                <b>Melhor redação:</b>{" "}
                                {simulatedComparison.betterEssay}.
                              </div>
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                              <b>Melhor evolução:</b>
                              <br />
                              {simulatedComparison.bestEvolution
                                ? `${simulatedComparison.bestEvolution.name} (${simulatedComparison.bestEvolution.deltaAccuracy >= 0 ? "+" : ""}${simulatedComparison.bestEvolution.deltaAccuracy}%)`
                                : "Sem dados por matéria."}
                            </div>
                            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                              <b>Ponto de atenção:</b>
                              <br />
                              {simulatedComparison.worstEvolution
                                ? `${simulatedComparison.worstEvolution.name} (${simulatedComparison.worstEvolution.deltaAccuracy >= 0 ? "+" : ""}${simulatedComparison.worstEvolution.deltaAccuracy}%)`
                                : "Sem dados por matéria."}
                            </div>
                          </div>
                          {simulatedComparison.subjectRows.length > 0 && (
                            <div className="rounded-2xl bg-white p-4">
                              <h5 className="font-black">
                                Comparativo por matéria
                              </h5>
                              <div className="mt-3 space-y-2">
                                {simulatedComparison.subjectRows.map((row) => (
                                  <div
                                    key={row.id}
                                    className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm"
                                  >
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <b>{row.name}</b>
                                      <span
                                        className={cls(
                                          "rounded-full px-3 py-1 font-bold",
                                          row.deltaAccuracy >= 0
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-red-50 text-red-700",
                                        )}
                                      >
                                        {row.deltaAccuracy >= 0 ? "+" : ""}
                                        {row.deltaAccuracy}%
                                      </span>
                                    </div>
                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                      <div className="rounded-xl bg-white p-3">
                                        {compareSimulatedA.title}:{" "}
                                        <b>
                                          {row.aCorrect}/{row.aTotal}
                                        </b>{" "}
                                        acertos • {row.aAccuracy}%
                                      </div>
                                      <div className="rounded-xl bg-white p-3">
                                        {compareSimulatedB.title}:{" "}
                                        <b>
                                          {row.bCorrect}/{row.bTotal}
                                        </b>{" "}
                                        acertos • {row.bAccuracy}%
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                  {!simulatedCompareA && !simulatedCompareB && (
                    <div className="mt-4 space-y-4">
                      {simulatedTests.length === 0 ? (
                        <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                          Nenhum simulado registrado ainda.
                        </div>
                      ) : (
                        orderedSimulatedTests.map((test) => {
                          const subjects = Object.values(
                            test.subjects || {},
                          ).sort((a, b) => (b.correct || 0) - (a.correct || 0));
                          const best = subjects[0];
                          const worst = [...subjects]
                            .filter((item) => item.total > 0)
                            .sort(
                              (a, b) =>
                                a.correct / Math.max(1, a.total) -
                                b.correct / Math.max(1, b.total),
                            )[0];
                          return (
                            <div
                              key={test.id}
                              className="rounded-3xl border border-stone-200 bg-stone-50 p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge>{test.date}</Badge>
                                    <Badge tone="amber">{test.type}</Badge>
                                    <Badge>{test.accuracy}%</Badge>
                                  </div>
                                  <h3 className="mt-3 text-lg font-black text-stone-950">
                                    {test.title}
                                  </h3>
                                  <p className="text-sm text-stone-600">
                                    {test.correct}/{test.total} acertos •{" "}
                                    {test.wrong} erros • Redação{" "}
                                    {test.essayScore}/100 •{" "}
                                    {test.essayStatus ||
                                      essayStatus(test.essayScore).label}{" "}
                                    •{" "}
                                    {formatMinutesAsTime(test.timeSpentMinutes)}
                                  </p>
                                  {(best || worst) && (
                                    <p className="mt-2 text-sm text-stone-500">
                                      Mais acertos: {best?.subject || "—"}. Mais
                                      atenção: {worst?.subject || "—"}.
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => deleteSimulatedTest(test.id)}
                                  className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              {subjects.length > 0 && (
                                <div className="mt-4 grid gap-2 md:grid-cols-2">
                                  {subjects.map((entry) => (
                                    <div
                                      key={entry.subjectId}
                                      className="rounded-2xl bg-white p-3 text-sm"
                                    >
                                      <b>{entry.subject}</b>
                                      <p className="text-stone-600">
                                        {entry.correct}/{entry.total} acertos •{" "}
                                        {entry.wrong} erros •{" "}
                                        {entry.total
                                          ? Math.round(
                                              (entry.correct / entry.total) *
                                                100,
                                            )
                                          : 0}
                                        %
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {test.notes && (
                                <p className="mt-3 rounded-2xl bg-white p-3 text-sm text-stone-600">
                                  {test.notes}
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                  {!simulatedCompareA &&
                    !simulatedCompareB &&
                    simulatedSubjectSummary.length > 0 && (
                      <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                        <h4 className="font-black text-amber-950">
                          Resumo por matéria em simulados
                        </h4>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {simulatedSubjectSummary.map((subject) => (
                            <div
                              key={subject.id}
                              className="rounded-2xl bg-white/80 p-3 text-sm"
                            >
                              <b>{subject.name}</b>
                              <p className="text-stone-600">
                                {subject.correct}/{subject.total} acertos •{" "}
                                {subject.wrong} erros • {subject.accuracy}%
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </Card>
              </div>
            </motion.section>
          )}
          {view === "reviews" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={RotateCcw}
                title="Revisões"
                subtitle="Filtre revisões atuais, vencidas, 24 horas, 7 dias, 15 dias e 30 dias."
              />
              {overdueReviews.length > 0 && (
                <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em]">
                    Revisão vencida
                  </p>
                  <h3 className="mt-2 text-xl font-black">
                    {overdueReviews[0].title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold">
                    {overdueReviews[0].type} • {overdueReviews[0].date}
                  </p>
                </div>
              )}
              <Card className="p-4">
                <div className="flex flex-wrap gap-2">
                  {filteredReviewsLabels.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setReviewFilter(key)}
                      className={cls(
                        "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                        reviewFilter === key
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Card>
              <div className="grid gap-4">
                {reviews.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-stone-500">
                    Nenhuma revisão ainda. Elas serão criadas automaticamente
                    quando você concluir assuntos.
                  </Card>
                ) : filteredReviews.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-stone-500">
                    Nenhuma revisão encontrada para esse filtro.
                  </Card>
                ) : (
                  filteredReviews.map((review) => {
                    const status = reviewStatus(review);
                    const isOverdue = status === "vencida";
                    const isDone = status === "concluida";
                    const isRunning = status === "andamento";
                    return (
                      <Card
                        key={review.id}
                        className={cls(
                          "p-5",
                          isOverdue && "border-red-200 bg-red-50",
                          isDone && "border-emerald-200 bg-emerald-50",
                        )}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                tone={
                                  isOverdue
                                    ? "red"
                                    : isDone
                                      ? "green"
                                      : isRunning
                                        ? "amber"
                                        : status === "atual"
                                          ? "amber"
                                          : "stone"
                                }
                              >
                                {isOverdue
                                  ? "revisão vencida"
                                  : isDone
                                    ? "revisado"
                                    : isRunning
                                      ? "em revisão"
                                      : status}
                              </Badge>
                              <Badge>{review.type}</Badge>
                            </div>
                            <h3 className="mt-3 font-black text-stone-950">
                              {review.title}
                            </h3>
                            <p className="text-sm text-stone-600">
                              Data: {review.date}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!isDone && !isRunning && (
                              <button
                                onClick={() => startReview(review.id)}
                                className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                              >
                                <Play size={15} className="inline" /> Iniciar
                              </button>
                            )}
                            {!isDone && (
                              <button
                                onClick={() => completeReview(review.id)}
                                className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
                              >
                                <CheckCircle2 size={15} className="inline" />{" "}
                                Concluir
                              </button>
                            )}
                            {isDone && (
                              <button
                                disabled
                                className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800"
                              >
                                Revisado
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </motion.section>
          )}
          {view === "errors" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={AlertTriangle}
                title="Caderno de Erros"
                subtitle="Registre o erro agora e adicione a correção depois, quando souber como resolver."
              />
              <Card className="p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_auto] lg:items-center">
                  <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <Search size={18} className="text-stone-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por erro ou correção..."
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <select
                    value={errorSubjectFilter}
                    onChange={(event) =>
                      setErrorSubjectFilter(event.target.value)
                    }
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="all">Todas as matérias</option>
                    {subjectsList.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={errorStatusFilter}
                    onChange={(event) =>
                      setErrorStatusFilter(event.target.value)
                    }
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="pendentes">Pendentes</option>
                    <option value="resolvidos">Resolvidos</option>
                    <option value="todos">Todos</option>
                  </select>
                  <button
                    onClick={openErrorForm}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Plus size={14} className="inline" /> Novo erro
                  </button>
                </div>
              </Card>
              {errorFormOpen && (
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black">
                        {editingErrorId ? "Editar erro" : "Adicionar novo erro"}
                      </h3>
                      <p className="text-sm text-stone-500">
                        Selecione matéria e assunto. O erro é obrigatório; a
                        correção pode ser preenchida depois.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setErrorFormOpen(false);
                        setEditingErrorId(null);
                      }}
                      className="rounded-2xl border border-stone-200 bg-white p-2 text-stone-500"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <select
                      value={errorForm.subjectId}
                      onChange={(event) =>
                        setErrorForm({
                          subjectId: event.target.value,
                          topicId: "",
                          error: errorForm.error,
                          fix: errorForm.fix,
                        })
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                    >
                      <option value="">Selecione a matéria</option>
                      {subjectsList.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={errorForm.topicId}
                      onChange={(event) =>
                        setErrorForm((current) => ({
                          ...current,
                          topicId: event.target.value,
                        }))
                      }
                      disabled={!errorForm.subjectId}
                      className="rounded-2xl border border-stone-200 px-4 py-3 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <option value="">Selecione o assunto</option>
                      {selectedErrorSubjectTopics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <textarea
                      value={errorForm.error}
                      onChange={(event) =>
                        setErrorForm((current) => ({
                          ...current,
                          error: event.target.value,
                        }))
                      }
                      className="h-32 rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Digite qual foi o erro..."
                    />
                    <textarea
                      value={errorForm.fix}
                      onChange={(event) =>
                        setErrorForm((current) => ({
                          ...current,
                          fix: event.target.value,
                        }))
                      }
                      className="h-32 rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Correção opcional. Pode preencher depois..."
                    />
                  </div>
                  {errorFormMessage && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      {errorFormMessage}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setErrorFormOpen(false);
                        setEditingErrorId(null);
                        setErrorFormMessage("");
                      }}
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveError}
                      className="rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                    >
                      <Save size={16} className="inline" />{" "}
                      {editingErrorId ? "Salvar edição" : "Salvar erro"}
                    </button>
                  </div>
                </Card>
              )}
              <div className="grid gap-4">
                {filteredErrors.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-stone-500">
                    Nenhum erro encontrado para esse filtro.
                  </Card>
                ) : (
                  filteredErrors.map((item) => {
                    const resolved = item.status === "resolvido";
                    return (
                      <Card
                        key={item.id}
                        className={cls(
                          "p-5",
                          resolved && "border-emerald-200 bg-emerald-50",
                        )}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-3">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <Badge>{item.subject}</Badge>
                                <Badge tone="amber">{item.topic}</Badge>
                                <Badge tone={resolved ? "green" : "red"}>
                                  {resolved ? "resolvido" : "pendente"}
                                </Badge>
                              </div>
                              <h3 className="mt-3 font-black text-stone-950">
                                Tipo: {item.kind}
                              </h3>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                                <b>Erro:</b>
                                <br />
                                {item.error}
                              </div>
                              <div
                                className={cls(
                                  "rounded-2xl p-4 text-sm",
                                  item.fix
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-stone-50 text-stone-500",
                                )}
                              >
                                <b>Correção:</b>
                                <br />
                                {item.fix || "Correção ainda não informada."}
                              </div>
                            </div>
                            {correctionForm.id === item.id && (
                              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                                <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                                  Digite a correção
                                </label>
                                <textarea
                                  value={correctionForm.fix}
                                  onChange={(event) =>
                                    setCorrectionForm((current) => ({
                                      ...current,
                                      fix: event.target.value,
                                    }))
                                  }
                                  className="mt-2 h-24 w-full rounded-2xl border border-stone-200 px-4 py-3"
                                  placeholder="Como corrigir esse erro?"
                                />
                                <div className="mt-3 flex justify-end gap-2">
                                  <button
                                    onClick={() =>
                                      setCorrectionForm({ id: null, fix: "" })
                                    }
                                    className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={saveCorrection}
                                    className="cursor-pointer rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                                  >
                                    Salvar correção
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 md:justify-end">
                            <button
                              onClick={() => openViewError(item)}
                              title="Visualizar erro"
                              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                            >
                              <Eye size={17} />
                            </button>
                            {resolved ? (
                              <button
                                onClick={() => solveError(item.id)}
                                className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                              >
                                Marcar pendente
                              </button>
                            ) : item.fix ? (
                              <button
                                onClick={() => solveError(item.id)}
                                className="cursor-pointer rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                              >
                                Marcar resolvido
                              </button>
                            ) : (
                              <button
                                onClick={() => openCorrectionForm(item)}
                                className="cursor-pointer rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                              >
                                Corrigir
                              </button>
                            )}
                            <button
                              onClick={() => openEditError(item)}
                              title="Editar erro"
                              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                            >
                              <Edit3 size={17} />
                            </button>
                            <button
                              onClick={() => deleteError(item.id)}
                              title="Excluir erro"
                              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-700 transition hover:border-red-200 hover:bg-red-100 hover:text-red-800"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>

              {viewingError && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-stone-200 p-5">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{viewingError.subject}</Badge>
                          <Badge tone="amber">{viewingError.topic}</Badge>
                          <Badge
                            tone={
                              viewingError.status === "resolvido"
                                ? "green"
                                : "red"
                            }
                          >
                            {viewingError.status === "resolvido"
                              ? "resolvido"
                              : "pendente"}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-2xl font-black text-stone-950">
                          Visualizar erro
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-stone-400">
                          {viewingError.createdAt
                            ? `Registrado em ${new Date(viewingError.createdAt).toLocaleString("pt-BR")}`
                            : "Erro registrado no caderno"}
                        </p>
                      </div>
                      <button
                        onClick={closeViewError}
                        className="cursor-pointer rounded-2xl border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[58vh] overflow-y-auto p-6">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
                            Erro
                          </p>
                          <div className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-red-950">
                            {viewingError.error || "Erro não informado."}
                          </div>
                        </div>
                        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                            Correção
                          </p>
                          <div className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-emerald-950">
                            {viewingError.fix ||
                              "Correção ainda não informada."}
                          </div>
                        </div>
                      </div>
                      {correctionForm.id === viewingError.id && (
                        <div className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5">
                          <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                            Corrigir erro
                          </label>
                          <textarea
                            value={correctionForm.fix}
                            onChange={(event) =>
                              setCorrectionForm((current) => ({
                                ...current,
                                fix: event.target.value,
                              }))
                            }
                            className="mt-2 h-32 w-full rounded-2xl border border-stone-200 px-4 py-3"
                            placeholder="Digite a correção completa desse erro..."
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              onClick={() =>
                                setCorrectionForm({ id: null, fix: "" })
                              }
                              className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={saveCorrection}
                              className="cursor-pointer rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                            >
                              Salvar correção
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 p-5">
                      <button
                        onClick={closeViewError}
                        className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 transition hover:bg-stone-100"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={() => openCorrectionForm(viewingError)}
                        className="cursor-pointer rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800"
                      >
                        Corrigir
                      </button>
                      <button
                        onClick={() => openEditError(viewingError)}
                        className="cursor-pointer rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white transition hover:bg-stone-800"
                      >
                        <Edit3 size={16} className="inline" /> Editar
                      </button>
                      <button
                        onClick={() => deleteError(viewingError.id)}
                        className="cursor-pointer rounded-2xl border border-red-100 bg-red-50 px-4 py-3 font-semibold text-red-700 transition hover:border-red-200 hover:bg-red-100 hover:text-red-800"
                      >
                        <Trash2 size={16} className="inline" /> Excluir
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.section>
          )}
          {view === "notes" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={NotebookPen}
                title="Anotações"
                subtitle="Adicione anotações por matéria e assunto, filtre, edite e apague quando precisar."
              />
              <Card className="p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto] lg:items-center">
                  <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <Search size={18} className="text-stone-400" />
                    <input
                      value={noteSearch}
                      onChange={(event) => setNoteSearch(event.target.value)}
                      placeholder="Buscar por título ou anotação..."
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <select
                    value={noteSubjectFilter}
                    onChange={(event) => {
                      setNoteSubjectFilter(event.target.value);
                      setNoteTopicFilter("all");
                    }}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="all">Todas as matérias</option>
                    {subjectsList.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={noteTopicFilter}
                    onChange={(event) => setNoteTopicFilter(event.target.value)}
                    disabled={noteSubjectFilter === "all"}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                  >
                    <option value="all">Todos os assuntos</option>
                    {noteFilterTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={openNoteForm}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Plus size={14} className="inline" /> Nova anotação
                  </button>
                </div>
              </Card>
              {noteFormOpen && (
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black">
                        {editingNoteId
                          ? "Editar anotação"
                          : "Adicionar anotação"}
                      </h3>
                      <p className="text-sm text-stone-500">
                        Selecione matéria e assunto. A anotação é obrigatória; o
                        título é opcional.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setNoteFormOpen(false);
                        setEditingNoteId(null);
                        setNoteFormMessage("");
                      }}
                      className="rounded-2xl border border-stone-200 bg-white p-2 text-stone-500"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <select
                      value={noteForm.subjectId}
                      onChange={(event) =>
                        setNoteForm({
                          subjectId: event.target.value,
                          topicId: "",
                          title: noteForm.title,
                          text: noteForm.text,
                        })
                      }
                      className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
                    >
                      <option value="">Selecione a matéria</option>
                      {subjectsList.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={noteForm.topicId}
                      onChange={(event) =>
                        setNoteForm((current) => ({
                          ...current,
                          topicId: event.target.value,
                        }))
                      }
                      disabled={!noteForm.subjectId}
                      className="rounded-2xl border border-stone-200 px-4 py-3 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                    >
                      <option value="">Selecione o assunto</option>
                      {selectedNoteSubjectTopics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 space-y-3">
                    <input
                      value={noteForm.title}
                      onChange={(event) =>
                        setNoteForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                      placeholder="Título opcional da anotação"
                    />
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                          Marcação visual
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            wrapNoteSelection("**", "**", "texto em negrito")
                          }
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-800"
                        >
                          Negrito
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            wrapNoteSelection("__", "__", "texto sublinhado")
                          }
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold underline decoration-amber-500 decoration-2 underline-offset-4"
                        >
                          Sublinhar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            wrapNoteSelection("==", "==", "texto destacado")
                          }
                          className="rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900"
                        >
                          Destacar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            wrapNoteSelection("[[", "]]", "palavra-chave")
                          }
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                        >
                          Palavra-chave
                        </button>
                        <button
                          type="button"
                          onClick={removeNoteSelectionMarkup}
                          className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-700"
                        >
                          Remover marcação
                        </button>
                      </div>
                      <textarea
                        ref={noteTextAreaRef}
                        value={noteForm.text}
                        onChange={(event) =>
                          setNoteForm((current) => ({
                            ...current,
                            text: event.target.value,
                          }))
                        }
                        className="h-44 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3"
                        placeholder="Digite sua anotação... Ex: [[Palavras-chave]]: **segundo o texto**, __conforme o autor__, ==o texto afirma=="
                      />
                      <p className="mt-2 text-xs text-stone-500">
                        Dica: selecione uma palavra ou frase e clique em
                        Negrito, Sublinhar, Destacar ou Palavra-chave. Para
                        desfazer, selecione o trecho marcado e clique no mesmo
                        botão novamente, ou use Remover marcação.
                      </p>
                    </div>
                  </div>
                  {noteFormMessage && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      {noteFormMessage}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setNoteFormOpen(false);
                        setEditingNoteId(null);
                        setNoteFormMessage("");
                      }}
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveNote}
                      className="rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                    >
                      <Save size={16} className="inline" />{" "}
                      {editingNoteId ? "Salvar edição" : "Salvar anotação"}
                    </button>
                  </div>
                </Card>
              )}
              <Card className="p-5">
                <div>
                  <h3 className="font-black">Anotações recentes</h3>
                  <p className="text-sm text-stone-500">
                    {filteredNotes.length} anotação(ões) encontrada(s)
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {filteredNotes.length === 0 ? (
                    <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                      Nenhuma anotação encontrada para esse filtro.
                    </div>
                  ) : (
                    filteredNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Badge>{note.subject}</Badge>
                              <Badge tone="amber">{note.topic}</Badge>
                            </div>
                            <h4 className="mt-3 font-black text-stone-950">
                              {note.title || note.topic}
                            </h4>
                            <p className="mt-1 text-sm leading-6 text-stone-600">
                              {notePlainPreview(note.text)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 md:justify-end">
                            <button
                              onClick={() => openViewNote(note)}
                              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                              title="Visualizar anotação"
                            >
                              <Eye size={17} />
                            </button>
                            <button
                              onClick={() => openEditNote(note)}
                              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                              title="Editar anotação"
                            >
                              <Edit3 size={17} />
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-700 transition hover:border-red-200 hover:bg-red-100 hover:text-red-800"
                              title="Excluir anotação"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              {viewingNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-stone-200 p-5">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{viewingNote.subject}</Badge>
                          <Badge tone="amber">{viewingNote.topic}</Badge>
                        </div>
                        <h3 className="mt-3 text-2xl font-black text-stone-950">
                          {viewingNote.title || viewingNote.topic}
                        </h3>
                        {viewingNote.updatedAt && (
                          <p className="mt-1 text-xs font-semibold text-stone-400">
                            Atualizado em{" "}
                            {new Date(viewingNote.updatedAt).toLocaleString(
                              "pt-BR",
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={closeViewNote}
                        className="cursor-pointer rounded-2xl border border-stone-200 bg-white p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[58vh] overflow-y-auto p-6">
                      <FormattedNoteText text={viewingNote.text} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-stone-200 p-5">
                      <button
                        onClick={closeViewNote}
                        className="cursor-pointer rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700 transition hover:bg-stone-100"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={editViewingNote}
                        className="cursor-pointer rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white transition hover:bg-stone-800"
                      >
                        <Edit3 size={16} className="inline" /> Editar anotação
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.section>
          )}
          {view === "exam-switch" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={FileSpreadsheet}
                title="Editais / ciclos"
                subtitle="Crie novos editais, mantenha cada progresso separado e alterne quando quiser sem apagar o Supabase."
              />

              <div className="grid gap-4 md:grid-cols-3">
                {allAvailableExams(customExams, deletedBuiltInExamKeys).map(
                  (exam) => {
                    const active = exam.key === activeExamKeyState;
                    const canDeleteExam =
                      allAvailableExams(customExams, deletedBuiltInExamKeys)
                        .length > 1;
                    const isCustomExamCard = customExams.some(
                      (item) => item.key === exam.key,
                    );
                    return (
                      <Card
                        key={exam.key}
                        className={cls(
                          "p-5",
                          active && "border-emerald-200 bg-emerald-50",
                        )}
                      >
                        <Badge tone={active ? "green" : "stone"}>
                          {active ? "ativo" : exam.status || "disponível"}
                        </Badge>
                        <h3 className="mt-3 text-lg font-black text-stone-950">
                          {exam.label}
                        </h3>
                        <p className="mt-1 text-sm text-stone-600">
                          Banca: {exam.board || "Personalizado"}
                        </p>
                        <p className="mt-2 text-sm text-stone-600">
                          Prova:{" "}
                          {exam.noExamDate || !exam.examDate
                            ? "sem data definida"
                            : isoToBR(exam.examDate)}
                        </p>
                        <div className="mt-4 space-y-2">
                          {!active ? (
                            <button
                              onClick={() => activateExam(exam)}
                              className="w-full rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
                            >
                              Ativar edital
                            </button>
                          ) : (
                            <p className="rounded-2xl border border-emerald-200 bg-white/80 p-3 text-sm font-bold text-emerald-800">
                              Este é o ciclo ativo agora.
                            </p>
                          )}
                          {(isCustomExamCard || canDeleteExam) && (
                            <div
                              className={cls(
                                "grid gap-2",
                                isCustomExamCard
                                  ? "grid-cols-2"
                                  : "grid-cols-1",
                              )}
                            >
                              {isCustomExamCard && (
                                <button
                                  onClick={() => beginEditCustomExam(exam)}
                                  className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                                >
                                  <Edit3 size={15} className="inline" /> Editar
                                </button>
                              )}
                              {canDeleteExam && (
                                <button
                                  onClick={() => confirmDeleteCustomExam(exam)}
                                  className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                                >
                                  <Trash2 size={15} className="inline" /> Apagar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  },
                )}
              </div>

              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-stone-950">
                      {editingExamKey
                        ? "Editar Edital / Concurso"
                        : "Novo Edital / Concurso"}
                    </h3>
                    <p className="text-sm text-stone-500">
                      Cadastre o concurso, data da prova e matérias/assuntos por
                      modo manual ou Excel/CSV.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (examCreatorOpen) {
                        setExamCreatorOpen(false);
                        resetExamCreatorForm();
                      } else {
                        resetExamCreatorForm();
                        setExamCreatorOpen(true);
                      }
                    }}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Plus size={16} className="inline" />{" "}
                    {examCreatorOpen ? "Fechar" : "Novo Edital / Concurso"}
                  </button>
                </div>

                {examCreatorOpen && (
                  <div className="space-y-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm font-semibold text-stone-700">
                        Qual é o concurso / edital?
                        <input
                          value={examForm.label}
                          onChange={(event) =>
                            setExamForm((current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                          placeholder="Ex: Soldado 2027"
                        />
                      </label>
                      <label className="space-y-1 text-sm font-semibold text-stone-700">
                        Data da prova
                        <input
                          value={examForm.examDate}
                          disabled={examForm.noExamDate}
                          onChange={(event) =>
                            setExamForm((current) => ({
                              ...current,
                              examDate: event.target.value,
                            }))
                          }
                          type="date"
                          className="w-full rounded-2xl border border-stone-200 px-4 py-3 disabled:bg-stone-100 disabled:text-stone-400"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-sm font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={examForm.noExamDate}
                        onChange={(event) =>
                          setExamForm((current) => ({
                            ...current,
                            noExamDate: event.target.checked,
                            examDate: event.target.checked
                              ? ""
                              : current.examDate,
                          }))
                        }
                      />
                      Ainda não tem data definida de prova
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setExamCreatorMode("manual")}
                        className={cls(
                          "rounded-2xl border px-4 py-2 text-sm font-semibold",
                          examCreatorMode === "manual"
                            ? "border-stone-950 bg-stone-950 text-white"
                            : "border-stone-200 bg-white text-stone-600",
                        )}
                      >
                        Manual
                      </button>
                      <button
                        onClick={() => setExamCreatorMode("arquivo")}
                        className={cls(
                          "rounded-2xl border px-4 py-2 text-sm font-semibold",
                          examCreatorMode === "arquivo"
                            ? "border-stone-950 bg-stone-950 text-white"
                            : "border-stone-200 bg-white text-stone-600",
                        )}
                      >
                        Excel/CSV
                      </button>
                    </div>

                    {examCreatorMode === "manual" ? (
                      <div className="space-y-4">
                        {examForm.subjects.map((subject, subjectIndex) => (
                          <div
                            key={subjectIndex}
                            className="space-y-3 rounded-3xl border border-stone-200 bg-white p-4"
                          >
                            <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                              <input
                                value={subject.subject}
                                onChange={(event) =>
                                  updateExamSubject(
                                    subjectIndex,
                                    "subject",
                                    event.target.value,
                                  )
                                }
                                className="rounded-2xl border border-stone-200 px-4 py-3"
                                placeholder="Matéria. Ex: Língua Portuguesa"
                              />
                              <input
                                value={subject.weight}
                                onChange={(event) =>
                                  updateExamSubject(
                                    subjectIndex,
                                    "weight",
                                    event.target.value,
                                  )
                                }
                                type="number"
                                min="1"
                                className="rounded-2xl border border-stone-200 px-4 py-3"
                                placeholder="Peso"
                              />
                              <button
                                onClick={() => removeExamSubject(subjectIndex)}
                                disabled={examForm.subjects.length === 1}
                                className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 disabled:opacity-40"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="space-y-2">
                              {subject.topics.map((topic, topicIndex) => {
                                const topicText =
                                  typeof topic === "object"
                                    ? topic.text || ""
                                    : String(topic || "");
                                const topicPriority =
                                  typeof topic === "object"
                                    ? topic.priority || "Média"
                                    : "Média";
                                return (
                                  <div key={topicIndex} className="flex gap-2">
                                    <input
                                      value={topicText}
                                      onChange={(event) =>
                                        updateExamTopic(
                                          subjectIndex,
                                          topicIndex,
                                          "text",
                                          event.target.value,
                                        )
                                      }
                                      className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                                      placeholder={`Assunto ${topicIndex + 1}`}
                                    />
                                    <select
                                      value={topicPriority}
                                      onChange={(event) =>
                                        updateExamTopic(
                                          subjectIndex,
                                          topicIndex,
                                          "priority",
                                          event.target.value,
                                        )
                                      }
                                      className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-700"
                                    >
                                      <option value="Alta">Alta</option>
                                      <option value="Média">Média</option>
                                      <option value="Baixa">Baixa</option>
                                    </select>
                                    <button
                                      onClick={() =>
                                        removeExamTopic(
                                          subjectIndex,
                                          topicIndex,
                                        )
                                      }
                                      disabled={subject.topics.length === 1}
                                      className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 disabled:opacity-40"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => addExamTopic(subjectIndex)}
                              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                            >
                              <Plus size={16} className="inline" /> Adicionar
                              assunto
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addExamSubject}
                          className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-stone-700"
                        >
                          <Plus size={16} className="inline" /> Adicionar
                          matéria
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
                          Formato esperado: coluna A = Matéria, coluna B = Peso,
                          coluna C = Assunto, coluna D = Prioridade (Alta /
                          Média / Baixa). A primeira linha pode ser cabeçalho.
                        </div>
                        <input
                          ref={fileInputRef}
                          onChange={handleExamImportFile}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                        >
                          <Upload size={16} className="inline" /> Selecionar
                          Excel/CSV
                        </button>
                      </div>
                    )}

                    {examCreatorMessage && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                        {examCreatorMessage}
                      </div>
                    )}
                    <button
                      onClick={createCustomExam}
                      className="w-full rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white"
                    >
                      <Save size={16} className="inline" />{" "}
                      {editingExamKey
                        ? "Salvar alterações do edital"
                        : "Criar edital e ativar"}
                    </button>
                  </div>
                )}
              </Card>
            </motion.section>
          )}
          {view === "weights" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={BarChart3}
                title="Pesos e prioridade"
                subtitle="O sistema usa peso + desempenho + erros para ajustar a ordem dos estudos."
              />
              <div className="grid gap-4">
                {subjectPerformance.map((subject) => (
                  <Card key={subject.id} className="p-5">
                    <div className="grid gap-4 md:grid-cols-[1fr_160px_160px] md:items-center">
                      <div>
                        <h3 className="font-black">{subject.name}</h3>
                        <p className="text-sm text-stone-500">
                          Justificativa:{" "}
                          {subject.totalQuestions === 0
                            ? "aguardando questões, erros e tempo estudado para calcular prioridade."
                            : subject.accuracy < 60
                              ? "baixo aproveitamento, sobe no ciclo."
                              : "desempenho estável."}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500">Peso</p>
                        <p className="text-2xl font-black">{subject.weight}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500">Aproveitamento</p>
                        <p className="text-2xl font-black">
                          {subject.accuracy}%
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.section>
          )}
          {view === "report" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={FileText}
                title="Relatório inteligente"
                subtitle="Diagnóstico do ciclo com evolução, gargalos, erros recorrentes e sugestão do próximo estudo."
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat
                  icon={Clock}
                  title="Horas feitas"
                  value={formatHours(stats.studiedSeconds)}
                  hint="tempo registrado"
                />
                <Stat
                  icon={CheckCircle2}
                  title="Questões feitas"
                  value={stats.questionsDone}
                  hint="baterias registradas"
                />
                <Stat
                  icon={AlertTriangle}
                  title="Erros ativos"
                  value={stats.pendingErrors}
                  hint="pendentes no caderno"
                />
                <Stat
                  icon={Target}
                  title="Matérias"
                  value={`${roadmapStats.percent}%`}
                  hint={`${roadmapStats.done}/${roadmapStats.total} assuntos`}
                />
              </div>
              <Card className="p-5">
                <SectionTitle
                  icon={CheckSquare}
                  title="Relatório de meta do ciclo"
                  subtitle="Acompanhe se a meta de questões do ciclo está sendo cumprida."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-semibold text-stone-500">
                      Planejadas
                    </p>
                    <p className="mt-1 text-3xl font-black text-stone-950">
                      {weeklyGoalReport.plannedQuestions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold text-emerald-700">
                      Feitas
                    </p>
                    <p className="mt-1 text-3xl font-black text-emerald-700">
                      {weeklyGoalReport.doneQuestions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-xs font-semibold text-red-700">Faltam</p>
                    <p className="mt-1 text-3xl font-black text-red-700">
                      {weeklyGoalReport.missingQuestions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-900">
                      Cumprimento
                    </p>
                    <p className="mt-1 text-3xl font-black text-amber-900">
                      {weeklyGoalReport.percent}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <p className="text-xs font-semibold text-stone-500">
                      Ritmo necessário
                    </p>
                    <p className="mt-1 text-3xl font-black text-stone-950">
                      {weeklyGoalReport.dailyNeeded}
                    </p>
                    <p className="text-xs text-stone-500">por dia restante</p>
                  </div>
                </div>
                <div
                  className={cls(
                    "mt-4 rounded-2xl border p-4 text-sm font-semibold",
                    weeklyGoalReport.missingQuestions === 0 &&
                      weeklyGoalReport.plannedQuestions > 0
                      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-900",
                  )}
                >
                  {weeklyGoalReport.message}
                </div>
                <Progress value={weeklyGoalReport.percent} />
              </Card>
              <Card className="p-5">
                <SectionTitle
                  icon={BarChart3}
                  title="Questões por assunto"
                  subtitle="Os assuntos com menor aproveitamento entram como prioridade quando o ciclo da matéria for zerado."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {topicQuestionPerformance.length === 0 ? (
                    <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500 md:col-span-2 xl:col-span-3">
                      Ainda não há questões vinculadas a assuntos. Registre
                      questões selecionando matéria e assunto.
                    </div>
                  ) : (
                    topicQuestionPerformance.slice(0, 9).map((item) => (
                      <div
                        key={`${item.subjectId}-${item.topicId}`}
                        className={cls(
                          "rounded-2xl border p-4 text-sm",
                          item.accuracy < 60
                            ? "border-red-100 bg-red-50 text-red-800"
                            : item.accuracy < 75
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-emerald-100 bg-emerald-50 text-emerald-800",
                        )}
                      >
                        <b>{item.subject}</b>
                        <p className="mt-1 text-stone-700">{item.topic}</p>
                        <p className="mt-3 text-2xl font-black">
                          {item.accuracy}%
                        </p>
                        <p className="text-xs font-semibold">
                          {item.correct}/{item.done} acertos • {item.wrong}{" "}
                          erros
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <SectionTitle
                    icon={CalendarDays}
                    title="Histórico de estudos concluídos"
                    subtitle="Veja quais matérias e assuntos foram realmente estudados por ciclo e dia planejado."
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={reportWeekFilter}
                      onChange={(event) =>
                        setReportWeekFilter(Number(event.target.value))
                      }
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                    >
                      {WEEK_NUMBERS.map((week) => (
                        <option key={week} value={week}>
                          Ciclo {week}
                        </option>
                      ))}
                    </select>
                    <select
                      value={reportDayFilter}
                      onChange={(event) =>
                        setReportDayFilter(event.target.value)
                      }
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700"
                    >
                      <option value="all">Todos os dias</option>
                      {STUDY_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {dayLabel(day)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {filteredCompletedStudyHistory.length === 0 ? (
                    <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
                      Nenhum assunto concluído para esse filtro.
                    </div>
                  ) : (
                    filteredCompletedStudyHistory.map((item) => (
                      <div
                        key={`history-${item.id}-${item.completedAt || item.completedDateLabel}`}
                        className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="green">concluído</Badge>
                              <Badge>Ciclo {item.week}</Badge>
                              <Badge>
                                {item.dayLabel || dayLabel(item.dayKey)}
                              </Badge>
                              {item.completedFromCarryover && (
                                <Badge tone="amber">feito em atraso</Badge>
                              )}
                            </div>
                            <h3 className="mt-2 font-black text-stone-950">
                              {item.subject}
                            </h3>
                            <p className="text-stone-600">{item.topic}</p>
                            {item.completedFromCarryover && (
                              <p className="mt-1 text-xs font-semibold text-emerald-700">
                                Planejado para{" "}
                                {item.dayLabel || dayLabel(item.dayKey)} e
                                concluído na {item.completedFromCarryoverDay},
                                dia {item.completedFromCarryoverAt}.
                              </p>
                            )}
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-right">
                            <p className="text-xs font-semibold text-stone-500">
                              Data de conclusão
                            </p>
                            <p className="font-black text-stone-950">
                              {item.completedDateLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="p-5">
                  <SectionTitle
                    icon={BarChart3}
                    title="Diagnóstico do ciclo"
                    subtitle="Leitura automática dos seus dados atuais."
                  />
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl bg-stone-50 p-4 text-sm">
                      <b>Melhor matéria:</b> {reportData.best}
                    </div>
                    <div className="rounded-2xl bg-stone-50 p-4 text-sm">
                      <b>Pior matéria:</b> {reportData.worst}
                    </div>
                    <div className="rounded-2xl bg-stone-50 p-4 text-sm">
                      <b>Matéria mais atrasada:</b> {reportData.mostDelayed}
                    </div>
                    <div className="rounded-2xl bg-stone-50 p-4 text-sm">
                      <b>Erro mais recorrente:</b> {reportData.topError}
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <SectionTitle
                    icon={Zap}
                    title="Próxima ação recomendada"
                    subtitle="O sistema cruza peso, pendência e prioridade."
                  />
                  <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                      Estudar agora
                    </p>
                    <h3 className="mt-2 text-2xl font-black">
                      {reportData.nextSuggestion}
                    </h3>
                    <p className="mt-2 text-sm">
                      Motivo: {reportData.nextReason}
                    </p>
                  </div>
                  <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
                    {reportData.diagnosis}
                  </div>
                </Card>
              </div>
              <Card className="p-5">
                <SectionTitle
                  icon={AlertTriangle}
                  title="Painel de risco de reprovação"
                  subtitle="Mostra todas as matérias. O risco combina peso da prova, assuntos pendentes, aproveitamento em questões e erros ativos."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {riskData.map((item) => (
                    <div
                      key={item.id}
                      className={cls(
                        "rounded-3xl border p-4 text-sm",
                        item.tone === "red"
                          ? "border-red-100 bg-red-50 text-red-800"
                          : item.tone === "amber"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-emerald-100 bg-emerald-50 text-emerald-800",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
                            Matéria
                          </p>
                          <h3 className="mt-1 break-words text-lg font-black">
                            {item.name}
                          </h3>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs font-black">
                          {item.level}
                        </span>
                      </div>
                      <div className="mt-4 rounded-2xl bg-white/70 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
                          Pontuação de risco
                        </p>
                        <p className="mt-1 text-3xl font-black">
                          {item.score}/100
                        </p>
                      </div>
                      <div className="mt-4 grid gap-2">
                        <div className="rounded-2xl bg-white/60 p-3">
                          <b>Assuntos:</b> {item.completedTopics}/
                          {item.totalTopics} concluído(s) • {item.pendingTopics}{" "}
                          pendente(s)
                        </div>
                        <div className="rounded-2xl bg-white/60 p-3">
                          <b>Questões:</b>{" "}
                          {item.totalQuestions
                            ? `${item.accuracy}% de aproveitamento em ${item.totalQuestions} questão(ões)`
                            : "sem questões registradas"}
                        </div>
                        <div className="rounded-2xl bg-white/60 p-3">
                          <b>Erros ativos:</b> {item.pendingErrors}
                        </div>
                        <div className="rounded-2xl bg-white/60 p-3">
                          <b>Peso da matéria:</b> {item.weight}
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl bg-white/70 p-3 text-xs font-semibold">
                        <b>Leitura do sistema:</b> {item.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <SectionTitle
                  icon={AlertTriangle}
                  title="Gargalos detectados"
                  subtitle="Pontos que precisam de atenção para o sistema não virar só checklist."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                    <b>
                      {questionSessions.length
                        ? "Questões registradas"
                        : "Sem questões"}
                      :
                    </b>
                    <br />
                    {questionSessions.length
                      ? "já é possível calcular aproveitamento real."
                      : "registre baterias para calcular aproveitamento real."}
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                    <b>
                      {reviews.length ? "Revisões geradas" : "Sem revisões"}:
                    </b>
                    <br />
                    {reviews.length
                      ? "acompanhe os próximos retornos."
                      : "elas aparecem ao concluir assuntos."}
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                    <b>{errors.length ? "Erros registrados" : "Sem erros"}:</b>
                    <br />
                    {errors.length
                      ? "use-os para revisar de forma direcionada."
                      : "registre os erros para gerar revisão direcionada."}
                  </div>
                </div>
              </Card>
            </motion.section>
          )}
          {view === "settings" && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SectionTitle
                icon={Settings}
                title="Configurações"
                subtitle="Defina nome, metas e importe matérias com seus assuntos."
              />
              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="space-y-3 p-5">
                  <h3 className="font-black">Dados do estudante e metas</h3>
                  <input
                    value={settings.studentName}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        studentName: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                    placeholder="Nome do estudante"
                  />
                  <input
                    value={settings.dailyHours}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        dailyHours: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3"
                    placeholder="Meta diária de horas"
                    type="number"
                    min="0"
                  />
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                      Data da prova
                    </label>
                    <input
                      value={settings.examDate || ""}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          examDate: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                      type="date"
                    />
                    <p className="mt-2 text-xs font-semibold text-stone-500">
                      Essa data alimenta a contagem regressiva visível no Painel
                      Geral.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                      Data de início do ciclo
                    </label>
                    <input
                      value={
                        settings.studyStartDate || DEFAULT_STUDY_START_DATE
                      }
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          studyStartDate: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                      type="date"
                    />
                    <p className="mt-2 text-xs font-semibold text-stone-500">
                      Essa data define o Ciclo 1. Para reiniciar o ciclo, use o
                      botão no card Sistema.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                      Meta de questões do ciclo
                    </label>
                    <p className="mt-1 text-2xl font-black text-stone-950">
                      {settings.weeklyQuestions}
                    </p>
                    <p className="text-xs font-semibold text-stone-500">
                      Calculada automaticamente:{" "}
                      {dailyQuestionTarget(scheduleConfig)} questões/dia × 6
                      dias de estudo.
                    </p>
                  </div>
                  <button
                    onClick={saveSettings}
                    className="w-full rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                  >
                    <Save size={16} className="inline" /> Salvar configurações
                  </button>
                  {settingsSaved && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                      Configurações salvas.
                    </div>
                  )}
                </Card>
                <Card className="space-y-4 p-5">
                  <div>
                    <h3 className="font-black">Configurar geração do ciclo</h3>
                    <p className="text-sm text-stone-500">
                      Salve os parâmetros do ciclo. Ao alterar minutos ou horas
                      por dia, o sistema recalcula os tempos dos blocos já
                      existentes; ao alterar matérias por dia, ele oferece gerar
                      novamente o ciclo.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                        Matérias por dia
                      </label>
                      <input
                        value={cycleDraftConfig.subjectsPerDay}
                        onChange={(event) =>
                          setCycleDraftConfig((current) => ({
                            ...current,
                            subjectsPerDay: event.target.value,
                          }))
                        }
                        type="number"
                        min="1"
                        className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                        Minutos de estudo
                      </label>
                      <input
                        value={cycleDraftConfig.dailyStudyMinutes}
                        onChange={(event) =>
                          setCycleDraftConfig((current) => ({
                            ...current,
                            dailyStudyMinutes: event.target.value,
                          }))
                        }
                        type="number"
                        min="60"
                        className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
                        Questões do dia
                      </label>
                      <input
                        value={cycleDraftConfig.questionMinutes}
                        onChange={(event) =>
                          setCycleDraftConfig((current) => ({
                            ...current,
                            questionMinutes: event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3"
                        placeholder="Ex: 50"
                      />
                      <p className="mt-2 text-xs font-semibold text-stone-500">
                        Ao salvar, a meta do ciclo vira{" "}
                        {dailyQuestionTarget(cycleDraftConfig) *
                          STUDY_DAYS.length}{" "}
                        questões.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-black text-stone-950">
                      Como dividir assuntos?
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <button
                        onClick={() =>
                          setCycleDraftConfig((current) => ({
                            ...current,
                            mode: "peso",
                          }))
                        }
                        className={cls(
                          "rounded-2xl border px-4 py-3 text-sm font-semibold",
                          cycleDraftConfig.mode === "peso"
                            ? "border-stone-950 bg-stone-950 text-white"
                            : "border-stone-200 bg-white text-stone-700",
                        )}
                      >
                        Automático por peso
                      </button>
                      <button
                        onClick={() =>
                          setCycleDraftConfig((current) => ({
                            ...current,
                            mode: "manual",
                          }))
                        }
                        className={cls(
                          "rounded-2xl border px-4 py-3 text-sm font-semibold",
                          cycleDraftConfig.mode === "manual"
                            ? "border-stone-950 bg-stone-950 text-white"
                            : "border-stone-200 bg-white text-stone-700",
                        )}
                      >
                        Limite manual por matéria
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-stone-500">
                      No modo automático, o sistema calcula quantos assuntos
                      cabem no tempo da matéria. Assunto difícil consome mais
                      tempo; se não couber, entra só um.
                    </p>
                  </div>
                  {cycleDraftConfig.mode === "manual" && (
                    <div className="space-y-2">
                      <p className="text-sm font-black text-stone-950">
                        Assuntos por matéria
                      </p>
                      {roadmap.map((subject) => (
                        <div
                          key={subject.id}
                          className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-3 md:grid-cols-[1fr_120px] md:items-center"
                        >
                          <div>
                            <p className="font-semibold text-stone-900">
                              {subject.subject}
                            </p>
                            <p className="text-xs text-stone-500">
                              Peso {subject.weight} •{" "}
                              {
                                subject.topics.filter((topic) => !topic.done)
                                  .length
                              }{" "}
                              pendente(s)
                            </p>
                          </div>
                          <input
                            value={
                              cycleDraftConfig.topicLimits?.[subject.id] || ""
                            }
                            onChange={(event) =>
                              updateScheduleTopicLimit(
                                subject.id,
                                event.target.value,
                              )
                            }
                            type="number"
                            min="1"
                            placeholder="Qtd."
                            className="rounded-2xl border border-stone-200 px-4 py-3"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={saveCycleConfig}
                    className="w-full rounded-2xl bg-stone-950 px-4 py-3 font-semibold text-white"
                  >
                    <Save size={16} className="inline" /> Salvar configuração do
                    ciclo
                  </button>
                </Card>
                <Card className="space-y-3 p-5 xl:col-span-2">
                  <h3 className="font-black">Sistema</h3>
                  <button
                    onClick={exportBackup}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left font-semibold"
                  >
                    Exportar backup local
                  </button>
                  <input
                    id="backup-import"
                    type="file"
                    accept=".json"
                    onChange={importBackup}
                    className="hidden"
                  />
                  <button
                    onClick={() =>
                      document.getElementById("backup-import")?.click()
                    }
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left font-semibold"
                  >
                    Importar backup
                  </button>
                  <button
                    onClick={restartCycleAtWeekOne}
                    className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left font-semibold text-amber-800"
                  >
                    Reiniciar ciclo no Ciclo 1
                    <span className="mt-1 block text-xs font-semibold text-amber-700">
                      Mantém seus registros e coloca o Ciclo 1 no dia atual.
                    </span>
                  </button>
                  <button
                    onClick={resetSystem}
                    className="w-full rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-left font-semibold text-red-700"
                  >
                    Resetar progresso
                  </button>
                </Card>
              </div>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
}
