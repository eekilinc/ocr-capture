# Metin Yakalayıcı

**Metin Yakalayıcı**, ekranınızın herhangi bir bölgesini seçip içerisindeki metni saniyeler içinde ayıklamanızı sağlayan, modern ve yüksek performanslı bir OCR masaüstü uygulamasıdır. **Tauri v2** mimarisi üzerine inşa edilmiştir; sistem kaynaklarını çok az tüketir ve tamamen çevrimdışı çalışır.

## Özellikler

- **Hızlı Yakalama:** Global kısayol (`Ctrl + Shift + F9`) ile uygulama arka planda bile anında ekran yakalama modunu açar.
- **Çevrimdışı OCR:** İnternet bağlantısı gerektirmeden Türkçe ve İngilizce metin ayıklama (Tesseract motoru).
- **Adım Adım Yönlendirme:** Yakalama → Alan Seç → OCR akışı ekranda progress göstergesiyle takip edilir.
- **Geçmiş Yönetimi:** Yakalanan görseller ve ayıklanan metinler otomatik kaydedilir; geçmişe dönük inceleme ve kopyalama yapılabilir.
- **Premium Arayüz:** Glassmorphism efektli, animasyonlu, boş durum ekranları zenginleştirilmiş tasarım.
- **Koyu / Açık Tema:** İşletim sistemi tercihine göre otomatik başlar, ayarlardan değiştirilebilir.
- **Sistem Tepsisi:** Kapatıldığında arka planda çalışmaya devam eder, tepsiden hızlıca erişilir.
- **Çoklu Monitör:** İstediğiniz monitörü seçerek yakalama yapabilirsiniz.
- **Özelleştirilebilir Kısayol:** Kısayol sekmesinden istediğiniz kombinasyonu tek tıkla atayabilirsiniz.

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Uygulama Çatısı | [Tauri v2](https://v2.tauri.app/) |
| Backend / Performans | [Rust](https://www.rust-lang.org/) |
| Kullanıcı Arayüzü | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Derleme Aracı | [Vite](https://vitejs.dev/) |
| OCR Motoru | Tesseract (sistem kurulumu) |

## Kurulum

### Gereksinimler

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) (Cargo dahil)
- Windows için Visual Studio C++ Build Tools
- Tesseract OCR (`tur` ve `eng` dil paketleriyle)

### Geliştirme Modu

```bash
git clone https://github.com/eekilinc/ocr-capture.git
cd ocr-capture
npm install
npm run tauri dev
```

### Derleme (Build)

```bash
npm run tauri build
```

Çıktı dosyaları `src-tauri/target/release/bundle/` klasöründe oluşur.

## Kısayollar

| Eylem | Kısayol |
|-------|---------|
| Ekran yakalamayı başlat | `Ctrl + Shift + F9` (değiştirilebilir) |
| Seçimi iptal et | `Esc` |

> Kısayol, **Ayarlar → Kısayol** sekmesinden istediğiniz kombinasyona atanabilir. `Ctrl+Alt` kombinasyonu Windows'ta AltGr ile çakışabileceğinden önerilmez.

## Ayarlar

Ayarlar modalı üç sekmeye ayrılmıştır:

- **Genel:** Tema (açık/koyu), Windows ile başlatma, sistem tepsisine küçültme
- **Kısayol:** Global kısayolu kaydet — modifier tuşları basılı tutarken istediğiniz tuşa basın
- **Hakkında:** Versiyon, teknoloji yığını ve geliştirici bilgisi

## Katkıda Bulunma

1. Repoyu fork'layın.
2. Yeni bir dal oluşturun: `git checkout -b ozellik/yeni-ozellik`
3. Değişikliklerinizi kaydedin: `git commit -m 'feat: yeni özellik'`
4. Dalı gönderin: `git push origin ozellik/yeni-ozellik`
5. Pull Request açın.

## Lisans

MIT — ayrıntılar için `LICENSE` dosyasına bakın.

---

Geliştirici: **[Ekrem Kılınç](https://github.com/eekilinc)** · © 2026
