import CryptoJS from 'crypto-js';
import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_SALT_KEY = 'teacher_app_device_salt_v2';

interface KeyCacheEntry {
  pin: string;
  salt: string;
  iterations: number;
  encKey: CryptoJS.lib.WordArray;
  macKey: CryptoJS.lib.WordArray;
}

let _keyCache: KeyCacheEntry | null = null;

export function clearKeyCache(): void {
  _keyCache = null;
}
const LEGACY_SALT = 'teacher_app_secure_salt_v1';
const LEGACY_ITERATIONS = 310000;

// PBKDF2-HMAC-SHA256 iterations lowered for <2s JS thread performance
export const ITERATIONS_V2 = 100000;
export const ITERATIONS_V3 = 35000;

// 256-bit enc key + 256-bit mac key = 512 bits total derived material
const DERIVED_KEY_SIZE = 512 / 32;
const ENC_KEY_SIZE = 256 / 32;

/**
 * Generates a device-specific cryptographically random salt and persists it
 * in SecureStore. On subsequent calls returns the stored value.
 * Falls back to an in-session salt on platforms where SecureStore is
 * unavailable (e.g. web preview).
 */
export async function getOrCreateDeviceSalt(): Promise<string> {
  if (Platform.OS === 'web') {
    const existing = typeof localStorage !== 'undefined'
      ? localStorage.getItem(DEVICE_SALT_KEY)
      : null;
    if (existing) return existing;
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const salt = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_SALT_KEY, salt);
    }
    if (__DEV__) {
      console.log('[Encryption] Device salt created and stored in localStorage (web)');
    }
    return salt;
  }

  const existing = await SecureStore.getItemAsync(DEVICE_SALT_KEY);
  if (existing) return existing;

  const bytes = ExpoCrypto.getRandomBytes(32);
  const salt = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(DEVICE_SALT_KEY, salt);
  if (__DEV__) {
    console.log('[Encryption] Device salt created and stored in SecureStore');
  }
  return salt;
}

/**
 * Derives two independent 256-bit keys from a PIN + salt via PBKDF2-HMAC-SHA256.
 * Using separate keys for AES-CBC (encKey) and HMAC-SHA256 (macKey) is best
 * practice and avoids length-extension / key-reuse weaknesses.
 */
