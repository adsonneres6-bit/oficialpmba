function identityText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function findPrevious(items, candidate, field) {
  const id = String(candidate?.id || "");
  if (id) {
    const byId = items.find((item) => String(item?.id || "") === id);
    if (byId) return byId;
  }
  const text = identityText(candidate?.[field]);
  return text
    ? items.find((item) => identityText(item?.[field]) === text)
    : null;
}

function archiveEntry(kind, item, subjectId, subject) {
  return {
    kind,
    ...item,
    subjectId: subjectId || item.subjectId || item.id,
    subject: subject || item.subject || "",
    archived: true,
    archivedAt: item.archivedAt || new Date().toISOString(),
  };
}

function withoutArchiveMetadata(item) {
  const activeItem = { ...item };
  delete activeItem.archived;
  delete activeItem.archivedAt;
  delete activeItem.kind;
  return activeItem;
}

export function reconcileExamRoadmap(
  previousRoadmap = [],
  proposedRoadmap = [],
  previousArchive = [],
) {
  const archivedRoadmap = [...(previousArchive || [])];
  const matchedSubjects = new Set();
  const roadmap = (proposedRoadmap || []).map((proposedSubject) => {
    const activeSubject = findPrevious(
      previousRoadmap || [],
      proposedSubject,
      "subject",
    );
    const archivedSubject = findPrevious(
      archivedRoadmap.filter((item) => item.kind === "subject"),
      proposedSubject,
      "subject",
    );
    const previousSubject = activeSubject || archivedSubject;
    if (!previousSubject) return proposedSubject;
    if (activeSubject) matchedSubjects.add(previousSubject.id);
    else {
      const archiveIndex = archivedRoadmap.findIndex(
        (item) => item.kind === "subject" && item.id === previousSubject.id,
      );
      if (archiveIndex >= 0) archivedRoadmap.splice(archiveIndex, 1);
    }

    const matchedTopics = new Set();
    const topics = (proposedSubject.topics || []).map((proposedTopic) => {
      const activeTopic = findPrevious(
        previousSubject.topics || [],
        proposedTopic,
        "title",
      );
      const archivedTopic = findPrevious(
        archivedRoadmap.filter(
          (item) =>
            item.kind === "topic" &&
            item.subjectId === previousSubject.id,
        ),
        proposedTopic,
        "title",
      );
      const previousTopic = activeTopic || archivedTopic;
      if (!previousTopic) return proposedTopic;
      if (activeTopic) matchedTopics.add(previousTopic.id);
      else {
        const archiveIndex = archivedRoadmap.findIndex(
          (item) =>
            item.kind === "topic" &&
            item.subjectId === previousSubject.id &&
            item.id === previousTopic.id,
        );
        if (archiveIndex >= 0) archivedRoadmap.splice(archiveIndex, 1);
      }
      return {
        ...withoutArchiveMetadata(previousTopic),
        ...proposedTopic,
        id: previousTopic.id,
        done: Boolean(previousTopic.done || proposedTopic.done),
      };
    });

    (previousSubject.topics || [])
      .filter((topic) => !matchedTopics.has(topic.id))
      .forEach((topic) => {
        if (activeSubject) {
          archivedRoadmap.push(
            archiveEntry(
              "topic",
              topic,
              previousSubject.id,
              previousSubject.subject,
            ),
          );
        }
      });

    return {
      ...withoutArchiveMetadata(previousSubject),
      ...proposedSubject,
      id: previousSubject.id,
      topics,
    };
  });

  (previousRoadmap || [])
    .filter((subject) => !matchedSubjects.has(subject.id))
    .forEach((subject) => {
      archivedRoadmap.push(archiveEntry("subject", subject));
      (subject.topics || []).forEach((topic) => {
        archivedRoadmap.push(
          archiveEntry("topic", topic, subject.id, subject.subject),
        );
      });
    });

  return { roadmap, archivedRoadmap };
}

function reconcileScheduleItems(items, roadmap) {
  const subjects = new Map(roadmap.map((subject) => [subject.id, subject]));
  return (items || []).map((item) => {
    const subject = subjects.get(item.subjectId);
    if (!subject) {
      return item.archived
        ? item
        : {
            ...item,
            archived: true,
            archivedAt: item.archivedAt || new Date().toISOString(),
          };
    }

    const topicIds = Array.isArray(item.topicIds) && item.topicIds.length
      ? item.topicIds
      : item.topicId
        ? [item.topicId]
        : [];
    if (!topicIds.length) {
      return { ...item, subject: subject.subject };
    }

    const availableTopics = topicIds
      .map((topicId) =>
        subject.topics.find((topic) => topic.id === topicId),
      )
      .filter(Boolean);
    if (!availableTopics.length) {
      return item.archived
        ? item
        : {
            ...item,
            archived: true,
            archivedAt: item.archivedAt || new Date().toISOString(),
          };
    }

    const archivedTopicIds = topicIds.filter(
      (topicId) => !availableTopics.some((topic) => topic.id === topicId),
    );
    const nextTopicIds = availableTopics.map((topic) => topic.id);
    const nextTopic = availableTopics.map((topic) => topic.title).join(" + ");
    const updated = { ...item };
    if (item.subject !== subject.subject) updated.subject = subject.subject;
    if (item.topic !== nextTopic) updated.topic = nextTopic;
    if (
      archivedTopicIds.length ||
      topicIds.length !== nextTopicIds.length
    ) {
      updated.topicId = nextTopicIds[0];
      updated.topicIds = nextTopicIds;
      updated.archivedTopicIds = [
        ...new Set([...(item.archivedTopicIds || []), ...archivedTopicIds]),
      ];
    }
    return updated.subject === item.subject &&
      updated.topic === item.topic &&
      updated.topicId === item.topicId &&
      updated.topicIds === item.topicIds
      ? item
      : updated;
  });
}

export function applyExamRoadmapEdit(state, exam, customExams) {
  const { roadmap, archivedRoadmap } = reconcileExamRoadmap(
    state.roadmap,
    exam.roadmap,
    state.roadmapArchive,
  );
  const reconcileItems = (items) => reconcileScheduleItems(items, roadmap);
  return {
    ...state,
    roadmap,
    roadmapArchive: archivedRoadmap,
    roadmapVersion: exam.roadmapVersion,
    customExams,
    settings: {
      ...state.settings,
      examDate: exam.examDate || "",
    },
    schedule: reconcileItems(state.schedule),
    weeklySchedule: reconcileItems(state.weeklySchedule),
    lastScheduleSnapshot: reconcileItems(state.lastScheduleSnapshot),
  };
}
