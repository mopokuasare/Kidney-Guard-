'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DashboardCard } from '@/components/DashboardCard';
import { InputField } from '@/components/InputField';
import { SelectField } from '@/components/SelectField';
import { ToggleButton } from '@/components/ToggleButton';
import { PredictionsTable } from '@/components/PredictionsTable';
import {
  RefreshCw,
  UserPlus,
  Activity,
  AlertTriangle,
  Target,
  Zap,
  ClipboardList,
  Trash2,
  BrainCircuit,
  Stethoscope,
  FlaskConical,
  Heart,
  Menu
} from 'lucide-react';

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [comorbidities, setComorbidities] = useState({
    hypertension: false,
    diabetes: false,
    coronary: false,
    pedalEdema: false,
    anemia: false
  });

  const toggleComorbidity = (key: keyof typeof comorbidities) => {
    setComorbidities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-main-bg flex">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 p-3 md:p-8 transition-all">
        {/* Mobile Nav Header */}
        <div className="lg:hidden flex items-center gap-4 mb-4 bg-white p-3 -m-3 border-b border-slate-200 sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-xs">
              K
            </div>
            <span className="font-bold text-slate-900 text-sm">KidneyGuard</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-6">
          <div className="bg-blue-50/50 rounded-2xl p-4 md:p-6 border border-blue-100/50 flex-1 w-full">
            <h1 className="text-lg md:text-2xl font-bold text-slate-900 mb-1 leading-tight">Risk Assessment</h1>
            <p className="text-slate-500 text-[11px] md:text-sm">Input routine lab values for AI prediction</p>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-medium py-2">
              <RefreshCw size={16} />
              Reset
            </button>
            <button className="flex-2 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20">
              <UserPlus size={16} />
              New Patient
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
          <DashboardCard
            title="Total"
            value="1,247"
            subtitle="↑ 12.4% this mo"
            icon={Activity}
          />
          <DashboardCard
            title="High Risk"
            value="342"
            subtitle="↑ 8.1% vs last"
            icon={AlertTriangle}
          />
          <DashboardCard
            title="Accuracy"
            value="97.4%"
            subtitle="AUC: 0.987"
            icon={Target}
          />
          <DashboardCard
            title="Avg Time"
            value="0.3s"
            subtitle="↓ 15% faster"
            icon={Zap}
          />
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-xl md:rounded-3xl border border-slate-200 overflow-hidden">
          <div className="bg-sidebar-bg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white font-bold">
              <ClipboardList size={16} className="text-slate-400" />
              <span className="text-xs md:text-sm tracking-wide uppercase">Patient Data Entry</span>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              ID: <span className="text-slate-300">#KG-2026-0847</span>
            </div>
          </div>

          <div className="p-4 md:p-8">
            <form className="space-y-6 md:space-y-10">
              {/* Demographics */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList size={14} className="text-slate-400" />
                  <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Demographics</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  <InputField label="Patient Name" placeholder="John Doe" />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Age" placeholder="45" unit="yrs" />
                    <SelectField
                      label="Gender"
                      options={[
                        { label: 'Male', value: 'male' },
                        { label: 'Female', value: 'female' },
                      ]}
                    />
                  </div>
                </div>
              </section>

              {/* Vital Signs */}
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Heart size={16} className="text-slate-400" />
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vital Signs</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  <InputField label="Blood Pressure" placeholder="80" unit="mmHg" />
                  <InputField label="Specific Gravity" placeholder="1.02" />
                  <SelectField
                    label="Albumin Level"
                    options={[
                      { label: '0 (Normal)', value: '0' },
                      { label: '1 (Mild)', value: '1' },
                      { label: '2 (Moderate)', value: '2' },
                    ]}
                  />
                </div>
              </section>

              {/* Laboratory Biomarkers */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical size={14} className="text-slate-400" />
                  <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Laboratory Biomarkers</h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-2 gap-x-3 md:gap-x-12 gap-y-4 md:gap-y-6">
                  <InputField label="Blood Glucose" placeholder="148" unit="mg/dL" />
                  <InputField label="Blood Urea" placeholder="36" unit="mg/dL" />
                  <InputField label="Creatinine" placeholder="1.2" unit="mg/dL" />
                  <InputField label="Sodium" placeholder="135" unit="mEq/L" />
                  <InputField label="Potassium" placeholder="4.5" unit="mEq/L" />
                  <InputField label="Hemoglobin" placeholder="12.5" unit="g/dL" />
                  <InputField label="Packed Vol" placeholder="38" unit="%" />
                  <InputField label="WBC Count" placeholder="7800" unit="µL" />
                </div>
              </section>

              {/* Comorbidities */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Stethoscope size={14} className="text-slate-400" />
                  <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Comorbidities</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
                  <ToggleButton label="Hypertension" value={comorbidities.hypertension} onChange={() => toggleComorbidity('hypertension')} />
                  <ToggleButton label="Diabetes" value={comorbidities.diabetes} onChange={() => toggleComorbidity('diabetes')} />
                  <ToggleButton label="Coronary" value={comorbidities.coronary} onChange={() => toggleComorbidity('coronary')} />
                  <ToggleButton label="Edema" value={comorbidities.pedalEdema} onChange={() => toggleComorbidity('pedalEdema')} />
                  <ToggleButton label="Anemia" value={comorbidities.anemia} onChange={() => toggleComorbidity('anemia')} />
                  <SelectField
                    label="Appetite"
                    options={[
                      { label: 'Good', value: 'good' },
                      { label: 'Poor', value: 'poor' },
                    ]}
                  />
                </div>
              </section>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100">
                <button type="button" className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium py-2">
                  <Trash2 size={18} />
                  Clear Form
                </button>
                <button type="button" className="w-full sm:w-auto flex items-center justify-center gap-3 bg-sidebar-bg hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl transition-all font-bold shadow-xl shadow-slate-900/20">
                  <BrainCircuit size={20} />
                  Run AI Prediction
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Predictions Table */}
        <PredictionsTable />

        <div className="h-12" />
      </main>
    </div>
  );
}
