// Ortak koruma: /api/ask ve /api/ask-status uçlarını yalnızca bu uygulamanın
// kullanıcılarına açar ve kullanım sınırı koyar.
// "_" ile başladığı için Vercel bu dosyayı bir API ucu olarak yayınlamaz.

// Supabase URL'si ve anon anahtar zaten index.html'de herkese açık; ortam
// değişkeni tanımlıysa o kullanılır, yoksa bu değerlere düşülür.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xrcuonfaxzbyyfhppymw.supabase.co";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyY3VvbmZheHpieXlmaHBweW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTgzNzgsImV4cCI6MjA5OTY5NDM3OH0.14HoksyGDy71EyNXE2RSQ--o9rdy3CwcAWXabZ3XjGo";

// Günlük istek sınırları. Sunucusuz fonksiyonun belleğinde tutulur: aynı örnek
// ayakta kaldıkça geçerlidir, soğuk başlatmada sıfırlanır. Kötüye kullanımı
// ciddi biçimde zorlaştırır ama kesin bir kota değildir.
const LIMITS = {
  user: Number(process.env.AI_DAILY_LIMIT_USER) || 400,
  guest: Number(process.env.AI_DAILY_LIMIT_GUEST) || 40,
};
const counters = new Map();

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hit(id, limit) {
  const key = `${dayKey()}:${id}`;
  const n = (counters.get(key) || 0) + 1;
  counters.set(key, n);
  if (counters.size > 5000) {
    const today = dayKey();
    for (const k of counters.keys()) if (!k.startsWith(today)) counters.delete(k);
  }
  return n <= limit;
}

async function verifyUser(token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id || null;
  } catch {
    return null;
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

// Başka bir siteden tarayıcı üzerinden gelen istekleri reddeder. Aynı kökenden
// gelen isteklerde Origin ya hiç yoktur ya da Host ile eşleşir.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// countUsage=false: durum sorgusu gibi ucuz çağrılar sınırdan düşülmez.
export async function guard(req, res, { countUsage = true } = {}) {
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Bu uca yalnızca uygulamanın kendisi erişebilir" });
    return null;
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  let who;
  if (token) {
    const uid = await verifyUser(token);
    if (!uid) {
      res.status(401).json({ error: "Oturumun geçersiz, lütfen tekrar giriş yap" });
      return null;
    }
    who = { kind: "user", id: `u:${uid}` };
  } else {
    who = { kind: "guest", id: `ip:${clientIp(req)}` };
  }
  if (countUsage && !hit(who.id, LIMITS[who.kind])) {
    res.status(429).json({
      error: who.kind === "guest"
        ? "Misafir modunda günlük yapay zekâ sınırına ulaştın. Devam etmek için giriş yap."
        : "Bugünlük yapay zekâ kullanım sınırına ulaştın, yarın tekrar dene.",
    });
    return null;
  }
  return who;
}
