/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  User,
  ShieldAlert, 
  Sparkles, 
  Loader2, 
  Eye,
  EyeOff,
  LogIn
} from 'lucide-react';
import { useAppState } from '../context/StateContext';
import { DynamicLogo } from './DynamicLogo';
import { safeLocalStorage, safeSessionStorage } from '../utils/safeStorage';
import { ROLES } from '../utils/rbac';
import { SystemUser } from '../types';

export const LoginScreen: React.FC = () => {
  const { loginWithCredentials, settings, addAuditLog } = useAppState();
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';
  
  // Form input states
  const [username, setUsername] = useState(() => safeLocalStorage.getItem('sf_remember_username') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => safeLocalStorage.getItem('sf_remember_me') === 'true');

  // UI status states
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success & welcome screen transition state
  const [showWelcome, setShowWelcome] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | null>(null);

  // Security attempt lockout states
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Load attempts and locks from localStorage on mount
  useEffect(() => {
    const savedAttempts = safeLocalStorage.getItem('sf_login_attempts');
    const savedLockUntil = safeLocalStorage.getItem('sf_login_lock_until');
    
    if (savedAttempts) {
      setAttempts(Number(savedAttempts));
    }
    
    if (savedLockUntil) {
      const until = Number(savedLockUntil);
      if (Date.now() < until) {
        setLockUntil(until);
        setSecondsLeft(Math.ceil((until - Date.now()) / 1000));
      } else {
        safeLocalStorage.removeItem('sf_login_lock_until');
        safeLocalStorage.setItem('sf_login_attempts', '0');
        setAttempts(0);
      }
    }
  }, []);

  // Countdown timer for security lockout
  useEffect(() => {
    if (!lockUntil) return;

    const timer = setInterval(() => {
      const diff = lockUntil - Date.now();
      if (diff <= 0) {
        setLockUntil(null);
        setAttempts(0);
        safeLocalStorage.removeItem('sf_login_lock_until');
        safeLocalStorage.setItem('sf_login_attempts', '0');
        clearInterval(timer);
      } else {
        setSecondsLeft(Math.ceil(diff / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lockUntil]);

  // Haptic feedback helper
  const triggerHaptic = (duration: any = 30) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch (e) {
      // Safely ignore if unsupported
    }
  };

  // Submit Login handler
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (lockUntil || isSubmitting) return;

    if (!username.trim() || !password) {
      setError('Invalid username or password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Simulate enterprise security validation delay
    await new Promise(resolve => setTimeout(resolve, 600));

    const result = loginWithCredentials(username, password);

    if (result.success && result.user) {
      triggerHaptic([60, 40, 80]);
      setAuthenticatedUser(result.user);
      
      // Save or clear remembered username
      if (rememberMe) {
        safeLocalStorage.setItem('sf_remember_username', username.trim());
        safeLocalStorage.setItem('sf_remember_me', 'true');
      } else {
        safeLocalStorage.removeItem('sf_remember_username');
        safeLocalStorage.setItem('sf_remember_me', 'false');
      }

      // Reset lockout counters
      safeLocalStorage.setItem('sf_login_attempts', '0');
      safeSessionStorage.setItem('sf_session_login_time', Date.now().toString());

      // Play welcome transition
      setShowWelcome(true);
    } else {
      triggerHaptic([100, 50, 100]); // Error vibration
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      safeLocalStorage.setItem('sf_login_attempts', newAttempts.toString());
      
      // Clear password field after failed attempt
      setPassword('');

      if (newAttempts >= 5) {
        const lockDuration = 5 * 60 * 1000; // 5 minutes
        const lockTime = Date.now() + lockDuration;
        setLockUntil(lockTime);
        safeLocalStorage.setItem('sf_login_lock_until', lockTime.toString());
        setSecondsLeft(300);
        addAuditLog('Account Lockout', `Terminal locked temporarily for 5 minutes due to 5 consecutive failed login attempts on username "${username}".`, 'System');
        setError('Maximum failed login attempts reached. System locked.');
      } else {
        // Standard non-revealing error message
        setError('Invalid username or password.');
      }
      setIsSubmitting(false);
    }
  };

  // Format lockout countdown string MM:SS
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Slowly drifting gold particles
  const goldParticles = React.useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 20 + 20,
      delay: Math.random() * -30,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,#141414,#080808,#020202)] flex flex-col relative overflow-hidden select-none font-sans text-white">
      
      {/* Radial Gradient Mesh Backdrop */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <motion.div 
          animate={{ opacity: [0.35, 0.65, 0.35] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.08)_0%,rgba(170,124,17,0.02)_45%,transparent_75%)]" 
        />
        <div className="absolute -top-[15%] -left-[15%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-amber-500/5 to-transparent blur-[140px] animate-pulse" style={{ animationDuration: '9s' }} />
        <div className="absolute -bottom-[15%] -right-[15%] w-[55%] h-[55%] rounded-full bg-gradient-to-tl from-amber-600/5 to-transparent blur-[140px] animate-pulse" style={{ animationDuration: '11s' }} />
      </div>

      {/* Luxury Curved Lines Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
        <svg className="w-full h-full object-cover" viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M-100 250 C 350 150, 600 700, 1100 450" stroke="url(#bg-gold-grad-1)" strokeWidth="1.5" strokeOpacity="0.6" />
          <path d="M-50 550 C 300 350, 550 850, 1050 550" stroke="url(#bg-gold-grad-2)" strokeWidth="1.25" strokeOpacity="0.45" />
          <path d="M150 -50 C 500 400, 300 750, 850 950" stroke="url(#bg-gold-grad-1)" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="4 4" />
          <path d="M300 1050 C 600 600, 800 200, 1100 -50" stroke="url(#bg-gold-grad-2)" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="3 3" />
          <defs>
            <linearGradient id="bg-gold-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#aa7c11" stopOpacity="0" />
              <stop offset="50%" stopColor="#d4af37" stopOpacity="1" />
              <stop offset="100%" stopColor="#aa7c11" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bg-gold-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0" />
              <stop offset="50%" stopColor="#f3e5ab" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#aa7c11" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating Gold Drift Particles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {goldParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-amber-400/30"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              boxShadow: '0 0 6px rgba(212, 175, 55, 0.4)',
            }}
            animate={{
              y: ['0vh', '-100vh'],
              opacity: [0, 0.7, 0.7, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!showWelcome ? (
          <motion.div
            key="login-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.4 }}
            className="w-full min-h-screen flex items-center justify-center p-4 relative z-10"
          >
            <motion.div
              key="login-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -15 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[440px] bg-zinc-950/70 backdrop-blur-xl border border-amber-500/20 shadow-[0_24px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(212,175,55,0.05)] rounded-3xl p-7 sm:p-9 relative z-10 flex flex-col justify-between"
              id="login-card"
            >
              {/* Gold Top Border Accent Line */}
              <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-amber-500/35 to-transparent" />

              <div>
                {/* Brand Logo & Title */}
                <div className="text-center mb-7 flex flex-col items-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="w-[68px] h-[68px] rounded-full border border-zinc-800 bg-black/60 mb-4 relative flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] overflow-hidden"
                  >
                    <div className="absolute inset-1.5 rounded-full border border-dashed border-amber-500/20 animate-[spin_32s_linear_infinite]" />
                    <div className="absolute inset-3 rounded-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center overflow-hidden p-2">
                      <DynamicLogo size="icon" variant="icon" className="w-9 h-9 object-contain" />
                    </div>
                  </motion.div>

                  {/* Title */}
                  <h1 className="font-serif text-2xl sm:text-3xl font-light tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 via-amber-200 to-amber-500/95 uppercase text-center leading-snug">
                    {storeName}
                  </h1>
                  <p className="text-[9px] tracking-[0.25em] uppercase text-amber-500 font-bold mt-2">
                    Showroom Management System
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium mt-1">
                    Sign in with your account credentials
                  </p>
                </div>

                {/* Locked Out Terminal HUD */}
                {lockUntil ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-6 text-center flex flex-col items-center space-y-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-red-950/20 border border-red-500/20 flex items-center justify-center mb-1">
                      <ShieldAlert className="w-7 h-7 text-red-500 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-red-400 tracking-wider uppercase">Security Lockout Active</h3>
                      <p className="text-[10px] text-zinc-400 max-w-xs leading-relaxed">
                        Multiple failed login attempts detected. Terminal access locked temporarily for security.
                      </p>
                    </div>
                    
                    {/* Countdown timer */}
                    <div className="bg-black/60 border border-zinc-800 px-5 py-3 rounded-xl">
                      <span className="font-mono text-2xl font-bold tracking-widest text-amber-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]">
                        {formatTime(secondsLeft)}
                      </span>
                    </div>
                    
                    <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-mono">
                      Security Cooldown in Progress
                    </p>
                  </motion.div>
                ) : (
                  /* Username + Password Login Form */
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    
                    {/* Username Field */}
                    <div className="space-y-1.5">
                      <label 
                        htmlFor="username-input" 
                        className="block text-[10px] font-bold uppercase tracking-wider text-amber-400/90"
                      >
                        Username
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                          <User className="w-4 h-4 text-amber-500/70" />
                        </div>
                        <input
                          id="username-input"
                          type="text"
                          required
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            if (error) setError('');
                          }}
                          placeholder="Enter your username"
                          autoComplete="username"
                          disabled={isSubmitting}
                          className="w-full bg-black/60 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-100 placeholder:text-zinc-600 transition duration-200 outline-none"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                      <label 
                        htmlFor="password-input" 
                        className="block text-[10px] font-bold uppercase tracking-wider text-amber-400/90"
                      >
                        Password
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 pointer-events-none text-zinc-500">
                          <Lock className="w-4 h-4 text-amber-500/70" />
                        </div>
                        <input
                          id="password-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError('');
                          }}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          disabled={isSubmitting}
                          className="w-full bg-black/60 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 rounded-xl py-2.5 pl-10 pr-10 text-xs font-medium text-slate-100 placeholder:text-zinc-600 transition duration-200 outline-none"
                        />
                        <button
                          type="button"
                          id="toggle-show-password"
                          onClick={() => {
                            triggerHaptic(10);
                            setShowPassword(!showPassword);
                          }}
                          className="absolute right-3 text-zinc-500 hover:text-amber-400 transition p-1 focus:outline-none"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Checkbox Options: Remember Me */}
                    <div className="flex items-center justify-start pt-1 text-[11px] text-zinc-400">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-zinc-700 bg-black text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                        />
                        <span>Remember Me</span>
                      </label>
                    </div>

                    {/* Error Message Alert */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-center gap-2 text-center"
                        >
                          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* LOGIN Button */}
                    <div className="pt-2">
                      <motion.button
                        id="login-button"
                        type="submit"
                        disabled={!username.trim() || !password || isSubmitting}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full text-black font-semibold tracking-[0.2em] uppercase text-[11px] py-3.5 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 focus:outline-none ${
                          username.trim() && password && !isSubmitting
                            ? 'gold-gradient hover:shadow-[0_0_24px_rgba(212,175,55,0.25)] hover:brightness-105 cursor-pointer'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-black" />
                            <span>Authenticating...</span>
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4 text-black shrink-0" />
                            <span>LOGIN</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </form>
                )}

              </div>

              {/* Footer Information */}
              <div className="mt-7 pt-4 border-t border-white/[0.04] text-center text-[9px] text-zinc-500 tracking-[0.2em] uppercase font-mono">
                Smart Fashion Enterprise © 2026
              </div>
            </motion.div>
          </motion.div>
        ) : (
          /* Welcome Splash Stage */
          <motion.div
            key="welcome-cinema-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center z-20 flex flex-col items-center justify-center space-y-5 w-full min-h-screen relative"
          >
            {/* Crown Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-20 h-20 rounded-full bg-gradient-to-b from-amber-400/10 to-transparent border border-amber-500/30 flex items-center justify-center relative shadow-[0_0_60px_rgba(212,175,55,0.1)] mb-3"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-dashed border-amber-400/20"
              />
              <Sparkles className="w-9 h-9 text-amber-500 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
            </motion.div>

            {/* Typography */}
            <div className="space-y-2">
              <motion.h3
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-zinc-400 font-light tracking-[0.25em] text-xs uppercase"
              >
                Welcome back,
              </motion.h3>
              
              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="font-serif text-3xl sm:text-4xl font-light tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-amber-100 drop-shadow-sm"
              >
                {authenticatedUser?.fullName || 'System User'}
              </motion.h2>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="pt-2 flex flex-col items-center gap-1"
              >
                <span className="inline-block px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-widest">
                  Role: {ROLES[authenticatedUser?.role || 'admin']?.label || authenticatedUser?.role}
                </span>
                <p className="text-[9px] text-zinc-500 uppercase tracking-[0.25em] pt-3">
                  Loading Workspace & Permissions...
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
