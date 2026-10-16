const NON_SUBJECT_BLOCK_IDS = new Set([
  "questoes",
  "simulado",
  "caderno_erros",
  "planejamento",
]);

function itemTopicIds(item) {
  return [
    ...new Set(
      Array.isArray(item.topicIds) && item.topicIds.length
        ? item.topicIds
        : item.topicId
          ? [item.topicId]
          : [],
    ),
  ];
}

export function collectScheduleExamLabels(roadmap = []) {
  return [
    ...new Set(
      (roadmap || []).flatMap((subject) =>
        (subject.topics || []).flatMap((topic) => topic.examLabels || []),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function calculateScheduleContestCoverage({
  roadmap = [],
  frequencies = [],
  examLabel = "all",
} = {}) {
  if (examLabel === "all") return null;

  const contestSubjectIds = new Set(
    (roadmap || [])
      .filter((subject) =>
        (subject.topics || []).some((topic) =>
          topic.examLabels?.includes(examLabel),
        ),
      )
      .map((subject) => subject.id),
  );
  const coveredSubjectIds = new Set(
    (frequencies || [])
      .filter(
        (subject) =>
          contestSubjectIds.has(subject.id) &&
          (subject.topicFrequencies || []).some((topic) => topic.count > 0),
      )
      .map((subject) => subject.id),
  );
  const total = contestSubjectIds.size;
  const covered = coveredSubjectIds.size;

  return {
    total,
    covered,
    uncovered: Math.max(0, total - covered),
    percent: total ? Math.round((covered / total) * 100) : 0,
  };
}

export function calculateScheduleSubjectFrequency({
  subjects = [],
  roadmap = [],
  scheduleItems = [],
  cycle = "all",
  examLabel = "all",
} = {}) {
  const subjectById = new Map((roadmap || []).map((subject) => [subject.id, subject]));
  const selectedCycleItems = (scheduleItems || []).filter(
    (item) =>
      (cycle === "all" || Number(item.week) === Number(cycle)) &&
      !NON_SUBJECT_BLOCK_IDS.has(item.subjectId),
  );

  return (subjects || []).map((subject) => {
    const roadmapSubject = subjectById.get(subject.id);
    const topicById = new Map(
      (roadmapSubject?.topics || []).map((topic) => [topic.id, topic]),
    );
    const countsByTopic = new Map();
    const matchingItems = new Map();

    selectedCycleItems
      .filter((item) => item.subjectId === subject.id)
      .forEach((item) => {
        const matchedTopicIds = itemTopicIds(item).filter((topicId) => {
          const topic = topicById.get(topicId);
          return (
            topic &&
            (examLabel === "all" || topic.examLabels?.includes(examLabel))
          );
        });

        if (examLabel === "all" || matchedTopicIds.length) {
          matchingItems.set(item.id, item);
        }
        matchedTopicIds.forEach((topicId) => {
          if (!countsByTopic.has(topicId)) countsByTopic.set(topicId, new Map());
          countsByTopic.get(topicId).set(item.id, item);
        });
      });

    const topicFrequencies = [...countsByTopic].map(([topicId, items]) => ({
      topic: topicById.get(topicId),
      count: items.size,
      items: [...items.values()],
    }));

    return {
      ...subject,
      count: matchingItems.size,
      items: [...matchingItems.values()],
      topicFrequencies,
    };
  });
}
