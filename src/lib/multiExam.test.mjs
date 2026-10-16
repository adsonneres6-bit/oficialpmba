import assert from "node:assert/strict";
import test from "node:test";
import {
  consolidateImportedRoadmap,
  examTopicPriority,
  normalizeExamWorkbookRows,
  recalculateConsolidatedTopic,
  resolveExamCombination,
} from "./multiExam.js";

const exams = [
  { key: "pmba", label: "PMBA", examDate: "2026-12-01" },
  { key: "pmpe", label: "PMPE", examDate: "2027-01-10" },
  { key: "pmal", label: "PMAL", examDate: "" },
];
const parse = (name, rows, fallbackExamKeys = []) => normalizeExamWorkbookRows(rows, name, fallbackExamKeys, exams);

test("resolves supported individual and combined PMBA, PMPE and PMAL identifiers", () => {
  assert.deepEqual(resolveExamCombination("PMBA + PMPE", exams).examKeys, ["pmba", "pmpe"]);
  assert.deepEqual(resolveExamCombination("PMBA + PMPE + PMAL", exams).examKeys, ["pmba", "pmpe", "pmal"]);
  assert.deepEqual(resolveExamCombination("PMAL + PMPE", exams).examKeys, ["pmal", "pmpe"]);
  assert.deepEqual(resolveExamCombination("PMBA", exams).examKeys, ["pmba"]);
  assert.deepEqual(resolveExamCombination(" PMPE   +   PMBA ", exams).examKeys, ["pmpe", "pmba"]);
  assert.deepEqual(resolveExamCombination("PMPE + PMBA", exams).examKeys.sort(), resolveExamCombination("PMBA + PMPE", exams).examKeys.sort());
});

test("recognizes siglas from existing full contest names and keys", () => {
  const existing = [
    { key: "soldado-bahia", label: "Polícia Militar da Bahia - Soldado" },
    { key: "soldado-pernambuco", label: "Polícia Militar de Pernambuco" },
    { key: "soldado-alagoas", label: "Polícia Militar de Alagoas" },
  ];
  assert.deepEqual(resolveExamCombination("PMBA + PMPE + PMAL", existing).examKeys, ["soldado-bahia", "soldado-pernambuco", "soldado-alagoas"]);
});

test("column E links each row to the exact concursos and consolidates shared content once", () => {
  const imported = parse("concursos.xlsx", [
    ["Matéria", "Peso", "Assunto", "Prioridade", "Concursos"],
    ["Língua Portuguesa", 3, "Interpretação de textos", "Alta", "PMBA + PMPE"],
    ["Matemática", 2, "Razão e proporção", "Média", "PMBA + PMPE + PMAL"],
    ["Direito Penal", 3, "Aplicação da lei penal", "Alta", "PMAL + PMPE"],
    ["História", 2, "História da Bahia", "Alta", "PMBA"],
  ]);
  const result = consolidateImportedRoadmap([], [imported]);
  const topic = (subject, title) => result.roadmap.find((item) => item.subject === subject).topics.find((item) => item.title === title);
  assert.deepEqual(new Set(topic("Língua Portuguesa", "Interpretação de textos").examIds), new Set(["pmba", "pmpe"]));
  assert.deepEqual(new Set(topic("Matemática", "Razão e proporção").examIds), new Set(["pmba", "pmpe", "pmal"]));
  assert.deepEqual(new Set(topic("Direito Penal", "Aplicação da lei penal").examIds), new Set(["pmal", "pmpe"]));
  assert.deepEqual(topic("História", "História da Bahia").examIds, ["pmba"]);
  assert.equal(result.roadmap.flatMap((subject) => subject.topics).length, 4);
});

test("legacy four-column rows require a selected concurso combination", () => {
  const legacy = parse("legacy.xlsx", [["Matéria", "Peso", "Assunto", "Prioridade"], ["Matemática", 2, "Razão", "Média"]]);
  assert.deepEqual(legacy.unassignedRows, [2]);
  const unresolved = consolidateImportedRoadmap([], [legacy]);
  assert.match(unresolved.summary[0].errors[0], /linha 2/);
  const assigned = parse("legacy.xlsx", [["Matemática", 2, "Razão", "Média"]], ["pmba", "pmpe"]);
  const result = consolidateImportedRoadmap([], [assigned]);
  assert.deepEqual(new Set(result.roadmap[0].topics[0].examIds), new Set(["pmba", "pmpe"]));
  assert.equal(result.summary[0].errors.length, 0);
});

test("unknown and ambiguous competition identifiers are reported by line", () => {
  const unknown = parse("unknown.xlsx", [["Português", 2, "Texto", "Alta", "PMBX"]]);
  assert.match(unknown.errors[0], /linha 1, coluna E/);
  assert.deepEqual(unknown.subjects[0].topics[0].source.examKeys, []);
  const ambiguous = resolveExamCombination("PMBA", [{ key: "a", label: "PMBA" }, { key: "b", label: "PMBA 2027" }]);
  assert.deepEqual(ambiguous.ambiguous, ["PMBA"]);
});

