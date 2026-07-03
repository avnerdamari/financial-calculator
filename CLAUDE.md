# Financial-Calculator — Casio FC-200V Simulator

**תאריך עדכון אחרון:** 2026-07-03

## סטטוס נוכחי

✅ **פרוס ב-Vercel:** `https://financial-calculator-rho-orpin.vercel.app`
- Scope: `avner-s-projects2` · Project: `financial-calculator`
- פריסה ידנית: `vercel --prod` (אבנר מריץ בעצמו)

## היסטוריית גרסאות (git tag)

| גרסה | תאריך | הערות |
|------|-------|-------|
| v1.3.0 | 2026-07-03 | מצב STAT (סטטיסטיקה חד-משתנית משוקללת, X/FREQ) |
| v1.2.0 | 2026-07-02 | מצב CNVR (המרת ריבית) — n / I% / EFF:Solve / APR:Solve |
| v1.1.0 | — | תיקון מינוס ב-CASH |
| v1.0.0 | — | גרסה ראשונה |

🗑️ **הוסר סופית 2026-07-03:** הפיצ'ר "📄 דף נוסחאות למבחן" (`FormulaSheetPanel.tsx` + הכפתור וה-state ב-`App.tsx`) — נמחק לגמרי לפי בקשה מפורשת, אחרי ששוחזר יום קודם לכן.

## תיאור קצר

סימולטור עצמאי של מחשבון פיננסי Casio FC-200V.
פרויקט נפרד מ-Finance-App — מפותח כאן, מועתק ל-Finance-App בכל עדכון.

## קשר ל-Finance-App

- **קובץ המקור:** `C:\ClaudeProjects\Financial-Calculator\src\components\CasioFC200V.tsx`
- **עותק ב-Finance-App:** `C:\ClaudeProjects\Finance-App\src\components\CasioFC200V.tsx`
- לאחר כל שינוי — להעתיק ידנית:
  ```
  Copy-Item C:\ClaudeProjects\Financial-Calculator\src\components\CasioFC200V.tsx `
             C:\ClaudeProjects\Finance-App\src\components\CasioFC200V.tsx
  ```

## סטאק

- **Vite + React + TypeScript + Tailwind 3**
- ללא תלויות חיצוניות נוספות — המחשבון עצמאי לחלוטין

## הרצה מקומית

```
cd C:\ClaudeProjects\Financial-Calculator
npm run dev        # http://localhost:5192
```

## מבנה קבצים

```
src/
  App.tsx                    — עטיפה פשוטה: כותרת + CasioFC200V
  main.tsx                   — entry point
  index.css                  — Tailwind + סגנונות casio-key
  components/
    CasioFC200V.tsx          — המחשבון המלא (המקור היחיד)
