# CargoTrack — Supabase Kurulum Rehberi

Bu rehberi tamamladıktan sonra verileriniz kalıcı olarak bulutta saklanacak
ve tüm kullanıcılar aynı veriyi gerçek zamanlı görecek.

Tahmini süre: 15–20 dakika

---

## 1. ADIM — Supabase Hesabı Oluşturun

1. **https://supabase.com** adresine gidin
2. **Start your project** butonuna tıklayın
3. GitHub hesabınızla veya e-posta ile kaydolun (ücretsiz)

---

## 2. ADIM — Yeni Proje Oluşturun

1. Dashboard'da **New Project** butonuna tıklayın
2. Doldurun:
   - **Name:** `cargotrack`
   - **Database Password:** Güçlü bir şifre yazın — **not alın**, daha sonra lazım olabilir
   - **Region:** Europe (Frankfurt) — Türkiye'ye en yakın
3. **Create new project** butonuna tıklayın
4. Proje oluşturulana kadar bekleyin (~1–2 dakika)

---

## 3. ADIM — Veritabanı Tablolarını Oluşturun

1. Sol menüden **SQL Editor** seçin
2. **New query** butonuna tıklayın
3. `supabase/schema.sql` dosyasının içeriğini kopyalayıp yapıştırın
4. **Run** butonuna tıklayın (veya Ctrl+Enter)
5. "Success" mesajı görmelisiniz

Bu işlem şu tabloları oluşturur:
- `containers` — Container kayıtları
- `chassis` — Chassis tanımları
- `hareketler` — Hareket geçmişi
- `forecast` — Forecast kayıtları

---

## 4. ADIM — API Anahtarlarını Alın

1. Sol menüden **Settings** → **API** seçin
2. Şu iki değeri kopyalayın:
   - **Project URL** → `https://XXXXX.supabase.co`
   - **anon public** key (uzun bir metin)

---

## 5. ADIM — Anahtarları Projeye Girin

`src/supabase.js` dosyasını bir metin editörüyle açın:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";   // ← buraya Project URL
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";                     // ← buraya anon key
```

Örnek:
```js
const SUPABASE_URL = "https://abcdefghij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

Dosyayı kaydedin.

---

## 6. ADIM — Build Alın ve Hosting'e Yükleyin

```bash
cd cargotrack-cpanel
npm install
npm run build
```

Sonra `dist/` klasörünü (`.htaccess` ile birlikte) cPanel'e yükleyin.
Detaylar için `DEPLOYMENT-CPANEL.md` dosyasına bakın.

---

## 7. ADIM — Test Edin

Sitenizi açın, giriş yapın ve bir container ekleyin.
Sayfayı yenileyin — veri hâlâ duruyorsa Supabase bağlantısı çalışıyor demektir. ✅

Aynı anda Supabase Dashboard → **Table Editor** → `containers` tablosuna bakarsanız
eklediğiniz container'ı orada da görebilirsiniz.

---

## Veri Yönetimi

**Supabase Dashboard → Table Editor** üzerinden verilerinizi:
- Görüntüleyebilirsiniz
- Düzenleyebilirsiniz
- CSV olarak dışa aktarabilirsiniz
- Yedekleyebilirsiniz

---

## Ücretsiz Plan Limitleri

Supabase'in ücretsiz planı CargoTrack için fazlasıyla yeterlidir:

| Özellik | Ücretsiz Limit |
|---|---|
| Veritabanı boyutu | 500 MB |
| Aylık API isteği | 2 milyon |
| Eş zamanlı bağlantı | 200 |
| Bandwidth | 5 GB/ay |

---

## Sorun Giderme

**"Invalid API key" hatası**
→ `src/supabase.js` dosyasındaki anahtarları kontrol edin. Boşluk kalmış olabilir.

**"Relation does not exist" hatası**
→ 3. Adımı tekrar yapın — SQL schema çalıştırılmamış.

**Sayfa açılıyor ama veri gelmiyor**
→ Supabase'de RLS (Row Level Security) politikalarını kontrol edin.
   SQL Editor'da şunu çalıştırın:
   ```sql
   -- Geçici olarak RLS'yi devre dışı bırakır (test için)
   alter table containers disable row level security;
   alter table chassis disable row level security;
   alter table hareketler disable row level security;
   alter table forecast disable row level security;
   ```
   Bu çalışırsa sorun RLS politikalarındadır. Schema.sql'i baştan çalıştırın.
