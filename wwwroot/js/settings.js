// --- AYARLAR PANELİ ANA KONTROLÜ ---

/**
 * Ayarlar panelini açar.
 * "Yükleniyor" gibi ara katmanları atlayarak direkt iskeleti ve varsayılan sekmeyi yükler.
 */
function openSettings() {
    const overlay = $('#settingsOverlay');

    // ESC tuşu dinleyicisi
    $(document).on('keydown.settings', function (e) {
        if (e.key === "Escape") closeSettings();
    });

    // Paneli göster ve varsayılan olarak 'profile' sekmesini aç
    overlay.css('display', 'flex').hide().fadeIn(300);
    switchTab('profile', $('.settings-link:first'));
}

/**
 * Ayarlar panelini kapatır.
 */
function closeSettings() {
    $('#settingsOverlay').fadeOut(250);
    $(document).off('keydown.settings');
}

/**
 * Sekme değiştirme mantığı.
 */
function switchTab(tabId, el) {
    // Menü aktifliğini güncelle
    $('.settings-link').removeClass('active');
    $(el).addClass('active');

    // Tüm bölümleri gizle, seçileni göster
    $('.settings-section').hide();
    const target = $('#section-' + tabId);

    if (target.length > 0) {
        target.fadeIn(200);
        
        // Eğer ses ayarları açıldıysa cihazları yükle
        if (tabId === 'voice') loadDevices();
    } else {
        // Eğer bölüm henüz HTML'de yoksa veya backend'den geliyorsa fallback içeriği
        $('#settingsBodyContent').html(`<div class="p-4 text-white">İçerik yüklenemedi: ${tabId}</div>`);
    }
}

/**
 * Mevcut ses giriş/çıkış cihazlarını listeler. 
 * Eğer etiketler (labels) boşsa, izin istemek için bir kez getUserMedia dener.
 */
async function loadDevices() {
    try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        
        // Eğer hiçbir etiket yoksa, muhtemelen izin verilmemiştir.
        const hasNoLabels = devices.every(d => !d.label);
        if (hasNoLabels) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                devices = await navigator.mediaDevices.enumerateDevices();
            } catch (e) { console.warn("İzin alınamadı, cihaz adları gösterilemeyebilir.", e); }
        }

        const $mic = $('#micSelect').empty();
        const $speaker = $('#speakerSelect').empty();

        devices.forEach(device => {
            if (device.kind === 'audioinput') {
                $mic.append(`<option value="${device.deviceId}">${device.label || 'Bilinmeyen Mikrofon'}</option>`);
            } else if (device.kind === 'audiooutput') {
                $speaker.append(`<option value="${device.deviceId}">${device.label || 'Bilinmeyen Hoparlör'}</option>`);
            }
        });
    } catch (err) { console.error("Cihazlar yüklenemedi", err); }
}

// --- PROFİL VE HESAP AYARLARI ---

/**
 * Avatar yükleme simülasyonu
 */
function triggerAvatarUpload() {
    const fileInput = $('<input type="file" accept="image/*" style="display:none">');
    fileInput.on('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                // Önizlemeyi güncelle
                $('.avatar-preview-big').html(`<img src="${event.target.result}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`);
                console.log("Avatar seçildi, sunucuya yüklenmeye hazır.");
            };
            reader.readAsDataURL(file);
        }
    });
    fileInput.click();
}

/**
 * Profil verilerini (Kullanıcı adı ve Biyografi) kaydeder.
 */
function saveProfile() {
    const data = {
        username: $('#usernameInput').val().trim(),
        bio: $('#bioInput').val().trim()
    };

    if (!data.username) {
        alert("Kullanıcı adı boş bırakılamaz!");
        return;
    }

    // Backend entegrasyonu örneği
    console.log("Profil Kaydediliyor:", data);

    // Görsel geri bildirim
    const btn = $('#saveProfileBtn');
    const originalText = btn.text();
    btn.prop('disabled', true).text('Kaydediliyor...');

    $.post('/Account/UpdateProfile', data, function (res) {
        if (res.success) alert("Profil başarıyla güncellendi!");
    }).always(() => {
        btn.prop('disabled', false).text(originalText);
    });
}

// --- SES VE GÖRÜNTÜ AYARLARI ---

let isTestingMic = false;
let audioContext;
let mediaStream;
let analyser;
let microphone;
let animationId;

/**
 * Mikrofon testini görselleştirir (Gerçek WebAudio API)
 */
