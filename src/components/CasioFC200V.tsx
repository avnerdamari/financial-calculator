import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CMPDParams } from "../demo/steps";

export interface CalcHandle {
  pressButton(id: string): void;
  reset(): void;
}

/* ─── TVM solver ─────────────────────────────────────────── */
type Field = "n" | "I" | "PV" | "PMT" | "FV";
const FIELDS: Field[] = ["n", "I", "PV", "PMT", "FV"];
const LABEL: Record<Field, string> = { n: "n", I: "I%", PV: "PV", PMT: "PMT", FV: "FV" };

function solveTVM(vals: Record<Field, number>, target: Field, bg: number): number {
  const { n, I, PV, PMT, FV } = vals;
  const r = I / 100;
  if (target === "FV") {
    if (Math.abs(r) < 1e-12) return -(PV + PMT * n);
    const f = Math.pow(1 + r, n);
    return -(PV * f + PMT * (1 + r * bg) * (f - 1) / r);
  }
  if (target === "PV") {
    if (Math.abs(r) < 1e-12) return -(PMT * n + FV);
    const f = Math.pow(1 + r, n);
    return -(FV / f + PMT * (1 + r * bg) * (f - 1) / r / f);
  }
  if (target === "PMT") {
    if (Math.abs(r) < 1e-12) return n === 0 ? NaN : -(PV + FV) / n;
    const f = Math.pow(1 + r, n);
    const d = (1 + r * bg) * (f - 1) / r;
    return Math.abs(d) < 1e-12 ? NaN : -(PV * f + FV) / d;
  }
  if (target === "n") {
    if (Math.abs(r) < 1e-12) return Math.abs(PMT) < 1e-12 ? NaN : -(PV + FV) / PMT;
    let x = Math.max(n > 0 ? n : 10, 0.1);
    for (let i = 0; i < 200; i++) {
      const f = Math.pow(1 + r, x);
      const fx = PV * f + PMT * (1 + r * bg) * (f - 1) / r + FV;
      const dfx = Math.log(1 + r) * (PV * f + PMT * (1 + r * bg) * f / r);
      if (Math.abs(dfx) < 1e-14) break;
      const dx = fx / dfx; x -= dx;
      if (Math.abs(dx) < 1e-9) break;
    }
    return x;
  }
  if (target === "I") {
    let r2 = Math.abs(r) > 1e-6 ? r : 0.05;
    for (let i = 0; i < 300; i++) {
      const f = Math.pow(1 + r2, n);
      const ann = Math.abs(r2) < 1e-12 ? n : (1 + r2 * bg) * (f - 1) / r2;
      const fx = PV * f + PMT * ann + FV;
      const dFdR = PV * n * Math.pow(1 + r2, n - 1);
      let dAnn: number;
      if (Math.abs(r2) < 1e-12) { dAnn = bg * n + n * (n - 1) / 2; }
      else {
        const df = n * Math.pow(1 + r2, n - 1);
        dAnn = bg * (f - 1) / r2 + (1 + r2 * bg) * (df * r2 - (f - 1)) / (r2 * r2);
      }
      const dfx = dFdR + PMT * dAnn;
      if (Math.abs(dfx) < 1e-14) break;
      r2 -= fx / dfx;
      if (r2 <= -1) r2 = -0.9999;
      if (Math.abs(fx / (dfx || 1)) < 1e-10) break;
    }
    return r2 * 100;
  }
  return NaN;
}

function fmt(s: string): string {
  const n = parseFloat(s);
  if (!isFinite(n)) return s;
  return parseFloat(n.toFixed(2)).toString();
}

/* ─── Cash Flow calculations (flat array: index = time period) */
function calcNPV(iPercent: number, flows: number[]): number {
  const r = iPercent / 100;
  return flows.reduce((sum, c, t) =>
    sum + (Math.abs(r) < 1e-12 ? c : c / Math.pow(1 + r, t)), 0);
}

