const { waitForSubmissionProof } = require("../utils/submission-proof");

const CONTINUE_LABEL = /^(continuar|continue|pr[oó]xima|next|avancar|avan[cç]ar)$/i;
const SUBMIT_LABEL = /(?:enviar candidatura|submit application|finalizar candidatura|concluir candidatura|candidatar-se|apply now|enviar$|submit$)/i;

function fieldPurpose(element) {
  return ["name", "id", "type", "autocomplete", "placeholder", "aria-label"]
    .map((attribute) => element.getAttribute(attribute) || "")
    .join(" ")
    .toLowerCase();
}

function valueForPurpose(purpose, candidate) {
  if (/(last.?name|sobrenome)/.test(purpose)) return candidate.lastName || candidate.name;
  if (/(first.?name|\bname\b|nome)/.test(purpose)) return candidate.name;
  if (/(e-?mail)/.test(purpose)) return candidate.email;
  if (/(phone|telefone|celular)/.test(purpose)) return candidate.phone;
  if (/(experience|experi|summary|resumo)/.test(purpose)) return candidate.experience;
  return undefined;
}

async function fillKnownFields(page, candidate) {
  const fields = page.locator("input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea");
  const filled = [];
  for (let index = 0; index < await fields.count(); index += 1) {
    const field = fields.nth(index);
    if (!await field.isVisible()) continue;
    const purpose = await field.evaluate(fieldPurpose);
    const value = valueForPurpose(purpose, candidate);
    if (value && !(await field.inputValue()).trim()) {
      await field.fill(value);
      filled.push(purpose || `field-${index}`);
    }
  }
  return filled;
}

async function attachResume(page, resumePath) {
  const fileInputs = page.locator("input[type=file]");
  if (await fileInputs.count()) {
    for (let index = 0; index < await fileInputs.count(); index += 1) {
      try {
        await fileInputs.nth(index).setInputFiles(resumePath);
        return { kind: "resume_attached", strategy: "native_file_input" };
      } catch (_) {
        // Try the next input or a dedicated file chooser button below.
      }
    }
  }

  const uploadControl = page.getByRole("button", { name: /anexar|selecionar.*curr[ií]culo|upload.*curr[ií]culo|upload resume/i }).first();
  if (await uploadControl.count() && await uploadControl.isVisible()) {
    try {
      const chooserPromise = page.waitForEvent("filechooser", { timeout: 3_000 });
      await uploadControl.click();
      const chooser = await chooserPromise;
      await chooser.setFiles(resumePath);
      return { kind: "resume_attached", strategy: "file_chooser" };
    } catch (_) {
      // Report a precise outcome instead of misclassifying this as a submission.
    }
  }
  return { kind: "upload_unavailable" };
}

async function visibleRequiredFields(page) {
  return page.locator("input[required]:not([type=file]):not([type=hidden]), textarea[required], select[required]").evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().width > 0;
    })
    .filter((element) => !element.value)
    .map((element) => ({ name: element.getAttribute("name") || element.id || "unknown", label: element.getAttribute("aria-label") || element.getAttribute("placeholder") || "" })));
}

async function firstVisibleButton(page, expression) {
  const buttons = page.locator("button, input[type=submit]");
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (!await button.isVisible()) continue;
    const label = ((await button.getAttribute("value")) || (await button.innerText().catch(() => ""))).trim();
    if (expression.test(label)) return button;
  }
  return null;
}

/**
 * Executes only a known, authorized application flow. It intentionally refuses
 * to guess answers for required fields which are not present in the profile.
 */
async function completeApplicationForm(page, { candidate, resumePath, maxSteps = 8 }) {
  const filled = await fillKnownFields(page, candidate);
  let resume = null;

  for (let step = 0; step < maxSteps; step += 1) {
    await fillKnownFields(page, candidate);
    if (!resume && resumePath) resume = await attachResume(page, resumePath);

    const submit = await firstVisibleButton(page, SUBMIT_LABEL);
    if (submit) {
      const required = await visibleRequiredFields(page);
      if (required.length) return { status: "unknown_required_field", filled, resume, required };
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => null),
        submit.click(),
      ]);
      const evidence = await waitForSubmissionProof(page, 10_000);
      return evidence
        ? { status: "confirmed", filled, resume, confirmationEvidence: evidence }
        : { status: "pending_confirmation", filled, resume };
    }

    const next = await firstVisibleButton(page, CONTINUE_LABEL);
    if (!next) return { status: resume?.kind === "upload_unavailable" ? "upload_unavailable" : "form_incompatible", filled, resume };
    await next.click();
    await page.waitForTimeout(150);
  }
  return { status: "form_incomplete", filled, resume };
}

module.exports = { attachResume, completeApplicationForm, fillKnownFields, visibleRequiredFields };
