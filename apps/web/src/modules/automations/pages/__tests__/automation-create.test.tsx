import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockUser } from '@/test/factories';
import { AutomationCreatePage } from '../automation-create';

// Polyfill missing DOM APIs for jsdom (required by Radix Select)
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/automations/new" element={<AutomationCreatePage />} />
    </Routes>,
    { initialRoute: '/orgs/1/automations/new', user: testUser, org: testOrg },
  );
}

describe('AutomationCreatePage', () => {
  it('should render the "New Automation" heading', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'New Automation' })).toBeInTheDocument();
  });

  it('should render the description text', () => {
    renderPage();

    expect(screen.getByText('Configure a new automation for your repository.')).toBeInTheDocument();
  });

  it('should render tabs for form steps', () => {
    renderPage();

    expect(screen.getByRole('tab', { name: 'Basics' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Trigger' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Prompt' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Review' })).toBeInTheDocument();
  });

  it('should render the Basics step as the default active tab', () => {
    renderPage();

    const basicsTab = screen.getByRole('tab', { name: 'Basics' });
    expect(basicsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should render the Name field in the Basics step', async () => {
    renderPage();

    // The Basics step should be visible by default and contain form fields
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
  });

  it('should render the Description field in the Basics step', async () => {
    renderPage();

    expect(await screen.findByLabelText('Description')).toBeInTheDocument();
  });

  it('should render the Repository select in the Basics step', async () => {
    renderPage();

    expect(await screen.findByLabelText('Repository')).toBeInTheDocument();
  });

  it('should allow typing in the Name field', async () => {
    const user = userEvent.setup();

    renderPage();

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'My Automation');

    expect(nameInput).toHaveValue('My Automation');
  });

  it('should allow navigating back to a previous step without completing the current step', async () => {
    const user = userEvent.setup();

    renderPage();

    // Fill basics step required fields
    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'My Automation');

    // Select a repository via Radix Select
    const repoCombobox = screen.getByRole('combobox');
    await user.click(repoCombobox);
    await user.click(screen.getByRole('option', { name: 'test-org/repo-1' }));

    // Navigate forward to trigger step
    await user.click(screen.getByRole('tab', { name: 'Trigger' }));
    expect(screen.getByRole('tab', { name: 'Trigger' })).toHaveAttribute('aria-selected', 'true');

    // Without filling trigger fields, navigate back to basics
    await user.click(screen.getByRole('tab', { name: 'Basics' }));
    expect(screen.getByRole('tab', { name: 'Basics' })).toHaveAttribute('aria-selected', 'true');
  });
});
