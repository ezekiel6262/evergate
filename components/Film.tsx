'use client';
/* Evergate commercial film. Pure function of time t (seconds, 0..FILM_LENGTH).
   Rendered live on the site and captured frame by frame to a 4K MP4. */

import React from 'react';

export const FILM_LENGTH = 32;

const C = {
  lichen: '#e6ebe1', paper: '#f7f9f4', pine: '#173d31', pineDeep: '#0f2b22', night: '#132e27',
  ink: '#10231d', moss: '#5d7c58', mossSoft: '#9fb39a', line: '#c9d3c3', sun: '#efa62b', sunSoft: '#f8d58f',
  lilac: '#c6b5f0', lilacDeep: '#7d64c9', skin1: '#8a5a3c', skin2: '#e0b08a', skin3: '#c48a62', skin4: '#6b4330', alert: '#d4552f',
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x: number) => 1 - Math.pow(1 - x, 3);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const vis = (t: number, a: number, b: number, f = 0.6) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));
const back = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/* ---------- Characters ---------- */
type PersonProps = {
  x: number; y: number; s?: number; skin: string; shirt: string; hair: 'bun' | 'short' | 'curly' | 'bob' | 'cap';
  hairColor?: string; pose?: 'stand' | 'phone' | 'wave' | 'cheer'; blink?: boolean; flip?: boolean; seated?: boolean; armT?: number;
};
function Person({ x, y, s = 1, skin, shirt, hair, hairColor = C.ink, pose = 'stand', blink = false, flip = false, seated = false, armT = 0 }: PersonProps) {
  const eye = blink ? <g stroke={C.ink} strokeWidth={4} strokeLinecap="round"><path d="M-18 -306h10M8 -306h10" /></g>
    : <g fill={C.ink}><circle cx={-13} cy={-306} r={5} /><circle cx={13} cy={-306} r={5} /></g>;
  const hairEl = {
    bun: <g fill={hairColor}><circle cx={0} cy={-366} r={22} /><path d="M-50 -300a50 52 0 0 1 100 0c-8-26-26-38-50-38s-42 12-50 38z" /></g>,
    short: <path fill={hairColor} d="M-50 -296a50 52 0 0 1 100 0c-14-22-30-30-50-30s-36 8-50 30z" />,
    curly: <g fill={hairColor}>{[-42, -24, -6, 12, 30, 44].map((cx, i) => <circle key={i} cx={cx} cy={-338 + (i % 2) * 6} r={18} />)}</g>,
    bob: <path fill={hairColor} d="M-54 -270v-30a54 56 0 0 1 108 0v30c-6 0-10-4-10-10v-22c-14-14-30-20-44-20s-30 6-44 20v22c0 6-4 10-10 10z" />,
    cap: <g><path fill={C.pine} d="M-50 -312a50 46 0 0 1 100 0z" /><rect x={30} y={-318} width={36} height={10} rx={5} fill={C.pine} /></g>,
  }[hair];
  const shoulderY = -232;
  let armL = `M-48 ${shoulderY} q-24 60 -10 118`;
  let armR = `M48 ${shoulderY} q24 60 10 118`;
  let phone: React.ReactNode = null;
  if (pose === 'phone') {
    armR = `M48 ${shoulderY} q30 50 -10 72`;
    phone = <g transform="translate(-24 -186) rotate(-12)"><rect width={40} height={64} rx={8} fill={C.ink} /><rect x={4} y={6} width={32} height={46} rx={4} fill={armT > 0 ? C.sun : C.mossSoft} opacity={0.6 + armT * 0.4} /></g>;
  }
  if (pose === 'wave') armR = `M48 ${shoulderY} q50 ${-40 - Math.sin(armT * 6) * 20} 40 -110`;
  if (pose === 'cheer') { armL = `M-48 ${shoulderY} q-40 -50 -30 -110`; armR = `M48 ${shoulderY} q40 -50 30 -110`; }
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {!seated && <g fill={C.pineDeep}><rect x={-34} y={-112} width={28} height={112} rx={14} /><rect x={6} y={-112} width={28} height={112} rx={14} /></g>}
      <rect x={-56} y={-258} width={112} height={160} rx={50} fill={shirt} />
      <path d={armL} stroke={shirt} strokeWidth={26} strokeLinecap="round" fill="none" />
      <path d={armR} stroke={shirt} strokeWidth={26} strokeLinecap="round" fill="none" />
      {phone}
      <circle cx={0} cy={-300} r={50} fill={skin} />
      {hairEl}
      {eye}
      <path d="M-12 -280q12 10 24 0" stroke={C.ink} strokeWidth={4} strokeLinecap="round" fill="none" />
    </g>
  );
}

