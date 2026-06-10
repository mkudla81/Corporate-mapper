import crypto from "crypto";

// AES-256-GCM encryption for secrets at rest (CRM tokens). The key is
// derived from APP_SECRET; rotate by re-encrypting under a new secret.
// Format: enc:v1:<iv-hex>:<authtag-hex>:<ciphertext-hex>

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET must be set in production");
    }
    return crypto.createHash("sha256").update("dev-only-insecure-secret").digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  // Tolerate legacy plaintext values (pre-encryption rows).
  if (!stored.startsWith(PREFIX)) return stored;
  const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString(
    "utf8"
  );
}
