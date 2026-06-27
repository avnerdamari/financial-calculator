import { useCallback, useEffect, useRef, useState } from "react";
import CasioFC200V, { type CalcHandle } from "./components/CasioFC200V";
import DemoPanel from "./components/DemoPanel";
import FormulaSheetPanel from "./components/FormulaSheetPanel";
import type { CMPDParams, DemoStep } from "./demo/steps";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

/* ─── כרטיס שאלה להקלטה — שנה את QUESTION_INDEX כדי לעבור בין שאלות ─── */
const SHOW_QUESTION_CARD = false;   // ← false כדי להסתיר לפני פריסה
const QUESTION_INDEX = 0;          // ← 0 = CMPD | 1 = CASH | 2 = AMRT

const DEMO_QUESTIONS = [
  {
    mode: "CMPD — ריבית דריבית",
    color: "#1a4fa3",
    bg: "#e8f0ff",
    text: "הלוואה של 100,000 ₪ לתקופה של 10 שנים בריבית שנתית 5%.\nמה התשלום החודשי? (לוח שפיצר)",
  },
  {
    mode: "CASH — תזרים מזומנים",
    color: "#085041",
    bg: "#e1f5ee",
    text: "השקעה של 50,000 ₪ מניבה: שנה 1 — 15,000 ₪, שנה 2 — 20,000 ₪, שנה 3 — 25,000 ₪.\nשיעור היוון 8%. מה ה-NPV?",
  },
  {
    mode: "AMRT — לוח סילוקין",
    color: "#633806",
    bg: "#faeeda",
    text: "הלוואה של 200,000 ₪ ל-20 שנה בריבית 4.5%.\nמה סכום הריבית שנצבר בשנה הראשונה?",
  },
];

