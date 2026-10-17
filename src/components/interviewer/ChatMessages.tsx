import type { InterviewMode, Message } from '@/types/session';
import { Badge, Button } from '@/components/shared/ui';

const MODE_LABELS: Record<InterviewMode, string> = {
  'requirements-discovery': 'Requirements',
  'architecture-interview': 'Interview',
  'architecture-review': 'Review',
  'failure-scenario': 'Scenario',
  'session-summary': 'Summary',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function BotAvatar() {
  return (
    <img
      src="/icon.svg"
      alt=""
      aria-hidden
      className="h-7 w-7 shrink-0 rounded-lg border border-line bg-surface-2"
    />
  );
}

function YouAvatar() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
      </svg>
    </span>
  );
}

const BOT_BUBBLE = 'rounded-2xl rounded-bl-sm border border-line bg-surface px-3 py-2';

export function GreetingBubble() {
  return (
    <div className="chat-pop flex items-end gap-2">
      <BotAvatar />
      <div className={`${BOT_BUBBLE} max-w-[88%] text-xs leading-relaxed`}>
        <p className="font-medium">Hi, I am your interviewer.</p>
        <p className="mt-1 text-muted">
          Write requirements and sketch components, then ask me for a question or a review. I read
          your actual requirements and architecture, not just the problem title.
        </p>
      </div>
    </div>
  );
}

export function TypingIndicator({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      role="status"
      aria-label="Waiting for the interviewer"
      className="chat-pop mt-3 flex items-end gap-2"
    >
      <BotAvatar />
      <div className={`${BOT_BUBBLE} flex items-center gap-2`}>
        <span aria-hidden className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-muted motion-safe:animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span className="text-[11px] text-muted">Thinking. You can keep editing.</span>
      </div>
      <Button size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export function ChatMessage({ message: m, outdated }: { message: Message; outdated: boolean }) {
  if (m.role === 'system') {
    return (
      <li className="chat-pop flex justify-center">
        <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted">
          {m.content}
        </span>
      </li>
    );
  }

  const mine = m.role === 'candidate';
  const time = formatTime(m.createdAt);
  return (
    <li className={`chat-pop flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      {mine ? <YouAvatar /> : <BotAvatar />}
      <div className={`flex min-w-0 max-w-[88%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="font-semibold">{mine ? 'You' : 'Interviewer'}</span>
          {m.mode && !mine && <Badge>{MODE_LABELS[m.mode]}</Badge>}
          {time && <time dateTime={m.createdAt}>{time}</time>}
        </div>
        <div
          className={`px-3 py-2 text-xs leading-relaxed ${
            mine ? 'rounded-2xl rounded-br-sm bg-accent text-accent-fg' : `${BOT_BUBBLE} min-w-0`
          }`}
        >
          {mine ? (
            <p className="break-words whitespace-pre-wrap">{m.content}</p>
          ) : (
            <MessageBody text={m.content} />
          )}
        </div>
        {outdated && (
          <div className="mt-1">
            <Badge tone="warn" title="You changed the design after this was written">
              based on an earlier version
            </Badge>
          </div>
        )}
      </div>
    </li>
  );
}

// Interviewer replies are built from sections ("Heading:" plus "- " lines) and a "Question:" block;
// showing those as structure makes long replies scannable. Anything else is plain text.
function MessageBody({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

const WHY_MARKER = '\n(Why it matters: ';

function Block({ block }: { block: string }) {
  if (block.startsWith('Question: ')) {
    const body = block.slice('Question: '.length);
    const at = body.indexOf(WHY_MARKER);
    const question = at >= 0 ? body.slice(0, at) : body;
    const why = at >= 0 ? body.slice(at + WHY_MARKER.length).replace(/\)\s*$/, '') : '';
    return (
      <div className="rounded-lg border-l-4 border-accent bg-surface-2 px-2.5 py-1.5">
        <div className="mb-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
          Question
        </div>
        <p className="font-medium whitespace-pre-wrap">{question}</p>
        {why && <p className="mt-1 text-[11px] text-muted">Why it matters: {why}</p>}
      </div>
    );
  }

  const lines = block.split('\n');
  const isBullet = (line: string) => line.startsWith('- ');
  if (lines.every(isBullet)) return <BulletList lines={lines} />;
  if (lines.length > 1 && lines[0]!.endsWith(':') && lines.slice(1).every(isBullet)) {
    return (
      <div>
        <div className="mb-0.5 font-semibold">{lines[0]!.slice(0, -1)}</div>
        <BulletList lines={lines.slice(1)} />
      </div>
    );
  }
  if (block.startsWith('Scenario: ')) {
    return <p className="font-semibold whitespace-pre-wrap">{block}</p>;
  }
  return <p className="whitespace-pre-wrap">{block}</p>;
}

function BulletList({ lines }: { lines: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-4 marker:text-accent">
      {lines.map((line, i) => (
        <li key={i}>{line.slice(2)}</li>
      ))}
    </ul>
  );
}