function Coin({ x, y, r = 26, o = 1 }: { x: number; y: number; r?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={o}>
      <circle r={r} fill={C.sun} />
      <circle r={r * 0.68} fill="none" stroke={C.sunSoft} strokeWidth={r * 0.14} />
      <path d={`M${-r * 0.18} ${-r * 0.3}v${r * 0.6}M${r * 0.18} ${-r * 0.3}v${r * 0.6}`} stroke="#c97f12" strokeWidth={r * 0.12} strokeLinecap="round" />
    </g>
  );
}

/* ---------- The gate ---------- */
const GX = 960, GY = 860, GW = 420, GH = 380; // ground center, width, post height
function Gate({ draw = 1, open = 0, sun = 1, sunGrey = 0, glow = 0 }: { draw?: number; open?: number; sun?: number; sunGrey?: number; glow?: number }) {
  const r = GW / 2, left = GX - r, right = GX + r, topY = GY - GH;
  const arch = `M${left} ${GY} V${topY} A${r} ${r} 0 0 1 ${right} ${topY} V${GY}`;
  const len = GH * 2 + Math.PI * r;
  const doorW = r - 14;
  const bars = (w: number) => Array.from({ length: 5 }, (_, i) => 16 + i * ((w - 32) / 4));
  const sunColor = sunGrey > 0 ? `rgb(${lerp(239, 170, sunGrey)},${lerp(166, 178, sunGrey)},${lerp(43, 165, sunGrey)})` : C.sun;
  return (
    <g>
      {glow > 0 && <path d={`M${left + 10} ${GY} V${topY} A${r - 10} ${r - 10} 0 0 1 ${right - 10} ${topY} V${GY}z`} fill={C.sunSoft} opacity={glow} />}
      {/* doors swing from posts */}
      <g opacity={seg(draw, 0.6, 1)}>
        <g transform={`translate(${left + 8} 0) scale(${1 - open * 0.86} 1)`}>
          <rect x={0} y={topY + 40} width={doorW} height={GH - 40} fill={C.pine} opacity={0.12} />
          {bars(doorW).map((bx, i) => <rect key={i} x={bx} y={topY + 40} width={10} height={GH - 40} rx={5} fill={C.pine} />)}
          <rect x={0} y={topY + 70} width={doorW} height={12} rx={6} fill={C.pine} />
          <rect x={0} y={GY - 90} width={doorW} height={12} rx={6} fill={C.pine} />
        </g>
        <g transform={`translate(${right - 8} 0) scale(${-(1 - open * 0.86)} 1)`}>
          <rect x={0} y={topY + 40} width={doorW} height={GH - 40} fill={C.pine} opacity={0.12} />
          {bars(doorW).map((bx, i) => <rect key={i} x={bx} y={topY + 40} width={10} height={GH - 40} rx={5} fill={C.pine} />)}
          <rect x={0} y={topY + 70} width={doorW} height={12} rx={6} fill={C.pine} />
          <rect x={0} y={GY - 90} width={doorW} height={12} rx={6} fill={C.pine} />
        </g>
      </g>
      <path d={arch} fill="none" stroke={C.pine} strokeWidth={26} strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
      {/* legs = the gate's two inputs */}
      <path d={`M${GX - 90} ${GY} v60 M${GX + 90} ${GY} v60`} stroke={C.pine} strokeWidth={26} strokeLinecap="round" opacity={seg(draw, 0.8, 1)} />
      {/* the inversion bubble, rendered as the sun */}
      <g transform={`translate(${GX} ${topY - r - 44}) scale(${sun})`}>
        <circle r={58 + glow * 30} fill={C.sunSoft} opacity={0.35 * (1 - sunGrey)} />
        <circle r={38} fill={sunColor} />
      </g>
    </g>
  );
}

