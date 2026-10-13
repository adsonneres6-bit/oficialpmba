import assert from "node:assert/strict";
import test from "node:test";
import { applyExamRoadmapEdit } from "./examRoadmap.js";

function studyState() {
  const completedBlock = {
    id: "schedule-legal-topic-a",
    week: 4,
    dayKey: "quarta",
    subjectId: "legal",
    topicId: "topic-a",
    topicIds: ["topic-a"],
    subject: "Direito",
    topic: "Direito Constitucional",
    status: "concluido",
    elapsedSeconds: 2400,
    baseElapsedSeconds: 2400,
    completedAt: "2026-10-10T12:00:00Z",
  };
  const pendingBlock = {
    ...completedBlock,
    id: "schedule-legal-topic-b",
    topicId: "topic-b",
    topicIds: ["topic-b"],
    topic: "Direito Administrativo",
    status: "pendente",
    elapsedSeconds: 300,
    baseElapsedSeconds: 300,
    completedAt: null,
  };
  return {
    activeExamKey: "pmba",
    storageProfileKey: "usuario_principal__pmba",
    roadmapVersion: "CUSTOM_PMBA_V1",
    currentStudyWeek: 4,
    currentStudyDayKey: "quarta",
    currentStudyIsoDate: "2026-10-13",
    currentCycle: 2,
    roadmap: [
      {
        id: "legal",
        subject: "Direito",
        weight: 3,
        status: "Em andamento",
        topics: [
          {
            id: "topic-a",
            title: "Direito Constitucional",
            done: true,
            priority: "Alta",
            difficulty: "Alta",
          },
          {
            id: "topic-b",
            title: "Direito Administrativo",
            done: false,
          },
        ],
      },
    ],
    roadmapArchive: [],
    schedule: [completedBlock, pendingBlock],
    weeklySchedule: [completedBlock, pendingBlock],
    lastScheduleSnapshot: [completedBlock, pendingBlock],
    questionSessions: [
      {
        id: "questions-1",
        sourceBlockId: completedBlock.id,
        topicId: "topic-a",
        answered: 25,
        correct: 20,
        wrong: 5,
        elapsedSeconds: 900,
      },
    ],
    errors: [{ id: "error-1", topicId: "topic-a", error: "Erro registrado" }],
    notes: [{ id: "note-1", topicId: "topic-a", text: "Anotação" }],
    reviews: [{ id: "review-1", topicId: "topic-a", done: true }],
    questionCarryovers: [{ id: "carry-1", date: "2026-10-13", questions: 4 }],
    settings: { studyStartDate: "2026-09-01", examDate: "2027-01-01" },
    customExams: [{ key: "pmba", roadmap: [] }],
  };
}

function examWith(roadmap, changes = {}) {
  return {
    key: "pmba",
    label: "PMBA",
    roadmapVersion: "CUSTOM_PMBA_V2",
    examDate: "2027-02-01",
    roadmap,
    ...changes,
  };
}

function topic(id, title, properties = {}) {
  return { id, title, done: false, ...properties };
}

