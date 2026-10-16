const textKey = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

function looksSimilar(left, right) {
  const a = textKey(left);
  const b = textKey(right);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = new Set(a.split(" ").filter((word) => word.length > 2));
  const bWords = new Set(b.split(" ").filter((word) => word.length > 2));
  const shared = [...aWords].filter((word) => bWords.has(word)).length;
  return shared > 0 && shared / Math.min(aWords.size || 1, bWords.size || 1) >= 0.5;
}

export const DEFAULT_EXAM_PRIORITY_RULES = Object.freeze({
  urgencyPoints: 30,
  urgencyWindowDays: 30,
  sharedExamBonus: 2,
});

const priorityRank = (value) => {
  const normalized = textKey(value);
  if (normalized === "alta") return 3;
  if (normalized === "media") return 2;
  if (normalized === "baixa") return 1;
  return 0;
};

const priorityName = (rank) => ({ 3: "Alta", 2: "Média", 1: "Baixa" })[rank] || "";

export function recalculateConsolidatedTopic(topic) {
  const records = Array.isArray(topic.sourceHistory) ? topic.sourceHistory : [];
  const fallbackRecords = Object.entries(topic.examData || {}).map(([examKey, record]) => ({ ...record, examKey }));
  const sources = records.length ? records : fallbackRecords;
  const validWeights = sources.map((source) => Number(source.weight)).filter((weight) => Number.isFinite(weight) && weight >= 0);
  const highestPriority = Math.max(0, ...sources.map((source) => priorityRank(source.priority)));
  const consolidated = { ...topic };
  if (validWeights.length) consolidated.weight = Math.max(...validWeights);
  if (highestPriority) consolidated.priority = priorityName(highestPriority);
  if (records.length) {
    const examIds = [...new Set(records.map((record) => record.examKey).filter(Boolean))];
    consolidated.examIds = examIds;
    consolidated.examData = Object.fromEntries(examIds.map((examKey) => {
      const examRecords = records.filter((record) => record.examKey === examKey);
      const examWeights = examRecords.map((record) => Number(record.weight)).filter((weight) => Number.isFinite(weight) && weight >= 0);
      const examPriority = Math.max(0, ...examRecords.map((record) => priorityRank(record.priority)));
      return [examKey, {
        ...(topic.examData?.[examKey] || {}),
        ...(examWeights.length ? { weight: Math.max(...examWeights) } : {}),
        ...(examPriority ? { priority: priorityName(examPriority) } : {}),
        sources: examRecords,
      }];
    }));
  }
  return consolidated;
}

function recalculateConsolidatedSubject(subject) {
  const records = Array.isArray(subject.sourceHistory) ? subject.sourceHistory : [];
  const weights = records.map((record) => Number(record.weight)).filter((weight) => Number.isFinite(weight) && weight >= 0);
  return weights.length ? { ...subject, weight: Math.max(...weights) } : subject;
}

export function recalculateConsolidatedRoadmap(roadmap = []) {
  return (roadmap || []).map((subject) => {
    const topics = (subject.topics || []).map(recalculateConsolidatedTopic);
    const examIds = [...new Set(topics.flatMap((topic) => topic.examIds || []))];
    // Derive subject-level origins from its current topics so removing a topic
    // or an import source cannot leave a stale aggregate weight behind.
    const sourceHistory = topics.flatMap((topic) => topic.sourceHistory || []);
    const examData = Object.fromEntries(examIds.map((examKey) => {
      const examRecords = sourceHistory.filter((record) => record.examKey === examKey);
      const weights = examRecords.map((record) => Number(record.weight)).filter((weight) => Number.isFinite(weight) && weight >= 0);
      return [examKey, {
        ...(subject.examData?.[examKey] || {}),
        ...(weights.length ? { weight: Math.max(...weights) } : {}),
        sources: examRecords,
      }];
    }));
    return {
      ...recalculateConsolidatedSubject({ ...subject, topics, examIds, sourceHistory, examData }),
      topics,
      examIds,
      examData,
    };
  });
}

