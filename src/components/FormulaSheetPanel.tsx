import { useState } from "react";

type SectionKey = "cmpd" | "cash" | "amrt" | "examples";

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "cmpd",     label: "CMPD — ריבית דריבית"    },
  { key: "cash",     label: "CASH — תזרים מזומנים"   },
  { key: "amrt",     label: "AMRT — לוח סילוקין"     },
  { key: "examples", label: "דוגמאות פתורות"          },
];

interface Props { onClose: () => void; }

export default function FormulaSheetPanel({ onClose }: Props) {
  const [active, setActive] = useState<Record<SectionKey, boolean>>(
    { cmpd: true, cash: true, amrt: true, examples: true }
  );

  const toggle = (k: SectionKey) => setActive(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="formula-sheet-overlay fixed inset-0 z-50 overflow-auto"
         style={{ background: "rgba(10,10,30,0.96)" }}>

      {/* ── Controls bar (hidden in print) ─────────────────────────────── */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 px-5 py-3"
           style={{ background: "rgba(10,10,30,0.98)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>

        <button onClick={onClose}
          className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded border border-white/20 transition-colors">
          ✕ סגור
        </button>

        <div className="flex flex-wrap gap-2 flex-1 justify-center">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => toggle(s.key)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all select-none ${
                active[s.key]
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-white/35 line-through"
              }`}>
              {active[s.key] ? "✓ " : "○ "}{s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs hidden sm:block">טיפ: ערוך את הדוגמאות לפני הדפסה</span>
          <button onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-1.5 rounded font-bold transition-colors whitespace-nowrap">
            🖨 הדפס / PDF
          </button>
        </div>
      </div>

      {/* ── A4 Paper ───────────────────────────────────────────────────── */}
      <div className="flex justify-center py-8 px-2">
        <div className="formula-sheet-paper" style={{
          background: "white",
          width: "210mm",
          minHeight: "297mm",
          padding: "13mm 16mm 16mm 16mm",
          fontFamily: "Arial, Helvetica, sans-serif",
          direction: "rtl",
          color: "#111",
          fontSize: "9pt",
          lineHeight: "1.45",
          boxSizing: "border-box",
          boxShadow: "0 4px 40px rgba(0,0,0,0.6)",
        }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end",
                        borderBottom:"2.5px solid #1a4fa3", paddingBottom:6, marginBottom:11 }}>
            <div style={{ fontSize:"7.5pt", color:"#888", lineHeight:1 }}>Casio FC-200V Simulator<br/>financial-calculator-rho-orpin.vercel.app</div>
            <h1 style={{ margin:0, fontSize:"15pt", fontWeight:"bold", color:"#1a4fa3", lineHeight:1 }}>דף נוסחאות — מימון</h1>
          </div>

          {/* Two-column layout */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 14px" }}>

            {/* ── CMPD ── */}
            {active.cmpd && (
              <div className="sheet-section" style={{ gridColumn: active.cash ? "1" : "1 / -1" }}>
                <SectionHeader color="#1a4fa3">CMPD — ריבית דריבית / TVM</SectionHeader>

                <FieldTable rows={[
                  ["n",   "מספר תקופות (חודשים / שנים)"],
                  ["I%",  "ריבית תקופתית (%)"],
                  ["PV",  "ערך נוכחי (חיובי = קבלה)"],
                  ["PMT", "תשלום תקופתי (שלילי = תשלום)"],
                  ["FV",  "ערך עתידי"],
                ]} />

                <Formula>
                  {"FV = −PV·(1+i)ⁿ − PMT·[(1+i)ⁿ−1]/i"}
                </Formula>
                <Formula sub>{"i = I%÷100  (תקופתי)"}</Formula>

                <SubNote>END: תשלום בסוף תקופה (ברירת מחדל) | BEGIN: בתחילה</SubNote>
                <SubNote highlight>חוק סימנים: כסף שיוצא מכם = שלילי (−), נכנס = חיובי (+)</SubNote>

                <Workflow steps={[
                  "לחץ CMPD",
                  "הזן n → EXE",
                  "הזן I% → EXE",
                  "הזן PV → EXE",
                  "הזן PMT → EXE  (0 אם אין)",
                  "SOLVE על השדה הנעלם",
                ]} />
              </div>
            )}

            {/* ── CASH ── */}
            {active.cash && (
              <div className="sheet-section" style={{ gridColumn: active.cmpd ? "2" : "1 / -1" }}>
                <SectionHeader color="#085041">CASH — תזרים מזומנים</SectionHeader>

                <FieldTable rows={[
                  ["I%",  "שיעור היוון (%)"],
                  ["Cff", "תזרים ראשוני t=0 (בד\"כ שלילי)"],
                  ["C0x", "תזרים תקופה x"],
                  ["Nj",  "מספר פעמים שC0x חוזר"],
                  ["NPV", "ערך נוכחי נקי"],
                  ["IRR", "שיעור תשואה פנימי"],
                  ["NFV", "ערך עתידי נקי"],
                  ["PBP", "תקופת החזר השקעה"],
                ]} />

                <Formula>{"NPV = Cff + Σ Cₜ/(1+r)ᵗ"}</Formula>
                <Formula>{"NFV = NPV·(1+r)ⁿ"}</Formula>
                <Formula sub>{"IRR: ריבית שבה NPV = 0"}</Formula>

                <Workflow steps={[
                  "לחץ CASH",
                  "הזן I% → EXE",
                  "הזן Cff (שלילי!) → EXE",
                  "הזן C01 → EXE, הזן Nj → EXE",
                  "חזור לשדות נוספים",
                  "↓ לNPV/IRR/NFV → SOLVE",
                ]} />
              </div>
            )}

            {/* ── AMRT ── */}
            {active.amrt && (
              <div className="sheet-section" style={{ gridColumn: (active.cmpd || active.cash) ? "1 / -1" : "1 / -1" }}>
                <SectionHeader color="#633806">AMRT — לוח סילוקין</SectionHeader>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 12px" }}>
                  <div>
                    <FieldTable rows={[
                      ["PM1",  "תשלום ראשון בטווח"],
                      ["PM2",  "תשלום אחרון בטווח"],
                      ["ΣInt", "סך ריבית בטווח"],
                      ["ΣPRI", "סך קרן בטווח"],
                      ["BAL",  "יתרת חוב בסוף הטווח"],
                    ]} />
                  </div>
                  <div>
                    <Formula>{"ריבית_t = יתרה_{t-1} · i"}</Formula>
                    <Formula>{"קרן_t = PMT − ריבית_t"}</Formula>
                    <Formula>{"יתרה_t = יתרה_{t-1} − קרן_t"}</Formula>
                    <Formula sub>{"i = I%÷100÷12 (חודשי)"}</Formula>
                    <Workflow steps={[
                      "פתור PMT ב-CMPD קודם",
                      "לחץ AMRT",
                      "PM1 → EXE, PM2 → EXE",
                      "↓ לתוצאות ΣInt / ΣPRI / BAL",
                    ]} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Examples ── */}
          {active.examples && (
            <div style={{ marginTop: 12 }}>
              <div style={{ borderBottom: "1.5px solid #4a1a7a", marginBottom: 8, paddingBottom: 4 }}>
                <span style={{ fontSize: "10pt", fontWeight: "bold", color: "#4a1a7a" }}>
                  דוגמאות פתורות
                </span>
                <span className="no-print" style={{ fontSize: "7.5pt", color: "#aaa", marginRight: 8 }}>
                  (לחץ על האזורים הכחולים כדי לכתוב)
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                {[0, 1, 2, 3].map(i => (
                  <ExampleBox key={i} index={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 14, borderTop: "1px solid #ddd", paddingTop: 5,
                        display:"flex", justifyContent:"space-between", fontSize:"7pt", color:"#999" }}>
            <span>הופק מ: Casio FC-200V Simulator</span>
            <span>שם: ________________________________   ת.ז: ________________</span>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function SectionHeader({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ background: color, color: "white", borderRadius: 4,
                  padding: "3px 8px", marginBottom: 7, fontWeight: "bold", fontSize: "9.5pt" }}>
      {children}
    </div>
  );
}

function FieldTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 5, fontSize: "8.5pt" }}>
      <tbody>
        {rows.map(([field, desc]) => (
          <tr key={field} style={{ borderBottom: "1px solid #f0f0f0" }}>
            <td style={{ fontWeight: "bold", fontFamily: "monospace", paddingLeft: 0,
                         paddingRight: 6, paddingTop: 1, paddingBottom: 1, whiteSpace: "nowrap",
                         color: "#1a4fa3", width: "12%" }}>
              {field}
            </td>
            <td style={{ color: "#333", paddingTop: 1, paddingBottom: 1 }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Formula({ children, sub }: { children: React.ReactNode; sub?: boolean }) {
  return (
    <div style={{
      background: sub ? "transparent" : "#f4f7ff",
      border: sub ? "none" : "1px solid #d0dcf5",
      borderRadius: sub ? 0 : 3,
      padding: sub ? "0 0 1px 0" : "3px 8px",
      marginBottom: sub ? 2 : 4,
      fontFamily: "monospace",
      fontSize: sub ? "7.5pt" : "8.5pt",
      color: sub ? "#666" : "#1a1a1a",
      direction: "ltr",
      textAlign: "left",
    }}>
      {children}
    </div>
  );
}

function SubNote({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      fontSize: "7.5pt",
      color: highlight ? "#7a1a1a" : "#555",
      background: highlight ? "#fff4f4" : "transparent",
      border: highlight ? "1px solid #f5c0c0" : "none",
      borderRadius: 3,
      padding: highlight ? "2px 6px" : "0",
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function Workflow({ steps }: { steps: string[] }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: "7.5pt", fontWeight: "bold", color: "#555", marginBottom: 2 }}>
        סדר הפעלה במחשבון:
      </div>
      <ol style={{ margin: 0, paddingRight: 16, fontSize: "7.5pt", color: "#333" }}>
        {steps.map((s, i) => <li key={i} style={{ marginBottom: 1 }}>{s}</li>)}
      </ol>
    </div>
  );
}

function ExampleBox({ index }: { index: number }) {
  return (
    <div style={{ border: "1px dashed #b8c8f0", borderRadius: 4, padding: "5px 8px", minHeight: 70 }}>
      <div style={{ fontSize: "7.5pt", fontWeight: "bold", color: "#4a1a7a", marginBottom: 3 }}>
        דוגמה {index}:
      </div>
      <div
        contentEditable
        suppressContentEditableWarning
        data-placeholder="כתוב כאן שאלה ופתרון..."
        style={{ minHeight: 50, outline: "none", fontSize: "8.5pt", lineHeight: 1.5, color: "#111" }}
      />
    </div>
  );
}
