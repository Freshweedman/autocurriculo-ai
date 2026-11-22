const { normalize } = require("../platforms/publicboards");
const { attachResume } = require("./application-form");
const { randomDelay } = require("../utils/delays");

const FINAL = /^(?:enviar candidatura|submit application|finalizar candidatura|concluir candidatura|enviar sua candidatura|send application|enviar inscrição|submit)$/i;
const NEXT = /^(?:continuar|continue|próxima|next|avançar|revisar candidatura|review application)$/i;
const CONFIRMATION = /^\s*(?:(?:sua )?candidatura (?:foi )?(?:enviada|recebida|confirmada)(?: com sucesso)?|(?:your )?application (?:was |has been )?(?:sent|submitted|received)(?: successfully)?|application successfully submitted|obrigad[oa] (?:por se candidatar|pela sua candidatura)|thank you for applying)[\s!.]*$/i;

async function proofText(page) {
  return (await page.locator("h1,h2,h3,[role=status],[role=alert],p").allTextContents())
    .map((line) => line.trim()).find((line) => CONFIRMATION.test(line)) || "";
}

function answerFor(field, profile, answers) {
  const label = normalize(field.label);
  const supplied = Object.entries(answers || {}).find(([question]) => normalize(question) === label);
  if (supplied) return supplied[1];
  if (/^(first name|given name|primeiro nome)$/.test(label) || field.auto === "given-name") return profile.full_name?.trim().split(/\s+/)[0];
  if (/^(last name|family name|sobrenome)$/.test(label) || field.auto === "family-name") return profile.full_name?.trim().split(/\s+/).slice(1).join(" ");
  if (/^(nome completo|full name)$/.test(label) || field.auto === "name") return profile.full_name;
  if (/^(e mail|email|email address|endereco de email)$/.test(label) || field.auto === "email" || field.type === "email") return profile.email;
  if (/^(telefone|celular|phone number|telefone celular)$/.test(label) || field.auto === "tel" || field.type === "tel") return profile.phone;
  if (/^(resumo profissional|professional summary)$/.test(label)) return profile.summary;
  return null;
}

async function prepareFields(page, profile, answers) {
  const fields = page.locator('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]):not([type=reset]), textarea, select, [role=combobox]:not(input)');
  const pending = new Set();
  for (const field of await fields.all()) {
    if (!await field.isVisible() || !await field.isEnabled()) continue;
    const info = await field.evaluate((element) => {
      const group = element.closest("fieldset,[role=radiogroup]");
      return {
        type: element.type, auto: element.autocomplete,
        label: group?.querySelector("legend")?.textContent?.trim() ||
          element.labels?.[0]?.textContent?.trim() || element.getAttribute("aria-label") || element.name || "",
        option: element.labels?.[0]?.textContent?.trim() || element.value,
        required: element.required || element.getAttribute("aria-required") === "true",
        tag: element.tagName, value: element.value, checked: element.checked,
      };
    });
    if (info.type === "password") {
      pending.add("Entre na plataforma antes de enviar.");
      continue;
    }
    const answer = answerFor(info, profile, answers);
    const label = info.label || "campo sem rótulo";
    if (info.type === "radio") {
      if (answer && normalize(info.option) === normalize(answer)) await field.check();
      else if (info.required && !answer) pending.add(label);
      continue;
    }
    if (info.type === "checkbox" || !["INPUT", "TEXTAREA", "SELECT"].includes(info.tag)) {
      if (info.required || !info.checked) pending.add(label);
      continue;
    }
    if (answer && info.tag === "SELECT") {
      const options = await field.locator("option").allTextContents();
      const match = options.find((option) => normalize(option) === normalize(answer));
      if (match) await field.selectOption({ label: match.trim() });
      else pending.add(label);
      continue;
    }
    if (answer) {
      await field.fill(answer);
      continue;
    }
    if (info.required) pending.add(label);
  }
  const unanswered = await page.locator('input[type="radio"]:required').evaluateAll((elements) =>
    elements.filter((element) => element.getClientRects().length && !Array.from(element.form?.elements || document.querySelectorAll("input")).some((other) => other.type === "radio" && other.name === element.name && other.checked))
      .map((element) => element.closest("fieldset")?.querySelector("legend")?.textContent?.trim() || element.name || "seleção obrigatória"));
  return [...new Set([...pending, ...unanswered])];
}

async function completeLocalApplication(page, options) {
  const { profile = {}, answers, resumePath, dryRun, trusted, detectState, beforeSubmit, capture } = options;
  let attached = false;
  for (let step = 1; step <= 8; step += 1) {
    if (!trusted(page.url())) return { status: "skipped_external", detail: "O formulário redirecionou para outro site." };
    if (await detectState(page) !== "available") return { status: "needs_login", detail: "Entre no site pelo perfil local e conclua a verificação." };
    const pending = await prepareFields(page, profile, answers);
    const upload = page.locator('input[type="file"]');
    if (!attached && resumePath && await upload.count() === 1) {
      attached = (await attachResume(page, resumePath)).kind === "resume_attached";
    }
    await capture?.(page, `02-etapa-${step}`);
    if (pending.length) return { status: "needs_review", detail: `Revise as perguntas: ${pending.join(", ")}.` };

    const submit = page.getByRole("button", { name: FINAL }).first();
    if (await submit.isVisible()) {
      if (!attached) return { status: "needs_review", detail: "O runner não conseguiu verificar o anexo do PDF selecionado." };
      const formAction = await submit.evaluate((element) => element.formAction && element.hasAttribute("formaction") ? element.formAction : element.form?.action);
      if (formAction && !trusted(formAction)) return { status: "skipped_external", detail: "O formulário envia para outro site." };
      await capture?.(page, "03-botao-final");
      if (dryRun) return { status: "dry_run", detail: "Botão final identificado. O envio não foi acionado." };
      if (await proofText(page)) return { status: "needs_review", detail: "Já havia uma confirmação na tela antes do envio." };
      await randomDelay(1200, 3000);
      if (!await beforeSubmit()) return { status: "queued", detail: "Envio não reservado. Verifique a autorização, o horário, os limites ou o histórico da vaga." };
      await submit.click({ timeout: 5_000 });
      for (let check = 0; check < 20; check += 1) {
        if (!trusted(page.url()) || await detectState(page) === "needs_login") break;
        const confirmation = await proofText(page);
        if (confirmation) {
          const screenshot = await page.screenshot({ type: "jpeg", quality: 65, timeout: 3000 }).catch(() => null);
          await capture?.(page, "04-confirmacao").catch(() => {});
          return { status: "applied_confirmed", text: confirmation, url: page.url(), screenshot: screenshot?.toString("base64") };
        }
        await page.waitForTimeout(500);
      }
      return { status: "applied_unconfirmed", detail: "A plataforma não exibiu uma confirmação reconhecida." };
    }
    const next = page.getByRole("button", { name: NEXT }).first();
    if (!await next.isVisible()) return { status: "needs_review", detail: "Etapa do formulário sem controle reconhecido." };
    if (await next.evaluate((element) => Boolean(element.form) && element.type === "submit")) {
      return { status: "needs_review", detail: "O formulário não permite distinguir a etapa de navegação do envio." };
    }
    await next.click({ timeout: 5_000 });
    await randomDelay(500, 1200);
  }
  return { status: "needs_review", detail: "O formulário ultrapassou o número de etapas reconhecidas." };
}

module.exports = { completeLocalApplication };
