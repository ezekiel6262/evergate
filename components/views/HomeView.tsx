'use client';
import { SiteFooter, SiteNav } from '@/components/Site';
import { FilmPlayer } from '@/components/FilmPlayer';
import { RuleSimulator } from '@/components/RuleSimulator';
import { Mark } from '@/components/Logo';
import { Faq } from '@/components/Faq';
import { OutliveArt } from '@/components/OutliveArt';

const steps = [
  {
    title: 'Set the rule once',
    body: 'Choose your heirs and their shares, pick three people you trust as guardians, and decide how often you check in and how long the wait is. You see the whole rule in plain words before you sign.',
    icon: (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><rect x="14" y="10" width="36" height="46" rx="6" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M22 24h20M22 32h20M22 40h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="46" cy="46" r="9" fill="var(--marigold)" /></svg>
    ),
  },
  {
    title: 'Check in now and then',
    body: 'Every month or so, one tap tells your gate you are here. Withdraw or change the plan any time. Nothing can move without you.',
    icon: (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><rect x="20" y="8" width="24" height="46" rx="6" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="32" cy="30" r="8" fill="var(--marigold)" /><path d="M10 30a22 22 0 0 1 4-12M54 30a22 22 0 0 0-4-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>
    ),
  },
  {
    title: 'If you stop, guardians are alerted',
    body: 'Miss enough check-ins and your guardians and heirs get a message. A waiting period starts. You can still cancel with a single check-in.',
    icon: (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><path d="M18 42c0-18 5-28 14-28s14 10 14 28z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><path d="M14 42h36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="50" r="4" fill="var(--marigold)" /></svg>
    ),
  },
  {
    title: 'After the wait, heirs claim',
    body: 'When enough guardians approve and the wait is over, the gate opens. Each heir claims their share straight from the gate. No company sits in the middle.',
    icon: (
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><path d="M12 54V30a20 20 0 0 1 40 0v24" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="32" cy="40" r="7" fill="var(--marigold)" /><path d="M20 54l6-8M44 54l-6-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
    ),
  },
];

