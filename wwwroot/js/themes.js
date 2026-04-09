function changeTheme(themeName) {
    // 1. Temayı Body'ye işle
    document.body.setAttribute('data-theme', themeName);

    // 2. LocalStorage'a kaydet
    localStorage.setItem('dwt-theme', themeName);

    // 3. UI Geri bildirimi: Kartları güncelle
    updateThemeCards(themeName);

    console.log(`Tema uygulandı: ${themeName}`);
}

function updateThemeCards(activeTheme) {
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.remove('active');
        // Kartın içindeki onclick metninde tema adı geçiyorsa active yap
        if (card.getAttribute('onclick').includes(`'${activeTheme}'`)) {
            card.classList.add('active');
        }
    });
}

// Sayfa açıldığında temayı hatırla
$(document).ready(function () {
    const savedTheme = localStorage.getItem('dwt-theme') || 'dark';
    changeTheme(savedTheme);
});