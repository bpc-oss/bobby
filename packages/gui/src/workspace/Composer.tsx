import React from 'react';

interface ComposerProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

export function Composer({ onSubmit, disabled = false }: ComposerProps): JSX.Element {
  const [input, setInput] = React.useState('');

  const submit = (): void => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setInput('');
  };

  return (
    <div className="composer">
      <textarea
        className="input"
        placeholder="询问或下达任务…… @文件、/命令、粘贴图片"
        value={input}
        disabled={disabled}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="tools">
        <span className="chip mono">@</span>
        <span className="chip mono">/</span>
        <span className="chip">⌕</span>
        <span className="chip model">模型 · Flash ▾</span>
        <span className="chip">权限 · 询问 ▾</span>
        <span className="chip">思考 · 关</span>
        <button className="send" onClick={submit} disabled={disabled}>
          发送 ↩
        </button>
      </div>
    </div>
  );
}
