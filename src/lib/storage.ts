import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api";

/**
 * Private document storage. Files live outside `public/` and are only served
 * through an authenticated route handler that re-checks tenant ownership.
 * For production, swap this module for S3/R2 — the interface stays the same.
 */
const ROOT = path.resolve(process.env.UPLOADS_DIR ?? ".uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Map<string, { extension: string; signatures: number[][] }>([
  ["application/pdf", { extension: "pdf", signatures: [[0x25, 0x50, 0x44, 0x46]] }],
  ["image/png", { extension: "png", signatures: [[0x89, 0x50, 0x4e, 0x47]] }],
  ["image/jpeg", { extension: "jpg", signatures: [[0xff, 0xd8, 0xff]] }],
  ["image/webp", { extension: "webp", signatures: [[0x52, 0x49, 0x46, 0x46]] }],
]);

function assertSafeKey(key: string) {
  if (key.includes("..") || path.isAbsolute(key) || key.includes("\\")) {
    throw new ApiError(400, "Kunci penyimpanan tidak valid.");
  }
}

function matchesSignature(buffer: Buffer, signatures: number[][]): boolean {
  return signatures.some((signature) => signature.every((byte, index) => buffer[index] === byte));
}

export async function saveUpload(file: File, tenantId: string): Promise<{
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}> {
  if (file.size <= 0) throw new ApiError(422, "Berkas kosong tidak dapat diunggah.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Ukuran berkas maksimal 5 MB.");

  const meta = ALLOWED.get(file.type);
  if (!meta) throw new ApiError(415, "Hanya PDF, PNG, JPEG, atau WebP yang diperbolehkan.");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesSignature(buffer, meta.signatures)) {
    throw new ApiError(415, "Isi berkas tidak cocok dengan tipe yang dinyatakan.");
  }

  const safeName = path.basename(file.name).replace(/[^\w.\- ]/g, "_").slice(0, 120) || `dokumen.${meta.extension}`;
  const key = `${tenantId}/${randomUUID()}.${meta.extension}`;
  const absolute = path.join(ROOT, key);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer, { mode: 0o640 });

  return { storageKey: key, fileName: safeName, mimeType: file.type, sizeBytes: buffer.byteLength };
}

export async function readUpload(storageKey: string): Promise<Buffer> {
  assertSafeKey(storageKey);
  try {
    return await readFile(path.join(ROOT, storageKey));
  } catch {
    throw new ApiError(404, "Berkas tidak ditemukan pada penyimpanan.");
  }
}

export async function deleteUpload(storageKey: string): Promise<void> {
  assertSafeKey(storageKey);
  try {
    await unlink(path.join(ROOT, storageKey));
  } catch {
    // Already gone — nothing to do.
  }
}
