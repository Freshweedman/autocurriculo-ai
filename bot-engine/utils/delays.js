/**
 * Human-like delay and typing utilities.
 * All delays use actual await so they compose correctly.
 */

function randomDelay(minMs = 800, maxMs = 3000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Type text into a selector character-by-character with random keystroke delays.
 * @param {import('playwright').Page} page
 * @param {string} selector - CSS selector string (NOT an ElementHandle)
 * @param {string} text
 */
async function humanType(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await randomDelay(30, 120);
  }
}

/**
 * Type text into an ElementHandle directly (for loops where you already have the element).
 * @param {import('playwright').ElementHandle} element
 * @param {string} text
 */
async function humanTypeEl(element, text) {
  await element.click();
  for (const char of text) {
    await element.page().keyboard.type(char);
    await randomDelay(30, 120);
  }
}

module.exports = { randomDelay, humanType, humanTypeEl };
