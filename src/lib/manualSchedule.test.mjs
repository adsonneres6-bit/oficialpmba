import assert from "node:assert/strict";
import test from "node:test";
import {
  applyManualScheduleEdit,
  enqueueSerializedStateSave,
  mergeManualScheduleWeek,
  mergeStudyProgress,
  resolveLoadedScheduleSources,
} from "./manualSchedule.js";

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

test("allows restructuring a cycle with pending blocks while keeping them pending", () => {
  const pending = scheduleItem("pending-cycle-5", 5, "segunda", "topic-a", {
    elapsedSeconds: 120,
    baseElapsedSeconds: 120,
  });
  const result = mergeManualScheduleWeek({
    weeklySchedule: [pending],
    newItems: [scheduleItem("edited-id", 5, "quinta", "topic-a")],
    week: 5,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].status, "pendente");
  assert.equal(result[0].dayKey, "quinta");
  assert.equal(result[0].elapsedSeconds, 120);
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

test("manual edit changes only the weekly plan and preserves the full study state", () => {
  const state = {
    activeExamKey: "pmba",
    storageProfileKey: "user__pmba",
    currentStudyWeek: 4,
    currentStudyDayKey: "quarta",
    schedule: [
      scheduleItem("today-completed", 4, "quarta", "topic-a", {
        status: "concluido",
        elapsedSeconds: 2100,
        baseElapsedSeconds: 2100,
        completedAt: "2026-10-13T11:00:00Z",
      }),
      scheduleItem("today-pending", 4, "quarta", "topic-b"),
    ],
    lastScheduleSnapshot: [
      scheduleItem("today-completed", 4, "quarta", "topic-a", {
        status: "concluido",
        elapsedSeconds: 2100,
        completedAt: "2026-10-13T11:00:00Z",
      }),
    ],
    weeklySchedule: [
      scheduleItem("today-completed", 4, "quarta", "topic-a", {
        status: "concluido",
        elapsedSeconds: 2100,
        baseElapsedSeconds: 2100,
        completedAt: "2026-10-13T11:00:00Z",
      }),
      scheduleItem("today-pending", 4, "quarta", "topic-b"),
      scheduleItem("next-week", 5, "segunda", "topic-c", {
        carryover: true,
        carryoverSourceId: "source-c",
      }),
    ],
    questionSessions: [
      {
        id: "session-a",
        sourceBlockId: "today-completed",
        done: 25,
        correct: 20,
        wrong: 5,
        time: 35,
      },
    ],
    errors: [{ id: "error-a", sourceBlockId: "today-completed" }],
    notes: [{ id: "note-a", sourceBlockId: "today-completed" }],
    reviews: [{ id: "review-a", status: "concluida" }],
    simulatedTests: [{ id: "test-a", total: 60, correct: 48 }],
    cyclePerformanceSnapshots: [{ week: 3, cycleCompleted: true }],
    questionCarryovers: [{ id: "carry-a", missingQuestions: 8 }],
    settings: { studyStartDate: "2026-10-01" },
  };
  const historyFields = [
    "activeExamKey",
    "storageProfileKey",
    "currentStudyWeek",
    "currentStudyDayKey",
    "schedule",
    "lastScheduleSnapshot",
    "questionSessions",
    "errors",
    "notes",
    "reviews",
    "simulatedTests",
    "cyclePerformanceSnapshots",
    "questionCarryovers",
    "settings",
  ];
  const next = applyManualScheduleEdit(state, {
    week: 4,
    newItems: [
      scheduleItem("new-topic-a", 4, "quinta", "topic-a"),
      scheduleItem("new-topic-d", 4, "sexta", "topic-d"),
    ],
  });

  historyFields.forEach((field) => assert.deepEqual(next[field], state[field]));
  assert.equal(
    next.weeklySchedule.find((item) => item.id === "today-completed").status,
    "concluido",
  );
  assert.equal(
    next.weeklySchedule.find((item) => item.id === "today-completed").elapsedSeconds,
    2100,
  );
  assert.equal(next.weeklySchedule.some((item) => item.id === "next-week"), true);
  assert.equal(next.currentStudyWeek, 4);
});

test("a removed completed item remains archived and links split topics to completion", () => {
  const state = {
    schedule: [],
    weeklySchedule: [
      scheduleItem("completed-source", 2, "segunda", "topic-a", {
        topicIds: ["topic-a", "topic-b"],
        status: "concluido",
        elapsedSeconds: 3200,
        completedAt: "2026-10-12T10:00:00Z",
      }),
    ],
    questionSessions: [
      { id: "session-source", sourceBlockId: "completed-source", done: 10 },
    ],
    errors: [],
    notes: [],
    currentStudyWeek: 2,
  };
  const next = applyManualScheduleEdit(state, {
    week: 2,
    newItems: [
      scheduleItem("split-a", 2, "terça", "topic-a"),
      scheduleItem("split-b", 2, "quarta", "topic-b"),
    ],
  });
  const source = next.weeklySchedule.find(
    (item) => item.id === "completed-source",
  );

  assert.equal(source.archived, true);
  assert.equal(source.elapsedSeconds, 3200);
  assert.equal(source.completedAt, "2026-10-12T10:00:00Z");
  assert.equal(
    next.weeklySchedule.find((item) => item.id === "split-a").status,
    "concluido",
  );
  assert.equal(
    next.weeklySchedule.find((item) => item.id === "split-b").status,
    "concluido",
  );
  assert.equal(next.questionSessions[0].sourceBlockId, "completed-source");
});

test("daily reconciliation applies planning without regressing completed progress", () => {
  const planned = scheduleItem("stable-id", 1, "quinta", "topic-a", {
    status: "pendente",
    minutes: 90,
  });
  const current = scheduleItem("stable-id", 1, "quarta", "topic-a", {
    status: "concluido",
    elapsedSeconds: 2400,
    baseElapsedSeconds: 2400,
    completedAt: "2026-10-13T09:00:00Z",
    minutes: 60,
  });
  const reconciled = mergeStudyProgress(planned, current);

  assert.equal(reconciled.id, "stable-id");
  assert.equal(reconciled.dayKey, "quinta");
  assert.equal(reconciled.minutes, 90);
  assert.equal(reconciled.status, "concluido");
  assert.equal(reconciled.elapsedSeconds, 2400);
  assert.equal(reconciled.completedAt, "2026-10-13T09:00:00Z");
});

test("simulated Supabase JSONB save and reload retains edited plan and history", async () => {
  const initial = {
    currentStudyWeek: 6,
    currentStudyDayKey: "sexta",
    schedule: [
      scheduleItem("daily", 6, "sexta", "topic-a", {
        status: "concluido",
        elapsedSeconds: 3000,
      }),
    ],
    weeklySchedule: [
      scheduleItem("daily", 6, "sexta", "topic-a", {
        status: "concluido",
        elapsedSeconds: 3000,
      }),
    ],
    questionSessions: [{ id: "session", done: 30, correct: 24, wrong: 6 }],
    errors: [{ id: "error", status: "pendente" }],
    notes: [{ id: "note", text: "Histórico" }],
    reviews: [{ id: "review", status: "concluida" }],
    settings: { studyStartDate: "2026-10-01" },
  };
  const edited = applyManualScheduleEdit(initial, {
    week: 6,
    newItems: [
      scheduleItem("edited-id", 6, "sexta", "topic-a"),
      scheduleItem("new-id", 6, "sabado", "topic-b"),
    ],
  });
  const simulatedStudyAppStates = new Map();
  const otherExamState = {
    weeklySchedule: [
      scheduleItem("other-exam-item", 2, "segunda", "other-topic"),
    ],
    questionSessions: [{ id: "other-exam-session", done: 17, correct: 12 }],
  };
  simulatedStudyAppStates.set(
    "other-profile__exam",
    JSON.parse(JSON.stringify(otherExamState)),
  );
  const mockSupabaseUpsert = async (deviceId, jsonbState) => {
    simulatedStudyAppStates.set(
      deviceId,
      JSON.parse(JSON.stringify(jsonbState)),
    );
  };

  await mockSupabaseUpsert("profile__exam", edited);
  const loadedAfterReload = simulatedStudyAppStates.get("profile__exam");

  assert.equal(loadedAfterReload.currentStudyWeek, 6);
  assert.equal(loadedAfterReload.weeklySchedule.length, 2);
  assert.equal(loadedAfterReload.weeklySchedule[0].id, "daily");
  assert.equal(loadedAfterReload.weeklySchedule[0].status, "concluido");
  assert.equal(loadedAfterReload.weeklySchedule[0].elapsedSeconds, 3000);
  assert.deepEqual(loadedAfterReload.questionSessions, initial.questionSessions);
  assert.deepEqual(loadedAfterReload.errors, initial.errors);
  assert.deepEqual(loadedAfterReload.notes, initial.notes);
  assert.deepEqual(loadedAfterReload.reviews, initial.reviews);
  assert.deepEqual(
    simulatedStudyAppStates.get("other-profile__exam"),
    otherExamState,
  );
});

test("serialized asynchronous writes always leave the newest snapshot last", async () => {
  const queueRef = { current: Promise.resolve() };
  const writtenSnapshots = [];
  let releaseFirstWrite;
  const firstWriteBlocked = new Promise((resolve) => {
    releaseFirstWrite = resolve;
  });
  const save = async (snapshot) => {
    if (snapshot.revision === 1) await firstWriteBlocked;
    writtenSnapshots.push(snapshot.revision);
  };

  const first = enqueueSerializedStateSave(queueRef, { revision: 1 }, save);
  const second = enqueueSerializedStateSave(queueRef, { revision: 2 }, save);
  releaseFirstWrite();
  await Promise.all([first, second]);

  assert.deepEqual(writtenSnapshots, [1, 2]);
});

test("serialized writes recover after a failure without suppressing the error", async () => {
  const queueRef = { current: Promise.resolve() };
  const failed = enqueueSerializedStateSave(queueRef, { revision: 1 }, async () => {
    throw new Error("write failed");
  });
  const succeeded = enqueueSerializedStateSave(
    queueRef,
    { revision: 2 },
    async (snapshot) => snapshot.revision,
  );

  await assert.rejects(failed, /write failed/);
  assert.equal(await succeeded, 2);
});

test("reload after a date change derives today's agenda from the saved weekly plan", () => {
  const savedWeeklySchedule = [
    scheduleItem("manual-saved-id", 3, "quinta", "manual-topic", {
      status: "concluido",
      elapsedSeconds: 1800,
    }),
  ];
  const sources = resolveLoadedScheduleSources({
    isCurrentRoadmap: true,
    isSameStudyDate: false,
    loadedSchedule: [
      scheduleItem("old-day-id", 2, "quarta", "old-topic"),
    ],
    lastScheduleSnapshot: [
      scheduleItem("last-snapshot-id", 2, "quarta", "old-topic"),
    ],
    loadedWeeklySchedule: savedWeeklySchedule,
    fallbackWeeklySchedule: [
      scheduleItem("fresh-generated-id", 1, "segunda", "initial-topic"),
    ],
  });

  assert.deepEqual(sources.weeklySchedule, savedWeeklySchedule);
  assert.equal(sources.dailySchedule, null);
});

test("reload on the same date preserves the saved empty daily schedule", () => {
  const sources = resolveLoadedScheduleSources({
    isCurrentRoadmap: true,
    isSameStudyDate: true,
    loadedSchedule: [],
    lastScheduleSnapshot: [
      scheduleItem("fallback-id", 1, "segunda", "topic-a"),
    ],
    loadedWeeklySchedule: [],
    fallbackWeeklySchedule: [
      scheduleItem("initial-id", 1, "segunda", "topic-b"),
    ],
  });

  assert.deepEqual(sources.weeklySchedule, []);
  assert.deepEqual(sources.dailySchedule, []);
});
