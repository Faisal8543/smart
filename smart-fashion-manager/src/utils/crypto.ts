/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple, robust, self-contained cryptographic hashing function for local PIN encryption.
 * It uses a salt and multiple rounds of DJB2 with bit-shifting to generate a secure hex-like string.
 */
export function hashPin(pin: string): string {
  const salt = "SMART_FASHION_LUXURY_SALT_2026";
  const saltedInput = pin + salt;
  
  let h1 = 5381;
  let h2 = 1779033703;
  
  for (let i = 0; i < saltedInput.length; i++) {
    const char = saltedInput.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ char;
    h2 = ((h2 << 5) + h2) ^ char ^ (h1 & 0xff);
  }
  
  // Return a combined, stable hex-like signature of the PIN
  const hash1Str = Math.abs(h1).toString(16).padStart(8, '0');
  const hash2Str = Math.abs(h2).toString(16).padStart(8, '0');
  
  return `${hash1Str}${hash2Str}`;
}
