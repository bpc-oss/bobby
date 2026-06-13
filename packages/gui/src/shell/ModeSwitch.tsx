import React from 'react';

import type { AppMode } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';

const SEGMENTS: Array<{ mode: AppMode; glyph: string }> = [
  { mode: 'chat', glyph: '◍' },
  { mode: 'code', glyph: '</>' }
];

export function ModeSwitch({ codeBadge = 0 }: { codeBadge?: number }): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const mode = useUiStore((state) => state.mode);
  const setMode = useUiStore((state) => state.setMode);
  const activeIndex = SEGMENTS.findIndex((segment) => segment.mode === mode);

  return (
    <div className="mode-switch" role="tablist" aria-label={lang === 'zh' ? '模式切换' : 'Mode switch'}>
      <div className="glider" style={{ transform: `translateX(${activeIndex * 100}%)` }} aria-hidden />
      {SEGMENTS.map((segment) => (
        <button
          key={segment.mode}
          role="tab"
          aria-selected={mode === segment.mode}
          className={`seg ${mode === segment.mode ? 'active' : ''}`}
          onClick={() => setMode(segment.mode)}
        >
          <span className="glyph">{segment.glyph}</span>
          {segment.mode === 'chat' ? (lang === 'zh' ? '对话' : 'Chat') : lang === 'zh' ? '代码' : 'Code'}
          {segment.mode === 'code' && codeBadge > 0 && <span className="badge">{codeBadge}</span>}
        </button>
      ))}
    </div>
  );
}
