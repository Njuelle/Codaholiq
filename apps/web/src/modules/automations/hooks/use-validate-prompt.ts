import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { apiPost } from '@/common/lib/api-client';
import type { ValidatePromptResponse } from '@/common/types';

interface UseValidatePromptParams {
  readonly orgId: number;
  readonly automationId: number;
}

interface ValidateParams {
  readonly promptTemplate: string;
  readonly sampleVariables?: Record<string, string>;
}

export function useValidatePrompt({
  orgId,
  automationId,
}: UseValidatePromptParams): UseMutationResult<ValidatePromptResponse, Error, ValidateParams> {
  return useMutation({
    mutationFn: (params: ValidateParams) =>
      apiPost<ValidatePromptResponse>(
        `/orgs/${orgId}/automations/${automationId}/validate-prompt`,
        params,
      ),
  });
}
