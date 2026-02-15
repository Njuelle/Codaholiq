import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { PromptTemplateCard } from '../prompt-template-card';

describe('PromptTemplateCard', () => {
  const sampleTemplate = 'Review the changes in {{file}} and suggest improvements.';

  it('should render the "Prompt Template" card title', () => {
    renderWithProviders(<PromptTemplateCard promptTemplate={sampleTemplate} />);

    expect(screen.getByText('Prompt Template')).toBeInTheDocument();
  });

  it('should render the prompt template text in a pre block', () => {
    renderWithProviders(<PromptTemplateCard promptTemplate={sampleTemplate} />);

    const preElement = screen.getByText(sampleTemplate);
    expect(preElement).toBeInTheDocument();
    expect(preElement.tagName).toBe('PRE');
  });

  it('should render a Copy button', () => {
    renderWithProviders(<PromptTemplateCard promptTemplate={sampleTemplate} />);

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('should invoke navigator.clipboard.writeText when Copy is clicked', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    renderWithProviders(<PromptTemplateCard promptTemplate={sampleTemplate} />);

    await user.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(sampleTemplate);
    });

    writeTextSpy.mockRestore();
  });

  it('should show "Copied!" text after clicking copy', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PromptTemplateCard promptTemplate={sampleTemplate} />);

    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('should render a simple single-line template', () => {
    const simple = 'Fix the bug in {{file}}';

    renderWithProviders(<PromptTemplateCard promptTemplate={simple} />);

    expect(screen.getByText(simple)).toBeInTheDocument();
  });

  it('should render a multiline template in a pre element', () => {
    const multiline = 'Line 1\nLine 2\nLine 3';

    const { container } = renderWithProviders(<PromptTemplateCard promptTemplate={multiline} />);

    const preElement = container.querySelector('pre');
    expect(preElement).toBeInTheDocument();
    expect(preElement).toHaveTextContent('Line 1');
    expect(preElement).toHaveTextContent('Line 2');
    expect(preElement).toHaveTextContent('Line 3');
    expect(preElement).toHaveClass('whitespace-pre-wrap');
  });

  it('should render template with variable placeholders', () => {
    const withVars = 'Analyze {{repo}} branch {{branch}} for issues';

    renderWithProviders(<PromptTemplateCard promptTemplate={withVars} />);

    expect(screen.getByText(withVars)).toBeInTheDocument();
  });

  it('should display the Copy text initially, not Copied', () => {
    renderWithProviders(<PromptTemplateCard promptTemplate={sampleTemplate} />);

    const button = screen.getByRole('button', { name: /copy/i });
    expect(within(button).getByText('Copy')).toBeInTheDocument();
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
  });
});
