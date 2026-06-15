export type Field = "n" | "I" | "PV" | "PMT" | "FV";
export const FIELD_ORDER: Field[] = ["n", "I", "PV", "PMT", "FV"];

export interface CMPDParams {
  n?: number | null;
  I?: number | null;
  PV?: number | null;
  PMT?: number | null;
  FV?: number | null;
  solve: Field;
  endBegin?: "END" | "BEGIN";
}

export interface DemoStep {
  buttonId: string;
  label: string;
}

function typeNumber(value: number): DemoStep[] {
  const steps: DemoStep[] = [];
  const strVal = String(value);
  const isNeg = strVal.startsWith("-");
  const absStr = isNeg ? strVal.slice(1) : strVal;
  for (const ch of absStr) {
    steps.push({ buttonId: ch === "." ? "dot" : ch, label: `הקלד ${ch}` });
  }
  if (isNeg) steps.push({ buttonId: "sign", label: "שנה סימן ל-מינוס (−)" });
  return steps;
}

export function buildCMPDSteps(params: CMPDParams): DemoStep[] {
  const steps: DemoStep[] = [];
  const { solve, endBegin = "END" } = params;

  // 1. Set END/BEGIN (cursor starts at -1 = Set row, reset() already set CMPD)
  if (endBegin === "BEGIN") {
    steps.push({ buttonId: "exe", label: "פתח תפריט payment (EXE על Set)" });
    steps.push({ buttonId: "1", label: "בחר 1:Begin" });
  }

  // 3. Navigate from Set row to n (first field)
  steps.push({ buttonId: "down", label: "עבור לשדה n ▽" });

  let cursor = 0; // now pointing at FIELD_ORDER[0] = n

  // 4. Fill in each field
  for (let i = 0; i < FIELD_ORDER.length; i++) {
    const field = FIELD_ORDER[i];
    const isLast = i === FIELD_ORDER.length - 1;

    const value = params[field];
    const hasValue = field !== solve && value !== undefined && value !== null && value !== 0;

    if (field === solve) {
      // solve field — just navigate through, no entry
      if (!isLast) {
        steps.push({ buttonId: "down", label: `דלג על ${field} — יחושב אוטומטית ▽` });
        cursor++;
      }
      continue;
    }

    if (hasValue) {
      // enter value + EXE — EXE now advances cursor automatically
      steps.push(...typeNumber(value as number));
      steps.push({ buttonId: "exe", label: `הזן ${field} ← EXE` });
      if (!isLast) cursor++; // EXE advances — no down needed
    } else if (!isLast) {
      // no value entered — navigate with down
      steps.push({ buttonId: "down", label: `עבור לשדה הבא ▽` });
      cursor++;
    }
  }

  // 5. Navigate back to the solve field
  const solveIdx = FIELD_ORDER.indexOf(solve);
  while (cursor > solveIdx) {
    steps.push({ buttonId: "up", label: `עלה לשדה ${solve} △` });
    cursor--;
  }
  while (cursor < solveIdx) {
    steps.push({ buttonId: "down", label: `רד לשדה ${solve} ▽` });
    cursor++;
  }

  // 6. Solve
  steps.push({ buttonId: "solve", label: `לחץ SOLVE — חישוב ${solve}` });

  return steps;
}
