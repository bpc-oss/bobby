import React from 'react';

export function Settings(): JSX.Element {
  const [model, setModel] = React.useState('deepseek');
  const [route, setRoute] = React.useState('default');
  const [budgetUsd, setBudgetUsd] = React.useState('100');
  const [defaultPermission, setDefaultPermission] = React.useState('L1');
  const [strongSandbox, setStrongSandbox] = React.useState(false);

  return (
    <section className="wizard-form">
      <h2 className="screen-title">设置</h2>
      <p className="muted">模型、路由、预算、默认权限及隔离策略。</p>

      <label className="settings-row">
        <span>模型</span>
        <input value={model} onChange={(event) => setModel(event.target.value)} />
      </label>

      <label className="settings-row">
        <span>路由</span>
        <input value={route} onChange={(event) => setRoute(event.target.value)} />
      </label>

      <label className="settings-row">
        <span>预算上限 (USD)</span>
        <input value={budgetUsd} onChange={(event) => setBudgetUsd(event.target.value)} />
      </label>

      <label className="settings-row">
        <span>默认权限档</span>
        <select value={defaultPermission} onChange={(event) => setDefaultPermission(event.target.value)}>
          <option value="L0">L0</option>
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
          <option value="L4">L4</option>
        </select>
      </label>

      <label className="settings-row">
        <span>
          <input
            type="checkbox"
            checked={strongSandbox}
            onChange={(event) => setStrongSandbox(event.target.checked)}
          />{' '}
          强沙盒
        </span>
      </label>

      <p className="muted">当前仅本地回显，不会持久化到硬盘。</p>
      <p className="muted">示例值：model={model}，route={route}，budget={budgetUsd}，defaultPermission={defaultPermission}，strongSandbox={strongSandbox ? 'on' : 'off'}</p>
    </section>
  );
}
