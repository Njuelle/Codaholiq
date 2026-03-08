import { Injectable, Logger } from '@nestjs/common';

const CODAHOLIQ_REPO = 'Njuelle/Codaholiq';
const WORKFLOW_FILE_PATH = '.github/workflows/codaholiq.yml';
const RAW_TEMPLATE_URL = `https://raw.githubusercontent.com/${CODAHOLIQ_REPO}/main/${WORKFLOW_FILE_PATH}`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SIZE = 256 * 1024; // 256 KB

@Injectable()
export class WorkflowTemplateService {
  private readonly logger = new Logger(WorkflowTemplateService.name);
  private cachedTemplate: string | null = null;
  private cachedAt = 0;
  private fetchPromise: Promise<string> | null = null;

  async getTemplate(): Promise<string> {
    const now = Date.now();
    if (this.cachedTemplate && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedTemplate;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = this.fetchTemplate();
    try {
      return await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchTemplate(): Promise<string> {
    try {
      const response = await fetch(RAW_TEMPLATE_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        throw new Error(`Response too large: ${contentLength} bytes`);
      }

      const content = await response.text();
      if (content.length > MAX_RESPONSE_SIZE) {
        throw new Error(`Response body too large: ${String(content.length)} bytes`);
      }

      this.cachedTemplate = content;
      this.cachedAt = Date.now();
      this.logger.log('Fetched workflow template from GitHub');
      return content;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch workflow template: ${message}`);

      if (this.cachedTemplate) {
        this.logger.warn('Returning stale cached template');
        return this.cachedTemplate;
      }

      throw new Error(`Unable to fetch workflow template from ${RAW_TEMPLATE_URL}: ${message}`);
    }
  }
}
