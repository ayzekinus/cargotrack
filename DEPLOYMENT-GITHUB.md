# CargoTrack — GitHub Pages + Supabase Kurulum Rehberi

**Toplam süre:** ~25 dakika (her şey tarayıcıdan yapılıyor)
**Maliyet:** %100 Ücretsiz

---

## Genel Yapı

```
Kullanıcı → GitHub Pages (arayüz) → Supabase (veritabanı)
```

- **GitHub Pages** → React arayüzünü ücretsiz host eder
- **Supabase** → Veritabanını bulutta saklar
- Her ikisi de ücretsiz ve sunucu gerektirmez

---

## BÖLÜM 1 — SUPABase Kurulumu

### 1.1 Hesap Oluşturun

1. **https://supabase.com** adresine gidin
2. **Start your project** → e-posta veya GitHub ile kayıt olun

### 1.2 Yeni Proje Oluşturun

1. **New Project** butonuna tıklayın
2. Doldurun:
   - **Name:** `cargotrack`
   - **Database Password:** Güçlü bir şifre (not alın)
   - **Region:** `Europe West (Frankfurt)` — Türkiye'ye en yakın
3. **Create new project** → ~2 dakika bekleyin

### 1.3 Veritabanı Tablolarını Oluşturun

1. Sol menüden **SQL Editor** seçin
2. **New query** butonuna tıklayın
3. `supabase/schema.sql` dosyasının tüm içeriğini kopyalayıp yapıştırın
4. **Run** butonuna tıklayın
5. Alt kısımda yeşil "Success" mesajı görmelisiniz

### 1.4 API Anahtarlarını Kopyalayın

1. Sol menüden **Settings → API** seçin
2. Şu iki değeri bir yere not alın:
   - **Project URL** → `https://XXXXXX.supabase.co`
   - **anon public** key (uzun bir JWT metni)

---

## BÖLÜM 2 — PROJE DOSYALARINI HAZIRLAMA

### 2.1 Node.js Kurun (Bir Kerelik)

1. **https://nodejs.org** → LTS sürümünü indirip kurun
2. Terminalde kontrol edin:
   ```
   node --version
   ```

### 2.2 Supabase Bilgilerini Girin

`src/supabase.js` dosyasını bir metin editörüyle açın
(Notepad, VS Code, vb.) ve değiştirin:

```js
const SUPABASE_URL = "https://XXXXXX.supabase.co";   // ← 1.4'ten kopyaladığınız URL
const SUPABASE_ANON_KEY = "eyJhbGci...";              // ← 1.4'ten kopyaladığınız key
```

Dosyayı kaydedin.

### 2.3 Repo Adını Kontrol Edin

`vite.config.js` dosyasını açın:

```js
const REPO_NAME = "cargotrack";  // ← GitHub'da kullanacağınız repo adı ile aynı olmalı
```

Eğer repo adınız `cargotrack` ise değiştirmenize gerek yok.

---

## BÖLÜM 3 — GITHUB KURULUMU

### 3.1 GitHub Hesabı Oluşturun

1. **https://github.com** → Sign up (ücretsiz)

### 3.2 Yeni Repository Oluşturun

1. Sağ üstteki **+** → **New repository**
2. Doldurun:
   - **Repository name:** `cargotrack`
   - **Visibility:** Private (önerilen) veya Public
3. **Create repository** butonuna tıklayın
4. Boş repo sayfası açılacak — bu sayfayı açık tutun

### 3.3 Dosyaları GitHub'a Yükleyin

**Seçenek A: GitHub Desktop (En Kolay)**

1. **https://desktop.github.com** → indirin ve kurun
2. GitHub hesabınızla giriş yapın
3. **File → Add Local Repository** → `cargotrack-github` klasörünü seçin
   - "Not a Git repo" derse: **Create a Repository** deyin
4. Sol alttaki **Publish repository** → az önce oluşturduğunuz repo'yu seçin
5. **Push origin**

**Seçenek B: Terminal**

```bash
cd cargotrack-github
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/cargotrack.git
git push -u origin main
```

---

## BÖLÜM 4 — GITHUB PAGES'İ AKTİF EDİN

### 4.1 İlk Deploy'u Tetikleyin

Dosyaları GitHub'a yüklediğinizde **GitHub Actions otomatik başlar.**

Durumu görmek için:
1. GitHub'da repo sayfanıza gidin
2. Üstteki **Actions** sekmesine tıklayın
3. "Deploy CargoTrack to GitHub Pages" workflow'unu görürsünüz
4. Sarı daire = çalışıyor, yeşil tik = tamamlandı (~2-3 dakika)

### 4.2 GitHub Pages'i Aktif Edin (Bir Kerelik)

1. Repo → **Settings** → Sol menüden **Pages**
2. **Source** bölümünde:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
3. **Save** butonuna tıklayın

### 4.3 Sitenizin URL'ini Öğrenin

**Settings → Pages** sayfasında şu şekilde görünür:

```
Your site is live at https://KULLANICI_ADINIZ.github.io/cargotrack/
```

Bu linke tıklayın — CargoTrack giriş ekranı açılmalıdır! ✅

---

## VARSAYILAN GİRİŞ BİLGİLERİ

| Kullanıcı Adı | Şifre           | Rol      |
|---------------|-----------------|----------|
| admin         | cargotrack2024  | Admin    |
| operator      | operator123     | Operator |
| viewer        | viewer123       | Viewer   |

⚠️ **Canlıya almadan önce `src/users.js` dosyasından şifreleri değiştirin!**

---

## GÜNCELLEME YAPMAK

Kod veya şifre değişikliği yaptığınızda:

**GitHub Desktop kullanıyorsanız:**
1. Değişiklikleri yapın
2. GitHub Desktop'ta commit mesajı yazın → **Commit to main**
3. **Push origin**
4. GitHub Actions otomatik olarak yeniden deploy eder (~2 dakika)

**Terminal kullanıyorsanız:**
```bash
git add .
git commit -m "Güncelleme açıklaması"
git push
```

---

## SIKÇA SORULAN SORULAR

**Sayfa açılıyor ama beyaz geliyor**
→ `vite.config.js` içindeki `REPO_NAME` değerinin GitHub repo adınızla
  aynı olduğunu kontrol edin. Değiştirdiyseniz tekrar push edin.

**Actions sekmesinde kırmızı X görüyorum**
→ Actions → ilgili workflow → hata mesajına bakın.
  Genellikle `package.json` eksik veya syntax hatası olur.

**Giriş yapamıyorum**
→ `src/users.js` dosyasını kontrol edin. Büyük/küçük harf önemli.

**Veri gelmiyor, veritabanı boş görünüyor**
→ `src/supabase.js` içindeki URL ve key'i kontrol edin.
  Supabase Dashboard → SQL Editor'da schema.sql'i tekrar çalıştırın.

**GitHub Pages URL'im ne olacak?**
→ `https://GITHUB_KULLANICI_ADINIZ.github.io/cargotrack/`
