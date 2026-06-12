import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { StatusBar } from '../src/shell/StatusBar';
import { TitleBar } from '../src/shell/TitleBar';

describe('TitleBar', () => {
  it('渲染品牌 / 项目切换器 / 命令面板入口', () => {
    render(<TitleBar projectName="bobby" />);
    expect(screen.getByText('BOBBY')).toBeTruthy();
    expect(screen.getByText(/bobby ▾/i)).toBeTruthy();
    expect(screen.getByText(/Ctrl K/i)).toBeTruthy();
  });
});

describe('StatusBar', () => {
  it('渲染 kernel/模型/上下文/mock 标识', () => {
    render(<StatusBar kernelConnected model="FLASH" contextPct={34} mock />);
    expect(screen.getByText(/KERNEL CONNECTED/)).toBeTruthy();
    expect(screen.getByText(/FLASH/)).toBeTruthy();
    expect(screen.getByText(/34%/)).toBeTruthy();
    expect(screen.getByText(/MOCK MODE/)).toBeTruthy();
  });
});
