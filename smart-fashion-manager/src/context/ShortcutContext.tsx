/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { safeLocalStorage } from '../utils/safeStorage';
import { 
  Keyboard, 
  Search, 
  X, 
  CornerDownLeft, 
  ArrowUp, 
  ArrowDown, 
  Shirt, 
  Users, 
  Truck, 
  QrCode, 
  Settings, 
  Activity
} from 'lucide-react';
import { useAppState } from './StateContext';

export interface Shortcut {
  keys: string;
  category: string;
  description: string;
}

interface ToastMessage {
  id: string;
  message: string;
  keys?: string;
}

interface ShortcutContextType {
  registerShortcut: (
    keys: string,
    category: string,
    description: string,
    callback: (e: KeyboardEvent) => void
  ) => () => void;
  showToast: (message: string, keys?: string) => void;
  openHelpModal: () => void;
  openCommandPalette: () => void;
  isHelpOpen: boolean;
  isSearchOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  setIsSearchOpen: (open: boolean) => void;
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

export const useShortcuts = () => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider');
  }
  return context;
};

// Helper to normalize shortcut strings for comparison
export const normalizeKeys = (keysStr: string): string => {
  return (keysStr || '').toLowerCase().replace(/\s+/g, '');
};

// Parse keyboard event into normalized string format
export const getEventShortcutString = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  
  const key = (e.key || '').toLowerCase();
  if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
    if (key === ' ') {
      parts.push('space');
    } else if (e.key === '+') {
      parts.push('+');
    } else if (e.key === '=') {
      parts.push('+'); // map equals to plus to be extremely forgiving for ctrl + + shortcuts
    } else {
      parts.push(key);
    }
  }
  return parts.join('+');
};

