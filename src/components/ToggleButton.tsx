import { cn } from '@/lib/utils';

interface ToggleButtonProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const ToggleButton = ({ label, value, onChange }: ToggleButtonProps) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-full rounded-lg px-4 py-3 font-medium transition-all border outline-none",
          value
            ? "bg-slate-800 text-white border-slate-800 shadow-sm"
            : "bg-input-bg text-slate-900 border-transparent hover:border-slate-300"
        )}
      >
        {value ? 'Yes' : 'No'}
      </button>
    </div>
  );
};
