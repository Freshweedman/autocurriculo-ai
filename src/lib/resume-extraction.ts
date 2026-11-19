export type ResumeCandidate = { fullName: string; phone: string; summary: string };

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}\b/;
const HEADING = /^(curr[ií]culo|curriculum|curriculum vitae|resume|contato|experi[eê]ncia|forma[cç][aã]o|educa[cç][aã]o|habilidades|compet[eê]ncias|objetivo|perfil)$/i;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function extractCandidateFromResume(text: string, fileName = ""): ResumeCandidate {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const nameLine = lines.find((line) => (
    line.length >= 4 && line.length <= 80 && !EMAIL.test(line) && !PHONE.test(line) && !HEADING.test(line)
    && /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,5}$/u.test(line)
  ));
  const fileNameCandidate = clean(fileName.replace(/[_-]+/g, " "));
  const fullName = nameLine || (/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,5}$/u.test(fileNameCandidate) ? fileNameCandidate : "");
  const phone = text.match(PHONE)?.[0]?.replace(/\s+/g, " ").trim() || "";
  const summaryLines = lines.filter((line) => line !== nameLine && !EMAIL.test(line) && !PHONE.test(line) && !HEADING.test(line));
  const summary = clean(summaryLines.slice(0, 8).join(" ")).slice(0, 900);
  return { fullName, phone, summary };
}
