const fs = require("fs");
const path = require("path");
const os = require("os");

// Cross-platform log path: /tmp on Linux/Mac (GitHub Actions), os.tmpdir() on Windows
const LOG_PATH = process.platform === "win32"
  ? path.join(os.tmpdir(), "bot-log.txt")
  : "/tmp/bot-log.txt";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + "\n");
  } catch (_) {
    // Ignore write errors (readonly fs in some CI environments)
  }
}

module.exports = { log };
