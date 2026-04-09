// --- GLOBAL DEĞİŞKENLER ---
if (typeof window.currentChannelId === 'undefined') window.currentChannelId = null;
if (typeof window.currentServerId === 'undefined') window.currentServerId = null;
if (typeof window.isPrivateChat === 'undefined') window.isPrivateChat = false;
let allFriendsData = [];

// --- SIGNALR BAĞLANTISI ---
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .withAutomaticReconnect()
    .build();

connection.start().then(() => {
    console.log("SignalR Bağlantısı Başarılı.");
    loadFriendsData();
    updatePendingCount();
}).catch(err => console.error("SignalR Bağlantı hatası: ", err));

// --- MESAJ DİNLEYİCİLERİ ---
connection.on("ReceivePrivateMessage", function (sender, receiver, message, time) {
    const activeChat = $('#chatHeaderName').text().trim();
    if (window.isPrivateChat && (activeChat === sender || sender === window.currentUserName)) {
        appendMessage({ sender: sender, content: message, time: time });
    }
    loadFriendsData();
});

connection.on("ReceiveMessage", function (user, message, channelId) {
    if (!window.isPrivateChat && window.currentChannelId && window.currentChannelId.toString() === channelId.toString()) {
        appendMessage({ sender: user, content: message, time: "Şimdi" });
    }
});

connection.on("UserStatusChanged", function (username, isOnline) {
    loadFriendsData();
});

connection.on("ReceiveFriendRequest", function (sender) {
    updatePendingCount();
    if ($('.header-tab.active').text().includes('Bekleyenler')) {
        loadPendingRequests();
    }
});

// --- ARKADAŞLARI LİSTELEME ---
function loadFriendsData() {
    $.get(window.DWT_URLS.getFriends, function (friends) {
        allFriendsData = friends;
        renderFriendsList();
    });
}

function renderFriendsList() {
    const activeTabEl = $('.header-tab.active');
    const typeAttr = activeTabEl.attr('onclick');
    const type = typeAttr ? typeAttr.match(/'([^']+)'/)[1] : 'online';

    let html = '';
    let dmListHtml = '';

    allFriendsData.forEach(f => {
        const username = f.username || f.Username || "Bilinmeyen";
        const isOnline = (f.isOnline === true || f.IsOnline === true);
        const statusColor = isOnline ? '#00e676' : '#8b8e9f';

        const itemHtml = `
            <div class="nav-item d-flex align-items-center mb-1" onclick="openPrivateChat('${username}')">
                <div class="position-relative">
                    <div class="user-avatar-small" style="width:32px; height:32px; font-size: 12px;">
                        ${username[0].toUpperCase()}
                    </div>
                    <div style="width: 12px; height: 12px; background: ${statusColor}; border-radius: 50%; position: absolute; bottom: -2px; right: -2px; border: 2px solid var(--sidebar-bg);"></div>
                </div>
                <div class="ms-3 text-truncate">
                    <div class="fw-bold small ${isOnline ? 'text-1' : 'text-2'}">${username}</div>
                </div>
            </div>`;

        dmListHtml += itemHtml;
        if (type === 'all') html += itemHtml;
        else if (type === 'online' && isOnline) html += itemHtml;
    });

    $('#directMessagesList').html(dmListHtml);
    if (type === 'online' || type === 'all') {
        $('#friendsListContent').html(html || '<div class="p-4 text-center text-2">Görüntülenecek kimse yok.</div>');
    }
}

