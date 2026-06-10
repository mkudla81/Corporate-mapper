import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Artifact storage with two drivers:
//   - S3 (or any S3-compatible service: R2, MinIO, Spaces) when S3_BUCKET is
//     set — required for serverless deploys where disks are ephemeral.
//   - Local disk under STORAGE_DIR otherwise — fine for single-server
//     (Docker/VM) deploys with a persistent volume.
// The two functions below are the whole storage contract.

const STORAGE_DIR = process.env.STORAGE_DIR || "./storage";

function s3Config() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;
  return {
    bucket,
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined, // for R2/MinIO/Spaces
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

async function s3Client() {
  const cfg = s3Config();
  if (!cfg) throw new Error("S3 not configured");
  const { S3Client } = await import("@aws-sdk/client-s3");
  return {
    client: new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      // Credentials come from the standard AWS env vars / IAM role chain.
    }),
    bucket: cfg.bucket,
  };
}

export async function saveFile(
  originalName: string,
  data: Buffer
): Promise<{ storedName: string }> {
  const ext = path.extname(originalName).slice(0, 16);
  const storedName = `${crypto.randomBytes(16).toString("hex")}${ext}`;

  if (s3Config()) {
    const { client, bucket } = await s3Client();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: `artifacts/${storedName}`, Body: data })
    );
    return { storedName };
  }

  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(path.join(STORAGE_DIR, storedName), data);
  return { storedName };
}

export async function loadFile(storedName: string): Promise<Buffer> {
  // Refuse path traversal — storedName must be a bare filename we generated.
  if (storedName !== path.basename(storedName)) {
    throw new Error("Invalid file name");
  }

  if (s3Config()) {
    const { client, bucket } = await s3Client();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: `artifacts/${storedName}` })
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(path.join(STORAGE_DIR, storedName));
}
