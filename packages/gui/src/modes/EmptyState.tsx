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
    <div className="placeholder">
      <div className="orb">{glyph}</div>
      <h2>{title}</h2>
      <p>{desc}</p>
      {children}
      <span className="soon-tag">{tag}</span>
    </div>
  );
}
