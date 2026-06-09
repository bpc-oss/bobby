import React, { useState } from 'react';
import { MessageSquare, Phone, Users, Send } from 'lucide-react';

const mockChannels = [
  { id: '1', platform: 'Feishu', name: 'Bobby Bot', status: 'connected', lastMsg: '2 min ago' },
  { id: '2', platform: 'WeChat', name: 'Code Review Bot', status: 'disconnected', lastMsg: '-' },
  { id: '3', platform: 'Slack', name: 'Deploy Notifier', status: 'connected', lastMsg: '5 min ago' },
];

const mockChats = [
  { from: 'user', text: 'Run the deployment for staging', time: '10:30' },
  { from: 'bot', text: 'Deployment started. Build #142 triggered on GitHub Actions.', time: '10:30' },
  { from: 'bot', text: '✅ Build passed. Deploying to staging...', time: '10:32' },
  { from: 'bot', text: '🚀 Deployed to staging. App is live at https://staging.example.com', time: '10:33' },
];

export function ClawMode({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState('1');
  const [input, setInput] = useState('');

  return (
    <div className="flex h-full bg-bobby-canvas">
      {/* Channel list */}
      <div className="w-[240px] border-r flex flex-col" style={{ borderColor: 'var(--bobby-border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--bobby-border-muted)' }}>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-bobby-ink" />
            <h2 className="text-[13px] font-semibold text-bobby-ink">Connections</h2>
          </div>
          <button onClick={onClose} className="text-[11px] text-bobby-muted hover:text-bobby-ink">← Back</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mockChannels.map(ch => (
            <button key={ch.id} onClick={() => setSelected(ch.id)}
              className={`w-full text-left px-4 py-3 border-b transition ${selected === ch.id ? 'bg-bobby-hover' : ''}`}
              style={{ borderColor: 'var(--bobby-border-muted)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">{ch.platform === 'Feishu' ? '🐦' : ch.platform === 'WeChat' ? '💬' : '💼'}</span>
                  <div>
                    <div className="text-[13px] font-medium text-bobby-ink">{ch.name}</div>
                    <div className="text-[11px] text-bobby-faint">{ch.platform}</div>
                  </div>
                </div>
                <span className={`inline-block w-2 h-2 rounded-full ${ch.status === 'connected' ? 'bg-bobby-success' : 'bg-bobby-border'}`} />
              </div>
            </button>
          ))}
        </div>
        <div className="border-t p-3" style={{ borderColor: 'var(--bobby-border-muted)' }}>
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition">
            <Users className="w-3.5 h-3.5" />Add Channel
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--bobby-border-muted)' }}>
          <MessageSquare className="w-4 h-4 text-bobby-ink" />
          <span className="text-[13px] font-semibold text-bobby-ink">{mockChannels.find(c => c.id === selected)?.name}</span>
          <span className="ml-auto text-[11px] text-bobby-faint">Demo mode</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mockChats.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                msg.from === 'user'
                  ? 'text-white'
                  : 'text-bobby-ink'
              }`} style={{
                background: msg.from === 'user' ? 'var(--bobby-accent)' : 'var(--bobby-surface-subtle)',
                borderRadius: msg.from === 'user' ? '18px 18px 6px 18px' : '18px 18px 18px 6px'
              }}>
                {msg.text}
                <div className={`text-[10px] mt-1 ${msg.from === 'user' ? 'text-white/60' : 'text-bobby-faint'}`}>{msg.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--bobby-border-muted)' }}>
          <div className="flex items-center gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && input.trim()) setInput(''); }}
              className="flex-1 rounded-xl border px-3 py-2 text-[13px] text-bobby-ink outline-none focus:border-accent/40"
              style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}
              placeholder="Type a message..." />
            <button className="rounded-xl p-2 text-white" style={{ background: 'var(--bobby-accent)' }}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}