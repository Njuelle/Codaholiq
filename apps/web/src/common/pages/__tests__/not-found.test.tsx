import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { NotFoundPage } from '../not-found';

describe('NotFoundPage', () => {
  it('should render 404 content', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>,
      { initialRoute: '/nonexistent' },
    );

    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText('Go back')).toBeInTheDocument();
  });
});
