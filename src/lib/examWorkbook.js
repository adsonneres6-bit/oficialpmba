const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("pt-BR");

export function preserveExamLabels(topic) {
  return Array.isArray(topic?.examLabels) ? [...topic.examLabels] : [];
}

export function collectExamLabels(subjects = []) {
  return [...new Set(
    (subjects || []).flatMap((subject) =>
      (subject?.topics || []).flatMap((topic) => preserveExamLabels(topic)),
    ),
  )];
}

export function mergeExamCompetitions(subjects = [], existing = []) {
  const previous = new Map((existing || []).map((item) => [item.label, item]));
  return collectExamLabels(subjects).map((label) => {
    const saved = previous.get(label);
    return {
      label,
      order: saved?.order ? String(saved.order) : "",
      examDate: saved?.examDate || "",
    };
  });
}

export function attachExamCompetitionData(roadmap = [], competitions = []) {
  const dataByLabel = new Map((competitions || []).map((item) => [item.label, item]));
  return (roadmap || []).map((subject) => ({
    ...subject,
    topics: (subject.topics || []).map((topic) => ({
      ...topic,
      examCompetitions: preserveExamLabels(topic)
        .map((label) => dataByLabel.get(label) ||
          (topic.examCompetitions || []).find((item) => item.label === label))
        .filter(Boolean)
        .map((item) => ({ ...item })),
    })),
  }));
}

function examTopicScheduleRank(topic, today = new Date()) {
  const currentDate = new Date(today);
  currentDate.setHours(0, 0, 0, 0);
  const data = new Map((topic?.examCompetitions || []).map((item) => [item.label, item]));
  const ranks = preserveExamLabels(topic).map((label) => {
    const competition = data.get(label);
    const order = Number(competition?.order);
    const validOrder = [1, 2, 3].includes(order) ? order : Number.POSITIVE_INFINITY;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(competition?.examDate || "")
      ? new Date(`${competition.examDate}T00:00:00`)
      : null;
    const daysUntilExam = date ? Math.ceil((date.getTime() - currentDate.getTime()) / 86400000) : -1;
    return {
      hasUpcomingDate: daysUntilExam >= 0,
      daysUntilExam,
      order: validOrder,
    };
  });
  return ranks.sort((left, right) =>
    Number(right.hasUpcomingDate) - Number(left.hasUpcomingDate) ||
    (left.hasUpcomingDate && right.hasUpcomingDate
      ? left.daysUntilExam - right.daysUntilExam
      : 0) ||
    left.order - right.order,
  )[0] || {
    hasUpcomingDate: false,
    daysUntilExam: -1,
    order: Number.POSITIVE_INFINITY,
  };
}

export function compareExamTopicPriority(left, right, today = new Date()) {
  const leftRank = examTopicScheduleRank(left, today);
  const rightRank = examTopicScheduleRank(right, today);
  return Number(rightRank.hasUpcomingDate) - Number(leftRank.hasUpcomingDate) ||
    (leftRank.hasUpcomingDate && rightRank.hasUpcomingDate
      ? leftRank.daysUntilExam - rightRank.daysUntilExam
      : 0) ||
    leftRank.order - rightRank.order;
}

export function validateExamCompetitions(competitions = [], noExamDate = false) {
  if (!competitions.length) return "";
  if (competitions.length > 3) return "A planilha contém mais de 3 concursos; a ordem aceita é de 1º a 3º.";
  const missingOrder = competitions.find((item) => !["1", "2", "3"].includes(String(item.order)));
  if (missingOrder) return `Selecione a ordem do concurso ${missingOrder.label}.`;
  const orders = competitions.map((item) => String(item.order));
  if (new Set(orders).size !== orders.length) return "Cada concurso precisa ter uma ordem diferente.";
  const first = competitions.find((item) => String(item.order) === "1");
  if (!first) return "Selecione qual concurso ficará na ordem 1.";
  if (!noExamDate && !first.examDate) return `Informe a data da prova do concurso ${first.label}, que está na ordem 1, ou marque “Nenhum dos concursos tem data de prova definida”.`;
  return "";
}

export function parseExamWorkbookRows(rows, exams = []) {
  const expected = ["Matéria", "Peso", "Assunto", "Prioridade", "Concurso"];
  const header = rows?.[0] || [];
  const cleanHeader = header.slice(0, 5).map((cell) => normalize(cell));
  const requiredHeader = expected.map(normalize);
  if (cleanHeader.length < 5 || requiredHeader.some((value, index) => cleanHeader[index] !== value)) {
    return { error: "Cabeçalho inválido. Use: Matéria | Peso | Assunto | Prioridade | Concurso." };
  }

  const allowedExams = new Map();
  for (const exam of exams) {
    if (exam?.label) allowedExams.set(normalize(exam.label), exam.label);
    if (exam?.key) allowedExams.set(normalize(exam.key), exam.label || exam.key);
  }

  const subjects = new Map();
  let currentSubject = "";
  let currentWeight = "";
  const errors = [];
  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const [subjectCell, weightCell, topicCell, priorityCell, examCell] = row || [];
    const subject = String(subjectCell ?? "").trim();
    const weight = String(weightCell ?? "").trim();
    const topic = String(topicCell ?? "").trim();
    const priority = String(priorityCell ?? "").trim();
    const contests = String(examCell ?? "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
    if (![subject, weight, topic, priority, String(examCell ?? "").trim()].some(Boolean)) return;
    if (subject) { currentSubject = subject; currentWeight = weight; }
    else if (!currentSubject) errors.push(`Linha ${rowNumber}: informe a matéria na coluna A.`);
    if (!topic) errors.push(`Linha ${rowNumber}: informe o assunto na coluna C.`);
    if (!(weight || currentWeight) || !Number.isFinite(Number(weight || currentWeight))) errors.push(`Linha ${rowNumber}: peso ausente ou inválido na coluna B.`);
    if (!priority) errors.push(`Linha ${rowNumber}: informe a prioridade na coluna D.`);
    if (!contests.length) errors.push(`Linha ${rowNumber}: informe ao menos um concurso na coluna E.`);
    const resolved = [];
    for (const contest of contests) {
      const canonical = allowedExams.get(normalize(contest)) ||
        (/^[\p{L}\p{N}][\p{L}\p{N}\s.'’()/_&-]*$/u.test(contest)
          ? contest
          : "");
      if (!canonical) errors.push(`Linha ${rowNumber}: concurso inválido na coluna E: “${contest}”.`);
      else if (!resolved.some((item) => normalize(item) === normalize(canonical))) resolved.push(canonical);
    }
    if (!topic || !currentSubject || !resolved.length) return;
    if (!subjects.has(currentSubject)) subjects.set(currentSubject, { subject: currentSubject, weight: weight || currentWeight, topics: [] });
    subjects.get(currentSubject).topics.push({ text: topic, priority, examLabels: resolved });
  });
  if (!rows || rows.length < 2) errors.push("A planilha não contém linhas de assuntos.");
  return errors.length ? { error: errors.join(" ") } : { subjects: [...subjects.values()] };
}
