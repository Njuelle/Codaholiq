import { render, screen } from '@testing-library/react';
import { PromptDisplayCard } from '../prompt-display-card';

describe('PromptDisplayCard', () => {
  it('should render the resolved prompt', () => {
    render(<PromptDisplayCard prompt="Fix the issue in src/main.ts" />);

    expect(screen.getByText('Resolved Prompt')).toBeInTheDocument();
    expect(screen.getByText('Fix the issue in src/main.ts')).toBeInTheDocument();
  });

  it('should render copy button', () => {
    render(<PromptDisplayCard prompt="Some prompt" />);

    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument();
  });
});
