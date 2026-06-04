import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { GateDialog } from '../src/components/GateDialog';
import { t } from '../src/lib/i18n';

describe('GateDialog', () => {
  it('shows reason and returns allow/deny via callback', () => {
    const onDecide = vi.fn();
    render(<GateDialog reason="它想联网下载一个工具" onDecide={onDecide} />);

    expect(screen.getByText(/联网下载/)).toBeTruthy();

    const allowButton = screen.getByRole('button', { name: t('allow') });
    const denyButton = screen.getByRole('button', { name: t('deny') });

    fireEvent.click(allowButton);
    expect(onDecide).toHaveBeenCalledWith('allow');

    fireEvent.click(denyButton);
    expect(onDecide).toHaveBeenCalledWith('deny');
  });
});
