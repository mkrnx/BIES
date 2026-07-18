/**
 * Unit tests for courses controller validation — the video URL allowlist
 * (XSS / hostile-embed defense).
 */

import { describe, it, expect } from 'vitest';
import { isAllowedVideoUrl } from '../courses.controller';

describe('isAllowedVideoUrl', () => {
    it('allows YouTube and Vimeo embeds over https', () => {
        expect(isAllowedVideoUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
        expect(isAllowedVideoUrl('https://youtu.be/abc123')).toBe(true);
        expect(isAllowedVideoUrl('https://www.youtube-nocookie.com/embed/abc')).toBe(true);
        expect(isAllowedVideoUrl('https://vimeo.com/123456')).toBe(true);
        expect(isAllowedVideoUrl('https://player.vimeo.com/video/123456')).toBe(true);
    });

    it('allows direct https video files and local uploads', () => {
        expect(isAllowedVideoUrl('https://cdn.example.com/lesson.mp4')).toBe(true);
        expect(isAllowedVideoUrl('https://cdn.example.com/lesson.webm?sig=x')).toBe(true);
        expect(isAllowedVideoUrl('/uploads/public/abc123.mp4')).toBe(true);
    });

    it('rejects javascript:, data:, and other protocol vectors', () => {
        expect(isAllowedVideoUrl('javascript:alert(1)')).toBe(false);
        expect(isAllowedVideoUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
        expect(isAllowedVideoUrl('vbscript:msgbox(1)')).toBe(false);
        expect(isAllowedVideoUrl('file:///etc/passwd')).toBe(false);
    });

    it('rejects plain http and non-allowlisted hosts', () => {
        expect(isAllowedVideoUrl('http://www.youtube.com/watch?v=abc')).toBe(false);
        expect(isAllowedVideoUrl('https://evil.example.com/fake-video')).toBe(false);
        expect(isAllowedVideoUrl('https://evil.example.com/page.html')).toBe(false);
    });

    it('rejects lookalike hosts', () => {
        expect(isAllowedVideoUrl('https://youtube.com.evil.com/watch')).toBe(false);
        expect(isAllowedVideoUrl('https://notvimeo.com/123')).toBe(false);
    });
});
