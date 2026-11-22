const { normalize } = require("../platforms/publicboards");

const QUALITY = [
  "analista de qualidade", "QA", "analista de testes", "controle de qualidade",
  "garantia da qualidade", "inspetor de qualidade", "assistente de qualidade",
  "quality assurance", "engenheiro de qualidade", "qualidade",
];
const METRO = [
  "porto alegre", "canoas", "gravatai", "cachoeirinha", "alvorada", "viamao",
  "esteio", "sapucaia do sul", "sao leopoldo", "novo hamburgo", "guaiba",
  "eldorado do sul", "campo bom", "sapiranga", "nova santa rita", "triunfo",
  "montenegro", "charqueadas", "santo antonio da patrulha", "glorinha",
];
const STATE = /\b(?:rs|rio grande do sul)\b/;
const BRAZIL = /\b(?:br|brasil|brazil|latam|latin america|america latina|rs|sc|pr|sp|rj|mg|es|ba|pe|ce|df|go|mt|ms|am|pa|ma|pb|pi|rn|se|al|ac|ro|rr|to|ap)\b/;
const LEVELS = { jr: /\b(?:jr|junior|i)\b/, pl: /\b(?:pl|pleno|ii)\b/, sr: /\b(?:sr|senior|iii)\b/ };

function expand(profile = {}, applicant = {}, search = {}) {
  const terms = String(profile.cargo || "analista de qualidade").split(/[,;\n]/).map((term) => term.trim()).filter(Boolean);
  const levels = Object.keys(LEVELS).filter((level) => terms.some((term) => LEVELS[level].test(normalize(term))));
  const base = terms.map((term) => term.replace(/\b(?:j[uú]nior|s[eê]nior|pleno|jr|pl|sr|iii|ii|i)\b\.?/gi, "").trim()).filter(Boolean);
  const quality = base.some((term) => /\b(?:qualidade|qa|quality|testes)\b/.test(normalize(term)));
  const synonyms = [...new Set(quality ? [...base, ...QUALITY] : base)];
  const cityValue = applicant.city || profile.cidade || "Porto Alegre";
  const city = cityValue.split(/,|\s+-\s+/)[0].trim();
  const isMetro = METRO.includes(normalize(city));
  const state = applicant.state || cityValue.split(/,|\s+-\s+/)[1]?.trim() || (isMetro ? "RS" : "");
  const country = applicant.country_code || "BR";
  const remoteOnly = Boolean(search.remote_only);
  const modes = (search.work_modes || []).map(normalize);
  const stateName = normalize(state);
  const local = remoteOnly ? [] : [
    { name: city, locations: [city] },
    ...(isMetro ? [{ name: "Região Metropolitana de Porto Alegre", locations: ["Canoas", "São Leopoldo", "Gravataí"] }] : []),
    ...(state ? [{ name: state, locations: [state] }] : []),
  ];
  return { terms, base, levels, quality, synonyms, city, stateName, isMetro, country, remoteOnly, modes,
    stages: [...local, { name: "Remoto e híbrido", locations: [country === "BR" ? "Brasil" : country] }] };
}

function rank(job, filters, stage) {
  const title = normalize(job.title).replace(/\banalistade\b/g, "analista de");
  const location = normalize(job.location);
  const phrase = (value, term) => (" " + value + " ").includes(" " + normalize(term) + " ");
  const titleMatch = filters.base.some((term) => phrase(title, term));
  const related = filters.synonyms.some((term) => term !== "qualidade" && phrase(title, term))
    || filters.quality && /\b(?:analista|inspetor|assistente|engenheir[oa]|especialista|tecnic[oa]|auditor[ao]?)\b.*\b(?:qualidade|testes)\b/.test(title);
  const modeText = location + " " + title;
  const remote = /\b(?:remot[oa]|remote|home office)\b/.test(modeText);
  const hybrid = /\b(?:hibrid[oa]|hybrid)\b/.test(modeText);
  const city = phrase(location, filters.city);
  const metro = filters.isMetro && METRO.some((label) => phrase(location, label));
  const state = filters.stateName === "rs" || filters.stateName === "rio grande do sul"
    ? STATE.test(location) || metro : filters.stateName && phrase(location, filters.stateName);
  const brazil = BRAZIL.test(location) || metro || city;
  const last = stage.name === "Remoto e híbrido";
  const qualifiers = Object.keys(LEVELS).filter((key) => LEVELS[key].test(title));
  const levelMatches = !filters.levels.length || !qualifiers.length || filters.levels.some((level) => qualifiers.includes(level));
  const allowedMode = !filters.modes.length || filters.modes.some((mode) =>
    remote && /remot/.test(mode) || hybrid && /hybrid|hibrid/.test(mode) || !remote && !hybrid && /on.?site|presencial/.test(mode));
  const allowedLocation = filters.country === "BR"
    ? (filters.remoteOnly ? remote && brazil : last ? remote && brazil || hybrid && (city || metro || state)
      : (city || stage.name === "Região Metropolitana de Porto Alegre" && metro || normalize(stage.name) === filters.stateName && state))
    : phrase(location, filters.country) && (filters.remoteOnly || last ? remote : city);
  if (!related || !allowedLocation || !levelMatches || !allowedMode) {
    return { score: 0, detail: !related ? "Título fora dos cargos configurados." : !levelMatches ? "Senioridade diferente da configurada." : "Localidade ou modalidade fora do filtro." };
  }
  const distance = city ? 25 : metro ? 21 : state ? 17 : 13;
  return { score: (titleMatch ? 65 : 54) + distance, detail: `${titleMatch ? "Cargo configurado" : "Cargo relacionado"} · ${job.location}` };
}

module.exports = { expand, rank };