test("editing a subject or topic title keeps identities and completion history", () => {
  const initial = studyState();
  const updated = applyExamRoadmapEdit(
    initial,
    examWith([
      {
        id: "legal",
        subject: "Direito Público",
        weight: 3,
        topics: [
          topic("topic-a", "Constituição Federal"),
          topic("topic-b", "Direito Administrativo"),
        ],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );

  assert.equal(updated.activeExamKey, initial.activeExamKey);
  assert.equal(updated.storageProfileKey, initial.storageProfileKey);
  assert.equal(updated.currentStudyWeek, initial.currentStudyWeek);
  assert.equal(updated.currentStudyDayKey, initial.currentStudyDayKey);
  assert.equal(updated.currentCycle, initial.currentCycle);
  assert.equal(updated.roadmap[0].id, "legal");
  assert.equal(updated.roadmap[0].topics[0].id, "topic-a");
  assert.equal(updated.roadmap[0].topics[0].done, true);
  assert.equal(updated.schedule[0].id, initial.schedule[0].id);
  assert.equal(updated.schedule[0].status, "concluido");
  assert.equal(updated.schedule[0].elapsedSeconds, 2400);
  assert.equal(updated.schedule[0].completedAt, initial.schedule[0].completedAt);
  assert.equal(updated.schedule[0].subject, "Direito Público");
  assert.equal(updated.schedule[0].topic, "Constituição Federal");
  assert.deepEqual(updated.questionSessions, initial.questionSessions);
  assert.deepEqual(updated.errors, initial.errors);
  assert.deepEqual(updated.notes, initial.notes);
  assert.deepEqual(updated.reviews, initial.reviews);
  assert.deepEqual(updated.questionCarryovers, initial.questionCarryovers);
});

test("adding a topic changes only the roadmap structure, not existing plan records", () => {
  const initial = studyState();
  const updated = applyExamRoadmapEdit(
    initial,
    examWith([
      {
        ...initial.roadmap[0],
        topics: [
          ...initial.roadmap[0].topics,
          topic("topic-c", "Direito Penal"),
        ],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );

  assert.deepEqual(
    updated.roadmap[0].topics.map((item) => item.id),
    ["topic-a", "topic-b", "topic-c"],
  );
  assert.deepEqual(updated.weeklySchedule, initial.weeklySchedule);
  assert.deepEqual(updated.schedule, initial.schedule);
  assert.deepEqual(updated.lastScheduleSnapshot, initial.lastScheduleSnapshot);
});

test("removing a topic archives its roadmap and schedule history", () => {
  const initial = studyState();
  const updated = applyExamRoadmapEdit(
    initial,
    examWith([
      {
        ...initial.roadmap[0],
        topics: [initial.roadmap[0].topics[1]],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );

  const archivedTopic = updated.roadmapArchive.find(
    (item) => item.kind === "topic" && item.id === "topic-a",
  );
  const archivedBlock = updated.weeklySchedule.find(
    (item) => item.id === "schedule-legal-topic-a",
  );
  assert.equal(archivedTopic.done, true);
  assert.equal(archivedBlock.archived, true);
  assert.equal(archivedBlock.elapsedSeconds, 2400);
  assert.deepEqual(updated.questionSessions, initial.questionSessions);
});

test("adding a subject does not alter existing study state or generated schedule", () => {
  const initial = studyState();
  const updated = applyExamRoadmapEdit(
    initial,
    examWith([
      ...initial.roadmap,
      {
        id: "new-subject",
        subject: "Legislação Especial",
        weight: 3,
        topics: [topic("new-topic", "Lei nova")],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );

  assert.equal(updated.roadmap.length, 2);
  assert.deepEqual(updated.weeklySchedule, initial.weeklySchedule);
  assert.deepEqual(updated.questionSessions, initial.questionSessions);
  assert.equal(updated.currentStudyWeek, 4);
});

test("removing a subject archives its topic and schedule records without deletion", () => {
  const initial = studyState();
  const updated = applyExamRoadmapEdit(
    initial,
    examWith([]),
    [{ key: "pmba", roadmap: [] }],
  );

  assert.equal(
    updated.roadmapArchive.some(
      (item) => item.kind === "subject" && item.id === "legal",
    ),
    true,
  );
  assert.equal(
    updated.roadmapArchive.some(
      (item) => item.kind === "topic" && item.id === "topic-a",
    ),
    true,
  );
  assert.equal(updated.weeklySchedule[0].archived, true);
  assert.deepEqual(updated.questionSessions, initial.questionSessions);
  assert.deepEqual(updated.notes, initial.notes);
  assert.deepEqual(updated.reviews, initial.reviews);
});

test("reloading persisted JSON retains edit history and leaves other profile untouched", () => {
  const initial = studyState();
  const otherProfile = {
    ...studyState(),
    activeExamKey: "other",
    storageProfileKey: "usuario_principal__other",
    questionSessions: [{ id: "other-session", answered: 9 }],
  };
  const edited = applyExamRoadmapEdit(
    initial,
    examWith([
      {
        ...initial.roadmap[0],
        topics: [topic("topic-a", "Constituição"), initial.roadmap[0].topics[1]],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );
  const persisted = new Map([
    [edited.storageProfileKey, JSON.parse(JSON.stringify(edited))],
    [otherProfile.storageProfileKey, JSON.parse(JSON.stringify(otherProfile))],
  ]);
  const reloaded = JSON.parse(
    JSON.stringify(persisted.get(initial.storageProfileKey)),
  );

  assert.equal(reloaded.roadmap[0].topics[0].done, true);
  assert.equal(reloaded.schedule[0].id, initial.schedule[0].id);
  assert.equal(reloaded.schedule[0].elapsedSeconds, 2400);
  assert.deepEqual(reloaded.questionSessions, initial.questionSessions);
  assert.deepEqual(
    persisted.get(otherProfile.storageProfileKey),
    otherProfile,
  );
});

test("re-adding archived content restores its original IDs and progress", () => {
  const initial = studyState();
  const removed = applyExamRoadmapEdit(
    initial,
    examWith([
      {
        ...initial.roadmap[0],
        topics: [initial.roadmap[0].topics[1]],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );
  const restored = applyExamRoadmapEdit(
    removed,
    examWith([
      {
        ...removed.roadmap[0],
        topics: [
          ...removed.roadmap[0].topics,
          topic("topic-a", "Direito Constitucional"),
        ],
      },
    ]),
    [{ key: "pmba", roadmap: [] }],
  );

  assert.equal(restored.roadmap[0].topics[1].id, "topic-a");
  assert.equal(restored.roadmap[0].topics[1].done, true);
});
