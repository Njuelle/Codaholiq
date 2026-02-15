import { SanitizationService } from '../sanitization.service';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(() => {
    service = new SanitizationService();
  });

  describe('stripHtml', () => {
    it('should remove script tags', () => {
      const result = service.stripHtml({ input: '<script>alert(1)</script>Hello' });
      expect(result).toBe('Hello');
    });

    it('should remove all HTML tags', () => {
      const result = service.stripHtml({ input: '<b>Bold</b> <i>italic</i>' });
      expect(result).toBe('Bold italic');
    });

    it('should handle img tags with event handlers', () => {
      const result = service.stripHtml({
        input: '<img src=x onerror=alert(1)>text',
      });
      expect(result).toBe('text');
    });

    it('should pass through plain text unchanged', () => {
      const result = service.stripHtml({ input: 'Hello World' });
      expect(result).toBe('Hello World');
    });

    it('should handle empty string', () => {
      const result = service.stripHtml({ input: '' });
      expect(result).toBe('');
    });

    it('should remove control characters', () => {
      // null byte, Unicode RTL override (U+202E)
      const result = service.stripHtml({ input: 'Hello\x00World\u202Etest' });
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\u202E');
      expect(result).toBe('HelloWorldtest');
    });

    it('should remove nested HTML', () => {
      const result = service.stripHtml({
        input: '<div><p>nested <span>content</span></p></div>',
      });
      expect(result).toBe('nested content');
    });
  });

  describe('hasTemplateInjection', () => {
    it('should detect double curly braces', () => {
      expect(service.hasTemplateInjection({ value: '{{evil}}' })).toBe(true);
    });

    it('should detect template injection in longer text', () => {
      expect(service.hasTemplateInjection({ value: 'some text {{injection}} more' })).toBe(true);
    });

    it('should allow normal text', () => {
      expect(service.hasTemplateInjection({ value: 'normal text' })).toBe(false);
    });

    it('should allow single curly braces', () => {
      expect(service.hasTemplateInjection({ value: 'JSON { value }' })).toBe(false);
    });

    it('should detect nested template injection', () => {
      expect(service.hasTemplateInjection({ value: '{{{{deep}}}}' })).toBe(true);
    });

    it('should detect ${envvar} pattern', () => {
      expect(service.hasTemplateInjection({ value: 'path=${HOME}/bin' })).toBe(true);
    });

    it('should detect ${{secrets.TOKEN}} pattern', () => {
      expect(service.hasTemplateInjection({ value: 'token=${{secrets.TOKEN}}' })).toBe(true);
    });
  });

  describe('sanitizeForStorage', () => {
    it('should strip HTML and trim', () => {
      const result = service.sanitizeForStorage({
        input: '  <b>Hello</b>  ',
      });
      expect(result).toBe('Hello');
    });

    it('should enforce maxLength', () => {
      const result = service.sanitizeForStorage({
        input: 'a'.repeat(2000),
        maxLength: 100,
      });
      expect(result).toHaveLength(100);
    });

    it('should use default maxLength of 1000', () => {
      const result = service.sanitizeForStorage({
        input: 'a'.repeat(2000),
      });
      expect(result).toHaveLength(1000);
    });

    it('should not truncate short strings', () => {
      const result = service.sanitizeForStorage({ input: 'short' });
      expect(result).toBe('short');
    });

    it('should handle SQL injection payloads', () => {
      const result = service.sanitizeForStorage({
        input: "'; DROP TABLE automations; --",
      });
      expect(result).toBe("'; DROP TABLE automations; --");
      // SQL injection is prevented by Drizzle parameterized queries, not sanitization
      // Sanitization strips HTML only
    });

    it('should strip XSS payloads', () => {
      const result = service.sanitizeForStorage({
        input: '<script>document.cookie</script>My Automation',
      });
      expect(result).toBe('My Automation');
    });
  });
});
