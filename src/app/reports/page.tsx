'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { SelectField } from '@/components/SelectField';
import { InputField } from '@/components/InputField';
import { PageHeader, Panel, StatusBadge } from '@/components/ui';
import {
  FileText,
  FileDown,
  Users,
  ClipboardCheck,
  Phone,
  Sliders,
  CalendarClock,
  Mail,
  FileSpreadsheet,
} from 'lucide-react';

const reportTypes = [
  { icon: FileText, title: 'Clinical Summary Report', desc: 'Patient-wise PDF with labs, risk score & recommendations', tag: 'PDF' },
  { icon: Users, title: 'Bulk Monthly Report', desc: 'All patients screened this month, % high risk', tag: 'PDF' },
  { icon: ClipboardCheck, title: 'Compliance Report', desc: 'Patients screened vs. target', tag: 'PDF' },
  { icon: Phone, title: 'High-Risk Follow-up List', desc: 'Auto-generated call list for > 70% risk', tag: 'CSV' },
];

const highRisk = [
  { id: '#KG-2026-0843', name: 'Maria Garcia', risk: 85, phone: '+233 55 111 2222', status: 'VERY HIGH' },
  { id: '#KG-2026-0841', name: 'Amina Bello', risk: 77, phone: '+233 24 333 4444', status: 'HIGH' },
  { id: '#KG-2026-0845', name: 'Jane Smith', risk: 68, phone: '+233 20 555 6666', status: 'HIGH' },
];

const customFields = ['Patient ID', 'Name', 'Age', 'Gender', 'Creatinine', 'eGFR', 'Hemoglobin', 'Risk Score', 'Status', 'Assessment Date'];

export default function Reports() {
  const [fields, setFields] = useState<string[]>(['Patient ID', 'Name', 'Creatinine', 'Risk Score', 'Assessment Date']);
  const toggleField = (f: string) =>
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <AppShell>
      <PageHeader
        title="Generate Reports"
        subtitle="Audits, compliance and patient handouts"
      />

      {/* Quick report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {reportTypes.map((r) => (
          <div key={r.title} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 hover:border-accent/40 transition-colors group">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-accent shrink-0">
              <r.icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-slate-900">{r.title}</h3>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{r.tag}</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">{r.desc}</p>
              <button className="flex items-center gap-2 text-xs font-bold text-accent hover:text-accent-hover transition-colors">
                <FileDown size={14} /> Generate
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* High-risk list */}
      <Panel
        title="High-Risk Patient List · Follow-up Calls"
        icon={Phone}
        className="mb-6"
        action={<button className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1.5"><FileSpreadsheet size={14} /> Export CSV</button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[560px]">
            <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Patient ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Risk %</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {highRisk.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-center font-bold text-red-600">{p.risk}%</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{p.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Custom report builder */}
      <Panel title="Custom Report Builder" icon={Sliders} className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Select Fields</h3>
            <div className="flex flex-wrap gap-2">
              {customFields.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleField(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    fields.includes(f)
                      ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
                      : 'bg-input-bg text-slate-600 border-transparent hover:border-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 content-start">
            <SelectField label="Date Range" options={[
              { label: 'This month', value: 'month' },
              { label: 'This quarter', value: 'quarter' },
              { label: 'This year', value: 'year' },
            ]} />
            <SelectField label="Risk Level" options={[
              { label: 'All', value: 'all' },
              { label: 'High + Very High', value: 'high' },
            ]} />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-500">{fields.length} fields selected</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors">
              <FileSpreadsheet size={15} /> Export CSV
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-sidebar-bg hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors">
              <FileDown size={15} /> Export PDF
            </button>
          </div>
        </div>
      </Panel>

      {/* Scheduled reports */}
      <Panel title="Scheduled Reports" icon={CalendarClock}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <SelectField label="Frequency" options={[
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' },
            { label: 'Daily', value: 'daily' },
          ]} />
          <InputField label="Recipient Email" placeholder="hod@hospital.org" type="email" />
          <button className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-3 rounded-lg text-xs font-bold transition-all shadow-lg shadow-accent/20">
            <Mail size={15} /> Schedule Email
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between bg-blue-50/50 border border-blue-100/50 rounded-xl p-3">
          <span className="text-xs text-slate-600">Weekly summary → <span className="font-bold text-slate-900">head.of.nephrology@hospital.org</span> · Mondays 08:00</span>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded uppercase">Active</span>
        </div>
      </Panel>
    </AppShell>
  );
}
