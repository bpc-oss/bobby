import React from 'react';

import type { Evidence } from '@bobby/shared';

import { toPlainLanguage } from '../lib/evidence-format';

interface EvidencePanelProps {
  evidence: Evidence[];
}

export function EvidencePanel({ evidence }: EvidencePanelProps): JSX.Element {
  return (
    <section>
      <h2 className="screen-title">证据</h2>
      {evidence.length === 0 ? (
        <p className="muted">尚未收到可展示的证据。</p>
      ) : (
        <ul className="evidence-list">
          {evidence.map((ev, index) => {
            const plain = toPlainLanguage(ev);

            return (
              <li
                key={`${ev.claimId}-${index}`}
                className={`evidence-item ${plain.ok ? 'evidence-item--ok' : 'evidence-item--fail'}`}
              >
                <span>{plain.summary}</span>
                <details>
                  <summary>查看原始细节</summary>
                  <pre>{plain.detail}</pre>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
