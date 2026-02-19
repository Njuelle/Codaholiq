import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WorkflowTemplateController } from '../workflow-template.controller';

describe('WorkflowTemplateController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowTemplateController],
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

    it('should include prompt and model inputs', async () => {
      const response = await request(app.getHttpServer()).get('/workflow-template').expect(200);

      const { template } = response.body as { template: string };

      expect(template).toContain("description: 'The prompt to send to Claude Code'");
      expect(template).toContain("description: 'The Claude model to use'");
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
