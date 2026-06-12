import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { LoopPlaceholder } from '../src/modes/LoopPlaceholder';
import { PLACEHOLDERS } from '../src/modes/placeholder-config';

describe('占位页', () => {
  it('所有非 session 视图都有占位配置', () => {
    for (const view of ['search', 'write', 'projects', 'routines', 'team', 'settings'] as const) {
      expect(PLACEHOLDERS[view]).toBeTruthy();
      expect(PLACEHOLDERS[view].title.length).toBeGreaterThan(0);
    }
  });

  it('Loop 占位页渲染四步引导向导骨架', () => {
    render(<LoopPlaceholder />);
    expect(screen.getByText('目标')).toBeTruthy();
    expect(screen.getByText('验收器')).toBeTruthy();
    expect(screen.getByText('迭代策略')).toBeTruthy();
    expect(screen.getByText('预算')).toBeTruthy();
    expect(screen.getByText(/AI 辅助润写/)).toBeTruthy();
  });
});
