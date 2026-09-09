/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppState } from '../../context/StateContext';
import { ModuleName, ActionName, ROLES } from '../../utils/rbac';
import { ShieldAlert, Lock } from 'lucide-react';

interface PermissionGuardProps {
  module: ModuleName;
  action: ActionName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideIfDenied?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  module,
  action,
  children,
  fallback,
  hideIfDenied = false,
}) => {
  const { currentRole, checkPermission } = useAppState();
  const allowed = checkPermission(module, action);

  if (allowed) {
    return <>{children}</>;
  }

  if (hideIfDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2">
      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
      <span>
        Insufficient Permission: <strong>{ROLES[currentRole]?.label || currentRole}</strong> role is not allowed to {action.replace(/_/g, ' ')} in {module}.
      </span>
    </div>
  );
};

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  module: ModuleName;
  action: ActionName;
  tooltipText?: string;
  showTooltipOnHover?: boolean;
  onUnauthorizedClick?: () => void;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  module,
  action,
  children,
  className = '',
  disabled,
  onClick,
  tooltipText,
  showTooltipOnHover = true,
  onUnauthorizedClick,
  ...props
}) => {
  const { currentRole, checkPermission } = useAppState();
  const allowed = checkPermission(module, action);
  const [showTooltip, setShowTooltip] = useState(false);

  const roleLabel = ROLES[currentRole]?.label || currentRole;
  const defaultTooltip = tooltipText || `Insufficient Permission: ${roleLabel} role cannot perform this action`;

  if (!allowed) {
    return (
      <div 
        className="relative inline-block cursor-not-allowed group/perm"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          {...props}
          type="button"
          disabled={true}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onUnauthorizedClick) {
              onUnauthorizedClick();
            } else {
              alert(defaultTooltip);
            }
          }}
          title={defaultTooltip}
          className={`${className} opacity-50 cursor-not-allowed select-none filter grayscale hover:grayscale-0 transition-all pointer-events-auto relative`}
        >
          {children}
        </button>

        {/* Floating Tooltip */}
        {showTooltipOnHover && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 border border-amber-500/30 text-amber-200 text-[11px] font-medium rounded-lg shadow-2xl whitespace-nowrap z-[9999] pointer-events-none flex items-center gap-1.5 animate-fadeIn">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{defaultTooltip}</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      {...props}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
};
