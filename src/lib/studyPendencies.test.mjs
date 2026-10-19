import test from "node:test";
import assert from "node:assert/strict";
import {
  previousScheduledStudyDay,
  recoverableStudyPendencies,
} from "./studyPendencies.js";

function studyBlock(id, week, dayKey, properties = {}) {
  return {
    id,
    week,
    dayKey,
    subjectId: "subject-a",
    topicId: `topic-${id}`,
    status: "pendente",
    ...properties,
  };
}

test("a pending Saturday block is counted and recovered on Monday of the next cycle", () => {
  const source = studyBlock("saturday-block", 2, "sabado");
  const carryover = studyBlock("carry-saturday-block", 3, "segunda", {
    carryover: true,
    carryoverSourceId: source.id,
    carryoverSourceWeek: 2,
    carryoverSourceDay: "sabado",
    carryoverFrom: "Sábado",
  });
  const pendencies = recoverableStudyPendencies(
    [source, carryover],
    "segunda",
    3,
  );

  assert.deepEqual(previousScheduledStudyDay("segunda", 3), {
    dayKey: "sabado",
    week: 2,
  });
  assert.equal(pendencies.length, 1);
  assert.equal(pendencies[0].carryoverSourceId, source.id);
  assert.equal(pendencies[0].carryoverFrom, "Sábado");
});

test("completed Saturday blocks do not create a false pending alert", () => {
  const saturday = studyBlock("done-saturday", 2, "sabado", {
    status: "concluido",
  });
  assert.deepEqual(
    recoverableStudyPendencies([
      saturday,
      studyBlock("stale-carry", 3, "segunda", {
        carryover: true,
        carryoverSourceId: saturday.id,
      }),
    ], "segunda", 3),
    [],
  );
});

test("only pending blocks are counted when completed and pending blocks share a day", () => {
  const schedule = [
    studyBlock("done", 2, "sabado", { status: "concluido" }),
    studyBlock("pending", 2, "sabado"),
  ];
  assert.deepEqual(
    recoverableStudyPendencies(schedule, "segunda", 3).map((item) => item.id),
    ["pending"],
  );
});

test("the first Monday of cycle one has no recoverable previous study day", () => {
  assert.equal(previousScheduledStudyDay("segunda", 1), null);
  assert.deepEqual(
    recoverableStudyPendencies(
      [studyBlock("week-one-saturday", 1, "sabado")],
      "segunda",
      1,
    ),
    [],
  );
});

test("completing a recovered block removes it from the count", () => {
  const recovered = studyBlock("carry-block", 3, "segunda", {
    carryover: true,
    carryoverSourceId: "source-block",
    carryoverFrom: "Sábado",
  });
  assert.equal(recoverableStudyPendencies([recovered], "segunda", 3).length, 1);
  const completedSchedule = [
    { ...recovered, status: "concluido" },
    studyBlock("source-block", 2, "sabado", { status: "concluido" }),
  ];
  assert.equal(
    recoverableStudyPendencies(completedSchedule, "segunda", 3).length,
    0,
  );
});

test("persisted schedule data yields the same count after reload", () => {
  const schedule = [
    studyBlock("saturday", 2, "sabado"),
    studyBlock("carry-saturday", 3, "segunda", {
      carryover: true,
      carryoverSourceId: "saturday",
      carryoverFrom: "Sábado",
    }),
  ];
  const restored = JSON.parse(JSON.stringify(schedule));
  assert.deepEqual(
    recoverableStudyPendencies(restored, "segunda", 3),
    recoverableStudyPendencies(schedule, "segunda", 3),
  );
});

test("week changes ignore unrelated pending days while retaining the prior Saturday", () => {
  const schedule = [
    studyBlock("old-wednesday", 2, "quarta"),
    studyBlock("prior-saturday", 2, "sabado"),
    studyBlock("next-monday", 3, "segunda"),
  ];
  assert.deepEqual(
    recoverableStudyPendencies(schedule, "segunda", 3).map((item) => item.id),
    ["prior-saturday"],
  );
});
