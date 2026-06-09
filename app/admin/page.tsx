"use client";

import { useState, useEffect } from "react";

interface Phase {
  label: string;
  weeks: string;
  dose: string;
  units: string;
  ml: string;
  dates: string;
  status: "done" | "current" | "future";
}

interface Protocol {
  id: string;
  name: string;
  vendor: string;
  vialSize: string;
  bac: string;
  concentration: string;
  startDate: string;
  endDate: string | null;
  totalWeeks: number | null;
  vialsRemaining: number | string;
  color: string;
  bg: string;
  badge: string;
  urgent: boolean;
  urgentMsg?: string;
  phases: Phase[];
  notes: string[];
}

interface BloodMarker {
  marker: string;
  result: string;
  status: "critical" | "low" | "elevated" | "normal";
  flag: string;
}

interface ActionItem {
  text: string;
  deadline: string;
  priority: "critical" | "high" | "medium";
}

// ─── PROTOCOL DATA — Updated June 9, 2026 ────────────────────────────────────

const protocols: Protocol[] = [
  {
    id: "reta",
    name: "Retatrutide",
    vendor: "Kits4Less",
    vialSize: "10mg",
    bac: "2ml",
    concentration: "5mg/ml",
    startDate: "Mar 18, 2026",
    endDate: "Sep 13, 2026",
    totalWeeks: 27,
    vialsRemaining: 8,
    color: "#22c55e",
    bg: "#052e16",
    badge: "💉 GLP-1 (Weight Loss)",
    urgent: false,
    phases: [
      { label: "Phase 1a", weeks: "Wk 1–2", dose: "1mg", units: "20u", ml: "0.2ml", dates: "Mar 18–25", status: "done" },
      { label: "Phase 1b", weeks: "Wk 3–4", dose: "2mg", units: "40u", ml: "0.4ml", dates: "Mar 29–Apr 5", status: "done" },
      { label: "Phase 2", weeks: "Wk 5–8", dose: "3mg", units: "60u", ml: "0.6ml", dates: "Apr 12–May 3", status: "done" },
      { label: "Phase 3", weeks: "Wk 9–14", dose: "4mg", units: "80u", ml: "0.8ml", dates: "May 10–Jun 14", status: "current" },
      { label: "Phase 4", weeks: "Wk 15–22", dose: "5mg", units: "100u", ml: "1.0ml", dates: "Jun 21–Aug 9", status: "future" },
      { label: "Taper", weeks: "Wk 23–26", dose: "4mg", units: "80u", ml: "0.8ml", dates: "Aug 16–Sep 6", status: "future" },
      { label: "Final", weeks: "Wk 27", dose: "2mg", units: "40u", ml: "0.4ml", dates: "Sep 13", status: "future" },
    ],
    notes: [
      "Phase 3: 4mg = 80 units = 0.8ml weekly injection",
      "Escalation to 5mg Phase 4 on Jul 5 (post-bloodwork approval)",
      "Sunday morning injections only",
      "8 vials remaining = ~4 months supply",
      "Down 30 lbs: 205 → 175 lbs goal range 165-170 lbs",
    ],
  },
  {
    id: "trt",
    name: "Testosterone Cypionate (TRT)",
    vendor: "TRT Nation",
    vialSize: "100mg/mL",
    bac: "1ml",
    concentration: "100mg/mL",
    startDate: "May 18, 2026",
    endDate: "Ongoing",
    totalWeeks: null,
    vialsRemaining: "N/A",
    color: "#f59e0b",
    bg: "#2d1a00",
    badge: "🔴 TRT (Hormone)",
    urgent: false,
    phases: [
      { label: "Week 1–6", weeks: "May 18+", dose: "100mg", units: "0.5ml", ml: "0.5ml IM", dates: "Mon + Thu", status: "current" },
      { label: "TRT Protocol", weeks: "Ongoing", dose: "100mg", units: "0.5ml", ml: "0.5ml IM", dates: "Mon + Thu indefinite", status: "current" },
    ],
    notes: [
      "Secondary hypogonadism: Total T 59 ng/dL, LH 0.2, FSH 0.7",
      "100mg Test C Monday + Thursday (0.5ml per injection)",
      "Intramuscular injection (IM) - glute or quad",
      "Paired with HCG 250 IU to preserve testicular function",
      "Provider: Katie Romaniecki APRN, TRT Nation (813-413-1000)",
      "Baseline labs Jun 29-30 at Week 6 TRT window",
    ],
  },
  {
    id: "hcg",
    name: "HCG (Human Chorionic Gonadotropin)",
    vendor: "Kits4Less",
    vialSize: "10,000 IU",
    bac: "2ml",
    concentration: "5,000 IU/mL",
    startDate: "Apr 20, 2026",
    endDate: "Ongoing with TRT",
    totalWeeks: null,
    vialsRemaining: "Currently using",
    color: "#ec4899",
    bg: "#500724",
    badge: "🔵 Hormone Support",
    urgent: true,
    urgentMsg: "Testicular preservation support. Paired with TRT to prevent LH/FSH suppression.",
    phases: [
      { label: "Bridge", weeks: "Apr 20–24", dose: "500 IU", units: "10u", ml: "0.1ml", dates: "Daily x 5 days", status: "done" },
      { label: "Maintenance", weeks: "Apr 28+", dose: "250 IU", units: "5u", ml: "0.05ml", dates: "Mon + Thu", status: "current" },
    ],
    notes: [
      "250 IU = 5 units subcutaneous Monday + Thursday",
      "Timing: Same days as Test C injections (Mon+Thu AM)",
      "Purpose: Preserve testicular function, maintain LH/FSH signaling",
      "Supports natural testosterone production during TRT",
      "Lab monitoring: LH, FSH at baseline (Jun 29-30)",
    ],
  },
  {
    id: "cjc",
    name: "CJC-1295 + Ipamorelin (GH Pulse)",
    vendor: "Oath Research",
    vialSize: "10mg blend",
    bac: "3ml",
    concentration: "3.33mg/mL · 1.67mg/mL per peptide",
    startDate: "Apr 1, 2026",
    endDate: "Mid-July (transition to exogenous HGH)",
    totalWeeks: null,
    vialsRemaining: 2,
    color: "#3b82f6",
    bg: "#0c1a3a",
    badge: "🧬 GH Stimulation",
    urgent: false,
    phases: [
      { label: "Wk 1–2", weeks: "Apr 1–10", dose: "~167mcg each", units: "10u", ml: "0.1ml", dates: "Nightly", status: "done" },
      { label: "Wk 3+", weeks: "Apr 13+", dose: "~200mcg each", units: "12u", ml: "0.12ml", dates: "5x/week (Mon-Fri)", status: "current" },
    ],
    notes: [
      "12 units = 200mcg of each peptide = 0.12ml per injection",
      "Schedule: Mon-Fri nights fasted (2–3hr after last meal), Sat-Sun off",
      "Subcutaneous injection around abdomen/groin",
      "2 vials remaining = ~60 days supply through mid-July",
      "Transition: Switching to exogenous HGH (Whitebox 400 IU) mid-July",
      "Retest IGF-1 at Jun 29-30 labs (12 weeks on GH stimulation)",
    ],
  },
  {
    id: "ghk",
    name: "GHK-Cu (Copper Peptide)",
    vendor: "Kits4Less",
    vialSize: "50mg",
    bac: "3ml",
    concentration: "16.67mg/mL",
    startDate: "Apr 23, 2026",
    endDate: "Ongoing",
    totalWeeks: null,
    vialsRemaining: 9,
    color: "#14b8a6",
    bg: "#022c27",
    badge: "🩺 Skin & Collagen",
    urgent: true,
    urgentMsg: "Current vial expires ~Jun 22. Reconstitute backup by this date.",
    phases: [
      { label: "Week 1", weeks: "Apr 23–27", dose: "1.667mg", units: "10u", ml: "0.1ml", dates: "Daily AM", status: "done" },
      { label: "Maintenance", weeks: "Apr 28+", dose: "2mg", units: "13u", ml: "0.13ml", dates: "Daily AM", status: "current" },
      { label: "Combined (Jun 1+)", weeks: "Jun 1+", dose: "2mg", units: "13u", ml: "0.13ml", dates: "Combined syringe with BPC", status: "future" },
    ],
    notes: [
      "13 units = 2mg = 0.13ml daily subcutaneous",
      "Injection site: Lower abdomen or groin area",
      "Purpose: Treat jock itch hypopigmentation, collagen synthesis, liver support",
      "Liver support: AST baseline = 49 U/L (monitor at Jun 29-30 labs)",
      "Current vial expires ~Jun 22: reconstitute fresh vial by this date",
      "9 vials remaining = ~9 months supply",
      "From Jun 1: draw BPC-157 first, then GHK-Cu in same syringe",
    ],
  },
  {
    id: "bpc",
    name: "BPC-157 (Repair & Recovery)",
    vendor: "Kits4Less",
    vialSize: "10mg",
    bac: "2ml",
    concentration: "5mg/mL",
    startDate: "May 29, 2026",
    endDate: "Ongoing",
    totalWeeks: null,
    vialsRemaining: 10,
    color: "#a855f7",
    bg: "#1a0a2e",
    badge: "🐺 Daily Repair",
    urgent: false,
    phases: [
      { label: "Week 1", weeks: "May 29+", dose: "250mcg", units: "5u", ml: "0.05ml", dates: "SubQ every 3 days", status: "current" },
      { label: "Daily (Jun 1+)", weeks: "Jun 1+", dose: "500mcg", units: "10u", ml: "0.1ml", dates: "Daily AM SubQ", status: "future" },
    ],
    notes: [
      "Currently: 5 units every 3 days (May 29–May 31 only: Wolverine blend)",
      "Jun 1 onward: 10 units = 500mcg daily subcutaneous",
      "Injection site: Lower back (chronic pain) + abdomen rotation",
      "Combined injection (Jun 1+): Draw BPC first (10u), then GHK-Cu (13u) = 23u total",
      "Purpose: Tissue repair, systemic recovery, GI/joint support",
      "10 vials remaining = 200 days supply at 500mcg/day",
    ],
  },
];

