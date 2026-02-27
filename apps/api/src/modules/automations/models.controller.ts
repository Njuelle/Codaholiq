import { Controller, Get } from '@nestjs/common';
import { SUPPORTED_MODELS, DEFAULT_MODEL, type ClaudeModel } from './models.constants';

@Controller()
export class ModelsController {
  /** @deprecated Use `GET /providers` instead. Kept for backward compatibility. */
  @Get('models')
  getSupportedModels(): { models: readonly ClaudeModel[]; defaultModelId: string } {
    return { models: SUPPORTED_MODELS, defaultModelId: DEFAULT_MODEL.id };
  }
}
