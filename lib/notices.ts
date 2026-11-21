// Plain-language TapeSend texts. The keeper does not send them.
// TapeSend is written by the holder of an opened circuit, and the text is
// encrypted on that holder's device before it is stored. A watcher sends
// these while Evergate is running. The rule still pays if the watcher is gone.

export type Audience = 'owner' | 'guardian' | 'heir';
export type NoticeKind = 'welcome' | 'reminder' | 'alerted' | 'claimable';

export type Notice = {
  audience: Audience;
  who: string;
  kind: NoticeKind;
  text: string;
};

export type GateMail = {
  owner: string;
  page: string;
  missesAllowed: number;
  checkIn: string;
  wait: string;
  guardians: string[];
  heirs: string[];
};

const rule = (page: string) => `The rule page is ${page}.`;

/** Sent once, when the gate is created. */
export function welcome(mail: GateMail): Notice[] {
  return mail.guardians.map(who => ({
    audience: 'guardian',
    who,
    kind: 'welcome',
    text: `${mail.owner} named you a guardian. You do nothing while they check in. If they miss ${mail.missesAllowed} check-ins, you will be asked to look in on them before anything can be paid. ${rule(mail.page)}`,
  }));
}

/** Sent to the owner before a check-in is due. Missing one does not pay anyone. */
export function reminder(mail: GateMail): Notice[] {
  return [{
    audience: 'owner',
    who: mail.owner,
    kind: 'reminder',
    text: `${mail.owner}, check in ${mail.checkIn}. Missing a check-in does not pay anyone. It only counts toward an alert.`,
  }];
}

/** Sent when the rule raises an alert. Guardians and heirs, once. */
export function alerted(mail: GateMail): Notice[] {
  const text = `${mail.owner} has missed ${mail.missesAllowed} check-ins. Nothing has been paid. A wait of ${mail.wait} has started, and ${mail.owner} can still cancel it by checking in. ${rule(mail.page)}`;
  return [
    ...mail.guardians.map(who => ({ audience: 'guardian' as const, who, kind: 'alerted' as const, text })),
    ...mail.heirs.map(who => ({ audience: 'heir' as const, who, kind: 'alerted' as const, text })),
  ];
}

/** Sent when the gate becomes ready for heirs. Heirs only, once. */
export function claimable(mail: GateMail): Notice[] {
  const text = `The guardians agreed and the wait is over. ${mail.owner}'s gate is ready for you to claim your share. ${rule(mail.page)}`;
  return mail.heirs.map(who => ({
    audience: 'heir',
    who,
    kind: 'claimable',
    text,
  }));
}

/**
 * Which messages a beat produces.
 * An alert is sent only when the rule's alert output is true (the beat that enters the alert).
 * The claim message is sent only on the beat that enters "ready for heirs",
 * not on later beats while heirs may still claim.
 */
export function noticesOnStep(prev: number, next: number, alert: boolean, mail: GateMail): Notice[] {
  const out: Notice[] = [];
  if (alert) out.push(...alerted(mail));
  if (prev === 1 && next === 2) out.push(...claimable(mail));
  return out;
}
