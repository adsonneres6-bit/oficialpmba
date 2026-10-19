const STUDY_DAYS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

const NON_STUDY_SUBJECTS = new Set([
  "questoes",
  "simulado",
  "caderno_erros",
  "planejamento",
]);

export function previousScheduledStudyDay(dayKey, week) {
  if (dayKey === "segunda") {
    const currentWeek = Number(week) || 1;
    return currentWeek > 1
      ? { dayKey: "sabado", week: currentWeek - 1 }
      : null;
  }
  const index = STUDY_DAYS.indexOf(dayKey);
  if (index <= 0) return null;
  return { dayKey: STUDY_DAYS[index - 1], week: Number(week) || 1 };
}

function isRecoverable(item) {
  if (!item || item.archived || NON_STUDY_SUBJECTS.has(item.subjectId)) {
    return false;
  }
  return !["concluido", "ignorado", "ignorada", "descartado", "cancelado"].includes(
    item.status,
  );
}

export function recoverableStudyPendencies(
  weeklySchedule,
  currentDayKey,
  currentWeek,
) {
  const targetWeek = Number(currentWeek) || 1;
  const source = previousScheduledStudyDay(currentDayKey, targetWeek);
  if (!source) return [];

  const items = Array.isArray(weeklySchedule) ? weeklySchedule : [];
  const completedRoots = new Set(
    items
      .filter((item) => item?.status === "concluido")
      .map((item) => item.carryoverSourceId || item.id)
      .filter(Boolean),
  );
  const isUncompletedRoot = (item) =>
    !completedRoots.has(item.carryoverSourceId || item.id);
  const pendingCarryovers = items.filter(
    (item) =>
      item.carryover &&
      Number(item.week) === targetWeek &&
      item.dayKey === currentDayKey &&
      isRecoverable(item) &&
      isUncompletedRoot(item) &&
      !(item.dayKey === "domingo" && NON_STUDY_SUBJECTS.has(item.subjectId)),
  );
  const pendingSourceItems = items.filter(
    (item) =>
      !item.carryover &&
      Number(item.week) === source.week &&
      item.dayKey === source.dayKey &&
      isRecoverable(item) &&
      isUncompletedRoot(item) &&
      !(item.dayKey === "domingo" && NON_STUDY_SUBJECTS.has(item.subjectId)),
  );

  const uniqueBySource = new Map();
  [...pendingCarryovers, ...pendingSourceItems].forEach((item) => {
    const sourceId = item.carryoverSourceId || item.id;
    if (!uniqueBySource.has(sourceId)) uniqueBySource.set(sourceId, item);
  });
  return [...uniqueBySource.values()];
}
