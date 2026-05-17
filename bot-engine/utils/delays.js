function randomDelay(minMs = 800, maxMs = 3000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

function humanType(page, selector, text) {
  // Simulate human typing with random delays between keystrokes
  let promise = page.waitForSelector(selector, { timeout: 10000 });
  return promise.then(async () => {
    await page.click(selector);
    for (const char of text) {
      await page.keyboard.type(char);
      await randomDelay(30, 120);
    }
  });
}

module.exports = { randomDelay, humanType };
