import React from 'react';

type SettingTextRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function SettingTextRow({ label, value, onChange }: SettingTextRowProps): JSX.Element {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PermissionRow({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="settings-row">
      <span>默认权限档</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="L0">L0</option>
        <option value="L1">L1</option>
        <option value="L2">L2</option>
        <option value="L3">L3</option>
        <option value="L4">L4</option>
      </select>
    </label>
  );
}

function SandboxRow({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="settings-row">
      <span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        强沙盒
      </span>
    </label>
  );
}

function SettingsSummary({
  model,
  route,
  budgetUsd,
  defaultPermission,
  strongSandbox
}: {
  model: string;
  route: string;
  budgetUsd: string;
  defaultPermission: string;
  strongSandbox: boolean;
}): JSX.Element {
  return (
    <>
      <p className="muted">当前仅本地回显，不会持久化到硬盘。</p>
      <p className="muted">
        示例值：model={model}，route={route}，budget={budgetUsd}，defaultPermission={defaultPermission}，strongSandbox={strongSandbox ? 'on' : 'off'}
      </p>
    </>
  );
}

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

      <SettingTextRow label="模型" value={model} onChange={setModel} />
      <SettingTextRow label="路由" value={route} onChange={setRoute} />
      <SettingTextRow label="预算上限 (USD)" value={budgetUsd} onChange={setBudgetUsd} />
      <PermissionRow value={defaultPermission} onChange={setDefaultPermission} />
      <SandboxRow checked={strongSandbox} onChange={setStrongSandbox} />
      <SettingsSummary
        model={model}
        route={route}
        budgetUsd={budgetUsd}
        defaultPermission={defaultPermission}
        strongSandbox={strongSandbox}
      />
    </section>
  );
}
