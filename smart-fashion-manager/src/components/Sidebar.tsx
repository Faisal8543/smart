/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Shirt,
  Receipt,
  Users,
  Truck,
  BarChart3,
  CreditCard,
  Percent,
  Settings,
  LogOut,
  Sparkles,
  X,
  QrCode,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { useAppState } from '../context/StateContext';
import { ModalPortal } from './common/ModalPortal';

export interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
  openAiAssistant: () => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
  isPinned?: boolean;
  setIsPinned?: (pinned: boolean) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  openAiAssistant,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const { logout, currentRole } = useAppState();

  const menuSections = [
    {
      title: 'Dashboard',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, keys: 'Alt+1' },
      ],
    },
    {
      title: 'Sales',
      items: [
        { id: 'pos', label: 'POS Billing', icon: Receipt, keys: 'Alt+2' },
        { id: 'exchange', label: 'Product Exchange', icon: RefreshCw },
        { id: 'credit-ledger', label: 'Credit Ledger (Udhar)', icon: BookOpen },
        { id: 'promotions', label: 'Promotions & Offers', icon: Percent, keys: 'Alt+8' },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { id: 'products', label: 'Products & Catalog', icon: Shirt, keys: 'Alt+3' },
        { id: 'suppliers', label: 'Suppliers', icon: Truck, keys: 'Alt+5' },
      ],
    },
    {
      title: 'CRM',
      items: [
        { id: 'customers', label: 'Customers', icon: Users, keys: 'Alt+4' },
        { id: 'discount-cards', label: 'Discount Cards', icon: QrCode, keys: 'Alt+9' },
      ],
    },
    {
      title: 'Reports',
      items: [
        { id: 'reports', label: 'Sales Reports', icon: BarChart3, keys: 'Alt+6' },
        { id: 'expenses', label: 'Expenses', icon: CreditCard, keys: 'Alt+7' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { id: 'settings', label: 'Store Settings', icon: Settings, keys: 'Alt+0' },
      ],
    },
  ];

  // Filter sections based on role - only Admin gets access to Settings
  const filteredSections = menuSections.filter((section) => {
    if (section.title === 'Settings') {
      return currentRole === 'admin';
    }
    return true;
  });

  const handleItemClick = (id: string) => {
    setView(id);
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* 1. Compact Horizontal Top Navigation Bar */}
      <nav
        tabIndex={0}
        aria-label="Top Navigation"
        className="no-print w-full max-w-full min-w-0 bg-slate-950/95 border-t border-slate-900/80 px-2 sm:px-4 py-1.5 flex items-center overflow-x-auto custom-sidebar-scrollbar select-none z-30"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-max mx-auto md:mx-0">
          {filteredSections.map((section, sectionIdx) => (
            <React.Fragment key={section.title}>
              {sectionIdx > 0 && (
                <div className="h-4 w-px bg-slate-800/80 mx-1 sm:mx-1.5 shrink-0" />
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => handleItemClick(item.id)}
                    title={`${item.label}${item.keys ? ` (${item.keys})` : ''}`}
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 relative group shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-100 border border-amber-500/30 shadow-xs font-bold'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400'
                      }`}
                    />
                    <span className="whitespace-nowrap">{item.label}</span>

                    {/* Active Gold Bottom Accent Bar */}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full shadow-sm shadow-amber-500/50" />
                    )}

                    {/* Shortcut Badge */}
                    {item.keys && (
                      <span
                        className={`hidden xl:inline-block text-[9px] font-mono px-1 py-0.2 rounded tracking-tight shrink-0 border ${
                          isActive
                            ? 'bg-slate-950/80 border-amber-500/30 text-amber-400 font-bold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500 group-hover:text-amber-400/80'
                        }`}
                      >
                        {item.keys}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </nav>

      {/* 2. Responsive Mobile Drawer Navigation */}
      {isMobileOpen && (
        <ModalPortal>
          <div className="no-print fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 backdrop-blur-md animate-fadeIn">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-amber-100 uppercase tracking-wider text-sm">
                  Showroom Navigation
                </span>
              </div>
              <button
                id="btn-sidebar-mobile-close"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:text-white transition cursor-pointer"
                title="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {filteredSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70 border-b border-slate-800/80 pb-1">
                    {section.title}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          id={`mobile-drawer-nav-${item.id}`}
                          onClick={() => handleItemClick(item.id)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            isActive
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-100 font-bold'
                              : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-2">
              <button
                id="btn-sidebar-ai"
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                  openAiAssistant();
                }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ask AI Assistant</span>
              </button>

              <button
                id="sidebar-logout"
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider hover:bg-red-500/20 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Secure Sign-Out</span>
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

export const TopNavigation = Sidebar;