// ─── BLOODWORK — April 10, 2026 ──────────────────────────────────────────────

const bloodwork: BloodMarker[] = [
  { marker: "Total T", result: "59 ng/dL", status: "critical", flag: "🔴" },
  { marker: "Free T", result: "7.7 pg/mL", status: "critical", flag: "🔴" },
  { marker: "LH", result: "0.2 mIU/mL", status: "critical", flag: "🔴" },
  { marker: "FSH", result: "0.7 mIU/mL", status: "critical", flag: "🔴" },
  { marker: "Estradiol", result: "<30 pg/mL", status: "normal", flag: "✅" },
  { marker: "Prolactin", result: "5.6 ng/mL", status: "normal", flag: "✅" },
  { marker: "IGF-1", result: "126 ng/mL", status: "low", flag: "⚠️" },
  { marker: "Vitamin D", result: "34 ng/mL", status: "low", flag: "⚠️" },
  { marker: "AST", result: "49 U/L", status: "elevated", flag: "🔴" },
  { marker: "LDL", result: "112 mg/dL", status: "low", flag: "⚠️" },
  { marker: "HbA1c", result: "4.9%", status: "normal", flag: "✅" },
];

const supplements = [
  "Vitamin D3 5000 IU + K2", "B12 1000mcg", "NAC 600mg", "Zinc 50mg",
  "Lion's Mane 1000mg", "Creatine 5g (AM)", "Magnesium Glycinate 350mg (PM)",
  "Ashwagandha KSM-66", "Boron 6–10mg", "LMNT electrolytes (4–7 packets/week)"
];

