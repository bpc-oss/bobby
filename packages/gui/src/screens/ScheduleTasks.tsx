import React, { useState } from 'react';
import { Clock, Plus, Trash2, Play } from 'lucide-react';

const mockTasks = [
  { id: '1', name: 'Daily code review', cron: '0 9 * * *', enabled: true, lastRun: '2026-06-09 09:00' },
  { id: '2', name: 'Run tests on push', cron: '*/30 * * * *', enabled: false, lastRun: '-' },
  { id: '3', name: 'Weekly report', cron: '0 9 * * 1', enabled: true, lastRun: '2026-06-08 09:00' },
];

export function ScheduleTasks() {
  const [tasks, setTasks] = useState(mockTasks);

  const toggle = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  const remove = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <h2 className="text-[13px] font-semibold text-bobby-ink">Scheduled Tasks</h2>
        <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white" style={{ background: 'var(--bobby-accent)' }}>
          <Plus className="w-3.5 h-3.5" />New Task
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 max-w-[600px] mx-auto w-full">
        {tasks.map(t => (
          <div key={t.id} className="mb-3 rounded-2xl border p-4 flex items-center gap-4"
            style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
            <button onClick={() => toggle(t.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${t.enabled ? 'border-accent bg-accent' : 'border-bobby-border'}`}>
              {t.enabled && <div className="w-2 h-2 rounded-full bg-white" />}
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-medium text-bobby-ink">{t.name}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[11px] font-mono text-bobby-faint">{t.cron}</span>
                <span className="text-[11px] text-bobby-faint">Last: {t.lastRun}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="rounded-lg p-1.5 text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition"><Play className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-bobby-muted hover:text-bobby-danger hover:bg-bobby-danger-soft transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}