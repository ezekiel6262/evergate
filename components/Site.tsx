'use client';
import { useEffect, useState } from 'react';
import { Logo, Mark } from './Logo';

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="wrap nav-in">
        <Logo />
        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main">
          <a href="#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="#try" onClick={() => setOpen(false)}>Try the rule</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setOpen(false)}>Questions</a>
          <a href="#gate" className="btn sm">Open the app</a>
        </nav>
        <button className="nav-burger" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(o => !o)}>
          <span /><span />
        </button>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .nav { position: sticky; top: 0; z-index: 50; transition: background .3s, box-shadow .3s; }
        .nav.is-scrolled { background: rgba(230,235,225,.9); backdrop-filter: blur(10px); box-shadow: 0 1px 0 var(--line); }
        .nav-in { display: flex; align-items: center; justify-content: space-between; height: 76px; }
        .nav-links { display: flex; align-items: center; gap: 28px; }
        .nav-links a:not(.btn) { text-decoration: none; font-weight: 500; color: var(--pine); }
        .nav-links a:not(.btn):hover { text-decoration: underline; text-underline-offset: 6px; text-decoration-color: var(--marigold); text-decoration-thickness: 2px; }
        .nav-burger { display: none; background: none; border: 0; width: 44px; height: 44px; cursor: pointer; }
        .nav-burger span { display: block; height: 2px; background: var(--pine); margin: 7px 8px; border-radius: 2px; }
        @media (max-width: 860px) {
          .nav-burger { display: block; }
          .nav-links { position: absolute; top: 76px; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 0; background: var(--paper);
            padding: 8px 24px 20px; border-bottom: 1px solid var(--line); display: none; }
          .nav-links.open { display: flex; }
          .nav-links a:not(.btn) { padding: 14px 0; border-bottom: 1px solid var(--line); }
          .nav-links .btn { margin-top: 16px; }
        }
      ` }} />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div className="foot-brand">
          <div style={{ color: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Mark size={34} />
            <span style={{ fontFamily: 'var(--serif)', fontSize: '1.7rem' }}>Evergate</span>
          </div>
          <p className="foot-note">Evergate is not a will. Use it alongside one, and tell your lawyer where your gate lives.</p>
        </div>
        <div className="foot-cols">
          <div>
            <p className="foot-h">Product</p>
            <a href="#setup">Set up a gate</a>
            <a href="#gate">Your gate</a>
            <a href="#guardian">For guardians</a>
            <a href="#heir">For heirs</a>
          </div>
          <div>
            <p className="foot-h">Under the hood</p>
            <a href="#public">A public rule page</a>
            <a href="#film">The film</a>
            <a href="https://tapeout.net" target="_blank" rel="noreferrer">TapeOut</a>
            <a href="https://web3.okx.com/xlayer" target="_blank" rel="noreferrer">X Layer</a>
          </div>
        </div>
      </div>
      <div className="wrap foot-base">
        <span>Built with TapeOut circuits on X Layer</span>
        <span>A Synonyms Limited product</span>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .foot { background: var(--pine); color: var(--moss-soft); padding: 72px 0 28px; margin-top: 120px; border-radius: 48px 48px 0 0; }
        .foot-in { display: flex; justify-content: space-between; gap: 48px; flex-wrap: wrap; }
        .foot-note { max-width: 26em; margin-top: 18px; color: var(--moss-soft); }
        .foot-cols { display: flex; gap: 72px; flex-wrap: wrap; }
        .foot-cols div { display: grid; gap: 10px; align-content: start; }
        .foot-cols a { color: var(--paper); text-decoration: none; }
        .foot-cols a:hover { color: var(--marigold-soft); }
        .foot-h { color: var(--moss-soft); font-size: .9rem; margin-bottom: 4px; }
        .foot-base { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 64px; padding-top: 20px; border-top: 1px solid rgba(201,211,195,.2); font-size: .88rem; }
      ` }} />
    </footer>
  );
}
