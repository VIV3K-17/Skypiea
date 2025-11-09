import React from 'react';

// Minimal FeaturedIcon used by App.jsx when the design-system component
// isn't available during local development. Keeps the visual affordance
// and accepts the same props used in the UI.
export function FeaturedIcon({ color = 'brand', icon: Icon, theme = 'light', size = 'md', className = '' }) {
  const sizes = { sm: 18, md: 28, lg: 36 };
  const sz = sizes[size] || sizes.md;
  const bg = theme === 'light' ? 'var(--pure)' : 'var(--forest-mid)';
  const fg = color === 'brand' ? 'var(--forest-dark)' : color;

  const wrapperStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: sz,
    height: sz,
    background: bg,
    borderRadius: 8,
    boxShadow: '0 6px 18px rgba(43,70,60,0.06)',
    color: fg,
    flex: '0 0 auto'
  };

  return (
    <span className={`featured-icon ${className}`} style={wrapperStyle} aria-hidden>
      {Icon ? (
        // If Icon is a React component, render it with a sensible size
        // (many icon libs accept width/height or style/className)
        <Icon width={Math.round(sz * 0.7)} height={Math.round(sz * 0.7)} />
      ) : (
        // fallback: simple check circle SVG
        <svg width={Math.round(sz * 0.7)} height={Math.round(sz * 0.7)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke={fg} strokeWidth="1.6" fill="none" />
          <path d="M7 12.5l2.3 2.3L17 7" stroke={fg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export default FeaturedIcon;
