import { GateState } from '@/lib/circuit';

/** Small, stateful gate illustration used across the site and app. */
export function MiniGate({ state, progress = 1, size = 260, coins = true }: { state: GateState; progress?: number; size?: number; coins?: boolean }) {
  const open = state >= 2;
  const dim = state === 1;
  const done = state === 3;
  const doorScale = open ? 0.16 : 1;
  const ring = 2 * Math.PI * 34;
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 300 336" className="minigate" aria-hidden="true">
      <defs>
        <clipPath id="mg-inside"><path d="M62 300V150a88 88 0 0 1 176 0v150z" /></clipPath>
      </defs>
      <ellipse cx="150" cy="306" rx="130" ry="14" fill="#c9d3c3" />
      <g clipPath="url(#mg-inside)">
        <rect x="40" y="40" width="220" height="280" fill={open ? '#f8d58f' : '#dfe6d9'} style={{ transition: 'fill .6s' }} />
        {coins && !done && [0, 1, 2, 3, 4].map(i => (
          <circle key={i} cx={104 + i * 23} cy={286 - (i % 2) * 16} r="12" fill="#efa62b" stroke="#f8d58f" strokeWidth="3" />
        ))}
        <g style={{ transform: `scaleX(${doorScale})`, transformOrigin: '62px 0', transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }}>
          {[0, 1, 2].map(i => <rect key={i} x={70 + i * 26} y="120" width="7" height="190" rx="3.5" fill="#173d31" />)}
          <rect x="62" y="150" width="88" height="8" rx="4" fill="#173d31" />
          <rect x="62" y="262" width="88" height="8" rx="4" fill="#173d31" />
        </g>
        <g style={{ transform: `scaleX(${doorScale})`, transformOrigin: '238px 0', transition: 'transform .9s cubic-bezier(.2,.8,.2,1)' }}>
          {[0, 1, 2].map(i => <rect key={i} x={160 + i * 26} y="120" width="7" height="190" rx="3.5" fill="#173d31" />)}
          <rect x="150" y="150" width="88" height="8" rx="4" fill="#173d31" />
          <rect x="150" y="262" width="88" height="8" rx="4" fill="#173d31" />
        </g>
      </g>
      <path d="M62 300V150a88 88 0 0 1 176 0v150" fill="none" stroke="#173d31" strokeWidth="13" strokeLinejoin="round" />
      <path d="M112 300v26M188 300v26" stroke="#173d31" strokeWidth="13" strokeLinecap="round" />
      {/* sun = inversion bubble, with check-in progress ring */}
      <g transform="translate(150 30)">
        <circle r="34" fill="none" stroke="#c9d3c3" strokeWidth="5" />
        <circle r="34" fill="none" stroke={dim ? '#d4552f' : '#efa62b'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={ring} strokeDashoffset={ring * (1 - progress)} transform="rotate(-90)" style={{ transition: 'stroke-dashoffset .8s, stroke .4s' }} />
        <circle r="24" fill={dim ? '#b9c2b3' : '#efa62b'} style={{ transition: 'fill .5s' }} />
      </g>
      {dim && (
        <g transform="translate(244 96)" className="mg-bell">
          <path d="M-12 7c0-15 4-23 12-23s12 8 12 23z" fill="#d4552f" />
          <rect x="-15" y="6" width="30" height="6" rx="3" fill="#d4552f" />
          <circle cy="16" r="4" fill="#d4552f" />
        </g>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .mg-bell { animation: mgring 1.4s ease-in-out infinite; transform-origin: 244px 80px; }
        @keyframes mgring { 0%,60%,100% { transform: translate(244px,96px) rotate(0) } 70% { transform: translate(244px,96px) rotate(14deg) } 80% { transform: translate(244px,96px) rotate(-12deg) } 90% { transform: translate(244px,96px) rotate(6deg) } }
      ` }} />
    </svg>
  );
}
