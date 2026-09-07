/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, UserPlus, Eye, EyeOff, AlertTriangle, Sparkles } from 'lucide-react';
import { useAppState } from '../context/StateContext';
import { DynamicLogo } from './DynamicLogo';

export const CreateAdminSetup: React.FC = () => {
  const { addSystemUser, loginWithCredentials, settings } = useAppState();
  const storeName = settings?.storeProfile?.name || 'SMART FASHION';

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full Name is required');
      return;
    }

    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 3) {
      setError('Password must be at least 3 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create primary admin account
      const result = addSystemUser({
        id: 'usr_admin',
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        password,
        role: 'admin',
        status: 'active',
      });

      if (!result.success) {
        setError(result.message || 'Failed to create administrator account');
        setIsSubmitting(false);
        return;
      }

      // Primary admin account successfully initialized

      // Authenticate and set active role to Admin
      loginWithCredentials(username.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during setup.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(212,175,55,0.12)] backdrop-blur-xl relative z-10 space-y-6"
      >
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1 shadow-lg">
            <DynamicLogo logoUrl={settings?.storeProfile?.logoUrl} storeName={storeName} className="w-10 h-10 object-contain" />
          </div>

          <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs font-mono tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            First Installation Setup
          </div>

          <h1 className="font-serif text-2xl font-bold text-amber-100 tracking-tight">
            Create Administrator Account
          </h1>

          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Welcome to {storeName}. No system administrator account exists yet. Create your primary admin account to initialize the showroom system.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-xs flex items-center gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              Administrator Full Name <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-setup-fullname"
              type="text"
              placeholder="e.g. System Administrator"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition"
              required
              autoFocus
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
              Admin Username <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
              <input
                id="input-setup-username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-xs text-amber-300 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition"
                required
              />
            </div>
          </div>

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-setup-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-3.5 pr-9 py-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                Confirm Password <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-setup-confirm-password"
                  type={showConfirmPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-3.5 pr-9 py-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Role Badge Info */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-medium">Assigned System Role:</span>
            </div>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              Primary Administrator
            </span>
          </div>

          {/* Submit Button */}
          <button
            id="btn-create-admin-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full gold-gradient text-slate-950 font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:opacity-95 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Initializing System...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                Create Admin Account & Initialize
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800/60 text-center">
          <p className="text-[10px] text-slate-500 font-mono">
            {storeName} Security Engine • Real Database Records Only
          </p>
        </div>
      </motion.div>
    </div>
  );
};