async function testMicrophone() {
    const btn = $('#testMicBtn');
    const visualizer = $('.mic-visualizer-bar');

    if (!isTestingMic) {
        isTestingMic = true;
        btn.removeClass('btn-primary').addClass('btn-danger').text('Testi Durdur');

        try {
            // Gerçek mikrofon akışını iste
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            
            // AudioContext başlat
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.minDecibels = -90;
            analyser.maxDecibels = -10;
            // Dalgalanmanın pürüzsüz olması için
            analyser.smoothingTimeConstant = 0.85;

            microphone = audioContext.createMediaStreamSource(mediaStream);
            microphone.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const segments = $('.mic-segment');

            function updateMeter() {
                if (!isTestingMic) return;
                
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                // 0-255 değerini normalize et (Discord tarzı hassasiyet)
                let percentage = (average / 255) * 100 * 4.5; 
                if (percentage > 100) percentage = 100;

                const numActive = Math.floor((percentage / 100) * segments.length);

                segments.each(function(i) {
                    const $seg = $(this);
                    if (i < numActive) {
                        const rel = i / segments.length;
                        if (rel > 0.85) {
                            $seg.addClass('active-red').removeClass('active-green active-yellow');
                        } else if (rel > 0.5) {
                            $seg.addClass('active-yellow').removeClass('active-green active-red');
                        } else {
                            $seg.addClass('active-green').removeClass('active-yellow active-red');
                        }
                    } else {
                        $seg.removeClass('active-green active-yellow active-red');
                    }
                });

                animationId = requestAnimationFrame(updateMeter);
            }

            updateMeter();
            console.log("Segmentli WebAudio mikrofon ölçümü başlatıldı.");

        } catch (err) {
            console.error("Mikrofon erişimi reddedildi veya cihaz yok:", err);
            isTestingMic = false;
            btn.removeClass('btn-danger').addClass('btn-primary').html('<i class="bi bi-exclamation-triangle-fill me-2"></i>Erişim Reddedildi');
            $('.mic-segment').addClass('active-red');
            
            setTimeout(() => {
                btn.html('<i class="bi bi-mic-fill me-2"></i>Mikrofonu Test Et');
                visualizer.css('width', '0%').removeClass('bg-danger').addClass('bg-success');
            }, 3000);
        }
    } else {
        // Temizleme işlemleri
        isTestingMic = false;
        btn.removeClass('btn-danger').addClass('btn-primary').html('<i class="bi bi-mic-fill me-2"></i>Mikrofonu Test Et');
        $('.mic-segment').removeClass('active-green active-yellow active-red');

        if (animationId) cancelAnimationFrame(animationId);
        if (analyser) analyser.disconnect();
        if (microphone) microphone.disconnect();
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
        }
        console.log("Mikrofon testi sonlandırıldı ve kaynaklar serbest bırakıldı.");
    }
}

/**
 * Ses seviyesi değişimlerini dinle ve LocalStorage'a kaydet
 */
$(document).on('input', '.vol-slider, .volume-slider', function () {
    const type = $(this).data('type'); // 'input' veya 'output'
    const val = $(this).val();
    
    // UI Label Güncelle
    $(`#${type}VolLabel, #${type}VolumeLabel`).text(val);

    // Kayıt
    if (type === 'input') {
        localStorage.setItem('micVolume', val);
    } else if (type === 'output') {
        localStorage.setItem('speakerVolume', val);
    }
});

// --- GÖRÜNÜM VE TEMA AYARLARI ---

/**
 * Tema değiştirme (ThemeManager shorthand)
 */
function changeTheme(themeName) {
    if (typeof ThemeManager !== 'undefined') {
        ThemeManager.applyTheme(themeName);
    } else {
        console.error("ThemeManager not found!");
    }
}

/**
 * Vurgu rengi değiştirme (ThemeManager shorthand)
 */
function changeAccent(color) {
    if (typeof ThemeManager !== 'undefined') {
        ThemeManager.applyAccent(color);
    } else {
        console.error("ThemeManager not found!");
    }
}

// Sayfa yüklendiğinde ayarları hazırla
$(document).ready(function () {
    const initSettings = () => {
        // Sync UI state with current theme/accent
        if (typeof ThemeManager !== 'undefined') {
            ThemeManager.updateUI();
        }

        // Kaydedilmiş Ses seviyelerini yükle ve UI'yı eşle
        const savedInputVol = localStorage.getItem('micVolume') || "80";
        const savedOutputVol = localStorage.getItem('speakerVolume') || "100";
        
        console.log("Ses seviyeleri yükleniyor:", { savedInputVol, savedOutputVol });

        // Slider ve Labelları Güncelle
        $('.vol-slider[data-type="input"]').val(savedInputVol);
        $('#inputVolLabel').text(savedInputVol);
        
        $('.vol-slider[data-type="output"]').val(savedOutputVol);
        $('#outputVolLabel').text(savedOutputVol);
    };

    // İlk yükleme
    initSettings();
    setTimeout(initSettings, 500);
});