import { useEffect, useRef, useState } from "react";
import { buildCMPDSteps, type CMPDParams, type DemoStep } from "../demo/steps";

interface Props {
  onStepsReady: (steps: DemoStep[], params?: CMPDParams) => void;
  onModeChange: (mode: "auto" | "step") => void;
  onStart: () => void;
  onPractice: () => void;
  onNext: () => void;
  onStop: () => void;
  onListeningChange: (v: boolean) => void;
  demoMode: "auto" | "step";
  isRunning: boolean;
  stepIndex: number;
  totalSteps: number;
  currentLabel: string;
  hasSteps: boolean;
  isPracticing?: boolean;
  notification?: { text: string; isError: boolean } | null;
}

type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
type SR = typeof window & {
  SpeechRecognition: new () => SpeechRec;
  webkitSpeechRecognition: new () => SpeechRec;
};

export default function DemoPanel({
  onStepsReady, onModeChange, onStart, onPractice, onNext, onStop, onListeningChange,
  demoMode, isRunning, stepIndex, totalSteps, currentLabel, hasSteps, isPracticing, notification,
}: Props) {
  const [questionText, setQuestionText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const recognitionRef = useRef<SpeechRec | null>(null);
  const shouldRestartRef = useRef(false);

  // ─── Voice commands (called on each final segment) ────────────────────────
  function processFinal(t: string) {
    const raw = t.trim();
    if (!raw) return;
    // strip punctuation + Hebrew niqqud for command matching
    const c = raw.replace(/[.,!?״׳\-ְ-ׇ]/g, "").trim();

    if (c.includes("מחק את המילה")) {
      setQuestionText(prev => prev.trim().split(/\s+/).slice(0, -1).join(" ")); return;
    }
    if (c.includes("מחק את השאלה") || c.includes("מחק שאלה")) {
      setQuestionText(""); return;
    }

    // append, then check if last two words are "טעות טעות"
    // (handles both: single result "טעות טעות" and two separate results)
    setQuestionText(prev => {
      const next = prev.trim() ? prev.trim() + " " + raw : raw;
      const words = next.replace(/[.,!?״׳\-ְ-ׇ]/g, " ").trim().split(/\s+/);
      if (words.length >= 2 && words[words.length - 1] === "טעות" && words[words.length - 2] === "טעות") {
        return "";
      }
      return next;
    });
  }

  // ─── Web Speech API ───────────────────────────────────────────────────────
  function startVoice() {
    setError("");
    const SpeechRec = (window as SR).SpeechRecognition || (window as SR).webkitSpeechRecognition;
    if (!SpeechRec) { setError("הדפדפן אינו תומך בזיהוי דיבור (נסה Chrome)"); return; }

    const rec: SpeechRec = new SpeechRec();
    rec.lang = "he-IL";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) processFinal(t);
        else interim += t;
      }
      setInterimText(interim);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      setError(`שגיאה: ${e.error}`);
    };

    rec.onend = () => {
      setInterimText("");
      if (shouldRestartRef.current) {
        try { rec.start(); } catch { /* already started */ }
      } else {
        setListening(false);
        onListeningChange(false);
      }
    };

    rec.start();
    recognitionRef.current = rec;
    shouldRestartRef.current = true;
    setListening(true);
    onListeningChange(true);
  }

  function stopVoice() {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimText("");
    setListening(false);
    onListeningChange(false);
  }

  // ─── Image / paste handling ───────────────────────────────────────────────
  async function extractTextFromImage(file: File) {
    setIsLoading(true); setLoadingMsg("מחלץ טקסט מהתמונה..."); setError("");
    setQuestionText("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = dataUrl.split(",")[1];
      const mediaType = dataUrl.split(";")[0].split(":")[1];
      const res = await fetch("/api/parse-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mediaType, mode: "extract" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { text } = await res.json();
      setQuestionText(text);
    } catch (err: any) {
      setError(`שגיאה: ${err?.message ?? String(err)}`);
    } finally {
      setIsLoading(false); setLoadingMsg("");
    }
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    extractTextFromImage(file);
    e.target.value = "";
  }

  const extractTextRef = useRef(extractTextFromImage);
  extractTextRef.current = extractTextFromImage;

  useEffect(() => {
    function onDocPaste(e: ClipboardEvent) {
      if (isLoadingRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) extractTextRef.current(file);
          return;
        }
      }
    }
    document.addEventListener("paste", onDocPaste);
    return () => document.removeEventListener("paste", onDocPaste);
  }, []);

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        const file = items[i].getAsFile();
        if (file) extractTextFromImage(file);
        return;
      }
    }
  }

  // ─── Parse & demo ─────────────────────────────────────────────────────────
  async function parseQuestion() {
    setIsLoading(true); setLoadingMsg("מנתח שאלה..."); setError("");
    try {
      const res = await fetch("/api/parse-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: questionText }),
      });
      if (!res.ok) throw new Error(await res.text());
      const params: CMPDParams = await res.json();
      onStepsReady(buildCMPDSteps(params), params);
    } catch (err: any) {
      setError(`שגיאה: ${err?.message ?? String(err)}`);
    } finally {
      setIsLoading(false); setLoadingMsg("");
    }
  }

  const progressPct = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;
  const isDone = stepIndex >= totalSteps && totalSteps > 0;

  // ─── Practice mode view ───────────────────────────────────────────────────
  if (isPracticing) {
    return (
      <div style={{
        width: 353, marginBottom: 10,
        background: "#0c2340", borderRadius: 10, padding: "10px 12px",
        border: "1px solid #0369a1", color: "#fff", fontFamily: "sans-serif",
      }}>
        <div style={{ fontSize: 13, color: "#7dd3fc", marginBottom: 8, textAlign: "center", fontWeight: 600 }}>
          ✏️ מצב תרגול — הכנס נתונים בעצמך
        </div>
        {notification && (
          <div style={{
            background: notification.isError ? "#7a1010" : "#7a5000",
            color: "#fff", padding: "6px 10px", borderRadius: 6, marginBottom: 8,
            fontSize: 12, fontWeight: "bold", direction: "rtl", textAlign: "center",
            border: `1px solid ${notification.isError ? "#ff6666" : "#ffcc44"}`,
          }}>
            ⚠ {notification.text}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, textAlign: "center" }}>
          עבור להדגמה:
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {["auto", "step"].map(m => (
            <button key={m} onClick={() => { onModeChange(m as "auto" | "step"); onStart(); }} style={{
              flex: 1, padding: "5px", borderRadius: 6, border: "none", cursor: "pointer",
              background: demoMode === m ? "#f59e0b" : "#374151", color: "#fff", fontSize: 11, fontWeight: 600,
            }}>{m === "auto" ? "▶ אוטומטי" : "⏭ צעד-צעד"}</button>
          ))}
          <button onClick={() => { onStop(); onStepsReady([]); }} style={{
            padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            background: "#374151", color: "#fff", fontSize: 11, fontWeight: 600,
          }}>✕</button>
        </div>
      </div>
    );
  }

  // ─── Running demo view ────────────────────────────────────────────────────
  if (isRunning || (hasSteps && stepIndex > 0)) {
    return (
      <div style={{
        width: 353, marginBottom: 10,
        background: "#1e293b", borderRadius: 10, padding: "8px 12px",
        border: "1px solid #334155", color: "#fff", fontFamily: "sans-serif",
      }}>
        <div style={{ background: "#1e3a5f", borderRadius: 4, height: 5, marginBottom: 6 }}>
          <div style={{
            background: isDone ? "#16a34a" : "#3b82f6", height: "100%", borderRadius: 4,
            width: `${progressPct}%`, transition: "width 300ms",
          }} />
        </div>
        <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 4 }}>
          {isDone ? "✅ הסתיים!" : `${stepIndex}/${totalSteps}: ${currentLabel}`}
        </div>
        {notification && (
          <div style={{
            background: notification.isError ? "#7a1010" : "#7a5000",
            color: "#fff", padding: "5px 8px", borderRadius: 5, marginBottom: 4,
            fontSize: 11, fontWeight: "bold", direction: "rtl", textAlign: "center",
            border: `1px solid ${notification.isError ? "#ff6666" : "#ffcc44"}`,
          }}>⚠ {notification.text}</div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {["auto", "step"].map(m => (
            <button key={m} onClick={() => onModeChange(m as "auto" | "step")} style={{
              flex: 1, padding: "4px", borderRadius: 6, border: "none", cursor: "pointer",
              background: demoMode === m ? "#f59e0b" : "#374151", color: "#fff", fontSize: 11, fontWeight: 600,
            }}>{m === "auto" ? "▶ אוטומטי" : "⏭ צעד-צעד"}</button>
          ))}
          {demoMode === "step" && !isDone && (
            <button onClick={onNext} style={{
              flex: 1, padding: "4px", borderRadius: 6, border: "none", cursor: "pointer",
              background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600,
            }}>הבא ⏭</button>
          )}
          <button onClick={() => { onStop(); onStepsReady([]); setError(""); }} style={{
            padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 600,
          }}>⏹</button>
        </div>
      </div>
    );
  }

  // ─── Input panel ──────────────────────────────────────────────────────────
  const displayText = isLoading
    ? loadingMsg
    : listening && interimText
      ? (questionText.trim() ? questionText.trim() + " " + interimText : interimText)
      : questionText;

  return (
    <div style={{
      width: 353, marginBottom: 12,
      background: "#1e293b", borderRadius: 12, padding: "12px 14px",
      border: "1px solid #334155", color: "#fff", fontFamily: "sans-serif",
    }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => { setError(""); listening ? stopVoice() : startVoice(); }}
          disabled={isLoading}
          style={{
            flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
            background: listening ? "#ef4444" : "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600,
          }}
        >{listening ? "⏹ עצור" : "🎙️ הקלט שאלה"}</button>
        <button
          onClick={() => { setError(""); fileRef.current?.click(); }}
          disabled={isLoading}
          style={{
            flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
            background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 600,
          }}
        >📷 העלה תמונה</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} />
      </div>

      <div style={{ position: "relative", marginBottom: 6 }}>
        <textarea
          value={displayText}
          onChange={e => { if (!listening) setQuestionText(e.target.value); }}
          onPaste={handlePaste}
          readOnly={isLoading || listening}
          placeholder="הכנס שאלה או הדבק תמונה (Ctrl+V)..." dir="rtl" rows={2}
          style={{
            width: "100%", boxSizing: "border-box", padding: "6px 28px 6px 8px",
            background: "#0f172a",
            color: isLoading ? "#94a3b8" : listening && interimText ? "#94a3b8" : "#e2e8f0",
            border: "1px solid #475569", borderRadius: 6, fontSize: 12,
            resize: "none", fontFamily: "inherit",
          }}
        />
        {questionText && !isLoading && !listening && (
          <button
            onClick={() => setQuestionText("")}
            style={{
              position: "absolute", top: 4, left: 6,
              background: "none", border: "none", cursor: "pointer",
              color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: 2,
            }}
          >×</button>
        )}
      </div>

      {notification && (
        <div style={{
          background: notification.isError ? "#7a1010" : "#7a5000",
          color: "#fff", padding: "6px 10px", borderRadius: 6, marginBottom: 6,
          fontSize: 12, fontWeight: "bold", direction: "rtl", textAlign: "center",
          border: `1px solid ${notification.isError ? "#ff6666" : "#ffcc44"}`,
        }}>
          ⚠ {notification.text}
        </div>
      )}

      {error && error.trim() !== "שגיאה:" && (
        <div style={{ color: "#f87171", fontSize: 11, marginBottom: 6, textAlign: "center" }}>{error}</div>
      )}

      {questionText.trim() && !hasSteps && (
        <button onClick={parseQuestion} disabled={isLoading} style={{
          width: "100%", padding: "7px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "#059669", color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 8,
        }}>{isLoading ? loadingMsg : "🔍 נתח שאלה"}</button>
      )}

      {hasSteps && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {["auto", "step"].map(m => (
              <button key={m} onClick={() => onModeChange(m as "auto" | "step")} style={{
                flex: 1, padding: "6px", borderRadius: 6, border: "none", cursor: "pointer",
                background: demoMode === m ? "#f59e0b" : "#374151", color: "#fff", fontSize: 12, fontWeight: 600,
              }}>{m === "auto" ? "▶ אוטומטי" : "⏭ צעד-צעד"}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onStart} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700,
            }}>▶ הדגמה</button>
            <button onClick={onPractice} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#0369a1", color: "#fff", fontSize: 13, fontWeight: 700,
            }}>✏️ תרגל לבד</button>
          </div>
        </>
      )}
    </div>
  );
}
