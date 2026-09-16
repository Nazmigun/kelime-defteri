export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST isteği kabul edilir" });

  const key = process.env.EACHLABS_API_KEY;
  if (!key) return res.status(500).json({ error: "EACHLABS_API_KEY ortam değişkeni tanımlı değil" });

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

  try {
    const createRes = await fetch("https://api.eachlabs.ai/v1/prediction/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "eachlabs-llm-router",
        input: {
          model: "openai/gpt-5.5",
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }]
        }
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.predictionID) {
      const base = createData.message || createData.error || `Tahmin oluşturulamadı (${createRes.status})`;
      const details = createData.details ? ` | details: ${JSON.stringify(createData.details)}` : "";
      return res.status(createRes.status || 500).json({ error: base + details });
    }

    const predictionId = createData.predictionID;
    const deadline = Date.now() + 55000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));

      const pollRes = await fetch(`https://api.eachlabs.ai/v1/prediction/${predictionId}`, {
        headers: { "Authorization": `Bearer ${key}` }
      });
      const pollData = await pollRes.json();

      if (pollData.status === "success") {
        const output = pollData.output;
        const text = typeof output === "string"
          ? output
          : output?.choices?.[0]?.message?.content || output?.text;
        if (!text) return res.status(500).json({ error: "Model yanıtı boş döndü" });
        return res.status(200).json({ text });
      }
      if (pollData.status === "error" || pollData.status === "cancelled") {
        return res.status(500).json({ error: pollData.logs || `Model hata döndürdü (${pollData.status})` });
      }
      // created / starting / processing -> devam et
    }

    return res.status(504).json({ error: "Yanıt zaman aşımına uğradı" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