export default function App() {
  const calcRef = useRef<CalcHandle>(null);
  const calcContainerRef = useRef<HTMLDivElement>(null);
  const nextTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [demoMode, setDemoMode] = useState<"auto" | "step">("auto");
  const [isRunning, setIsRunning] = useState(false);
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
  const [pressedButtonId, setPressedButtonId] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState("");
  const [listening, setListening] = useState(false);
  const [expectedParams, setExpectedParams] = useState<CMPDParams | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [notification, setNotification] = useState<{ text: string; isError: boolean } | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFormulaSheet, setShowFormulaSheet] = useState(false);

  const handleNotification = useCallback((text: string, isError: boolean) => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotification({ text, isError });
    notifTimerRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    if (!DEMO_MODE || !isRunning || demoMode !== "auto") return;
    if (stepIndex >= steps.length) {
      setIsRunning(false); setActiveButtonId(null); setCurrentLabel("✅ הסתיים!");
      return;
    }
    const step = steps[stepIndex];
    setActiveButtonId(step.buttonId);
    setCurrentLabel(step.label);
    const isTypedChar = /^[0-9]$/.test(step.buttonId) || step.buttonId === "dot" || step.buttonId === "sign";
    const execTimer = setTimeout(() => {
      setPressedButtonId(step.buttonId);
      if (!isTypedChar) calcRef.current?.pressButton(step.buttonId);
    }, 900);
    const landTimer = isTypedChar ? setTimeout(() => { calcRef.current?.pressButton(step.buttonId); }, 1620) : null;
    const releaseTimer = setTimeout(() => { setPressedButtonId(null); }, isTypedChar ? 1720 : 1050);
    const advanceTimer = setTimeout(() => { setStepIndex(i => i + 1); }, isTypedChar ? 1750 : 1400);
    return () => {
      clearTimeout(execTimer);
      if (landTimer) clearTimeout(landTimer);
      clearTimeout(releaseTimer);
      clearTimeout(advanceTimer);
    };
  }, [isRunning, demoMode, stepIndex, steps]);

  const handleStart = useCallback(() => {
    calcRef.current?.reset(); setStepIndex(0); setActiveButtonId(null); setCurrentLabel(""); setIsRunning(true);
  }, []);

  const handlePractice = useCallback(() => {
    calcRef.current?.reset(); setStepIndex(0); setActiveButtonId(null); setCurrentLabel(""); setIsRunning(false); setIsPracticing(true);
  }, []);

  const handleNext = useCallback(() => {
    if (stepIndex >= steps.length) return;
    const step = steps[stepIndex];
    setActiveButtonId(step.buttonId); setCurrentLabel(step.label); setStepIndex(i => i + 1);
    const t1 = setTimeout(() => { setPressedButtonId(step.buttonId); calcRef.current?.pressButton(step.buttonId); }, 600);
    const t2 = setTimeout(() => { setPressedButtonId(null); setActiveButtonId(null); if (stepIndex + 1 >= steps.length) setCurrentLabel("✅ הסתיים!"); }, 750);
    nextTimersRef.current = [t1, t2];
  }, [stepIndex, steps]);

  const handleModeChange = useCallback((mode: "auto" | "step") => {
    nextTimersRef.current.forEach(clearTimeout); nextTimersRef.current = [];
    setActiveButtonId(null); setPressedButtonId(null); setDemoMode(mode);
  }, []);

  const handleStop = useCallback(() => {
    nextTimersRef.current.forEach(clearTimeout); nextTimersRef.current = [];
    setIsRunning(false); setIsPracticing(false); setActiveButtonId(null); setCurrentLabel("");
  }, []);

  const handleStepsReady = useCallback((newSteps: DemoStep[], params?: CMPDParams) => {
    setIsPracticing(false); setExpectedParams(params ?? null);
    nextTimersRef.current.forEach(clearTimeout); nextTimersRef.current = [];
    setSteps(newSteps); setStepIndex(0); setIsRunning(false); setActiveButtonId(null); setCurrentLabel("");
    setTimeout(() => { calcContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-8 px-4"
         style={{ background: "#1a1a2e" }}>
      <h1 className="text-white text-2xl font-bold mb-1 tracking-wide">Casio FC-200V Simulator</h1>
      <p className="text-slate-400 text-sm mb-3">Financial Consultant — Interactive Simulator</p>

      <button
        onClick={() => setShowFormulaSheet(true)}
        className="no-print mb-4 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
        style={{ background: "linear-gradient(135deg,#1a4fa3,#4a1a7a)", color: "white",
                 boxShadow: "0 2px 12px rgba(74,26,122,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}>
        📄 דף נוסחאות למבחן
      </button>

      {showFormulaSheet && <FormulaSheetPanel onClose={() => setShowFormulaSheet(false)} />}

      {SHOW_QUESTION_CARD && (() => {
        const q = DEMO_QUESTIONS[QUESTION_INDEX];
        return (
          <div style={{ background: q.bg, border: `2px solid ${q.color}`, borderRadius: 14, padding: "14px 20px", marginBottom: 16, width: 360, textAlign: "right", direction: "rtl" }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: q.color, marginBottom: 6, letterSpacing: 1 }}>{q.mode}</div>
            <div style={{ fontSize: 15, color: "#1a1a1a", lineHeight: 1.7, whiteSpace: "pre-line" }}>{q.text}</div>
          </div>
        );
      })()}

      {DEMO_MODE && (
        <DemoPanel
          onStepsReady={handleStepsReady} onModeChange={handleModeChange}
          onStart={handleStart} onPractice={handlePractice} onNext={handleNext}
          onStop={handleStop} onListeningChange={setListening}
          demoMode={demoMode} isRunning={isRunning} stepIndex={stepIndex}
          totalSteps={steps.length} currentLabel={currentLabel}
          hasSteps={steps.length > 0} isPracticing={isPracticing} notification={notification}
        />
      )}

      <div ref={calcContainerRef}>
        <CasioFC200V
          ref={calcRef}
          activeButtonId={DEMO_MODE ? activeButtonId : null}
          pressedButtonId={DEMO_MODE ? pressedButtonId : null}
          onPowerOff={() => { if (DEMO_MODE) { handleStop(); setExpectedParams(null); } }}
          listening={DEMO_MODE ? listening : false}
          expectedParams={DEMO_MODE ? expectedParams : null}
          onNotification={DEMO_MODE ? handleNotification : undefined}
        />
      </div>
    </div>
  );
}
