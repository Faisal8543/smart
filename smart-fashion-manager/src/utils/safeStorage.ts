/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class InMemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const getSafeStorage = (type: 'localStorage' | 'sessionStorage'): Storage => {
  try {
    if (typeof window !== 'undefined') {
      const storage = window[type];
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return storage;
    }
  } catch (e) {
    // Storage is blocked or unsupported in this sandbox environment
  }
  return new InMemoryStorage();
};

export const safeLocalStorage = getSafeStorage('localStorage');
export const safeSessionStorage = getSafeStorage('sessionStorage');
