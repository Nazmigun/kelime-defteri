export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Sadece POST isteği kabul edilir" });

  const key = process.env.NVIDIA_API_KEY;
  if (!key) return res.status(500).json({ error: "NVIDIA_API_KEY ortam değişkeni tanımlı değil" });

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

  const models = ["moonshotai/kimi-k3", "deepseek-ai/deepseek-v4-flash-0731", "openai/gpt-oss-20b"];
  const errors = [];

  for (const model of models) {
    try {
      const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 4096
        })
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = data.error?.message || data.message || `API hatası (${r.status})`;
        errors.push(`${model}: ${msg}`);
        if (r.status === 404 || r.status === 400) continue;
        return res.status(r.status).json({ error: msg });
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        const finishReason = data.choices?.[0]?.finish_reason;
        errors.push(`${model}: Yanıt yok (Neden: ${finishReason || "Boş"})`);
        continue;
      }

      return res.status(200).json({ text });
    } catch (e) {
      errors.push(`${model}: ${e.message}`);
    }
  }

  res.status(500).json({ error: errors.join(" | ") });
}
