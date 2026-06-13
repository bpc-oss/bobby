import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RightPanel } from '../src/panels/RightPanel';
import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();
const initialSession = useSessionStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  useSessionStore.setState(initialSession, true);
});

afterEach(() => {
  cleanup();
});

describe('RightPanel', () => {
  it('is collapsed by default', () => {
    render(<RightPanel />);
    expect(document.querySelector('.right.collapsed')).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens multiple modules from the menu but shows only the active tab body', () => {
    useSessionStore.getState().setActiveSession('code-gate');
    useUiStore.setState({ rightPanelOpen: true, rightPanelMenuOpen: true }, false);

    render(<RightPanel />);

    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /终端/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /浏览器/ }));

    expect(useUiStore.getState().rightPanels).toEqual(['review', 'terminal', 'browser']);
    expect(useUiStore.getState().activeRightPanel).toBe('browser');
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /审查/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /终端/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /浏览器/ })).toBeTruthy();
    expect(document.querySelectorAll('.rp-tab-chip')).toHaveLength(3);
    expect(document.querySelector('.web-bar')).toBeTruthy();
    expect(document.querySelector('.term')).toBeNull();
    expect(document.querySelectorAll('.rp-panel-view')).toHaveLength(1);
  });

  it('switches between opened tabs and closes the active tab back to the previous one', () => {
    useSessionStore.getState().setActiveSession('code-gate');
    useUiStore.setState(
      {
        rightPanelOpen: true,
        rightPanels: ['review', 'terminal', 'browser'],
        activeRightPanel: 'browser'
      },
      false
    );

    render(<RightPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /终端/ }));
    expect(useUiStore.getState().activeRightPanel).toBe('terminal');
    expect(document.querySelector('.term')).toBeTruthy();
    expect(document.querySelector('.web-bar')).toBeNull();

    fireEvent.click(screen.getByLabelText('关闭终端'));
    expect(useUiStore.getState().rightPanels).toEqual(['review', 'browser']);
    expect(useUiStore.getState().activeRightPanel).toBe('browser');
    expect(document.querySelector('.web-bar')).toBeTruthy();
  });

  it('renders preview bodies for browser and files tabs in code-gate preview mode', () => {
    useSessionStore.getState().setActiveSession('code-gate');
    useUiStore.setState(
      {
        rightPanelOpen: true,
        rightPanels: ['review', 'browser', 'files'],
        activeRightPanel: 'files'
      },
      false
    );

    render(<RightPanel />);

    expect(document.querySelector('.sc-note')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /浏览器/ }));
    expect(document.querySelector('.web-bar')).toBeTruthy();
  });
});