export function HomeView() {
  return (
    <>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="hero wrap">
          <div className="hero-copy">
            <h1>Your crypto reaches the people you love. Exactly as you wrote it.</h1>
            <div className="hero-side">
              <p>Evergate keeps your assets behind a rule you set once. Check in now and then. If you ever stop, your guardians are alerted, and after a waiting period your heirs receive their shares. You can change the plan while you are checking in. Nobody else can, including Evergate.</p>
              <div className="hero-cta">
                <a href="#setup" className="btn">Set up your gate</a>
                <a href="#film" className="btn ghost">Watch the film</a>
              </div>
            </div>
          </div>
          <div className="hero-window">
            <FilmPlayer className="hero-film" />
          </div>
          <ul className="assure">
            <li><Check />You keep your keys. Evergate never holds your funds.</li>
            <li><Check />The rule is a circuit on X Layer with a permanent ID.</li>
            <li><Check />Your heirs&apos; page keeps working even if we are gone.</li>
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="how wrap">
          <div className="how-head">
            <h2>How it works</h2>
            <p className="muted measure">Four moments, from the day you set it up to the day someone else needs it.</p>
          </div>
          <ol className="how-list">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="how-n" aria-hidden>{i + 1}</span>
                <div className="how-icon">{s.icon}</div>
                <div>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Simulator */}
        <section id="try" className="wrap block">
          <div className="block-head">
            <h2>Try the rule yourself</h2>
            <p className="muted measure">Miss some check-ins, have guardians approve, end the wait. The gate shown here runs the same logic as the circuit onchain.</p>
          </div>
          <RuleSimulator />
        </section>

        {/* In use */}
        {/* Outlives us */}
        <section className="outlive">
          <div className="wrap outlive-in">
            <div className="outlive-head">
              <h2>Built to outlive us</h2>
              <p>Most inheritance services only work while the company does. Evergate puts every piece your family needs somewhere permanent.</p>
              <OutliveArt />
            </div>
            <dl className="outlive-list">
              <div>
                <dt>The rule is a circuit</dt>
                <dd>Your rule is taped out as a TapeOut circuit with a permanent ID like <code>2.311.9</code>. Anyone can recompute its answer for free, and nobody can edit it.</dd>
              </div>
              <div>
                <dt>The money lives in the gate</dt>
                <dd>Assets sit in the circuit&apos;s own wallet. Only you can move them while you check in. Only the rule can release them to your heirs.</dd>
              </div>
              <div>
                <dt>The instructions live on DeWEB</dt>
                <dd>Each gate has a public page at a <code>tape://</code> address, served from the chain and checked byte by byte. Alerts travel by TapeSend.</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Who */}
        <section className="wrap block who">
          <h2>Who uses Evergate</h2>
          <div className="who-grid">
            <div><h3>People who hold their own keys</h3><p className="muted">A plan for your family that does not mean handing anyone your seed phrase today.</p></div>
            <div><h3>Families and estate planners</h3><p className="muted">A plain-language rule page a will can point to and a lawyer can read.</p></div>
            <div><h3>DAOs, funds and founders</h3><p className="muted">Key-person cover for treasuries and admin keys, with a quorum and a full record.</p></div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="wrap block">
          <div className="block-head">
            <h2>Pricing</h2>
            <p className="muted measure">You pay the chain. Evergate does not take a fee on top, and the contract has no yearly charge.</p>
          </div>
          <div className="price">
            <div className="price-col">
              <h3>Publish the rule</h3>
              <p className="price-n">0.0013 OKB</p>
              <p className="muted">Each tape-out. The first gate on a processor publishes the shared rule as well, so that one pays twice. Creating a processor, when you do not already have one, is 0.1 BEM. The parts for the shared rule are 0.02 BEM.</p>
            </div>
            <div className="price-col featured">
              <h3>Open the wallet</h3>
              <p className="price-n">0.08 OKB</p>
              <p className="muted">Opens the gate&apos;s own wallet. Sending assets in is a normal transfer after that.</p>
              <a href="#setup" className="btn">Set up your gate</a>
            </div>
            <div className="price-col">
              <h3>When heirs claim</h3>
              <p className="price-n">0.0013 OKB</p>
              <p className="muted">Attached to each payment the gate wallet makes. The caller pays it. Nothing is kept by Evergate.</p>
            </div>
          </div>
        </section>

        <section id="faq" className="wrap block faq-wrap">
          <h2>Questions people ask</h2>
          <Faq />
        </section>

        <section className="wrap final">
          <div className="final-arch">
            <Mark size={54} ink="var(--pine)" />
            <h2>Five minutes today. Peace of mind for good.</h2>
            <a href="#setup" className="btn sun">Set up your gate</a>
          </div>
        </section>
      </main>
      <SiteFooter />

      <style dangerouslySetInnerHTML={{ __html: `
        .hero { padding-top: 48px; }
        .hero-copy { display: grid; grid-template-columns: 1.25fr 1fr; gap: 56px; align-items: end; }
        .hero-copy h1 { max-width: 13.5em; }
        .hero-side { display: grid; gap: 26px; padding-bottom: 8px; }
        .hero-side p { font-size: 1.1rem; max-width: 30em; }
        .hero-cta { display: flex; gap: 12px; flex-wrap: wrap; }
        .hero-window { margin-top: 56px; aspect-ratio: 16 / 9; border-radius: 50% 50% 28px 28px / 30% 30% 28px 28px; overflow: hidden; background: var(--paper); box-shadow: 0 0 0 10px var(--paper), 0 0 0 11px var(--line); }
        .hero-film { width: 100%; height: 100%; }
        .assure { list-style: none; padding: 0; margin: 40px 0 0; display: flex; justify-content: center; gap: 28px; flex-wrap: wrap; color: var(--pine); font-weight: 500; font-size: .95rem; }
        .assure li { display: flex; align-items: center; gap: 10px; }

        .how { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 64px; padding-top: 140px; }
        .how-head { position: sticky; top: 110px; align-self: start; display: grid; gap: 16px; }
        .how-list { list-style: none; margin: 0; padding: 0; display: grid; }
        .how-list li { display: grid; grid-template-columns: 44px 72px 1fr; gap: 18px; align-items: start; padding: 30px 0; border-top: 1px solid var(--line); }
        .how-list li:last-child { border-bottom: 1px solid var(--line); }
        .how-n { font-family: var(--serif); font-size: 2rem; color: var(--moss); line-height: 1; padding-top: 6px; }
        .how-icon { color: var(--pine); }
        .how-list h3 { margin-bottom: 8px; }

        .block { padding-top: 140px; }
        .block-head { display: grid; gap: 14px; margin-bottom: 40px; }

        .clips { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
        .clips figure { margin: 0; display: grid; gap: 14px; }
        .clips figcaption { color: var(--moss); font-size: .95rem; }
        .browser { background: var(--paper); border-radius: 18px; padding: 30px 8px 8px; position: relative; border: 1px solid var(--line); }
        .browser > span { position: absolute; top: 12px; width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
        .browser > span:nth-child(1) { left: 16px; } .browser > span:nth-child(2) { left: 32px; } .browser > span:nth-child(3) { left: 48px; }
        .browser video { width: 100%; border-radius: 10px; aspect-ratio: 16 / 10; object-fit: cover; background: var(--lichen); }

        .outlive { margin-top: 140px; background: var(--pine); color: var(--paper); padding: 110px 0; border-radius: 999px 999px 0 0 / 120px 120px 0 0; }
        .outlive-in { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 64px; }
        .outlive-head { display: grid; gap: 18px; align-content: start; }
        .outlive-head p { color: var(--moss-soft); max-width: 26em; font-size: 1.08rem; }
        .outlive-list { margin: 0; display: grid; gap: 0; }
        .outlive-list > div { padding: 26px 0; border-top: 1px solid rgba(201,211,195,.22); }
        .outlive-list dt { font-family: var(--serif); font-size: 1.5rem; margin-bottom: 8px; color: var(--marigold-soft); }
        .outlive-list dd { margin: 0; color: #d6e0d1; max-width: 32em; }
        .outlive code { font-family: var(--sans); background: rgba(247,249,244,.1); padding: 2px 7px; border-radius: 6px; color: var(--paper); font-variant-numeric: tabular-nums; }

        .who-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 36px; }
        .who-grid div { border-top: 3px solid var(--pine); padding-top: 20px; display: grid; gap: 10px; align-content: start; }

        .price { display: grid; grid-template-columns: 1fr 1.15fr 1fr; border: 1px solid var(--line); border-radius: 28px; background: var(--paper); overflow: hidden; }
        .price-col { padding: 36px; display: grid; gap: 12px; align-content: start; }
        .price-col + .price-col { border-left: 1px solid var(--line); }
        .price-col.featured { background: var(--lichen); }
        .price-col .btn { justify-self: start; margin-top: 8px; }
        .price-n { font-family: var(--serif); font-size: 2.6rem; line-height: 1; color: var(--pine); }
        .price-n span { display: block; margin-top: 8px; font-family: var(--sans); font-size: 1rem; color: var(--moss); }

        .faq-wrap h2 { margin-bottom: 28px; }

        .final { padding-top: 140px; }
        .final-arch { border: 2px solid var(--pine); border-radius: 999px 999px 32px 32px / 260px 260px 32px 32px; padding: 110px 32px 72px; display: grid; justify-items: center; text-align: center; gap: 26px; }
        .final-arch h2 { max-width: 14em; }

        @media (max-width: 900px) {
          .hero-copy, .how, .outlive-in { grid-template-columns: 1fr; gap: 28px; }
          .how-head { position: static; }
          .clips, .who-grid { grid-template-columns: 1fr; }
          .price { grid-template-columns: 1fr; }
          .price-col + .price-col { border-left: 0; border-top: 1px solid var(--line); }
          .hero-window { border-radius: 50% 50% 18px 18px / 22% 22% 18px 18px; margin-top: 36px; }
          .assure { justify-content: flex-start; gap: 14px; flex-direction: column; }
          .how-list li { grid-template-columns: 2rem 1fr; }
          .how-n { font-size: 1.6rem; }
          .how-icon { display: none; }
          .outlive { border-radius: 48px 48px 0 0; padding: 72px 0; }
          .outlive-art { width: 100%; }
          .final-arch { padding: 72px 20px 48px; border-radius: 160px 160px 24px 24px; }
          .block, .how { padding-top: 96px; }
        }
      ` }} />
    </>
  );
}

function Check() {
  return <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="10" fill="var(--marigold)" /><path d="M6 10.5l2.6 2.6L14 7.5" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
