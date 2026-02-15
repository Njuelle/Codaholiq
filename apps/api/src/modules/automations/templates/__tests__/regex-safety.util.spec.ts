import { isSafePattern, MAX_REGEX_LENGTH } from '../regex-safety.util';

describe('isSafePattern', () => {
  it('should accept simple literal patterns', () => {
    expect(isSafePattern('main')).toBe(true);
    expect(isSafePattern('refs/heads/main')).toBe(true);
  });

  it('should accept anchored alternation without nested quantifiers', () => {
    expect(isSafePattern('^refs/heads/(main|develop)$')).toBe(true);
  });

  it('should accept character classes with quantifiers', () => {
    expect(isSafePattern('[a-z]+')).toBe(true);
    expect(isSafePattern('\\d{1,3}')).toBe(true);
  });

  it('should accept non-nested group quantifiers', () => {
    expect(isSafePattern('(abc)+')).toBe(true);
    expect(isSafePattern('(a|b)+')).toBe(true);
  });

  it('should reject nested quantifiers: (a+)+', () => {
    expect(isSafePattern('(a+)+')).toBe(false);
  });

  it('should reject nested quantifiers: (a*)*', () => {
    expect(isSafePattern('(a*)*')).toBe(false);
  });

  it('should reject nested quantifiers: (a+)*', () => {
    expect(isSafePattern('(a+)*')).toBe(false);
  });

  it('should reject nested quantifiers: (a+){2,}', () => {
    expect(isSafePattern('(a+){2,}')).toBe(false);
  });

  it('should reject nested quantifiers: (.*)+', () => {
    expect(isSafePattern('(.*)+')).toBe(false);
  });

  it('should reject nested quantifiers in complex patterns', () => {
    expect(isSafePattern('prefix-(ab+)+')).toBe(false);
  });
});

describe('MAX_REGEX_LENGTH', () => {
  it('should be 200', () => {
    expect(MAX_REGEX_LENGTH).toBe(200);
  });
});
