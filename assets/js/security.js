/* ==========================================================================
   Invexa — Security layer (Web Crypto API, no server)
   --------------------------------------------------------------------------
   • Passwords are never stored. Each user has a random 128-bit salt and
     PBKDF2-HMAC-SHA256 (210,000 iterations) derives 512 bits:
       - bits[0..255]   -> auth key; only SHA-256(authKey) is stored (verifier)
       - bits[256..511] -> key-encryption key (KEK)
   • All business data lives in one vault encrypted with AES-256-GCM using a
     random Data Encryption Key (DEK). The DEK is wrapped (AES-GCM) with each
     user's KEK — classic envelope encryption.
   • Session: DEK + expiry kept in sessionStorage (cleared when the tab closes),
     with idle auto-lock. Failed logins are throttled.
   ========================================================================== */
const Security = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const ITER = 210000;
  const AAD = enc.encode('invexa.vault.v1');
  const SESSION_KEY = 'invexa.session';
  const GUARD_KEY = 'invexa.guard';
  const IDLE_MS = 30 * 60 * 1000;

  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  function ctEqual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  async function derive(password, saltB64, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: iter }, base, 512));
    const verifier = toB64(await crypto.subtle.digest('SHA-256', bits.slice(0, 32)));
    const kek = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    bits.fill(0);
    return { verifier, kek };
  }

  /** Create a credential record for a password, wrapping the given DEK. */
  async function enrol(password, dekRaw) {
    const salt = toB64(rand(16));
    const { verifier, kek } = await derive(password, salt, ITER);
    const iv = rand(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, dekRaw);
    return { kdf: 'PBKDF2-SHA256', iter: ITER, salt, verifier, wrap: { alg: 'AES-256-GCM', iv: toB64(iv), ct: toB64(ct) } };
  }

  /** Verify password; on success returns raw DEK bytes, else null. */
  async function unlock(password, cred) {
    const { verifier, kek } = await derive(password, cred.salt, cred.iter);
    if (!ctEqual(verifier, cred.verifier)) return null;
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(cred.wrap.iv) }, kek, fromB64(cred.wrap.ct));
    return new Uint8Array(raw);
  }

  const newDek = () => rand(32);
  const importDek = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function gzip(bytes, decompress) {
    const stream = new Blob([bytes]).stream().pipeThrough(decompress ? new DecompressionStream('gzip') : new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  /** JSON -> gzip -> AES-256-GCM (compress-then-encrypt keeps the vault well under browser quota) */
  async function seal(key, obj) {
    const iv = rand(12);
    let pt = enc.encode(JSON.stringify(obj));
    const z = typeof CompressionStream === 'function';
    if (z) pt = await gzip(pt, false);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, pt);
    return { v: 1, alg: 'AES-256-GCM', z: z ? 'gzip' : null, iv: toB64(iv), ct: toB64(ct), at: Date.now() };
  }
  async function open(key, box) {
    let pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv), additionalData: AAD }, key, fromB64(box.ct)));
    if (box.z) pt = await gzip(pt, true);
    return JSON.parse(dec.decode(pt));
  }

  /* ---------- Session ---------- */
  function startSession(userId, dekRaw) {
    const s = { uid: userId, dek: toB64(dekRaw), iat: Date.now(), last: Date.now(), sid: toB64(rand(12)) };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  }
  function getSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      if (Date.now() - s.last > IDLE_MS) { endSession(); return { expired: true }; }
      return s;
    } catch { return null; }
  }
  function touch() {
    const s = getSession();
    if (s && !s.expired) { s.last = Date.now(); sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  }
  function endSession() { sessionStorage.removeItem(SESSION_KEY); }
  const sessionDek = s => fromB64(s.dek);

  /* ---------- Brute-force throttling ---------- */
  function guard() {
    try { return JSON.parse(localStorage.getItem(GUARD_KEY) || '{"fails":0,"until":0}'); } catch { return { fails: 0, until: 0 }; }
  }
  function lockedFor() { const g = guard(); return Math.max(0, g.until - Date.now()); }
  function recordFail() {
    const g = guard(); g.fails += 1;
    if (g.fails >= 5) { g.until = Date.now() + 60000; g.fails = 0; }
    localStorage.setItem(GUARD_KEY, JSON.stringify(g));
    return g;
  }
  function recordSuccess() { localStorage.setItem(GUARD_KEY, JSON.stringify({ fails: 0, until: 0 })); }

  function strength(pw) {
    let s = 0;
    if (pw.length >= 8) s++; if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }

  return { enrol, unlock, newDek, importDek, seal, open, startSession, getSession, touch, endSession, sessionDek,
    lockedFor, recordFail, recordSuccess, strength, IDLE_MS, ITER };
})();
