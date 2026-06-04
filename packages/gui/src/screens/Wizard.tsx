import React from 'react';

interface WizardProps {
  onStart: () => void;
}

export function Wizard({ onStart }: WizardProps): JSX.Element {
  const [provider, setProvider] = React.useState('deepseek');
  const [permissionFile, setPermissionFile] = React.useState('policy-default.json');
  const [language, setLanguage] = React.useState('zh');

  const isReady = provider.trim().length > 0 && permissionFile.trim().length > 0;

  return (
    <section className="wizard-form">
      <h2 className="screen-title">首启向导</h2>
      <p className="muted">首次打开时填写基础设置，之后可在设置页修改。</p>

      <label className="wizard-row">
        <span>模型提供商</span>
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option value="deepseek">DeepSeek</option>
          <option value="mock">Mock 模式（演示）</option>
        </select>
      </label>

      <label className="wizard-row">
        <span>权限档</span>
        <input value={permissionFile} onChange={(event) => setPermissionFile(event.target.value)} />
      </label>

      <label className="wizard-row">
        <span>语言</span>
        <select value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>

      <button disabled={!isReady} onClick={onStart} type="button">
        继续进入工作区
      </button>

      <p className="muted">
        当前仅本地展示，未写入 API Key；模型调用将由后端策略决定。
      </p>
    </section>
  );
}
