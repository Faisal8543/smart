/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StateProvider, useAppState } from './context/StateContext';
import { ShortcutProvider } from './context/ShortcutContext';
import { CreateAdminSetup } from './components/CreateAdminSetup';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { BottomNavigation } from './components/BottomNavigation';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { PosView } from './components/PosView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { ReportsView } from './components/ReportsView';
import { ExpensesView } from './components/ExpensesView';
import { PromotionsView } from './components/PromotionsView';
import { SettingsView } from './components/SettingsView';
import { DiscountCardsView } from './components/DiscountCardsView';
import { CreditLedgerView } from './components/CreditLedgerView';
import { ExchangeView } from './components/ExchangeView';
import { AiAssistant } from './components/AiAssistant';
import { DynamicLogo } from './components/DynamicLogo';
import { ROLES } from './utils/rbac';
import { Sparkles, ShieldAlert, Wifi, CloudLightning, Menu, User, Settings as SettingsIcon, LogOut, ChevronDown, Clock, KeyRound, CheckCircle2, X } from 'lucide-react';
import { ModalPortal } from './components/common/ModalPortal';

const AutoLockTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const resetTimer = () => {
      setTimeLeft(600);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1.5 text-[10px] bg-slate-900/90 border border-slate-800/80 px-2.5 py-1 rounded-full text-slate-400 font-mono select-none">
      <Clock className="w-3 h-3 text-amber-500/80" />
      <span className="text-[9px] font-bold text-amber-200/90">{formatted}</span>
    </div>
  );
};

