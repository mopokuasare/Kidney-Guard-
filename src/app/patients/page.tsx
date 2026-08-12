'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import {
  getPatients,
  createPatient,
  getPatientAssessments,
  ageFromDob,
  type PatientSummary,
  type PredictionRow,
} from '@/lib/ckdService';
import { useT } from '@/lib/i18n';
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  X,
  BrainCircuit,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';

const tierToStatus = (tier?: string | null) =>
  tier === 'Low Risk' ? 'LOW'
    : tier === 'Moderate Risk' ? 'MEDIUM'
    : tier === 'High Risk' ? 'HIGH'
    : tier === 'Critical Risk' ? 'VERY HIGH'
    : 'MEDIUM';

export default function Patients() {
  const { t } = useT();
  const [patients, setPatients] = useState<PatientSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<PatientSummary | null>(null);

  const load = () => getPatients().then(setPatients);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.mrn ?? '').toLowerCase().includes(q)
    );
  }, [patients, query]);

  return (
    <AppShell>
      <PageHeader
        title={t('nav.patients')}
        subtitle="Patient register and assessment history"
        actions={
          <button
            onClick={() => setAdding(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20"
          >
            <UserPlus size={16} />
            New Patient
          </button>
        }
      />

      {adding && (
        <NewPatientForm
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); load(); }}
        />
      )}

      <Panel title="Patient Register" icon={Users}>
        {patients === null ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-12">
            <Loader2 size={16} className="animate-spin" /> {t('common.loading')}
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No patients registered yet"
            hint="Add a patient here, or simply type a name when running an assessment — a record is created automatically."
            action={
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-bold text-xs"
              >
                <UserPlus size={15} /> Add first patient
              </button>
            }
          />
        ) : (
          <>
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or medical record number…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No matching patients" hint={`Nothing matched “${query}”.`} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[720px]">
                  <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">MRN</th>
                      <th className="px-4 py-3 text-center">Age</th>
                      <th className="px-4 py-3 text-center">Assessments</th>
                      <th className="px-4 py-3 text-center">Latest Risk</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-right">Last Seen</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{p.full_name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.mrn || '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {ageFromDob(p.date_of_birth) ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{p.assessment_count}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {p.latest_risk != null ? `${p.latest_risk}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.latest_tier ? <StatusBadge status={tierToStatus(p.latest_tier)} /> : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400">
                          {p.last_assessed ? new Date(p.last_assessed).toLocaleDateString() : 'never'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight size={15} className="text-slate-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>

      {selected && <PatientDetail patient={selected} onClose={() => setSelected(null)} />}
    </AppShell>
  );
}

/* ── New patient ─────────────────────────────────────────────────────────── */

const NewPatientForm = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [form, setForm] = useState({
    full_name: '', mrn: '', date_of_birth: '', sex: '', phone: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createPatient({
      full_name: form.full_name,
      mrn: form.mrn,
      date_of_birth: form.date_of_birth,
      sex: (form.sex || null) as 'male' | 'female' | 'other' | null,
      phone: form.phone,
      notes: form.notes,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onCreated();
  };

  return (
    <Panel title="New Patient" icon={UserPlus} className="mb-6"
      action={
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X size={16} />
        </button>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Full name *" value={form.full_name} onChange={(v) => set('full_name', v)} required />
        <Field label="Medical record number" value={form.mrn} onChange={(v) => set('mrn', v)} />
        <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(v) => set('date_of_birth', v)} />
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sex</span>
          <select
            value={form.sex}
            onChange={(e) => set('sex', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
        <Field label="Notes" value={form.notes} onChange={(v) => set('notes', v)} />

        {error && (
          <p className="sm:col-span-2 lg:col-span-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}

        <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={busy || !form.full_name.trim()}
            className="flex items-center gap-2 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-xs"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Save patient
          </button>
          <button type="button" onClick={onClose} className="text-slate-500 text-xs font-bold px-3 py-2">
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
};

const Field = ({
  label, value, onChange, type = 'text', required,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) => (
  <label className="block">
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    <input
      type={type}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
    />
  </label>
);

/* ── Patient detail ──────────────────────────────────────────────────────── */

const PatientDetail = ({
  patient,
  onClose,
}: {
  patient: PatientSummary;
  onClose: () => void;
}) => {
  const [rows, setRows] = useState<PredictionRow[] | null>(null);

  useEffect(() => {
    getPatientAssessments(patient.id).then(setRows);
  }, [patient.id]);

  const points = (rows ?? []).map((r) => Number(r.risk_probability ?? 0));

  return (
    <Panel
      title={patient.full_name}
      icon={Users}
      className="mt-6"
      action={
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X size={16} />
        </button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Meta label="MRN" value={patient.mrn || '—'} />
        <Meta label="Age" value={String(ageFromDob(patient.date_of_birth) ?? '—')} />
        <Meta label="Sex" value={patient.sex ? patient.sex[0].toUpperCase() + patient.sex.slice(1) : '—'} />
        <Meta label="Phone" value={patient.phone || '—'} />
      </div>

      {rows === null ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-8">
          <Loader2 size={16} className="animate-spin" /> Loading history…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No assessments for this patient yet"
          hint="Run an assessment using this patient's name and it will appear here."
          action={
            <Link href="/" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-bold text-xs">
              <BrainCircuit size={15} /> Run assessment
            </Link>
          }
        />
      ) : (
        <>
          {points.length >= 2 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Risk over time
              </p>
              <Sparkline points={points} color="#ef4444" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[520px]">
              <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Creatinine</th>
                  <th className="px-4 py-3 text-center">BUN</th>
                  <th className="px-4 py-3 text-center">Risk</th>
                  <th className="px-4 py-3 text-center">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...rows].reverse().map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {r.inputs?.serum_creatinine ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {r.inputs?.blood_urea_nitrogen ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {r.risk_probability != null ? `${r.risk_probability}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={tierToStatus(r.tier)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
};

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{value}</p>
  </div>
);
