# Metin Yakalayıcı (OCR Capture)

**Metin Yakalayıcı**, ekranınızın herhangi bir bölgesini seçip içerisindeki metinleri saniyeler içinde ayıklamanızı sağlayan (OCR), modern ve yüksek performanslı bir masaüstü uygulamasıdır. **Tauri v2** mimarisi üzerine inşa edilmiştir, bu sayede sistem kaynaklarını çok az tüketir ve tamamen çevrimdışı çalışır.

![Uygulama Ekran Görüntüsü](https://via.placeholder.com/800x450?text=Metin+Yakalayici+Preview)

## 🚀 Özellikler

*   **⚡ Hızlı Yakalama:** Global kısayol (`Ctrl + Alt + Shift + C`) ile anında ekran görüntüsü alma modu.
*   **🔍 Çevrimdışı OCR:** İnternet bağlantısına ihtiyaç duymadan Türkçe ve İngilizce metinleri ayıklama (Tesseract.js entegrasyonu).
*   **📂 Geçmiş Yönetimi:** Yakalanan görselleri ve ayıklanan metinleri otomatik kaydeder, geçmişe dönük inceleme imkanı sunar.
*   **🎨 Modern Arayüz:** Kullanıcı dostu, "Glassmorphism" etkili şık tasarım.
*   **🌙 Koyu/Açık Tema:** Göz yormayan tema seçenekleri.
*   **Tray (Sistem Tepsisi):** Uygulama kapatıldığında arka planda çalışmaya devam eder ve sistem tepsisinden hızlıca erişilebilir.
*   **Çoklu Monitör Desteği:** İstediğiniz monitörü seçerek yakalama yapabilme.

## 🛠️ Teknolojiler

Bu proje, modern web teknolojilerinin gücünü Rust'ın performansı ile birleştirir:

*   **[Tauri v2](https://v2.tauri.app/):** Uygulama çatısı (Backend: Rust).
*   **[React 19](https://react.dev/):** Kullanıcı arayüzü kütüphanesi.
*   **[TypeScript](https://www.typescriptlang.org/):** Tip güvenliği.
*   **[Rust](https://www.rust-lang.org/):** Sistem seviyesi işlemler ve performans.
*   **[Vite](https://vitejs.dev/):** Hızlı geliştirme sunucusu ve derleyici.

## 📦 Kurulum ve Çalıştırma

Geliştirme ortamını kurmak için aşağıdaki adımları izleyin.

### Gereksinimler

*   [Node.js](https://nodejs.org/) (v18 veya üzeri)
*   [Rust](https://www.rust-lang.org/tools/install) (Cargo dahil)
*   İşletim sisteminize uygun derleme araçları (Windows için Visual Studio C++ Build Tools).

### Geliştirme Modu

Depoyu klonlayın ve bağımlılıkları yükleyin:

```bash
git clone https://github.com/eekilinc/ocr-capture.git
cd ocr-capture
npm install
```

Geliştirme sunucusunu başlatın:

```bash
npm run tauri dev
```

### Derleme (Build)

Uygulamanın dağıtılabilir `.exe` (Windows), `.dmg` (macOS) veya `.deb` (Linux) paketini oluşturmak için:

```bash
npm run tauri build
```

Çıktı dosyaları `src-tauri/target/release/bundle/` klasöründe oluşacaktır.

## ⌨️ Kısayollar

*   **Varsayılan Yakalama:** `Ctrl + Alt + Shift + C`
    *   *Bu kısayol Ayarlar menüsünden değiştirilebilir.*
*   **İptal (Seçim Modunda):** `ESC`

## 🤝 Katkıda Bulunma

1.  Bu depoyu "Fork"layın.
2.  Yeni bir özellik dalı oluşturun (`git checkout -b ozellik/HarikaOzellik`).
3.  Değişikliklerinizi kaydedin (`git commit -m 'feat: Harika özellik eklendi'`).
4.  Dalınızı uzak sunucuya gönderin (`git push origin ozellik/HarikaOzellik`).
5.  Bir "Pull Request" oluşturun.

## 📄 Lisans

Bu proje MIT lisansı altında dağıtılmaktadır. Daha fazla bilgi için `LICENSE` dosyasına bakın.

---
**Geliştirici:** Ekrem Kılınç
**Telif Hakkı:** © 2026 Tüm Hakları Saklıdır.
