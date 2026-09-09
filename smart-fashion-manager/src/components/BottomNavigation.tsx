/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Shirt,
  Receipt,
  BarChart3,
  Menu,
  X,
  Users,
  Truck,
  CreditCard,
  Percent,
  Settings,
  LogOut,
  Sparkles,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { useAppState } from '../context/StateContext';
import { ModalPortal } from './common/ModalPortal';

interface BottomNavigationProps {
  currentView: string;
  setView: (view: string) => void;
  openAiAssistant: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentView,
  setView,
  openAiAssistant,
}) => {
  const { logout } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Shirt },
    { id: 'pos', label: 'POS', icon: Receipt, isFab: true },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const secondaryItems = [
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'exchange', label: 'Exchange', icon: RefreshCw },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'expenses', label: 'Expenses', icon: CreditCard },
    { id: 'promotions', label: 'Promotions', icon: Percent },
    { id: 'discount-cards', label: 'Discount Cards', icon: QrCode },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSecondaryClick = (id: string) => {
    setView(id);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Secondary Operations Drawer for Mobile */}
      {menuOpen && (
        <ModalPortal>
          <div className="md:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] transition-opacity">
            <div className="absolute bottom-0 inset-x-0 bg-slate-900 border-t border-amber-500/20 rounded-t-3xl p-6 pb-24 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-serif text-lg font-bold text-amber-100">Showroom Operations</h3>
                  <p className="text-[10px] text-slate-400">Additional luxury management options</p>
                </div>
                <button
                  id="close-mobile-menu"
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 rounded-full border border-slate-800 bg-slate-950 flex items-center justify-center text-amber-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {secondaryItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`mobile-subnav-${item.id}`}
                      onClick={() => handleSecondaryClick(item.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                        isActive
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1.5" />
                      <span className="text-[10px] font-semibold truncate w-full">{item.label}</span>
                    </button>
                  );
                })}
                
                {/* Mobile AI Quick Trigger */}
                <button
                  id="mobile-nav-ai"
                  onClick={() => {
                    setMenuOpen(false);
                    openAiAssistant();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-yellow-600/10 text-amber-400 text-center"
                >
                  <Sparkles className="w-5 h-5 mb-1.5 text-amber-400 animate-pulse" />
                  <span className="text-[10px] font-semibold">AI Partner</span>
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  id="mobile-logout"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider bg-red-500/5 transition flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Secure Sign-Out
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Primary Mobile Bottom Bar */}
      <nav className="no-print md:hidden fixed bottom-0 inset-x-0 h-16 bg-slate-900 border-t border-amber-500/10 flex justify-around items-center px-4 z-30 select-none pb-safe">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          if (item.isFab) {
            return (
              <button
                key={item.id}
                id={`mobile-nav-fab-${item.id}`}
                onClick={() => setView(item.id)}
                className="relative -top-4 w-14 h-14 rounded-full gold-gradient text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 border-4 border-slate-950 transform active:scale-95 transition-transform z-10"
              >
                <Icon className="w-6 h-6 stroke-[2.5]" />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={() => {
                setView(item.id);
                setMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium mt-0.5">{item.label}</span>
            </button>
          );
        })}

        {/* More Options Button */}
        <button
          id="mobile-nav-more"
          onClick={() => setMenuOpen(true)}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition ${
            menuOpen ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-medium mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
};
