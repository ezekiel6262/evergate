import { checkInPhrase, spell, waitPhrase } from '@/lib/cadence';
import { Heir, Vault } from '@/lib/store';

export function RulePlain({ v }: { v: Pick<Vault, 'intervalDays' | 'missesAllowed' | 'quorum' | 'waitDays' | 'guardians' | 'heirs'> }) {
  const heirs = v.heirs.map(h => `${h.name || 'an heir'} ${h.bps / 100}%`).join(' and ');
  const quiet = spell(v.intervalDays * v.missesAllowed);
  return (
    <ol className="rule-plain">
      <li>Check in <b>{checkInPhrase(v.intervalDays)}</b>.</li>
      <li>If <b>{v.missesAllowed}</b> check-ins in a row are missed, about <b>{quiet}</b> of silence, alert the guardians and heirs and start a wait of <b>{waitPhrase(v.waitDays)}</b>.</li>
      <li>A check-in at any point before release cancels the alert.</li>
      <li>Release only when <b>{v.quorum} of {v.guardians.length}</b> guardians approve and the wait is over.</li>
      <li>Then pay {heirs || 'the heirs'} from every asset in the gate.</li>
      <style dangerouslySetInnerHTML={{ __html: `
        .rule-plain { margin: 0; padding: 0 0 0 1.3em; display: grid; gap: 8px; }
        .rule-plain li::marker { color: var(--moss); font-weight: 600; }
      ` }} />
    </ol>
  );
}

export function ShareBar({ heirs }: { heirs: Heir[] }) {
  const colors = ['var(--lilac)', 'var(--marigold-soft)', 'var(--moss-soft)', '#b9d0e6'];
  return (
    <div className="sharebar" role="img" aria-label={heirs.map(h => `${h.name} ${h.bps / 100} percent`).join(', ')}>
      {heirs.map((h, i) => (
        <span key={i} style={{ flex: h.bps, background: colors[i % colors.length] }}>{h.bps >= 1200 ? `${h.name} ${h.bps / 100}%` : ''}</span>
      ))}
      <style dangerouslySetInnerHTML={{ __html: `
        .sharebar { display: flex; height: 40px; border-radius: 999px; overflow: hidden; gap: 3px; }
        .sharebar span { display: flex; align-items: center; padding: 0 14px; font-weight: 600; font-size: .9rem; color: var(--ink); white-space: nowrap; overflow: hidden; transition: flex .4s var(--ease); }
      ` }} />
    </div>
  );
}
