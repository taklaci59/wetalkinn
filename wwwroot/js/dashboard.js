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
    const targetRow = sender === window.currentUserName ? receiver : sender;
    const friendRow = $(`#directMessagesList .nav-item:contains('${targetRow}')`);
    if(friendRow.length > 0) {
        $('#directMessagesList').prepend(friendRow);
    }
});

connection.on("ReceiveMessage", function (user, message, channelId) {
    if (!window.isPrivateChat && window.currentChannelId && window.currentChannelId.toString() === channelId.toString()) {
        appendMessage({ sender: user, content: message, time: "Şimdi" });
    }
});

connection.on("UserStatusChanged", function (userId, isOnline) {
    // 1. Update Server Member Panel (if active)
    if (typeof handleUserStatusChange === 'function') {
        handleUserStatusChange(userId, isOnline);
    }

    // 2. Update Direct Messages / Friends List
    // Note: Older logic used username, now we prefer userId if available.
    // Since we don't have a full userId mapping for friends yet, we'll keep the current selector
    // but the backend now sends userId. This means we should ideally update the friend items to have data-userid too.
    const friendRow = $(`#directMessagesList .nav-item[data-userid="${userId}"], #friendsListContent .nav-item[data-userid="${userId}"]`);
    if(friendRow.length > 0) {
        const dot = friendRow.find('div[style*="border-radius: 50%"]');
        if(isOnline) {
            dot.css('background', '#23a55a'); // Discord online green
            friendRow.find('.fw-bold').removeClass('text-2').addClass('text-1');
        } else {
            dot.css('background', '#82858f'); // Discord offline grey
            friendRow.find('.fw-bold').removeClass('text-1').addClass('text-2');
        }
    }
});

connection.on("ReceiveFriendRequest", function (sender) {
    updatePendingCount();
    if ($('.header-tab.active').text().includes('Bekleyenler')) {
        loadPendingRequests();
    }
});

