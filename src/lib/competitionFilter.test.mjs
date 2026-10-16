import test from "node:test";
import assert from "node:assert/strict";
import {
  competitionsFromLabels,
  topicsForCompetition,
} from "./competitionFilter.js";

const topics = [
  { title: "Português comum", examLabels: ["os 3"] },
  { title: "Abuso de autoridade", examLabels: ["AL + PE"] },
  { title: "Direitos da Bahia", examLabels: ["AL + BA"] },
  { title: "Legislação compartilhada", examLabels: ["PE + BA"] },
  { title: "História de Alagoas", examLabels: ["AL"] },
  { title: "História de Pernambuco", examLabels: ["PMPE"] },
  { title: "História da Bahia", examLabels: ["PMBA"] },
  { title: "Rótulo parecido, sem vínculo", examLabels: ["PMALICIA"] },
  { title: "Rótulo desconhecido", examLabels: ["Concurso Bahia"] },
  { title: "Nome oficial", examLabels: ["Polícia Militar de Alagoas"] },
];

test("filters exclusive and shared labels for each exact competition", () => {
  assert.deepEqual(topicsForCompetition(topics, "PMAL").map((topic) => topic.title), [
    "Português comum", "Abuso de autoridade", "Direitos da Bahia",
    "História de Alagoas", "Nome oficial",
  ]);
  assert.deepEqual(topicsForCompetition(topics, "PMPE").map((topic) => topic.title), [
    "Português comum", "Abuso de autoridade", "Legislação compartilhada",
    "História de Pernambuco",
  ]);
  assert.deepEqual(topicsForCompetition(topics, "PMBA").map((topic) => topic.title), [
    "Português comum", "Direitos da Bahia", "Legislação compartilhada",
    "História da Bahia",
  ]);
});

test("recognizes official names and does not match partial acronyms", () => {
  assert.equal(topicsForCompetition([{ examLabels: ["Polícia Militar de Pernambuco"] }], "PMPE").length, 1);
  assert.equal(topicsForCompetition([{ examLabels: ["PMBAL"] }], "PMBA").length, 0);
  assert.equal(topicsForCompetition([{ examLabels: ["Conteúdo da Bahia"] }], "PMBA").length, 0);
});

test("normalizes full state police names and composite column E labels consistently", () => {
  assert.deepEqual(
    competitionsFromLabels(["Polícia Militar do Estado de Alagoas"]),
    ["PMAL"],
  );
  assert.deepEqual(
    competitionsFromLabels(["Polícia Militar do Estado de Pernambuco + PMBA"]),
    ["PMPE", "PMBA"],
  );
  assert.deepEqual(competitionsFromLabels(["os 3"]), ["PMAL", "PMPE", "PMBA"]);
  assert.deepEqual(competitionsFromLabels(["PMAL/PMPE"]), ["PMAL", "PMPE"]);
});

test("competition filtering composes with subject, topic, status, and priority filters", () => {
  const roadmap = [
    { subject: "Direitos Humanos", topics: [
      { id: "shared", title: "Abuso de autoridade", examLabels: ["AL + PE"], done: false, priority: "Alta" },
      { id: "ba-only", title: "Tema BA", examLabels: ["BA"], done: false, priority: "Alta" },
      { id: "completed", title: "Tema concluído", examLabels: ["PMAL"], done: true, priority: "Alta" },
    ] },
    { subject: "Português", topics: [
      { id: "low", title: "Gêneros textuais", examLabels: ["os 3"], done: false, priority: "Baixa" },
    ] },
  ];
  const result = roadmap
    .filter((subject) => subject.subject === "Direitos Humanos")
    .flatMap((subject) => topicsForCompetition(subject.topics, "PMAL"))
    .filter((topic) => topic.title === "Abuso de autoridade" && !topic.done && topic.priority === "Alta");
  assert.deepEqual(result.map((topic) => topic.id), ["shared"]);
});
