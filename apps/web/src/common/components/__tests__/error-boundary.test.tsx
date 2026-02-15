import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { ErrorBoundary } from '../error-boundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }): null {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return null;
}

function GoodComponent(): React.ReactElement {
  return <div>Good content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error from React for expected errors
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Good content')).toBeInTheDocument();
  });

  it('should render fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('should reset error state on Try again click', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalThrow(): React.ReactElement {
      if (shouldThrow) {
        throw new Error('Boom');
      }
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByText('Try again'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
