import { useMemo, useState, type ReactElement } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = { patch: string; className?: string; maxHeight?: number; filePath?: string };
type ParsedDiff = { filePath: string | null; added: number; removed: number; hunkOffset: number };

const LANG_BADGES: Array<{ test: RegExp; label: string; tone: { bg: string; fg: string } }> = [
  { test: /\.tsx?$/i, label: 'TS', tone: { bg: 'rgba(14,165,233,0.12)', fg: '#0ea5e9' } },
  { test: /\.jsx?$/i, label: 'JS', tone: { bg: 'rgba(217,119,6,0.12)', fg: '#d97706' } },
  { test: /\.json$/i, label: 'JSON', tone: { bg: 'rgba(113,113,122,0.12)', fg: '#71717a' } },
  { test: /\.(css|scss|less)$/i, label: 'CSS', tone: { bg: 'rgba(219,39,119,0.12)', fg: '#db2777' } },
  { test: /\.md$/i, label: 'MD', tone: { bg: 'rgba(100,116,139,0.12)', fg: '#64748b' } },
  { test: /\.py$/i, label: 'PY', tone: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' } },
  { test: /\.ya?ml$/i, label: 'YML', tone: { bg: 'rgba(139,92,246,0.12)', fg: '#8b5cf6' } },
];

function parseDiff(patch: string, override?: string): ParsedDiff {
  const lines = patch.split('\n'); let filePath = override ?? null; let added = 0; let removed = 0;
  for (const line of lines) {
    if (!filePath) {
      if (line.startsWith('+++ ')) filePath = line.slice(4).trim().replace(/^[ab]\//, '');
      else if (line.startsWith('diff --git ')) { const m = line.match(/ b\/(\S+)/); if (m) filePath = m[1]; }
    }
    if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) removed++;
  }
  return { filePath, added, removed, hunkOffset: -1 };
}

function badgeFor(name: string | null) {
  if (!name) return { label: 'TXT', tone: { bg: 'rgba(113,113,122,0.12)', fg: '#71717a' } };
  for (const b of LANG_BADGES) if (b.test.test(name)) return b;
  return { label: 'TXT', tone: { bg: 'rgba(113,113,122,0.12)', fg: '#71717a' } };
}

function DiffHeader({ badge, name, added, removed, onCopy, copied }: { badge: ReturnType<typeof badgeFor>; name: string | null; added: number | null; removed: number | null; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center gap-2.5 border-b px-3 py-2" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-surface-elevated)' }}>
      <span className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold" style={{ background: badge.tone.bg, color: badge.tone.fg }}>{badge.label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium text-bobby-ink" title={name ?? ''}>{name ?? 'patch'}</span>
      {added != null && <span className="shrink-0 font-mono text-[11px] tabular-nums"><span style={{ color: 'var(--bobby-diff-added)' }}>+{added}</span>{(removed ?? 0) > 0 && <span className="px-1 text-bobby-faint">·</span>}<span style={{ color: 'var(--bobby-diff-removed)' }}>-{removed}</span></span>}
      <button onClick={onCopy} className="shrink-0 rounded-md p-1 text-bobby-faint hover:text-bobby-ink transition"><Copy className="h-3.5 w-3.5" strokeWidth={1.8} /></button>
    </div>
  );
}

export function DiffView({ patch, className = '', maxHeight = 320, filePath }: Props): ReactElement {
  const lines = patch.split('\n'); const looksLikePatch = lines.some(l => /^[+-]/.test(l) || l.startsWith('@@'));
  const parsed = useMemo(() => parseDiff(patch, filePath), [patch, filePath]);
  const [copied, setCopied] = useState(false);
  const fileLabel = parsed.filePath ?? filePath ?? null;
  const displayName = fileLabel ? fileLabel.split(/[/\\]/).pop() ?? fileLabel : null;
  const badge = badgeFor(fileLabel);

  if (!looksLikePatch) return <pre className="overflow-auto whitespace-pre p-3 font-mono text-[11.5px] leading-6 text-bobby-ink" style={{ maxHeight, background: 'var(--bobby-surface-card)', borderRadius: 14 }}>{patch}</pre>;

  const bodyLines = lines.map((line, i) => ({ line, i })).filter(({ line }) => !line.startsWith('--- ') && !line.startsWith('+++ ') && !line.startsWith('diff --git ') && !line.startsWith('index '));
  const numbered: Array<{ key: number; line: string; lineNo: number | null; bg: string; fg: string }> = [];
  let newLineNo: number | null = null;
  for (const { line, i } of bodyLines) {
    let bg = '', fg = '';
    let displayedNo: number | null = null;
    if (line.startsWith('@@')) { bg = 'var(--bobby-accent-soft)'; fg = 'var(--bobby-text-muted)'; const m = line.match(/\+(\d+)/); newLineNo = m ? parseInt(m[1], 10) : null; }
    else if (line.startsWith('+')) { bg = 'var(--bobby-diff-added-soft)'; fg = 'var(--bobby-diff-added)'; displayedNo = newLineNo; if (newLineNo != null) newLineNo++; }
    else if (line.startsWith('-')) { bg = 'var(--bobby-diff-removed-soft)'; fg = 'var(--bobby-diff-removed)'; }
    else { fg = 'var(--bobby-text)'; displayedNo = newLineNo; if (newLineNo != null) newLineNo++; }
    numbered.push({ key: i, line, lineNo: displayedNo, bg, fg });
  }

  return (
    <div className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] ${className}`} style={{ background: 'var(--bobby-surface-card)', border: '1px solid var(--bobby-border)' }}>
      <DiffHeader badge={badge} name={displayName} added={parsed.added} removed={parsed.removed} onCopy={async () => { try { await navigator.clipboard.writeText(patch); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {} }} copied={copied} />
      <div className="min-w-0 overflow-auto font-mono text-[11.5px] leading-6" style={{ maxHeight }}>
        <table className="w-max min-w-full border-collapse">
          <tbody>{numbered.map(({ key, line, lineNo, bg, fg }) => <tr key={key} style={{ background: bg || 'transparent', color: fg }}><td className="select-none px-2 text-right tabular-nums text-bobby-faint" style={{ width: '2.75rem' }}>{lineNo ?? ''}</td><td className="whitespace-pre px-3 pr-2">{line || ' '}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}