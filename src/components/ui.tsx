import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) => (
  <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-6">
    <div className="bg-blue-50/50 rounded-2xl p-4 md:p-6 border border-blue-100/50 flex-1 w-full">
      <h1 className="text-lg md:text-2xl font-bold text-slate-900 mb-1 leading-tight">{title}</h1>
      <p className="text-slate-500 text-[11px] md:text-sm">{subtitle}</p>
    </div>
    {actions && (
      <div className="flex items-center gap-2 w-full lg:w-auto">{actions}</div>
    )}
  </div>
);

export const Panel = ({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: any;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("bg-white rounded-xl md:rounded-2xl border border-slate-200 overflow-hidden", className)}>
    <div className="bg-sidebar-bg p-3 md:p-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-white font-bold">
        {Icon && <Icon size={16} className="text-slate-400" />}
        <span className="text-xs md:text-sm tracking-wide">{title}</span>
      </div>
      {action}
    </div>
    <div className="p-4 md:p-6">{children}</div>
  </div>
);

/* ---------- Section label (uppercase heading with icon) ---------- */
export const SectionLabel = ({ icon: Icon, children }: { icon?: any; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-4">
    {Icon && <Icon size={14} className="text-slate-400" />}
    <h2 className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{children}</h2>
  </div>
);

/* ---------- Status badge (shared color coding) ---------- */
export const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    LOW: 'bg-emerald-100 text-emerald-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    HIGH: 'bg-orange-100 text-orange-700',
    'VERY HIGH': 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn("px-2.5 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap", styles[status] ?? 'bg-slate-100 text-slate-700')}>
      {status}
    </span>
  );
};

/* ---------- AI disclaimer banner ---------- */
export const Disclaimer = ({ className }: { className?: string }) => (
  <div className={cn("flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4", className)}>
    <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
    <p className="text-[11px] md:text-xs text-amber-700 leading-relaxed">
      <span className="font-bold">AI prediction, not a diagnosis.</span> Results are decision-support
      estimates and must be confirmed by a qualified physician. Data is encrypted and access is
      role-based.
    </p>
  </div>
);

/* ---------- Honest empty state ----------
   Shown when nothing has been recorded yet. Deliberately states that there is
   no data rather than displaying sample figures, so nothing on screen can be
   mistaken for a real clinical result. */
export const EmptyState = ({
  title,
  hint,
  icon: Icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: any;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
    {Icon && (
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon size={20} className="text-slate-400" />
      </div>
    )}
    <p className="text-sm font-bold text-slate-700">{title}</p>
    {hint && <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ---------- Simple stat pill ---------- */
export const StatPill = ({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'orange' | 'red' | 'blue' }) => {
  const tones: Record<string, string> = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
    blue: 'text-accent',
  };
  return (
    <div className="bg-blue-50/50 rounded-xl p-3 md:p-4 border border-blue-100/50">
      <div className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-lg md:text-2xl font-bold leading-tight", tones[tone])}>{value}</div>
    </div>
  );
};
