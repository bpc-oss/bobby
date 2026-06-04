import React from 'react';
import { createRoot } from 'react-dom/client';

function App(): JSX.Element {
  return (
    <main>
      <h1>Bobby GUI Shell</h1>
      <p>Kernel IPC Bridge Ready</p>
    </main>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<App />);
}
