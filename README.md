# Kelime Defteri

Girdiğin her kelimeyi yapay zekâyla bir dil kartına çeviren ve aralıklı tekrarla
(SRS) çalıştıran kişisel kelime defteri. İngilizce, Almanca, Fransızca ve Çince
destekler.

## Özellikler

- **Bugün:** aralıklı tekrar (kaydır ya da 1–4 ile puanla), günlük hedef, seri
- **Deste:** arama, filtre, yinelenen temizleme, **CSV / Anki içe-dışa aktarma**
- **Gruplar, Alıştırma, Eşleştirme, Genel Test, Cümle Kurma, Kalıplar, Dilbilgisi**
- **Okuma & Pinyin:** kelime bazlı ruby pinyin, günün deyimi
- **Hanzi Yazma:** çizgi sırası animasyonu ve kendin yazma ([hanzi-writer](https://hanziwriter.org))
- **Pinyin ton renkleri:** 1. ton kırmızı, 2. yeşil, 3. mavi, 4. mor, hafif ton gri

## Yapı

| Dosya | Görev |
|---|---|
| `index.html` | Tüm arayüz ve uygulama mantığı (Tailwind CDN, Supabase JS) |
| `api/ask.js` | Prompt'u EachLabs LLM router'a gönderir, `predictionID` döner |
| `api/ask-status.js` | Tahminin durumunu sorgular, bitince metni döner |
| `api/_guard.js` | Ortak koruma: aynı köken kontrolü, oturum doğrulama, günlük sınır |

Veriler Supabase'de `cards` tablosunda tutulur. Misafir modunda kartlar,
seri/puan ve tekrar geçmişi tarayıcının `localStorage`'ındadır.

## Ortam değişkenleri (Vercel)

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `EACHLABS_API_KEY` | evet | EachLabs API anahtarı |
| `SUPABASE_URL` | hayır | Varsayılan: `index.html`'deki proje URL'si |
| `SUPABASE_ANON_KEY` | hayır | Varsayılan: `index.html`'deki anon anahtar |
| `AI_DAILY_LIMIT_USER` | hayır | Giriş yapan kullanıcı başına günlük AI isteği (varsayılan 400) |
| `AI_DAILY_LIMIT_GUEST` | hayır | Misafir IP başına günlük AI isteği (varsayılan 40) |

Günlük sınırlar sunucusuz fonksiyonun belleğinde tutulur; soğuk başlatmada
sıfırlanır. Kötüye kullanımı zorlaştırır ama kesin bir kota değildir.

## Yerelde çalıştırma

```bash
npm i -g vercel
vercel env pull .env.local   # EACHLABS_API_KEY'i Vercel'den çeker
vercel dev
```

## Supabase güvenliği

Anon anahtar tarayıcıda herkese açıktır; kullanıcı verisini koruyan şey
**Row Level Security**'dir. `cards` tablosunda RLS açık olmalı ve her
kullanıcı sadece kendi satırlarını görmeli:

```sql
alter table cards enable row level security;
-- user_id kolonu yeni satırlarda otomatik dolsun
alter table cards alter column user_id set default auth.uid();

create policy "kendi kartlarim" on cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## İçe / dışa aktarma

- **CSV indir:** tüm alanlar ve tekrar ilerlemesi (`reps, ease, interval, due, lapses`).
  Aynı dosyayı geri içe aktarınca ilerleme korunur.
- **Anki için indir:** Anki → *Dosya → İçe Aktar* ile açılır. Ön yüz kelime (+ pinyin),
  arka yüz anlam ve örnek cümle; etiketler dil, tür ve seviye.
- **İçe aktar:** bu uygulamanın CSV'si, başlıksız `kelime,anlam[,örnek,örnek çevirisi]`
  CSV'leri ve Anki'nin *Notes in Plain Text* dışa aktarımı. Destede zaten olan
  kelimeler atlanır.
