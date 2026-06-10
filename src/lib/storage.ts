import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Local-disk artifact storage. The two functions below are the whole storage
// contract — point them at S3/GCS for production.
const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

export async function saveFile(
  originalName: string,
  data: Buffer
): Promise<{ storedName: string }> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const ext = path.extname(originalName).slice(0, 16);
  const storedName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  await writeFile(path.join(STORAGE_DIR, storedName), data);
  return { storedName };
}

export async function loadFile(storedName: string): Promise<Buffer> {
  // Refuse path traversal — storedName must be a bare filename we generated.
  if (storedName !== path.basename(storedName)) {
    throw new Error("Invalid file name");
  }
  return readFile(path.join(STORAGE_DIR, storedName));
}
