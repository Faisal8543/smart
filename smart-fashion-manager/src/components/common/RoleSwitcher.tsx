/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../context/StateContext';
import { UserRole, ROLES } from '../../utils/rbac';
import { ShieldCheck, ChevronDown, Check } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { currentRole, setCurrentRole } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentRoleInfo = ROLES[currentRole] || ROLES.admin;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="btn-role-switcher"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 ${currentRoleInfo.badgeColor}`}
        title={`Current Role: ${currentRoleInfo.label}. Click to switch roles.`}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span className="font-sans text-[11px] font-bold tracking-wide uppercase">
          {currentRoleInfo.label}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-amber-500/20 rounded-xl shadow-2xl z-[1200] overflow-hidden animate-fadeIn">
          <div className="px-3.5 py-2.5 bg-slate-950 border-b border-amber-500/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                Select Active Role
              </span>
              <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                RBAC
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Switch roles to simulate action permissions in real-time.
            </p>
          </div>

          <div className="p-1.5 space-y-1">
            {(Object.keys(ROLES) as UserRole[]).map((roleKey) => {
              const roleData = ROLES[roleKey];
              const isSelected = currentRole === roleKey;

              return (
                <button
                  key={roleKey}
                  id={`role-option-${roleKey}`}
                  onClick={() => {
                    setCurrentRole(roleKey);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 font-bold'
                      : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${roleData.badgeColor}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{roleData.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5 line-clamp-2">
                      {roleData.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
