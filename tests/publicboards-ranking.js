/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { scoreJob, locationAllowsJob } = require("../bot-engine/platforms/publicboards");

const brazilianProfile = { cargo: "analista de marketing digital", countryCode: "BR", city: "São Paulo", allowInternational: false };

const brazilianJob = scoreJob({ vaga: "Analista de Marketing Digital", local: "São Paulo, Brasil", raw: "marketing digital analytics campanhas" }, brazilianProfile);
assert.equal(brazilianJob.accepted, true, "vaga brasileira compatível deve ser aceita");
assert.ok(brazilianJob.score >= 45, "vaga compatível deve ter pontuação mínima");

const foreignJob = scoreJob({ vaga: "Marketing Analyst", local: "Berlin, Germany", raw: "digital marketing" }, brazilianProfile);
assert.equal(foreignJob.accepted, false, "vaga internacional não pode passar sem opt-in");

const weakMatch = scoreJob({ vaga: "Revenue Operations Analyst", local: "São Paulo, Brasil", raw: "sales operations" }, brazilianProfile);
assert.equal(weakMatch.accepted, false, "correspondência por palavra genérica não pode recomendar vaga");

assert.equal(locationAllowsJob("Remote — Brazil", { countryCode: "BR" }).allowed, true);
assert.equal(locationAllowsJob("Remote — Worldwide", { countryCode: "BR" }).allowed, false);
assert.equal(locationAllowsJob("Remote — Worldwide", { countryCode: "BR", allowInternational: true }).allowed, true);

console.log("publicboards ranking: ok");
