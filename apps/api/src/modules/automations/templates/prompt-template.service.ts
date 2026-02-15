import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { resolvePayloadPathAsString } from '../triggers/payload-path.util';

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

const DANGEROUS_PATTERNS = [
  /\$\{\{[\s\S]*?\}\}/g, // ${{...}} GitHub Actions expression injection (must be before ${...})
  /\$\{[^}]*\}/g, // ${...} shell interpolation
  /\$\([^)]*\)/g, // $(...) command substitution
  /`[^`]*`/g, // backtick command substitution
];

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  resolve({
    template,
    variables,
    sharedVariables,
    eventPayload,
    builtIns,
  }: {
    template: string;
    variables: ReadonlyArray<{
      key: string;
      value: string;
      source: string;
      required: boolean;
    }>;
    sharedVariables?: ReadonlyArray<{ key: string; value: string }>;
    eventPayload?: Record<string, unknown>;
    builtIns?: Readonly<Record<string, string>>;
  }): string {
    const variableMap = new Map(variables.map((v) => [v.key, v.value]));
    const sharedVariableMap = new Map((sharedVariables ?? []).map((v) => [v.key, v.value]));
    const requiredKeys = new Set(variables.filter((v) => v.required).map((v) => v.key));

    return template.replace(VARIABLE_REGEX, (match, name: string) => {
      // Resolution order: automation variables > shared variables > event payload > built-ins
      const explicitValue = variableMap.get(name);
      if (explicitValue !== undefined && explicitValue !== '') {
        return this.sanitize(explicitValue);
      }

      const sharedValue = sharedVariableMap.get(name);
      if (sharedValue !== undefined && sharedValue !== '') {
        return this.sanitize(sharedValue);
      }

      if (eventPayload) {
        const payloadValue = this.resolveFromPayload(name, eventPayload);
        if (payloadValue !== undefined) {
          return this.sanitize(payloadValue);
        }
      }

      if (builtIns) {
        const builtInValue = builtIns[name];
        if (builtInValue !== undefined) {
          return this.sanitize(builtInValue);
        }
      }

      if (requiredKeys.has(name)) {
        throw new BadRequestException(`Required variable '${name}' has no value`);
      }

      return '';
    });
  }

  extractVariables({ template }: { template: string }): string[] {
    const matches = new Set<string>();
    let match;
    const regex = new RegExp(VARIABLE_REGEX.source, 'g');
    while ((match = regex.exec(template)) !== null) {
      matches.add(match[1]);
    }
    return [...matches];
  }

  validateTemplate({ template }: { template: string }): void {
    // Check for nested templates: {{ {{ }} }}
    const nestedRegex = /\{\{[^}]*\{\{/;
    if (nestedRegex.test(template)) {
      throw new BadRequestException('Nested template variables are not allowed');
    }

    // Check for unbalanced braces
    let depth = 0;
    for (let i = 0; i < template.length - 1; i++) {
      if (template[i] === '{' && template[i + 1] === '{') {
        depth++;
        i++;
      } else if (template[i] === '}' && template[i + 1] === '}') {
        depth--;
        i++;
        if (depth < 0) {
          throw new BadRequestException('Unbalanced closing braces in template');
        }
      }
    }
    if (depth !== 0) {
      throw new BadRequestException('Unbalanced opening braces in template');
    }
  }

  private resolveFromPayload(path: string, payload: Record<string, unknown>): string | undefined {
    return resolvePayloadPathAsString({ path, payload });
  }

  validateVariableValues({
    variables,
  }: {
    variables: ReadonlyArray<{ key: string; value: string }>;
  }): void {
    for (const variable of variables) {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(variable.value)) {
          pattern.lastIndex = 0;
          throw new BadRequestException(
            `Variable '${variable.key}' contains a dangerous pattern (shell interpolation, command substitution, or expression injection)`,
          );
        }
        pattern.lastIndex = 0;
      }
    }
  }

  private sanitize(value: string): string {
    // Single-pass: reject values containing any dangerous pattern rather than
    // iteratively stripping (which could be bypassed with nested patterns)
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        this.logger.warn(
          `Dangerous pattern detected in template variable value: ${pattern.source}`,
        );
        // Reset regex lastIndex since we use global flag
        pattern.lastIndex = 0;
        return '';
      }
      // Reset regex lastIndex since we use global flag
      pattern.lastIndex = 0;
    }
    return value;
  }
}
