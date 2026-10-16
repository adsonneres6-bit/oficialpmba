import assert from "node:assert/strict";
import test from "node:test";
import { filterRoadmapAndSummarize } from "./roadmapFilterStats.js";

const roadmap = [
  {
    id: "matematica",
    subject: "Matemática",
    topics: [
      { id: "common", title: "Proporções", examLabels: ["os 3"], done: true, priority: "Alta", difficulty: "Alta" },
      { id: "alpe", title: "Álgebra", examLabels: ["AL + PE"], done: false, priority: "Alta", difficulty: "Média" },
      { id: "alba", title: "Geometria", examLabels: ["AL + BA"], done: false, priority: "Baixa", difficulty: "Baixa" },
      { id: "peba", title: "Estatística", examLabels: ["PE + BA"], done: true, priority: "Média", difficulty: "Alta" },
      { id: "al", title: "Tema AL", examLabels: ["AL"], done: false, priority: "Alta", difficulty: "Alta" },
      { id: "pe", title: "Tema PE", examLabels: ["PE"], done: true, priority: "Baixa", difficulty: "Média" },
      { id: "ba", title: "Tema BA", examLabels: ["BA"], done: false, priority: "Alta", difficulty: "Baixa" },
    ],
  },
  {
    id: "portugues",
    subject: "Língua Portuguesa",
    topics: [
      { id: "textos", title: "Gêneros textuais", examLabels: ["os 3"], done: false, priority: "Média", difficulty: "Baixa" },
    ],
  },
];

function assertStatsMatchVisibleList(result) {
  const visible = result.subjects.flatMap((subject) => subject.topics);
  const { stats } = result;
  assert.equal(stats.total, visible.length);
  assert.equal(stats.done, visible.filter((topic) => topic.done).length);
  assert.equal(stats.pending, visible.filter((topic) => !topic.done).length);
  assert.equal(stats.done + stats.pending, stats.total);
  assert.equal(stats.highPriority, visible.filter((topic) => topic.priority === "Alta").length);
  assert.equal(stats.mediumPriority, visible.filter((topic) => topic.priority === "Média").length);
  assert.equal(stats.lowPriority, visible.filter((topic) => topic.priority === "Baixa").length);
  assert.equal(stats.percent, stats.total ? Math.round((stats.done / stats.total) * 100) : 0);
}

test("all competitions count a shared topic record once", () => {
  const result = filterRoadmapAndSummarize(roadmap);
  assertStatsMatchVisibleList(result);
  assert.equal(result.stats.total, 8);
  assert.equal(result.stats.done, 3);
  assert.equal(result.stats.pending, 5);
  assert.equal(result.stats.highPriority, 4);
});

test("each competition counts only its exclusive and shared topics", () => {
  const expected = {
    PMAL: { total: 5, done: 1, pending: 4, percent: 20 },
    PMPE: { total: 5, done: 3, pending: 2, percent: 60 },
    PMBA: { total: 5, done: 2, pending: 3, percent: 40 },
  };
  for (const [competition, stats] of Object.entries(expected)) {
    const result = filterRoadmapAndSummarize(roadmap, { competition });
    assertStatsMatchVisibleList(result);
    for (const [key, value] of Object.entries(stats)) assert.equal(result.stats[key], value);
  }
});

test("competition filters combine with priority, subject, topic, and both statuses", () => {
  const highPriorityCounts = { PMAL: 3, PMPE: 2, PMBA: 2 };
  for (const competition of ["PMAL", "PMPE", "PMBA"]) {
    const high = filterRoadmapAndSummarize(roadmap, { competition, priority: "Alta" });
    assertStatsMatchVisibleList(high);
    assert.equal(high.stats.total, highPriorityCounts[competition]);
    assert.equal(high.stats.highPriority, highPriorityCounts[competition]);
    assert.ok(high.subjects.flatMap((subject) => subject.topics).every((topic) => topic.priority === "Alta"));

    for (const status of ["pendentes", "concluidos"]) {
      const topicId = status === "concluidos"
        ? "common"
        : competition === "PMBA" ? "alba" : "alpe";
      const result = filterRoadmapAndSummarize(roadmap, {
        competition,
        subjectId: "matematica",
        topicId,
        status,
      });
      assertStatsMatchVisibleList(result);
      assert.equal(result.stats.total, 1);
      assert.equal(result.stats.done, status === "concluidos" ? 1 : 0);
      assert.equal(result.stats.pending, status === "pendentes" ? 1 : 0);
    }
  }
});

test("zero matches return zero counts and zero progress", () => {
  const result = filterRoadmapAndSummarize(roadmap, {
    competition: "PMBA",
    subjectId: "matematica",
    topicId: "missing",
    status: "pendentes",
    priority: "Baixa",
  });
  assertStatsMatchVisibleList(result);
  assert.deepEqual(result.subjects, []);
  assert.deepEqual(result.stats, {
    total: 0,
    done: 0,
    pending: 0,
    percent: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0,
    hardest: 0,
    mediumDifficulty: 0,
    lowDifficulty: 0,
  });
});

test("search uses the same records for the visible list and summary", () => {
  const result = filterRoadmapAndSummarize(roadmap, {
    competition: "PMAL",
    search: "ÁLGEBRA",
  });
  assertStatsMatchVisibleList(result);
  assert.deepEqual(result.subjects.flatMap((subject) => subject.topics.map((topic) => topic.id)), ["alpe"]);
  assert.equal(result.stats.total, 1);
  assert.equal(result.stats.pending, 1);
});
