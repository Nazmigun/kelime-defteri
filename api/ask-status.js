import { guard } from "./_guard.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Sadece GET isteği kabul edilir" });

  const key = process.env.EACHLABS_API_KEY;
  if (!key) return res.status(500).json({ error: "EACHLABS_API_KEY ortam değişkeni tanımlı değil" });

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: "id parametresi eksik" });
  // Yalnızca tahmin kimliği biçimine izin ver; yol enjeksiyonunu (../ vb.) engeller.
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).json({ error: "Geçersiz id" });
  }

  if (!(await guard(req, res, { countUsage: false }))) return;

  try {
    const pollRes = await fetch(`https://api.eachlabs.ai/v1/prediction/${encodeURIComponent(id)}`, {
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
