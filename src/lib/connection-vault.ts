import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function keyFromEnvironment() {
  const raw = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!raw) throw new Error("CONNECTION_ENCRYPTION_KEY is not configured");

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CONNECTION_ENCRYPTION_KEY must be a 32-byte base64 key");
  return key;
}

export function encryptConnectionSecret(value: string) {
  const key = keyFromEnvironment();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptConnectionSecret(payload: Uint8Array) {
  const key = keyFromEnvironment();
  const packed = Buffer.from(payload);
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
