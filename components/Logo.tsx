
/** The Evergate mark: a NAND gate turned upright reads as a garden gate.
 *  The inversion bubble becomes the sun cresting the arch. */
export function Mark({ size = 30, sun = 'var(--marigold)', ink = 'currentColor' }: { size?: number; sun?: string; ink?: string }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 32 37" fill="none" aria-hidden="true">
      <circle cx="16" cy="4.6" r="3.6" fill={sun} />
      <path d="M5.5 27.5V19.5a10.5 10.5 0 0 1 21 0v8z" stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M11 27.5v8M21 27.5v8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = '#home', light = false }: { href?: string; light?: boolean }) {
  return (
    <a href={href} className="logo" aria-label="Evergate home" style={{ color: light ? 'var(--paper)' : 'var(--pine)' }}>
      <Mark />
      <span>Evergate</span>
      <style dangerouslySetInnerHTML={{ __html: `
        .logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-family: var(--serif); font-size: 1.45rem; letter-spacing: -0.01em; }
      ` }} />
    </a>
  );
}
