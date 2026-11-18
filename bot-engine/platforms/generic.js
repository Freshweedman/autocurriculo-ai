const { randomDelay } = require("../utils/delays");
const { log } = require("../utils/logger");
const { completeApplicationForm } = require("../forms/application-form");

/**
 * Generic bot for platforms like InfoJobs, Abler, Kenoby, "Trabalhe Conosco" pages.
 * Strategy: detect file inputs, auto-attach resume. Login if credentials provided.
 */
async function applyGeneric(browser, config) {
  const { curriculoPath, plataforma, urls, email, senha, candidate } = config;
  const results = [];

  for (const url of urls) {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "pt-BR",
    });
    const page = await context.newPage();

    try {
      log(`[${plataforma}] Acessando: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(2000, 4000);

      // Try login if credentials provided and login form detected
      if (email && senha) {
        const loginFields = await page.$$('input[type="email"], input[name*="email"], input[id*="email"]');
        const passFields = await page.$$('input[type="password"]');

        if (loginFields.length > 0 && passFields.length > 0) {
          log(`[${plataforma}] Detectado formulario de login - autenticando...`);

          // Use fill() directly on the ElementHandle — avoids the humanType(selector) bug
          for (const field of loginFields) {
            try {
              const isVisible = await field.isVisible();
              if (isVisible) {
                await field.fill(email);
                break;
              }
            } catch (_) {}
          }

          for (const field of passFields) {
            try {
              const isVisible = await field.isVisible();
              if (isVisible) {
                await field.fill(senha);
                break;
              }
            } catch (_) {}
          }

          // Submit login
          const submitBtn = await page.$(
            'button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")'
          );
          if (submitBtn) {
            await submitBtn.click();
            await randomDelay(3000, 6000);
            log(`[${plataforma}] Login efetuado`);
          }
        }
      }

      const form = await completeApplicationForm(page, { candidate: candidate || { name: "", email: email || "", phone: "", experience: "" }, resumePath: curriculoPath });
      log(`[${plataforma}] Resultado do formulário: ${form.status}`);
      results.push({ empresa: plataforma, vaga: url, vaga_url: url, plataforma, status: form.status, confirmationEvidence: form.confirmationEvidence });

    } catch (err) {
      log(`[ERRO] ${plataforma} ${url}: ${err.message}`);
      results.push({ empresa: plataforma, vaga: url, vaga_url: url, plataforma, status: "falhou" });
    } finally {
      await context.close();
    }
  }

  return results;
}

module.exports = { applyGeneric };
