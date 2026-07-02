#!/usr/bin/env node
/**
 * protect.mjs — encrypt-at-publish support for password-protected readouts.
 *
 * a protected readout is published as a small static "unlock shell": the
 * compiled HTML is encrypted (PBKDF2-SHA256 -> AES-256-GCM via WebCrypto) and
 * embedded as base64 ciphertext; decryption happens entirely in the reader's
 * browser. the password may ride in the URL fragment (#pw=...), which never
 * reaches the server.
 *
 * also usable as a CLI to decrypt an envelope (e.g. a protected version
 * snapshot fetched from PocketBase):
 *   node protect.mjs decrypt --password <pw> [file]   (reads stdin if no file)
 */
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { pathToFileURL } from "node:url";

const { subtle } = webcrypto;
// note: getRandomValues must be called on webcrypto — destructuring loses `this`
const randomBytes = (n) => webcrypto.getRandomValues(new Uint8Array(n));

/** PBKDF2 iteration count baked into new envelopes (readers use env.iter) */
export const KDF_ITERATIONS = 600000;

/** marker the unlock shell carries so tooling (gallery) can detect protection */
export const PROTECTED_MARKER = '<meta name="readout-protected" content="1" />';

/**
 * derives an AES-256-GCM key from a password and salt.
 * @param {string} password user password
 * @param {Uint8Array} salt kdf salt
 * @param {number} iterations pbkdf2 iteration count
 * @param {KeyUsage[]} usages ["encrypt"] or ["decrypt"]
 * @returns {Promise<CryptoKey>} derived key
 */
async function deriveKey(password, salt, iterations, usages) {
    const keyMaterial = await subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        usages,
    );
}

/**
 * encrypts plaintext into a portable envelope of base64 fields.
 * @param {string} plaintext utf-8 content to encrypt
 * @param {string} password user password
 * @returns {Promise<{v: number, kdf: string, iter: number, salt: string, iv: string, data: string}>} envelope
 */
export async function encryptToEnvelope(plaintext, password) {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await deriveKey(password, salt, KDF_ITERATIONS, ["encrypt"]);
    const ciphertext = await subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(plaintext),
    );
    const b64 = (buf) => Buffer.from(buf).toString("base64");
    return {
        v: 1,
        kdf: "pbkdf2-sha256",
        iter: KDF_ITERATIONS,
        salt: b64(salt),
        iv: b64(iv),
        data: b64(ciphertext),
    };
}

/**
 * decrypts an envelope produced by encryptToEnvelope. throws on wrong password
 * (AES-GCM authentication failure).
 * @param {{iter: number, salt: string, iv: string, data: string}} envelope encrypted envelope
 * @param {string} password user password
 * @returns {Promise<string>} plaintext
 */
export async function decryptEnvelope(envelope, password) {
    const b64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
    const key = await deriveKey(password, b64(envelope.salt), envelope.iter, ["decrypt"]);
    const plaintext = await subtle.decrypt(
        { name: "AES-GCM", iv: b64(envelope.iv) },
        key,
        b64(envelope.data),
    );
    return new TextDecoder().decode(plaintext);
}

/**
 * builds the static unlock shell page around an envelope. the shell reuses the
 * shared stylesheet tokens, supports #pw=... fragment auto-unlock and manual
 * entry, and intentionally leaks nothing about the document (no title, no
 * lead, no comments.js).
 * @param {object} envelope envelope from encryptToEnvelope
 * @returns {string} full html document
 */
export function buildUnlockShell(envelope) {
    const payload = JSON.stringify(envelope).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${PROTECTED_MARKER}
<meta name="robots" content="noindex" />
<title>Protected readout</title>
<script>try{var t=localStorage.getItem("readout-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}</script>
<link rel="stylesheet" href="../_shared/style.css" />
</head>
<body>
<main class="page unlock-page">
  <header class="masthead">
    <p class="eyebrow">Protected</p>
    <h1>This readout is <em>locked</em></h1>
    <p class="meta">Enter the password to decrypt it in your browser. Nothing is sent to the server.</p>
  </header>
  <form class="unlock-form" id="unlock-form">
    <input class="unlock-input" id="unlock-pw" type="password" placeholder="Password" autocomplete="current-password" autofocus />
    <button class="unlock-button" id="unlock-btn" type="submit">Unlock</button>
  </form>
  <p class="unlock-error" id="unlock-error" hidden>Wrong password.</p>
</main>
<script type="application/json" id="readout-payload">${payload}</script>
<script>
(function () {
  var env = JSON.parse(document.getElementById("readout-payload").textContent);
  var form = document.getElementById("unlock-form");
  var input = document.getElementById("unlock-pw");
  var btn = document.getElementById("unlock-btn");
  var err = document.getElementById("unlock-error");

  function b64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function decrypt(pw) {
    var km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64(env.salt), iterations: env.iter, hash: "SHA-256" },
      km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(env.iv) }, key, b64(env.data));
    return new TextDecoder().decode(pt);
  }

  async function tryUnlock(pw) {
    btn.disabled = true;
    btn.textContent = "Unlocking…";
    err.hidden = true;
    var html;
    try {
      html = await decrypt(pw);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Unlock";
      return false;
    }
    document.open();
    document.write(html);
    document.close();
    return true;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    tryUnlock(input.value).then(function (ok) {
      if (!ok) { err.textContent = "Wrong password."; err.hidden = false; }
    });
  });

  var m = location.hash.match(/[#&]pw=([^&]+)/);
  if (m) {
    tryUnlock(decodeURIComponent(m[1])).then(function (ok) {
      if (!ok) { err.textContent = "The password in the link is wrong — enter it manually."; err.hidden = false; }
    });
  }
})();
</script>
</body>
</html>
`;
}

// ── CLI: decrypt an envelope (protected version snapshots) ───────────────────
const isCli =
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
    const argv = process.argv.slice(2);
    if (argv[0] !== "decrypt") {
        console.error("usage: protect.mjs decrypt --password <pw> [file]  (reads stdin if no file)");
        process.exit(1);
    }
    let password = process.env.READOUT_PASSWORD || "";
    let file = null;
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--password") password = argv[++i] ?? "";
        else if (a.startsWith("--password=")) password = a.slice("--password=".length);
        else if (!a.startsWith("-") && !file) file = a;
    }
    if (!password) {
        console.error("protect: missing --password (or READOUT_PASSWORD)");
        process.exit(1);
    }
    const raw = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
    let envelope;
    try {
        envelope = JSON.parse(raw);
    } catch (e) {
        console.error(`protect: input is not an envelope (invalid JSON): ${e.message}`);
        process.exit(1);
    }
    try {
        process.stdout.write(await decryptEnvelope(envelope, password));
    } catch {
        console.error("protect: decryption failed — wrong password or corrupted envelope");
        process.exit(1);
    }
}
