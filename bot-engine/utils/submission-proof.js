const SUCCESS = /(?:candidatura|application).{0,80}(?:enviad[ao]|recebid[ao]|confirmad[ao]|submi(?:tted|ssion))|(?:enviad[ao]|recebid[ao]|confirmad[ao]|submi(?:tted|ssion)).{0,80}(?:candidatura|application)|obrigad[oa].{0,80}(?:candidatura|application)/i;

async function waitForSubmissionProof(page, timeout = 8_000) {
  try {
    await page.waitForFunction((pattern) => new RegExp(pattern, "i").test(document.body?.innerText || ""), SUCCESS.source, { timeout });
    const text = await page.locator("body").innerText().catch(() => "");
    const match = text.match(SUCCESS);
    return { type: "platform_confirmation", reference: page.url(), details: { message: match?.[0]?.slice(0, 240) || "Confirmação apresentada pela plataforma" } };
  } catch { return null; }
}

module.exports = { waitForSubmissionProof };
