import assert from "node:assert/strict";
import test from "node:test";
import { mergeManualScheduleWeek } from "./manualSchedule.js";

function scheduleItem(id, week, dayKey, topicId, properties = {}) {
  return {
    id,
    week,
    dayKey,
    subjectId: "direito",
    topicId,
    topicIds: [topicId],
    status: "pendente",
    elapsedSeconds: 0,
    ...properties,
  };
}

test("preserves the identifier and progress when an assignment moves", () => {
  const result = mergeManualScheduleWeek({
    weeklySchedule: [
      scheduleItem("stable-id", 3, "segunda", "constitucional", {
        status: "concluido",
        elapsedSeconds: 3600,
        baseElapsedSeconds: 3600,
        completedAt: "2026-10-12T10:00:00Z",
      }),
    ],
    newItems: [
      scheduleItem("new-generated-id", 3, "quarta", "constitucional"),
    ],
    week: 3,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "stable-id");
  assert.equal(result[0].status, "concluido");
  assert.equal(result[0].elapsedSeconds, 3600);
  assert.equal(result[0].completedAt, "2026-10-12T10:00:00Z");
  assert.equal(result[0].dayKey, "quarta");
});

test("archives removed study history but removes an untouched pending item", () => {
  const result = mergeManualScheduleWeek({
    weeklySchedule: [
      scheduleItem("recorded", 3, "segunda", "administrativo", {
        status: "andamento",
        elapsedSeconds: 900,
      }),
      scheduleItem("question-linked", 3, "terça", "constitucional"),
      scheduleItem("untouched", 3, "quarta", "tributario"),
      scheduleItem("other-week", 4, "segunda", "penal", {
        status: "concluido",
      }),
    ],
    newItems: [],
    week: 3,
    historicalIds: ["question-linked"],
  });

  assert.equal(result.find((item) => item.id === "recorded").archived, true);
  assert.equal(result.find((item) => item.id === "recorded").elapsedSeconds, 900);
  assert.equal(result.find((item) => item.id === "recorded").timerStartedAt, null);
  assert.equal(result.find((item) => item.id === "question-linked").archived, true);
  assert.equal(result.some((item) => item.id === "untouched"), false);
  assert.equal(result.find((item) => item.id === "other-week").status, "concluido");
});

test("splitting a completed block keeps its history and completed topic status", () => {
  const result = mergeManualScheduleWeek({
    weeklySchedule: [
      scheduleItem("combined-id", 2, "segunda", "topic-a", {
        topicIds: ["topic-a", "topic-b"],
        status: "concluido",
        elapsedSeconds: 1500,
      }),
    ],
    newItems: [
      scheduleItem("split-a", 2, "terça", "topic-a"),
      scheduleItem("split-b", 2, "quarta", "topic-b"),
    ],
    week: 2,
  });

  assert.equal(result.find((item) => item.id === "combined-id").archived, true);
  assert.equal(result.find((item) => item.id === "combined-id").elapsedSeconds, 1500);
  assert.equal(result.find((item) => item.id === "split-a").status, "concluido");
  assert.equal(result.find((item) => item.id === "split-b").status, "concluido");
});

test("preserves saved study data through a JSON persistence round trip", () => {
  const result = mergeManualScheduleWeek({
    weeklySchedule: [
      scheduleItem("persistent-id", 5, "sexta", "constitucional", {
        status: "concluido",
        elapsedSeconds: 5400,
        baseElapsedSeconds: 5400,
        completedAt: "2026-10-10T10:00:00Z",
      }),
    ],
    newItems: [scheduleItem("regenerated-id", 5, "sexta", "constitucional")],
    week: 5,
  });

  const state = {
    currentStudyWeek: 5,
    currentStudyDayKey: "sexta",
    weeklySchedule: result,
    questionSessions: [{ id: "session-1", done: 18, correct: 13 }],
    reviews: [{ id: "review-1", status: "concluida" }],
    studyStreak: 7,
  };
  const reloadedState = JSON.parse(JSON.stringify(state));
  const savedItem = reloadedState.weeklySchedule[0];
  assert.equal(reloadedState.currentStudyWeek, 5);
  assert.equal(reloadedState.currentStudyDayKey, "sexta");
  assert.deepEqual(reloadedState.questionSessions, state.questionSessions);
  assert.deepEqual(reloadedState.reviews, state.reviews);
  assert.equal(reloadedState.studyStreak, 7);
  assert.equal(savedItem.id, "persistent-id");
  assert.equal(savedItem.status, "concluido");
  assert.equal(savedItem.elapsedSeconds, 5400);
  assert.equal(savedItem.completedAt, "2026-10-10T10:00:00Z");
});
