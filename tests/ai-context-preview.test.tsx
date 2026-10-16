import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AiContextPreview } from '@/components/interviewer/AiContextPreview';
import { addComponent } from '@/features/interview-session/commands';
import { loadPack, makeCtx, newDoc } from './helpers';

describe('AiContextPreview', () => {
  it('stays collapsed until opened, then shows the instructions and the design as sent', async () => {
    const user = userEvent.setup();
    const ctx = makeCtx();
    const pack = await loadPack();
    const doc = addComponent(
      newDoc(ctx),
      { type: 'service', label: 'Redirect Service', position: { x: 0, y: 0 } },
      ctx,
    ).doc;

    render(<AiContextPreview doc={doc} pack={pack} isCustomEndpoint />);
    expect(screen.queryByLabelText('Your design as sent (snapshot)')).not.toBeInTheDocument();

    await user.click(screen.getByText('What the AI sees'));
    const snapshot = await screen.findByLabelText('Your design as sent (snapshot)');
    expect(snapshot.textContent).toContain('Redirect Service');
    expect(screen.getByLabelText('Instructions (system prompt)').textContent).toContain('Role');
    expect(screen.getByText(/context window is smaller/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox'), 'failure-scenario');
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Instructions (system prompt)')).getByText(/scenario/i),
      ).toBeInTheDocument(),
    );
  });
});