// --- BEKLEYEN İSTEKLER (GELİŞTİRİLMİŞ) ---
function loadPendingRequests() {
    console.log("loadPendingRequests: Veri çekiliyor...");
    $.get(window.DWT_URLS.pendingRequests, function (requests) {
        console.log("Ham Veri:", requests);

        const contentArea = $('#friendsListContent');
        if (!requests || requests.length === 0) {
            contentArea.html('<p class="text-1 opacity-50 small mt-2">Bekleyen arkadaşlık isteği yok.</p>');
            return;
        }

        let html = '<div class="mt-3">';
        requests.forEach(r => {
            // Case-sensitivity koruması: r.senderName veya r.SenderName gibi tüm ihtimalleri dene
            const sender = r.senderName || r.SenderName || r.senderNickname || r.userName || "Kullanıcı";
            const reqId = r.requestId || r.RequestId || r.id || r.Id;

            html += `
                <div class="d-flex align-items-center justify-content-between p-3 mb-2 rounded-3" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                    <div class="d-flex align-items-center">
                        <div class="user-avatar-small me-3" style="width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:var(--accent); color:var(--accent-text); border-radius:50%; font-weight:bold;">
                            ${sender[0].toUpperCase()}
                        </div>
                        <div>
                            <div class="text-1 fw-bold">${sender}</div>
                            <div class="text-2 small">Gelen Arkadaşlık İsteği</div>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-success rounded-pill px-3" onclick="respondRequest(${reqId}, true)">
                            <i class="bi bi-check-lg"></i> Kabul Et
                        </button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="respondRequest(${reqId}, false)">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>`;
        });
        html += '</div>';
        contentArea.html(html);
    }).fail(function (err) {
        console.error("Bekleyen istekler yüklenemedi:", err);
    });
}

function respondRequest(id, accept) {
    const token = $('input[name="__RequestVerificationToken"]').val();
    $.post(window.DWT_URLS.respondRequest, { requestId: id, accept: accept, __RequestVerificationToken: token }, function (res) {
        if (res.success) {
            loadPendingRequests();
            updatePendingCount();
            loadFriendsData();
        }
    });
}

function doSendFriendRequest() {
    const input = $('#friendNickname');
    const btn = input.next('button');
    const nick = input.val().trim();
    const status = $('#friendStatus');

    if (!nick) return;

    // Loading state
    btn.prop('disabled', true).text('Gönderiliyor...');
    status.html('<span class="text-2">İstek iletiliyor...</span>');

    const token = $('input[name="__RequestVerificationToken"]').val();
    $.post(window.DWT_URLS.sendRequest, { targetUsername: nick, __RequestVerificationToken: token }, function (res) {
        if (res.success) {
            status.html('<span class="text-success fw-bold">✔ Arkadaş isteği gönderildi!</span>');
            input.val('');
            updatePendingCount();
        } else {
            status.html('<span class="text-danger">' + (res.message || "Hata!") + '</span>');
        }
    }).fail(function() {
        status.html('<span class="text-danger">Sunucu hatası oluştu.</span>');
    }).always(function() {
        btn.prop('disabled', false).text('İstek Gönder');
    });
}

let currentChatSkip = 0;
let isChatLoading = false;
let currentChatTarget = '';

// --- MESAJLAŞMA SİSTEMİ ---
function openPrivateChat(username) {
    window.isPrivateChat = true;
    window.currentChannelId = null;
    currentChatTarget = username;
    currentChatSkip = 0;

    $('.server-icon').removeClass('active');
    $('.nav-item').removeClass('active');
    $(`#directMessagesList .nav-item:contains('${username}')`).addClass('active');

    $('#friendsView').addClass('hidden');
    $('#chatView').removeClass('hidden').addClass('d-flex');
    $('#chatHeaderName').text(username);
    $('#messageList').html('<div class="p-4 text-center" id="loadingSpinner"><div class="spinner-border spinner-border-sm text-primary"></div></div>');

    loadPrivateMessages(username, true);
}

function loadPrivateMessages(username, isInitial = false) {
    if (isChatLoading) return;
    isChatLoading = true;
    
    $.get(`${window.DWT_URLS.chatHistory}?withUser=${username}&skip=${currentChatSkip}&take=50`, function (messages) {
        if (isInitial) $('#messageList').empty();
        else $('#loadingSpinner').remove();
        
        if (!messages || messages.length === 0) {
            if (isInitial) $('#messageList').html(`<div class="p-5 text-center text-2">Bu ${username} ile olan sohbetinin başlangıcı.</div>`);
        } else {
            const list = document.getElementById('messageList');
            const oldHeight = list ? list.scrollHeight : 0;
            
            messages.reverse().forEach(m => prependMessage({
                sender: m.sender || m.Sender,
                content: m.content || m.Content,
                time: m.time || m.Time
            }));
            
            if (list) {
                if (isInitial) scrollChat();
                else list.scrollTop = list.scrollHeight - oldHeight;
            }
            
            currentChatSkip += messages.length;
        }
        
        isChatLoading = false;
        if (messages && messages.length === 50) {
            $('#messageList').prepend('<div class="text-center p-2" id="loadingSpinner"><div class="spinner-border spinner-border-sm text-primary"></div></div>');
        }
    });
}

