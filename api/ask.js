export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST isteği kabul edilir" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY ortam değişkeni tanımlı değil" });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: "Geçersiz JSON gövdesi" });
    }
  }

  const prompt = body?.prompt;
  if (!prompt) return res.status(400).json({ error: "Prompt parametresi eksik" });

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
  let lastError = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await r.json();
      if (!r.ok) {
        lastError = data.error?.message || `Gemini API hatası (${r.status})`;
        if (r.status === 404 || r.status === 400) continue;
        return res.status(r.status).json({ error: lastError });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const finishReason = data.candidates?.[0]?.finishReason;
        lastError = finishReason ? `Model yanıt vermedi (Neden: ${finishReason})` : "Model boş cevap döndü";
        continue;
      }

      return res.status(200).json({ text });
    } catch (e) {
      lastError = e.message;
    }
  }

  res.status(500).json({ error: lastError || "Gemini yanıt vermedi" });
}