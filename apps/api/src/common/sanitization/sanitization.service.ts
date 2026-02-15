import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

const DEFAULT_MAX_LENGTH = 1000;
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const TEMPLATE_INJECTION_PATTERN = /\{\{|\$\{\{|\$\{/;

@Injectable()
export class SanitizationService {
  stripHtml({ input }: { input: string }): string {
    const stripped = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
    return stripped.replace(CONTROL_CHARS, '');
  }

  hasTemplateInjection({ value }: { value: string }): boolean {
    return TEMPLATE_INJECTION_PATTERN.test(value);
  }

  sanitizeForStorage({
    input,
    maxLength = DEFAULT_MAX_LENGTH,
  }: {
    input: string;
    maxLength?: number;
  }): string {
    const stripped = this.stripHtml({ input });
    const trimmed = stripped.trim();
    if (trimmed.length > maxLength) {
      return trimmed.slice(0, maxLength);
    }
    return trimmed;
  }
}
