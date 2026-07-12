import { describe, it, expect } from 'vitest';
import { isBlockedIp, safeGetJson } from '../safeFetch';

describe('isBlockedIp (SSRF guard)', () => {
    it('blocks the cloud metadata address', () => {
        expect(isBlockedIp('169.254.169.254')).toBe(true);
    });

    it.each([
        '127.0.0.1',   // loopback
        '10.1.2.3',    // 10/8 private
        '172.16.0.1',  // 172.16/12 private
        '172.31.255.255',
        '192.168.1.1', // 192.168/16 private
        '169.254.0.5', // link-local
        '100.64.0.1',  // CGNAT
        '0.0.0.0',     // unspecified
        '224.0.0.1',   // multicast
        '240.0.0.1',   // reserved
    ])('blocks private/reserved IPv4 %s', (ip) => {
        expect(isBlockedIp(ip)).toBe(true);
    });

    it.each([
        '::1',                 // loopback
        '::',                  // unspecified
        'fe80::1',             // link-local
        'fd00::1',             // unique-local
        'fc00::1',
        'ff02::1',             // multicast
        '::ffff:127.0.0.1',    // IPv4-mapped loopback (bypass attempt)
        '::ffff:10.0.0.1',     // IPv4-mapped private
    ])('blocks private/reserved IPv6 %s', (ip) => {
        expect(isBlockedIp(ip)).toBe(true);
    });

    it.each([
        '8.8.8.8',
        '1.1.1.1',
        '172.32.0.1',          // just outside 172.16/12
        '2606:4700:4700::1111',
    ])('allows public address %s', (ip) => {
        expect(isBlockedIp(ip)).toBe(false);
    });

    it('refuses non-IP strings (fail closed)', () => {
        expect(isBlockedIp('not-an-ip')).toBe(true);
        expect(isBlockedIp('')).toBe(true);
    });
});

describe('safeGetJson', () => {
    it('rejects non-https protocols without making a request', async () => {
        // http/file/etc. must be refused up front — returns null, no throw.
        expect(await safeGetJson('http://example.com/x', 500)).toBeNull();
        expect(await safeGetJson('file:///etc/passwd', 500)).toBeNull();
        expect(await safeGetJson('not a url', 500)).toBeNull();
    });

    it('does not connect to a hostname that resolves to a private IP', async () => {
        // localhost resolves to 127.0.0.1 → pinnedSafeLookup must abort the socket.
        const result = await safeGetJson('https://localhost/.well-known/lnurlp/x', 1000);
        expect(result).toBeNull();
    });

    it('does not connect to a literal private IP host', async () => {
        const result = await safeGetJson('https://169.254.169.254/latest/meta-data/', 1000);
        expect(result).toBeNull();
    });
});
