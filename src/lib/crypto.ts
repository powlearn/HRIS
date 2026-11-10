import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Field-level encryption for sensitive personal data (NIK, NPWP, BPJS, bank
 * account). Values are encrypted with AES-256-GCM using a key derived from
 * AUTH_SECRET, then stored as `v1:<iv>:<tag>:<ciphertext>` base64url.
 */
const PREFIX = "v1";

function key(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET (atau FIELD_ENCRYPTION_KEY) belum dikonfigurasi dengan benar.");
  }
  return createHash("sha256").update(`nexahr:field:${secret}`).digest();
}

export function encryptField(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, ivPart, tagPart, dataPart] = payload.split(":");
  if (version !== PREFIX || !ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Mask a value while keeping a few characters for human verification. */
export function maskValue(value: string | null | undefined, visibleTail = 4): string {
  if (!value) return "—";
  if (value.length <= visibleTail) return "•".repeat(value.length);
  const head = "•".repeat(Math.max(0, Math.min(8, value.length - visibleTail)));
  return `${head}${value.slice(-visibleTail)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${"•".repeat(Math.max(2, local.length - shown.length))}@${domain}`;
}
