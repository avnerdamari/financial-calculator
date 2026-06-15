import { useCallback, useEffect, useRef, useState } from "react";
import CasioFC200V, { type CalcHandle } from "./components/CasioFC200V";
import DemoPanel from "./components/DemoPanel";
import type { CMPDParams, DemoStep } from "./demo/steps";


export default function App() {
  const calcRef = useRef<CalcHandle>(null);
  const calcContainerRef = useRef<HTMLDivElement>(null);
  const nextTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Demo state
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0); // next step to execute
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

  const handleNotification = useCallback((text: string, isError: boolean) => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotification({ text, isError });
    notifTimerRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  // Auto-play: highlight → pause → press → pause → next
  useEffect(() => {
    if (!isRunning || demoMode !== "auto") return;
    if (stepIndex >= steps.length) {
      setIsRunning(false);
      setActiveButtonId(null);
      setCurrentLabel("✅ הסתיים!");
      return;
    }
    const step = steps[stepIndex];
    setActiveButtonId(step.buttonId);
    setCurrentLabel(step.label);

    // Digit/dot/sign: delay state update until flying animation lands on LCD field
    const isTypedChar = /^[0-9]$/.test(step.buttonId) || step.buttonId === "dot" || step.buttonId === "sign";

    // 900ms: visual press + flying animation starts; non-typed buttons execute immediately
    const execTimer = setTimeout(() => {
      setPressedButtonId(step.buttonId);
      if (!isTypedChar) calcRef.current?.pressButton(step.buttonId);
    }, 900);

    // For typed chars: execute when animation lands (~430+280 = 710ms after animation start)
    const landTimer = isTypedChar
      ? setTimeout(() => { calcRef.current?.pressButton(step.buttonId); }, 900 + 720)
      : null;

    const releaseTimer = setTimeout(() => {
      setPressedButtonId(null);
    }, isTypedChar ? 900 + 820 : 1050);

    const advanceTimer = setTimeout(() => {
      setStepIndex(i => i + 1);
    }, isTypedChar ? 1750 : 1400);

    return () => {
      clearTimeout(execTimer);
      if (landTimer) clearTimeout(landTimer);
      clearTimeout(releaseTimer);
      clearTimeout(advanceTimer);
    };
  }, [isRunning, demoMode, stepIndex, steps]);

  const handleStart = useCallback(() => {
    calcRef.current?.reset();
    setStepIndex(0);
    setActiveButtonId(null);
    setCurrentLabel("");
    setIsRunning(true);
  }, []);

  const handlePractice = useCallback(() => {
    calcRef.current?.reset();
    setStepIndex(0);
    setActiveButtonId(null);
    setCurrentLabel("");
    setIsRunning(false);
    setIsPracticing(true);
  }, []);

  const handleNext = useCallback(() => {
    if (stepIndex >= steps.length) return;
    const step = steps[stepIndex];
    setActiveButtonId(step.buttonId);
    setCurrentLabel(step.label);
    setStepIndex(i => i + 1);
    const t1 = setTimeout(() => {
      setPressedButtonId(step.buttonId);
      calcRef.current?.pressButton(step.buttonId);
    }, 600);
    const t2 = setTimeout(() => {
      setPressedButtonId(null);
      setActiveButtonId(null);
      if (stepIndex + 1 >= steps.length) setCurrentLabel("✅ הסתיים!");
    }, 750);
    nextTimersRef.current = [t1, t2];
  }, [stepIndex, steps]);

  // Cancel any in-flight step-mode timers before switching mode
  const handleModeChange = useCallback((mode: "auto" | "step") => {
    nextTimersRef.current.forEach(clearTimeout);
    nextTimersRef.current = [];
    setActiveButtonId(null);
    setPressedButtonId(null);
    setDemoMode(mode);
  }, []);

  const handleStop = useCallback(() => {
    nextTimersRef.current.forEach(clearTimeout);
    nextTimersRef.current = [];
    setIsRunning(false);
    setIsPracticing(false);
    setActiveButtonId(null);
    setCurrentLabel("");
  }, []);

  const handleStepsReady = useCallback((newSteps: DemoStep[], params?: CMPDParams) => {
    setIsPracticing(false);
    setExpectedParams(params ?? null);
    nextTimersRef.current.forEach(clearTimeout);
    nextTimersRef.current = [];
    setSteps(newSteps);
    setStepIndex(0);
    setIsRunning(false);
    setActiveButtonId(null);
    setCurrentLabel("");
    setTimeout(() => {
      calcContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-8 px-4"
         style={{ background: "#1a1a2e" }}>
      <h1 className="text-white text-2xl font-bold mb-1 tracking-wide">
        Casio FC-200V Simulator
      </h1>
      <p className="text-slate-400 text-sm mb-4">
        Financial Consultant — Interactive Simulator
      </p>

      <DemoPanel
        onStepsReady={handleStepsReady}
        onModeChange={handleModeChange}
        onStart={handleStart}
        onPractice={handlePractice}
        onNext={handleNext}
        onStop={handleStop}
        onListeningChange={setListening}
        demoMode={demoMode}
        isRunning={isRunning}
        stepIndex={stepIndex}
        totalSteps={steps.length}
        currentLabel={currentLabel}
        hasSteps={steps.length > 0}
        isPracticing={isPracticing}
        notification={notification}
      />

      <div ref={calcContainerRef}>
        <CasioFC200V ref={calcRef} activeButtonId={activeButtonId} pressedButtonId={pressedButtonId}
          onPowerOff={() => { handleStop(); setExpectedParams(null); }} listening={listening}
          expectedParams={expectedParams} onNotification={handleNotification} />
      </div>
    </div>
  );
}
