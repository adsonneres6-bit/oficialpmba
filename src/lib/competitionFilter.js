const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleUpperCase("pt-BR")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const competitionAliases = {
  PMAL: new Set([
    "AL", "PMAL", "POLICIA MILITAR DE ALAGOAS", "POLICIA MILITAR DE ALAGOAS PMAL",
    "POLICIA MILITAR DO ESTADO DE ALAGOAS", "POLICIA MILITAR DO ESTADO DE ALAGOAS PMAL",
    "PMAL POLICIA MILITAR DE ALAGOAS", "PMAL POLICIA MILITAR DO ESTADO DE ALAGOAS",
  ]),
  PMPE: new Set([
    "PE", "PMPE", "POLICIA MILITAR DE PERNAMBUCO", "POLICIA MILITAR DE PERNAMBUCO PMPE",
    "POLICIA MILITAR DO ESTADO DE PERNAMBUCO", "POLICIA MILITAR DO ESTADO DE PERNAMBUCO PMPE",
    "PMPE POLICIA MILITAR DE PERNAMBUCO", "PMPE POLICIA MILITAR DO ESTADO DE PERNAMBUCO",
  ]),
  PMBA: new Set([
    "BA", "PMBA", "POLICIA MILITAR DA BAHIA", "POLICIA MILITAR DA BAHIA PMBA",
    "POLICIA MILITAR DO ESTADO DA BAHIA", "POLICIA MILITAR DO ESTADO DA BAHIA PMBA",
    "PMBA POLICIA MILITAR DA BAHIA", "PMBA POLICIA MILITAR DO ESTADO DA BAHIA",
  ]),
};

const competitionOrder = ["PMAL", "PMPE", "PMBA"];

function competitionTokens(value) {
  const normalized = normalize(value);
  if (normalized === "OS 3") return ["PMAL", "PMPE", "PMBA"];
  return String(value || "")
    .split(/\s*(?:\+|,|;|&|\||\/|\be\b)\s*/i)
    .map(normalize)
    .filter(Boolean)
    .flatMap((token) => token === "OS 3" ? ["PMAL", "PMPE", "PMBA"] : [token]);
}

export function competitionsFromLabels(labels = []) {
  const tokens = (labels || []).flatMap(competitionTokens);
  return competitionOrder.filter((competition) =>
    tokens.some((token) => competitionAliases[competition].has(token)),
  );
}

export function competitionLabelMatches(label, selectedCompetition) {
  return competitionsFromLabels([label]).includes(selectedCompetition);
}

export function topicsForCompetition(topics = [], selectedCompetition = "all") {
  if (selectedCompetition === "all") return topics;
  return (topics || []).filter((topic) =>
    (topic.examLabels || []).some((label) =>
      competitionLabelMatches(label, selectedCompetition),
    ),
  );
}
