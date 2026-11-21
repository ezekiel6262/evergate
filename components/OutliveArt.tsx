/* The gate, annotated: where each piece of a family's plan lives. */
export function OutliveArt() {
  const tag = { fontFamily: 'Onest Variable, system-ui', fontSize: 15, fill: '#d6e0d1' } as const;
  return (
    <svg viewBox="0 0 440 360" className="outlive-art" role="img" aria-label="The gate: the sun is the rule, the inside holds the wallet, the base carries the public page">
      <circle cx="160" cy="44" r="26" fill="#efa62b" />
      <circle cx="160" cy="44" r="40" fill="none" stroke="#efa62b" strokeOpacity=".35" strokeWidth="2" />
      <path d="M70 300V170a90 90 0 0 1 180 0v130" fill="none" stroke="#f7f9f4" strokeWidth="12" strokeLinejoin="round" />
      <path d="M120 300v40M200 300v40" stroke="#f7f9f4" strokeWidth="12" strokeLinecap="round" />
      {[0, 1, 2, 3].map(i => <circle key={i} cx={118 + i * 28} cy={276 - (i % 2) * 14} r="11" fill="#efa62b" stroke="#f8d58f" strokeWidth="3" />)}
      <path d="M70 300h180" stroke="#f7f9f4" strokeWidth="12" strokeLinecap="round" />
      <g stroke="#9fb39a" strokeWidth="1.5" strokeDasharray="3 4" fill="none">
        <path d="M200 44h70" /><path d="M230 262h40" /><path d="M250 330h20" />
      </g>
      <text x="280" y="40" {...tag}>The rule</text><text x="280" y="60" {...tag} fill="#9fb39a">circuit 2.311.9</text>
      <text x="280" y="258" {...tag}>The money</text><text x="280" y="278" {...tag} fill="#9fb39a">the gate&apos;s own wallet</text>
      <text x="280" y="326" {...tag}>The page</text><text x="280" y="346" {...tag} fill="#9fb39a">tape://2.311.9/ada</text>
      <style dangerouslySetInnerHTML={{ __html: `.outlive-art { width: min(400px, 100%); margin-top: 36px; }` }} />
    </svg>
  );
}
