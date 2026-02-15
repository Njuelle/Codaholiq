import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SUPPORTED_MODELS, DEFAULT_MODEL, type ClaudeModel } from './models.constants';

@Controller()
export class ModelsController {
  @Public()
  @Get('models')
  getSupportedModels(): { models: readonly ClaudeModel[]; defaultModelId: string } {
    return { models: SUPPORTED_MODELS, defaultModelId: DEFAULT_MODEL.id };
  }
}
