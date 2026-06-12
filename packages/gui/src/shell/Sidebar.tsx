import React from 'react';

import { useUiStore } from '../store/ui-store';
import { ModeSwitch } from './ModeSwitch';
import { FN_ITEMS, STATIC_GROUPS } from './sidebar-config';

export function Sidebar(): JSX.Element {
  const mode = useUiStore((state) => state.mode);
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);

  return (
    <aside className="side">
      <ModeSwitch codeBadge={1} />
      <div className="side-fn">
        {FN_ITEMS[mode].map((fn) => (
          <button
            key={fn.view}
            className={`fn-item ${view === fn.view ? 'active' : ''}`}
            onClick={() => setView(fn.view)}
          >
            <span className="ic">{fn.icon}</span>
            {fn.label}
            {fn.soon && <span className="soon">SOON</span>}
          </button>
        ))}
      </div>
      <div className="side-sep" />
      <div className="side-list">
        {STATIC_GROUPS[mode].map((group) => (
          <React.Fragment key={group.heading}>
            <div className="group-h">{group.heading}</div>
            {group.items.map((item) => (
              <div className="item" key={item.title}>
                <span className={`dot ${item.dot}`} />
                <span className="t">{item.title}</span>
                <span className="time">{item.time}</span>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="side-bottom">
        <button className={`sb-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <span aria-hidden>⚙</span>
          <span>Settings</span>
        </button>
        <button className="sb-btn acct">
          <span className="avatar">B</span>
        </button>
      </div>
    </aside>
  );
}
