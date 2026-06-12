import React from 'react';

import type { AppMode } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';

const SEGMENTS: Array<{ mode: AppMode; glyph: string; label: string }> = [
  { mode: 'chat', glyph: '❍', label: 'Chat' },
  { mode: 'code', glyph: '</>', label: 'Code' }
];

export function ModeSwitch({ codeBadge = 0 }: { codeBadge?: number }): JSX.Element {
  const mode = useUiStore((state) => state.mode);
  const setMode = useUiStore((state) => state.setMode);
  const activeIndex = SEGMENTS.findIndex((segment) => segment.mode === mode);

  return (
    <div className="mode-switch" role="tablist" aria-label="模式切换">
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
          {segment.label}
          {segment.mode === 'code' && codeBadge > 0 && <span className="badge">{codeBadge}</span>}
        </button>
      ))}
    </div>
  );
}
