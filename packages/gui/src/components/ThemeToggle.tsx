import React from 'react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: (nextTheme: 'light' | 'dark') => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps): JSX.Element {
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button type="button" className="theme-toggle-btn" onClick={() => onToggle(nextTheme)}>
      {theme === 'light' ? '切换到暗色' : '切换到亮色'}
    </button>
  );
}