const actionItems: ActionItem[] = [
  { text: "Jun 22: GHK-Cu vial expires – reconstitute backup", deadline: "Before Jun 22", priority: "critical" },
  { text: "Jun 29-30: Function Health Test 1 (Week 6 TRT baseline)", deadline: "Jun 29-30", priority: "critical" },
  { text: "Bloodwork prep: Skip CJC/Ipa night of Jun 28, fast morning of draw", deadline: "Jun 28-29", priority: "high" },
  { text: "Review bloodwork results (Total T, Free T, LH, FSH, IGF-1, Liver panel)", deadline: "Jul 1-3", priority: "high" },
  { text: "Jul 5: Escalate Retatrutide to 5mg Phase 4 (if bloodwork clears)", deadline: "Jul 5", priority: "high" },
  { text: "Mid-July: Transition CJC/Ipa → exogenous HGH (Whitebox 400 IU)", deadline: "Mid-July", priority: "medium" },
  { text: "Jul 31: FIFA contract ends – career transition planning", deadline: "Jul 31", priority: "medium" },
  { text: "Dec 2026: Function Health Test 2 (6-month full protocol assessment)", deadline: "Dec 2026", priority: "medium" },
];

// ─── STORAGE ─────────────────────────────────────────────────────────────────

function load(key: string, fallback: Record<string, number>): Record<string, number> {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: Record<string, number>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function loadText(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveText(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Phase["status"] }) {
  const map = {
    done:    { bg: "#1a2e1a", color: "#4ade80", label: "✓ Done" },
    current: { bg: "#1a2010", color: "#facc15", label: "● Active" },
    future:  { bg: "#1a1a2e", color: "#60a5fa", label: "○ Upcoming" },
  };
  const s = map[status] || map.future;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {s.label}
    </span>
  );
}

