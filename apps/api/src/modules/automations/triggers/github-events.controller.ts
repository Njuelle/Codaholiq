import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import {
  GITHUB_EVENTS_CATALOG,
  GITHUB_EVENT_CATEGORIES,
  type GitHubEventDefinition,
  type GitHubEventCategory,
} from './github-events';

@Controller()
export class GitHubEventsController {
  @Public()
  @Get('github-events')
  getGitHubEvents(): {
    categories: ReadonlyArray<{
      readonly id: GitHubEventCategory;
      readonly label: string;
    }>;
    events: readonly GitHubEventDefinition[];
  } {
    return {
      categories: GITHUB_EVENT_CATEGORIES,
      events: GITHUB_EVENTS_CATALOG,
    };
  }
}
