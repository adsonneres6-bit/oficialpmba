import assert from "node:assert/strict";
import test from "node:test";
import {
  attachExamCompetitionData,
  collectExamLabels,
  compareExamTopicPriority,
  mergeExamCompetitions,
  parseExamWorkbookRows,
  preserveExamLabels,
  validateExamCompetitions,
} from "./examWorkbook.js";

const header = ["Matéria", "Peso", "Assunto", "Prioridade", "Concurso"];

test("parses each row's exact concurso list without changing topic titles", () => {
  const parsed = parseExamWorkbookRows([
    header,
    ["Português", 3, "Texto original", "Alta", "PMBA, PMPE, PMAL"],
    ["", "", "Outro assunto", "Média", "PMPE"],
  ]);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.subjects[0].topics[0].text, "Texto original");
  assert.deepEqual(parsed.subjects[0].topics[0].examLabels, ["PMBA", "PMPE", "PMAL"]);
  assert.deepEqual(parsed.subjects[0].topics[1].examLabels, ["PMPE"]);
});

test("preserves the exact column E value for composite and full-name labels", () => {
  const topicTitle = "Assunto de exemplo para testar preservação de dados";
  const labels = [
    "AL + PE",
    "os 3",
    "Polícia Militar do Estado de Alagoas",
  ];
  const parsed = parseExamWorkbookRows([
    header,
    ["Matemática", 3, topicTitle, "Alta", labels[0]],
    ["", "", "Outro tópico compartilhado", "Média", labels[1]],
    ["", "", "Outro tópico de rótulo formal", "Baixa", labels[2]],
  ]);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.subjects[0].topics[0].text, topicTitle);
  assert.deepEqual(parsed.subjects[0].topics.map((topic) => topic.examLabels[0]), labels);
});

test("rejects a missing or incorrect Concurso header", () => {
  assert.match(parseExamWorkbookRows([[...header.slice(0, 4), "Concursos"]]).error, /Cabeçalho inválido/);
  assert.match(parseExamWorkbookRows([[...header.slice(0, 4), ""]]).error, /Cabeçalho inválido/);
});

test("reports missing required values and malformed concursos with row numbers", () => {
  const parsed = parseExamWorkbookRows([
    header,
    ["Português", 3, "Texto", "Alta", "?"],
    ["Matemática", "", "", "", ""],
  ]);
  assert.match(parsed.error, /Linha 2: concurso inválido na coluna E/);
  assert.match(parsed.error, /Linha 3: informe o assunto na coluna C/);
  assert.match(parsed.error, /Linha 3: informe ao menos um concurso na coluna E/);
});

test("resolves custom contest labels and keys", () => {
  const parsed = parseExamWorkbookRows(
    [header, ["Dir. Penal", 2, "Lei penal", "Média", "Polícia Militar X"]],
    [{ key: "pmx", label: "Polícia Militar X" }],
  );
  assert.deepEqual(parsed.subjects[0].topics[0].examLabels, ["Polícia Militar X"]);
});

test("accepts new contest names without a fixed registry", () => {
  const parsed = parseExamWorkbookRows([
    header,
    ["Português", 3, "Texto", "Alta", "Concurso Novo 2030"],
  ]);
  assert.deepEqual(parsed.subjects[0].topics[0].examLabels, ["Concurso Novo 2030"]);
});

test("keeps concursos when an imported topic is converted for storage or manual editing", () => {
  const importedTopic = {
    text: "Assunto informado",
    examLabels: ["PMBA", "PMPE", "PMAL"],
  };
  const storedTopic = {
    title: importedTopic.text,
    examLabels: preserveExamLabels(importedTopic),
  };
  const reloadedTopic = JSON.parse(JSON.stringify(storedTopic));
  const editedTopic = {
    ...reloadedTopic,
    title: "Assunto editado manualmente",
    examLabels: preserveExamLabels(reloadedTopic),
  };
  assert.deepEqual(storedTopic.examLabels, ["PMBA", "PMPE", "PMAL"]);
  assert.deepEqual(reloadedTopic.examLabels, storedTopic.examLabels);
  assert.deepEqual(editedTopic.examLabels, reloadedTopic.examLabels);
  assert.deepEqual(preserveExamLabels({}), []);
});

test("lists imported concursos and carries saved order and dates through edits", () => {
  const subjects = [
    { topics: [{ examLabels: ["PMBA", "PMPE"] }, { examLabels: ["PMBA", "PMAL"] }] },
  ];
  assert.deepEqual(collectExamLabels(subjects), ["PMBA", "PMPE", "PMAL"]);
  const merged = mergeExamCompetitions(subjects, [
    { label: "PMBA", order: "2", examDate: "2027-02-01" },
  ]);
  assert.deepEqual(merged, [
    { label: "PMBA", order: "2", examDate: "2027-02-01" },
    { label: "PMPE", order: "", examDate: "" },
    { label: "PMAL", order: "", examDate: "" },
  ]);
});

test("validates unique order, mandatory first-order date, and the no-date option", () => {
  assert.match(validateExamCompetitions([{ label: "PMBA", order: "" }]), /Selecione a ordem/);
  assert.match(validateExamCompetitions([
    { label: "PMBA", order: "1", examDate: "" },
    { label: "PMPE", order: "1", examDate: "" },
  ]), /ordem diferente/);
  assert.match(validateExamCompetitions([{ label: "PMPE", order: "2", examDate: "" }]), /ordem 1/);
  assert.match(validateExamCompetitions([{ label: "PMBA", order: "1", examDate: "" }]), /Informe a data/);
  assert.equal(validateExamCompetitions([{ label: "PMBA", order: "1", examDate: "" }], true), "");
  assert.equal(validateExamCompetitions([
    { label: "PMBA", order: "1", examDate: "2027-01-02" },
    { label: "PMPE", order: "2", examDate: "" },
    { label: "PMAL", order: "3", examDate: "" },
  ]), "");
  assert.match(validateExamCompetitions([
    { label: "PMBA", order: "1" },
    { label: "PMPE", order: "2" },
    { label: "PMAL", order: "3" },
    { label: "Outro", order: "4" },
  ]), /mais de 3/);
});

test("schedules by nearest associated exam and keeps undated contests in maintenance rotation", () => {
  const exams = [
    { label: "Concurso Alfa", order: "3", examDate: "2027-02-01" },
    { label: "Concurso Beta", order: "2", examDate: "2027-01-01" },
    { label: "Concurso Gama", order: "1", examDate: "" },
  ];
  const roadmap = attachExamCompetitionData([
    { subject: "Língua", topics: [
      { id: "shared", title: "Tema compartilhado", examLabels: ["Concurso Alfa", "Concurso Beta"] },
      { id: "maintenance", title: "Tema sem data", examLabels: ["Concurso Gama"] },
    ] },
  ], exams);
  assert.equal(roadmap[0].topics.length, 2);
  assert.deepEqual(roadmap[0].topics[0].examCompetitions, exams.slice(0, 2));
  assert.ok(compareExamTopicPriority(roadmap[0].topics[0], roadmap[0].topics[1], new Date("2026-10-16")) < 0);

  const withoutDates = exams.map((item) => ({ ...item, examDate: "" }));
  const maintenanceRoadmap = attachExamCompetitionData(roadmap, withoutDates);
  assert.ok(compareExamTopicPriority(maintenanceRoadmap[0].topics[1], maintenanceRoadmap[0].topics[0], new Date("2026-10-16")) < 0);
});
