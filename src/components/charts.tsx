export interface Slice {
  label: string;
  value: number;
  color: string;
}

export const DonutChart = ({ data, size = 180, thickness = 28 }: { data: Slice[]; size?: number; thickness?: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="rotate-90" transform={`rotate(90 ${size / 2} ${size / 2})`} style={{ fontSize: 22, fontWeight: 700, fill: '#0f172a' }}>
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-2 w-full">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
              <span className="text-slate-600">{d.label}</span>
            </div>
            <span className="font-bold text-slate-900">
              {d.value}
              <span className="text-slate-400 font-medium ml-1">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Horizontal bar chart ---------- */
export const HBarChart = ({ data }: { data: Slice[] }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-4">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">{d.label}</span>
            <span className="font-bold text-slate-900">{d.value}</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ---------- Vertical bar chart (grouped over time) ---------- */
export const VBarChart = ({ data, height = 180 }: { data: { label: string; value: number; color?: string }[]; height?: number }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
          <span className="text-[10px] font-bold text-slate-900">{d.value}</span>
          <div
            className="w-full max-w-[36px] rounded-t-md transition-all"
            style={{ height: `${(d.value / max) * 100}%`, background: d.color ?? '#3b82f6', minHeight: 4 }}
          />
          <span className="text-[9px] font-medium text-slate-400 uppercase">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ---------- Sparkline / trend line ---------- */
export const Sparkline = ({ points, color = '#3b82f6', width = 260, height = 70 }: { points: number[]; color?: string; width?: number; height?: number }) => {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => [i * step, height - ((p - min) / range) * (height - 8) - 4]);
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r={2.5} fill={color} />
      ))}
    </svg>
  );
};
