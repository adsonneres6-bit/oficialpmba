import { topicsForCompetition } from "./competitionFilter.js";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function topicRecordKey(subject, topic) {
  const subjectId = String(subject?.id || normalizeSearch(subject?.subject));
  const topicId = String(topic?.id || normalizeSearch(topic?.title));
  return `${subjectId}\u0000${topicId}`;
}

export function filterRoadmapAndSummarize(roadmap = [], filters = {}) {
  const search = normalizeSearch(filters.search);
  const visibleRoadmap = [];
  const seenRecords = new Set();

  for (const subject of roadmap || []) {
    if (filters.subjectId && filters.subjectId !== "all" && subject.id !== filters.subjectId) continue;
    const normalizedSubject = normalizeSearch(subject.subject);
    const subjectMatchesSearch = Boolean(search && normalizedSubject.includes(search));
    const topics = topicsForCompetition(subject.topics || [], filters.competition)
      .filter((topic) => {
        if (filters.topicId && filters.topicId !== "all" && topic.id !== filters.topicId) return false;
        if (filters.topicKey && filters.topicKey !== "all" && `${subject.id}:${topic.id}` !== filters.topicKey) return false;
        if (search && !subjectMatchesSearch && !normalizeSearch(topic.title).includes(search)) return false;
        if (filters.status === "concluidos" && !topic.done) return false;
        if (filters.status === "pendentes" && topic.done) return false;
        if (filters.priority && filters.priority !== "todas" && topic.priority !== filters.priority) return false;
        return true;
      })
      .filter((topic) => {
        const key = topicRecordKey(subject, topic);
        if (seenRecords.has(key)) return false;
        seenRecords.add(key);
        return true;
      });
    if (topics.length) visibleRoadmap.push({ ...subject, topics });
  }

  const topics = visibleRoadmap.flatMap((subject) => subject.topics);
  const done = topics.filter((topic) => topic.done).length;
  const pending = topics.length - done;
  const countByPriority = (priority) => topics.filter((topic) => topic.priority === priority).length;
  const countByDifficulty = (difficulty) => topics.filter((topic) => topic.difficulty === difficulty).length;

  return {
    subjects: visibleRoadmap,
    stats: {
      total: topics.length,
      done,
      pending,
      percent: topics.length ? Math.round((done / topics.length) * 100) : 0,
      highPriority: countByPriority("Alta"),
      mediumPriority: countByPriority("Média"),
      lowPriority: countByPriority("Baixa"),
      hardest: countByDifficulty("Alta"),
      mediumDifficulty: countByDifficulty("Média"),
      lowDifficulty: countByDifficulty("Baixa"),
      highPending: topics.filter((topic) => !topic.done && topic.priority === "Alta").length,
      mediumPending: topics.filter((topic) => !topic.done && topic.priority === "Média").length,
      lowPending: topics.filter((topic) => !topic.done && topic.priority === "Baixa").length,
      hardestPending: topics.filter((topic) => !topic.done && topic.difficulty === "Alta").length,
      mediumDifficultyPending: topics.filter((topic) => !topic.done && topic.difficulty === "Média").length,
      lowDifficultyPending: topics.filter((topic) => !topic.done && topic.difficulty === "Baixa").length,
    },
  };
}
