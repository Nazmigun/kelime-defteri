export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Sadece GET isteği kabul edilir" });

  const key = process.env.EACHLABS_API_KEY;
  if (!key) return res.status(500).json({ error: "EACHLABS_API_KEY ortam değişkeni tanımlı değil" });

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: "id parametresi eksik" });

  try {
    const pollRes = await fetch(`https://api.eachlabs.ai/v1/prediction/${id}`, {
      headers: { "Authorization": `Bearer ${key}` }
    });
    const pollData = await pollRes.json();

    if (!pollRes.ok) {
      return res.status(pollRes.status).json({ error: pollData.message || pollData.error || "Durum sorgulanamadı" });
    }

    if (pollData.status === "success") {
      const output = pollData.output;
      const text = typeof output === "string"
        ? output
        : output?.choices?.[0]?.message?.content || output?.text;
      if (!text) return res.status(200).json({ status: "error", error: "Model yanıtı boş döndü" });
      return res.status(200).json({ status: "success", text });
    }
    if (pollData.status === "error" || pollData.status === "cancelled") {
      return res.status(200).json({ status: "error", error: pollData.logs || `Model hata döndürdü (${pollData.status})` });
    }

    return res.status(200).json({ status: "pending" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
