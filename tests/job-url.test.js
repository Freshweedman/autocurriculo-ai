/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { canonicalJobUrl } = require("../bot-engine/utils/job-url");

assert.equal(canonicalJobUrl("https://www.trabalhabrasil.com.br/vagas-de-emprego/analista-de-marketing"), null);
assert.equal(canonicalJobUrl("https://www.trabalhabrasil.com.br/vagas-de-emprego?Empresa=Teste"), null);
assert.equal(canonicalJobUrl("https://example.com/search?q=marketing"), null);
assert.equal(canonicalJobUrl("https://jobs.lever.co/acme/a1b2c3d4"), "https://jobs.lever.co/acme/a1b2c3d4");
assert.equal(canonicalJobUrl("https://br.indeed.com/viewjob?jk=abc123&utm_source=x"), "https://br.indeed.com/viewjob?jk=abc123");
console.log("job URL validation: ok");
