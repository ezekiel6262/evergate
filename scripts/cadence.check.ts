import {
  checkInPhrase, earliestDays, silenceDays, spell, waitPhrase, CHECK_INS, WAITS,
} from '../lib/cadence.ts';

const expect = (name: string, got: unknown, want: unknown) => {
  if (got !== want) {
    console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    process.exitCode = 1;
  }
};

expect('week', checkInPhrase(7), 'every week');
expect('twice', checkInPhrase(14), 'twice a month');
expect('month', checkInPhrase(30), 'every month');
expect('season', checkInPhrase(90), 'every 3 months');
expect('half', checkInPhrase(182), 'twice a year');
expect('year', checkInPhrase(365), 'once a year');
expect('custom', checkInPhrase(45), 'every 45 days');
expect('spell 90', spell(90), '3 months');
expect('spell 42', spell(42), '6 weeks');
expect('spell 1', spell(1), '1 day');
expect('spell 730', spell(730), '2 years');
expect('wait 30', waitPhrase(30), '1 month');
expect('wait 21', waitPhrase(21), '3 weeks');
expect('silence', silenceDays(30, 3), 90);
expect('earliest', earliestDays(30, 3, 30), 120);
expect('earliest week', earliestDays(7, 3, 14), 35);
expect('presets unique', new Set(CHECK_INS.map(r => r.days)).size, CHECK_INS.length);
expect('waits unique', new Set(WAITS.map(r => r.days)).size, WAITS.length);

if (!process.exitCode) console.log('cadence ok');