// --- ARKADAŞLARI LİSTELEME ---
function loadFriendsData() {
    $.get('/Friend/GetFriends', function (friends) {
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
        const userId = f.userId || f.UserId;
        const isOnline = (f.isOnline === true || f.IsOnline === true);
        const statusColor = isOnline ? '#23a55a' : '#82858f';

        const itemHtml = `
            <div class="nav-item d-flex align-items-center mb-1 justify-content-between" data-userid="${userId}">
                <div class="d-flex align-items-center flex-grow-1" style="cursor:pointer;" onclick="openPrivateChat('${username}')">
                    <div class="position-relative">
                        <div class="user-avatar-small" style="width:32px; height:32px; font-size: 12px;">
                            ${username[0].toUpperCase()}
                        </div>
                        <div style="width: 14px; height: 14px; background: ${statusColor}; border-radius: 50%; position: absolute; bottom: -2px; right: -2px; border: 3px solid var(--sidebar-bg);"></div>
                    </div>
                    <div class="ms-3 text-truncate">
                        <div class="fw-bold small ${isOnline ? 'text-1' : 'text-2'}">${username}</div>
                    </div>
                </div>
                <!-- Block Button -->
                <button class="btn btn-sm btn-outline-danger border-0 block-friend-btn ms-2" onclick="blockUser('${username}', event)" title="Kullanıcıyı Engelle">
                    <i class="bi bi-person-x"></i>
                </button>
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
    $.get('/Friend/GetPendingRequests', function (requests) {
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
    $.post('/Friend/RespondFriendRequest', { requestId: id, accept: accept, __RequestVerificationToken: token }, function (res) {
        if (res.success) {
            loadPendingRequests();
            updatePendingCount();
            loadFriendsData();
        }
    });
}

function sendFriendRequest() {
    const nick = $('#friendNickname').val().trim();
    if (!nick) return;
    const token = $('input[name="__RequestVerificationToken"]').val();
    $.post('/Friend/SendRequest', { targetUsername: nick, __RequestVerificationToken: token }, function (res) {
        const status = $('#friendStatus');
        if (res.success) {
            status.html('<div class="mt-3 p-2 rounded d-flex align-items-center" style="background: rgba(35, 165, 90, 0.1); color: var(--status-success); font-weight: 700;"><i class="bi bi-check-circle-fill me-2"></i> İstek başarıyla gönderildi!</div>');
            $('#friendNickname').val('');
            updatePendingCount();
        } else {
            status.html('<div class="mt-3 p-2 rounded d-flex align-items-center" style="background: rgba(242, 63, 66, 0.1); color: var(--status-danger); font-weight: 700;"><i class="bi bi-x-circle-fill me-2"></i> ' + (res.message || "Hata!") + '</div>');
        }
    });
}

let currentChatSkip = 0;
let isChatLoading = false;
let currentChatTarget = '';

// --- ENGELLEME SİSTEMİ ---
function blockUser(username, e) {
    if(e) e.stopPropagation();
    if (!confirm(`${username} adlı kullanıcıyı engellemek istediğinize emin misiniz? Bütün bağlarınız koparılacak.`)) return;
    
    // Antiforgery token alınabilir Layout.cshtml içinden ama genel yaklaşımla post atalım:
    const token = $('input[name="__RequestVerificationToken"]').val() || '';
    
    $.post('/Friend/BlockUser', { targetUsername: username, __RequestVerificationToken: token }, function (res) {
        if (res.success) {
            alert(`${username} engellendi.`);
            loadFriendsData();
            if (currentChatTarget === username) {
                showHome();
            }
        } else {
            alert(res.message || "Engelleme başarısız.");
        }
    }).fail(err => {
        // Eğer 401 Unauthorized veya token hatası dönerse manuel tetikle
        if (!token) {
            $.ajax({
                url: '/Friend/BlockUser',
                type: 'POST',
                data: { targetUsername: username },
                success: function(res) {
                    if(res.success) { loadFriendsData(); showHome(); }
                }
            });
        }
    });
}

function loadBlockedUsers() {
    $.get('/Friend/GetBlockedUsers', function (users) {
        const contentArea = $('#friendsListContent');
        if (!users || users.length === 0) {
            contentArea.html('<p class="text-1 opacity-50 small mt-2">Engellenen kullanıcı yok.</p>');
            return;
        }

        let html = '<div class="mt-3">';
        users.forEach(u => {
            const username = u.username || u.Username;
            html += `
                <div class="d-flex align-items-center justify-content-between p-3 mb-2 rounded-3" style="background: var(--card-bg); border: 1px solid rgba(255,0,0,0.2);">
                    <div class="d-flex align-items-center">
                        <div class="user-avatar-small me-3" style="width:40px; height:40px; background:#ed4245; color:white;">
                            ${username[0].toUpperCase()}
                        </div>
                        <div>
                            <div class="text-1 fw-bold">${username}</div>
                            <div class="text-2 small">Engellendi</div>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-light rounded-pill px-3" onclick="unblockUser('${username}')">
                        Engeli Kaldır
                    </button>
                </div>`;
        });
        html += '</div>';
        contentArea.html(html);
    });
}

function unblockUser(username) {
    if (!confirm(`${username} adlı kullanıcının engelini kaldırmak istiyor musunuz?`)) return;
    const token = $('input[name="__RequestVerificationToken"]').val();
    
    $.post('/Friend/UnblockUser', { targetUsername: username, __RequestVerificationToken: token }, function (res) {
        if (res.success) {
            loadBlockedUsers();
        }
    });
}

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
    $('#serverMemberPanel').addClass('hidden'); // DMs don't have server members
    $('#chatHeaderName').text(username);
    $('#chatInput').attr('placeholder', `@${username} kullanıcısına mesaj gönder`);

    // Show call actions in DM
    $('#chatHeaderCallActions').removeClass('hidden');
    if ($('#chatHeaderHashIcon').length) $('#chatHeaderHashIcon').addClass('hidden');
    if ($('#chatHeaderAtIcon').length) $('#chatHeaderAtIcon').removeClass('hidden');
    $('#messageList').html('<div class="p-4 text-center" id="loadingSpinner"><div class="spinner-border spinner-border-sm text-primary"></div></div>');

    loadPrivateMessages(username, true);
}

function loadPrivateMessages(username, isInitial = false) {
    if (isChatLoading) return;
    isChatLoading = true;
    
    $.get(`/Friend/GetChatHistory?withUser=${username}&skip=${currentChatSkip}&take=50`, function (messages) {
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

    // Render Invite Embeds if present
    if (typeof renderInviteEmbed === 'function') {
        renderInviteEmbed(m.content, contentDiv);
    }
    
    // Render General Link Embeds
    if (typeof renderLinkEmbeds === 'function') {
        renderLinkEmbeds(m.content, contentDiv);
    }
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

    // Render Invite Embeds if present
    if (typeof renderInviteEmbed === 'function') {
        renderInviteEmbed(m.content, contentDiv);
    }
    
    // Render General Link Embeds
    if (typeof renderLinkEmbeds === 'function') {
        renderLinkEmbeds(m.content, contentDiv);
    }

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
        $.post('/Home/SendMessage', { 
            channelId: window.currentChannelId, 
            content: msg, 
            serverId: window.currentServerId 
        }, function (res) {
            if (res.success) { msgInput.val('').focus(); }
        });
    }
}


// --- GENEL UI VE ANA SAYFA ---
function showHome() {
    $('#friendsNavSection').removeClass('hidden');
    $('#serverChannelsSection').addClass('hidden');
    $('#serverMemberPanel').addClass('hidden');
    $('#chatView').addClass('hidden').removeClass('d-flex');
    $('#friendsView').removeClass('hidden').addClass('d-flex');
    $('.server-icon').removeClass('active');
    $('#homeIcon').addClass('active');
    $('#serverHeaderName').text('DoWeTalk');
    $('#serverHeader').removeClass('has-server').removeAttr('data-bs-toggle');
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
            <div class="mt-3 p-5 rounded-4 shadow-high animate__animated animate__fadeIn" style="background: var(--surface-3); border: 1px solid var(--border-strong);">
                <h4 class="text-1 fw-bold mb-2">ARKADAŞ EKLE</h4>
                <p class="text-2 small mb-4">Arkadaşlarını kullanıcı adlarını yazarak ekleyebilirsin. Büyük/küçük harf duyarlıdır.</p>
                
                <div class="p-2 rounded-3 d-flex align-items-center add-friend-input-wrapper" style="background: var(--surface-3); border: 1px solid var(--border-strong); transition: all 0.2s ease-in-out;" tabindex="-1">
                    <input type="text" id="friendNickname" 
                           class="form-control border-0 bg-transparent px-3 py-2 add-friend-input" 
                           placeholder="Kullanıcı adı girin..."
                           autocomplete="off">
                    <button class="btn btn-primary rounded-pill px-4 py-2 ms-2 fw-bold shadow-sm" 
                            id="btnSendFriendRequest"
                            onclick="sendFriendRequest()">
                        İstek Gönder
                    </button>
                    <button class="btn btn-primary rounded-pill px-4 py-2 ms-2 fw-bold shadow-sm hidden" 
                            id="btnSendFriendRequestLoading" disabled>
                        <span class="spinner-border spinner-border-sm me-2"></span>Gönderiliyor...
                    </button>
                </div>
                
                <div id="friendStatus" class="mt-1"></div>
                
                <div class="mt-4 pt-4 border-top border-subtle">
                    <div class="text-2 small fw-bold text-uppercase mb-2" style="letter-spacing: 0.05em; font-size: 10px;">Yardım</div>
                    <ul class="text-3 small ps-3 mb-0">
                        <li>Kullanıcı adının tam ve doğru olduğundan emin ol.</li>
                        <li>Engellediğin kişilere istek gönderemezsin.</li>
                    </ul>
                </div>
            </div>`);
    } else if (type === 'blocked') {
        $('#friendsListTitle').text("ENGELLENENLER");
        loadBlockedUsers();
    }
}