function deriveKeys(
  pin: string,
  salt: string,
  iterations: number = ITERATIONS_V3
): { encKey: CryptoJS.lib.WordArray; macKey: CryptoJS.lib.WordArray } {
  if (_keyCache && _keyCache.pin === pin && _keyCache.salt === salt && _keyCache.iterations === iterations) {
    return { encKey: _keyCache.encKey, macKey: _keyCache.macKey };
  }
  const derived = CryptoJS.PBKDF2(pin, salt, {
    keySize: DERIVED_KEY_SIZE,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const hex = derived.toString();
  const encKey = CryptoJS.enc.Hex.parse(hex.slice(0, 64));
  const macKey = CryptoJS.enc.Hex.parse(hex.slice(64));
  _keyCache = { pin, salt, iterations, encKey, macKey };
  return { encKey, macKey };
}

/**
 * Encrypts data with AES-256-CBC + Encrypt-then-MAC (HMAC-SHA256).
 * Output format (v3): "v3:<ivHex>:<base64Ciphertext>:<hmacHex>"
 */
export function encrypt(data: string, pin: string, salt: string): string {
  const { encKey, macKey } = deriveKeys(pin, salt, ITERATIONS_V3);

  let ivBytes: Uint8Array<ArrayBuffer>;
  if (Platform.OS === 'web') {
    ivBytes = new Uint8Array(16) as Uint8Array<ArrayBuffer>;
    crypto.getRandomValues(ivBytes);
  } else {
    ivBytes = ExpoCrypto.getRandomBytes(16) as Uint8Array<ArrayBuffer>;
  }
  const ivHex = Array.from(ivBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const encrypted = CryptoJS.AES.encrypt(data, encKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const ciphertext = encrypted.toString();

  // Encrypt-then-MAC: authenticate iv || ciphertext with the dedicated mac key
  const hmac = CryptoJS.HmacSHA256(ivHex + ciphertext, macKey).toString();

  return `v3:${ivHex}:${ciphertext}:${hmac}`;
}

/**
 * Decrypt base block for handling v2 and v3 generic logic
 */
function _decryptV(
  encryptedData: string,
  pin: string,
  salt: string,
  iterations: number,
  prefixLen: number
): string | null {
  try {
    const body = encryptedData.slice(prefixLen); // strip prefix
    const colonCount = body.split(':').length - 1;
    if (colonCount < 2) return null;

    const firstColon = body.indexOf(':');
    const secondColon = body.indexOf(':', firstColon + 1);
    const ivHex = body.slice(0, firstColon);
    const ciphertext = body.slice(firstColon + 1, secondColon);
    const storedHmac = body.slice(secondColon + 1);

    const { encKey, macKey } = deriveKeys(pin, salt, iterations);

    const calculatedHmac = CryptoJS.HmacSHA256(
      ivHex + ciphertext,
      macKey
    ).toString();
    if (calculatedHmac !== storedHmac) {
      if (__DEV__) {
        console.log('[Encryption] integrity check failed');
      }
      return null;
    }

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, encKey, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch (e) {
    if (__DEV__) {
      console.log('[Encryption] decryption error:', e);
    }
    return null;
  }
}

/**
 * Decrypts legacy v1 data (static salt, single derived key for both AES and HMAC).
 * Used only during one-time migration.
 */
export function decryptLegacy(encryptedData: string, pin: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, ciphertext, storedHmac] = parts;

    const keyHex = CryptoJS.PBKDF2(pin, LEGACY_SALT, {
      keySize: ENC_KEY_SIZE,
      iterations: LEGACY_ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    }).toString();
    const key = CryptoJS.enc.Hex.parse(keyHex);

    const calculatedHmac = CryptoJS.HmacSHA256(
      ivHex + ciphertext,
      key
    ).toString();
    if (calculatedHmac !== storedHmac) return null;

    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Unified decrypt that auto-detects v1 (legacy) vs v2 vs v3 format.
 */
export function decrypt(
  encryptedData: string,
  pin: string,
  salt: string
): string | null {
  if (encryptedData.startsWith('v3:')) {
    return _decryptV(encryptedData, pin, salt, ITERATIONS_V3, 3);
  }
  if (encryptedData.startsWith('v2:')) {
    return _decryptV(encryptedData, pin, salt, ITERATIONS_V2, 3);
  }
  // v1 legacy: 3 colon-separated parts, no prefix
  const parts = encryptedData.split(':');
  if (parts.length === 3) {
    if (__DEV__) {
      console.log('[Encryption] Decrypting legacy v1 data');
    }
    return decryptLegacy(encryptedData, pin);
  }
  if (__DEV__) {
    console.log('[Encryption] Unknown encryption format');
  }
  return null;
}

/**
 * Returns true if the stored ciphertext uses the legacy formats.
 */
export function isLegacyFormat(encryptedData: string): boolean {
  return !(encryptedData.startsWith('v3:'));
}

/**
 * Hashes a PIN for secure storage using PBKDF2-HMAC-SHA256 with device salt.
 */
export function hashPin(pin: string, salt: string, iterations: number = ITERATIONS_V3): string {
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 512 / 32,
    iterations: iterations,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
}

export function hashPinLegacy(pin: string): string {
  return CryptoJS.PBKDF2(pin, LEGACY_SALT, {
    keySize: 512 / 32,
    iterations: LEGACY_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifyPin(pin: string, hash: string, salt: string, iterations: number = ITERATIONS_V3): boolean {
  return safeEqual(hashPin(pin, salt, iterations), hash);
}

export function verifyPinLegacy(pin: string, hash: string): boolean {
  return safeEqual(hashPinLegacy(pin), hash);
}
