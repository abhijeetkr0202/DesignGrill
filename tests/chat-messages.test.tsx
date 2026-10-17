import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatMessage,
  GreetingBubble,
  TypingIndicator,
} from '@/components/interviewer/ChatMessages';
import type { Message } from '@/types/session';

const message = (over: Partial<Message>): Message => ({
  id: 'm1',
  role: 'interviewer',
  content: 'hello',
  createdAt: '2026-01-01T10:30:00.000Z',
  ...over,
});

describe('ChatMessage', () => {
  it('shows interviewer replies as structured sections with a highlighted question', () => {
    const content = [
      'The cache looks right.',
      'What worked:\n- Clear read path\n- Cache for hot keys',
      'Question: What happens when Redis is down?\n(Why it matters: it sits on the redirect path)',
    ].join('\n\n');
    render(
      <ul>
        <ChatMessage
          message={message({ content, mode: 'architecture-interview' })}
          outdated={false}
        />
      </ul>,
    );

    expect(screen.getByText('Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Interview')).toBeInTheDocument();
    expect(screen.getByText('What worked')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    const question = screen.getByText('What happens when Redis is down?');
    expect(question).toBeInTheDocument();
    expect(screen.getByText('Question')).toBeInTheDocument();
    expect(screen.getByText(/it sits on the redirect path/)).toBeInTheDocument();
  });

  it('keeps the candidate message as plain text on the right, and marks outdated replies', () => {
    render(
      <ul>
        <ChatMessage
          message={message({ id: 'a', role: 'candidate', content: 'I would shard by key' })}
          outdated={false}
        />
        <ChatMessage message={message({ id: 'b' })} outdated />
      </ul>,
    );
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('I would shard by key')).toBeInTheDocument();
    expect(screen.getByText('based on an earlier version')).toBeInTheDocument();
  });

  it('renders system notes as a centred pill', () => {
    render(
      <ul>
        <ChatMessage
          message={message({ role: 'system', content: 'Session resumed' })}
          outdated={false}
        />
      </ul>,
    );
    expect(screen.getByText('Session resumed')).toBeInTheDocument();
    expect(screen.queryByText('Interviewer')).not.toBeInTheDocument();
  });
});

describe('typing indicator and greeting', () => {
  it('announces that the interviewer is working and can be cancelled', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<TypingIndicator onCancel={onCancel} />);
    const status = screen.getByRole('status', { name: 'Waiting for the interviewer' });
    await user.click(
      within(status.parentElement as HTMLElement).getByRole('button', { name: 'Cancel' }),
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('greets you before the first message', () => {
    render(<GreetingBubble />);
    expect(screen.getByText(/I am your interviewer/)).toBeInTheDocument();
  });
});
