import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EmptyState } from '../src/modes/EmptyState';
import { LoopPlaceholder } from '../src/modes/LoopPlaceholder';
import { getPlaceholders } from '../src/modes/placeholder-config';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

afterEach(() => {
  cleanup();
});

describe('Placeholder surfaces', () => {
  it('renders the shared placeholder shell markers', () => {
    render(<EmptyState glyph="S" title="Search" desc="desc" tag="P6" />);

    expect(document.querySelector('.placeholder-shell')).toBeTruthy();
    expect(document.querySelector('.placeholder-copy')).toBeTruthy();
  });

  it('renders the loop wizard aid chips', () => {
    render(<LoopPlaceholder />);

    expect(document.querySelector('.wizard')).toBeTruthy();
    expect(document.querySelector('.wz-aids')).toBeTruthy();
  });

  it('provides page-specific skeleton detail blocks for the placeholder family', () => {
    const detailViews = ['write', 'projects', 'routines', 'team', 'settings'] as const;
    const placeholders = getPlaceholders('zh');

    for (const key of detailViews) {
      const detail = placeholders[key].children;
      expect(detail).toBeTruthy();
    }
  });
});