function prependMessage(m) {
    const isMe = m.sender === window.currentUserName;
    const sideClass = isMe ? 'my-message' : 'other-message';
    
    const messageDiv = $('<div>').addClass(`message ${sideClass}`);
    const contentDiv = $('<div>').addClass('message-content');
    
    if (!isMe) {
        contentDiv.append($('<div>').addClass('message-author').text(m.sender));
    }
    
    contentDiv.append($('<div>').addClass('message-text').text(m.content));
    contentDiv.append($('<span>').addClass('message-time').text(m.time || 'Az önce'));
    
    messageDiv.append(contentDiv);
    $('#messageList').prepend(messageDiv);
}

function appendMessage(m) {
    const isMe = m.sender === window.currentUserName;
    const sideClass = isMe ? 'my-message' : 'other-message';
    
    // XSS Fix: Safe DOM creation
    const messageDiv = $('<div>').addClass(`message ${sideClass} animate__animated animate__fadeInUp animate__faster`);
    const contentDiv = $('<div>').addClass('message-content');
    
    if (!isMe) {
        contentDiv.append($('<div>').addClass('message-author').text(m.sender));
    }
    
    contentDiv.append($('<div>').addClass('message-text').text(m.content));
    contentDiv.append($('<span>').addClass('message-time').text(m.time || 'Az önce'));
    
    messageDiv.append(contentDiv);
    $('#messageList').append(messageDiv);
    scrollChat();
}

function sendMessage() {
    let msgInput = $('#chatInput');
    let msg = msgInput.val().trim();
    if (!msg) return;

    if (window.isPrivateChat) {
        const receiver = $('#chatHeaderName').text();
        connection.invoke("SendMessage", receiver, msg)
            .then(() => { msgInput.val('').focus(); })
            .catch(err => console.error("SignalR Send Error:", err));
    } else {
        if (!window.currentChannelId) { alert("Lütfen bir kanal seçin."); return; }
        $.post('/Home/SendMessage', { channelId: window.currentChannelId, content: msg }, function (res) {
            if (res.success) { msgInput.val('').focus(); }
        });
    }
}

// --- AYARLAR SİSTEMİ ---
function openSettings() {
    const overlay = $('.settings-overlay');
    overlay.html(`
        <div class="settings-card animate__animated animate__zoomIn animate__faster">
            <div class="settings-nav">
                <div class="nav-group-title">Kullanıcı Ayarları</div>
                <div class="settings-link active" onclick="switchSettingsTab('account')">
                    <i class="bi bi-person-circle"></i> Hesabım
                </div>
                <div class="settings-link" onclick="switchSettingsTab('profile')">
                    <i class="bi bi-palette"></i> Profil Özelleştirme
                </div>
                <div class="nav-group-title mt-4">Uygulama Ayarları</div>
                <div class="settings-link" onclick="switchSettingsTab('audio')">
                    <i class="bi bi-volume-up"></i> Ses ve Görüntü
                </div>
                <div class="settings-link text-danger mt-auto" onclick="closeSettings()">
                    <i class="bi bi-box-arrow-left"></i> Kapat
                </div>
            </div>
            <div class="settings-body" id="settingsBodyContent"></div>
            <div class="settings-close-btn" onclick="closeSettings()">
                <i class="bi bi-x-lg"></i>
            </div>
        </div>
    `);

    overlay.css('display', 'flex').hide().fadeIn(200);
    switchSettingsTab('account');
}

function closeSettings() {
    $('.settings-overlay').fadeOut(200, function () {
        $(this).html('<div class="text-1">Ayarlar Yükleniyor...</div>');
    });
}

