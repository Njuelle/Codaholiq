import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';

interface WorkflowTemplateResponse {
  readonly template: string;
}

interface UseWorkflowTemplateReturn {
  readonly template: string | undefined;
  readonly isLoading: boolean;
}

export function useWorkflowTemplate(): UseWorkflowTemplateReturn {
  const { data, isLoading } = useQuery({
    queryKey: ['workflow-template'],
    queryFn: () => apiGet<WorkflowTemplateResponse>('/workflow-template'),
    staleTime: Infinity,
  });

  return {
    template: data?.template,
    isLoading,
  };
}
