# 🚀 DoWeTalk: Modern İletişim Platformu

DoWeTalk, toplulukların bir araya geldiği, dinamik ve geliştirilmeye açık bir mesajlaşma platformudur. Şu an geliştirme aşamasındadır ve çok yakında tam sürümüyle yayında olacaktır!

---

## ⚠️ Önemli Kurulum Notları

Projeyi yerel ortamınızda çalıştırmadan önce lütfen aşağıdaki adımları takip edin:

1.  **Veritabanı Yapılandırması:** Projeyi açtıktan sonra Package Manager Console üzerinden aşağıdaki komutu çalıştırın:
    ```bash
    Update-Database
    ```
    *Bu işlem, gerekli tabloların ve şema yapısının bilgisayarınıza işlenmesini sağlar.*

2.  **Test Hesabı:** İlk giriş için aşağıdaki bilgileri kullanabilirsiniz:
    - **Kullanıcı Adı:** `DoWeTalk`
    - **Şifre:** `admin123`
    *(Not: Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmeniz önerilir.)*

---

## 🛠️ Yol Haritası (Gelecek Özellikler)

Projemiz hızla büyüyor. İşte çok yakında eklenecek özellikler:

### 🎙️ İletişim & Sosyal
- [ ] **Sesli Kanallar & Bağlantı:** Yüksek kaliteli sesli sohbet odaları.
- [ ] **Arkadaşlık Sistemi:** Engelleme ve arkadaşlıktan çıkarma özellikleri.
- [ ] **Profil Özelleştirme:** Biyografi ekleme, kullanıcı adı ve şifre değiştirme.

### ⚙️ Sunucu & Yönetim
- [ ] **Gelişmiş Yetkilendirme:** Üyeler, Permler ve Admin rolleri.
- [ ] **Sunucu Ayarları:** Tamamen özelleştirilebilir sunucu yönetim paneli.
- [ ] **Modern Veritabanı:** Mesaj yükünü hafifleten, optimize edilmiş yeni DB mimarisi.

### 🎨 Arayüz & Deneyim
- [ ] **Modern Mesajlaşma:** Mesaj silme, emoji desteği ve dosya yükleme.
- [ ] **Tema Düzeltmeleri:** Mevcut tema hataları giderilerek karanlık/aydınlık mod stabil hale getirilecek.
- [ ] **Index Revizyonu:** Giriş sayfası (Index) tamamen modern bir görünüme kavuşacak.

---

## 💻 Teknik Mimari

Projenin sürdürülebilirliği için katı bir mimari kural izliyoruz:
> 💡 **Prensip:** Tüm UI kontrolleri **CSS ve JS** üzerinden yürütülecektir. `.cshtml` dosyalarının içine yoğun kod yazılmasından kaçınılarak kodun bozulması ve karmaşıklığı önlenecektir.

### 📦 Masaüstü Uygulaması (Gelecek Planı)
Projenin sadece web'de kalmaması için **Node.js** tabanlı bir masaüstü (Application) versiyonu planlanmaktadır.
- **Dağıtım:** `.exe` formatında setup dosyası ile kolay kurulum.
- **Ekran Paylaşımı:** Masaüstü sürümüne özel ekran paylaşma özelliği.

---

## 🤝 Katkıda Bulunma
Bu proje açık kaynaklıdır! Geliştirmelere katkıda bulunmak isterseniz lütfen bir `Pull Request` açın veya bir `Issue` oluşturun.

---
*Developed with ❤️ by ksrflexy*
