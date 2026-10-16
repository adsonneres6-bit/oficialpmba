import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateScheduleContestCoverage,
  calculateScheduleSubjectFrequency,
  collectScheduleExamLabels,
} from "./scheduleFrequency.js";

const subjects = [{ id: "law", name: "Direito" }];
const roadmap = [
  {
    id: "law",
    topics: [
      { id: "shared", title: "Princípios", examLabels: ["PMBA", "PMPE"] },
      { id: "exclusive", title: "Organização", examLabels: ["PMPE"] },
    ],
  },
];
const scheduleItems = [
  { id: "a", subjectId: "law", topicId: "shared", week: 1 },
  { id: "b", subjectId: "law", topicId: "shared", week: 1 },
  { id: "c", subjectId: "law", topicId: "exclusive", week: 1 },
  { id: "d", subjectId: "law", topicId: "shared", week: 2 },
  { id: "e", subjectId: "law", topicId: "exclusive", week: 1 },
  { id: "q", subjectId: "questoes", topicId: "shared", week: 1 },
];

test("counts only actual topic blocks in the selected cycle and contest", () => {
  const [result] = calculateScheduleSubjectFrequency({
    subjects,
    roadmap,
    scheduleItems,
    cycle: 1,
    examLabel: "PMPE",
  });

  assert.equal(result.count, 4);
  assert.deepEqual(
    result.topicFrequencies.map(({ topic, count }) => [topic.id, count]),
    [
      ["shared", 2],
      ["exclusive", 2],
    ],
  );
});

test("includes a shared topic once per scheduled block and discovers labels dynamically", () => {
  const [result] = calculateScheduleSubjectFrequency({
    subjects,
    roadmap,
    scheduleItems,
    cycle: "all",
    examLabel: "PMBA",
  });

  assert.equal(result.count, 3);
  assert.deepEqual(result.topicFrequencies.map(({ count }) => count), [3]);
  assert.deepEqual(collectScheduleExamLabels(roadmap), ["PMBA", "PMPE"]);
});

test("contest coverage counts each linked matter once and only when it has a scheduled topic", () => {
  const coverage = calculateScheduleContestCoverage({
    roadmap: [
      ...roadmap,
      {
        id: "language",
        topics: [{ id: "grammar", title: "GramÃ¡tica", examLabels: ["PMPE"] }],
      },
      {
        id: "history",
        topics: [{ id: "brazil", title: "Brasil", examLabels: ["PMPE"] }],
      },
    ],
    frequencies: [
      { id: "law", topicFrequencies: [{ count: 2 }] },
      { id: "language", topicFrequencies: [{ count: 1 }] },
      { id: "history", topicFrequencies: [] },
    ],
    examLabel: "PMPE",
  });

  assert.deepEqual(coverage, {
    total: 3,
    covered: 2,
    uncovered: 1,
    percent: 67,
  });
});
