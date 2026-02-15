import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { ServerErrorPage } from '../server-error';

describe('ServerErrorPage', () => {
  it('should render error content', () => {
    renderWithProviders(
      <Routes>
        <Route path="/error" element={<ServerErrorPage />} />
      </Routes>,
      { initialRoute: '/error' },
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred. Please try again later.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Go home')).toBeInTheDocument();
  });

  it('should navigate home on button click', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/error" element={<ServerErrorPage />} />
      </Routes>,
      { initialRoute: '/error' },
    );

    await user.click(screen.getByText('Go home'));
    expect(await screen.findByText('Home Page')).toBeInTheDocument();
  });
});
