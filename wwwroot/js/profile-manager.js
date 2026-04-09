/**
 * DoWeTalk - Profile & Avatar Management System
 */

// --- AVATAR SEÇME VE ÖNİZLEME ---
function triggerAvatarUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            // Boyut kontrolü (2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert("Dosya çok büyük! Maksimum 2MB seçebilirsiniz.");
                return;
            }

            const reader = new FileReader();
            reader.onload = event => {
                const imgData = event.target.result;

                // Ayarlar panelindeki büyük önizlemeyi güncelle
                $('.avatar-preview-big').html(`<img src="${imgData}" style="width:100%; height:100%; border-radius:30px; object-fit:cover;">`);

                // Dashboard sol alttaki küçük avatarı güncelle
                $('.user-panel-bottom .user-avatar-small').html(`<img src="${imgData}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`);

                console.log("Avatar önizleme güncellendi. Kaydet butonuna basıldığında sunucuya gönderilmeli.");
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

// --- PROFİL KARTI MANTIĞI ---
$(document).ready(function () {

    /**
     * Tıklama olayını sadece spesifik sınıflara bağladık:
     * .clickable-profile: Sol alttaki kullanıcı alanı
     * .member-item: Sağ paneldeki üye listesi
     * .message-author: Sohbet alanındaki isimler
     */
    const profileTriggerSelectors = '.clickable-profile, .member-item, .message-author';

    $(document).on('click', profileTriggerSelectors, function (e) {
        // Eğer tıklanan eleman bir icon-btn (çark, logout) ise kartı açma
        if ($(e.target).closest('.icon-btn').length) return;

        e.stopPropagation();

        const card = $('#userProfileCard');

        // Kullanıcı adını belirle (içindeki fw-bold'u ara, yoksa direkt metni al)
        let username = $(this).find('.fw-bold').text().trim() || $(this).text().trim() || "Kullanıcı";

        // İsim çok uzunsa temizle (sadece görsel amaçlı)
        let displayName = username;
        if (displayName.length > 20) displayName = displayName.substring(0, 15) + "...";

        // Kart içeriğini doldur
        card.find('.profile-name').text(displayName);

        // Avatar baş harfini güncelle (Eğer resim yoksa harf gözüksün)
        const initial = displayName.charAt(0).toUpperCase();
        card.find('.profile-avatar').text(initial);

        // Biyografi (Statik placeholder - backend entegrasyonu için hazırdır)
        card.find('.profile-bio').text("DoWeTalk kullanıcısı henüz bir biyografi eklememiş.");

        // Pozisyon hesaplama
        let top = e.pageY;
        let left = e.pageX + 20;

        // Ekran dışına taşma kontrolü
        const cardWidth = 300;
        const cardHeight = 350; // Tahmini yükseklik

        // Yatayda taşma kontrolü
        if (left + cardWidth > window.innerWidth) {
            left = e.pageX - cardWidth - 20;
        }

        // Dikeyde taşma kontrolü
        if (top + cardHeight > window.innerHeight) {
            top = window.innerHeight - cardHeight - 20;
        }

        // Kartı göster
        card.css({
            top: Math.max(10, top) + 'px',
            left: Math.max(10, left) + 'px',
            display: 'block'
        }).hide().fadeIn(150);
    });

    // Kartın dışına tıklandığında kapat
    $(document).on('mousedown', function (e) {
        if (!$(e.target).closest('#userProfileCard, .clickable-profile, .member-item').length) {
            $('#userProfileCard').fadeOut(100);
        }
    });

    // Escape tuşu ile kapatma
    $(document).keyup(function (e) {
        if (e.key === "Escape") {
            $('#userProfileCard').fadeOut(100);
        }
    });
});