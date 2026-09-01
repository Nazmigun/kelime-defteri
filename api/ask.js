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

  const models = ["gemini-3.6-flash"];
  const errors = [];

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
        const msg = data.error?.message || `API hatası (${r.status})`;
        errors.push(`${model}: ${msg}`);
        if (r.status === 404 || msg.includes("not found") || msg.includes("no longer available")) continue;
        return res.status(r.status).json({ error: msg });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const finishReason = data.candidates?.[0]?.finishReason;
        errors.push(`${model}: Yanıt yok (Neden: ${finishReason || 'Boş'})`);
        continue;
      }

      return res.status(200).json({ text });
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }

  res.status(500).json({ error: errors.join(" | ") });
}