function scrollChat() {
    const container = document.getElementById('messageList');
    if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
}

function updatePendingCount() {
    $.get('/Friend/GetPendingRequestCount', function (count) {
        const badge = $('#pendingBadge');
        if (count > 0) {
            badge.text(count).show().css('display', 'inline-flex');
        } else {
            badge.hide();
        }
    });
}

function renderLinkEmbeds(content, $container) {
    // Regex for general URLs (excluding our own invite links which are handled by renderInviteEmbed)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    const urls = [];
    
    while ((match = urlRegex.exec(content)) !== null) {
        const url = match[1];
        // Skip if it's our own invite link (handled elsewhere)
        if (url.includes('dowetalk.sv') || url.includes('localhost')) {
            // Check if it's just a root or dashboard link
            const path = url.split('/').pop().toLowerCase();
             const reserved = ["dashboard", "privacy", "index", "account", "error", "chat", "api"];
             if (!reserved.includes(path)) continue; 
        }
        urls.push(url);
    }

    urls.forEach(url => {
        const embedId = `link-${Math.random().toString(36).substr(2, 9)}`;
        $.get('/Home/GetMetadata', { url: url }, function(m) {
            if (!m) return;
            
            const isVideo = m.type === 'video' || url.includes('youtube.com') || url.includes('youtu.be');
            
            const $embed = $('<div>').attr('id', embedId).addClass('link-embed animate__animated animate__fadeIn ' + (isVideo ? 'video' : ''));
            if (m.siteName) $embed.append($('<div>').addClass('link-embed-site').text(m.siteName));
            $embed.append($('<a>').attr('href', url).attr('target', '_blank').addClass('link-embed-title text-truncate').text(m.title || url));
            if (m.description) $embed.append($('<div>').addClass('link-embed-description text-truncate-2').text(m.description));
            if (m.imageUrl) $embed.append($('<img>').attr('src', m.imageUrl).addClass('link-embed-image').on('error', function() { $(this).remove(); }));
            
            $container.append($embed);
        });
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
