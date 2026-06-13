import React from 'react';

export interface EmptyStateProps {
  glyph: string;
  title: string;
  desc: React.ReactNode;
  tag: string;
  children?: React.ReactNode;
}

export function EmptyState({ glyph, title, desc, tag, children }: EmptyStateProps): JSX.Element {
  return (
    <div className="placeholder placeholder-shell">
      <div className="orb">{glyph}</div>
      <div className="placeholder-copy">
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      {children}
      <span className="soon-tag">{tag}</span>
    </div>
  );
}
