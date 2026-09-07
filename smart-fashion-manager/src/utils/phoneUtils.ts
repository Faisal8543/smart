/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes phone numbers by stripping all non-digit characters.
 * E.g. "+91 98765-43210" -> "9876543210" or "09876543210" -> "9876543210"
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // If phone includes country code like 919876543210, take last 10 digits if length > 10
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits;
};

/**
 * Checks if two phone numbers match after normalization.
 */
export const arePhonesEqual = (phone1: string, phone2: string): boolean => {
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2 || norm1.endsWith(norm2) || norm2.endsWith(norm1);
};

/**
 * Validates if string has a valid mobile number format (at least 7 digits).
 */
export const isValidMobile = (phone: string): boolean => {
  const norm = normalizePhone(phone);
  return norm.length >= 7 && norm.length <= 15;
};