```

## מצבי מסך במחשבון

| מצב | גישה | תיאור |
|-----|------|--------|
| CMPD | כפתור CMPD | TVM — n / I% / PV / PMT / FV |
| CASH | כפתור CASH | תזרים — Cff / C01-C03 / Nj / NPV / IRR / NFV / PBP |
| AMRT | כפתור AMRT | לוח סילוקין — PM1 / PM2 / ∑INT / ∑PRI / BAL |
| CNVR | כפתור CNVR | המרה נומינלי↔אפקטיבי — n / I% (קלט) / EFF (Solve) / APR (Solve) |
| STAT | כפתור STAT | סטטיסטיקה חד-משתנית — Data(עורך X/FREQ) / n / x̄ / Σx / Σx² / sx / σx |
| SET | EXE על Set | בחירת END / BEGIN |

## מצב CNVR — המרת ריבית (Conversion)

**נוסף 2026-07-02, תוקן לפי צילומי מחשבון פיזי אמיתי.** 4 שורות (לא 3!) — `I%` הוא רגיסטר-עבודה יחיד, ו-EFF/APR הן שתי שורות SOLVE-בלבד (read-only) שכל אחת ממירה את `I%` בכיוון אחר:

```
n=        ← מספר תקופות היוון בשנה (קלט)
I%=       ← הריבית שממירים (קלט יחיד — לא נומינלי ולא אפקטיבי כשלעצמו)
EFF:Solve ← ממיר: I% בתור נומינלי → מחשב אפקטיבי
APR:Solve ← ממיר: I% בתור אפקטיבי → מחשב נומינלי
```

נוסחאות: `EFF = ((1+I%/100/n)^n − 1) × 100` | `APR = ((1+I%/100)^(1/n) − 1) × n × 100`
SOLVE על `n` או `I%` אינו נתמך (כמו במחשבון הפיזי) — מציג "—". דוגמה שנבדקה: n=12, I%=8 → EFF=8.3, APR=7.72.

## מצב STAT — סטטיסטיקה חד-משתנית (1-VAR)

**נוסף 2026-07-03, מבוסס עלון עם הוראות + 2 דוגמאות פתורות (`CamScanner 03.07.2026`).** הטבלה היא **שני טורים X ו-FREQ** (לא רשימת ערכים בודדת!) — FREQ יכול להיות גם הסתברות (לא רק מספר שלם חוזר), מה שמאפשר תוחלת/סטיית-תקן של התפלגות רווחים משוקללת:

```
Data=D.Editor  ← נכנס לעורך טבלת X/FREQ (כמו CASH — לחיצה על תא עוברת עמודה, ↑↓ עובר שורה)
n=      Solve  ← Σfreq (סה"כ משקל, לא בהכרח מס' שורות)
x̄=      Solve  ← ממוצע משוקלל
Σx=     Solve  ← Σ(x·freq)
Σx²=    Solve  ← Σ(x²·freq)
sx=     Solve  ← סטיית תקן מדגם (n−1)
σx=     Solve  ← סטיית תקן אוכלוסייה (n)
```

SOLVE אחד מחשב את **כל** השורות יחד (לא כל שורה בנפרד). שורה חדשה בעורך מקבלת FREQ ברירת מחדל = 1.
**אומת חי בדפדפן** מול 2 הדוגמאות בעלון: {100,80,65,−35,80,75,95,−15} → ממוצע 55.625/σx 47.92 ✓ (חושב ידנית, תואם), ומול תרגיל FREQ משוקלל עצמאי {X=10,freq=2; X=20,freq=1} → ממוצע 13.33 ✓.
**גוצ'ה שנתקלנו בה:** תאי הטבלה משתמשים ב-`onMouseDown` (לא `onPointerDown` כמו כפתורי CalcBtn) — לבדיקה פרוגרמטית יש לשגר `MouseEvent('mousedown')`, לא `PointerEvent('pointerdown')`. כמו כן לכל הקשת ספרה יש עיכוב אנימציה של 750ms (`pressNumAfterFly`/`FLY_LANDING_MS`) לפני שהערך נקלט בפועל.

## שדות CASH — לייבלים נכונים (תואם מחשבון פיזי)

```
I%=       ← שיעור ההיוון
Cff=      ← השקעה ראשונית t=0 (במינוס)
C01=      ← תזרים שנה 1
Nj=       ← כמה פעמים C01 חוזר
C02=, C03=, Nj= ...
NPV=      ← SOLVE כאן לחישוב NPV
IRR=      ← SOLVE כאן לחישוב IRR
NFV=      ← SOLVE כאן לחישוב NFV
PBP=      ← SOLVE כאן לחישוב תקופת החזר
```

## מצב הדגמה (Demo Mode)

### תיאור
לחצן הדגמה מעל המחשבון — התלמיד מקליט שאלה בקול או מעלה תמונה,
ה-AI מנתח את הפרמטרים, ואנימציה מדגימה לחיצה על כל כפתור בסדר הנכון.

### קבצים
- `api/parse-question.ts` — Vercel serverless, קורא Claude Haiku לניתוח שאלה
- `src/demo/steps.ts` — בונה רצף DemoStep[] מתוך CMPDParams
- `src/components/DemoPanel.tsx` — ממשק הדגמה (קול/תמונה/auto/step)
- `src/App.tsx` — מנהל state + timer האנימציה
- `CasioFC200V` — קיבל `forwardRef` + prop `activeButtonId` + כפתורים מאירים

### הרצה מקומית עם API
```
vercel dev      # במקום npm run dev — מפעיל גם את api/parse-question.ts
```
`npm run dev` עדיין עובד אבל ה-Demo לא יפעל (אין serverless).

### משתנה סביבה נדרש
```
ANTHROPIC_API_KEY=sk-ant-...
```
להוסיף ב-Vercel Dashboard → Project Settings → Environment Variables.
לבדיקה מקומית: קובץ `.env` בשורש הפרויקט (gitignored).

## פלייר שיווקי

### מיקום
```
C:\ClaudeProjects\Financial-Calculator\flyers\flyer_finance.html
```

### רקע
פלייר A4 להדפסה ולשיתוף דיגיטלי — מקדם את הסימולטור לסטודנטים ואת שיעורי המימון הפרטיים של אבנר.

### מה יש בפלייר
- **כותרת** — Casio FC-200V, גרסה דיגיטלית חינמית
- **3 מודולים** — CMPD / CASH / AMRT עם תיאור קצר
- **QR code** — מצביע ל-`https://financial-calculator-rho-orpin.vercel.app`
- **בלוק מורה פרטי** — תיאור שיעורים פרטיים עם אבנר
- **פוטר** — טלפון + מייל

### טכנולוגיה
- קובץ HTML עצמאי, ללא build — פותחים ישירות בדפדפן
- QR code נוצר ב-runtime עם ספריית `qrcodejs` (CDN)
- A4 מדויק — מתאים גם ל-"הדפס לקובץ PDF" מהדפדפן

### אנחנו מתחילים — מה רוצים לשפר
> **נקודת ההתחלה:** הפלייר הנוכחי פונקציונלי אבל יש מרחב שיפור עיצובי ותוכני.
>
> כיוונים לשיפור אפשריים:
> - תיקון `gap: 100px` בין האזורים (גורם לרווחים ענקיים)
> - שיפור ויזואלי — גרדיאנט, אייקונים, טיפוגרפיה
> - הוספת תוכן — דוגמאות שאלות, יתרונות הכלי
> - גרסה שנייה — פלייר ל-Finance-Tutor (סוכן ה-AI)

## גוצ'ות ידועות

| בעיה | פתרון |
|------|--------|
| Symlink דורש Admin על Windows | להעתיק ידנית אחרי כל שינוי |
| מסכים צרים מ-360px | שקול הוספת scale אוטומטי |

## פקודת עדכון Finance-App לאחר שינוי

```powershell
Copy-Item C:\ClaudeProjects\Financial-Calculator\src\components\CasioFC200V.tsx `
           C:\ClaudeProjects\Finance-App\src\components\CasioFC200V.tsx
```
