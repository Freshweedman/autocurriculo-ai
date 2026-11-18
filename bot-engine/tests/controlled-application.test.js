const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { completeApplicationForm } = require("../forms/application-form");

function testPage() {
  return `<!doctype html><html><body><form method="post" enctype="multipart/form-data">
    <section id="one"><label>Nome <input required name="name"></label><label>E-mail <input required type="email" name="email"></label><label>Telefone <input required name="phone"></label><button type="button" id="next">Continuar</button></section>
    <section id="two" hidden><label>Experiência <textarea required name="experience"></textarea></label><input id="resume" hidden required type="file" name="resume" accept="application/pdf"><button type="button" id="chooser">Selecionar currículo</button><span id="selected"></span><button type="submit">Enviar candidatura</button></section>
  </form><script>const one=document.querySelector('#one'), two=document.querySelector('#two'), file=document.querySelector('#resume');document.querySelector('#next').onclick=()=>{one.hidden=true;two.hidden=false};document.querySelector('#chooser').onclick=()=>file.click();file.onchange=()=>document.querySelector('#selected').textContent=file.files[0]?.name||''</script></body></html>`;
}

function startServer() {
  let receipt = null;
  const server = http.createServer((request, response) => {
    if (request.method === "GET") { response.writeHead(200, { "content-type": "text/html" }); response.end(testPage()); return; }
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      receipt = { contentType: request.headers["content-type"] || "", body };
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<main><h1>Candidatura confirmada</h1><p>Recebemos sua candidatura. Identificador: TEST-APP-001</p></main>");
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}`, getReceipt: () => receipt })));
}

(async () => {
  const tempResume = path.join(os.tmpdir(), `autocurriculo-controlled-${Date.now()}.pdf`);
  fs.writeFileSync(tempResume, Buffer.from("%PDF-1.4\ncontrolled-resume\n%%EOF\n"));
  const { server, url, getReceipt } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const result = await completeApplicationForm(page, { candidate: { name: "Pessoa de Teste", email: "test@example.invalid", phone: "+55 11 99999-0000", experience: "Experiência destinada exclusivamente ao teste controlado." }, resumePath: tempResume });
    const receipt = getReceipt();
    assert.equal(result.status, "confirmed");
    assert.equal(result.resume?.kind, "resume_attached");
    assert.ok(receipt?.contentType.includes("multipart/form-data"), "server did not receive multipart form data");
    assert.ok(receipt.body.includes(Buffer.from("autocurriculo-controlled-")), "server did not receive the resume filename");
    assert.ok(receipt.body.includes(Buffer.from("%PDF-1.4")), "server did not receive the PDF bytes");
    assert.ok(receipt.body.includes(Buffer.from("Pessoa de Teste")), "server did not receive the name");
    console.log("controlled application: confirmed; PDF bytes and profile fields received; evidence=TEST-APP-001");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    fs.unlinkSync(tempResume);
  }
})().catch((error) => { console.error(error); process.exit(1); });
