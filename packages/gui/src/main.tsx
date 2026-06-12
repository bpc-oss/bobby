import React from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './lib/theme.css';
import './shell/shell.css';
import './panels/panels.css';
import './modes/modes.css';
import './workspace/workspace.css';
import './app.css';

import { AppShell } from './shell/AppShell';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<AppShell />);
}
