import { cn } from '@/lib/utils';
import { BarChart2 } from 'lucide-react';

const mockPredictions = [
  { id: '#KG-2026-0845', name: 'Jane Smith', age: 62, creatinine: 2.1, hemoglobin: 10.2, riskScore: '68%', status: 'HIGH', time: '2 min ago' },
  { id: '#KG-2026-0844', name: 'Robert Chen', age: 55, creatinine: 1, hemoglobin: 14.5, riskScore: '12%', status: 'LOW', time: '15 min ago' },
  { id: '#KG-2026-0843', name: 'Maria Garcia', age: 71, creatinine: 3.5, hemoglobin: 9.1, riskScore: '85%', status: 'VERY HIGH', time: '1 hr ago' },
];

const StatusBadge = ({ status }: { status: string }) => {
  const getStyles = () => {
    switch (status) {
      case 'LOW': return 'bg-emerald-100 text-emerald-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'VERY HIGH': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <span className={cn("px-2.5 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap", getStyles())}>
      {status}
    </span>
  );
};

export const PredictionsTable = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-6">
      <div className="bg-sidebar-bg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold">
          <BarChart2 size={18} className="text-slate-400" />
          <span className="text-sm">Recent Predictions</span>
        </div>
        <button className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">
          View All
        </button>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm text-left min-w-[800px]">
          <thead className="text-[10px] text-slate-500 uppercase font-bold bg-white border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 whitespace-nowrap">Patient ID</th>
              <th className="px-6 py-4 whitespace-nowrap">Name</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Age</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Creatinine</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Hemoglobin</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Risk Score</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Status</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockPredictions.map((pred) => (
              <tr key={pred.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-500">{pred.id}</td>
                <td className="px-6 py-4 font-medium text-slate-900 leading-tight">
                  <div className="max-w-[100px]">{pred.name}</div>
                </td>
                <td className="px-6 py-4 text-center text-slate-600">{pred.age}</td>
                <td className="px-6 py-4 text-center text-slate-600">{pred.creatinine}</td>
                <td className="px-6 py-4 text-center text-slate-600">{pred.hemoglobin}</td>
                <td className="px-6 py-4 text-center font-bold text-slate-900">{pred.riskScore}</td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge status={pred.status} />
                </td>
                <td className="px-6 py-4 text-right text-xs text-slate-400">{pred.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
