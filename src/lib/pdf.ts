import { jsPDF } from 'jspdf';
import { FEATURE_LABELS, type PredictionResponse } from '@/lib/ckdService';

export interface PdfMeta {
  patientName?: string;
  age?: string | number;
  sex?: string;
  clinician?: string;
  /** The clinical values that were submitted (keyed by feature code: hemo, sc, …). */
  inputs?: Record<string, number | string | undefined>;
}

/**
 * Build a one-page clinical summary PDF from a prediction and trigger download.
 * Pure client-side (jsPDF) — no server round-trip.
 */
export function generateSummaryPdf(resp: PredictionResponse, meta: PdfMeta = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

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
  doc.text('CKD Risk Assessment — Clinical Summary', marginX, 62);

  const generated = new Date().toLocaleString();
  doc.setFontSize(8);
  doc.text(`Generated: ${generated}`, pageW - marginX, 44, { align: 'right' });

  y = 116;

  // ── Patient block ──
  text('PATIENT', marginX, { bold: true, size: 9, color: [100, 116, 139] });
  line(18);
  const patientLines: [string, string][] = [
    ['Name', meta.patientName || '—'],
    ['Age', meta.age != null && meta.age !== '' ? `${meta.age}` : '—'],
    ['Sex', meta.sex ? capitalize(meta.sex) : '—'],
    ['Clinician', meta.clinician || '—'],
  ];
  patientLines.forEach(([k, v]) => {
    text(k, marginX, { color: [100, 116, 139] });
    text(v, marginX + 90, { bold: true });
    line();
  });

  line(10);

  // ── Risk result ──
  const pred = resp.prediction;
  const risk = resp.risk_stratification;
  const tierColor = hexToRgb(risk?.color || '#334155');

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y - 6, pageW - marginX * 2, 66, 8, 8, 'FD');

  text('CKD RISK PROBABILITY', marginX + 16, { size: 9, color: [100, 116, 139] });
  line(26);
  text(`${pred?.ckd_risk_probability ?? '—'}%`, marginX + 16, { bold: true, size: 24, color: tierColor });
  text(`${risk?.tier ?? ''} · ${pred?.predicted_class ?? ''}`, marginX + 120, { bold: true, size: 12, color: tierColor });
  line(20);
  text(risk?.suggested_action || '', marginX + 16, { size: 9, color: [71, 85, 105] });
  line(26);

  // ── eGFR ──
  const egfr = resp.egfr;
  if (egfr) {
    text('KIDNEY FUNCTION (eGFR)', marginX, { bold: true, size: 9, color: [100, 116, 139] });
    line(18);
    text(`${egfr.value} ${egfr.unit}`, marginX, { bold: true, size: 12 });
    text(`${egfr.stage}  (${egfr.equation})`, marginX + 150, { size: 10, color: [71, 85, 105] });
    line(24);
  }

  // ── Input values ──
  const inputs = meta.inputs;
  text('CLINICAL VALUES', marginX, { bold: true, size: 9, color: [100, 116, 139] });
  line(18);
  const feats = Object.entries(FEATURE_LABELS);
  const colW = (pageW - marginX * 2) / 2;
  let col = 0;
  const rowStartY = y;
  feats.forEach(([code, label], i) => {
    const x = marginX + col * colW;
    const val = inputs ? inputs[code] : undefined;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, x, y);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(val != null ? `${val}` : '—', x + colW - 60, y);
    col = col === 0 ? 1 : 0;
    if (col === 0) line(16);
    // keep track for the last odd item
    if (i === feats.length - 1 && col === 1) line(16);
  });
  if (y === rowStartY) line(16);

  line(12);

  // ── Disclaimer ──
  doc.setDrawColor(251, 191, 36);
  doc.setFillColor(255, 251, 235);
  const discY = y;
  const disc = doc.splitTextToSize(
    resp.disclaimer ||
      'This report is a decision-support estimate and must be confirmed by a qualified physician.',
    pageW - marginX * 2 - 24
  );
  const discH = disc.length * 12 + 20;
  doc.roundedRect(marginX, discY - 4, pageW - marginX * 2, discH, 6, 6, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text(disc, marginX + 12, discY + 12);

  const safeName = (meta.patientName || 'patient').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  doc.save(`kidneyguard_${safeName}_${Date.now()}.pdf`);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.replace(/(.)/g, '$1$1') : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