function examAliases(exam) {
  const aliases = new Set([textKey(exam.label), textKey(exam.key)]);
  const label = String(exam.label || "");
  const identityText = `${label} ${exam.key || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  for (const word of label.match(/[\p{L}\p{N}]+/gu) || []) {
    if (/^[A-Z][A-Z0-9]{1,9}$/.test(word)) aliases.add(textKey(word));
  }
  if (/\bbahia\b/.test(identityText)) aliases.add(textKey("PMBA"));
  if (/\bpernambuco\b/.test(identityText)) aliases.add(textKey("PMPE"));
  if (/\balagoas\b/.test(identityText)) aliases.add(textKey("PMAL"));
  return aliases;
}

export function resolveExamCombination(value, exams = []) {
  const raw = String(value || "").trim();
  if (!raw) return { examKeys: [], unknown: [], ambiguous: [] };
  const normalized = textKey(raw);
  const exact = (exams || []).filter((exam) => examAliases(exam).has(normalized));
  if (exact.length === 1) return { examKeys: [exact[0].key], unknown: [], ambiguous: [] };
  const tokens = raw.split(/\s*(?:\+|,|;|&|\be\b)\s*/i).map((item) => item.trim()).filter(Boolean);
  const examKeys = [];
  const unknown = [];
  const ambiguous = [];
  tokens.forEach((token) => {
    const matches = (exams || []).filter((exam) => examAliases(exam).has(textKey(token)));
    if (matches.length === 1) examKeys.push(matches[0].key);
    else if (matches.length > 1) ambiguous.push(token);
    else unknown.push(token);
  });
  return { examKeys: [...new Set(examKeys)], unknown, ambiguous };
}

export function normalizeExamWorkbookRows(rows, fileName, fallbackExamKeys = [], exams = []) {
  const grouped = new Map();
  let currentSubject = "";
  let currentWeight = "3";
  const errors = [];
  const unassignedRows = [];
  (rows || []).forEach((row, index) => {
    const [subjectCell, weightCell, topicCell, priorityCell, examsCell] = row || [];
    const subjectText = String(subjectCell ?? "").trim();
    const weightText = String(weightCell ?? "").trim();
    const topicText = String(topicCell ?? "").trim();
    const priorityText = String(priorityCell ?? "").trim();
    const examsText = String(examsCell ?? "").trim();
    const rowNumber = index + 1;
    if (index === 0 && textKey(subjectText).startsWith("materia")) return;
    if (subjectText) {
      currentSubject = subjectText;
      currentWeight = weightText || "3";
      if (!grouped.has(currentSubject)) grouped.set(currentSubject, []);
    } else if (weightText && !currentSubject) {
      errors.push(`linha ${rowNumber}: peso sem matéria`);
    }
    if (weightText && !Number.isFinite(Number(weightText))) errors.push(`linha ${rowNumber}: campo peso inválido (“${weightText}”)`);
    if (priorityText && !["alta", "media", "baixa"].includes(textKey(priorityText))) errors.push(`linha ${rowNumber}: campo prioridade inválido (“${priorityText}”)`);
    if (!topicText) {
      if (subjectText || weightText || priorityText || examsText) errors.push(`linha ${rowNumber}: assunto ausente`);
      return;
    }
    if (!currentSubject) {
      errors.push(`linha ${rowNumber}: assunto sem matéria`);
      return;
    }
    const resolved = examsText ? resolveExamCombination(examsText, exams) : { examKeys: [], unknown: [], ambiguous: [] };
    if (resolved.unknown.length) errors.push(`linha ${rowNumber}, coluna E: concurso(s) desconhecido(s): ${resolved.unknown.join(", ")}`);
    if (resolved.ambiguous.length) errors.push(`linha ${rowNumber}, coluna E: sigla(s) ambígua(s): ${resolved.ambiguous.join(", ")}`);
    if (!examsText || (!resolved.examKeys.length && !resolved.unknown.length && !resolved.ambiguous.length)) unassignedRows.push(rowNumber);
    const weight = Number(currentWeight);
    grouped.get(currentSubject).push({
      title: topicText,
      priority: priorityText || "Média",
      source: {
        fileName,
        row: rowNumber,
        weight: Number.isFinite(weight) ? weight : 3,
        priority: priorityText || "Média",
        examKeys: resolved.examKeys,
      },
    });
  });
  return {
    fileName,
    fallbackExamKeys: [...new Set(fallbackExamKeys)],
    errors,
    unassignedRows,
    subjects: [...grouped].map(([subject, topics]) => ({ subject, weight: Number(topics[0]?.source.weight || currentWeight || 3), topics })),
  };
}

export function consolidateImportedRoadmap(roadmap = [], imports = []) {
  const next = roadmap.map((subject) => ({ ...subject, topics: [...(subject.topics || [])] }));
  const summary = [];
  for (const imported of imports) {
    const assignedKeys = new Set(imported.fallbackExamKeys || []);
    const unresolvedRows = (imported.unassignedRows || []).filter(() => !assignedKeys.size);
    const report = {
      fileName: imported.fileName,
      examKeys: [...new Set((imported.subjects || []).flatMap((subject) => subject.topics.flatMap((topic) => topic.source.examKeys?.length ? topic.source.examKeys : imported.fallbackExamKeys || [])))],
      subjects: imported.subjects.length,
      topics: 0,
      shared: 0,
      newTopics: 0,
      duplicates: 0,
      divergences: [],
      similar: [],
      errors: [...(imported.errors || []), ...unresolvedRows.map((row) => `linha ${row}: informe concurso(s) na coluna E ou selecione a combinação para linhas sem identificação`)],
    };
    for (const incomingSubject of imported.subjects) {
      const key = textKey(incomingSubject.subject);
      let subject = next.find((item) => textKey(item.subject) === key);
      if (!subject) {
        const similar = next.find((item) => looksSimilar(item.subject, incomingSubject.subject));
        if (similar) report.similar.push(`Matéria “${incomingSubject.subject}” pode corresponder a “${similar.subject}”; mantida separada.`);
        subject = { id: `subject-${key.replace(/\s+/g, "-")}`, subject: incomingSubject.subject.trim(), weight: incomingSubject.weight || 3, priority: "Média", status: "Aguardando início", topics: [], examIds: [], examData: {} };
        if (next.some((item) => item.id === subject.id)) subject.id = `${subject.id}-${next.length + 1}`;
        next.push(subject);
      }
      for (const incomingTopic of incomingSubject.topics) {
        report.topics += 1;
        const topicKey = textKey(incomingTopic.title);
        let topic = subject.topics.find((item) => textKey(item.title) === topicKey);
        if (!topic) {
          const similar = subject.topics.find((item) => looksSimilar(item.title, incomingTopic.title));
          if (similar) report.similar.push(`Assunto “${incomingTopic.title}” em ${subject.subject} pode corresponder a “${similar.title}”; mantido separado.`);
          topic = { id: `topic-${subject.id}-${topicKey.replace(/\s+/g, "-")}`, title: incomingTopic.title.trim(), done: false, priority: incomingTopic.priority, difficulty: "Média", examIds: [], examData: {}, sourceHistory: [] };
          if (subject.topics.some((item) => item.id === topic.id)) topic.id = `${topic.id}-${subject.topics.length + 1}`;
          subject.topics.push(topic);
          report.newTopics += 1;
        } else report.duplicates += 1;
        const examKeys = [...new Set([...(incomingTopic.source.examKeys || []), ...(incomingTopic.source.examKeys?.length ? [] : imported.fallbackExamKeys || [])])];
        for (const examKey of examKeys) {
          const alreadyLinked = (topic.examIds || []).includes(examKey);
          subject.examIds = [...new Set([...(subject.examIds || []), examKey])];
          topic.examIds = [...new Set([...(topic.examIds || []), examKey])];
          if (!alreadyLinked && topic.examIds.length > 1) report.shared += 1;
          const source = { ...incomingTopic.source, examKey };
          const previous = topic.examData?.[examKey];
          if (previous && (Number(previous.weight) !== Number(source.weight) || previous.priority !== source.priority)) {
            report.divergences.push(`${subject.subject} — ${topic.title}: peso/prioridade divergentes para ${examKey}; valores anteriores preservados e nova origem registrada.`);
          }
          topic.examData = { ...(topic.examData || {}), [examKey]: previous || source };
          subject.examData = {
            ...(subject.examData || {}),
            [examKey]: subject.examData?.[examKey] || { fileName: source.fileName, weight: source.weight },
          };
          const exists = (topic.sourceHistory || []).some((entry) => entry.fileName === source.fileName && entry.row === source.row && entry.examKey === examKey && Number(entry.weight) === Number(source.weight) && entry.priority === source.priority);
          if (!exists) topic.sourceHistory = [...(topic.sourceHistory || []), source];
          const subjectSourceExists = (subject.sourceHistory || []).some((entry) => entry.fileName === source.fileName && entry.row === source.row && entry.examKey === examKey && Number(entry.weight) === Number(source.weight));
          if (!subjectSourceExists) subject.sourceHistory = [...(subject.sourceHistory || []), source];
        }
        const aggregateTopic = recalculateConsolidatedTopic(topic);
        Object.assign(topic, aggregateTopic);
      }
      Object.assign(subject, recalculateConsolidatedSubject(subject));
    }
    summary.push(report);
  }
  return { roadmap: recalculateConsolidatedRoadmap(next), summary };
}

export function examTopicPriority(topic, exams, today = new Date(), rules = DEFAULT_EXAM_PRIORITY_RULES) {
  const linked = new Set(topic.examIds || []);
  const reasons = [];
  let urgency = 0;
  const sourceScore = Number(topic.weight || 0);
  for (const exam of exams || []) {
    if (!linked.has(exam.key)) continue;
    if (exam.examDate) {
      const days = Math.ceil((new Date(`${exam.examDate}T00:00:00`) - new Date(today.toDateString())) / 86400000);
      const configuredPoints = Number(rules.urgencyPoints);
      const configuredWindow = Number(rules.urgencyWindowDays);
      const points = Number.isFinite(configuredPoints) ? configuredPoints : DEFAULT_EXAM_PRIORITY_RULES.urgencyPoints;
      const windowDays = Number.isFinite(configuredWindow) && configuredWindow > 0 ? configuredWindow : DEFAULT_EXAM_PRIORITY_RULES.urgencyWindowDays;
      if (days >= 0) urgency = Math.max(urgency, points / (1 + days / windowDays));
    }
  }
  if (urgency) reasons.push("prova próxima");
  if (linked.size > 1) reasons.push(`presente em ${linked.size} concursos`);
  if (sourceScore) reasons.push("maior peso consolidado");
  if (topic.done) reasons.push("assunto concluído");
  const configuredBonus = Number(rules.sharedExamBonus);
  const sharedExamBonus = Number.isFinite(configuredBonus) ? configuredBonus : DEFAULT_EXAM_PRIORITY_RULES.sharedExamBonus;
  return { score: urgency + sourceScore + Math.max(0, linked.size - 1) * sharedExamBonus, reasons, examCount: linked.size };
}
