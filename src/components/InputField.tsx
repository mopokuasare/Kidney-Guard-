import React from 'react';
import { cn } from '@/lib/utils';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unit?: string;
  error?: string;
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, unit, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <div className="relative flex items-center">
          <input
            ref={ref}
            className={cn(
              "w-full bg-input-bg border border-transparent hover:border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 font-medium transition-all outline-none",
              unit && "pr-14",
              error && "border-red-400 focus:border-red-400 focus:ring-red-400 bg-red-50",
              className
            )}
            {...props}
          />
          {unit && (
            <span className="absolute right-4 text-xs font-medium text-slate-400">
              {unit}
            </span>
          )}
        </div>
        {error && <span className="text-[10px] font-medium text-red-500">{error}</span>}
      </div>
    );
  }
);
InputField.displayName = 'InputField';
