export function nextAvailableCycle(currentCycle, totalCycles = 12) {
  const nextCycle = Math.floor(Number(currentCycle) || 1) + 1;
  return nextCycle <= totalCycles ? nextCycle : null;
}

export function mergeRegeneratedSchedule(generated, current) {
  const preservedIndexes = new Set();
  const regenerated = (generated || []).map((item) => {
    const progressIndex = (current || []).findIndex(
      (saved, index) =>
        !preservedIndexes.has(index) &&
        !saved.archived &&
        saved.week === item.week &&
        saved.subjectId === item.subjectId &&
        saved.topicId === item.topicId,
    );
    const progressItem = progressIndex >= 0 ? current[progressIndex] : null;
    if (progressIndex >= 0) preservedIndexes.add(progressIndex);
    return progressItem
      ? {
          ...item,
              status:
                progressItem.status === "concluido" ||
                progressItem.status === "andamento"
                  ? progressItem.status
                  : item.status,
          completedAt: progressItem.completedAt,
          elapsedSeconds:
            progressItem.elapsedSeconds ?? item.elapsedSeconds,
          baseElapsedSeconds:
            progressItem.baseElapsedSeconds ?? item.baseElapsedSeconds,
          timerStartedAt: progressItem.timerStartedAt ?? item.timerStartedAt,
          carryover: progressItem.carryover,
          carryoverFrom: progressItem.carryoverFrom,
          carryoverSourceId: progressItem.carryoverSourceId,
          carryoverSourceWeek: progressItem.carryoverSourceWeek,
        }
      : item;
  });
  const preservedHistory = (current || [])
    .filter((item, index) => !preservedIndexes.has(index))
    .map((item) => {
      const hasProgress =
        item.archived ||
        item.status === "concluido" ||
        item.status === "andamento" ||
        Number(item.elapsedSeconds || 0) > 0 ||
        Number(item.baseElapsedSeconds || 0) > 0 ||
        Boolean(item.completedAt || item.timerStartedAt);
      return hasProgress ? { ...item, archived: true } : null;
    })
    .filter(Boolean);
  return [
    ...regenerated,
    ...preservedHistory,
  ];
}