function Caption({ t, a, b, text, light = false, sub }: { t: number; a: number; b: number; text: string; light?: boolean; sub?: string }) {
  const o = vis(t, a, b, 0.5);
  const dy = (1 - out(seg(t, a, a + 0.8))) * 24;
  return (
    <g opacity={o} transform={`translate(120 ${985 + dy})`}>
      <text fontFamily="Young Serif, Georgia, serif" fontSize={58} fill={light ? C.paper : C.ink}>{text}</text>
      {sub && <text y={50} fontFamily="Onest Variable, system-ui, sans-serif" fontSize={30} fill={light ? C.mossSoft : C.moss}>{sub}</text>}
    </g>
  );
}

function Hill({ color, d }: { color: string; d: string }) { return <path d={d} fill={color} />; }

/* ---------- Scenes ---------- */
function SceneNight({ t }: { t: number }) {
  const o = vis(t, 0, 5.4, 0.01);
  if (o <= 0) return null;
  const push = 1 + seg(t, 0, 5.4) * 0.06;
  const paperFloat = Math.sin(t * 1.6) * 8;
  return (
    <g opacity={o} transform={`translate(960 540) scale(${push}) translate(-960 -540)`}>
      <rect width={1920} height={1080} fill={C.night} />
      {/* window + moon */}
      <rect x={1220} y={150} width={420} height={460} rx={210} fill="#1d4236" />
      <path d="M1430 150v460M1220 380h420" stroke={C.night} strokeWidth={14} />
      <circle cx={1530} cy={260} r={48} fill={C.paper} opacity={0.9} />
      <circle cx={1552} cy={248} r={44} fill="#1d4236" />
      {[[1290, 220], [1350, 300], [1600, 470], [1300, 520], [1480, 430]].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={4} fill={C.paper} opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))} />
      ))}
      {/* desk */}
      <rect x={300} y={720} width={1000} height={34} rx={12} fill={C.pineDeep} />
      <rect x={360} y={754} width={28} height={240} fill={C.pineDeep} />
      <rect x={1210} y={754} width={28} height={240} fill={C.pineDeep} />
      {/* Ada seated, lit by laptop */}
      <Person x={760} y={800} skin={C.skin1} shirt="#2b6150" hair="bun" seated blink={Math.floor(t * 10) % 31 === 0} />
      {/* laptop seen from behind, screen glow on her face */}
      <ellipse cx={760} cy={540} rx={230} ry={190} fill={C.sunSoft} opacity={0.1 + 0.03 * Math.sin(t * 3)} />
      <path d="M640 720l18 -96h204l18 96z" fill={C.ink} />
      <circle cx={760} cy={668} r={12} fill={C.moss} opacity={0.6} />
      <rect x={600} y={714} width={320} height={10} rx={5} fill={C.ink} />
      {/* the paper seed phrase */}
      <g transform={`translate(1000 ${520 + paperFloat}) rotate(${-6 + Math.sin(t) * 2})`} opacity={seg(t, 0.8, 1.6)}>
        <rect width={200} height={240} rx={10} fill={C.paper} />
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x={24} y={30 + i * 24} width={70 + ((i * 37) % 80)} height={10} rx={5} fill={C.line} />)}
        <circle cx={168} cy={30} r={12} fill={C.alert} opacity={0.8} />
      </g>
      <g opacity={vis(t, 1.2, 5.4, 0.6)} transform={`translate(190 ${320 + (1 - out(seg(t, 1.2, 2))) * 20})`}>
        <text fontFamily="Young Serif, Georgia, serif" fontSize={74} fill={C.paper}>What happens to your crypto</text>
        <text y={92} fontFamily="Young Serif, Georgia, serif" fontSize={74} fill={C.paper}>when you are gone?</text>
      </g>
    </g>
  );
}