const isInputField = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  const tagName = (el.tagName || '').toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    el.isContentEditable ||
    tagName === 'select'
  );
};

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products, customers, suppliers, logout } = useAppState();
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Centralized LIFO registry for shortcut handlers
  // Map from normalized key strings to an array of registrations (the last one is the active one)
  const registry = useRef<Record<string, Array<{ category: string; description: string; callback: (e: KeyboardEvent) => void }>>>({});

  const showToast = (message: string, keys?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, keys }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const registerShortcut = useCallback((
    keys: string,
    category: string,
    description: string,
    callback: (e: KeyboardEvent) => void
  ) => {
    const normalized = normalizeKeys(keys);
    
    if (!registry.current[normalized]) {
      registry.current[normalized] = [];
    }

    const registration = { category, description, callback };
    registry.current[normalized].push(registration);

    // Return the unregistration function for cleanup
    return () => {
      if (registry.current[normalized]) {
        registry.current[normalized] = registry.current[normalized].filter(
          (reg) => reg.callback !== callback
        );
        if (registry.current[normalized].length === 0) {
          delete registry.current[normalized];
        }
      }
    };
  }, []);

  const openHelpModal = () => {
    setIsHelpOpen(true);
    showToast('Opened Keyboard Shortcuts Help', 'Ctrl+/');
  };

  const openCommandPalette = () => {
    setIsSearchOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
    showToast('Opened Command Palette', 'Ctrl+K');
  };

  // Predefined global shortcut actions
  const triggerNavigation = (view: string, label: string, keys: string) => {
    window.location.hash = view;
    showToast(`Opened ${label}`, keys);
  };

  const triggerLogoutConfirm = () => {
    if (window.confirm('Do you want to log out of the Showroom Terminal?')) {
      logout();
      showToast('Showroom Session Locked', 'Ctrl+Shift+X');
    }
  };

  // Keyboard Event Dispatcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcutStr = getEventShortcutString(e);
      const isInput = isInputField(document.activeElement as HTMLElement);

      // Handle Escape globally to close search or help modal even if typing inside an input!
      if (shortcutStr === 'escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          e.preventDefault();
          return;
        }
        if (isHelpOpen) {
          setIsHelpOpen(false);
          e.preventDefault();
          return;
        }
      }

      // If user is actively typing, ignore non-global shortcuts
      if (isInput) {
        // We let Escape escape the input focus or any active dialog, so look for registered Esc key handlers
        if (shortcutStr === 'escape' && registry.current['escape']) {
          const handlers = registry.current['escape'];
          if (handlers && handlers.length > 0) {
            e.preventDefault();
            handlers[handlers.length - 1].callback(e);
            return;
          }
        }
        return;
      }

      // 1. Check registry first (dynamic view-level overrides)
      if (registry.current[shortcutStr] && registry.current[shortcutStr].length > 0) {
        e.preventDefault();
        const handlers = registry.current[shortcutStr];
        const activeHandler = handlers[handlers.length - 1];
        activeHandler.callback(e);
        showToast(activeHandler.description, activeHandler.keys || shortcutStr);
        return;
      }

      // 2. Fallback to built-in static global shortcut definitions
      switch (shortcutStr) {
        // Search & Help
        case 'ctrl+k':
          e.preventDefault();
          openCommandPalette();
          break;
        case 'ctrl+/':
          e.preventDefault();
          openHelpModal();
          break;
        case 'ctrl+f':
        case 'ctrl+shift+f':
          e.preventDefault();
          setIsSearchOpen(true);
          setSearchQuery('');
          setSelectedIndex(0);
          showToast('Opened Global Search', shortcutStr);
          break;

        // Navigation (Ctrl / Alt Combinations)
        case 'ctrl+d':
        case 'alt+1':
          e.preventDefault();
          triggerNavigation('dashboard', 'Dashboard', shortcutStr);
          break;
        case 'ctrl+n':
        case 'alt+2':
          e.preventDefault();
          triggerNavigation('pos', 'POS Billing', shortcutStr);
          break;
        case 'ctrl+p':
        case 'alt+3':
          e.preventDefault();
          triggerNavigation('products', 'Products Catalog', shortcutStr);
          break;
        case 'ctrl+c':
        case 'alt+4':
          e.preventDefault();
          triggerNavigation('customers', 'Customers List', shortcutStr);
          break;
        case 'ctrl+shift+u':
        case 'alt+5':
          e.preventDefault();
          triggerNavigation('suppliers', 'Suppliers Registry', shortcutStr);
          break;
        case 'ctrl+r':
        case 'alt+6':
          e.preventDefault();
          triggerNavigation('reports', 'Sales Reports', shortcutStr);
          break;
        case 'ctrl+e':
        case 'alt+7':
          e.preventDefault();
          triggerNavigation('expenses', 'Expenses Ledger', shortcutStr);
          break;
        case 'ctrl+t':
        case 'alt+8':
          e.preventDefault();
          triggerNavigation('settings/membership', 'Membership Tier Manager', shortcutStr);
          break;
        case 'ctrl+m':
        case 'alt+9':
          e.preventDefault();
          triggerNavigation('discount-cards', 'Discount Cards', shortcutStr);
          break;
        case 'ctrl+shift+s':
        case 'alt+0':
          e.preventDefault();
          triggerNavigation('settings', 'Store Settings', shortcutStr);
          break;

        // Logout
        case 'ctrl+shift+x':
          e.preventDefault();
          triggerLogoutConfirm();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, isHelpOpen, logout]);

  // Command Palette Search calculations
  const getFilteredResults = () => {
    const query = searchQuery.trim().toLowerCase();
    
    // Built-in actions/commands
    const commandsList = [
      { id: 'nav_dashboard', name: 'Open Dashboard', keys: 'Alt + 1', cat: 'Navigation', action: () => triggerNavigation('dashboard', 'Dashboard', 'Alt+1') },
      { id: 'nav_pos', name: 'Open POS Billing (New Sale)', keys: 'Ctrl + N', cat: 'Navigation', action: () => triggerNavigation('pos', 'POS Billing', 'Ctrl+N') },
      { id: 'nav_products', name: 'Open Products', keys: 'Ctrl + P', cat: 'Navigation', action: () => triggerNavigation('products', 'Products', 'Ctrl+P') },
      { id: 'nav_customers', name: 'Open Customers', keys: 'Ctrl + C', cat: 'Navigation', action: () => triggerNavigation('customers', 'Customers', 'Ctrl+C') },
      { id: 'nav_suppliers', name: 'Open Suppliers', keys: 'Ctrl + Shift + U', cat: 'Navigation', action: () => triggerNavigation('suppliers', 'Suppliers', 'Ctrl+Shift+U') },
      { id: 'nav_reports', name: 'Open Sales Reports', keys: 'Ctrl + R', cat: 'Navigation', action: () => triggerNavigation('reports', 'Sales Reports', 'Ctrl+R') },
      { id: 'nav_expenses', name: 'Open Expenses', keys: 'Ctrl + E', cat: 'Navigation', action: () => triggerNavigation('expenses', 'Expenses', 'Ctrl+E') },
      { id: 'nav_tiers', name: 'Open Membership Tier Manager', keys: 'Ctrl + T', cat: 'Navigation', action: () => triggerNavigation('settings/membership', 'Membership Tier Manager', 'Ctrl+T') },
      { id: 'nav_cards', name: 'Open Discount Cards', keys: 'Ctrl + M', cat: 'Navigation', action: () => triggerNavigation('discount-cards', 'Discount Cards', 'Ctrl+M') },
      { id: 'nav_settings', name: 'Open Store Settings', keys: 'Ctrl + Shift + S', cat: 'Navigation', action: () => triggerNavigation('settings', 'Store Settings', 'Ctrl+Shift+S') },
      { id: 'help', name: 'Open Keyboard Shortcuts Help', keys: 'Ctrl + /', cat: 'Miscellaneous', action: () => { setIsHelpOpen(true); setIsSearchOpen(false); } },
      { id: 'lock', name: 'Lock Showroom Screen', keys: 'Ctrl + Shift + X', cat: 'Miscellaneous', action: () => { setIsSearchOpen(false); logout(); } },
    ];

    if (!query) {
      return commandsList.map(c => ({ type: 'command', ...c }));
    }

    const matches: any[] = [];

    // 1. Matches commands
    commandsList.forEach(cmd => {
      if ((cmd.name || '').toLowerCase().includes(query) || (cmd.cat || '').toLowerCase().includes(query)) {
        matches.push({ type: 'command', ...cmd });
      }
    });

    // 2. Matches Products (from StateContext)
    products.forEach(p => {
      if (
        (p.name || '').toLowerCase().includes(query) ||
        (p.sku || '').toLowerCase().includes(query) ||
        (p.brand || '').toLowerCase().includes(query)
      ) {
        matches.push({
          type: 'product',
          id: p.id,
          name: p.name || 'Unnamed Product',
          details: `SKU: ${p.sku || ''} | Brand: ${p.brand || ''} | Size: ${p.size || ''} | Price: ₹${p.sellingPrice || 0}`,
          keys: 'Products',
          action: () => {
            safeLocalStorage.setItem('sf_global_search_term', p.sku || '');
            triggerNavigation('products', `Product: ${p.name || ''}`, 'Enter');
          }
        });
      }
    });

    // 3. Matches Customers (from StateContext)
    customers.forEach(c => {
      if ((c.name || '').toLowerCase().includes(query) || (c.phone || '').includes(query)) {
        matches.push({
          type: 'customer',
          id: c.id,
          name: c.name || 'Unnamed Customer',
          details: `Mobile: ${c.phone || ''}`,
          keys: 'Customers',
          action: () => {
            safeLocalStorage.setItem('sf_global_search_term', c.phone || '');
            triggerNavigation('customers', `Client: ${c.name || ''}`, 'Enter');
          }
        });
      }
    });

    // 4. Matches Suppliers (from StateContext)
    suppliers.forEach(s => {
      if (
        (s.name || '').toLowerCase().includes(query) ||
        (s.company || '').toLowerCase().includes(query) ||
        (s.phone || '').includes(query)
      ) {
        matches.push({
          type: 'supplier',
          id: s.id,
          name: s.name || 'Unnamed Supplier',
          details: `Company: ${s.company || ''} | Contact: ${s.phone || ''}`,
          keys: 'Suppliers',
          action: () => {
            safeLocalStorage.setItem('sf_global_search_term', s.name || '');
            triggerNavigation('suppliers', `Supplier: ${s.name || ''}`, 'Enter');
          }
        });
      }
    });

    return matches.slice(0, 8); // return top 8 matches for speed & layout size limits
  };

  const searchResults = getFilteredResults();

  // Handle keys when command palette is open
  const handleSearchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = searchResults[selectedIndex];
      if (selected) {
        selected.action();
        setIsSearchOpen(false);
      }
    }
  };

  // Keyboard Shortcut list grouped by Category for beautiful grid render
  const docShortcuts = [
    { keys: 'Ctrl + N', cat: 'Navigation', desc: 'Open New POS Sale (POS Billing)' },
    { keys: 'Ctrl + P', cat: 'Navigation', desc: 'Open Products Catalog' },
    { keys: 'Ctrl + C', cat: 'Navigation', desc: 'Open Customers View' },
    { keys: 'Ctrl + M', cat: 'Navigation', desc: 'Open Membership / Discount Cards' },
    { keys: 'Ctrl + D', cat: 'Navigation', desc: 'Open Dashboard' },
    { keys: 'Ctrl + R', cat: 'Navigation', desc: 'Open Sales Reports' },
    { keys: 'Ctrl + E', cat: 'Navigation', desc: 'Open Expenses Ledger' },
    { keys: 'Ctrl + T', cat: 'Navigation', desc: 'Open Membership Tier Manager' },
    { keys: 'Ctrl + Shift + S', cat: 'Navigation', desc: 'Open Store Settings' },
    { keys: 'Ctrl + Shift + U', cat: 'Navigation', desc: 'Open Suppliers View' },
    { keys: 'Alt + 1 ... 0', cat: 'Navigation', desc: 'Quick tab switcher (1: Dash, 2: POS, 3: Products... 0: Settings)' },

    { keys: 'F1', cat: 'POS', desc: 'Focus Product Barcode / SKU input' },
    { keys: 'F2', cat: 'POS', desc: 'Focus Customer Mobile Search' },
    { keys: 'F3', cat: 'POS', desc: 'Focus Membership Card Scan input' },
    { keys: 'F4', cat: 'POS', desc: 'Focus Apply Coupon Discount field' },
    { keys: 'F5', cat: 'POS', desc: 'Hold Current Bill transaction' },
    { keys: 'F6', cat: 'POS', desc: 'Resume Held Transaction' },
    { keys: 'F7', cat: 'POS', desc: 'Open Payment Option / Focus Finalize' },
    { keys: 'F8', cat: 'POS', desc: 'Select Cash payment method' },
    { keys: 'F9', cat: 'POS', desc: 'Select UPI QR payment method' },
    { keys: 'F10', cat: 'POS', desc: 'Select Credit Card payment method' },
    { keys: 'F11', cat: 'POS', desc: 'Trigger Print current bill/receipt' },
    { keys: 'F12', cat: 'POS', desc: 'Generate Bill (Submit & Print transaction)' },
    { keys: 'Esc', cat: 'POS', desc: 'Close dialog, cancel hold or clear active modal' },
    { keys: 'Delete', cat: 'POS', desc: 'Remove highlighted item from cart basket' },
    { keys: 'Ctrl + +', cat: 'POS', desc: 'Increase active cart item quantity' },
    { keys: 'Ctrl + -', cat: 'POS', desc: 'Decrease active cart item quantity' },
    { keys: 'Ctrl + Backspace', cat: 'POS', desc: 'Clear entire active shopping cart' },

    { keys: 'Ctrl + I', cat: 'Membership', desc: 'Issue New Membership Card' },
    { keys: 'Ctrl + Shift + E', cat: 'Membership', desc: 'Extend Membership Validity (Renew 1 Year)' },
    { keys: 'Ctrl + Shift + R', cat: 'Membership', desc: 'Reprint Selected Membership Card' },
    { keys: 'Ctrl + Shift + C', cat: 'Membership', desc: 'Copy selected Card Number to Clipboard' },
    { keys: 'Ctrl + Shift + Q', cat: 'Membership', desc: 'Regenerate QR/Barcode label' },

    { keys: 'Ctrl + Shift + T', cat: 'Printing', desc: 'Print Barcode Label' },
    { keys: 'Ctrl + Shift + M', cat: 'Printing', desc: 'Print Membership Card' },
    { keys: 'Ctrl + Shift + B', cat: 'Printing', desc: 'Print Customer Invoice Receipt' },

    { keys: 'Ctrl + K', cat: 'Search', desc: 'Open Command Palette' },
    { keys: 'Ctrl + /', cat: 'Search', desc: 'Open Keyboard Shortcuts Help' },
    { keys: 'Ctrl + F', cat: 'Search', desc: 'Open Global Search overlay' },
    { keys: 'Arrow Keys', cat: 'Search', desc: 'Navigate search results listing' },
    { keys: 'Enter', cat: 'Search', desc: 'Open highlighted search result' },

    { keys: 'Ctrl + Shift + X', cat: 'Miscellaneous', desc: 'Lock Showroom Terminal Screen' },
  ];

  const groupedShortcuts = docShortcuts.reduce((acc, curr) => {
    if (!acc[curr.cat]) acc[curr.cat] = [];
    acc[curr.cat].push(curr);
    return acc;
  }, {} as Record<string, typeof docShortcuts>);

  return (
    <ShortcutContext.Provider
      value={{
        registerShortcut,
        showToast,
        openHelpModal,
        openCommandPalette,
        isHelpOpen,
        isSearchOpen,
        setIsHelpOpen,
        setIsSearchOpen,
      }}
    >
      {children}

      {/* GLOBAL TOAST NOTIFICATIONS */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
              className="bg-slate-900/90 hover:bg-slate-900 border border-amber-500/30 backdrop-blur-md px-4 py-3 rounded-xl shadow-[0_4px_24px_rgba(212,175,55,0.15)] flex items-center justify-between gap-4 pointer-events-auto select-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Keyboard className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-slate-200 tracking-wide">{t.message}</span>
              </div>
              {t.keys && (
                <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 bg-black border border-white/5 rounded text-amber-500 uppercase">
                  {t.keys}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* KEYBOARD SHORTCUTS HELP MODAL */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[998] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative"
            >
              <header className="p-5 border-b border-slate-800 flex justify-between items-center select-none bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-amber-100 uppercase tracking-wider">Keyboard Shortcuts Reference</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 font-mono">Showroom Operator Quick Access Manual</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-500 flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="flex-1 p-6 overflow-y-auto scrollbar-thin space-y-8 bg-slate-950/40">
                {Object.keys(groupedShortcuts).map((category) => (
                  <div key={category} className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-500/80 font-mono border-b border-amber-500/10 pb-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      {category} Shortcuts
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {groupedShortcuts[category].map((shortcut, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-3 p-2.5 bg-slate-900/60 border border-white/[0.02] hover:border-amber-500/10 rounded-xl transition-all duration-300">
                          <span className="text-[11px] text-slate-300 leading-normal">{shortcut.desc}</span>
                          <span className="flex items-center gap-1 font-mono text-[9px] shrink-0 font-bold">
                            {shortcut.keys.split('+').map((k, kIdx) => (
                              <React.Fragment key={kIdx}>
                                {kIdx > 0 && <span className="text-slate-600 font-sans">+</span>}
                                <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-amber-400/90 rounded uppercase shadow">
                                  {k.trim()}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <footer className="p-4 bg-slate-900 border-t border-slate-800 text-center text-[9px] text-slate-500 font-mono uppercase tracking-widest select-none flex justify-center gap-4">
                <span>Esc to Close</span>
                <span>•</span>
                <span>Press anywhere to resume operation</span>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CENTRAL COMMAND PALETTE & GLOBAL SEARCH */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[998] flex items-start justify-center p-4 pt-[10vh]">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="bg-slate-900 border border-amber-500/25 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Search Header */}
              <div className="relative border-b border-slate-800 p-4 bg-slate-900 flex items-center gap-3">
                <Search className="w-5 h-5 text-amber-500/80 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleSearchKeys}
                  placeholder="Type to search garments, clients, suppliers, or commands..."
                  className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 text-sm py-1 font-sans"
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-500 flex items-center justify-center transition shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search Results */}
              <div className="flex-1 max-h-[380px] overflow-y-auto p-2.5 bg-slate-950/25 space-y-1 scrollbar-thin">
                {searchResults.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-sans text-xs">
                    <Search className="w-8 h-8 text-slate-800 mx-auto mb-2" />
                    No match found for <span className="text-amber-500 font-mono">"{searchQuery}"</span>. Try another keyword.
                  </div>
                ) : (
                  searchResults.map((result, idx) => {
                    const active = idx === selectedIndex;
                    return (
                      <button
                        key={result.id || idx}
                        onClick={() => {
                          result.action();
                          setIsSearchOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left focus:outline-none ${
                          active
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200'
                            : 'bg-transparent border border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Left icon wrapper */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                            active 
                              ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                              : 'bg-slate-950 border-white/[0.02] text-slate-500'
                          }`}>
                            {result.type === 'command' && (
                              result.id.startsWith('nav_') ? <QrCode className="w-4 h-4" /> : <Settings className="w-4 h-4" />
                            )}
                            {result.type === 'product' && <Shirt className="w-4 h-4" />}
                            {result.type === 'customer' && <Users className="w-4 h-4" />}
                            {result.type === 'supplier' && <Truck className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0">
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${
                              active ? 'text-amber-300' : 'text-slate-300'
                            }`}>
                              {result.name}
                            </span>
                            {result.details && (
                              <p className="text-[9px] text-slate-500 truncate mt-0.5 font-mono">{result.details}</p>
                            )}
                            {result.cat && (
                              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{result.cat}</p>
                            )}
                          </div>
                        </div>

                        {/* Right key hints or badges */}
                        <div className="flex items-center gap-1 font-mono text-[9px] shrink-0 font-bold">
                          {result.keys.split('+').map((k: string, kIdx: number) => (
                            <React.Fragment key={kIdx}>
                              {kIdx > 0 && <span className="text-slate-600 font-sans">+</span>}
                              <kbd className={`px-1.5 py-0.5 rounded uppercase ${
                                active
                                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-200 shadow'
                                  : 'bg-slate-950 border border-slate-800 text-slate-500'
                              }`}>
                                {k.trim()}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Navigation Helpers */}
              <footer className="p-3 bg-slate-900 border-t border-slate-800 text-center text-[9px] text-slate-500 font-mono uppercase tracking-widest select-none flex justify-center items-center gap-5">
                <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3 text-amber-500" /><ArrowDown className="w-3 h-3 text-amber-500" /> to navigate</span>
                <span>•</span>
                <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3 text-emerald-500" /> to select</span>
                <span>•</span>
                <span>esc to close</span>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ShortcutContext.Provider>
  );
};
