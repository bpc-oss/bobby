import React from 'react';

interface ChatStreamProps {
  messages: string[];
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

export function ChatStream({ messages, onSubmit, disabled = false }: ChatStreamProps): JSX.Element {
  const [input, setInput] = React.useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || disabled) {
      return;
    }

    onSubmit(trimmed);
    setInput('');
  };

  return (
    <section>
      <h2 className="screen-title">对话</h2>
      <p className="muted">输入需求或任务描述，直接发给 Agent。</p>
      <form onSubmit={handleSubmit} className="chat-stream-input">
        <label htmlFor="bobby-chat-input" className="sr-only">
          任务输入
        </label>
        <input
          id="bobby-chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="例如：帮我生成一个分析报告草稿"
          disabled={disabled}
        />
        <button type="submit" disabled={disabled}>
          {disabled ? '处理中' : '发送'}
        </button>
      </form>

      <ol className="stream-list">
        {messages.map((step, index) => (
          <li key={`${step}-${index}`}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
