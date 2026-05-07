import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { label: string; value: string }[];
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <div className="relative flex items-center">
          <select
            ref={ref}
            className={cn(
              "appearance-none w-full bg-input-bg border border-transparent hover:border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-slate-900 font-medium transition-all outline-none cursor-pointer pr-10",
              className
            )}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>
    );
  }
);
SelectField.displayName = 'SelectField';
