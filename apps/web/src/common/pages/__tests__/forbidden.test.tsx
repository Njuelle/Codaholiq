import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { ForbiddenPage } from '../forbidden';

describe('ForbiddenPage', () => {
  it('should render 403 content', () => {
    renderWithProviders(
      <Routes>
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Routes>,
      { initialRoute: '/forbidden' },
    );

    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.getByText('Go to organizations')).toBeInTheDocument();
  });
});
