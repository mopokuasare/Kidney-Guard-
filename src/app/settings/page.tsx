'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { InputField } from '@/components/InputField';
import { SelectField } from '@/components/SelectField';
import { PageHeader, Panel } from '@/components/ui';
import {
  Users,
  BrainCircuit,
  Database,
  Bell,
  Plug,
  ScrollText,
  Palette,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

const users = [
  { name: 'Dr. Kwame Mensah', email: 'k.mensah@hospital.org', role: 'Admin' },
  { name: 'Dr. Ama Owusu', email: 'a.owusu@hospital.org', role: 'Doctor' },
  { name: 'Nurse Efua Sarpong', email: 'e.sarpong@hospital.org', role: 'Nurse' },
];

const roleStyles: Record<string, string> = {
  Admin: 'bg-orange-100 text-orange-700',
  Doctor: 'bg-blue-100 text-blue-700',
  Nurse: 'bg-emerald-100 text-emerald-700',
};

const auditLog = [
  { user: 'Dr. Ama Owusu', action: 'Viewed record #KG-2026-0845', time: 'Jul 30, 09:14' },
  { user: 'Dr. Kwame Mensah', action: 'Ran AI prediction #KG-2026-0847', time: 'Jul 30, 08:52' },
  { user: 'Nurse Efua Sarpong', action: 'Edited labs #KG-2026-0844', time: 'Jul 29, 16:40' },
];

const Toggle = ({ label, desc, defaultOn = false }: { label: string; desc: string; defaultOn?: boolean }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${on ? 'bg-accent' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
};

export default function Settings() {
  const [threshold, setThreshold] = useState(70);

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Admin control, safety & compliance"
      />

      {/* User management */}
      <Panel
        title="User Management · Roles & Access"
        icon={Users}
        className="mb-6"
        action={<button className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">+ Add User</button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[560px]">
            <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-center">Role</th>
                <th className="px-4 py-3 text-center">Can Predict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${roleStyles[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{u.role === 'Nurse' ? '—' : '✓'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Model settings */}
        <Panel title="Model Settings" icon={BrainCircuit}>
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">High-Risk Alert Threshold</label>
              <span className="text-sm font-bold text-accent">{threshold}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[#3b82f6]"
            />
            <p className="text-[11px] text-slate-500 mt-1">Patients at or above this score are flagged High Risk.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField label="Model Version" defaultValue="v2.1.0" readOnly />
            <InputField label="Last Trained" defaultValue="Jul 12, 2026" readOnly />
          </div>
          <button className="flex items-center gap-2 bg-sidebar-bg hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors">
            <RefreshCw size={15} /> Retrain Model
          </button>
        </Panel>

        {/* Data management */}
        <Panel title="Data Management" icon={Database}>
          <Toggle label="Automatic Daily Backup" desc="Encrypted backup to secure storage" defaultOn />
          <div className="border-t border-slate-100" />
          <div className="py-3">
            <SelectField label="Data Retention Policy" options={[
              { label: '5 years (recommended)', value: '5' },
              { label: '7 years', value: '7' },
              { label: '10 years', value: '10' },
            ]} />
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-1">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span className="text-xs text-emerald-700"><span className="font-bold">HIPAA / GDPR compliant.</span> All PHI encrypted at rest & in transit.</span>
          </div>
        </Panel>

        {/* Notifications */}
        <Panel title="Notifications" icon={Bell}>
          <Toggle label="Email alert for > 80% risk" desc="Notify care team of critical patients" defaultOn />
          <div className="border-t border-slate-100" />
          <Toggle label="SMS alert for > 80% risk" desc="Text on-call physician" />
          <div className="border-t border-slate-100" />
          <Toggle label="Weekly digest email" desc="Summary to department head" defaultOn />
        </Panel>

        {/* Integration */}
        <Panel title="Integration · EHR / LIS" icon={Plug}>
          <Toggle label="Connect Hospital EHR" desc="Auto-pull demographics & labs" defaultOn />
          <div className="border-t border-slate-100" />
          <Toggle label="Connect LIS (Lab System)" desc="Auto-import biomarker results" />
          <div className="mt-3">
            <InputField label="EHR Endpoint URL" placeholder="https://ehr.hospital.org/api" />
          </div>
        </Panel>
      </div>

      {/* Appearance */}
      <Panel title="Appearance" icon={Palette} className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField label="Clinic Name" defaultValue="KidneyGuard Clinic" />
          <SelectField label="Color Theme" options={[
            { label: 'Clinical Blue', value: 'blue' },
            { label: 'Teal', value: 'teal' },
            { label: 'Slate', value: 'slate' },
          ]} />
          <SelectField label="Lab Units" options={[
            { label: 'mg/dL (US)', value: 'mgdl' },
            { label: 'mmol/L (SI)', value: 'mmol' },
          ]} />
        </div>
      </Panel>

      {/* Audit log */}
      <Panel title="Audit Log · Access History" icon={ScrollText}>
        <div className="flex flex-col divide-y divide-slate-100">
          {auditLog.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                  {l.user.split(' ').slice(-1)[0][0]}
                </div>
                <div>
                  <div className="text-sm text-slate-900">{l.action}</div>
                  <div className="text-[11px] text-slate-500">{l.user}</div>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">{l.time}</span>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
