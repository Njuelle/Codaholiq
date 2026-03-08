import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WorkflowTemplateController } from '../workflow-template.controller';
import { WorkflowTemplateService } from '../../../common/workflow-template/workflow-template.service';

const MOCK_TEMPLATE = `name: Codaholiq

on:
  workflow_dispatch:
    inputs:
      prompt:
        description: 'The prompt to send to the AI coding agent'
        required: true
        type: string
      provider:
        description: 'The AI provider to use'
        required: true
        type: string
        default: 'claude-code'
      model:
        description: 'The model to use (format depends on provider)'
        required: false
        type: string
        default: ''

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write

jobs:
  execute:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
`;

describe('WorkflowTemplateController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowTemplateController],
      providers: [
        {
          provide: WorkflowTemplateService,
          useValue: { getTemplate: vi.fn().mockResolvedValue(MOCK_TEMPLATE) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /workflow-template', () => {
    it('should return the workflow template', async () => {
      const response = await request(app.getHttpServer()).get('/workflow-template').expect(200);

      expect(response.body).toHaveProperty('template');
      expect(typeof response.body.template).toBe('string');
    });

    it('should return a valid GitHub Actions workflow', async () => {
      const response = await request(app.getHttpServer()).get('/workflow-template').expect(200);

      const { template } = response.body as { template: string };

      expect(template).toContain('name: Codaholiq');
      expect(template).toContain('workflow_dispatch');
      expect(template).toContain('anthropics/claude-code-action@v1');
    });

    it('should include prompt, provider, and model inputs', async () => {
      const response = await request(app.getHttpServer()).get('/workflow-template').expect(200);

      const { template } = response.body as { template: string };

      expect(template).toContain("description: 'The prompt to send to the AI coding agent'");
      expect(template).toContain("description: 'The AI provider to use'");
      expect(template).toContain("description: 'The model to use (format depends on provider)'");
    });

    it('should include required permissions', async () => {
      const response = await request(app.getHttpServer()).get('/workflow-template').expect(200);

      const { template } = response.body as { template: string };

      expect(template).toContain('contents: write');
      expect(template).toContain('pull-requests: write');
      expect(template).toContain('issues: write');
      expect(template).toContain('id-token: write');
    });
  });
});
