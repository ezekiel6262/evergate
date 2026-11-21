// The rule the keeper asks, and the clock conversion the keeper does first.
// Classic script so a tape:// page can load it with a relative src.
// npm run check matches step() against lib/circuit.ts on every input.
(function (root) {
  function step(state, i) {
    var approvals = 0;
    for (var a = 0; a < i.approvals.length; a++) if (i.approvals[a]) approvals++;
    var missed = i.missed;
    if (missed > 15) missed = 15;
    if (missed < 0) missed = 0;
    var phase = state & 3;
    if (phase === 0) {
      if (i.ping) return { next: 0, alert: false, release: false };
      if (missed >= i.n) return { next: 1, alert: true, release: false };
      return { next: 0, alert: false, release: false };
    }
    if (phase === 1) {
      if (i.ping) return { next: 0, alert: false, release: false };
      if (approvals >= i.k && i.waitElapsed) return { next: 2, alert: false, release: true };
      return { next: 1, alert: false, release: false };
    }
    if (phase === 2) {
      if (i.payoutDone) return { next: 3, alert: false, release: false };
      return { next: 2, alert: false, release: true };
    }
    return { next: 3, alert: false, release: false };
  }

  // Ten bits, least-significant bit first, in two bytes. Same layout as
  // EvergateKeeper.packInputs. N and k are not here; this rule pins them.
  function packWrapper(missed, ping, approvals, waitElapsed, paid) {
    var m = missed;
    if (m > 15) m = 15;
    if (m < 0) m = 0;
    var bits = (m & 15) | (ping ? 1 << 4 : 0) | ((approvals & 7) << 5) | (waitElapsed ? 1 << 8 : 0) | (paid ? 1 << 9 : 0);
    var hex = function (n) { return (n & 255).toString(16).padStart(2, '0'); };
    return hex(bits) + hex(bits >> 8);
  }

  // now, lastCheckIn, interval, alertAt and waitPeriod are seconds.
  function signals(now, lastCheckIn, interval, alertAt, waitPeriod) {
    var missed = 0;
    if (now > lastCheckIn) {
      missed = Math.floor((now - lastCheckIn) / interval);
      if (missed > 15) missed = 15;
    }
    return { missed: missed, waitElapsed: alertAt !== 0 && now >= alertAt + waitPeriod };
  }

  var api = { step: step, packWrapper: packWrapper, signals: signals };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EvergateStep = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
