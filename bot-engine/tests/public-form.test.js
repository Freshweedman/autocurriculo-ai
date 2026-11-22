const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { describe, visit } = require("../platforms/public-form");

const url = "https://job-boards.greenhouse.io/fixture/jobs/123456";
const form = `<!doctype html><html><body><main><form method="post"><label>Nome completo <input required name="name"></label><label>E-mail <input required type="email" name="email"></label><label>Telefone <input required type="tel" name="phone"></label><input required type="file" name="resume"><button type="submit">Enviar candidatura</button></form></main></body></html>`;

(async () => {
  assert.equal(describe(url)?.name, "Greenhouse");
  assert.equal(describe("https://example.com/job/1"), null);
  const resume = path.join(os.tmpdir(), "public-form-fixture.pdf"); fs.writeFileSync(resume, "%PDF-1.4\nfixture\n%%EOF");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route("https://job-boards.greenhouse.io/**", async route => {
      if (route.request().method() === "POST") return route.fulfill({ contentType: "text/html", body: "<h1>Candidatura confirmada</h1>" });
      return route.fulfill({ contentType: "text/html", body: form });
    });
    const page = await context.newPage();
    const ready = await visit(page, url, { submit: false });
    assert.equal(ready.status, "ready");
    const sent = await visit(page, url, { submit: true, resumePath: resume, profile: { full_name: "Pessoa de Teste", email: "test@example.invalid", phone: "+55 11 99999-0000" }, answers: {}, reserve: async () => true });
    assert.equal(sent.status, "confirmed"); assert.ok(sent.screenshot?.length > 50);
    await context.close(); console.log("public form fixture: inspected and confirmed; evidence=PUBLIC-FORM-001");
  } finally { await browser.close(); fs.rmSync(resume, { force: true }); }
})().catch(error => { console.error(error); process.exit(1); });
