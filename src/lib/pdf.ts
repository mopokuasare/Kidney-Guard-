import { jsPDF } from 'jspdf';
import { FEATURE_LABELS, FEATURE_UNITS, RISK_COLORS, type RiskAssessment, type PatientFeatures } from '@/lib/ckdService';

export interface PdfMeta {
  patientName?: string;
  age?: string | number;
  clinician?: string;
}

/**
 * Build a one-page clinical summary PDF from a risk assessment and download it.
 * Pure client-side (jsPDF) — no server round-trip.
 */
export function generateSummaryPdf(resp: RiskAssessment, meta: PdfMeta = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 116;

  const line = (h = 16) => (y += h);
  const text = (s: string, x: number, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? [30, 41, 59]));
    doc.text(s, x, y);
  };

  // ── Header band ──
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('KidneyGuard', marginX, 44);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Kidney Disease Risk Assessment — Clinical Summary', marginX, 62);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - marginX, 44, { align: 'right' });

  // ── Patient block ──
  text('PATIENT', marginX, { bold: true, size: 9, color: [100, 116, 139] });
  line(18);
  const patientLines: [string, string][] = [
    ['Name', meta.patientName || '—'],
    ['Age', meta.age != null && meta.age !== '' ? `${meta.age}` : `${resp.patient_features?.age ?? '—'}`],
    ['Clinician', meta.clinician || '—'],
  ];
  patientLines.forEach(([k, v]) => {
    text(k, marginX, { color: [100, 116, 139] });
    text(v, marginX + 90, { bold: true });
    line();
  });
  line(10);

  // ── Risk result ──
  const tierColor = hexToRgb(RISK_COLORS[resp.risk_level] || '#334155');
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y - 6, pageW - marginX * 2, 72, 8, 8, 'FD');
  text('CLINICAL ASSESSMENT', marginX + 16, { size: 9, color: [100, 116, 139] });
  line(26);
  // Risk level leads; the percentage supports it. `predicted_class` flips at the
  // F1-optimal threshold rather than a band edge, so it reads as a footnote.
  text(resp.risk_level, marginX + 16, { bold: true, size: 20, color: tierColor });
  text(`${resp.kd_risk_percentage} · ${resp.urgency}`, marginX + 220, { bold: true, size: 12, color: tierColor });
  line(20);
  text(`Screening result: ${resp.predicted_class}   |   threshold ${(resp.threshold_used * 100).toFixed(1)}%`, marginX + 16, { size: 9, color: [71, 85, 105] });
  line(30);

  // ── Suggested action ──
  text('SUGGESTED ACTION', marginX, { bold: true, size: 9, color: [100, 116, 139] });
  line(16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const action = doc.splitTextToSize(resp.action || '', pageW - marginX * 2);
  doc.text(action, marginX, y);
  line(action.length * 13 + 12);

  // ── Clinical values ──
  text('CLINICAL VALUES', marginX, { bold: true, size: 9, color: [100, 116, 139] });
  line(18);
  const pf = (resp.patient_features || {}) as Partial<Record<keyof PatientFeatures, number>>;
  const feats = Object.keys(FEATURE_LABELS) as (keyof PatientFeatures)[];
  const colW = (pageW - marginX * 2) / 2;
  let col = 0;
  feats.forEach((code) => {
    const x = marginX + col * colW;
    const raw = pf[code];
    let val = raw != null ? `${raw}` : '—';
    if (code === 'diabetes_diagnosed' || code === 'ever_smoked') val = raw ? 'Yes' : 'No';
    else if (raw != null && FEATURE_UNITS[code]) val = `${raw} ${FEATURE_UNITS[code]}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${FEATURE_LABELS[code]}:`, x, y);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(val, x + colW - 90, y);
    col = col === 0 ? 1 : 0;
    if (col === 0) line(16);
  });
  if (col === 1) line(16);
  line(8);

  // ── Provenance ──
  text(`Model: ${resp.model}`, marginX, { size: 8, color: [100, 116, 139] });
  line(12);
  text(`Dataset: ${resp.dataset}  |  ${resp.standard}`, marginX, { size: 8, color: [100, 116, 139] });
  line(20);

  // ── Disclaimer ──
  doc.setDrawColor(251, 191, 36);
  doc.setFillColor(255, 251, 235);
  const disc = doc.splitTextToSize(resp.disclaimer || 'Decision support only.', pageW - marginX * 2 - 24);
  const discH = disc.length * 12 + 20;
  doc.roundedRect(marginX, y - 4, pageW - marginX * 2, discH, 6, 6, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text(disc, marginX + 12, y + 12);

  const safeName = (meta.patientName || 'patient').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  doc.save(`kidneyguard_${safeName}_${Date.now()}.pdf`);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.replace(/(.)/g, '$1$1') : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
