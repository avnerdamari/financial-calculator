# Financial-Calculator — Casio FC-200V Simulator

**תאריך עדכון אחרון:** 2026-06-11

## סטטוס נוכחי

✅ **פרוס ב-Vercel:** `https://financial-calculator-rho-orpin.vercel.app`
- Scope: `avner-s-projects2` · Project: `financial-calculator`
- פריסה ידנית: `vercel --prod` (אבנר מריץ בעצמו)

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
| SET | EXE על Set | בחירת END / BEGIN |

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
