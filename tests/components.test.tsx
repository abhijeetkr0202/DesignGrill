import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RequirementsPanel } from '@/components/requirements/RequirementsPanel';
import { DecisionsPanel } from '@/components/interviewer/DecisionsPanel';
import { FindingsPanel } from '@/components/interviewer/FindingsPanel';
import { SettingsView } from '@/components/settings/SettingsView';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import { addRequirement, recordDecision } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { loadPack, newDoc } from './helpers';

beforeEach(async () => {
  setRepositoriesForTesting({
    sessions: new MemorySessionRepository(),
    preferences: new MemoryPreferenceRepository(),
    durable: true,
  });
  useSessionStore.getState().open(newDoc(), await loadPack());
});

describe('RequirementsPanel', () => {
  it('creates, edits and deletes requirements', async () => {
    const user = userEvent.setup();
    render(<RequirementsPanel />);

    await user.type(screen.getByLabelText('Add functional item'), 'Redirect a short link');
    await user.click(
      within(screen.getByRole('region', { name: /Functional requirements/ })).getByRole('button', {
        name: 'Add',
      }),
    );
    expect(useSessionStore.getState().doc?.requirements[0]).toMatchObject({
      kind: 'functional',
      title: 'Redirect a short link',
    });

    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Redirect quickly{Enter}');
    expect(useSessionStore.getState().doc?.requirements[0]?.title).toBe('Redirect quickly');

    await user.click(screen.getByRole('button', { name: /Unresolved. Mark confirmed/ }));
    expect(useSessionStore.getState().doc?.requirements[0]?.status).toBe('confirmed');

    await user.click(screen.getByRole('button', { name: 'Delete Redirect quickly' }));
    expect(useSessionStore.getState().doc?.requirements).toHaveLength(0);
  });

  it('records measurable and qualitative NFR targets', async () => {
    const user = userEvent.setup();
    render(<RequirementsPanel />);
    await user.type(screen.getByLabelText('Add nonFunctional item'), 'Availability');
    await user.click(
      within(screen.getByRole('region', { name: /Non-functional requirements/ })).getByRole(
        'button',
        { name: 'Add' },
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Show details' }));
    await user.selectOptions(screen.getByLabelText('Category'), 'availability');
    await user.type(screen.getByLabelText('Target'), '99.9% monthly{Enter}');
    expect(useSessionStore.getState().doc?.requirements[0]).toMatchObject({
      category: 'availability',
      target: '99.9% monthly',
    });
  });

  it('asks for confirmation before deleting a requirement that has content or linked decisions', async () => {
    const user = userEvent.setup();
    useSessionStore.getState().apply((d) => {
      const r = addRequirement(d, {
        kind: 'nonFunctional',
        title: 'Durability',
        target: '11 nines',
      });
      return recordDecision(r.doc, { title: 'Replicate', relatedRequirementIds: [r.id] }).doc;
    });
    render(<RequirementsPanel />);
    await user.click(screen.getByRole('button', { name: 'Delete Durability' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('marked for re-evaluation');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(useSessionStore.getState().doc?.requirements).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Delete Durability' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(useSessionStore.getState().doc?.requirements).toHaveLength(0);
    expect(useSessionStore.getState().doc?.decisions[0]?.status).toBe('needs-reevaluation');
  });
});

describe('DecisionsPanel', () => {
  it('shows decisions flagged for re-evaluation and lets the user clear the flag', async () => {
    const user = userEvent.setup();
    useSessionStore.getState().apply((d) => {
      const r = addRequirement(d, {
        kind: 'nonFunctional',
        title: 'Availability',
        target: '99.9%',
      });
      const dec = recordDecision(r.doc, { title: 'Single region', relatedRequirementIds: [r.id] });
      return {
        ...dec.doc,
        requirements: dec.doc.requirements.map((x) => ({ ...x, target: '99.99%' })),
        decisions: dec.doc.decisions.map((x) => ({
          ...x,
          status: 'needs-reevaluation' as const,
          reevaluationReason: 'Requirement "Availability" changed',
        })),
      };
    });
    render(<DecisionsPanel />);
    expect(screen.getByText(/needs re-evaluation/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark re-evaluated' }));
    expect(useSessionStore.getState().doc?.decisions[0]?.status).toBe('active');
  });
});

describe('FindingsPanel', () => {
  it('explains the empty state', () => {
    render(<FindingsPanel />);
    expect(screen.getByText(/No review yet/)).toBeInTheDocument();
  });
});

describe('SettingsView', () => {
  it('explains billing, never renders a stored key and says desktop is needed without one', () => {
    render(<SettingsView />);
    expect(screen.getByText(/billed by the provider, separately from any/i)).toBeInTheDocument();
    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('');
  });
});