const ShowroomAppContent: React.FC = () => {
  const { isAuthenticated, logout, settings, currentRole, setCurrentRole, currentUserId, systemUsers, changePin } = useAppState();
  const [currentView, setCurrentView] = useState(() => {
    const rawHash = window.location.hash.slice(1);
    const hash = rawHash.split('/')[0];
    const allowedViews = ['pos', 'dashboard', 'credit-ledger', 'exchange', 'products', 'customers', 'suppliers', 'reports', 'expenses', 'promotions', 'discount-cards', 'settings'];
    if (hash && allowedViews.includes(hash)) return hash;
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (path && allowedViews.includes(path)) return path;
    return 'pos';
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Change password form state
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLElement>(null);

  const [headerHeight, setHeaderHeight] = useState(120);

  // Dynamic Header Height Tracking for pixel-perfect content offset
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.getBoundingClientRect().height;
        if (height > 0) {
          const rounded = Math.ceil(height);
          setHeaderHeight(rounded);
          document.documentElement.style.setProperty('--header-height', `${rounded}px`);
          document.documentElement.style.setProperty('--app-header-height', `${rounded}px`);
        }
      }
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeight();
    });

    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [isAuthenticated, currentView]);

  const currentUser = (currentUserId ? systemUsers.find((u) => u.id === currentUserId && u.status === 'active') : null)
    || systemUsers.find((u) => u.role === currentRole && u.status === 'active')
    || systemUsers[0]
    || {
      id: 'usr_admin',
      fullName: 'System Administrator',
      username: 'admin',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  const handleSetView = (view: string) => {
    window.location.hash = view;
    setCurrentView(view.split('/')[0]);
  };

  // Sync hash changes back to state (e.g. Back/Forward browser navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.slice(1);
      const hash = rawHash.split('/')[0];
      const allowedViews = ['dashboard', 'pos', 'credit-ledger', 'exchange', 'products', 'customers', 'suppliers', 'reports', 'expenses', 'promotions', 'discount-cards', 'settings'];
      if (hash && allowedViews.includes(hash)) {
        setCurrentView(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    // Sync initial hash or default to pos billing
    if (!window.location.hash) {
      window.location.hash = currentView;
    }
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentView]);

  // When user logs in, ensure POS Billing (Products Bill) opens automatically
  const prevAuthRef = React.useRef(isAuthenticated);
  useEffect(() => {
    if (isAuthenticated) {
      // Upon successful login or when hash is login/settings/empty, default strictly to pos
      if (!prevAuthRef.current || !window.location.hash || window.location.hash === '#login' || window.location.hash === '#settings') {
        window.location.hash = 'pos';
        setCurrentView('pos');
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Inactivity automatic session lock (auto-lock after 10 mins of zero mouse movement)
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimeout = () => {
      clearTimeout(timeout);
      if (isAuthenticated) {
        timeout = setTimeout(() => {
          logout();
          try {
            alert('Showroom session locked automatically due to physical operator inactivity.');
          } catch (e) {
            console.warn('Alert blocked by iframe sandbox restrictions:', e);
          }
        }, 10 * 60 * 1000); // 10 minutes
      }
    };

    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keypress', resetTimeout);
    window.addEventListener('click', resetTimeout);
    resetTimeout();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keypress', resetTimeout);
      window.removeEventListener('click', resetTimeout);
    };
  }, [isAuthenticated, logout]);

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasActiveAdmin = systemUsers.some((u) => u.role === 'admin' && u.status === 'active');

  if (systemUsers.length === 0 || !hasActiveAdmin) {
    return <CreateAdminSetup />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Map view keys to custom components
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView setView={handleSetView} openAiAssistant={() => setAiOpen(true)} />;
      case 'pos':
        return <PosView />;
      case 'credit-ledger':
        return <CreditLedgerView />;
      case 'exchange':
        return <ExchangeView />;
      case 'products':
        return <ProductsView />;
      case 'customers':
        return <CustomersView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'reports':
        return <ReportsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'promotions':
        return <PromotionsView />;
      case 'discount-cards':
        return <DiscountCardsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView setView={handleSetView} openAiAssistant={() => setAiOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative w-full max-w-full overflow-x-hidden">
      
      {/* Global Fixed Header - Top Bar & Horizontal Top Navigation */}
      <header ref={headerRef} className="no-print fixed top-0 left-0 right-0 w-full max-w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-900 z-40 select-none shadow-xl">
        {/* Top Application Header */}
        <div className="h-[52px] px-4 sm:px-6 flex justify-between items-center border-b border-slate-900/80 w-full max-w-full">
          <div className="flex items-center gap-2.5">
            {/* Mobile View: Hamburger menu to trigger Off-canvas Drawer & Store Branding */}
            <button
              id="btn-mobile-sidebar-toggle"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-500 hover:text-amber-400 transition cursor-pointer md:hidden"
              title="Open Menu Drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Store Branding Header */}
            <div className="flex items-center gap-2.5">
              <DynamicLogo size="icon" variant="icon" className="w-6 h-6 shrink-0" />
              <div>
                <h2 className="font-serif font-black text-xs sm:text-sm text-amber-100 uppercase tracking-widest leading-none">
                  {settings.storeProfile.name || 'SMART FASHION'}
                </h2>
                <p className="text-[8px] uppercase tracking-widest text-amber-500/60 font-semibold leading-none mt-0.5 hidden xs:block">
                  Luxury Showroom
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online Status Badge */}
            <div className="flex items-center gap-1.5 text-[10px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full text-slate-400">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono text-[9px] text-slate-300 font-bold hidden xs:inline">POS LOCAL DB (ONLINE)</span>
                  <span className="font-mono text-[9px] text-slate-300 font-bold xs:hidden">ONLINE</span>
                </>
              ) : (
                <>
                  <CloudLightning className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span className="font-mono text-[9px] text-amber-400 font-bold hidden xs:inline">OFFLINE SAFE MODE</span>
                  <span className="font-mono text-[9px] text-amber-400 font-bold xs:hidden">OFFLINE</span>
                </>
              )}
            </div>

            {/* Reserved Fixed-Width Container for AutoLockTimer */}
            <div 
              id="autolock-timer-container" 
              className="w-20 sm:w-24 h-8 shrink-0 flex items-center justify-center"
            >
              <AutoLockTimer />
            </div>

            {/* Sparkles AI button */}
            <button
              id="header-ai-toggle"
              onClick={() => setAiOpen(true)}
              className="relative p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 transition cursor-pointer shrink-0"
              title="Open AI Business Partner"
            >
              <Sparkles className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            </button>

            {/* User Profile Avatar Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                id="header-user-profile-toggle"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 pl-2 pr-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-200 hover:text-white transition cursor-pointer"
                title="User Account Menu"
                aria-expanded={isProfileMenuOpen}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-xs shadow-md border border-amber-300/30">
                  <User className="w-4 h-4 text-slate-950" />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-200 leading-none">{currentUser.fullName}</span>
                  <span className="text-[9px] text-amber-400/80 font-medium leading-none mt-1 uppercase tracking-wider">{ROLES[currentRole]?.label || currentRole}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180 text-amber-400' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 py-2 animate-fadeIn overflow-hidden">
                  {/* User Info Header Section */}
                  <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md border border-amber-300/30 shrink-0">
                        <User className="w-5 h-5 text-slate-950" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-100 truncate">{currentUser.fullName}</span>
                        <span className="text-[10px] text-amber-400/90 font-mono font-medium truncate">@{currentUser.username}</span>
                      </div>
                    </div>

                    {/* Role Display (Read Only) */}
                    <div className="pt-2 border-t border-slate-855 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Role:</span>
                      <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px] uppercase px-2 py-0.5 rounded-md tracking-wider">
                        {ROLES[currentUser.role || currentRole]?.label || currentUser.role || currentRole}
                      </span>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="px-1.5 py-1.5 space-y-0.5">
                    {/* My Profile */}
                    <button
                      id="profile-dropdown-my-profile-btn"
                      onClick={() => {
                        setIsProfileModalOpen(true);
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-amber-300 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <User className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">My Profile</span>
                    </button>

                    {/* Change Password */}
                    <button
                      id="profile-dropdown-change-password-btn"
                      onClick={() => {
                        setIsChangePasswordModalOpen(true);
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-amber-300 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">Change Password</span>
                    </button>

                    {/* Account Settings */}
                    <button
                      id="profile-dropdown-settings-btn"
                      onClick={() => {
                        handleSetView('settings');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:text-amber-300 hover:bg-slate-800/80 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <SettingsIcon className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">Account Settings</span>
                    </button>
                  </div>

                  <div className="my-1 border-t border-slate-800/80" />

                  {/* Logout */}
                  <div className="px-1.5 py-1">
                    <button
                      id="profile-dropdown-logout-btn"
                      onClick={() => {
                        logout();
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span className="font-semibold">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 16px EMPTY DARK-NAVY SPACE */}
        <div id="header-nav-separation-gap" className="h-4 bg-slate-950 shrink-0 w-full" aria-hidden="true" />

        {/* Horizontal Top Navigation Row */}
        <Sidebar
          currentView={currentView}
          setView={handleSetView}
          openAiAssistant={() => setAiOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
      </header>

      {/* Main Body Container starting below the fixed header */}
      <div className="flex-1 flex flex-col min-h-screen w-full max-w-full min-w-0">
        {/* View viewport */}
        <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--header-height))] transition-all duration-300 ease-in-out min-w-0 w-full max-w-full">
          <main 
            id="main-app-content-container"
            className="flex-1 px-4 sm:px-6 md:px-8 pb-24 md:pb-8 w-full max-w-[1920px] mx-auto min-w-0"
            style={{ 
              paddingTop: `calc(var(--header-height, ${headerHeight}px) + 16px)` 
            }}
          >
            {renderView()}
          </main>

          {/* Mobile Navigation Bottom Bar (Hidden on Desktop) */}
          <div className="block md:hidden">
            <BottomNavigation currentView={currentView} setView={handleSetView} openAiAssistant={() => setAiOpen(true)} />
          </div>
        </div>
      </div>

      {/* My Profile Modal */}
      {isProfileModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-amber-100">My Profile</h3>
                    <p className="text-[10px] text-slate-400">Active showroom account credentials & role info</p>
                  </div>
                </div>
                <button
                  id="close-profile-modal-btn"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-base shadow shrink-0">
                    <User className="w-5 h-5 text-slate-950" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-100 text-sm truncate">{currentUser.fullName}</h4>
                    <p className="text-[11px] text-amber-400 font-mono">@{currentUser.username}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">Assigned Role</span>
                    <span className="text-amber-300 font-bold">{ROLES[currentRole]?.label || currentRole}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                    <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">Account Status</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg col-span-2">
                    <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">Showroom Branch</span>
                    <span className="text-slate-200 truncate block">{settings.storeProfile.name || 'Milan Galleria - Smart Fashion'}</span>
                  </div>
                </div>

                {/* Role Capabilities */}
                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Role Capabilities</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {ROLES[currentRole]?.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Change Password Modal */}
      {isChangePasswordModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-amber-500/20 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-amber-100">Change Password</h3>
                    <p className="text-[10px] text-slate-400">Update security PIN / password for @{currentUser.username}</p>
                  </div>
                </div>
                <button
                  id="close-password-modal-btn"
                  onClick={() => {
                    setIsChangePasswordModalOpen(false);
                    setPasswordError('');
                    setPasswordSuccess('');
                    setCurrentPassInput('');
                    setNewPassInput('');
                    setConfirmPassInput('');
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passwordError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPasswordError('');
                  setPasswordSuccess('');

                  if (!currentPassInput) {
                    setPasswordError('Please enter your current password.');
                    return;
                  }
                  if (newPassInput.length < 4) {
                    setPasswordError('New password must be at least 4 characters long.');
                    return;
                  }
                  if (newPassInput !== confirmPassInput) {
                    setPasswordError('New password and confirmation do not match.');
                    return;
                  }

                  const success = changePin(currentPassInput, newPassInput);
                  if (success) {
                    setPasswordSuccess('Password updated successfully!');
                    setCurrentPassInput('');
                    setNewPassInput('');
                    setConfirmPassInput('');
                    setTimeout(() => {
                      setIsChangePasswordModalOpen(false);
                      setPasswordSuccess('');
                    }, 1500);
                  } else {
                    setPasswordError('Incorrect current password.');
                  }
                }}
                className="space-y-3.5 text-xs"
              >
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordModalOpen(false);
                      setPasswordError('');
                      setPasswordSuccess('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Slide-out AI Assistant Sidebar */}
      <AiAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <StateProvider>
      <ShortcutProvider>
        <ShowroomAppContent />
      </ShortcutProvider>
    </StateProvider>
  );
}
