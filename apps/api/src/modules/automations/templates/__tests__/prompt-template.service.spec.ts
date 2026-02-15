import { PromptTemplateService } from '../prompt-template.service';

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;

  beforeEach(() => {
    service = new PromptTemplateService();
  });

  describe('resolve', () => {
    it('should substitute a simple variable', () => {
      const result = service.resolve({
        template: 'Hello {{name}}!',
        variables: [{ key: 'name', value: 'World', source: 'static', required: false }],
      });
      expect(result).toBe('Hello World!');
    });

    it('should substitute multiple variables', () => {
      const result = service.resolve({
        template: '{{greeting}} {{name}}, welcome to {{place}}!',
        variables: [
          { key: 'greeting', value: 'Hi', source: 'static', required: false },
          { key: 'name', value: 'Alice', source: 'static', required: false },
          {
            key: 'place',
            value: 'Codaholiq',
            source: 'static',
            required: false,
          },
        ],
      });
      expect(result).toBe('Hi Alice, welcome to Codaholiq!');
    });

    it('should return template unchanged when no variables present', () => {
      const result = service.resolve({
        template: 'No variables here',
        variables: [],
      });
      expect(result).toBe('No variables here');
    });

    it('should return empty string for empty template', () => {
      const result = service.resolve({
        template: '',
        variables: [],
      });
      expect(result).toBe('');
    });

    it('should resolve from explicit variables first', () => {
      const result = service.resolve({
        template: '{{name}}',
        variables: [{ key: 'name', value: 'explicit', source: 'static', required: false }],
        builtIns: { name: 'builtin' },
      });
      expect(result).toBe('explicit');
    });

    it('should resolve from event payload when variable not found', () => {
      const result = service.resolve({
        template: '{{action}}',
        variables: [],
        eventPayload: { action: 'opened' },
      });
      expect(result).toBe('opened');
    });

    it('should resolve from built-ins when not in variables or payload', () => {
      const result = service.resolve({
        template: '{{repo.owner}}',
        variables: [],
        builtIns: { 'repo.owner': 'octocat' },
      });
      expect(result).toBe('octocat');
    });

    it('should resolve nested event payload fields with dot notation', () => {
      const result = service.resolve({
        template: '{{pull_request.title}} by {{pull_request.user.login}}',
        variables: [],
        eventPayload: {
          pull_request: {
            title: 'Fix bug',
            user: { login: 'octocat' },
          },
        },
      });
      expect(result).toBe('Fix bug by octocat');
    });

    it('should throw for missing required variable', () => {
      expect(() =>
        service.resolve({
          template: '{{missing}}',
          variables: [{ key: 'missing', value: '', source: 'static', required: true }],
        }),
      ).toThrow("Required variable 'missing' has no value");
    });

    it('should replace optional missing variable with empty string', () => {
      const result = service.resolve({
        template: 'before{{optional}}after',
        variables: [],
      });
      expect(result).toBe('beforeafter');
    });

    it('should sanitize shell command substitution $(...)', () => {
      const result = service.resolve({
        template: '{{cmd}}',
        variables: [
          {
            key: 'cmd',
            value: 'safe $(rm -rf /)',
            source: 'static',
            required: false,
          },
        ],
      });
      expect(result).toBe('');
    });

    it('should sanitize backtick command substitution', () => {
      const result = service.resolve({
        template: '{{cmd}}',
        variables: [
          {
            key: 'cmd',
            value: 'safe `whoami`',
            source: 'static',
            required: false,
          },
        ],
      });
      expect(result).toBe('');
    });

    it('should sanitize shell interpolation ${...}', () => {
      const result = service.resolve({
        template: '{{cmd}}',
        variables: [
          {
            key: 'cmd',
            value: 'safe ${HOME}',
            source: 'static',
            required: false,
          },
        ],
      });
      expect(result).toBe('');
    });

    it('should sanitize GitHub Actions expression injection', () => {
      const result = service.resolve({
        template: '{{cmd}}',
        variables: [
          {
            key: 'cmd',
            value: 'safe ${{ github.token }}',
            source: 'static',
            required: false,
          },
        ],
      });
      expect(result).toBe('');
    });

    it('should handle event payload with null values gracefully', () => {
      const result = service.resolve({
        template: '{{action}}',
        variables: [],
        eventPayload: { action: null } as unknown as Record<string, unknown>,
      });
      expect(result).toBe('');
    });

    it('should handle event payload with numeric values', () => {
      const result = service.resolve({
        template: 'PR #{{pull_request.number}}',
        variables: [],
        eventPayload: { pull_request: { number: 42 } },
      });
      expect(result).toBe('PR #42');
    });

    it('should resolve shared variables when automation variable not found', () => {
      const result = service.resolve({
        template: '{{api_url}}',
        variables: [],
        sharedVariables: [{ key: 'api_url', value: 'https://example.com' }],
      });
      expect(result).toBe('https://example.com');
    });

    it('should let automation variables override shared variables with same key', () => {
      const result = service.resolve({
        template: '{{token}}',
        variables: [{ key: 'token', value: 'automation-token', source: 'static', required: false }],
        sharedVariables: [{ key: 'token', value: 'shared-token' }],
      });
      expect(result).toBe('automation-token');
    });

    it('should resolve shared variables before event payload', () => {
      const result = service.resolve({
        template: '{{action}}',
        variables: [],
        sharedVariables: [{ key: 'action', value: 'shared-action' }],
        eventPayload: { action: 'payload-action' },
      });
      expect(result).toBe('shared-action');
    });

    it('should sanitize shared variable values', () => {
      const result = service.resolve({
        template: '{{cmd}}',
        variables: [],
        sharedVariables: [{ key: 'cmd', value: 'safe $(rm -rf /)' }],
      });
      expect(result).toBe('');
    });

    it('should handle empty sharedVariables array', () => {
      const result = service.resolve({
        template: '{{name}}',
        variables: [{ key: 'name', value: 'test', source: 'static', required: false }],
        sharedVariables: [],
      });
      expect(result).toBe('test');
    });

    it('should handle undefined sharedVariables', () => {
      const result = service.resolve({
        template: '{{name}}',
        variables: [{ key: 'name', value: 'test', source: 'static', required: false }],
      });
      expect(result).toBe('test');
    });
  });

  describe('extractVariables', () => {
    it('should extract variable names from template', () => {
      const result = service.extractVariables({
        template: '{{name}} and {{place}}',
      });
      expect(result).toEqual(expect.arrayContaining(['name', 'place']));
      expect(result).toHaveLength(2);
    });

    it('should return unique names', () => {
      const result = service.extractVariables({
        template: '{{name}} and {{name}} again',
      });
      expect(result).toEqual(['name']);
    });

    it('should return empty array for template with no variables', () => {
      const result = service.extractVariables({
        template: 'No variables',
      });
      expect(result).toEqual([]);
    });

    it('should extract dotted variable names', () => {
      const result = service.extractVariables({
        template: '{{repo.owner}}/{{repo.name}}',
      });
      expect(result).toEqual(expect.arrayContaining(['repo.owner', 'repo.name']));
    });
  });

  describe('validateTemplate', () => {
    it('should accept a valid template', () => {
      expect(() =>
        service.validateTemplate({
          template: 'Hello {{name}}, welcome to {{place}}!',
        }),
      ).not.toThrow();
    });

    it('should accept template with no variables', () => {
      expect(() => service.validateTemplate({ template: 'Plain text' })).not.toThrow();
    });

    it('should accept empty template', () => {
      expect(() => service.validateTemplate({ template: '' })).not.toThrow();
    });

    it('should reject nested templates', () => {
      expect(() =>
        service.validateTemplate({
          template: '{{outer {{inner}}}}',
        }),
      ).toThrow('Nested template variables are not allowed');
    });

    it('should reject unbalanced opening braces', () => {
      expect(() =>
        service.validateTemplate({
          template: 'Hello {{name',
        }),
      ).toThrow('Unbalanced opening braces in template');
    });

    it('should reject unbalanced closing braces', () => {
      expect(() =>
        service.validateTemplate({
          template: 'Hello name}}',
        }),
      ).toThrow('Unbalanced closing braces in template');
    });
  });
});
