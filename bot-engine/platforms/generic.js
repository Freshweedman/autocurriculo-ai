const { randomDelay, humanType } = require("../utils/delays");
const { log } = require("../utils/logger");

/**
 * Generic bot for platforms like InfoJobs, Abler, Kenoby, "Trabalhe Conosco" pages.
 * Strategy: login if credentials provided, detect file inputs, auto-attach resume.
 */
async function applyGeneric(browser, config) {
  const { curriculoPath, plataforma, urls, email, senha } = config;
  const results = [];

  for (const url of urls) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    try {
      log(`[${plataforma}] Acessando: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);

      // Try login if credentials provided and login form detected
      if (email && senha) {
        const loginFields = await page.$$('input[type="email"], input[name*="email"], input[id*="email"], input[name*="login"], input[id*="login"]');
        const passFields = await page.$$('input[type="password"]');

        if (loginFields.length > 0 && passFields.length > 0) {
          log(`[${plataforma}] Detectado formulario de login - autenticando...`);

          for (const field of loginFields) {
            try {
              await field.click();
              await humanType(page, field, email);
              break;
            } catch (_) { /* try next field */ }
          }

          for (const field of passFields) {
            try {
              await field.click();
              await humanType(page, field, senha);
              break;
            } catch (_) { /* try next field */ }
          }

          // Submit login
          const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")');
          if (submitBtn) {
            await submitBtn.click();
            await randomDelay(3000, 6000);
            log(`[${plataforma}] Login efetuado`);
          }
        }
      }

      // Detect file inputs for resume upload
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        for (const input of fileInputs) {
          try {
            await input.setInputFiles(curriculoPath);
            log(`[${plataforma}] Curriculo anexado em: ${url}`);
            await randomDelay(1000, 2000);

            // Try to submit after upload
            const submitBtn = await page.$(
              'button[type="submit"], input[type="submit"], button:has-text("Enviar"), button:has-text("Candidatar"), button:has-text("Apply"), button:has-text("Confirmar")'
            );
            if (submitBtn) {
              await submitBtn.click();
              await randomDelay(2000, 3000);
              log(`[${plataforma}] Formulario enviado`);
            }
          } catch (inputErr) {
            log(`[${plataforma}] Erro upload: ${inputErr.message}`);
          }
        }
        results.push({ empresa: plataforma, vaga: url.split("/").pop(), plataforma, status: "enviado" });
      } else {
        log(`[${plataforma}] Nenhum input[type=file] encontrado em: ${url}`);
        results.push({ empresa: plataforma, vaga: url.split("/").pop(), plataforma, status: "sem_file_input" });
      }

    } catch (err) {
      log(`[ERRO] ${plataforma} ${url}: ${err.message}`);
      results.push({ empresa: plataforma, vaga: url.split("/").pop(), plataforma, status: "falhou" });
    } finally {
      await context.close();
    }
  }

  return results;
}

module.exports = { applyGeneric };
