import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { audio, mimeType } = req.body as { audio: string; mimeType: string };
  if (!audio) return res.status(400).json({ error: "audio required" });

  try {
    const buffer = Buffer.from(audio, "base64");
    const ext = mimeType?.includes("mp4") ? "m4a" : "webm";
    const blob = new Blob([buffer], { type: mimeType || "audio/webm" });

    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "he");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Whisper error:", err);
      return res.status(500).json({ error: err });
    }

    const data = (await response.json()) as { text: string };
    return res.json({ text: data.text });
  } catch (err: any) {
    console.error("transcribe error:", err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
