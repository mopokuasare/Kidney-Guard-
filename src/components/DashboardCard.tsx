import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
  icon: any;
}

export const DashboardCard = ({
  title,
  value,
  subtitle,
  trend,
  trendUp,
  icon: Icon
}: DashboardCardProps) => (
  <div className="bg-blue-50/50 rounded-xl md:rounded-2xl p-3 md:p-6 border border-blue-100/50 flex flex-col gap-2 md:gap-4 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-2 md:p-6 opacity-5 md:opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={32} className="text-accent md:w-12 md:h-12" />
    </div>

    <div className="flex flex-col gap-0.5 md:gap-1">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon size={12} className="md:w-4 md:h-4" />
        <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-xl md:text-3xl font-bold text-slate-900 leading-tight">{value}</div>
    </div>

    <div className="flex flex-col gap-0.5 md:gap-1">
      <div className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">
        {subtitle}
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-[8px] md:text-[10px] font-bold",
          trendUp ? "text-emerald-500" : "text-slate-400"
        )}>
          {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trend}
        </div>
      )}
    </div>
  </div>
);
