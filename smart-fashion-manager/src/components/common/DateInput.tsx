import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

export interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  iconPosition?: 'left' | 'right';
  containerClassName?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      label,
      iconPosition = 'left',
      containerClassName = '',
      className = '',
      disabled,
      id,
      onClick,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (inputRef.current) {
        if ('showPicker' in inputRef.current && typeof inputRef.current.showPicker === 'function') {
          try {
            inputRef.current.showPicker();
          } catch (err) {
            inputRef.current.focus();
          }
        } else {
          inputRef.current.focus();
        }
      }
    };

    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className={`flex flex-col gap-1 ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div
          onClick={handleContainerClick}
          className="group relative flex items-center cursor-pointer"
        >
          {iconPosition === 'left' && (
            <div className="absolute left-3 z-10 pointer-events-none flex items-center justify-center">
              <Calendar
                className={`w-4 h-4 transition-colors duration-150 ${
                  disabled
                    ? 'text-slate-600'
                    : 'text-amber-400/90 group-hover:text-amber-300'
                }`}
              />
            </div>
          )}

          <input
            ref={inputRef}
            id={inputId}
            type="date"
            disabled={disabled}
            onClick={(e) => {
              onClick?.(e);
              if ('showPicker' in e.currentTarget && typeof e.currentTarget.showPicker === 'function') {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }
            }}
            className={`peer w-full bg-slate-950 border border-slate-800 rounded-xl py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition disabled:bg-slate-900/50 disabled:text-slate-600 disabled:cursor-not-allowed ${
              iconPosition === 'left' ? 'pl-10 pr-3' : 'pl-3 pr-10'
            } ${className}`}
            {...props}
          />

          {iconPosition === 'right' && (
            <div className="absolute right-3 z-10 pointer-events-none flex items-center justify-center">
              <Calendar
                className={`w-4 h-4 transition-colors duration-150 ${
                  disabled
                    ? 'text-slate-600'
                    : 'text-amber-400/90 group-hover:text-amber-300'
                }`}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
