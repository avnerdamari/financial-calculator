import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const client = new Anthropic();

const SYSTEM = `You are a financial calculator assistant for a Casio FC-200V TVM calculator.
Extract TVM parameters from the user's question (text or image).

Return ONLY valid JSON — no markdown, no explanation:
{
  "mode": "CMPD",
  "solve": "PV" | "FV" | "PMT" | "n" | "I",
  "endBegin": "END" | "BEGIN",
  "n": number | null,
  "I": number | null,
  "PV": number | null,
  "PMT": number | null,
  "FV": number | null
}

Rules:
- mode is always "CMPD" for TVM (time value of money) problems
- solve = the unknown field to calculate
- Known values = numbers; unknown (to solve) = null
- CRITICAL — match n and I% to the payment frequency:
  - Monthly payments: n = years × 12, I = annual_rate / 12
  - Quarterly payments: n = years × 4, I = annual_rate / 4
  - Annual payments: n = years, I = annual_rate
  - Example: 10-year loan at 6% with monthly payments → n=120, I=0.5
- Sign convention (Casio FC-200V): cash IN = positive, cash OUT = negative
  - Borrower taking a loan: PV = positive (receives money), PMT = negative (pays each period), FV = 0
  - Investor making a deposit: PV = negative (pays now), FV = positive (receives later)
  - Loan repayment PMT is always negative (money going out)
- endBegin: "END" for ordinary annuity (payments at period end), "BEGIN" for annuity-due (payments at start)
- Default to "END" and PMT=0 if not specified`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, image, mediaType, mode } = req.body as {
    text?: string;
    image?: string;
    mediaType?: string;
    mode?: "extract" | "parse";
  };

  if (!text && !image) return res.status(400).json({ error: "text or image required" });

  try {
    // mode=extract: return question text from image
    if (mode === "extract" && image) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: "Extract the financial math question from the image. Return only the question text in Hebrew or English, nothing else. Do not solve it.",
        messages: [{
          role: "user", content: [{
            type: "image",
            source: { type: "base64", media_type: (mediaType ?? "image/jpeg") as "image/jpeg", data: image },
          }, { type: "text", text: "What is the question?" }],
        }],
      });
      const extracted = (response.content[0] as Anthropic.TextBlock).text.trim();
      return res.json({ text: extracted });
    }

    const userContent: Anthropic.MessageParam["content"] = image
      ? [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (mediaType ?? "image/jpeg") as "image/jpeg",
              data: image,
            },
          },
          { type: "text", text: "Extract TVM parameters from this financial question." },
        ]
      : (text as string);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const raw = (response.content[0] as Anthropic.TextBlock).text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in response");
    const params = JSON.parse(match[0]);
    res.json(params);
  } catch (err: any) {
    const detail = err?.message ?? err?.error?.message ?? String(err);
    console.error("parse-question error:", detail);
    res.status(500).json({ error: detail });
  }
}