function calcIRR(flows: number[]): number {
  const f = (ip: number) => calcNPV(ip, flows);
  let lo = -99.99, hi = 10000;
  const flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return NaN;
  for (let k = 0; k < 300; k++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function calcNFV(iPercent: number, flows: number[]): number {
  const npv = calcNPV(iPercent, flows);
  if (!isFinite(npv)) return NaN;
  const r = iPercent / 100;
  return npv * Math.pow(1 + r, flows.length - 1);
}

function calcPBP(flows: number[]): number {
  let cum = flows[0] ?? 0;
  if (cum >= 0) return 0;
  for (let t = 1; t < flows.length; t++) {
    const prev = cum;
    cum += flows[t];
    if (cum >= 0 && flows[t] > 0) return t - 1 + Math.abs(prev) / flows[t];
    if (cum >= 0) return t;
  }
  return NaN;
}

/* ─── Amortization (AMRT screen) ──────────────────────────── */
const AMRT_LABELS = ["PM1", "PM2", "n", "I%", "PV", "PMT", "FV", "P/Y", "C/Y", "BAL", "INT", "PRN", "ΣINT", "ΣPRN"];
const AMRT_TOTAL = 14;

function calcAmort(
  pm1: number, pm2: number,
  pv: number, pmt: number, rate: number, isBegin: boolean
): { intPM1: number; prnPM1: number; sumINT: number; sumPRN: number; bal: number } {
  let bal = pv, sumINT = 0, sumPRN = 0, intPM1 = 0, prnPM1 = 0;
  for (let k = 1; k <= pm2; k++) {
    const int_k = isBegin && k === 1 ? 0 : -bal * rate;
    const prn_k = pmt - int_k;
    bal += prn_k;
    if (k === pm1) { intPM1 = int_k; prnPM1 = prn_k; }
    if (k >= pm1) { sumINT += int_k; sumPRN += prn_k; }
  }
  return { intPM1, prnPM1, sumINT, sumPRN, bal };
}

/* ─── Flying digit (Demo Mode) — 3-phase using fixed viewport coords ─── */
function FlyingChar({
  char, sx, sy, wx, wy, ex, ey, onDone,
}: {
  char: string;
  sx: number; sy: number;   // start  — viewport coords (button center)
  wx: number; wy: number;   // waypoint — left of REPLAY pad
  ex: number; ey: number;   // end    — LCD center
  onDone: () => void;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 16);   // fly to waypoint
    const t2 = setTimeout(() => setPhase(2), 430);  // resume to LCD after pause (~200ms travel + 215ms pause)
    const t3 = setTimeout(onDone, 900);             // remove after landing
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line

  const x = phase === 0 ? sx : phase === 1 ? wx : ex;
  const y = phase === 0 ? sy : phase === 1 ? wy : ey;
  const scale = phase === 0 ? 1.6 : phase === 1 ? 1.4 : 0.4;

  return (
    <div style={{
      position: "fixed",
      left: x, top: y,
      transform: `translateX(-50%) translateY(-50%) scale(${scale})`,
      opacity: phase === 2 ? 0 : 1,
      transition: phase === 0 ? "none"
        : phase === 1 ? "left 0.2s ease-out, top 0.2s ease-out, transform 0.2s ease-out"
        : "left 0.28s ease-in, top 0.28s ease-in, transform 0.28s ease-in, opacity 0.25s ease-in 0.05s",
      pointerEvents: "none", zIndex: 9999,
      color: "#ef4444", fontSize: 30, fontWeight: "bold", fontFamily: "monospace",
      textShadow: "0 0 8px rgba(239,68,68,0.7)",
    }}>
      {char}
    </div>
  );
}

/* ─── Button ─── */
type BtnStyle = {
  bg: string; text: string; border?: string; textSize?: string; h?: string;
  gradient?: string; clipPath?: string; borderRadius?: string; noShadow?: boolean; noSpacer?: boolean;
};

function CalcBtn({
  label, sub, style, onClick, wide = false, active = false, pressed = false, btnId,
}: {
  label: string; sub?: string; style: BtnStyle; onClick: () => void;
  wide?: boolean; active?: boolean; pressed?: boolean; btnId?: string;
}) {
  const cp = style.clipPath;
  return (
    <div
      className={`casio-key-wrap${wide ? " col-span-2" : ""}`}
      data-btn-id={btnId}
      style={{
        clipPath: cp ?? undefined, minWidth: 0, display: "flex", flexDirection: "column", height: style.h,
        boxShadow: active
          ? "0 0 0 3px #FFD700, 0 0 16px #FFD700, 0 0 30px rgba(255,215,0,0.4)"
          : style.noShadow ? "none" : "0 3px 5px rgba(0,0,0,0.45)",
        transition: "box-shadow 150ms, transform 80ms",
        transform: pressed ? "translateY(3px) scale(0.93)" : "none",
        zIndex: active ? 10 : undefined,
        position: active ? "relative" : undefined,
      }}
    >
      {!style.noSpacer && <div style={{ minHeight: 9, lineHeight: 1 }} />}
      <button
        onPointerDown={e => { e.preventDefault(); onClick(); }}
        className="casio-key flex flex-col items-center justify-center select-none w-full"
        style={{
          flex: 1,
          background: style.gradient ?? style.bg,
          color: style.text,
          border: `1px solid ${style.border ?? "rgba(0,0,0,0.35)"}`,
          borderRadius: style.borderRadius ?? "7px 7px 5px 5px",
          fontSize: style.textSize ?? "9px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        {sub && <span style={{ fontSize: "7px", opacity: 0.7, lineHeight: 1, marginBottom: 1 }}>{sub}</span>}
        <span style={{ lineHeight: 1 }}>{label}</span>
      </button>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

const CasioFC200V = forwardRef<CalcHandle, {
  activeButtonId?: string | null;
  pressedButtonId?: string | null;
  onPowerOff?: () => void;
  listening?: boolean;
  expectedParams?: CMPDParams | null;
  onNotification?: (text: string, isError: boolean) => void;
}>(
function CasioFC200V({ activeButtonId = null, pressedButtonId = null, onPowerOff, listening = false, expectedParams = null, onNotification }, ref) {
  const [cursor, setCursor] = useState(-1);
  const [values, setValues] = useState<Record<Field, string>>({
    n: "0", I: "0", PV: "0", PMT: "0", FV: "0",
  });
  const [buffer, setBuffer] = useState("");
  const [editing, setEditing] = useState(false);
  const [endBegin, setEndBegin] = useState<"END" | "BEGIN">("END");
  const [solved, setSolved] = useState<Field | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [screenMode, setScreenMode] = useState<"cmpd" | "setMenu" | "cash" | "cashEditor" | "amrt" | "clrMenu">("cmpd");
  const [clrOption, setClrOption] = useState(0); // 0=Setup, 1=Memory, 2=All
  const [clrConfirm, setClrConfirm] = useState<false | "confirm" | "done">(false);
  const [setMenuOrigin, setSetMenuOrigin] = useState<"cmpd" | "amrt">("cmpd");
  const [pendingOp, setPendingOp] = useState<"×" | "÷" | "+" | "−" | null>(null);
  const [pendingLeft, setPendingLeft] = useState<string>("0");
  const [pU, setPU] = useState(false);
  const [pD, setPD] = useState(false);
  const [pL, setPL] = useState(false);
  const [pR, setPR] = useState(false);
  const [textCursor, setTextCursor] = useState(-1);
  const [poweredOn, setPoweredOn] = useState(true);
  const [shiftActive, setShiftActive] = useState(false);

  // CASH main screen: 0=I%, 1=Csh, 2=NPV, 3=IRR, 4=NFV, 5=PBP
  const [cashI, setCashI] = useState("10");
  const [cashMainCursor, setCashMainCursor] = useState(0);
  const [cashEditorFlows, setCashEditorFlows] = useState<string[]>(["0"]);
  const [cashEditorCursor, setCashEditorCursor] = useState(0);
  const [cashNPV, setCashNPV] = useState("");
  const [cashIRR, setCashIRR] = useState("");
  const [cashNFV, setCashNFV] = useState("");
  const [cashPBP, setCashPBP] = useState("");
  const [cashSolved, setCashSolved] = useState<"NPV" | "IRR" | "NFV" | "PBP" | null>(null);

  // AMRT screen state
  const [amPM1, setAmPM1] = useState("1");
  const [amPM2, setAmPM2] = useState("1");
  const [amPY,  setAmPY]  = useState("12");
  const [amCY,  setAmCY]  = useState("12");
  const [amCursor, setAmCursor] = useState(0);
  const [amINT,    setAmINT]    = useState("");
  const [amPRN,    setAmPRN]    = useState("");
  const [amBAL,    setAmBAL]    = useState("");
  const [amSumINT, setAmSumINT] = useState("");
  const [amSumPRN, setAmSumPRN] = useState("");
  const [amSolved, setAmSolved] = useState<"INT" | "PRN" | "BAL" | "ΣINT" | "ΣPRN" | null>(null);

  const [wrongFields, setWrongFields] = useState<Set<Field>>(new Set());
  const wrongAttemptsRef = useRef<Record<Field, number>>({ n: 0, I: 0, PV: 0, PMT: 0, FV: 0 });
  const wrongEndBeginAttemptsRef = useRef(0);
  const errorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function playErrorBeep() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch { /* AudioContext not available */ }
  }

  function showNotif(text: string, isError = true) {
    onNotification?.(text, isError);
  }

  useEffect(() => {
    if (errorIntervalRef.current) { clearInterval(errorIntervalRef.current); errorIntervalRef.current = null; }
  }, [wrongFields]);

  useEffect(() => {
    setWrongFields(new Set());
    wrongAttemptsRef.current = { n: 0, I: 0, PV: 0, PMT: 0, FV: 0 };
    wrongEndBeginAttemptsRef.current = 0;
  }, [expectedParams]);

  function validateEndBegin(value: "END" | "BEGIN"): boolean {
    if (!expectedParams) return true;
    const expected = expectedParams.endBegin ?? "END";
    const ok = value === expected;
    if (!ok) {
      playErrorBeep();
      const attempts = wrongEndBeginAttemptsRef.current + 1;
      wrongEndBeginAttemptsRef.current = attempts;
      const msg = attempts >= 2
        ? `שגיאה: Set צריך להיות ${expected}`
        : `שגיאה: Set לא נכון — נסה שוב`;
      showNotif(msg);
    } else {
      wrongEndBeginAttemptsRef.current = 0;
    }
    return ok;
  }

  function validateField(field: Field, val: string): boolean {
    if (!expectedParams || field === expectedParams.solve) return true;
    const exp = expectedParams[field] as number | null | undefined;
    if (exp === null || exp === undefined) return true;
    const usr = parseFloat(val);
    const ok = isFinite(usr) && Math.abs(usr - exp) < 0.01;
    if (!ok) {
      playErrorBeep();
      const attempts = (wrongAttemptsRef.current[field] ?? 0) + 1;
      wrongAttemptsRef.current = { ...wrongAttemptsRef.current, [field]: attempts };
      const msg = attempts >= 2
        ? `שגיאה: ${LABEL[field]} צריך להיות ${exp}`
        : `שגיאה: ${LABEL[field]} לא נכון — נסה שוב`;
      showNotif(msg);
    } else {
      wrongAttemptsRef.current = { ...wrongAttemptsRef.current, [field]: 0 };
    }
    setWrongFields(prev => { const s = new Set(prev); ok ? s.delete(field) : s.add(field); return s; });
    return ok;
  }

  /* ─── Moving arrow (Demo Mode) ── */
  const containerRef = useRef<HTMLDivElement>(null);
  const lcdRef = useRef<HTMLDivElement>(null);
  const [arrowPos, setArrowPos] = useState<{ left: number; top: number } | null>(null);
  const arrowKey = useRef(0);

  /* ─── Flying digit labels ── */
  const [flyingLabels, setFlyingLabels] = useState<Array<{
    id: number; char: string;
    sx: number; sy: number; wx: number; wy: number; ex: number; ey: number;
  }>>([]);

  useEffect(() => {
    if (!activeButtonId || !containerRef.current) { setArrowPos(null); return; }
    const btn = containerRef.current.querySelector(`[data-btn-id="${activeButtonId}"]`);
    if (!btn) { setArrowPos(null); return; }
    const cRect = containerRef.current.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    arrowKey.current += 1;
    setArrowPos({
      left: bRect.left - cRect.left + bRect.width / 2,
      top:  bRect.top  - cRect.top  - 26,
    });
  }, [activeButtonId]);

  const flyCounterRef = useRef(0);

  function playClickSound(btnId: string) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (btnId === "exe") {
        [0, 0.09].forEach((delay, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          const freq = i === 0 ? 700 : 500;
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.85, ctx.currentTime + delay + 0.07);
          gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.1);
        });
        setTimeout(() => ctx.close(), 400);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.07);
        setTimeout(() => ctx.close(), 300);
      }
    } catch { /* ignore audio errors */ }
  }

  function spawnFlyChar(btnId: string) {
    const isDigit = /^[0-9]$/.test(btnId);
    const isDot   = btnId === "dot";
    const isSign  = btnId === "sign";
    if (!isDigit && !isDot && !isSign) return;

    const char = isDot ? "." : isSign ? "−" : btnId;
    const btn  = containerRef.current?.querySelector(`[data-btn-id="${btnId}"]`);
    const container = containerRef.current;
    if (!btn || !container) return;

    const bRect = btn.getBoundingClientRect();
    const sx = bRect.left + bRect.width  / 2;
    const sy = bRect.top  + bRect.height / 2;

    let ex = sx, ey = sy - 200;
    const activeValue = containerRef.current?.querySelector('[data-value="active"]') as HTMLElement | null;
    if (activeValue) {
      const vRect = activeValue.getBoundingClientRect();
      ex = vRect.left + Math.min(vRect.width / 2, 40);
      ey = vRect.top  + vRect.height / 2;
    } else if (lcdRef.current) {
      const lRect = lcdRef.current.getBoundingClientRect();
      ex = lRect.left + lRect.width / 2;
      ey = lRect.top  + lRect.height / 2;
    }

    const wx = ex - 60;
    const wy = ey + (sy - ey) * 0.25;

    flyCounterRef.current += 1;
    const fid = flyCounterRef.current;
    setFlyingLabels(prev => [...prev, { id: fid, char, sx, sy, wx, wy, ex, ey }]);
    setTimeout(() => setFlyingLabels(prev => prev.filter(l => l.id !== fid)), 700);
  }

  /* ─── Click sound + flying char on press (Demo Mode) ── */
  useEffect(() => {
    if (!pressedButtonId) return;
    playClickSound(pressedButtonId);
    spawnFlyChar(pressedButtonId);
  }, [pressedButtonId]); // eslint-disable-line

  /* ─── Programmatic control (Demo Mode) ── */
  const pressButtonRef = useRef<(id: string) => void>(() => {});
  useImperativeHandle(ref, () => ({
    pressButton(id: string) { pressButtonRef.current(id); },
    reset() {
      setScreenMode("cmpd"); setSolved(null); setCursor(-1);
      setBuffer(""); setEditing(false); setTextCursor(-1); setPendingOp(null); setPendingLeft("0");
      setValues({ n: "0", I: "0", PV: "0", PMT: "0", FV: "0" });
    },
  }), []);

  function msg(text: string, ms = 1400) {
    setFlash(text); setTimeout(() => setFlash(null), ms);
  }

  function commitCashBuffer() {
    setTextCursor(-1);
    if (!editing || buffer === "" || buffer === "-") { setBuffer(""); setEditing(false); return; }
    if (screenMode === "cash" && cashMainCursor === 0) {
      setCashI(buffer); setCashSolved(null);
    } else if (screenMode === "cashEditor") {
      setCashEditorFlows(flows => flows.map((f, i) => i === cashEditorCursor ? buffer : f));
      setCashSolved(null);
    }
    setBuffer(""); setEditing(false);
  }

  function getAmVal(idx: number): string {
    if (idx === 0) return amPM1;
    if (idx === 1) return amPM2;
    if (idx === 2) return values.n;
    if (idx === 3) return values.I;
    if (idx === 4) return values.PV;
    if (idx === 5) return values.PMT;
    if (idx === 6) return values.FV;
    if (idx === 7)  return amPY;
    if (idx === 8)  return amCY;
    if (idx === 9)  return amBAL;
    if (idx === 10) return amINT;
    if (idx === 11) return amPRN;
    if (idx === 12) return amSumINT;
    if (idx === 13) return amSumPRN;
    return "";
  }
  function setAmVal(idx: number, val: string) {
    setAmSolved(null);
    if (idx === 0) setAmPM1(val);
    else if (idx === 1) setAmPM2(val);
    else if (idx === 2) setValues(v => ({ ...v, n: val }));
    else if (idx === 3) setValues(v => ({ ...v, I: val }));
    else if (idx === 4) setValues(v => ({ ...v, PV: val }));
    else if (idx === 5) setValues(v => ({ ...v, PMT: val }));
    else if (idx === 6) setValues(v => ({ ...v, FV: val }));
    else if (idx === 7) setAmPY(val);
    else if (idx === 8) setAmCY(val);
  }
  function amIsReadOnly(idx: number) { return idx >= 9; }
  function commitAmBuffer() {
    setTextCursor(-1);
    if (!editing || buffer === "" || buffer === "-") { setBuffer(""); setEditing(false); return; }
    setAmVal(amCursor, buffer);
    setBuffer(""); setEditing(false);
  }

  function resetAll() {
    setValues({ n: "0", I: "0", PV: "0", PMT: "0", FV: "0" });
    setCursor(-1); setSolved(null); setEditing(false); setBuffer(""); setTextCursor(-1);
    setEndBegin("END"); setPendingOp(null); setPendingLeft("0");
    setCashI("0"); setCashEditorFlows(["0"]);
    setCashNPV(""); setCashIRR(""); setCashNFV(""); setCashPBP(""); setCashSolved(null); setCashMainCursor(0);
    setAmPM1("1"); setAmPM2("1"); setAmPY("12"); setAmCY("12"); setAmCursor(0);
    setAmINT(""); setAmPRN(""); setAmBAL(""); setAmSumINT(""); setAmSumPRN(""); setAmSolved(null);
    setShiftActive(false); setScreenMode("cmpd");
  }

  function pressNum(d: string) {
    if (!poweredOn) return;
    if (shiftActive && d === "9") {
      setClrOption(0); setScreenMode("clrMenu"); setShiftActive(false); return;
    }
    if (screenMode === "clrMenu") return;
    if (screenMode === "setMenu") {
      if (d === "1") { setEndBegin("BEGIN"); setScreenMode(setMenuOrigin); if (setMenuOrigin === "amrt") setAmCursor(-1); validateEndBegin("BEGIN"); }
      else if (d === "2") { setEndBegin("END"); setScreenMode(setMenuOrigin); if (setMenuOrigin === "amrt") setAmCursor(-1); validateEndBegin("END"); }
      return;
    }
    if (screenMode === "cash") {
      if (cashMainCursor !== 0) return;
      setCashSolved(null);
    }
    if (screenMode === "cashEditor") {
      setCashSolved(null);
    }
    if (screenMode === "amrt") {
      if (amCursor === -1 || amIsReadOnly(amCursor)) return;
      setAmSolved(null);
    }
    setSolved(null);
    if (!editing) {
      if (cursor < 0) setCursor(0);
      setEditing(true);
      setTextCursor(-1);
      setBuffer(d === "." ? "0." : d === "0" ? "0" : d);
    } else {
      if (d === "." && buffer.includes(".")) return;
      if (textCursor < 0) {
        if ((buffer === "0" || buffer === "-0") && d !== ".")
          setBuffer((buffer === "-0" ? "-" : "") + d);
        else setBuffer(b => b + d);
      } else {
        setBuffer(b => b.slice(0, textCursor) + d + b.slice(textCursor));
        setTextCursor(tc => tc + 1);
      }
    }
  }

  function pressSign() {
    if (!poweredOn) return;
    if (screenMode === "cash") {
      if (cashMainCursor !== 0) return;
      setCashSolved(null);
      if (editing) { setBuffer(b => b.startsWith("-") ? b.slice(1) : "-" + b); return; }
      setCashI(v => v.startsWith("-") ? v.slice(1) : "-" + v);
      return;
    }
    if (screenMode === "cashEditor") {
      setCashSolved(null);
      if (editing) { setBuffer(b => b.startsWith("-") ? b.slice(1) : "-" + b); return; }
      // Start editing with negated current value so the user can confirm or continue typing
      const curVal = cashEditorFlows[cashEditorCursor] || "0";
      const negated = curVal.startsWith("-") ? curVal.slice(1) : "-" + curVal;
      setEditing(true); setTextCursor(-1); setBuffer(negated);
      return;
    }
    if (screenMode === "amrt") {
      if (amCursor === -1 || amIsReadOnly(amCursor)) return;
      if (editing) { setBuffer(b => b.startsWith("-") ? b.slice(1) : "-" + b); return; }
      return;
    }
    if (cursor < 0) return;
    setSolved(null);
    if (editing) setBuffer(b => b.startsWith("-") ? b.slice(1) : "-" + b);
    else {
      const f = FIELDS[cursor];
      setValues(v => ({ ...v, [f]: v[f].startsWith("-") ? v[f].slice(1) : "-" + v[f] }));
    }
  }

  function commitBuffer(vals = values): Record<Field, string> {
    setTextCursor(-1);
    if (cursor < 0) { setBuffer(""); setEditing(false); return vals; }
    if (editing && buffer !== "" && buffer !== "-") {
      const f = FIELDS[cursor];
      const next = { ...vals, [f]: buffer };
      setValues(next); setBuffer(""); setEditing(false);
      if (screenMode === "cmpd") validateField(f, buffer);
      if (screenMode === "cmpd") {
        const v = parseFloat(buffer);
        if (f === "I" && isFinite(v) && v <= -100) showNotif("שיעור ריבית לא חוקי — I% חייב להיות גדול מ-100%−");
        else if (f === "n" && isFinite(v) && v < 0) showNotif("n שלילי — ייתכן שגיאה בנתונים", false);
      }
      return next;
    }
    setBuffer(""); setEditing(false); return vals;
  }

  function pressOp(op: "×" | "÷" | "+" | "−") {
    if (!poweredOn) return;
    if (cursor < 0) return;
    setSolved(null);
    if (op === "−" && !editing && !pendingOp) {
      setEditing(true); setBuffer("-"); return;
    }
    if (pendingOp && editing && buffer !== "") {
      const l = parseFloat(pendingLeft) || 0;
      const r = parseFloat(buffer) || 0;
      let res: number;
      switch (pendingOp) {
        case "×": res = l * r; break;
        case "÷": res = r !== 0 ? l / r : NaN; break;
        case "+": res = l + r; break;
        case "−": res = l - r; break;
        default:  res = NaN;
      }
      if (!isFinite(res)) { msg("ERROR"); setPendingOp(null); setPendingLeft("0"); setBuffer(""); setEditing(false); return; }
      const r2 = parseFloat(res.toFixed(6)).toString();
      setPendingLeft(r2); setPendingOp(op); setBuffer(""); setEditing(false);
      return;
    }
    const left = editing ? (buffer || "0") : values[FIELDS[cursor]];
    setPendingLeft(left); setPendingOp(op); setBuffer(""); setEditing(false);
  }

  function pressEXE() {
    if (!poweredOn) return;
    if (screenMode === "clrMenu") {
      if (clrConfirm === "done") { resetAll(); setClrConfirm(false); return; }
      if (clrConfirm === "confirm") { setClrConfirm("done"); return; }
      if (clrOption === 2) { setClrConfirm("confirm"); return; }
      else if (clrOption === 0) { setEndBegin("END"); setShiftActive(false); setScreenMode("cmpd"); }
      else { setScreenMode("cmpd"); }
      return;
    }
    if (screenMode === "setMenu") { setScreenMode(setMenuOrigin); if (setMenuOrigin === "amrt") setAmCursor(-1); return; }
    if (screenMode === "cash") {
      if (cashMainCursor === 1) {
        commitCashBuffer();
        setScreenMode("cashEditor");
        setCashEditorCursor(0);
        setBuffer(""); setEditing(false);
      } else {
        commitCashBuffer();
        setCashMainCursor(c => Math.min(c + 1, 5));
      }
      return;
    }
    if (screenMode === "cashEditor") {
      commitCashBuffer();
      const isLast = cashEditorCursor === cashEditorFlows.length - 1;
      if (isLast && cashEditorFlows.length < 20) {
        setCashEditorFlows(f => [...f, "0"]);
        setCashEditorCursor(cashEditorFlows.length);
      } else {
        setCashEditorCursor(c => Math.min(c + 1, cashEditorFlows.length - 1));
      }
      return;
    }
    if (screenMode === "amrt") {
      if (amCursor === -1) { setSetMenuOrigin("amrt"); setScreenMode("setMenu"); return; }
      commitAmBuffer();
      setAmCursor(c => Math.min(c + 1, AMRT_TOTAL - 1));
      return;
    }
    if (cursor === -1) { setSetMenuOrigin("cmpd"); setScreenMode("setMenu"); return; }
    if (pendingOp) {
      const l = parseFloat(pendingLeft) || 0;
      const r = parseFloat(editing ? (buffer || "0") : "0") || 0;
      let res: number;
      switch (pendingOp) {
        case "×": res = l * r; break;
        case "÷": res = r !== 0 ? l / r : NaN; break;
        case "+": res = l + r; break;
        case "−": res = l - r; break;
        default:  res = NaN;
      }
      if (!isFinite(res)) { msg("ERROR"); setPendingOp(null); setPendingLeft("0"); setBuffer(""); setEditing(false); return; }
      const result = parseFloat(res.toFixed(6)).toString();
      setValues(v => ({ ...v, [FIELDS[cursor]]: result }));
      setBuffer(""); setEditing(false); setPendingOp(null); setPendingLeft("0");
      return;
    }
    const committed = commitBuffer();
    if (screenMode === "cmpd" && cursor >= 0 && expectedParams) {
      const ok = validateField(FIELDS[cursor], committed[FIELDS[cursor]]);
      if (!ok) return;
    }
    if (cursor >= 0) setCursor(c => Math.min(FIELDS.length - 1, c + 1));
  }

  function pressDEL() {
    if (!poweredOn) return;
    if (screenMode === "cashEditor" && !editing) {
      if (cashEditorFlows.length > 1) {
        const newIdx = Math.min(cashEditorCursor, cashEditorFlows.length - 2);
        setCashEditorFlows(flows => flows.filter((_, i) => i !== cashEditorCursor));
        setCashEditorCursor(newIdx);
      }
      return;
    }
    if (editing) {
      if (textCursor < 0) {
        if (buffer.length <= 1) { setBuffer(""); setEditing(false); }
        else setBuffer(b => b.slice(0, -1));
      } else {
        if (textCursor === 0) return;
        setBuffer(b => b.slice(0, textCursor - 1) + b.slice(textCursor));
        setTextCursor(tc => tc - 1);
      }
    } else if (pendingOp) {
      setPendingOp(null); setPendingLeft("0");
    }
  }

  function pressAC() {
    if (!poweredOn) return;
    if (screenMode === "clrMenu") {
      if (clrConfirm === "done") { resetAll(); setClrConfirm(false); return; }
      setClrConfirm(false); setScreenMode("cmpd"); return;
    }
    if (shiftActive) { setPoweredOn(false); setShiftActive(false); onPowerOff?.(); return; }
    if (screenMode === "setMenu") { setScreenMode(setMenuOrigin); if (setMenuOrigin === "amrt") setAmCursor(-1); return; }
    if (screenMode === "cashEditor") {
      if (editing) { setBuffer(""); setEditing(false); return; }
      setScreenMode("cash");
      return;
    }
    if (screenMode === "cash") {
      if (editing) { setBuffer(""); setEditing(false); return; }
      setCashI("10");
      setCashEditorFlows(["-10000", "3000", "3000"]);
      setCashNPV(""); setCashIRR(""); setCashNFV(""); setCashPBP("");
      setCashSolved(null); setCashMainCursor(0); msg("AC");
      return;
    }
    if (screenMode === "amrt") {
      if (editing) { setBuffer(""); setEditing(false); return; }
      setAmPM1("1"); setAmPM2("1");
      setAmINT(""); setAmPRN(""); setAmBAL(""); setAmSumINT(""); setAmSumPRN(""); setAmSolved(null); setAmCursor(0); msg("AC");
      return;
    }
    if (editing) { setBuffer(""); setEditing(false); return; }
    if (pendingOp) { setPendingOp(null); setPendingLeft("0"); return; }
    setValues({ n: "0", I: "0", PV: "0", PMT: "0", FV: "0" });
    setCursor(-1); setSolved(null); setWrongFields(new Set()); msg("AC");
  }

  function pressSOLVE() {
    if (!poweredOn) return;
    if (screenMode === "cash") {
      if (cashMainCursor < 2) { msg("—"); return; }
      const iVal = parseFloat(cashI) || 0;
      const flows = cashEditorFlows.map(v => parseFloat(v) || 0);
      if (cashMainCursor === 2) {
        const npv = calcNPV(iVal, flows);
        if (!isFinite(npv)) { msg("ERROR"); showNotif("שגיאה בחישוב NPV — בדוק ריבית ותזרים"); return; }
        setCashNPV(parseFloat(npv.toFixed(2)).toString()); setCashSolved("NPV");
      } else if (cashMainCursor === 3) {
        const irr = calcIRR(flows);
        if (isNaN(irr) || !isFinite(irr)) { msg("ERROR"); showNotif("לא ניתן לחשב IRR — בדוק שיש תזרים שלילי ותזרים חיובי"); return; }
        setCashIRR(parseFloat(irr.toFixed(4)).toString()); setCashSolved("IRR");
      } else if (cashMainCursor === 4) {
        const nfv = calcNFV(iVal, flows);
        if (!isFinite(nfv)) { msg("ERROR"); showNotif("שגיאה בחישוב NFV — בדוק ריבית ותזרים"); return; }
        setCashNFV(parseFloat(nfv.toFixed(2)).toString()); setCashSolved("NFV");
      } else if (cashMainCursor === 5) {
        const pbp = calcPBP(flows);
        if (isNaN(pbp) || !isFinite(pbp)) { msg("ERROR"); showNotif("ההשקעה אינה מוחזרת בטווח הנתון — בדוק תזרים המזומנים"); return; }
        setCashPBP(parseFloat(pbp.toFixed(4)).toString()); setCashSolved("PBP");
      }
      return;
    }
    if (screenMode === "cashEditor") {
      commitCashBuffer();
      setScreenMode("cash");
      return;
    }
    if (screenMode === "amrt") {
      if (!amIsReadOnly(amCursor)) commitAmBuffer();
      const pm1 = Math.max(1, Math.round(parseFloat(amPM1) || 1));
      const pm2 = Math.max(pm1, Math.round(parseFloat(amPM2) || pm1));
      const pv  = parseFloat(values.PV)  || 0;
      const pmt = parseFloat(values.PMT) || 0;
      const I   = parseFloat(values.I)   || 0;
      const PY  = parseFloat(amPY) || 12;
      const CY  = parseFloat(amCY) || 12;
      const rate = Math.pow(1 + I / (100 * CY), CY / PY) - 1;
      const { intPM1, prnPM1, sumINT, sumPRN, bal } = calcAmort(pm1, pm2, pv, pmt, rate, endBegin === "BEGIN");
      if (!isFinite(sumINT) || !isFinite(bal)) { msg("ERROR"); showNotif("שגיאה בחישוב פריסה — בדוק נתוני הלוואה"); return; }
      const r2 = (v: number) => parseFloat(v.toFixed(2)).toString();
      setAmINT(r2(intPM1)); setAmPRN(r2(prnPM1)); setAmBAL(r2(bal));
      setAmSumINT(r2(sumINT)); setAmSumPRN(r2(sumPRN));
      const solvedMap: Record<number, "INT" | "PRN" | "BAL" | "ΣINT" | "ΣPRN"> =
        { 9: "BAL", 10: "INT", 11: "PRN", 12: "ΣINT", 13: "ΣPRN" };
      setAmSolved(solvedMap[amCursor] ?? "BAL");
      return;
    }
    if (cursor < 0) return;
    const committed = commitBuffer();
    const target = FIELDS[cursor];
    const nums = Object.fromEntries(
      FIELDS.map(f => [f, f === target ? 0 : parseFloat(committed[f]) || 0])
    ) as Record<Field, number>;
    const result = solveTVM(nums, target, endBegin === "BEGIN" ? 1 : 0);
    if (!isFinite(result) || isNaN(result)) {
      msg("ERROR");
      let errMsg = "לא ניתן לפתור — בדוק את הנתונים";
      if (target !== "n" && nums.n <= 0) errMsg = "n חייב להיות גדול מאפס";
      else if (target !== "I" && nums.I <= -100) errMsg = "שיעור ריבית לא חוקי";
      else if (FIELDS.filter(f => f !== target).every(f => nums[f] === 0)) errMsg = "חסרים נתונים — יש להזין לפחות 3 שדות";
      showNotif(errMsg);
      return;
    }
    const r = parseFloat(result.toFixed(4)).toString();
    setValues(v => ({ ...v, [target]: r }));
    setSolved(target);
  }

  function moveCursor(dir: 1 | -1) {
    if (!poweredOn) return;
    if (screenMode === "clrMenu") {
      setClrOption(o => Math.max(0, Math.min(2, o + dir)));
      return;
    }
    if (screenMode === "setMenu") {
      setEndBegin(dir < 0 ? "BEGIN" : "END");
      return;
    }
    if (screenMode === "cash") {
      commitCashBuffer();
      setCashMainCursor(c => Math.max(0, Math.min(5, c + dir)));
      return;
    }
    if (screenMode === "cashEditor") {
      commitCashBuffer();
      setCashEditorCursor(c => Math.max(0, Math.min(cashEditorFlows.length - 1, c + dir)));
      return;
    }
    if (screenMode === "amrt") {
      commitAmBuffer();
      setAmCursor(c => Math.max(-1, Math.min(AMRT_TOTAL - 1, c + dir)));
      return;
    }
    if (dir === 1 && editing) return;
    if (dir === 1 && cursor === -1 && expectedParams) {
      const ok = validateEndBegin(endBegin);
      if (!ok) return;
    }
    commitBuffer();
    setCursor(c => Math.max(-1, Math.min(FIELDS.length - 1, c + dir)));
  }

  function moveTextCursor(dir: 1 | -1) {
    if (cursor < 0) return;
    const f = FIELDS[cursor];
    if (!editing) {
      const val = values[f];
      setEditing(true);
      setBuffer(val);
      setTextCursor(dir < 0 ? val.length - 1 : 1);
      return;
    }
    const len = buffer.length;
    const cur = textCursor < 0 ? len : textCursor;
    setTextCursor(Math.max(0, Math.min(len, cur + dir)));
  }

  /* ─── Wire up programmatic button press (always-fresh closure) ── */
  pressButtonRef.current = (id: string) => {
    switch (id) {
      case "cmpd": setScreenMode("cmpd"); setSolved(null); setCursor(-1); setBuffer(""); setEditing(false); setTextCursor(-1); break;
      case "cash": setScreenMode("cash"); setCashMainCursor(0); setBuffer(""); setEditing(false); setTextCursor(-1); break;
      case "amrt": setScreenMode("amrt"); setAmCursor(0); setBuffer(""); setEditing(false); setTextCursor(-1); break;
      case "solve": pressSOLVE(); break;
      case "exe": pressEXE(); break;
      case "up": moveCursor(-1); break;
      case "down": moveCursor(1); break;
      case "sign": pressSign(); break;
      case "del": pressDEL(); break;
      case "ac": pressAC(); break;
      case "dot": pressNum("."); break;
      default: if (/^[0-9]$/.test(id)) pressNum(id); break;
    }
  };

  /* ─── Styles ─── */
  const TRAP = "polygon(3% 0%,97% 0%,100% 10%,97% 90%,88% 100%,12% 100%,3% 90%,0% 10%)";
  const S = {
    silver:     { bg: "#d4d4d4", text: "#111", border: "#aaa",
                  gradient: "linear-gradient(180deg,#e8e8e8 0%,#b8b8b8 100%)", clipPath: TRAP },
    silverDark: { bg: "#b8b8b8", text: "#111", border: "#999",
                  gradient: "linear-gradient(180deg,#d0d0d0 0%,#a0a0a0 100%)", clipPath: TRAP },
    green:      { bg: "#111111", text: "#4cd464", border: "#333", textSize: "13px",
                  gradient: "#111111", clipPath: TRAP },
    grayWhite:  { bg: "#111111", text: "#fff", border: "#333",
                  gradient: "#111111", clipPath: TRAP },
    blue:       { bg: "#1a3a8a", text: "#fff", border: "#102070",
                  gradient: "linear-gradient(180deg,#2a4aaa 0%,#0e2868 100%)", clipPath: TRAP },
    pink:       { bg: "#7a2090", text: "#fff", border: "#5a1070",
                  gradient: "linear-gradient(180deg,#9030b0 0%,#581068 100%)", clipPath: TRAP },
    dark:       { bg: "#707070", text: "#fff", border: "#555",
                  gradient: "linear-gradient(180deg,#808080 0%,#606060 100%)", clipPath: TRAP },
    darker:     { bg: "#606060", text: "#ffffff", border: "#444",
                  gradient: "linear-gradient(180deg,#707070 0%,#505050 100%)", clipPath: TRAP },
    exe:        { bg: "#4a4a6a", text: "#e8e8ff", border: "#2a2a4a", textSize: "18px", h: "2.4rem",
                  gradient: "linear-gradient(180deg,#606080 0%,#303050 100%)", clipPath: TRAP },
    num:        { bg: "#606060", text: "#fff", border: "#444",    textSize: "24px", h: "2.4rem",
                  gradient: "linear-gradient(180deg,#707070 0%,#505050 100%)", clipPath: TRAP },
    op:         { bg: "#606060", text: "#fff", border: "#444",    textSize: "22px", h: "2.4rem",
                  gradient: "linear-gradient(180deg,#707070 0%,#505050 100%)", clipPath: TRAP },
    pink2:      { bg: "#b0204a", text: "#fff", border: "#800030", textSize: "16px", h: "2.4rem",
                  gradient: "#b0204a", clipPath: TRAP },
  };

  /* ─── LCD screen ─── */
  const ROW_H = 26;

  const lcdOff = (
    <div style={{
      background: "#1c261c", border: "2px solid #888", borderRadius: 4,
      padding: "0px 8px", height: 130,
      boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
    }} />
  );

  const STATUS_ITEMS: { key: string; active: boolean }[] = [
    { key: "S",    active: shiftActive },
    { key: "A",    active: false },
    { key: "M",    active: false },
    { key: "STO",  active: false },
    { key: "RCL",  active: false },
    { key: "STAT", active: false },
    { key: "360",  active: false },
    { key: "SI",   active: false },
    { key: "DMY",  active: false },
    { key: "D",    active: false },
    { key: "R",    active: false },
    { key: "G",    active: false },
    { key: "FIX",  active: false },
    { key: "SCI",  active: false },
  ];

  const lcd = (
    <div style={{
      background: "#b0b0b0", border: "2px solid #999", borderRadius: 4,
      padding: "0px 8px", fontFamily: "monospace",
      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3)",
      height: 132, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 0, paddingBottom: 0, borderBottom: "1px solid #999" }}>
        <div style={{ display: "flex", gap: 3, marginLeft: -3 }}>
          {STATUS_ITEMS.map(({ key, active }) => (
            <span key={key} style={{
              fontSize: "7px", fontWeight: "bold", fontFamily: "monospace",
              color: active ? "#111" : "#ccc",
            }}>{key}</span>
          ))}
        </div>
        {(() => {
          let vStart = 0, total = 0;
          const VIEW = 3;
          if (screenMode === "amrt") {
            total = 15;
            vStart = Math.max(0, Math.min(amCursor + 1 - VIEW + 1, total - VIEW));
          } else if (screenMode === "cash") {
            total = 6;
            vStart = Math.max(0, Math.min(cashMainCursor - VIEW + 1, total - VIEW));
          } else if (screenMode === "cashEditor") {
            total = cashEditorFlows.length;
            vStart = total <= VIEW ? 0 : Math.max(0, Math.min(cashEditorCursor - VIEW + 1, total - VIEW));
          } else if (screenMode !== "setMenu") {
            total = 6;
            vStart = Math.max(0, Math.min(cursor + 1 - VIEW + 1, total - VIEW));
          }
          const hasAbove = vStart > 0;
          const hasBelow = vStart + VIEW < total;
          if (!hasAbove && !hasBelow) return null;
          return (
            <span style={{ display: "flex", flexDirection: "row", fontSize: 12, lineHeight: 1, color: "#444", fontWeight: "bold", gap: 1, marginRight: 4 }}>
              {hasAbove && <span>▲</span>}
              {hasBelow && <span>▼</span>}
            </span>
          );
        })()}
      </div>
      {screenMode === "cashEditor" ? (
        <div style={{ display: "flex", alignItems: "center", height: 20, marginTop: -2 }}>
          <span style={{ minWidth: 20 }}></span>
          <div style={{ width: "50%", textAlign: "center", fontSize: 16, fontWeight: "bold", color: "#222", lineHeight: "20px" }}>X</div>
        </div>
      ) : (
        <div style={{ fontSize: 30, fontWeight: "bold", color: "#333", marginBottom: 0, letterSpacing: 0.5, lineHeight: "1", marginTop: -4, textAlign: screenMode === "clrMenu" ? "center" : "left" }}>
          <span>
            {screenMode === "setMenu" ? "payment"
              : screenMode === "cash" ? "Cash Flow"
              : screenMode === "amrt" ? "Amortization"
              : screenMode === "clrMenu" ? (clrConfirm === "done" ? "Reset All" : clrConfirm === "confirm" ? "Reset All?" : "Reset?")
              : "Compound Int."}
          </span>
        </div>
      )}

      {screenMode === "clrMenu" ? (() => {
        if (clrConfirm === "done") return (
          <div style={{ fontSize: 32, fontWeight: "bold", color: "#1a2a0a", padding: "0 3px", height: ROW_H, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}>Press [AC] key</div>
        );
        if (clrConfirm === "confirm") return (
          <>
            <div style={{ fontSize: 32, fontWeight: "bold", color: "#1a2a0a", padding: "0 3px", height: ROW_H, display: "flex", alignItems: "center" }}>[EXE]:Yes</div>
            <div style={{ fontSize: 32, fontWeight: "bold", color: "#1a2a0a", padding: "0 3px", height: ROW_H, display: "flex", alignItems: "center" }}>[ESC]:Cancel</div>
          </>
        );
        const opts = ["Setup:EXE", "Memory:EXE", "All:EXE"];
        return opts.map((label, i) => (
          <div key={label} onMouseDown={e => { e.preventDefault(); setClrOption(i); }}
            style={{ display: "flex", alignItems: "center", padding: "0 3px", height: ROW_H,
              borderRadius: 2, cursor: "pointer",
              background: clrOption === i ? "#3a3a9a" : "transparent",
              color: clrOption === i ? "#fff" : "#1a2a0a",
              fontSize: 32, fontWeight: "bold" }}>
            {label}
          </div>
        ));
      })() : screenMode === "amrt" ? (() => {
        const ALL = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        const VIEW = 3;
        const ci = amCursor + 1;
        const vStart = Math.max(0, Math.min(ci - VIEW + 1, ALL.length - VIEW));
        return ALL.slice(vStart, vStart + VIEW).map(rowIdx => {
          const isSet = rowIdx === -1;
          const isCur = rowIdx === amCursor;
          const rowBg    = isCur ? "#3a3a9a" : "transparent";
          const rowColor = isCur ? "#fff"    : "#1a2a0a";
          if (isSet) {
            return (
              <div key="set"
                onMouseDown={e => { e.preventDefault(); commitAmBuffer(); setAmCursor(-1); }}
                style={{ display: "flex", alignItems: "center", padding: "0 3px", height: ROW_H,
                  borderRadius: 2, cursor: "pointer", background: rowBg, color: rowColor,
                  fontSize: 32, fontWeight: "bold" }}
              >
                <span>Set :{endBegin}</span>
              </div>
            );
          }
          const label = AMRT_LABELS[rowIdx];
          const isRO = amIsReadOnly(rowIdx);
          const rawVal = getAmVal(rowIdx);
          const isSolvedRow = amSolved !== null && rowIdx >= 9;
          const displayVal = isCur && editing && !isRO
            ? (() => {
                const text = buffer || "0";
                const pos = textCursor < 0 ? text.length : textCursor;
                return text.slice(0, pos) + "▌" + text.slice(pos);
              })()
            : rawVal === "" && isRO ? "Solve" : rawVal === "" ? "0" : fmt(rawVal);
          return (
            <div key={rowIdx}
              onMouseDown={e => { e.preventDefault(); commitAmBuffer(); setAmCursor(rowIdx); }}
              style={{ display: "flex", alignItems: "center", padding: "0 3px", height: ROW_H,
                borderRadius: 2, cursor: "pointer", background: rowBg, color: rowColor, fontSize: 32 }}
            >
              <span style={{ fontWeight: "bold" }}>{label}=</span>
              <span style={{ color: isSolvedRow ? (isCur ? "#ffe87a" : "#8a2000") : rowColor,
                             fontWeight: isSolvedRow ? "bold" : "normal" }}>
                {displayVal}
              </span>
            </div>
          );
        });
      })()

      : screenMode === "cash" ? (() => {
        const CASH_MAIN_LABELS = ["I%", "Csh", "NPV", "IRR", "NFV", "PBP"];
        const TOTAL = 6;
        const VIEW = 3;
        const vStart = Math.max(0, Math.min(cashMainCursor - VIEW + 1, TOTAL - VIEW));
        return Array.from({ length: VIEW }, (_, i) => vStart + i).map(rowIdx => {
          const isCur = rowIdx === cashMainCursor;
          const rowBg    = isCur ? "#3a3a9a" : "transparent";
          const rowColor = isCur ? "#fff"    : "#1a2a0a";

          let labelStr = CASH_MAIN_LABELS[rowIdx];
          let sep = "=";
          let valStr = "";
          let isSolved = false;

          if (rowIdx === 0) {
            valStr = isCur && editing
              ? (() => {
                  const text = buffer || "0";
                  const pos = textCursor < 0 ? text.length : textCursor;
                  return text.slice(0, pos) + "▌" + text.slice(pos);
                })()
              : fmt(cashI);
          } else if (rowIdx === 1) {
            valStr = "D.Editor";
          } else {
            const resultVals = [cashNPV, cashIRR, cashNFV, cashPBP];
            const resultKeys = ["NPV", "IRR", "NFV", "PBP"] as const;
            const rv = resultVals[rowIdx - 2];
            const rk = resultKeys[rowIdx - 2];
            isSolved = cashSolved === rk;
            if (rv) {
              valStr = fmt(rv);
            } else {
              sep = ":";
              valStr = "Solve";
            }
          }

          const valColor = isSolved
            ? (isCur ? "#ffe87a" : "#8a2000")
            : valStr === "Solve"
              ? (isCur ? "#aad4ff" : "#555")
              : rowColor;

          return (
            <div key={rowIdx}
              onMouseDown={e => {
                e.preventDefault();
                if (editing) commitCashBuffer();
                setCashMainCursor(rowIdx);
              }}
              style={{ display: "flex", alignItems: "center", padding: "0 3px", height: ROW_H,
                borderRadius: 2, cursor: "pointer", background: rowBg, color: rowColor, fontSize: 32 }}
            >
              <span style={{ fontWeight: "bold" }}>{labelStr}{sep}</span>
              <span style={{
                color: valColor,
                fontWeight: isSolved ? "bold" : "normal",
                fontStyle: valStr === "Solve" ? "italic" : "normal",
              }}>
                {valStr}
              </span>
            </div>
          );
        });
      })()

      : screenMode === "cashEditor" ? (() => {
        const VIEW = 3;
        const total = cashEditorFlows.length;
        const vStart = total <= VIEW ? 0 : Math.max(0, Math.min(cashEditorCursor - VIEW + 1, total - VIEW));
        const H = 18;
        const curStored = fmt(cashEditorFlows[cashEditorCursor] ?? "0");
        const inputText = editing ? (buffer || "0") : curStored;
        const inputPos  = editing ? (textCursor < 0 ? inputText.length : textCursor) : -1;
        return (
          <div>
            <div style={{ display: "flex" }}>
              {/* Row numbers — outside the bordered column */}
              <div style={{ minWidth: 20, display: "flex", flexDirection: "column" }}>
                {Array.from({ length: VIEW }, (_, i) => {
                  const rowIdx = vStart + i;
                  return (
                    <div key={i} style={{ height: H, fontSize: 16, fontWeight: "bold", color: "#333",
                      display: "flex", alignItems: "center", paddingLeft: 2 }}>
                      {rowIdx + 1}
                    </div>
                  );
                })}
              </div>
              {/* Bordered column — 3 data rows only, borders end here */}
              <div style={{ width: "50%", borderLeft: "2px solid #222", borderRight: "2px solid #222" }}>
                {Array.from({ length: VIEW }, (_, i) => {
                  const rowIdx = vStart + i;
                  const isCur = rowIdx === cashEditorCursor;
                  const storedVal = rowIdx < total ? fmt(cashEditorFlows[rowIdx]) : "";
                  return (
                    <div key={rowIdx >= total ? `empty-${i}` : rowIdx}
                      onMouseDown={e => { e.preventDefault(); if (rowIdx < total) { if (editing) commitCashBuffer(); setCashEditorCursor(rowIdx); } }}
                      style={{
                        height: H, cursor: rowIdx < total ? "pointer" : "default",
                        outline: isCur && rowIdx < total ? "2px solid #3a3ab0" : "none",
                        outlineOffset: -1,
                        background: isCur && rowIdx < total ? "#999" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "flex-end",
                        paddingRight: 3, fontSize: 18, fontWeight: "bold", color: "#1a2a0a",
                      }}>
                      {rowIdx < total && !isCur ? storedVal : ""}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Input line — below everything, aligned to far left */}
            <div
              data-value="active"
              style={{ fontSize: 26, fontWeight: "normal", color: editing ? "#800020" : "#1a2a0a", paddingLeft: 2, marginTop: 2, display: "flex", alignItems: "center" }}
            >
              {inputPos >= 0 ? (
                <>
                  <span>{inputText.slice(0, inputPos)}</span>
                  <span style={{ display: "inline-block", width: 1, height: "0.9em", background: "currentColor", margin: "0 1px" }} />
                  <span>{inputText.slice(inputPos)}</span>
                </>
              ) : inputText}
            </div>
          </div>
        );
      })()

      : screenMode === "setMenu" ? (
        [0, 1].map(i => {
          const m = i === 0 ? "BEGIN" : "END";
          return (
            <div key={m}
              onMouseDown={e => { e.preventDefault(); const v = m as "BEGIN" | "END"; setEndBegin(v); setScreenMode(setMenuOrigin); if (setMenuOrigin === "amrt") setAmCursor(-1); validateEndBegin(v); }}
              style={{ display: "flex", alignItems: "center", padding: "0 3px", height: ROW_H,
                borderRadius: 2, cursor: "pointer",
                background: endBegin === m ? "#3a3a9a" : "transparent",
                color: endBegin === m ? "#fff" : "#1a2a0a", fontSize: 32 }}>
              {i + 1}:{m === "BEGIN" ? "Begin" : "End"}
            </div>
          );
        })
      ) : (() => {
        const ALL = [-1, 0, 1, 2, 3, 4];
        const VIEW = 3;
        const ci = cursor + 1;
        const vStart = Math.max(0, Math.min(ci - VIEW + 1, ALL.length - VIEW));
        return ALL.slice(vStart, vStart + VIEW);
      })().map(rowIdx => {
        const isSet = rowIdx === -1;
        const isCur = rowIdx === cursor;
        const isWrong = rowIdx >= 0 && wrongFields.has(FIELDS[rowIdx]);
        const rowBg   = isCur ? (isWrong ? "#7a1a1a" : "#3a3a9a") : (isWrong ? "#3a0a0a" : "transparent");
        const rowColor = isCur ? "#fff" : (isWrong ? "#ff8a8a" : "#1a2a0a");

        if (isSet) {
          return (
            <div key="set"
              onMouseDown={e => { e.preventDefault(); setEditing(false); setBuffer(""); setCursor(-1); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0 3px", height: ROW_H, borderRadius: 2, cursor: "pointer",
                background: rowBg, color: rowColor, fontSize: 32, fontWeight: "bold" }}
            >
              <span>Set :{endBegin}</span>
            </div>
          );
        }

        const f = FIELDS[rowIdx];
        const displayVal = (() => {
          if (!isCur) return fmt(values[f]);
          if (pendingOp) {
            const sym = pendingOp === "×" ? "x" : pendingOp;
            return editing ? `${fmt(pendingLeft)} ${sym} ${buffer}▌` : `${fmt(pendingLeft)} ${sym}`;
          }
          if (editing) {
            const text = buffer || "0";
            const pos = textCursor < 0 ? text.length : textCursor;
            return text.slice(0, pos) + "▌" + text.slice(pos);
          }
          return fmt(values[f]);
        })();
        return (
          <div key={f}
            data-field={isCur ? "active" : undefined}
            onMouseDown={e => { e.preventDefault(); setEditing(false); setBuffer(""); setCursor(rowIdx); }}
            style={{ display: "flex", alignItems: "center",
              padding: "0 3px", height: ROW_H, borderRadius: 2, cursor: "pointer",
              background: rowBg, color: rowColor, fontSize: 32 }}
          >
            <span style={{ fontWeight: "bold" }}>{LABEL[f]}=</span>
            <span
              data-value={isCur ? "active" : undefined}
              style={{
                color: f === solved   ? (isCur ? "#ffe87a" : "#8a2000")
                     : (editing && isCur) ? "#ef4444"
                     : rowColor,
                fontWeight: (f === solved || (editing && isCur)) ? "bold" : "normal",
              }}
            >
              {displayVal}
            </span>
          </div>
        );
      })}

      <div style={{ height: 14, textAlign: "center", color: "#8a2000", fontSize: 9, marginTop: 2, fontWeight: "bold" }}>
        {flash ?? ""}
      </div>
    </div>
  );

  /* ─── REPLAY pad ─── */
  function ReplayPad() {
    const upActive = activeButtonId === "up";
    const downActive = activeButtonId === "down";
    const anyPressed = pU || pD || pL || pR;
    const press = (set: (v: boolean) => void, action: () => void) =>
      (e: React.PointerEvent) => { e.preventDefault(); set(true); action(); };
    const release = (set: (v: boolean) => void) => () => set(false);
    return (
      <div style={{
        position: "relative", width: 96, height: 96, margin: "12px auto 0", marginTop: 20,
        transform: pU ? "perspective(300px) rotateX(-18deg) scale(0.96)"
                 : pD ? "perspective(300px) rotateX(18deg) scale(0.96)"
                 : pL ? "perspective(300px) rotateY(18deg) scale(0.96)"
                 : pR ? "perspective(300px) rotateY(-18deg) scale(0.96)"
                 : "perspective(300px) rotateX(0) rotateY(0) scale(1)",
        transition: "transform 80ms",
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "linear-gradient(135deg, #d8d8d8 0%, #a8a8a8 100%)",
          boxShadow: (upActive || downActive)
            ? "0 0 0 5px #FFD700, 0 0 0 9px rgba(255,215,0,0.5), 0 0 20px #FFD700"
            : anyPressed
              ? "0 0 0 5px #c8c8c8, 0 0 0 9px #999, 0 1px 3px rgba(0,0,0,0.3)"
              : "0 0 0 5px #c8c8c8, 0 0 0 9px #999, 0 3px 7px rgba(0,0,0,0.4)",
          transition: "box-shadow 150ms",
        }} />
        <div style={{
          position: "absolute", inset: "20px", borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #f5f5f5 0%, #d4d4d4 60%, #aaaaaa 100%)",
          border: "1px solid #ccc",
        }} />
        <div style={{
          position: "absolute", inset: "36%", borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #e8e8e8, #ffffff)",
          display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 5, color: "#333", fontWeight: "bold",
          border: "1px solid #999",
        }}>REPLAY</div>
        <button
          data-btn-id="up"
          onPointerDown={press(setPU, () => moveCursor(-1))} onPointerUp={release(setPU)} onPointerLeave={release(setPU)} onPointerCancel={release(setPU)}
          style={{
            position: "absolute", top: 1, left: "50%",
            transform: `translateX(-50%) translateY(${pU ? -4 : 0}px)`,
            width: 28, height: 19, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", borderRadius: 4,
            color: pU ? "#000" : "#333", fontSize: 14, fontWeight: pU ? "900" : "normal",
            transition: "transform 60ms",
          }}>△</button>
        <button
          data-btn-id="down"
          onPointerDown={press(setPD, () => moveCursor(1))} onPointerUp={release(setPD)} onPointerLeave={release(setPD)} onPointerCancel={release(setPD)}
          style={{
            position: "absolute", bottom: 1, left: "50%",
            transform: `translateX(-50%) translateY(${pD ? 4 : 0}px)`,
            width: 28, height: 19, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", borderRadius: 4,
            color: pD ? "#000" : "#333", fontSize: 14, fontWeight: pD ? "900" : "normal",
            transition: "transform 60ms",
          }}>▽</button>
        <button
          onPointerDown={press(setPL, () => moveTextCursor(-1))} onPointerUp={release(setPL)} onPointerLeave={release(setPL)} onPointerCancel={release(setPL)}
          style={{
            position: "absolute", left: 1, top: "50%",
            transform: `translateY(-50%) translateX(${pL ? -4 : 0}px)`,
            width: 19, height: 28, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", borderRadius: 4,
            color: pL ? "#000" : "#333", fontSize: 14, fontWeight: pL ? "900" : "normal",
            transition: "transform 60ms",
          }}>◁</button>
        <button
          onPointerDown={press(setPR, () => moveTextCursor(1))} onPointerUp={release(setPR)} onPointerLeave={release(setPR)} onPointerCancel={release(setPR)}
          style={{
            position: "absolute", right: 1, top: "50%",
            transform: `translateY(-50%) translateX(${pR ? 4 : 0}px)`,
            width: 19, height: 28, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", borderRadius: 4,
            color: pR ? "#000" : "#333", fontSize: 14, fontWeight: pR ? "900" : "normal",
            transition: "transform 60ms",
          }}>▷</button>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-2" dir="ltr" ref={containerRef} style={{ position: "relative" }}>

      {/* ── Moving arrow ── */}
      {arrowPos && (
        <div
          style={{
            position: "absolute",
            left: arrowPos.left,
            top: arrowPos.top,
            transition: "left 1200ms ease-in-out, top 1200ms ease-in-out",
            pointerEvents: "none",
            zIndex: 300,
            animation: "arrowBounce 0.7s ease-in-out infinite alternate",
            transform: "translateX(-50%)",
          }}
        >
          {/* CSS triangle — always crisp */}
          <div style={{
            width: 0, height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "22px solid #FFD700",
            filter: "none",
          }} />
        </div>
      )}

      {/* ── Flying digit labels ── */}
      {flyingLabels.map(l => (
        <FlyingChar key={l.id} char={l.char}
          sx={l.sx} sy={l.sy} wx={l.wx} wy={l.wy} ex={l.ex} ey={l.ey}
          onDone={() => setFlyingLabels(prev => prev.filter(x => x.id !== l.id))}
        />
      ))}

      <div style={{ position: "relative", width: 353, borderRadius: "14px 14px 18px 18px", overflow: "hidden" }}>
      <div style={{
        position: "relative",
        background: "#d4d4d4", border: "none",
        borderRadius: "14px 14px 0 0", padding: "10px 16px 18px",
      }}>
        {/* Row 1+2: CASIO+FC-200V (left) | solar panel (right, tall) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", marginBottom: 2 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#111", letterSpacing: 2 }}>CASIO</span>
            <div style={{ fontSize: 10, fontWeight: "bold", color: "#333" }}>FC-200V</div>
          </div>
          <div style={{
            width: 150, height: 50, borderRadius: 4, flexShrink: 0,
            background: "repeating-linear-gradient(90deg, #111008 0px, #111008 7px, #2a1e04 7px, #2a1e04 8px)",
            border: "1px solid #1a1200",
          }} />
        </div>
        {/* Row 3: FINANCIAL CONSULTANT | TWO WAY POWER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: "bold", color: "#666", letterSpacing: 1, whiteSpace: "nowrap", zoom: 0.75 }}>FINANCIAL CONSULTANT</span>
          <span style={{ fontSize: 10, fontWeight: "bold", color: "#555", whiteSpace: "nowrap", zoom: 0.75 }}>TWO WAY POWER</span>
        </div>

        <div ref={lcdRef} style={{ marginBottom: 8, position: "relative" }}>
          {poweredOn ? lcd : lcdOff}
          {listening && (
            <div style={{
              position: "absolute", top: 4, right: 8,
              fontSize: 11, fontWeight: "bold", color: "#ef4444",
              animation: "recBlink 0.8s step-start infinite",
            }}>● REC</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: -20, alignItems: "flex-start" }}>
          <div style={{ flex: 1, paddingTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#8B4513" }}>SHIFT</span>
            <div style={{ width: 50 }}><CalcBtn label="" style={{ bg: "#e8e8e8", text: "#111", gradient: "linear-gradient(180deg,#f2f2f2 0%,#d0d0d0 100%)", clipPath: undefined, borderRadius: "50%", border: "#999", noShadow: true, noSpacer: true, h: "28px" }} active={shiftActive} onClick={() => setShiftActive(s => !s)} /></div>
          </div>
          <div style={{ flex: 1, paddingTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#cc0000" }}>ALPHA</span>
            <div style={{ width: 50 }}><CalcBtn label="" style={{ bg: "#e8e8e8", text: "#111", gradient: "linear-gradient(180deg,#f2f2f2 0%,#d0d0d0 100%)", clipPath: undefined, borderRadius: "50%", border: "#999", noShadow: true, noSpacer: true, h: "28px" }} onClick={() => {}} /></div>
          </div>
          <div style={{ flex: 2.5, display: "flex", justifyContent: "center" }}>
            <ReplayPad />
          </div>
          <div style={{ flex: 1, paddingTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#333" }}>SET UP</span>
            <div style={{ width: 50 }}><CalcBtn label="" style={{ bg: "#e8e8e8", text: "#111", gradient: "linear-gradient(180deg,#f2f2f2 0%,#d0d0d0 100%)", clipPath: undefined, borderRadius: "50%", border: "#999", noShadow: true, noSpacer: true, h: "28px" }} onClick={() => {}} /></div>
          </div>
          <div style={{ flex: 1, paddingTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: "13px", fontWeight: "bold", color: "#333" }}>ON</span>
            <div style={{ width: 50 }}><CalcBtn label="" style={{ bg: "#e8e8e8", text: "#111", gradient: "linear-gradient(180deg,#f2f2f2 0%,#d0d0d0 100%)", clipPath: undefined, borderRadius: "50%", border: "#999", noShadow: true, noSpacer: true, h: "28px" }} onClick={() => {
              if (!poweredOn) { setPoweredOn(true); setShiftActive(false); }
            }} /></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2.5fr 1fr 1fr", gap: 4, marginBottom: 18, gridAutoRows: "36px" }}>
          <CalcBtn label="SC1" style={{ bg: "#111", text: "#7ecfff", border: "transparent", textSize: "13px", noShadow: true }} onClick={() => {}} />
          <CalcBtn label="SC2" style={{ bg: "#111", text: "#7ecfff", border: "transparent", textSize: "13px", noShadow: true }} onClick={() => {}} />
          <div />
          <CalcBtn label="ESC" style={{ bg: "#111", text: "#7ecfff", border: "transparent", textSize: "13px", noShadow: true }} onClick={() => {
            setEditing(false); setBuffer(""); setTextCursor(-1);
            if (screenMode === "cashEditor") setScreenMode("cash");
          }} />
          <CalcBtn label="SOLVE" style={{ bg: "#6878a8", text: "#fff", border: "transparent", textSize: "12px", noShadow: true }} active={activeButtonId === "solve"} pressed={pressedButtonId === "solve"} btnId="solve" onClick={pressSOLVE} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 3, marginBottom: 12, gridAutoRows: "36px" }}>
          <CalcBtn label="SMPL" style={S.green} onClick={() => msg("—")} />
          <CalcBtn label="CMPD" style={S.green} active={activeButtonId === "cmpd"} pressed={pressedButtonId === "cmpd"} btnId="cmpd" onClick={() => { setScreenMode("cmpd"); setSolved(null); setCursor(-1); setBuffer(""); setEditing(false); setTextCursor(-1); }} />
          <CalcBtn label="CASH" style={S.green} active={activeButtonId === "cash"} pressed={pressedButtonId === "cash"} btnId="cash" onClick={() => { setScreenMode("cash"); setCashMainCursor(0); setBuffer(""); setEditing(false); setTextCursor(-1); }} />
          <CalcBtn label="AMRT" style={S.green} active={activeButtonId === "amrt"} pressed={pressedButtonId === "amrt"} btnId="amrt" onClick={() => { setScreenMode("amrt"); setAmCursor(0); setBuffer(""); setEditing(false); setTextCursor(-1); }} />
          <CalcBtn label="COMP" style={S.green} onClick={() => msg("—")} />
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -5, left: 0, right: 0, textAlign: "center", fontSize: "9px", fontWeight: "bold", color: "#8B4513", whiteSpace: "nowrap", transform: "scale(0.8)", transformOrigin: "center", lineHeight: 1, pointerEvents: "none" }}>S-MENU</span>
            <CalcBtn label="STAT" style={S.green} onClick={() => msg("—")} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 3, marginBottom: 12, gridAutoRows: "36px" }}>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "11px", fontWeight: "bold", color: "#cc0000", lineHeight: 1, pointerEvents: "none" }}>A</span>
            <CalcBtn label="CNVR" style={S.green} onClick={() => msg("—")} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "11px", fontWeight: "bold", color: "#cc0000", lineHeight: 1, pointerEvents: "none" }}>B</span>
            <CalcBtn label="COST" style={S.green} onClick={() => msg("—")} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "11px", fontWeight: "bold", color: "#cc0000", lineHeight: 1, pointerEvents: "none" }}>C</span>
            <CalcBtn label="DAYS" style={S.green} onClick={() => msg("—")} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "11px", fontWeight: "bold", color: "#cc0000", lineHeight: 1, pointerEvents: "none" }}>D</span>
            <CalcBtn label="DEPR" style={S.green} onClick={() => msg("—")} />
          </div>
          <CalcBtn label="BOND" style={S.green} onClick={() => msg("—")} />
          <CalcBtn label="BEVN" style={S.green} onClick={() => msg("—")} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 3, marginBottom: 12, gridAutoRows: "36px" }}>
          <CalcBtn label="(−)" style={{ ...S.grayWhite, textSize: "13px" }} active={activeButtonId === "sign"} pressed={pressedButtonId === "sign"} btnId="sign" onClick={() => { playClickSound("sign"); spawnFlyChar("sign"); pressSign(); }} />
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>STO</span>
            <CalcBtn label="RCL" style={{ ...S.grayWhite, textSize: "13px" }} onClick={() => {}} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>%</span>
            <CalcBtn label="(" style={{ ...S.grayWhite, textSize: "13px" }} onClick={() => {}} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 2, right: 2, fontSize: "13px", fontWeight: "bold", lineHeight: 1, pointerEvents: "none", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#8B4513", fontSize: "26px", lineHeight: 0.6 }}>′</span><span style={{ color: "#cc0000" }}>X</span>
            </span>
            <CalcBtn label=")" style={{ ...S.grayWhite, textSize: "13px" }} onClick={() => {}} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 2, right: 2, fontSize: "13px", fontWeight: "bold", lineHeight: 1, pointerEvents: "none", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#8B4513" }}>VARS</span><span style={{ color: "#cc0000" }}>Y</span>
            </span>
            <CalcBtn label="CTLG" style={{ ...S.grayWhite, textSize: "11px" }} onClick={() => {}} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 2, right: 2, fontSize: "13px", fontWeight: "bold", lineHeight: 1, pointerEvents: "none", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#8B4513" }}>M<span style={{ position: "relative", top: -4 }}>−</span></span><span style={{ color: "#cc0000" }}>M</span>
            </span>
            <CalcBtn label="M+" style={{ ...S.grayWhite, textSize: "13px" }} onClick={() => {}} />
          </div>
        </div>

        <div style={{ padding: "0 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginBottom: 10, gridAutoRows: "48px" }}>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>eˣ</span>
            <CalcBtn label="7" style={S.num} active={activeButtonId === "7"} pressed={pressedButtonId === "7"} btnId="7" onClick={() => { playClickSound("7"); spawnFlyChar("7"); pressNum("7"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>ln</span>
            <CalcBtn label="8" style={S.num} active={activeButtonId === "8"} pressed={pressedButtonId === "8"} btnId="8" onClick={() => { playClickSound("8"); spawnFlyChar("8"); pressNum("8"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>CLR</span>
            <CalcBtn label="9" style={S.num} active={activeButtonId === "9"} pressed={pressedButtonId === "9"} btnId="9" onClick={() => { playClickSound("9"); spawnFlyChar("9"); pressNum("9"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>INS</span>
            <CalcBtn label="DEL" style={S.pink2} onClick={pressDEL} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>OFF</span>
            <CalcBtn label="AC" style={S.pink2} onClick={pressAC} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginBottom: 10, gridAutoRows: "48px" }}>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>x²</span>
            <CalcBtn label="4" style={S.num} active={activeButtonId === "4"} pressed={pressedButtonId === "4"} btnId="4" onClick={() => { playClickSound("4"); spawnFlyChar("4"); pressNum("4"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>√‾</span>
            <CalcBtn label="5" style={S.num} active={activeButtonId === "5"} pressed={pressedButtonId === "5"} btnId="5" onClick={() => { playClickSound("5"); spawnFlyChar("5"); pressNum("5"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>^</span>
            <CalcBtn label="6" style={S.num} active={activeButtonId === "6"} pressed={pressedButtonId === "6"} btnId="6" onClick={() => { playClickSound("6"); spawnFlyChar("6"); pressNum("6"); }} />
          </div>
          <CalcBtn label="×" style={S.op} onClick={() => pressOp("×")} />
          <CalcBtn label="÷" style={S.op} onClick={() => pressOp("÷")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginBottom: 10, gridAutoRows: "48px" }}>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>sin</span>
            <CalcBtn label="1" style={S.num} active={activeButtonId === "1"} pressed={pressedButtonId === "1"} btnId="1" onClick={() => { playClickSound("1"); spawnFlyChar("1"); pressNum("1"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>cos</span>
            <CalcBtn label="2" style={S.num} active={activeButtonId === "2"} pressed={pressedButtonId === "2"} btnId="2" onClick={() => { playClickSound("2"); spawnFlyChar("2"); pressNum("2"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>tan</span>
            <CalcBtn label="3" style={S.num} active={activeButtonId === "3"} pressed={pressedButtonId === "3"} btnId="3" onClick={() => { playClickSound("3"); spawnFlyChar("3"); pressNum("3"); }} />
          </div>
          <CalcBtn label="+" style={S.op} onClick={() => pressOp("+")} />
          <CalcBtn label="−" style={S.op} onClick={() => pressOp("−")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, gridAutoRows: "48px" }}>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>Rnd</span>
            <CalcBtn label="0" style={S.num} active={activeButtonId === "0"} pressed={pressedButtonId === "0"} btnId="0" onClick={() => { playClickSound("0"); spawnFlyChar("0"); pressNum("0"); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>Δ%</span>
            <CalcBtn label="." style={S.num} active={activeButtonId === "dot"} pressed={pressedButtonId === "dot"} btnId="dot" onClick={() => { playClickSound("dot"); spawnFlyChar("dot"); pressNum("."); }} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 2, right: 2, fontSize: "13px", fontWeight: "bold", lineHeight: 1, pointerEvents: "none", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#8B4513" }}>π</span><span style={{ color: "#cc0000" }}>e</span>
            </span>
            <CalcBtn label="×10ˣ" style={{ ...S.op, textSize: "17px" }} onClick={() => {}} />
          </div>
          <div style={{ position: "relative", display: "grid" }}>
            <span style={{ position: "absolute", top: -4, left: 0, right: 0, textAlign: "center", fontSize: "13px", fontWeight: "bold", color: "#8B4513", lineHeight: 1, pointerEvents: "none" }}>DRG►</span>
            <CalcBtn label="Ans" style={S.op} onClick={() => {}} />
          </div>
          <CalcBtn label="EXE" style={S.exe} active={activeButtonId === "exe"} pressed={pressedButtonId === "exe"} btnId="exe" onClick={pressEXE} />
        </div>
        </div>

        <div style={{ position:"absolute", top:"50%", left:0, width:14, bottom:0,
          background:"#666", clipPath:"polygon(0 0, 0 100%, 100% 100%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:"50%", right:0, width:14, bottom:0,
          background:"#666", clipPath:"polygon(100% 0, 0 100%, 100% 100%)", pointerEvents:"none" }} />
      </div>

      <svg width={353} height={20} style={{ display: "block", marginTop: -1 }}>
        <path d="M 0 0 A 176.5 20 0 0 0 353 0 Z" fill="#d4d4d4" />
        <path d="M 0 0 A 176.5 20 0 0 0 353 0" fill="none" stroke="#666" strokeWidth="14" strokeLinecap="round" />
      </svg>
      </div>
    </div>
  );
});

export default CasioFC200V;
