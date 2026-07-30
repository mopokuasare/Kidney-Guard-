'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { DashboardCard } from '@/components/DashboardCard';
import { PageHeader, Panel, StatusBadge } from '@/components/ui';
import { DonutChart, VBarChart } from '@/components/charts';
import {
  Activity,
  AlertTriangle,
  Target,
  Zap,
  UserPlus,
  BrainCircuit,
  PieChart,
  BarChart2,
  Bell,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const riskDistribution = [
  { label: 'Low', value: 612, color: '#10b981' },
  { label: 'Medium', value: 293, color: '#f59e0b' },
  { label: 'High', value: 231, color: '#f97316' },
  { label: 'Very High', value: 111, color: '#ef4444' },
];

const monthly = [
  { label: 'Feb', value: 180 },
  { label: 'Mar', value: 214 },
  { label: 'Apr', value: 198 },
  { label: 'May', value: 251 },
  { label: 'Jun', value: 233 },
  { label: 'Jul', value: 287, color: '#f97316' },
];

const recent = [
  { id: '#KG-2026-0845', name: 'Jane Smith', age: 62, risk: 68, status: 'HIGH', time: '2 min ago' },
  { id: '#KG-2026-0844', name: 'Robert Chen', age: 55, risk: 12, status: 'LOW', time: '15 min ago' },
  { id: '#KG-2026-0843', name: 'Maria Garcia', age: 71, risk: 85, status: 'VERY HIGH', time: '1 hr ago' },
  { id: '#KG-2026-0842', name: 'David Osei', age: 48, risk: 44, status: 'MEDIUM', time: '2 hr ago' },
  { id: '#KG-2026-0841', name: 'Amina Bello', age: 66, risk: 77, status: 'HIGH', time: '3 hr ago' },
];

const alerts = recent.filter((r) => r.risk >= 70);

export default function Dashboard() {
  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        subtitle="At-a-glance clinical overview · July 2026"
        actions={
          <>
            <Link href="/patients" className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-medium py-2 px-3 border border-slate-200 rounded-lg bg-white">
              <UserPlus size={16} />
              New Patient
            </Link>
            <Link href="/" className="flex-2 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20">
              <BrainCircuit size={16} />
              Run AI Prediction
            </Link>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
        <DashboardCard title="Assessments / Mo" value="287" subtitle="↑ 23.2% vs last mo" icon={Activity} />
        <DashboardCard title="High Risk Detected" value="342" subtitle="↑ 8.1% vs last mo" icon={AlertTriangle} />
        <DashboardCard title="Model AUC-ROC" value="0.987" subtitle="Accuracy 97.4%" icon={Target} />
        <DashboardCard title="Avg Prediction" value="0.3s" subtitle="↓ 15% faster" icon={Zap} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Risk Distribution" icon={PieChart}>
          <DonutChart data={riskDistribution} />
        </Panel>

        <Panel title="New Assessments vs Last Month" icon={BarChart2}>
          <VBarChart data={monthly} />
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
              <TrendingUp size={14} /> +23.2% assessments
            </div>
            <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
              <TrendingDown size={14} /> +8.1% high risk
            </div>
          </div>
        </Panel>
      </div>

      {/* Alerts */}
      <Panel
        title="Critical Alerts · > 70% Risk (Last 24h)"
        icon={Bell}
        className="mb-6"
        action={<span className="text-[10px] font-bold text-red-300 bg-red-500/20 px-2 py-1 rounded uppercase">{alerts.length} Flagged</span>}
      >
        <div className="flex flex-col gap-3">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-tight">{a.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{a.id} · Age {a.age}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-red-600">{a.risk}%</span>
                <StatusBadge status={a.status} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Recent Predictions */}
      <Panel
        title="Recent Predictions"
        icon={BarChart2}
        action={<Link href="/patients" className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">View All</Link>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Patient ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Age</th>
                <th className="px-4 py-3 text-center">Risk %</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{r.age}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">{r.risk}%</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right text-xs text-slate-400">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
