# Kalpten Kaleme — Antigravity Geliştirici & Proje Kılavuzu (GEMINI.md)

Bu dosya, **Kalpten Kaleme** projesinde çalışırken Antigravity yapay zeka asistanının ve geliştiricilerin uyması gereken temel mimariyi, kuralları, dosya hiyerarşisini ve test standartlarını tanımlar.

---

## 📌 Proje Genel Bakışı

**Kalpten Kaleme**, tek bir hızlı, modern ve sade arayüz altında çalışan **Word (.docx)**, **PowerPoint Sunum (.pptx / .json)** ve **PDF** düzenleme ve dönüştürme stüdyosudur.

- **GitHub Deposu:** `https://github.com/Meihper/Kalpten-Kaleme`
- **Hedef Platformlar:**
  1. **Web / PWA:** Tarayıcıda tam çevrimdışı/çevrimiçi destekli SPA.
  2. **Windows Desktop:** `server.ps1` üzerinden çalışan yerleşik Edge App (`--app`) veya `BelgeDuzenleyici.cs` (C# WinForms + WebView2).
  3. **Android:** Yerel WebView tabanlı bağımsız APK (`android/`).

---

## 📂 Mimari ve Dosya Hiyerarşisi

```
├── index.html                   # Ana uygulama çatısı, tüm sekmelerin ve modalların HTML iskeleti
├── styles.css                   # Tüm bileşenlerin, koyu/açık temaların, A4 kanvasının stilleri
├── app.js                       # Ana koordinatör: Sekme geçişleri, bulut senkronizasyon, modallar
├── word-editor.js               # Word editörü: A4 sayfalama, metin biçimlendirme, kenar boşlukları, docx
├── ppt-editor.js                # Sunum editörü: Slayt yönetimi, şekiller, F5 tam ekran, A4/16:9
├── pdf-editor.js                # PDF düzenleyici: Yerinde metin düzenleme, imza, serbest çizim
├── pdf-tools.js                 # PDF araçları: Birleştirme, bölme, filigran, Word'e dönüştürme
├── vendor/                      # Harici CDN bağımlılığı olmayan yerel kütüphaneler (docx, pdf-lib, vb.)
│
├── server.ps1                   # Yerel HTTP sunucusu (Port: 52480) & REST API & Masaüstü başlatıcı
├── BelgeDuzenleyici.cs          # Yerel C# WinForms + WebView2 masaüstü alternatifi
├── Baslat.bat / Baslat.ps1      # Tek tıkla masaüstü uygulamasını arka planda başlatan betikler
├── Kurulum_Baslat.bat           # Masaüstü kısayolu oluşturan ve dosya ilişkilendiren kurulum aracı
│
├── android/                     # Android yerel uygulaması (Java / Gradle)
├── build_android_apk.ps1        # Otomatik Android APK derleme betiği
│
├── check_compile.ps1            # Edge CDP üzerinden app.js / JS dosyalarını sözdizimi denetimi
├── run_complete_feature_audit.ps1 # E2E uçtan uca otomatik fonksiyonellik ve arayüz testleri
└── package_and_upload.ps1       # Dağıtım paketlerini (ZIP & APK) oluşturan paketleyici
```

---

## ⚙️ Yerel API ve Sunucu Mimarisi (`server.ps1`)

Masaüstü modunda `http://localhost:52480` üzerinden çalışan yerel PowerShell sunucusu şu REST API uç noktalarını sağlar:
- `GET /api/open-file-info`: Windows "Birlikte Aç" veya parametre ile gönderilen geçerli dosya yolunu döner.
- `GET /api/read-file?path=...`: Yerel diskteki bir dosyayı güvenle okur (Base64 veya metin).
- `POST /api/save-file`: Dokümanı doğrudan kullanıcının OneDrive / Google Drive veya yerel diskine kaydeder.
- `GET /api/list-cloud-files`: Bulut klasöründeki senkronize belgeleri listeler.
- `POST /api/delete-file`: Senkronize edilen bir belgeyi siler.
- `GET /api/heartbeat`: Sunucunun hayatta olup olmadığını denetler (ve gerekirse sessizce kapanır).

---

## 🛠️ Kodlama ve Geliştirme Standartları

1. **Frontend / JavaScript:**
   - **Framework Bağımsızlığı:** Harici ağır framework'ler (React, Vue vb.) kullanılmaz; Vanilla JS (ES6+) ve yerel Web API'leri esastır.
   - **Modülerlik:** Word mantığı `word-editor.js`'te, Sunum `ppt-editor.js`'te, PDF `pdf-editor.js` ve `pdf-tools.js`'te tutulur. `app.js` sadece ana senkronizasyon ve arayüz geçişlerini yönetir.
   - **Çevrimdışı Önceliği:** Harici CDN bağlantısı yerine `vendor/` klasöründeki yerel scriptler referans alınmalıdır.
   - **Sözdizimi Güvenliği:** JS dosyalarında yapılan her değişiklikten sonra `check_compile.ps1` veya Node/CDP ile sözdizimi doğrulanmalıdır.

2. **Windows Desktop & C# (`BelgeDuzenleyici.cs`):**
   - Çift pencere önleme (`BringExistingInstanceToFront`) ve çoklu örnek yönetimi titizlikle korunmalıdır.
   - Sistem simgeleri (`app.ico`, `BelgeDuzenleyici.ico`) ve tema uyumu bozulmamalıdır.

3. **Tasarım ve Arayüz:**
   - Dil daima Türkçe ve kullanıcı dostu olmalıdır.
   - Butonlar, menüler ve pencereler sade, hızlı ve responsive (mobil ve masaüstü uyumlu) olmalıdır.

---

## 🧪 Test ve Doğrulama Rutini

Bir geliştirme yapıldıktan sonra sırasıyla şu adımlar izlenmelidir:
1. **Sözdizimi Kontrolü:** `powershell -File check_compile.ps1` ile kodlama hatası (syntax error) olmadığından emin olun.
2. **E2E Fonksiyonellik Testi:** `powershell -File run_complete_feature_audit.ps1` çalıştırılarak tüm modüllerin çalıştığı teyit edilir.
3. **Git Commit Formatı:** Anlamlı ve konvansiyonel commit mesajları kullanılır:
   - `feat(modul): Yeni özellik açıklaması`
   - `fix(modul): Düzeltilen hata`
   - `refactor(modul): Kod temizliği`
   - `docs: Dokümantasyon güncellemeleri`
