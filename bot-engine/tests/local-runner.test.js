const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
const { completeLocalApplication } = require("../forms/local-application");
const { expand, rank } = require("../local/discovery");

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "autocurriculo-fixture-"));
  const evidence = process.env.AUTOCURRICULO_TEST_EVIDENCE || directory;
  await fs.mkdir(evidence, { recursive: true });
  const resumePath = path.join(directory, "Curriculo.pdf");
  await fs.writeFile(resumePath, "%PDF-1.4\nTeste controlado\n");
  let received = 0;
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url === "/login") res.setHeader("Set-Cookie", "fixture_session=active; Max-Age=86400; HttpOnly; SameSite=Lax; Path=/");
    if (req.url === "/submit") {
      received += 1;
      req.resume();
      req.on("end", () => res.end("<h1>Candidatura enviada com sucesso!</h1>"));
      return;
    }
    const loggedIn = /fixture_session=active/.test(req.headers.cookie || "");
    res.end(`<h1>${loggedIn ? "Sessão de teste ativa" : "Sessão de teste"}</h1>
      <section id="step"><button onclick="document.querySelector('#step').hidden=true;document.querySelector('form').hidden=false">Continuar</button></section>
      <form method="post" action="/submit" enctype="multipart/form-data" hidden>
        <label>Nome completo <input name="name" required></label>
        <label>Qual é o seu salário pretendido? <input name="salary" required></label>
        <label>Currículo <input name="file" type="file" required></label>
        <button>Enviar candidatura</button>
      </form>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = path.join(directory, "profile");
  let context;
  const launch = () => chromium.launchPersistentContext(profile, { channel: "chrome", headless: true });
  try {
    context = await launch();
    await context.pages()[0].goto(base + "/login");
    await context.close();
    context = await launch();
    const page = context.pages()[0];
    await page.goto(base);
    assert.equal(await page.locator("h1").innerText(), "Sessão de teste ativa");
    const capture = (current, label) => current.screenshot({ path: path.join(evidence, label + ".png") });
    await capture(page, "00-sessao-fixture-reaberta");

    const settings = {
      profile: { full_name: "Pessoa de Teste" }, resumePath, dryRun: true,
      trusted: (url) => url.startsWith(base + "/"), detectState: async () => "available",
      beforeSubmit: async () => { throw Error("Dry-run chamou a reserva"); }, capture,
    };
    const missing = await completeLocalApplication(page, { ...settings, capture: undefined });
    assert.equal(missing.status, "needs_review");
    assert.match(missing.detail, /salário pretendido/);
    assert.equal(received, 0);

    settings.answers = { "Qual é o seu salário pretendido?": "3000" };
    await page.goto(base);
    const dry = await completeLocalApplication(page, settings);
    assert.equal(dry.status, "dry_run");
    assert.equal(received, 0);

    await page.goto(base);
    const applied = await completeLocalApplication(page, { ...settings, capture: undefined, dryRun: false, beforeSubmit: async () => true });
    assert.equal(received, 1);
    assert.equal(applied.status, "applied_confirmed");
    assert.match(applied.text, /Candidatura enviada/);
    assert.ok(applied.screenshot);
    await capture(page, "04-confirmacao-fixture");
    console.log("Fixture local: sessão reaberta; campo desconhecido interrompido; dry-run sem requisição; confirmação capturada após um POST de teste.");
    if (evidence !== directory) console.log("Capturas da fixture: " + evidence);
  } finally {
    await context?.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }

  const filters = expand({ cargo: "analista de qualidade", cidade: "Porto Alegre" });
  assert.ok(rank({ title: "QA Engineer", location: "Canoas - RS" }, filters, filters.stages[1]).score > 0);
  assert.ok(rank({ title: "Analista da Qualidade", location: "Remoto, Brasil" }, filters, filters.stages.at(-1)).score > 0);
  assert.equal(rank({ title: "Analista Contábil", location: "Porto Alegre" }, filters, filters.stages[0]).score, 0);
  assert.equal(rank({ title: "QA Engineer", location: "Remote, United States" }, filters, filters.stages.at(-1)).score, 0);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
