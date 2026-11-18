/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { waitForSubmissionProof } = require("../bot-engine/utils/submission-proof");

async function run() {
  const page = {
    waitForFunction: async () => undefined,
    locator: () => ({ innerText: async () => "Sua candidatura foi enviada com sucesso." }),
    url: () => "https://example.com/application/receipt",
  };
  const proof = await waitForSubmissionProof(page);
  assert.equal(proof.type, "platform_confirmation");
  assert.equal(proof.reference, "https://example.com/application/receipt");
  console.log("submission proof: ok");
}
run();