test("different weights and priorities remain per concurso for one consolidated topic", () => {
  const imported = parse("per-exam-values.xlsx", [
    ["Matéria", "Peso", "Assunto", "Prioridade", "Concursos"],
    ["Português", 3, "Interpretação", "Alta", "PMBA"],
    ["Português", 2, "Interpretação", "Baixa", "PMPE"],
  ]);
  const result = consolidateImportedRoadmap([], [imported]);
  const topics = result.roadmap[0].topics;
  assert.equal(topics.length, 1);
  assert.equal(topics[0].examData.pmba.weight, 3);
  assert.equal(topics[0].examData.pmba.priority, "Alta");
  assert.equal(topics[0].examData.pmpe.weight, 2);
  assert.equal(topics[0].examData.pmpe.priority, "Baixa");
  assert.equal(topics[0].weight, 3);
  assert.equal(topics[0].priority, "Alta");
});

test("consolidated importance is max weight and max priority, never sum or average", () => {
  const first = parse("a.xlsx", [["Matéria", "Peso", "Assunto", "Prioridade", "Concursos"], ["Português", 2, "Interpretação", "Média", "PMBA"]]);
  const second = parse("b.xlsx", [["Matéria", "Peso", "Assunto", "Prioridade", "Concursos"], ["Português", 4, "Interpretação", "Baixa", "PMPE"]]);
  const topic = consolidateImportedRoadmap([], [first, second]).roadmap[0].topics[0];
  assert.equal(topic.weight, 4);
  assert.equal(topic.priority, "Média");
  assert.equal(topic.examData.pmba.weight, 2);
  assert.equal(topic.examData.pmpe.weight, 4);
  assert.equal(topic.examData.pmba.priority, "Média");
  assert.equal(topic.examData.pmpe.priority, "Baixa");
});

test("recalculating after removing an origin recomputes aggregates from remaining sources", () => {
  const topic = {
    weight: 5,
    priority: "Alta",
    examIds: ["pmba", "pmpe"],
    sourceHistory: [
      { fileName: "a.xlsx", row: 2, examKey: "pmba", weight: 5, priority: "Alta" },
      { fileName: "b.xlsx", row: 2, examKey: "pmpe", weight: 2, priority: "Baixa" },
    ],
  };
  const remaining = recalculateConsolidatedTopic({ ...topic, sourceHistory: topic.sourceHistory.slice(1) });
  assert.equal(remaining.weight, 2);
  assert.equal(remaining.priority, "Baixa");
  assert.deepEqual(remaining.examIds, ["pmpe"]);
});

test("reimport is idempotent, preserves progress IDs, and stores a shared topic once", () => {
  const imported = parse("same.xlsx", [["Matéria", "Peso", "Assunto", "Prioridade", "Concursos"], ["Português", 3, "Interpretação", "Alta", "PMBA + PMPE"]]);
  const once = consolidateImportedRoadmap([], [imported]);
  once.roadmap[0].topics[0].done = true;
  const twice = consolidateImportedRoadmap(once.roadmap, [imported]);
  assert.equal(twice.roadmap[0].topics.length, 1);
  assert.equal(twice.roadmap[0].topics[0].id, once.roadmap[0].topics[0].id);
  assert.equal(twice.roadmap[0].topics[0].done, true);
});

test("urgency recalculates from linked contest dates; undated concursos remain eligible", () => {
  const topic = { examIds: ["pmba", "pmpe", "pmal"], examData: { pmba: { weight: 2, priority: "Alta" }, pmpe: { weight: 3, priority: "Média" }, pmal: { weight: 1, priority: "Baixa" } } };
  const now = new Date("2026-10-16T12:00:00");
  const before = examTopicPriority(topic, exams, now);
  const laterDate = exams.map((exam) => exam.key === "pmba" ? { ...exam, examDate: "2027-06-01" } : exam);
  const after = examTopicPriority(topic, laterDate, now);
  assert.ok(before.score > after.score);
  assert.equal(before.examCount, 3);
  assert.ok(before.reasons.includes("presente em 3 concursos"));
});

test("malformed values identify affected spreadsheet rows", () => {
  const parsed = parse("bad.xlsx", [["Matéria", "Peso", "Assunto", "Prioridade", "Concursos"], ["Matemática", "peso?", "Proporção", "Urgente", "PMBA"]]);
  assert.ok(parsed.errors.some((error) => error.includes("linha 2") && error.includes("peso")));
  assert.ok(parsed.errors.some((error) => error.includes("linha 2") && error.includes("prioridade")));
});
