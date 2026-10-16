import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeRegeneratedSchedule,
  nextAvailableCycle,
} from "./cycleGeneration.js";

test("next cycle is available immediately regardless of weekday or pending work", () => {
  assert.equal(nextAvailableCycle(1), 2);
  assert.equal(nextAvailableCycle(4), 5);
  assert.equal(nextAvailableCycle(12), null);
});

test("regeneration preserves completed and in-progress history and archives unmatched work", () => {
  const completed = {
    id: "done",
    week: 1,
    dayKey: "segunda",
    subjectId: "math",
    topicId: "fractions",
    status: "concluido",
    completedAt: "2026-10-01T12:00:00Z",
    elapsedSeconds: 600,
  };
  const inProgress = {
    id: "running",
    week: 2,
    dayKey: "terca",
    subjectId: "math",
    topicId: "algebra",
    status: "andamento",
    elapsedSeconds: 180,
    timerStartedAt: "2026-10-02T10:00:00Z",
  };
  const pending = {
    id: "pending",
    week: 3,
    dayKey: "quarta",
    subjectId: "law",
    topicId: "constitution",
    status: "pendente",
    elapsedSeconds: 45,
  };
  const regenerated = [
    { ...completed, status: "pendente", elapsedSeconds: 0 },
    { ...inProgress, status: "pendente", elapsedSeconds: 0 },
  ];

  const result = mergeRegeneratedSchedule(regenerated, [completed, inProgress, pending]);

  assert.equal(result.find((item) => item.id === "done").status, "concluido");
  assert.equal(result.find((item) => item.id === "done").completedAt, completed.completedAt);
  assert.equal(result.find((item) => item.id === "running").status, "andamento");
  assert.equal(result.find((item) => item.id === "running").elapsedSeconds, 180);
  assert.equal(result.find((item) => item.id === "running").timerStartedAt, inProgress.timerStartedAt);
  assert.deepEqual(result.find((item) => item.id === "pending"), {
    ...pending,
    archived: true,
  });
});

for (const limit of [2, 3, 4]) {
  test(`regenerating all 12 cycles with ${limit} subjects per day does not append stale blocks`, () => {
    const generated = [];
    const oldSchedule = [];
    const days = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    for (let week = 1; week <= 12; week += 1) {
      for (const [dayIndex, dayKey] of days.entries()) {
        for (let slot = 0; slot < limit; slot += 1) {
          generated.push({
            id: `new-w${week}-${dayKey}-${slot}`,
            week,
            dayKey,
            subjectId: `subject-${slot}`,
            topicId: `topic-${week}-${dayKey}-${slot}`,
            type: "Estudo",
            status: "pendente",
          });
        }
        oldSchedule.push({
          id: `stale-w${week}-${dayKey}`,
          week,
          dayKey,
          subjectId: `legacy-subject-${week}-${dayIndex}`,
          topicId: `legacy-topic-${week}-${dayIndex}`,
          type: "Estudo",
          status: "pendente",
        });
      }
    }
    oldSchedule.push({
      id: "historical-completed",
      week: 4,
      dayKey: "segunda",
      subjectId: "history",
      topicId: "finished-topic",
      type: "Estudo",
      status: "concluido",
      completedAt: "2026-10-10T10:00:00Z",
    });

    const result = mergeRegeneratedSchedule(generated, oldSchedule);
    const activeByDay = new Map();
    result
      .filter((item) => item.type === "Estudo" && !item.archived)
      .forEach((item) => {
        const key = `${item.week}-${item.dayKey}`;
        activeByDay.set(key, [...(activeByDay.get(key) || []), item]);
      });

    assert.equal(activeByDay.size, 72);
    for (const items of activeByDay.values()) assert.ok(items.length <= limit);
    assert.equal(result.find((item) => item.id === "historical-completed").archived, true);
  });
}
