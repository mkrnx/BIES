import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ─── S3 Client (only initialized if credentials are provided) ───

let s3Client: S3Client | null = null;

if (config.s3.endpoint && config.s3.accessKey) {
    s3Client = new S3Client({
        endpoint: config.s3.endpoint,
        region: config.s3.region,
        credentials: {
            accessKeyId: config.s3.accessKey,
            secretAccessKey: config.s3.secretKey,
        },
        forcePathStyle: true, // Required for R2 / MinIO
    });
    console.log('[Storage] S3 client initialized');
} else {
    console.log('[Storage] No S3 credentials — using local file storage');
}

// ─── Local fallback directory ───
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const PUBLIC_DIR = path.join(UPLOAD_DIR, 'public');
const PRIVATE_DIR = path.join(UPLOAD_DIR, 'private');

// Ensure upload directories exist
[PUBLIC_DIR, PRIVATE_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Generate a unique filename preserving the extension.
 */
function generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const hash = crypto.randomBytes(16).toString('hex');
    return `${Date.now()}-${hash}${ext}`;
}

/**
 * Upload a public file (images, avatars).
 * Returns the public URL.
 */
export async function uploadPublicFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
): Promise<string> {
    const filename = generateFilename(originalName);
    const key = `media/${filename}`;

    if (s3Client) {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: config.s3.bucket,
                Key: key,
                Body: fileBuffer,
                ContentType: mimeType,
                ACL: 'public-read',
            })
        );

        return config.s3.publicUrl
            ? `${config.s3.publicUrl}/${key}`
            : `${config.s3.endpoint}/${config.s3.bucket}/${key}`;
    }

    // Local fallback
    const filePath = path.join(PUBLIC_DIR, filename);
    fs.writeFileSync(filePath, fileBuffer);
    return `/uploads/public/${filename}`;
}

/**
 * Upload a private file (pitch decks).
 * Returns the S3 key (NOT a URL — use getPresignedUrl to access).
 */
export async function uploadPrivateFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
): Promise<string> {
    const filename = generateFilename(originalName);
    const key = `decks/${filename}`;

    if (s3Client) {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: config.s3.bucket,
                Key: key,
                Body: fileBuffer,
                ContentType: mimeType,
                // No ACL = private by default
            })
        );

        return key;
    }

    // Local fallback
    const filePath = path.join(PRIVATE_DIR, filename);
    fs.writeFileSync(filePath, fileBuffer);
    return `private/${filename}`;
}

/**
 * Generate a presigned URL for a private file (valid for 15 minutes).
 */
export async function getPresignedUrl(key: string): Promise<string> {
    if (s3Client) {
        const command = new GetObjectCommand({
            Bucket: config.s3.bucket,
            Key: key,
        });

        return getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes
    }

    // Local fallback — just return the path (in dev mode, served as static)
    return `/uploads/${key}`;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
    if (s3Client) {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: config.s3.bucket,
                Key: key,
            })
        );
        return;
    }

    // Local fallback
    const fullPath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
    }
}
