import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomationWithVariables } from '@/test/factories';
import { AutomationInfoCard } from '../automation-info-card';

describe('AutomationInfoCard', () => {
  it('should render the "Details" card title', () => {
    const automation = mockAutomationWithVariables();

    renderWithProviders(<AutomationInfoCard automation={automation} />);

    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('should render the description when present', () => {
    const automation = mockAutomationWithVariables({
      description: 'Runs tests on every pull request',
    });

    renderWithProviders(<AutomationInfoCard automation={automation} />);

    expect(screen.getByText('Runs tests on every pull request')).toBeInTheDocument();
  });

  it('should render "No description" when description is null', () => {
    const automation = mockAutomationWithVariables({
      description: null,
    });

    renderWithProviders(<AutomationInfoCard automation={automation} />);

    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('should render the trigger type badge', () => {
    const automation = mockAutomationWithVariables({
      triggerType: 'event',
    });

    renderWithProviders(<AutomationInfoCard automation={automation} />);

    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  it('should render formatted created and updated dates', () => {
    const automation = mockAutomationWithVariables({
      createdAt: '2025-06-15T10:30:00.000Z',
      updatedAt: '2025-06-20T14:00:00.000Z',
    });

    renderWithProviders(<AutomationInfoCard automation={automation} />);

    // Check that the date labels exist
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  describe('event trigger', () => {
    it('should render event names as badges', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'event',
        triggerConfig: {
          events: ['push', 'pull_request.opened', 'issues.created'],
        },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('push')).toBeInTheDocument();
      expect(screen.getByText('pull_request.opened')).toBeInTheDocument();
      expect(screen.getByText('issues.created')).toBeInTheDocument();
    });

    it('should render a single event', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('push')).toBeInTheDocument();
    });

    it('should display conditions when present', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'event',
        triggerConfig: {
          events: ['push'],
          conditionGroups: [
            {
              conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
            },
          ],
        },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('ref')).toBeInTheDocument();
      expect(screen.getByText(/refs\/heads\/main/)).toBeInTheDocument();
    });

    it('should handle missing conditionGroups (backward compat)', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      // Should render without error, showing only events
      expect(screen.getByText('push')).toBeInTheDocument();
    });
  });

  describe('cron trigger', () => {
    it('should render the cron schedule expression', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 9 * * 1-5' },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('0 9 * * 1-5')).toBeInTheDocument();
    });

    it('should render a human-readable cron description', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 0 * * *' },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      // cronstrue should produce something like "At 12:00 AM"
      expect(screen.getByText('0 0 * * *')).toBeInTheDocument();
      // The human-readable text should also appear
      expect(screen.getByText('At 12:00 AM')).toBeInTheDocument();
    });

    it('should render the timezone when provided', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'cron',
        triggerConfig: {
          schedule: '0 9 * * 1-5',
          timezone: 'America/New_York',
        },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('Timezone: America/New_York')).toBeInTheDocument();
    });

    it('should not render timezone when not provided', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 9 * * 1-5' },
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.queryByText(/Timezone:/)).not.toBeInTheDocument();
    });
  });

  describe('manual trigger', () => {
    it('should render "Triggered manually" text', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'manual',
        triggerConfig: {},
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('Triggered manually')).toBeInTheDocument();
    });

    it('should render the Manual trigger badge', () => {
      const automation = mockAutomationWithVariables({
        triggerType: 'manual',
        triggerConfig: {},
      });

      renderWithProviders(<AutomationInfoCard automation={automation} />);

      expect(screen.getByText('Manual')).toBeInTheDocument();
    });
  });

  it('should render all section labels', () => {
    const automation = mockAutomationWithVariables();

    renderWithProviders(<AutomationInfoCard automation={automation} />);

    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Trigger Type')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
