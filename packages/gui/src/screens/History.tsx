import React from 'react';

interface TraceItem {
  id: string;
  task: string;
  status: string;
}

export function History(): JSX.Element {
  const items: TraceItem[] = [
    { id: 't-1', task: '生成季度分析', status: 'done' },
    { id: 't-2', task: '清理并重排文档', status: 'failed' }
  ];

  return (
    <section>
      <h2 className="screen-title">历史</h2>
      <p className="muted">最近任务轨迹（本地演示）</p>
      <ol className="plan-list">
        {items.map((item) => (
          <li key={item.id}>
            {item.id} / {item.task} / {item.status}
          </li>
        ))}
      </ol>
    </section>
  );
}
