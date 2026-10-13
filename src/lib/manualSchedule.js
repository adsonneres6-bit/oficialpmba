const DAY_ORDER = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

function scheduleTopicIds(item) {
  if (Array.isArray(item?.topicIds) && item.topicIds.length) {
    return item.topicIds.map(String).sort();
  }
  return item?.topicId ? [String(item.topicId)] : [];
}

function scheduleAssignmentKey(item) {
  return `${item?.subjectId || ""}:${scheduleTopicIds(item).join(",")}`;
}

function scheduleHasProgress(item, historicalIds) {
  return (
    historicalIds.has(item.id) ||
    item.status === "concluido" ||
    item.status === "andamento" ||
    Number(item.elapsedSeconds || 0) > 0 ||
    Number(item.baseElapsedSeconds || 0) > 0 ||
    Boolean(item.completedAt) ||
    Boolean(item.timerStartedAt)
  );
}

function scheduleStatusPriority(status) {
  return {
    livre: -1,
    pendente: 0,
    pausado: 1,
    andamento: 2,
    concluido: 3,
  }[status] ?? 0;
}

function preserveScheduleProgress(previous, next) {
  const elapsedSeconds = Math.max(
    Number(previous.elapsedSeconds || 0),
    Number(previous.baseElapsedSeconds || 0),
    Number(next.elapsedSeconds || 0),
  );
  const sameDay = previous.dayKey === next.dayKey;
  const status =
    scheduleStatusPriority(previous.status) >=
    scheduleStatusPriority(next.status)
      ? previous.status
      : next.status;
  return {
    ...previous,
    ...next,
    id: previous.id,
    status,
    elapsedSeconds,
    baseElapsedSeconds: sameDay
      ? Math.max(Number(previous.baseElapsedSeconds || 0), elapsedSeconds)
      : elapsedSeconds,
    timerStartedAt: sameDay
      ? next.timerStartedAt || previous.timerStartedAt || null
      : null,
    completedAt: previous.completedAt || next.completedAt || null,
    archived: false,
  };
}

export function mergeStudyProgress(plannedItem, currentItem) {
  return preserveScheduleProgress(currentItem, plannedItem);
}

export function mergeManualScheduleWeek({
  weeklySchedule,
  progressItems = [],
  newItems,
  week,
  historicalIds = [],
}) {
  const targetWeek = Number(week);
  const historicalIdSet = new Set(historicalIds);
  const previousById = new Map();

  [...(weeklySchedule || []), ...(progressItems || [])]
    .filter((item) => Number(item.week) === targetWeek)
    .forEach((item) => {
      const previous = previousById.get(item.id);
      previousById.set(item.id, previous ? { ...previous, ...item } : item);
    });

  const previousItems = [...previousById.values()];
  const matchedIds = new Set();
  const nextWeekItems = (newItems || []).map((item) => {
    const candidates = previousItems.filter(
      (previous) => !previous.carryover && !matchedIds.has(previous.id),
    );
    const previous =
      candidates.find((candidate) => candidate.id === item.id) ||
      candidates.find(
        (candidate) =>
          scheduleAssignmentKey(candidate) === scheduleAssignmentKey(item),
      );

    if (previous) {
      matchedIds.add(previous.id);
      return preserveScheduleProgress(previous, item);
    }

    const topicIds = scheduleTopicIds(item);
    const completedSource = previousItems.find((candidate) => {
      if (candidate.status !== "concluido") return false;
      const previousTopicIds = new Set(scheduleTopicIds(candidate));
      return (
        candidate.subjectId === item.subjectId &&
        topicIds.length > 0 &&
        topicIds.every((topicId) => previousTopicIds.has(topicId))
      );
    });

    return completedSource
      ? {
          ...item,
          status: "concluido",
          completedAt: completedSource.completedAt || null,
        }
      : item;
  });

  const retainedPreviousItems = previousItems.flatMap((item) => {
    if (matchedIds.has(item.id)) return [];
    if (item.carryover) return [item];
    if (item.archived) return [item];
    if (!scheduleHasProgress(item, historicalIdSet)) return [];
    return [
      {
        ...item,
        archived: true,
        archivedAt: item.archivedAt || new Date().toISOString(),
        elapsedSeconds: Math.max(
          Number(item.elapsedSeconds || 0),
          Number(item.baseElapsedSeconds || 0),
        ),
        baseElapsedSeconds: Math.max(
          Number(item.elapsedSeconds || 0),
          Number(item.baseElapsedSeconds || 0),
        ),
        timerStartedAt: null,
      },
    ];
  });

  return [
    ...(weeklySchedule || []).filter(
      (item) => Number(item.week) !== targetWeek,
    ),
    ...retainedPreviousItems,
    ...nextWeekItems,
  ].sort(
    (a, b) =>
      Number(a.week || 0) - Number(b.week || 0) ||
      DAY_ORDER.indexOf(a.dayKey) - DAY_ORDER.indexOf(b.dayKey) ||
      Number(a.manualSlot || 0) - Number(b.manualSlot || 0),
  );
}

export function applyManualScheduleEdit(state, { newItems, week }) {
  const sourceRecords = [
    ...(state.questionSessions || []),
    ...(state.errors || []),
    ...(state.notes || []),
  ];
  const historicalIds = sourceRecords
    .map((record) => record.sourceBlockId)
    .filter(Boolean);
  const progressItems = (state.schedule || [])
    .filter((item) => Number(item.week) === Number(week))
    .map((item) => {
      const elapsedSeconds = Math.max(
        Number(item.elapsedSeconds || 0),
        Number(item.baseElapsedSeconds || 0),
      );
      return {
        ...item,
        elapsedSeconds,
        baseElapsedSeconds: Math.max(
          Number(item.baseElapsedSeconds || 0),
          elapsedSeconds,
        ),
      };
    });

  return {
    ...state,
    weeklySchedule: mergeManualScheduleWeek({
      weeklySchedule: state.weeklySchedule || [],
      progressItems,
      newItems,
      week,
      historicalIds,
    }),
  };
}

export function enqueueSerializedStateSave(queueRef, state, save) {
  const savePromise = queueRef.current.then(() => save(state));
  queueRef.current = savePromise.then(
    () => undefined,
    () => undefined,
  );
  return savePromise;
}

export function resolveLoadedScheduleSources({
  isCurrentRoadmap,
  isSameStudyDate,
  loadedSchedule,
  lastScheduleSnapshot,
  loadedWeeklySchedule,
  fallbackWeeklySchedule,
}) {
  const weeklySchedule =
    isCurrentRoadmap && Array.isArray(loadedWeeklySchedule)
      ? loadedWeeklySchedule
      : fallbackWeeklySchedule;
  const dailySchedule =
    isCurrentRoadmap &&
    isSameStudyDate &&
    Array.isArray(loadedSchedule)
      ? loadedSchedule
      : isCurrentRoadmap &&
          isSameStudyDate &&
          Array.isArray(lastScheduleSnapshot)
        ? lastScheduleSnapshot
        : null;

  return { weeklySchedule, dailySchedule };
}
