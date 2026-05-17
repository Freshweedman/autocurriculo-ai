const fs = require("fs");

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync("/tmp/bot-log.txt", line + "\n");
}

module.exports = { log };
