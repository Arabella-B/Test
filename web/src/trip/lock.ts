// Passcode / Face ID lock for My Trip.
//
// The passcode itself is never saved: only a PBKDF2 hash ("fingerprint") of it,
// with a random salt. Face ID / Touch ID uses the device's own biometrics through
// WebAuthn (passkeys); the app only learns "yes, it's the owner".
//
// Honest limits: this stops someone who picks up your unlocked phone from seeing
// your money. It does not encrypt the data stored on the device.

export interface LockConfig {
  salt: string; // base64
  hash: string; // base64 PBKDF2-SHA256 of the passcode
  iterations: number;
  length: number; // how many digits (so it can check as soon as you've typed them)
  credentialId?: string; // base64 WebAuthn credential for Face ID / Touch ID
  autoLockMinutes: number; // lock again after the app has been hidden this long
}

const key = (scope: string) => `gap-year-lock-${scope}`;

export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function hashPasscode(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passcode), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return toB64(bits);
}

export function loadLock(scope: string): LockConfig | null {
  try {
    const raw = localStorage.getItem(key(scope));
    return raw ? (JSON.parse(raw) as LockConfig) : null;
  } catch {
    return null;
  }
}

export function saveLock(scope: string, config: LockConfig | null): void {
  try {
    if (config) localStorage.setItem(key(scope), JSON.stringify(config));
    else localStorage.removeItem(key(scope));
  } catch { /* storage unavailable */ }
}

export async function createLock(passcode: string, autoLockMinutes = 1): Promise<LockConfig> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 210_000;
  return { salt: toB64(salt), hash: await hashPasscode(passcode, salt, iterations), iterations, length: passcode.length, autoLockMinutes };
}

export async function checkPasscode(config: LockConfig, passcode: string): Promise<boolean> {
  const hash = await hashPasscode(passcode, fromB64(config.salt), config.iterations);
  // Compare without stopping early, so timing doesn't reveal how much matched.
  let diff = hash.length ^ config.hash.length;
  for (let i = 0; i < Math.min(hash.length, config.hash.length); i++) diff |= hash.charCodeAt(i) ^ config.hash.charCodeAt(i);
  return diff === 0;
}

export function isValidPasscode(p: string): boolean {
  return /^\d{4,6}$/.test(p);
}

// ---- Face ID / Touch ID (WebAuthn) ----

export async function biometricsAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Ask the device to create a Face ID / Touch ID key for this app. Returns its id. */
export async function registerBiometrics(name: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Gap Year Hub" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: name || "traveller", displayName: name || "Traveller" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Face ID / Touch ID wasn't set up.");
  return toB64(cred.rawId);
}

/** Ask for Face ID / Touch ID. Resolves true when the device confirms it's the owner. */
export async function unlockWithBiometrics(credentialId: string): Promise<boolean> {
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: fromB64(credentialId) }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return !!result;
  } catch {
    return false;
  }
}
