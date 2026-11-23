'use strict';

// The Electric Cowboy: dependency-free, read-only NIP-01 zap listener.
// NIP-57 kind 9735 events are RELAY-REPORTED zap receipts, not audited
// evidence of a settled Lightning payment. This is a whimsical game.
// The client sends REQ / CLOSE only, and never needs Nostr keys.
(function () {
  const RELAYS = [
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://nostr.oxtr.dev'
  ];
  const WINDOW_SECONDS = 10 * 60;
  const MAX_PER_RELAY = 60;
  const MAX_RECENT = 160;
  const MAX_MESSAGE_LENGTH = 100000;
  const RECONNECT_MAX_MS = 30000;
  const MAX_SATS = 2100000000000000; // 21m BTC; technical sanity bound
  const SUB_ID = 'ec-zaps-v04';

  function positiveSatsFromMsats(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    if (!/^\d+$/.test(String(value))) return null;
    const msats = Number(value);
    if (!Number.isSafeInteger(msats) || msats <= 0) return null;
    const sats = Math.max(1, Math.floor(msats / 1000));
    return sats <= MAX_SATS ? sats : null;
  }

  function invoiceSats(bolt11) {
    if (typeof bolt11 !== 'string' || bolt11.length > 5000) return null;
    const match = /^lnbc(\d+)([munp]?)1/i.exec(bolt11);
    if (!match) return null; // Only Bitcoin mainnet, fixed-amount invoices
    const value = Number(match[1]);
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    const units = { '': 100000000, m: 100000, u: 100, n: 0.1, p: 0.0001 };
    const sats = Math.max(1, Math.floor(value * units[match[2].toLowerCase()]));
    return Number.isSafeInteger(sats) && sats <= MAX_SATS ? sats : null;
  }

  function tagValue(tags, name) {
    if (!Array.isArray(tags)) return null;
    const tag = tags.find(t => Array.isArray(t) && t[0] === name && typeof t[1] === 'string');
    return tag ? tag[1] : null;
  }

  function receiptToZap(event, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!event || typeof event !== 'object' || event.kind !== 9735 ||
        typeof event.id !== 'string' || !/^[0-9a-f]{64}$/i.test(event.id) ||
        !Number.isInteger(event.created_at) ||
        event.created_at < nowSeconds - WINDOW_SECONDS ||
        event.created_at > nowSeconds + 120 || !Array.isArray(event.tags)) return null;

    // Prefer the invoice's advertised amount. If no usable fixed-amount
    // invoice is present, use the embedded zap request's amount tag (msats).
    // No invoice settlement or cryptographic validation is performed here.
    const invoiceAmount = invoiceSats(tagValue(event.tags, 'bolt11'));
    let requestAmount = null;
    const description = tagValue(event.tags, 'description');
    if (description && description.length < 30000) {
      try {
        const request = JSON.parse(description);
        if (request && request.kind === 9734)
          requestAmount = positiveSatsFromMsats(tagValue(request.tags, 'amount'));
      } catch (_) { /* ignore bad description */ }
    }
    const sats = invoiceAmount || requestAmount ||
      positiveSatsFromMsats(tagValue(event.tags, 'amount'));
    if (sats === null) return null;
    return { id: event.id.toLowerCase(), timestamp: event.created_at, amountSats: sats, source: 'nostr' };
  }

  class NostrZapWeather {
    constructor(onFreshZap) {
      this.onFreshZap = onFreshZap;
      this.recent = new Map();
      this.connections = [];
      this.started = false;
      this.acceptingFresh = false;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.started) this.resumeConnections();
      });
    }

    allowFresh() { this.acceptingFresh = true; }

    connect() {
      if (this.started) return;
      this.started = true;
      for (const url of RELAYS) {
        const connection = { url, socket: null, online: false, eose: false, retry: 0, timer: null, closed: false };
        this.connections.push(connection);
        this._open(connection);
      }
    }

    _open(connection) {
      if (connection.closed || document.hidden || connection.socket) return;
      let socket;
      try { socket = new WebSocket(connection.url); }
      catch (_) { this._retry(connection); return; }
      connection.socket = socket;
      connection.eose = false;
      socket.onopen = () => {
        connection.online = true;
        connection.retry = 0;
        const since = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;
        socket.send(JSON.stringify(['REQ', SUB_ID,
          { kinds: [9735], since, limit: MAX_PER_RELAY }]));
      };
      socket.onmessage = message => {
        if (typeof message.data !== 'string' || message.data.length > MAX_MESSAGE_LENGTH) return;
        let packet;
        try { packet = JSON.parse(message.data); } catch (_) { return; }
        if (!Array.isArray(packet) || packet[1] !== SUB_ID) return;
        if (packet[0] === 'EOSE') { connection.eose = true; return; }
        if (packet[0] !== 'EVENT') return;
        const zap = receiptToZap(packet[2]);
        if (!zap || this.recent.has(zap.id)) return;
        this.recent.set(zap.id, zap);
        this._trimRecent();
        // Events arriving AFTER the relay's historical snapshot, with a
        // reasonably recent timestamp, may power the next game strike.
        if ((connection.eose || this.acceptingFresh) &&
            zap.timestamp >= Math.floor(Date.now() / 1000) - 120)
          this.onFreshZap(zap);
      };
      socket.onerror = () => { /* onclose handles reconnect */ };
      socket.onclose = () => {
        connection.online = false;
        connection.eose = false;
        if (connection.socket === socket) connection.socket = null;
        if (!connection.closed) this._retry(connection);
      };
    }

    _trimRecent() {
      const limitTime = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;
      for (const [id, zap] of this.recent) if (zap.timestamp < limitTime) this.recent.delete(id);
      if (this.recent.size > MAX_RECENT) {
        const oldest = [...this.recent.values()].sort((a, b) => a.timestamp - b.timestamp);
        for (const zap of oldest.slice(0, this.recent.size - MAX_RECENT)) this.recent.delete(zap.id);
      }
    }

    _retry(connection) {
      if (connection.closed || connection.timer) return;
      connection.retry++;
      const delay = Math.min(RECONNECT_MAX_MS, 1500 * 2 ** Math.min(connection.retry, 5));
      connection.timer = setTimeout(() => {
        connection.timer = null;
        this._open(connection);
      }, delay);
    }

    recentSeeds(maxCount = 5) {
      this._trimRecent();
      // Sample from the latest ten unique receipts to keep the opening fresh.
      const newest = [...this.recent.values()]
        .sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
      // Shuffle selected receipt order; no duplicate event within a run.
      for (let i = newest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newest[i], newest[j]] = [newest[j], newest[i]];
      }
      return newest.slice(0, maxCount);
    }

    resumeConnections() {
      for (const c of this.connections) {
        if (!c.socket && !c.timer) this._open(c);
      }
    }

    status() {
      const online = this.connections.filter(c => c.online).length;
      return { online, total: RELAYS.length, recent: this.recent.size };
    }
  }

  window.ElectroNostr = { NostrZapWeather, receiptToZap, invoiceSats, RELAYS };
})();
