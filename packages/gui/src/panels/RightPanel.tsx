import React from 'react';

import type { RightTab } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';
import { ReviewPanel } from './ReviewPanel';

const TABS: Array<{ tab: RightTab; label: string }> = [
  { tab: 'review', label: '◈ 审查' },
  { tab: 'terminal', label: '❯ 终端' },
  { tab: 'web', label: '◍ 网页' },
  { tab: 'sidechat', label: '❍ SideChat' }
];

function TabBody({ tab }: { tab: RightTab }): JSX.Element {
  if (tab === 'review') {
    return <ReviewPanel />;
  }

  if (tab === 'terminal') {
    return <div className="rp-empty">只读命令流，记录 kernel 执行过程，交互终端留到 P4。</div>;
  }

  if (tab === 'web') {
    return <div className="rp-empty">内嵌 webview 预览区域，P4 接入真实网页面板。</div>;
  }

  return <div className="rp-empty">旁路小聊，不污染主会话上下文，P4 接入 SideChat。</div>;
}

export function RightPanel(): JSX.Element {
  const open = useUiStore((state) => state.rightPanelOpen);
  const tab = useUiStore((state) => state.rightTab);
  const setTab = useUiStore((state) => state.setRightTab);
  const toggle = useUiStore((state) => state.toggleRightPanel);
  const activeIndex = TABS.findIndex((item) => item.tab === tab);

  return (
    <aside className={`right ${open ? '' : 'collapsed'}`}>
      <div className="rp-head">
        <button className="rp-collapse" aria-label="折叠面板" onClick={toggle}>
          ⇥
        </button>
        {open && (
          <div className="rp-tabs" role="tablist">
            <div
              className="tab-underline"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
              aria-hidden
            />
            {TABS.map((item) => (
              <button
                key={item.tab}
                role="tab"
                aria-selected={tab === item.tab}
                className={`rp-tab ${tab === item.tab ? 'active' : ''}`}
                onClick={() => setTab(item.tab)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="rp-body">
          <TabBody tab={tab} />
        </div>
      )}
    </aside>
  );
}
