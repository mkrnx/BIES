/**
 * NIP-55 `nostrsigner:` URI builders.
 *
 * Vendored from nostr-tools/nip55 (MIT): the module ships in the package
 * (lib/esm/nip55.js, v2.23.x) but is missing from its `exports` map, so it
 * can't be imported — even in the latest release. Byte-for-byte identical
 * logic; drop this file and switch back to `nostr-tools/nip55` once
 * upstream exports it.
 */

function encodeParams(params) {
    return new URLSearchParams(params).toString();
}

function filterUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function buildUri({
    base,
    type,
    callbackUrl,
    returnType = 'signature',
    compressionType = 'none',
    ...params
}) {
    const baseParams = {
        type,
        compressionType,
        returnType,
        callbackUrl,
        id: params.id,
        current_user: params.currentUser,
        permissions: params.permissions && params.permissions.length > 0
            ? encodeURIComponent(JSON.stringify(params.permissions))
            : undefined,
        pubKey: params.pubKey,
        plainText: params.plainText,
        encryptedText: params.encryptedText,
        appName: params.appName,
    };
    const filteredParams = filterUndefined(baseParams);
    return `${base}?${encodeParams(filteredParams)}`;
}

function buildDefaultUri(type, params) {
    return buildUri({ base: 'nostrsigner:', type, ...params });
}

export function getPublicKeyUri({ permissions = [], ...params }) {
    return buildDefaultUri('get_public_key', { permissions, ...params });
}

export function signEventUri({ eventJson, ...params }) {
    return buildUri({
        base: `nostrsigner:${encodeURIComponent(JSON.stringify(eventJson))}`,
        type: 'sign_event',
        ...params,
    });
}

function encryptUri(type, params) {
    return buildDefaultUri(type, { ...params, plainText: params.content });
}

function decryptUri(type, params) {
    return buildDefaultUri(type, { ...params, encryptedText: params.content });
}

export function encryptNip04Uri(params) {
    return encryptUri('nip04_encrypt', params);
}

export function decryptNip04Uri(params) {
    return decryptUri('nip04_decrypt', params);
}

export function encryptNip44Uri(params) {
    return encryptUri('nip44_encrypt', params);
}

export function decryptNip44Uri(params) {
    return decryptUri('nip44_decrypt', params);
}

export function decryptZapEventUri({ eventJson, ...params }) {
    return buildUri({
        base: `nostrsigner:${encodeURIComponent(JSON.stringify(eventJson))}`,
        type: 'decrypt_zap_event',
        ...params,
    });
}