function PhaseRow({ phase }: { phase: Phase }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0", borderBottom: "1px solid #1a1a1a", fontSize: 12, gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: phase.status === "done" ? "#4ade80" : phase.status === "current" ? "#facc15" : "#333",
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "#ccc" }}>{phase.label}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{phase.dates}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{phase.dose}</div>
        <div style={{ color: "#666", fontFamily: "monospace", fontSize: 11, minWidth: 36, textAlign: "right" }}>{phase.units}</div>
        <div style={{ color: "#444", fontFamily: "monospace", fontSize: 11, minWidth: 42, textAlign: "right" }}>{phase.ml}</div>
        <StatusBadge status={phase.status} />
      </div>
    </div>
  );
}

// ─── WEIGHT LOG ──────────────────────────────────────────────────────────────

const defaultWeights: Record<string, number> = { "1": 205, "3": 195, "6": 185, "12": 175 };
const CURRENT_WEEK = 13;
const STORAGE_KEY = "protocol_admin_weights";
const SUMMARY_STORAGE_KEY = "protocol_admin_summary";

const retaWeeks = Array.from({ length: 27 }, (_, i) => {
  const weekNum = i + 1;
  const d = new Date(2026, 2, 18 + i * 7);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { weekNum, dateStr };
});

function WeightLog({ weights, setWeights }: { weights: Record<string, number>; setWeights: (w: Record<string, number>) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [val, setVal] = useState("");

  const valid = Object.fromEntries(Object.entries(weights).filter(([, v]) => v != null));
  const start = weights["1"] || 205;
  const latestWk = Object.keys(valid).map(Number).sort((a, b) => b - a)[0];
  const latest = valid[String(latestWk)] || start;
  const lost = (start - latest).toFixed(1);

  const handleSave = (wk: number) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      const updated = { ...weights, [String(wk)]: n };
      setWeights(updated);
      save(STORAGE_KEY, updated);
    }
    setEditing(null);
    setVal("");
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Start Weight", value: `${start} lbs`, color: "#888" },
          { label: "Current Weight", value: `${latest} lbs`, color: "#22c55e" },
          { label: "Total Lost", value: `${lost} lbs`, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Weekly Log: Tap to Enter</div>
      {retaWeeks.map(({ weekNum, dateStr }) => {
        const isCurrent = weekNum === CURRENT_WEEK;
        const isPast = weekNum < CURRENT_WEEK;
        const isActive = isCurrent || isPast;
        const w = weights[String(weekNum)];
        const prevWks = Object.keys(valid).map(Number).filter(x => x < weekNum).sort((a, b) => b - a);
        const prev = prevWks.length ? valid[String(prevWks[0])] : null;
        const change = w && prev ? (w - prev).toFixed(1) : null;
        return (
          <div key={weekNum} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid #111",
            opacity: isActive ? 1 : 0.25,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: isCurrent ? "#22c55e" : w ? "#1a2e1a" : "#111",
                border: `1px solid ${isCurrent ? "#22c55e" : "#222"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                color: isCurrent ? "#000" : w ? "#22c55e" : "#444",
              }}>{weekNum}</div>
              <div>
                <div style={{ fontSize: 12, color: "#ccc" }}>
                  {dateStr}
                  {isCurrent && <span style={{ marginLeft: 8, fontSize: 9, background: "#22c55e", color: "#000", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>NOW</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {change && <span style={{ fontSize: 11, color: parseFloat(change) < 0 ? "#22c55e" : "#ef4444" }}>{parseFloat(change) > 0 ? "+" : ""}{change}</span>}
              {isActive && (editing === weekNum ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input type="number" step="0.1" value={val}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSave(weekNum)}
                    autoFocus
                    style={{ width: 70, background: "#111", border: "1px solid #22c55e", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 12, textAlign: "center", outline: "none" }}
                    placeholder="lbs" />
                  <button onClick={() => handleSave(weekNum)} style={{ background: "#22c55e", color: "#000", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓</button>
                  <button onClick={() => setEditing(null)} style={{ background: "#222", color: "#888", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <button onClick={() => { setEditing(weekNum); setVal(w ? String(w) : ""); }}
                  style={{ background: w ? "#1a2e1a" : "#111", border: `1px dashed ${w ? "#22c55e" : "#333"}`, borderRadius: 6, color: w ? "#22c55e" : "#444", padding: "4px 10px", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>
                  {w ? `${w} lbs` : "— tap"}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── PANELS ──────────────────────────────────────────────────────────────────

function BloodworkPanel() {
  const statusColor: Record<string, string> = { critical: "#ef4444", low: "#f59e0b", elevated: "#ef4444", normal: "#4ade80" };
  return (
    <div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
        Baseline: April 10, 2026 · Next Test: June 29-30 (Function Health Test 1)
      </div>
      {bloodwork.map((b, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 0", borderBottom: "1px solid #111",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12 }}>{b.flag}</span>
            <span style={{ fontSize: 13, color: "#ccc", fontWeight: 500 }}>{b.marker}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: statusColor[b.status] || "#888" }}>{b.result}</span>
        </div>
      ))}
      <div style={{ marginTop: 14, padding: "10px 12px", background: "#110a00", border: "1px solid #332200", borderRadius: 8, fontSize: 11, color: "#f59e0b", lineHeight: 1.6 }}>
        <strong>Jun 29-30 panel:</strong> Total T, Free T, LH, FSH, Estradiol (sensitive), IGF-1, CMP, Lipid+ApoB, hs-CRP, Vitamin D, HbA1c, Fasting Insulin
      </div>
    </div>
  );
}

function SupplementsPanel() {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Daily Supplement Stack</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {supplements.map((s, i) => (
          <span key={i} style={{
            background: "#111", border: "1px solid #222", borderRadius: 6,
            padding: "5px 10px", fontSize: 11, color: "#999",
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function ActionsPanel() {
  const pColor: Record<string, string> = { critical: "#ef4444", high: "#f59e0b", medium: "#3b82f6" };
  const pLabel: Record<string, string> = { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM" };
  return (
    <div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Critical Path: Jun 2026</div>
      {actionItems.map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 0", borderBottom: "1px solid #111",
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 3,
            background: pColor[a.priority] + "18", color: pColor[a.priority],
            letterSpacing: "0.08em", flexShrink: 0, marginTop: 2,
          }}>{pLabel[a.priority]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#ccc", fontWeight: 500 }}>{a.text}</div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{a.deadline}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryPanel({ summary, setSummary }: { summary: string; setSummary: (s: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(summary);

  const handleSave = () => {
    setSummary(tempText);
    saveText(SUMMARY_STORAGE_KEY, tempText);
    setIsEditing(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em" }}>Protocol Summary</div>
        <button 
          onClick={() => { setIsEditing(!isEditing); setTempText(summary); }}
          style={{ background: isEditing ? "#ef4444" : "#06b6d4", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {isEditing ? "Cancel" : "✎ Edit"}
        </button>
      </div>

      {isEditing ? (
        <div>
          <textarea 
            value={tempText}
            onChange={e => setTempText(e.target.value)}
            style={{
              width: "100%", minHeight: "400px", background: "#111", border: "1px solid #222", borderRadius: 8,
              color: "#ccc", padding: "12px", fontSize: 12, fontFamily: "monospace", lineHeight: 1.5,
              outline: "none", resize: "vertical"
            }}
            placeholder="Paste protocol summary here..."
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button 
              onClick={handleSave}
              style={{ flex: 1, background: "#06b6d4", color: "#fff", border: "none", borderRadius: 6, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              💾 Save
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              style={{ flex: 1, background: "#222", color: "#888", border: "none", borderRadius: 6, padding: "10px", fontSize: 12, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: 8, padding: "16px",
          fontSize: 12, color: "#ccc", lineHeight: 1.7, maxHeight: "600px", overflowY: "auto",
          whiteSpace: "pre-wrap", wordBreak: "break-word"
        }}>
          {summary || <span style={{ color: "#555" }}>No summary. Click "Edit" to add your protocol summary.</span>}
        </div>
      )}
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  ...protocols.map(p => ({ id: p.id, label: p.name.split(/[:(]/)[0].trim(), color: p.color })),
  { id: "weight", label: "Weight", color: "#22c55e" },
  { id: "blood", label: "Labs", color: "#ef4444" },
  { id: "supps", label: "Supps", color: "#a855f7" },
  { id: "actions", label: "To-Do", color: "#f59e0b" },
  { id: "summary", label: "Summary", color: "#06b6d4" },
];

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [active, setActive] = useState("reta");
  const [weights, setWeights] = useState<Record<string, number>>(defaultWeights);
  const [summary, setSummary] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setWeights(load(STORAGE_KEY, defaultWeights));
    setSummary(loadText(SUMMARY_STORAGE_KEY, ""));
    setLoaded(true);
  }, []);

  const current = protocols.find(p => p.id === active) || null;

  if (!loaded) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontFamily: "monospace" }}>
      Loading...
    </div>
  );

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#fff", padding: "16px", maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Rafael Lemor · Updated June 9, 2026</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Protocol Dashboard</div>
        <div style={{ fontSize: 12, color: "#555" }}>6 active compounds + TRT · Weight: 205→175 lbs (30 lbs down) · Goal: 165-170 lbs</div>
      </div>

      {/* Urgent banner */}
      <div style={{ background: "#1a0000", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", letterSpacing: "0.1em", textTransform: "uppercase" }}>🔴 Next Critical: Jun 22 & Jun 29-30</div>
        <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 2 }}>GHK-Cu vial expires Jun 22. Function Health Test 1 scheduled Jun 29-30 (Week 6 TRT baseline).</div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16, padding: "4px 0" }}>
        {NAV_ITEMS.map(n => (
          <button key={n.id} onClick={() => setActive(n.id)} style={{
            background: active === n.id ? n.color + "18" : "#111",
            border: `1px solid ${active === n.id ? n.color + "44" : "#1a1a1a"}`,
            borderRadius: 6, padding: "6px 10px", cursor: "pointer",
            fontSize: 11, fontWeight: active === n.id ? 700 : 500,
            color: active === n.id ? n.color : "#555",
            transition: "all 0.1s",
          }}>{n.label}</button>
        ))}
      </div>

      {/* Content Panel */}
      <div style={{ background: "#0d0d0d", border: `1px solid ${current && active !== "summary" ? current.color + "22" : "#222"}`, borderRadius: 12, padding: 20 }}>

        {active === "weight" && <WeightLog weights={weights} setWeights={setWeights} />}
        {active === "blood" && <BloodworkPanel />}
        {active === "supps" && <SupplementsPanel />}
        {active === "actions" && <ActionsPanel />}
        {active === "summary" && <SummaryPanel summary={summary} setSummary={setSummary} />}

        {current && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: current.color }}>{current.name}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{current.badge} · {current.vendor}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                  {typeof current.vialsRemaining === "number" ? current.vialsRemaining : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#444" }}>vials left</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {[
                { label: "Vial Size", value: current.vialSize },
                { label: "BAC Water", value: current.bac },
                { label: "Concentration", value: current.concentration },
              ].map(item => (
                <div key={item.label} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "#ccc", fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Started {current.startDate}
              {current.endDate && ` · Ends ${current.endDate}`}
            </div>
            <div style={{ marginBottom: 20 }}>
              {current.phases.map((phase, i) => <PhaseRow key={i} phase={phase} />)}
            </div>

            <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Notes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {current.notes.map((note, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ color: current.color, fontSize: 10, marginTop: 1, flexShrink: 0 }}>→</div>
                  <div style={{ fontSize: 12, color: note.includes("🔴") || note.includes("⚠️") ? "#fca5a5" : "#666", lineHeight: 1.5 }}>{note}</div>
                </div>
              ))}
            </div>

            {current.urgent && (
              <div style={{ background: "#1a0000", border: "1px solid #dc2626", borderRadius: 8, padding: "12px 14px", marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>⚠️ IMPORTANT</div>
                <div style={{ fontSize: 12, color: "#fca5a5" }}>{current.urgentMsg}</div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#222" }}>
        Status: Active Protocol | TRT: 6 weeks | Reta: Phase 3 Week 12 | Goal: 165-170 lbs
      </div>
    </div>
  );
}
