/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: 'var(--bobby-accent)', foreground: '#ffffff', soft: 'var(--bobby-accent-soft)' },
        background: 'var(--bobby-bg-canvas)',
        foreground: 'var(--bobby-text)',
        border: 'var(--bobby-border)',
        muted: { DEFAULT: 'var(--bobby-surface-subtle)', foreground: 'var(--bobby-text-muted)' },
        sidebar: 'var(--bobby-bg-sidebar)',
        primary: { DEFAULT: 'var(--bobby-accent)', foreground: '#ffffff' },
        bobby: {
          main: 'var(--bobby-bg-main)', sidebar: 'var(--bobby-bg-sidebar)', canvas: 'var(--bobby-bg-canvas)',
          card: 'var(--bobby-surface-card)', elevated: 'var(--bobby-surface-elevated)',
          subtle: 'var(--bobby-surface-subtle)', hover: 'var(--bobby-surface-hover)',
          border: 'var(--bobby-border)', 'border-muted': 'var(--bobby-border-muted)',
          'border-strong': 'var(--bobby-border-strong)',
          ink: 'var(--bobby-text)', muted: 'var(--bobby-text-muted)', faint: 'var(--bobby-text-faint)',
          success: 'var(--bobby-success)', 'success-soft': 'var(--bobby-success-soft)',
          danger: 'var(--bobby-danger)', 'danger-soft': 'var(--bobby-danger-soft)',
          'diff-added': 'var(--bobby-diff-added)', 'diff-added-soft': 'var(--bobby-diff-added-soft)',
          'diff-removed': 'var(--bobby-diff-removed)', 'diff-removed-soft': 'var(--bobby-diff-removed-soft)',
          skill: 'var(--bobby-skill)', 'skill-soft': 'var(--bobby-skill-soft)',
          userbubble: 'var(--bobby-bubble-user)', userbubbleFg: 'var(--bobby-bubble-user-fg)',
          'code-bg': 'var(--bobby-code-bg)', 'pre-bg': 'var(--bobby-pre-bg)',
          'inline-code-bg': 'var(--bobby-inline-code-bg)',
          chip: 'var(--bobby-chip-bg)', 'chip-border': 'var(--bobby-chip-border)',
          'card-soft': 'var(--bobby-card-soft)', 'card-strong': 'var(--bobby-card-strong)',
          'card-muted': 'var(--bobby-card-muted)', 'card-ghost': 'var(--bobby-card-ghost)',
          'stage-gradient': 'var(--bobby-stage-gradient)',
          'topbar-bg': 'var(--bobby-topbar-bg)', 'topbar-shadow': 'var(--bobby-topbar-shadow)',
          'sidebar-gradient': 'var(--bobby-sidebar-gradient)', 'sidebar-haze': 'var(--bobby-sidebar-haze)',
          'sidebar-border': 'var(--bobby-sidebar-border)', 'sidebar-shadow': 'var(--bobby-sidebar-shadow)',
          'sidebar-row-hover': 'var(--bobby-sidebar-row-hover)', 'sidebar-row-active': 'var(--bobby-sidebar-row-active)',
          'sidebar-row-ring': 'var(--bobby-sidebar-row-ring)', 'sidebar-field-bg': 'var(--bobby-sidebar-field-bg)',
          'sidebar-field-focus': 'var(--bobby-sidebar-field-focus)', 'sidebar-divider': 'var(--bobby-sidebar-divider)',
          'selection': 'var(--bobby-selection)', 'kbd-bg': 'var(--bobby-kbd-bg)',
          'table-head-bg': 'var(--bobby-table-head-bg)',
          'scrollbar-thumb': 'var(--bobby-scrollbar-thumb)', 'scrollbar-thumb-hover': 'var(--bobby-scrollbar-thumb-hover)',
          'composer-shell': 'var(--bobby-shadow-composer)',
        }
      },
      boxShadow: {
        composer: 'var(--bobby-shadow-composer)',
        shell: 'var(--bobby-shadow-shell)',
        panel: 'var(--bobby-shadow-panel)',
        'card-soft': 'var(--bobby-shadow-card-soft)',
        'card-strong': 'var(--bobby-shadow-card-strong)',
        chip: 'var(--bobby-shadow-chip)',
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '22px' }
    }
  },
  plugins: []
}