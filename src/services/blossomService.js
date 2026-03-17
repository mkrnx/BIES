import { nostrSigner } from './nostrSigner.js';

const BLOSSOM_SERVERS = [
    'https://blossom.primal.net',
    'https://nostr.build',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_ATTACHMENTS = 4;

const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime',
];

/**
 * Compute SHA-256 hash of a File using Web Crypto API.
 * @returns {Promise<string>} lowercase hex digest
 */
async function computeSha256(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build an unsigned kind:24242 Blossom authorization event.
 */
function createAuthEvent(fileName, sha256hex) {
    return {
        kind: 24242,
        created_at: Math.floor(Date.now() / 1000),
        content: `Upload ${fileName}`,
        tags: [
            ['t', 'upload'],
            ['x', sha256hex],
            ['expiration', String(Math.floor(Date.now() / 1000) + 300)],
        ],
    };
}

/**
 * Upload a file to a single Blossom server.
 * @returns {Promise<{url: string, sha256: string, size: number, type: string}>}
 */
async function uploadToServer(serverUrl, file, signedAuthEvent) {
    const authBase64 = btoa(JSON.stringify(signedAuthEvent));

    const res = await fetch(`${serverUrl}/upload`, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type,
            'Authorization': `Nostr ${authBase64}`,
        },
        body: file,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${serverUrl}: ${res.status} ${text || res.statusText}`);
    }

    return res.json();
}

/**
 * Upload a file to Blossom, trying servers in order.
 * @param {File} file
 * @returns {Promise<{url: string, sha256: string, size: number, type: string}>}
 */
async function uploadFile(file) {
    const sha256 = await computeSha256(file);
    const authEvent = createAuthEvent(file.name, sha256);
    const signedAuth = await nostrSigner.signEvent(authEvent);

    const errors = [];
    for (const server of BLOSSOM_SERVERS) {
        try {
            return await uploadToServer(server, file, signedAuth);
        } catch (err) {
            errors.push(err);
        }
    }

    throw new Error(`All Blossom servers failed: ${errors.map(e => e.message).join('; ')}`);
}

/**
 * Build a NIP-92 imeta tag for a successfully uploaded file.
 * @param {{url: string, sha256: string, size: number, type: string}} result
 * @param {File} file
 * @param {{width: number, height: number}|null} dimensions
 * @returns {string[]}
 */
function buildImetaTag(result, file, dimensions) {
    const tag = [
        'imeta',
        `url ${result.url}`,
        `m ${file.type}`,
        `x ${result.sha256}`,
        `size ${result.size}`,
    ];
    if (dimensions) {
        tag.push(`dim ${dimensions.width}x${dimensions.height}`);
    }
    return tag;
}

/**
 * Validate a file for upload.
 * @returns {string|null} error message, or null if valid
 */
function validateFile(file, currentCount) {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return `Unsupported file type: ${file.type}. Only images and videos are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE) {
        return `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 25MB.`;
    }
    if (currentCount >= MAX_ATTACHMENTS) {
        return `Maximum ${MAX_ATTACHMENTS} attachments allowed.`;
    }
    return null;
}

/**
 * Load image dimensions from a File.
 * @returns {Promise<{width: number, height: number}|null>}
 */
function getImageDimensions(file) {
    if (!file.type.startsWith('image/')) return Promise.resolve(null);

    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve(null);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

export const blossomService = {
    uploadFile,
    buildImetaTag,
    validateFile,
    getImageDimensions,
    BLOSSOM_SERVERS,
    MAX_FILE_SIZE,
    MAX_ATTACHMENTS,
};
