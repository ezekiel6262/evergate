const faqs = [
  { q: 'Is Evergate a will?', a: 'No. It moves crypto according to a rule you set. Use it alongside a will, and have your will point to your gate’s public page so your executor knows it exists.' },
  { q: 'What if I lose my phone or forget to check in?', a: 'Missing check-ins never pays anyone out directly. It only alerts your guardians and starts a waiting period, and you can cancel at any time during it with one check-in. Reminders arrive by app, email and TapeSend before every deadline.' },
  { q: 'Could my guardians team up and take the money?', a: 'They cannot take it, only approve its release to the heirs you named. Even then, it needs your missed check-ins, their quorum and the full waiting period, and you are alerted on every channel the moment the gate goes to alert.' },
  { q: 'What happens if Evergate shuts down?', a: 'Your gate keeps working. The rule is a circuit on X Layer, the assets sit in that circuit’s own wallet, and your heirs’ page is served from the chain. Anyone can run the final step, not just us.' },
  { q: 'Which assets can I put in a gate?', a: 'OKB, USDT0 and standard tokens on X Layer. Each heir receives their percentage of every asset in the gate.' },
  { q: 'Do my heirs need to know crypto?', a: 'No. Their page walks them through creating a wallet and claiming, step by step, in plain language.' },
];

export function Faq() {
  return (
    <div className="faq">
      {faqs.map(f => (
        <details key={f.q}>
          <summary>{f.q}<span aria-hidden /></summary>
          <p>{f.a}</p>
        </details>
      ))}
      <style dangerouslySetInnerHTML={{ __html: `
        .faq { border-top: 1px solid var(--line); max-width: 860px; }
        .faq details { border-bottom: 1px solid var(--line); }
        .faq summary { list-style: none; cursor: pointer; padding: 22px 44px 22px 0; font-family: var(--serif); font-size: 1.3rem; position: relative; }
        .faq summary::-webkit-details-marker { display: none; }
        .faq summary span { position: absolute; right: 6px; top: 50%; width: 18px; height: 18px; transform: translateY(-50%); }
        .faq summary span::before, .faq summary span::after { content: ''; position: absolute; left: 0; right: 0; top: 8px; height: 2px; background: var(--pine); border-radius: 2px; transition: transform .25s var(--ease); }
        .faq summary span::after { transform: rotate(90deg); }
        .faq details[open] summary span::after { transform: rotate(0); }
        .faq details p { padding: 0 0 24px; color: var(--moss); max-width: 40em; }
      ` }} />
    </div>
  );
}