function SceneDay({ t }: { t: number }) {
  // 5 .. 28.6 continuous daylight world with the gate
  const o = vis(t, 5, 28.6, 0.6);
  if (o <= 0) return null;
  const draw = ease(seg(t, 5.4, 7.2));
  // check-in pulses 11-17
  const pulses = [12.2, 13.9, 15.6];
  const pulse = pulses.reduce((acc, p) => Math.max(acc, Math.max(0, 1 - Math.abs(t - p) / 0.45)), 0);
  const adaOut = seg(t, 17.2, 18.2);
  const sunGrey = seg(t, 18, 19.8) * (1 - seg(t, 23.4, 24.4));
  const open = ease(seg(t, 23.6, 25.2));
  const glow = seg(t, 23.6, 25) * (1 - seg(t, 27.6, 28.6) * 0.3) + pulse * 0.5;
  const sky = sunGrey > 0 ? `rgb(${lerp(230, 214, sunGrey)},${lerp(235, 221, sunGrey)},${lerp(225, 222, sunGrey)})` : C.lichen;
  // months strip
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const mIdx = Math.floor(lerp(0, 9.99, seg(t, 11, 22.5)));

  return (
    <g opacity={o}>
      <rect width={1920} height={1080} fill={sky} />
      <Hill color="#d6dfd1" d="M0 760 C 300 680, 600 700, 900 740 S 1500 700, 1920 730 V1080 H0z" />
      <Hill color="#c5d2bf" d="M0 840 C 400 800, 800 820, 1100 850 S 1600 820, 1920 840 V1080 H0z" />
      <rect y={GY} width={1920} height={220} fill="#b6c6ae" />
      {/* little trees */}
      {[[230, 800, 1], [1700, 790, 1.2], [1820, 820, .8], [120, 830, .8]].map(([tx, ty, ts], i) => (
        <g key={i} transform={`translate(${tx} ${ty}) scale(${ts})`}><rect x={-6} y={-10} width={12} height={60} fill={C.moss} /><circle cy={-50} r={50} fill={C.moss} /><circle cx={-24} cy={-26} r={34} fill="#6f8f69" /></g>
      ))}

      {/* months / check-in strip */}
      <g opacity={vis(t, 11, 23, 0.6)} transform="translate(560 90)">
        {months.map((m, i) => {
          const x = i * 82;
          const isCheck = [1, 4, 7].includes(i) && i <= mIdx;
          const missed = i >= 8 && i <= mIdx;
          return (
            <g key={m} transform={`translate(${x} 0)`} opacity={i <= mIdx ? 1 : 0.3}>
              <text x={30} y={0} textAnchor="middle" fontFamily="Onest Variable, system-ui" fontSize={24} fill={C.moss}>{m}</text>
              <circle cx={30} cy={34} r={14} fill={isCheck ? C.sun : missed ? 'none' : C.line} stroke={missed ? C.alert : 'none'} strokeWidth={4} />
            </g>
          );
        })}
      </g>

      <Gate draw={draw} open={open} sun={back(seg(t, 6.6, 7.4)) * (1 + pulse * 0.25)} sunGrey={sunGrey} glow={glow} />

      {/* coins into the gate, 7.4-9.6 */}
      {Array.from({ length: 7 }, (_, i) => {
        const p = ease(seg(t, 7.4 + i * 0.22, 8.6 + i * 0.22));
        if (p <= 0 || p >= 1 || t > 11) return null;
        const x = lerp(520, GX + (i - 3) * 30, p);
        const y = lerp(640, GY - 120, p) - Math.sin(p * Math.PI) * 260;
        return <Coin key={i} x={x} y={y} />;
      })}
      {/* coins resting in the gate */}
      <g opacity={seg(t, 8.4, 9.4) * (1 - seg(t, 24.4, 25))}>
        {[-60, -20, 20, 60, -40, 0, 40].map((dx, i) => <Coin key={i} x={GX + dx} y={GY - 30 - (i > 3 ? 40 : 0)} r={24} />)}
      </g>

      {/* Ada */}
      <g opacity={1 - adaOut} transform={`translate(${-adaOut * 60} 0)`}>
        <Person x={430} y={GY} skin={C.skin1} shirt={C.pine} hair="bun" pose={t > 11 && t < 17.2 ? 'phone' : t < 9.5 ? 'wave' : 'stand'} armT={pulse} blink={Math.floor(t * 10) % 27 === 0} />
        {pulse > 0 && <g transform="translate(470 560)" opacity={pulse}><circle r={30 + (1 - pulse) * 60} fill="none" stroke={C.sun} strokeWidth={6} /><text x={56} y={10} fontFamily="Onest Variable, system-ui" fontSize={30} fontWeight={600} fill={C.ink}>I'm here</text></g>}
      </g>
      {/* empty spot where Ada was, a dropped phone */}
      <g opacity={seg(t, 18, 19) * (1 - seg(t, 27.8, 28.6))}><rect x={410} y={GY - 10} width={56} height={14} rx={6} fill={C.ink} /></g>

      {/* heirs on the right, appear at 9 */}
      {(() => {
        const a = out(seg(t, 9, 10)) * (1 - seg(t, 16.6, 17.4)) + out(seg(t, 24.6, 25.6));
        const cheer = t > 26;
        return (
          <g opacity={clamp(a)}>
            <Person x={1420} y={GY} s={0.92} skin={C.skin2} shirt={C.lilac} hair="short" hairColor="#5a3b2a" pose={cheer ? 'cheer' : 'stand'} />
            <Person x={1600} y={GY} s={0.78} skin={C.skin3} shirt={C.sun} hair="bob" hairColor={C.ink} pose={cheer ? 'cheer' : 'wave'} armT={t} />
            <g opacity={seg(t, 9.6, 10.4) * (1 - seg(t, 16.6, 17.4)) + seg(t, 26.2, 26.8)}>
              <text x={1420} y={GY + 70} textAnchor="middle" fontFamily="Onest Variable, system-ui" fontSize={30} fontWeight={600} fill={C.ink}>Theo 60%</text>
              <text x={1600} y={GY + 70} textAnchor="middle" fontFamily="Onest Variable, system-ui" fontSize={30} fontWeight={600} fill={C.ink}>June 40%</text>
            </g>
          </g>
        );
      })()}

      {/* guardians: appear 9.8 small at the right, return in scene 4 */}
      {(() => {
        const a = clamp(out(seg(t, 9.8, 10.8)) * (1 - seg(t, 11, 11.6)) + out(seg(t, 18.2, 19)) * (1 - seg(t, 23.2, 23.8)));
        const gs = [
          { x: 1380, skin: C.skin4, shirt: C.moss, hair: 'cap' as const, ok: 20.6 },
          { x: 1560, skin: C.skin2, shirt: '#7c9a76', hair: 'bob' as const, ok: 21.4 },
          { x: 1740, skin: C.skin3, shirt: C.mossSoft, hair: 'curly' as const, ok: 99 },
        ];
        return (
          <g opacity={a}>
            {gs.map((g, i) => (
              <g key={i}>
                <Person x={g.x} y={GY} s={0.66} skin={g.skin} shirt={g.shirt} hair={g.hair} hairColor={C.ink} />
                {/* shield badge */}
                <g transform={`translate(${g.x} ${GY - 300})`}>
                  <path d="M0 -26l22 8v14c0 16-10 26-22 32c-12-6-22-16-22-32v-14z" fill={C.pine} />
                  {t > g.ok && <path d="M-9 2l6 7 12-14" stroke={C.sun} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={seg(t, g.ok, g.ok + 0.3)} />}
                </g>
                {/* incoming alert bell */}
                {(() => {
                  const p = ease(seg(t, 19.2 + i * 0.25, 20.2 + i * 0.25));
                  if (p <= 0 || p >= 1) return null;
                  const bx = lerp(GX, g.x, p), by = lerp(GY - GH - 60, GY - 380, p) - Math.sin(p * Math.PI) * 140;
                  return <g transform={`translate(${bx} ${by})`}><path d="M-18 10c0-22 6-34 18-34s18 12 18 34z" fill={C.sun} /><rect x={-22} y={8} width={44} height={8} rx={4} fill={C.sun} /><circle cy={22} r={6} fill={C.sun} /></g>;
                })()}
              </g>
            ))}
            <g opacity={seg(t, 21.6, 22.2) * (1 - seg(t, 23.2, 23.8))} transform="translate(1560 360)">
              <text textAnchor="middle" fontFamily="Onest Variable, system-ui" fontSize={30} fontWeight={600} fill={C.ink}>2 of 3 approved</text>
            </g>
          </g>
        );
      })()}

      {/* hourglass during the wait */}
      <g opacity={seg(t, 21.8, 22.3) * (1 - seg(t, 23.4, 23.9))} transform={`translate(${GX - 380} 600) scale(1.3) rotate(${ease(seg(t, 22.4, 23.2)) * 180})`}>
        <path d="M-34 -50h68M-34 50h68M-26 -50c0 30 26 34 26 50c0 16-26 20-26 50M26 -50c0 30-26 34-26 50c0 16 26 20 26 50" stroke={C.pine} strokeWidth={8} fill="none" strokeLinecap="round" />
        <path d="M-14 36h28l-14-18z" fill={C.sun} />
      </g>

      {/* payout 25-27.6: coins split to heirs */}
      {Array.from({ length: 10 }, (_, i) => {
        const toTheo = i < 6;
        const p = ease(seg(t, 25 + i * 0.16, 26 + i * 0.16));
        if (p <= 0 || p >= 1) return null;
        const tx = toTheo ? 1420 : 1600, ty = GY - 240;
        const x = lerp(GX, tx, p), y = lerp(GY - 80, ty, p) - Math.sin(p * Math.PI) * 200;
        return <Coin key={i} x={x} y={y} r={22} />;
      })}

      <Caption t={t} a={5.6} b={10.9} text="Set the rule once." sub="Who inherits, who guards, and how long to wait." />
      <Caption t={t} a={11} b={17} text="Check in now and then." sub="One tap. Life goes on, and nothing can move without you." />
      <Caption t={t} a={17.2} b={23.4} text="Miss your check-ins, and guardians are alerted." sub="Nothing moves yet. There is always a waiting period." />
      <Caption t={t} a={23.6} b={28.6} text="Then the gate opens, exactly as you wrote it." sub="The rule is a circuit on X Layer. Nobody can change it." />
    </g>
  );
}

function SceneEnd({ t }: { t: number }) {
  const o = seg(t, 28.2, 28.9);
  if (o <= 0) return null;
  const d = ease(seg(t, 28.6, 30));
  const sunUp = out(seg(t, 29.4, 30.4));
  const words = seg(t, 30, 30.8);
  const len = 120;
  return (
    <g opacity={o}>
      <rect width={1920} height={1080} fill={C.pine} />
      <g transform="translate(960 470) scale(9) translate(-16 -20)">
        <circle cx={16} cy={lerp(14, 4.6, sunUp)} r={3.6 * sunUp} fill={C.sun} />
        <path d="M5.5 27.5V19.5a10.5 10.5 0 0 1 21 0v8z" stroke={C.paper} strokeWidth={2.6} strokeLinejoin="round" fill="none" strokeDasharray={len} strokeDashoffset={len * (1 - d)} />
        <path d="M11 27.5v8M21 27.5v8" stroke={C.paper} strokeWidth={2.6} strokeLinecap="round" opacity={seg(t, 29.6, 30)} />
      </g>
      <g opacity={words} transform={`translate(960 ${790 + (1 - out(words)) * 20})`}>
        <text textAnchor="middle" fontFamily="Young Serif, Georgia, serif" fontSize={110} fill={C.paper}>Evergate</text>
        <text y={76} textAnchor="middle" fontFamily="Onest Variable, system-ui" fontSize={38} fill={C.sunSoft}>A rule that outlives us.</text>
      </g>
      <text x={960} y={1020} textAnchor="middle" fontFamily="Onest Variable, system-ui" fontSize={26} fill={C.mossSoft} opacity={seg(t, 30.6, 31.2)}>Built with TapeOut circuits on X Layer</text>
    </g>
  );
}

export function Film({ t, className, style, slice = false }: { t: number; className?: string; style?: React.CSSProperties; slice?: boolean }) {
  const tt = clamp(t, 0, FILM_LENGTH);
  return (
    <svg viewBox="0 0 1920 1080" preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'} className={className} style={style} role="img" aria-label="Evergate film: Ada sets a rule, checks in, and her heirs receive their shares when the gate opens">
      <rect width={1920} height={1080} fill={C.lichen} />
      <SceneDay t={tt} />
      <SceneNight t={tt} />
      <SceneEnd t={tt} />
    </svg>
  );
}
