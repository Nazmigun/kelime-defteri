export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY tanımlı değil" });

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + key;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: req.body.prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "API hatası" });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Model boş cevap döndü" });

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}