function switchSettingsTab(tabName) {
    $('.settings-link').removeClass('active');
    $(`.settings-link[onclick*="'${tabName}'"]`).addClass('active');

    const contentArea = $('#settingsBodyContent');
    contentArea.html('<div class="h-100 d-flex align-items-center justify-content-center"><div class="spinner-border text-primary"></div></div>');

    $.get('/Account/GetSettingsTab', { tab: tabName })
        .done(function (html) {
            contentArea.html(html);
        })
        .fail(function () {
            let fallbackHtml = `<h2 class="text-1 mb-4">${tabName.toUpperCase()}</h2>`;
            if (tabName === 'account') {
                fallbackHtml += `
                    <div class="avatar-upload-wrapper mb-4">
                        <div class="avatar-preview-big">${window.currentUserName ? window.currentUserName[0] : 'U'}</div>
                    </div>
                    <label class="text-2 small">KULLANICI ADI</label>
                    <div class="p-3 rounded-3 mb-3" style="background: rgba(255,255,255,0.05)">${window.currentUserName || 'Kullanıcı'}</div>
                `;
            } else {
                fallbackHtml += `<p class="text-2">Bu sekme içeriği yakında eklenecek...</p>`;
            }
            contentArea.html(fallbackHtml);
        });
}

// --- GENEL UI VE ANA SAYFA ---
function showHome() {
    $('#friendsNavSection').removeClass('hidden');
    $('#serverChannelsSection').addClass('hidden');
    $('#memberSidebar').addClass('hidden');
    $('#chatView').addClass('hidden').removeClass('d-flex');
    $('#friendsView').removeClass('hidden').addClass('d-flex');
    $('.server-icon').removeClass('active');
    $('#homeIcon').addClass('active');
    $('#serverHeader').html('<span class="fw-bold px-2">DoWeTalk</span>');
    window.currentServerId = null;
    window.currentChannelId = null;
    window.isPrivateChat = false;
    loadFriendsData();
}

function filterFriends(type, el) {
    $('.header-tab').removeClass('active');
    $(el).addClass('active');

    // Yükleniyor durumu
    $('#friendsListContent').html('<div class="text-center p-4"><div class="spinner-border text-primary"></div></div>');

    if (type === 'online' || type === 'all') {
        $('#friendsListTitle').text(type === 'online' ? "ÇEVRİMİÇİ ARKADAŞLAR" : "TÜM ARKADAŞLAR");
        renderFriendsList();
    } else if (type === 'pending') {
        $('#friendsListTitle').text("BEKLEYEN İSTEKLER");
        loadPendingRequests();
    } else if (type === 'add') {
        $('#friendsListTitle').text("ARKADAŞ EKLE");
        $('#friendsListContent').html(`
            <div class="mt-3 p-4 rounded-3 shadow-lg animate__animated animate__fadeIn add-friend-card">
                <h5 class="text-1 mb-2">ARKADAŞ EKLE</h5>
                <p class="text-2 small mb-4">Arkadaşlarını kullanıcı adlarını yazarak ekleyebilirsin.</p>
                <div class="input-group mb-2 custom-add-input">
                    <input type="text" id="friendNickname" class="form-control" placeholder="Kullanıcı adı girin..." onkeypress="if(event.key === 'Enter') doSendFriendRequest()" oninput="$('#friendStatus').empty()">
                    <button class="btn btn-primary px-4 fw-bold" onclick="doSendFriendRequest()">İstek Gönder</button>
                </div>
                <div id="friendStatus" class="mt-2 small animate__animated animate__fadeIn"></div>
            </div>`);
    }
}

function scrollChat() {
    const container = document.getElementById('messageList');
    if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
}

function updatePendingCount() {
    $.get(window.DWT_URLS.pendingCount, function (count) {
        const badge = $('#pendingBadge');
        if (count > 0) {
            badge.text(count).show().css('display', 'inline-flex');
        } else {
            badge.hide();
        }
    });
}

// --- INITIALIZE ---
$(document).ready(function () {
    $(document).on('keypress', '#chatInput', function (e) {
        if (e.which == 13) { sendMessage(); }
    });

    $('#messageList').on('scroll', function() {
        if ($(this).scrollTop() === 0 && !isChatLoading) {
            if (window.isPrivateChat) {
                loadPrivateMessages(currentChatTarget, false);
            }
        }
    });
});
