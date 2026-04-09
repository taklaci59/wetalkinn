/**
 * DoWeTalk - Server & Channel Management System
 * Full Premium Integrated Version
 */

// --- GLOBAL DEĞİŞKENLER ---
if (typeof currentServerId === 'undefined') var currentServerId = null;
if (typeof currentChannelId === 'undefined') var currentChannelId = null;
if (typeof isPrivateChat === 'undefined') var isPrivateChat = false;

// --- STYLED TOAST UTILITY ---
function showToast(message, type = 'info') {
    const colors = {
        success: 'var(--status-success)',
        danger: 'var(--status-danger)',
        warning: 'var(--status-warning)',
        info: 'var(--accent)'
    };
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: colors[type] || colors.info, color: '#fff',
        padding: '10px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: '600',
        zIndex: '99999', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        opacity: '0', transition: 'opacity 0.3s ease', fontFamily: "'Outfit', sans-serif"
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = '1');
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- MESAJ EKLEME FONKSİYONU ---
function appendMessage(data) {
    const isMe = data.sender === window.currentUserName;
    const initial = data.sender ? data.sender[0].toUpperCase() : "?";

    const messageHtml = `
        <div class="message animate__animated animate__fadeInUp mb-3 d-flex align-items-start px-2">
            <div class="message-avatar me-3 shadow-sm" style="width:40px; height:40px; background:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--accent-text); font-weight:bold; flex-shrink:0;">
                ${initial}
            </div>
            <div class="message-content overflow-hidden">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="message-author fw-bold text-1 cursor-pointer" style="font-size: 0.95rem;">${data.sender}</span>
                    <span class="message-time text-2" style="font-size: 0.75rem;">${data.time}</span>
                </div>
                <div class="message-text text-2" style="word-break: break-word; line-height: 1.4;">${data.content}</div>
            </div>
        </div>`;

    const $msg = $(messageHtml);
    $('#messageList').append($msg);
    
    // Render Invite Embeds if present
    renderInviteEmbed(data.content, $msg.find('.message-content'));
    
    // Render General Link Embeds
    renderLinkEmbeds(data.content, $msg.find('.message-content'));

    const container = document.getElementById('messageList');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function renderInviteEmbed(content, $container) {
    const inviteRegex = /(?:dowetalk\.sv\/|localhost:\d+\/)([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = inviteRegex.exec(content)) !== null) {
        const code = match[1];
        const reserved = ["Dashboard", "Privacy", "Index", "Account", "Error", "Chat", "api"];
        if (reserved.some(r => r.toLowerCase() === code.toLowerCase())) continue;

        const embedId = `embed-${Math.random().toString(36).substr(2, 9)}`;
        $container.append(`
            <div id="${embedId}" class="invite-embed animate__animated animate__fadeIn">
                <div class="invite-embed-icon">?</div>
                <div class="invite-embed-info">
                    <div class="invite-embed-title">SUNUCUYA DAVET EDİLDİN</div>
                    <div class="invite-embed-name text-truncate">Yükleniyor...</div>
                    <div class="invite-embed-members">
                        <span class="invite-embed-dot" style="background:#23a55a"></span> ? Çevrimiçi 
                        <span class="invite-embed-dot" style="background:#b5bac1; margin-left:8px;"></span> ? Üye
                    </div>
                </div>
                <button class="invite-btn-join disabled">Katıl</button>
            </div>
        `);

        $.get(`/api/invite/${code}`, function(res) {
            const $embed = $(`#${embedId}`);
            if ($embed.length) {
                $embed.find('.invite-embed-icon').text(res.name[0].toUpperCase());
                $embed.find('.invite-embed-name').text(res.name);
                $embed.find('.invite-embed-members').html(`
                    <span class="invite-embed-dot" style="background:#23a55a"></span> ? Çevrimiçi 
                    <span class="invite-embed-dot" style="background:#b5bac1; margin-left:8px;"></span> ${res.memberCount} Üye
                `);
                $embed.find('.invite-btn-join').removeClass('disabled').text('Katıl').attr('onclick', `joinServerFromEmbed('${res.inviteCode}', this)`);
            }
        }).fail(function() {
            $(`#${embedId}`).remove();
        });
    }
}

function joinServerFromEmbed(code, btn) {
    $(btn).addClass('disabled').text('...');
    $.post(`/api/join/${code}`, function(res) {
        if (res.success) {
            $(btn).text('Katıldın').attr('disabled', true);
            window.location.reload();
        } else {
            window.location.href = '/' + code;
        }
    }).fail(function() {
        window.location.href = '/' + code;
    });
}

// --- SUNUCU SEÇİMİ ---
function selectServer(el, name, id) {
    console.log("selectServer called for:", name, id);
    currentServerId = id.toString();
    isPrivateChat = false;
    currentChannelId = null;

    $('.server-icon').removeClass('active');
    $(el).addClass('active');

    $('#friendsNavSection').addClass('hidden');
    $('#serverChannelsSection').removeClass('hidden');

    $('#membersSidebar').removeClass('hidden');
    $('#friendsView').addClass('hidden');
    $('#chatView').removeClass('hidden').addClass('d-flex');
    $('#serverMemberPanel').removeClass('hidden'); // Show members when selecting server

    // Update Header
    const headerName = document.getElementById('serverHeaderName');
    const headerChevron = document.getElementById('serverHeaderChevron');
    
    if (headerName) headerName.textContent = name;
    if (headerChevron) headerChevron.style.display = 'block';

    // Role-based visibility: show Server Settings only for owner/admin
    $.get('/Home/GetServerSettings', { serverId: currentServerId })
        .done(function() {
            $('#menuServerSettings').show();
        })
        .fail(function() {
            $('#menuServerSettings').hide();
        });
    
    loadChannels(currentServerId);
    loadMembers(currentServerId);
}

// --- SUNUCUDAN AYRILMA ---
function leaveServer() {
    if (!currentServerId) return;

    if (confirm("Bu sunucudan ayrılmak istediğinize emin misiniz?")) {
        $.post('/Home/LeaveServer', { serverId: currentServerId }, function (res) {
            if (res.success) {
                location.reload();
            } else {
                alert(res.message || "Sunucudan ayrılırken bir hata oluştu.");
            }
        });
    }
}

// --- KANAL VE KATEGORİ YÜKLEME ---
let lastServerLoadId = 0;
function loadChannels(serverId) {
    if (!serverId) return;
    lastServerLoadId = serverId;
    
    $('#serverChannelsSection').html('<div class="p-3 text-2 fw-medium opacity-50" style="font-size: 13px;">Kanallar yükleniyor...</div>');

    // Fetch data in parallel
    Promise.all([
        $.get('/Home/GetMemberRole', { serverId: serverId }),
        $.get('/Home/GetCategories', { serverId: serverId }),
        $.get('/Home/GetChannels', { serverId: serverId })
    ]).then(([roleRes, categories, channels]) => {
        if (lastServerLoadId != serverId) return;

        const userRole = roleRes.role;
        const canManage = (userRole === 'Owner' || userRole === 'Admin' || userRole === 'Moderator');

        let html = '';

        // 1. Kategorisiz Kanallar
        const uncategorizedChannels = channels.filter(c => !c.categoryId);
        if (uncategorizedChannels.length > 0) {
            html += '<div class="mt-2 mb-2 pt-1">';
            uncategorizedChannels.forEach(ch => {
                html += renderChannelItem(ch);
            });
            html += '</div>';
        }

        // 2. Kategoriler ve İçindeki Kanallar
        categories.forEach(cat => {
            const catChannels = channels.filter(c => c.categoryId === cat.id);
            html += `
                 <div class="category-item" data-id="${cat.id}">
                    <div class="category-header d-flex justify-content-between align-items-center px-3 py-1 cursor-pointer text-2" onclick="toggleCategory(this)" style="transition: color 0.2s;">
                        <div class="category-name fs-7 fw-bold" style="font-size: 11px; letter-spacing: 0.5px;">
                            <i class="bi bi-chevron-down small category-toggle me-1"></i>
                            ${cat.name.toUpperCase()}
                        </div>
                        ${canManage ? `<i class="bi bi-plus-lg small" onclick="showAddChannelModal(false, ${cat.id}); event.stopPropagation();" title="Kanal Ekle"></i>` : ''}
                    </div>
                    <div class="category-channels mt-1">
                        ${catChannels.length > 0 ? catChannels.map(ch => renderChannelItem(ch)).join('') : '<div class="ms-4 pl-2 py-1 small text-2 opacity-50 fst-italic" style="font-size: 11px;">Kanal yok</div>'}
                    </div>
                </div>`;
        });

        $('#serverChannelsSection').html(html);
        
        // Ensure active channel state is maintained
        if (window.currentChannelId) {
            $(`.channel-item[data-id="${window.currentChannelId}"]`).addClass('active');
        }
    }).catch(err => {
        console.error("loadChannels error:", err);
        if (lastServerLoadId == serverId) {
            $('#serverChannelsSection').html('<div class="p-3 text-danger small">Kanallar yüklenirken hata oluştu.</div>');
        }
    });
}


function renderChannelItem(ch) {
    const icon = ch.isVoice ? 'bi bi-volume-up-fill' : 'bi bi-hash';
    const clickFn = ch.isVoice ? `joinVoiceChannel('${ch.id}', '${ch.name}')` : `openChannel('${ch.id}', '${ch.name}')`;
    
    // Exact Discord Active vs Default states
    const isActive = currentChannelId == ch.id;
    const activeClass = isActive ? 'active text-1' : 'text-2 hover-bg-dark-light';
    const activeStyle = isActive ? 'background: rgba(255, 255, 255, 0.1);' : '';
    
    return `
        <div class="nav-item channel-item d-flex align-items-center mx-2 px-2 py-1 rounded cursor-pointer ${activeClass} mb-1" style="transition: all 0.1s ease; ${activeStyle}" data-id="${ch.id}" onclick="${clickFn}">
            <i class="${icon} me-2 fs-5 ${isActive ? 'opacity-100' : 'opacity-75'}"></i> 
            <span class="text-truncate fw-medium" style="font-size: 15px;">${ch.name}</span>
        </div>`;
}

function toggleCategory(el) {
    const item = el.closest('.category-item');
    item.classList.toggle('collapsed');
}

// --- PREMIUM AYARLAR PANELİ ---

function openServerSettings() {
    if (!currentServerId) return;
    
    $.get('/Home/GetServerSettings', { serverId: currentServerId }, function (res) {
        // Genel Bakış Doldur
        $('#settingServerName').val(res.name);
        $('#settingVanityUrl').val(res.customUrl || '');
        $('#previewName').text(res.name);
        $('#settingVanityMsg').text('').removeClass('text-success text-danger');
        
        if (res.iconUrl) {
            $('#previewIcon').css('background-image', `url(${res.iconUrl})`).text('');
        } else {
            $('#previewIcon').css('background-image', 'none').text(res.name[0].toUpperCase());
        }
        
        if (res.bannerUrl) {
            $('#previewBanner').css('background-image', `url(${res.bannerUrl})`);
        } else {
            $('#previewBanner').css('background-image', 'none').css('background-color', 'var(--accent)');
        }

        $('#premiumSettingsOverlay').addClass('active');
        showSettingsSection('overview');
    }).fail(function() {
        alert("Sadece sunucu yöneticileri ayarları görebilir.");
    });
}

function closePremiumSettings() {
    $('#premiumSettingsOverlay').removeClass('active');
}

function showSettingsSection(section) {
    $('.settings-nav-item').removeClass('active');
    $(`.settings-nav-item[onclick*="${section}"]`).addClass('active');
    
    $('.settings-section').addClass('hidden');
    $(`#section-${section}`).removeClass('hidden');

    if (section === 'categories') {
        loadServerCategoriesSettings();
    } else if (section === 'roles') {
        loadServerRolesSettings();
    }
}

function saveServerProfile() {
    const name = $('#settingServerName').val().trim();
    const vanity = $('#settingVanityUrl').val().trim();
    const token = $('input[name="__RequestVerificationToken"]').val();

    $.post('/Home/UpdateServerProfile', {
        serverId: currentServerId,
        name: name,
        __RequestVerificationToken: token
    }, function(res) {
        if (res.success) {
            // Vanity URL ayrıca kaydediliyor (eski sistemle uyumlu olması için)
            $.post('/Home/SetServerCustomUrl', {
                serverId: currentServerId,
                customUrl: vanity,
                __RequestVerificationToken: token
            }, function(vRes) {
                if (vRes.success) {
                    $('#settingVanityMsg').text("Profil başarıyla güncellendi!").addClass('text-success').removeClass('text-danger');
                    $('#previewName').text(name);
                    $('#serverHeaderName').text(name);
                } else {
                    $('#settingVanityMsg').text(vRes.message).addClass('text-danger').removeClass('text-success');
                }
            });
        }
    });
}

// --- KATEGORİ YÖNETİMİ ---

function loadServerCategoriesSettings() {
    const list = $('#settingsCategoryList');
    list.html('<div class="text-2 p-3">Yükleniyor...</div>');

    $.get('/Home/GetCategories', { serverId: currentServerId }, function (categories) {
        let html = '';
        if (categories.length === 0) {
            html = '<div class="p-4 text-center text-2 border border-white-5 rounded">Henüz hiç kategori yok.</div>';
        } else {
            categories.forEach(cat => {
                html += `
                    <div class="d-flex justify-content-between align-items-center p-3  rounded mb-2 animate__animated animate__fadeIn">
                        <div class="fw-bold">${cat.name}</div>
                        <div class="d-flex gap-2">
                             <button class="btn btn-sm btn-outline-light" onclick="editCategory(${cat.id}, '${cat.name}')"><i class="bi bi-pencil"></i></button>
                             <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${cat.id})"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>`;
            });
        }
        list.html(html);
    });
}

function showCreateCategoryModal() {
    $('#newCategoryName').val('');
    const modal = new bootstrap.Modal(document.getElementById('createCategoryModal'));
    modal.show();
}

function createCategory() {
    const name = $('#newCategoryName').val().trim();
    if (!name) return;

    $.post('/Home/CreateCategory', { serverId: currentServerId, name: name }, function(res) {
        if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById('createCategoryModal')).hide();
            loadServerCategoriesSettings();
            loadChannels(currentServerId);
        } else {
            alert(res.message);
        }
    });
}

function deleteCategory(id) {
    if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz? Kanallar silinmez, sadece kategorisiz kalır.")) return;

    $.post('/Home/DeleteCategory', { serverId: currentServerId, categoryId: id }, function(res) {
        if (res.success) {
            loadServerCategoriesSettings();
            loadChannels(currentServerId);
        }
    });
}

// --- ROL YÖNETİMİ ---

var serverRolesCache = [];

function loadServerRolesSettings() {
    const list = $('#settingsRoleList');
    list.html('<div class="text-2 p-3">Yükleniyor...</div>');

    $.get(`/api/role/${currentServerId}`, function (roles) {
        serverRolesCache = roles;
        let html = '';
        roles.forEach(role => {
            const color = role.color || '#99aab5';
            html += `
                <div class="role-list-item d-flex align-items-center p-2 mb-1 rounded cursor-pointer hover-bg-dark-light" onclick="editRole(${role.id})">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; margin-right: 10px;"></div>
                    <div class="flex-grow-1 text-truncate" style="color: ${role.isDefault ? '#b5bac1' : 'white'}; font-weight: ${role.isDefault ? '400' : '600'};">
                        ${role.name}
                    </div>
                    <i class="bi bi-chevron-right small opacity-50"></i>
                </div>`;
        });
        list.html(html);
    });
}

function createNewRole() {
    const name = "Yeni Rol";
    $.post('/api/role/create', { serverId: currentServerId, name: name }, function(res) {
        loadServerRolesSettings();
    }).fail(err => alert("Yetkiniz yok."));
}

function editRole(roleId) {
    const role = serverRolesCache.find(r => r.id === roleId);
    if (!role) return;

    const container = $('#roleEditContainer');
    
    // Permission names mapping
    const perms = [
        { bit: 1, name: "Yönetici (Tüm Yetkiler)", desc: "Bu yetkiye sahip üyeler tüm yetkilere sahip olur ve her türlü sınırı aşabilir. Bu tehlikeli bir yetkidir." },
        { bit: 2, name: "Sunucuyu Yönet", desc: "Sunucu adını, ikonunu ve afişini değiştirebilir." },
        { bit: 4, name: "Rolleri Yönet", desc: "Yeni roller oluşturabilir ve kendi rolünün altındaki rolleri düzenleyebilir/silebilir." },
        { bit: 8, name: "Kanalları Yönet", desc: "Kanal oluşturabilir, düzenleyebilir veya silebilir." },
        { bit: 16, name: "Kategorileri Yönet", desc: "Kategori oluşturabilir, düzenleyebilir veya silebilir." },
        { bit: 32, name: "Mesaj Gönder", desc: "Metin kanallarında mesaj gönderme izni." },
        { bit: 64, name: "Herkesten Bahset (@everyone)", desc: "@everyone etiketini kullanarak tüm üyelere bildirim gönderebilir." }
    ];

    let permsHtml = '';
    perms.forEach(p => {
        const isChecked = (BigInt(role.permissions) & BigInt(p.bit)) === BigInt(p.bit) ? 'checked' : '';
        permsHtml += `
            <div class="permission-item d-flex justify-content-between align-items-center py-3 border-bottom border-white-5">
                <div class="pe-3">
                    <div class="fw-bold text-1 small">${p.name}</div>
                    <div class="text-2" style="font-size: 12px;">${p.desc}</div>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input perm-switch" type="checkbox" data-bit="${p.bit}" ${isChecked}>
                </div>
            </div>`;
    });

    container.html(`
        <div class="animate__animated animate__fadeIn">
            <div class="mb-4">
                <label class="small text-2 mb-2 fw-bold text-uppercase">ROL ADI</label>
                <input type="text" id="editRoleName" class="form-control discord-input" value="${role.name}" ${role.isDefault ? 'disabled' : ''}>
            </div>
            
            <div class="mb-4">
                <label class="small text-2 mb-2 fw-bold text-uppercase">ROL RENGİ</label>
                <div class="d-flex align-items-center gap-3">
                    <input type="color" id="editRoleColor" class="form-control form-control-color border-0 bg-transparent" value="${role.color || '#99aab5'}" style="width: 50px; height: 50px;">
                    <span class="text-2 small">Üye listesinde bu renk görünür.</span>
                </div>
            </div>

            <div class="mb-4">
                <label class="small text-2 mb-2 fw-bold text-uppercase">YETKİLER</label>
                <div class="permissions-list mt-2">
                    ${permsHtml}
                </div>
            </div>

            <div class="d-flex justify-content-between mt-5 pt-3 border-top border-white-5">
                ${!role.isDefault ? `<button class="btn btn-outline-danger btn-sm" onclick="deleteRole(${role.id})">Rolü Sil</button>` : '<div></div>'}
                <button class="btn btn-indigo px-4" onclick="saveRole(${role.id})">Değişiklikleri Kaydet</button>
            </div>
        </div>
    `);
}

function saveRole(roleId) {
    const role = serverRolesCache.find(r => r.id === roleId);
    if (!role) return;

    const name = $('#editRoleName').val().trim();
    const color = $('#editRoleColor').val();
    
    let permissions = 0n;
    $('.perm-switch:checked').each(function() {
        permissions |= BigInt($(this).data('bit'));
    });

    $.post('/api/role/update', {
        serverId: currentServerId,
        roleId: roleId,
        name: name,
        colorHex: color,
        permissions: permissions.toString(),
        position: role.position // keep current pos for now
    }, function(res) {
        if (res.success) {
            loadServerRolesSettings();
            alert("Rol başarıyla güncellendi.");
        }
    }).fail(err => alert("Hata: " + (err.status === 403 ? "Yetkiniz yok veya hiyerarşi engeli." : "İşlem başarısız.")));
}

function deleteRole(roleId) {
    if (!confirm("Bu rolü silmek istediğinize emin misiniz?")) return;

    $.ajax({
        url: `/api/role/${currentServerId}/${roleId}`,
        type: 'DELETE',
        success: function(res) {
            $('#roleEditContainer').html('<div class="text-center text-2 mt-5"><i class="bi bi-shield-lock-fill display-1 opacity-25"></i><p class="mt-3">Düzenlemek için bir rol seçin.</p></div>');
            loadServerRolesSettings();
        },
        error: err => alert("Hata: Yetkiniz yok veya bu rolü silemezsiniz.")
    });
}

var pendingCategoryId = null;

function showAddChannelModal(isVoice = false, categoryId = null) {
    pendingCategoryId = categoryId;
    switchChannelType(isVoice ? 'voice' : 'text');
    $('#addChannelInput').val('');
    
    // Set the correct radio button
    if (isVoice) {
        $('input[name="channelTypeRadio"][value="voice"]').prop('checked', true);
    } else {
        $('input[name="channelTypeRadio"][value="text"]').prop('checked', true);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('addChannelModal'));
    modal.show();
}

function switchChannelType(type) {
    const isVoice = (type === 'voice');
    $('#addChannelIsVoice').val(isVoice);
    
    if (isVoice) {
        $('#channelNamePrefix').html('<i class="bi bi-volume-up-fill me-1"></i>');
        $('#addChannelInput').attr('placeholder', 'yeni-ses-kanalı');
        $('#channelTypeVoiceLabel').css('border-color', 'var(--accent)');
        $('#channelTypeTextLabel').css('border-color', 'var(--border-subtle)');
    } else {
        $('#channelNamePrefix').text('#');
        $('#addChannelInput').attr('placeholder', 'yeni-metin-kanalı');
        $('#channelTypeTextLabel').css('border-color', 'var(--accent)');
        $('#channelTypeVoiceLabel').css('border-color', 'var(--border-subtle)');
    }
}

function createChannel() {
    if (!currentServerId) return;
    const name = $('#addChannelInput').val().trim();
    const isVoice = $('#addChannelIsVoice').val() === 'true';
    const token = $('input[name="__RequestVerificationToken"]').val();

    if (!name) return;

    $.post('/Home/CreateChannel', {
        serverId: currentServerId,
        name: name,
        isVoice: isVoice,
        categoryId: pendingCategoryId,
        __RequestVerificationToken: token
    }, function (res) {
        if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById('addChannelModal')).hide();
            loadChannels(currentServerId);
            pendingCategoryId = null;
        } else {
            alert(res.message || "Kanal oluşturulamadı.");
        }
    });
}

// --- DİĞER FONKSİYONLAR ---

function openChannel(id, name) {
    currentChannelId = id.toString();
    isPrivateChat = false;

    $('.channel-item').removeClass('active text-1 ').addClass('text-2');
    $(`.channel-item[data-id="${id}"]`).addClass('active text-1 ');

    $('#chatHeaderName').text(name);
    $('#chatInput').attr('placeholder', `#${name} kanalına mesaj gönder`);
    
    $('#chatHeaderCallActions').addClass('hidden');
    $('#chatHeaderHashIcon').removeClass('hidden');
    $('#chatHeaderAtIcon').addClass('hidden');

    loadMessages(currentChannelId);

    if (typeof connection !== 'undefined' && connection.state === "Connected") {
        connection.invoke("JoinServerGroup", currentChannelId).catch(err => console.error(err));
    }
}

function joinVoiceChannel(id, name) {
    if (id) {
        // UI feedback for joining channel session
        currentChannelId = id.toString();
        $('.channel-item').removeClass('active text-1 ').addClass('text-2');
        $(`.channel-item[data-id="${id}"]`).addClass('active text-1 ');
    }
    
    if (typeof startVoiceCall === 'function') {
        startVoiceCall();
    } else {
        alert("Sesli sohbet modülü yüklenemedi.");
    }
}

function loadMessages(channelId) {
    $('#messageList').html('<div class="p-4 text-center"><div class="spinner-border spinner-border-sm text-primary"></div></div>');

    $.get('/Home/GetChannelMessages', { channelId: channelId, serverId: currentServerId }, function (messages) {
        $('#messageList').empty();
        if (messages && messages.length > 0) {
            messages.forEach(m => {
                appendMessage({
                    sender: m.sender || "Anonim",
                    content: m.content,
                    time: m.time || "00:00"
                });
            });
        } else {
            $('#messageList').html(`
                <div class="p-5 text-center">
                    <div class="display-4 text-2 mb-2"><i class="bi bi-chat-dots"></i></div>
                    <div class="text-1 fw-bold">Bu kanalın başlangıcıdır.</div>
                    <div class="text-2 small">Henüz burada mesaj yok.</div>
                </div>`);
        }
    });
}

function loadMembers(serverId) {
    const listContainer = $('#serverMemberListContent');
    if (!listContainer.length) return;

    listContainer.html('<div class="px-3 py-2 small text-2 opacity-50">Yükleniyor...</div>');

    $.get('/Home/GetServerMembers', { serverId: serverId }, function (members) {
        let html = '';
        if (members && members.length > 0) {
            $('#memberCount').text(members.length);
            members.forEach(m => {
                const name = m.username || "Kullanıcı";
                const role = m.role || "Member";
                const initial = name[0].toUpperCase();
                
                let roleBadgeHtml = '';
                if(role === 'Owner') roleBadgeHtml = '<i class="bi bi-star-fill text-warning ms-1" style="font-size:10px;"></i>';
                else if(role === 'Admin') roleBadgeHtml = '<i class="bi bi-shield-fill-check text-success ms-1" style="font-size:10px;"></i>';
                else if(role === 'Moderator') roleBadgeHtml = '<i class="bi bi-shield-shaded text-info ms-1" style="font-size:10px;"></i>';

                html += `
                    <div class="member-item animate__animated animate__fadeIn animate__faster">
                        <div class="member-avatar">
                            <div style="width:32px; height:32px; background:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--accent-text); font-size:12px; font-weight:bold;">${initial}</div>
                            <div class="status-dot"></div>
                        </div>
                        <div class="ms-3 overflow-hidden d-flex align-items-center justify-content-between flex-grow-1">
                            <div class="fw-bold text-truncate">${name}</div>
                            ${roleBadgeHtml}
                        </div>
                    </div>`;
            });
            listContainer.html(html);
        }
    });
}

function renderLinkEmbeds(content, $container) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    const urls = [];
    
    while ((match = urlRegex.exec(content)) !== null) {
        const url = match[1];
        if (url.includes('dowetalk.sv') || url.includes('localhost')) {
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
            
            let html = `
                <div id="${embedId}" class="link-embed animate__animated animate__fadeIn ${isVideo ? 'video' : ''}">
                    ${m.siteName ? `<div class="link-embed-site">${m.siteName}</div>` : ''}
                    <a href="${url}" target="_blank" class="link-embed-title text-truncate">${m.title || url}</a>
                    ${m.description ? `<div class="link-embed-description">${m.description}</div>` : ''}
                    ${m.imageUrl ? `<img src="${m.imageUrl}" class="link-embed-image" onerror="this.remove()">` : ''}
                </div>`;
            $container.append(html);
        });
    });
}

// --- WIZARD ---
function goToWizardStep(step) {
    $('.wizard-step').addClass('hidden');
    $(`#wizardStep${step}`).removeClass('hidden');
    $('#wizardError, #wizardJoinError').addClass('hidden');
}

function executeCreateServer() {
    const name = $('#wizardServerName').val().trim();
    if (!name || name.length < 2) return;
    
    $('#btnCreateFinal').prop('disabled', true).text('Oluşturuluyor...');
    $.post('/Home/CreateServer', { name: name }, function (res) {
        if (res.success) {
            location.reload();
        } else {
            alert(res.message);
        }
    }).always(() => $('#btnCreateFinal').prop('disabled', false).text('Oluştur'));
}

function executeJoinServer() {
    const code = $('#wizardInviteCode').val().trim();
    if (!code) return;
    
    $('#btnJoinFinal').prop('disabled', true).text('Katılanıyor...');
    $.post('/Home/JoinServer', { inviteCode: code }, function (res) {
        if (res.success) {
            location.reload();
        } else {
            alert(res.message);
        }
    }).always(() => $('#btnJoinFinal').prop('disabled', false).text('Sunucuya Katıl'));
}

// Global ESC key to close premium settings
$(document).on('keydown', function(e) {
    if (e.keyCode === 27) { // ESC
        closePremiumSettings();
    }
});

// Eski kod yönlendirmeleri
function createServer() { executeCreateServer(); }
function joinServer() { executeJoinServer(); }
function openNotificationSettings() { openNotificationSettingsModal(); }

// --- CONTEXT MENU (GELİŞMİŞ) ---

function hideContextMenu() {
    $('#contextMenu').addClass('hidden');
}

$(document).on('click', function() {
    hideContextMenu();
});

function showContextMenu(e, type, data) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const menu = $('#contextMenu');
    const list = $('#contextMenuList');
    list.empty();

    // Context types
    if (type === 'channel') {
        list.append(`<li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer small" onclick="showEditChannelModal(${data.id}, '${data.name}')"><i class="bi bi-pencil me-2 opacity-75"></i>Kanalı Düzenle</li>`);
        list.append(`<li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer small text-danger" onclick="deleteChannel(${data.id})"><i class="bi bi-trash me-2 opacity-75"></i>Kanalı Sil</li>`);
    } 
    else if (type === 'category') {
        list.append(`<li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer small" onclick="showAddChannelModal(false, ${data.id})"><i class="bi bi-plus-lg me-2 opacity-75"></i>Kanal Oluştur</li>`);
        list.append(`<li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer small text-danger" onclick="deleteCategory(${data.id})"><i class="bi bi-trash me-2 opacity-75"></i>Kategoriyi Sil</li>`);
    }
    else if (type === 'empty-sidebar') {
        list.append(`<li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer small" onclick="showAddChannelModal(false)"><i class="bi bi-plus-circle me-2 opacity-75"></i>Kanal Oluştur</li>`);
        list.append(`<li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer small" onclick="$('#createCategoryModal').modal('show')"><i class="bi bi-folder-plus me-2 opacity-75"></i>Kategori Oluştur</li>`);
    }
    else if (type === 'member') {
        // ... (roles logic)
        list.append(`<li class="context-menu-header px-2 py-1 small text-2 fw-bold border-bottom border-white-5 mb-1" style="font-size: 10px;">ROLLERİ YÖNET</li>`);
        
        serverRolesCache.forEach(role => {
            if (role.isDefault) return;
            const hasRole = data.roles && data.roles.some(r => r.id === role.id);
            const icon = hasRole ? 'bi-check-square-fill text-indigo' : 'bi-square text-2';
            list.append(`
                <li class="context-menu-item p-2 hover-bg-dark-light rounded cursor-pointer d-flex align-items-center justify-content-between small" onclick="toggleMemberRole('${data.userId}', ${role.id}, ${hasRole}); event.stopPropagation();">
                    <span>${role.name}</span>
                    <i class="bi ${icon}"></i>
                </li>`);
        });
    }

    // Positioning logic (fixed)
    let top = e.clientY;
    let left = e.clientX;

    // Viewport collision detection
    const menuWidth = 180;
    const menuHeight = list.children().length * 35 + 20;

    if (left + menuWidth > window.innerWidth) left -= menuWidth;
    if (top + menuHeight > window.innerHeight) top -= menuHeight;

    menu.removeClass('hidden').css({
        position: 'fixed',
        top: top + 'px',
        left: left + 'px',
        display: 'block'
    });
}

function toggleMemberRole(userId, roleId, hasRole) {
    const endpoint = hasRole ? '/api/role/remove' : '/api/role/assign';
    $.post(endpoint, { serverId: currentServerId, targetUserId: userId, roleId: roleId }, function(res) {
        loadMembers(currentServerId);
    }).fail(err => alert("Hata: " + (err.status === 403 ? "Yetkiniz yok veya hiyerarşi engeli." : "İşlem başarısız.")));
}

// Global Keyboard Listener (ESC to close modals/menus)
$(document).on('keydown', function(e) {
    if (e.keyCode === 27) { // ESC
        hideContextMenu();
        closePremiumSettings();
    }
});

// Centralized Delegated Context Menu
$(document).on('contextmenu', '#serverChannelsSection', function(e) {
    const target = $(e.target);
    
    // 1. Channel Item
    const channelItem = target.closest('.channel-item');
    if (channelItem.length) {
        showContextMenu(e, 'channel', { id: channelItem.data('id'), name: channelItem.find('span').text() });
        return;
    }

    // 2. Category Header
    const categoryHeader = target.closest('.category-header');
    if (categoryHeader.length) {
        const item = categoryHeader.closest('.category-item');
        const name = categoryHeader.find('.category-name').text().trim();
        showContextMenu(e, 'category', { id: item.data('id'), name: name });
        return;
    }

    // 3. Catch-all: Empty Sidebar Area
    showContextMenu(e, 'empty-sidebar');
});

$(document).on('contextmenu', '.member-item', function(e) {
    const userId = $(this).data('userid');
    const member = window.currentMembersCache.find(m => m.userId === userId);
    if (member) {
        showContextMenu(e, 'member', member);
    }
});

// Update loadMembers to cache data and render deterministically
window.currentMembersCache = [];
function loadMembers(serverId) {
    const listContainer = $('#serverMemberListContent');
    if (!listContainer.length) return;
    
    // Show Loading state
    listContainer.html(`
        <div class="member-skeleton p-2 mb-1 animate__animated animate__pulse animate__infinite">
            <div class="d-flex align-items-center">
                <div class="rounded-circle  me-2" style="width: 32px; height: 32px;"></div>
                <div class=" rounded" style="width: 100px; height: 12px;"></div>
            </div>
        </div>`.repeat(5));

    $.get('/Home/GetServerMembers', { serverId: serverId }, function (members) {
        window.currentMembersCache = members;
        renderMembersList(members);
    });
}

function renderMembersList(members) {
    const listContainer = $('#serverMemberListContent');
    if (!members || members.length === 0) {
        listContainer.html('<div class="p-4 text-center text-2 small opacity-50">Üye bulunamadı.</div>');
        $('#memberCount').text('0');
        return;
    }

    // Deterministic Sort: Online > Owner > Highest Position > Name (AZ)
    const sorted = [...members].sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
        if (a.rolePosition !== b.rolePosition) return b.rolePosition - a.rolePosition;
        return a.username.localeCompare(b.username);
    });

    const online = sorted.filter(m => m.isOnline);
    const offline = sorted.filter(m => !m.isOnline);

    let html = '';
    
    if (online.length > 0) {
        html += `<div class="p-2 pt-3 pb-1 text-2 fw-bold text-uppercase" style="font-size: 11px; letter-spacing: 0.5px;">Çevrimiçi — ${online.length}</div>`;
        online.forEach(m => html += renderMemberItem(m));
    }

    if (offline.length > 0) {
        html += `<div class="p-2 pt-3 pb-1 text-2 fw-bold text-uppercase" style="font-size: 11px; letter-spacing: 0.5px;">Çevrimdışı — ${offline.length}</div>`;
        offline.forEach(m => html += renderMemberItem(m));
    }

    listContainer.html(html);
    $('#memberCount').text(members.length);
}

function renderMemberItem(m) {
    const initial = (m.nickname || m.username)[0].toUpperCase();
    const displayName = m.nickname || m.username;
    const nameColor = m.primaryRoleColor || '#949ba4';
    const statusClass = m.isOnline ? '' : 'offline';
    
    return `
        <div class="member-item ${statusClass} ${m.isOwner ? 'is-owner' : ''}" data-userid="${m.userId}" oncontextmenu="event.preventDefault(); showMemberContext(event, '${m.userId}')" title="${m.username}">
            <div class="member-avatar me-2 flex-shrink-0">
                <div class="rounded-circle d-flex align-items-center justify-content-center text-1 fw-bold" style="width: 32px; height: 32px; background: #6366f1; font-size: 14px;">${initial}</div>
                <div class="status-dot"></div>
            </div>
            <div class="member-info overflow-hidden">
                <div class="text-truncate fw-medium" style="color: ${nameColor}; font-size: 14px;">${displayName}</div>
                ${m.nickname ? `<div class="text-2 small text-truncate" style="font-size: 11px;">${m.username}</div>` : ''}
            </div>
            <div class="role-badge owner" title="Sunucu Sahibi"><i class="bi bi-crown-fill text-warning"></i></div>
        </div>`;
}

function handleUserStatusChange(userId, isOnline) {
    if (!window.currentMembersCache) return;
    
    const member = window.currentMembersCache.find(m => m.userId === userId);
    if (member) {
        member.isOnline = isOnline;
        renderMembersList(window.currentMembersCache);
    }
}

function deleteChannel(id) {
    if(!confirm("Kanalı silmek istediğinize emin misiniz?")) return;
    $.post('/Home/DeleteChannel', { serverId: currentServerId, channelId: id }, function(res) {
        if(res.success) {
            if (currentChannelId == id) {
                currentChannelId = null;
                // Clear chat view immediately for better UX
                $('#chatHeaderName').text('Sohbet');
                $('#messageList').empty();
            }
            loadChannels(currentServerId);
        }
        else alert(res.message);
    });
}

function showEditChannelModal(id, name) {
    alert("Kanal düzenleme yakında!");
}



function editCategory(id, name) {
    const newName = prompt("Kategori adını düzenle:", name);
    if (!newName || newName === name) return;

    $.post('/Home/UpdateCategory', { serverId: currentServerId, categoryId: id, name: newName }, function (res) {
        if (res.success) loadChannels(currentServerId);
        else alert(res.message);
    });
}

function deleteCategory(id) {
    if (!confirm("Kategoriyi silmek istediğinize emin misiniz? (İçindeki kanallar silinmez)")) return;

    $.post('/Home/DeleteCategory', { serverId: currentServerId, categoryId: id }, function (res) {
        if (res.success) loadChannels(currentServerId);
        else alert(res.message);
    });
}

// ═══════════════════════════════════════════════════════
// SERVER HEADER DROPDOWN (DISCORD-STYLE)
// ═══════════════════════════════════════════════════════

function toggleServerDropdown(e) {
    e.stopPropagation();
    const menu = document.getElementById('serverDropdownMenu');
    const panel = document.querySelector('.left-panel');
    if (!menu) return;

    const isOpen = !menu.classList.contains('hidden');
    if (isOpen) {
        closeServerDropdown();
    } else {
        menu.classList.remove('hidden');
        panel.classList.add('server-dropdown-open');
    }
}

function closeServerDropdown() {
    const menu = document.getElementById('serverDropdownMenu');
    const panel = document.querySelector('.left-panel');
    if (menu) menu.classList.add('hidden');
    if (panel) panel.classList.remove('server-dropdown-open');
}

// Click outside to close
document.addEventListener('click', function(e) {
    const menu = document.getElementById('serverDropdownMenu');
    const header = document.getElementById('serverHeader');
    if (!menu || menu.classList.contains('hidden')) return;
    if (!menu.contains(e.target) && !header.contains(e.target)) {
        closeServerDropdown();
    }
});

// Close on ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeServerDropdown();
});

// ═══════════════════════════════════════════════════════
// SERVER INVITE MODAL
// ═══════════════════════════════════════════════════════

function openInviteModal() {
    closeServerDropdown();
    if (!currentServerId) return;

    // Reset to step 1
    $('#inviteStepCreate').show();
    $('#inviteStepSuccess').addClass('hidden');
    $('#customInviteInput').val('');

    var modal = new bootstrap.Modal(document.getElementById('serverInviteModal'));
    modal.show();
}

function generateCustomInvite() {
    if (!currentServerId) return;
    const customCode = $('#customInviteInput').val().trim();
    const token = $('input[name="__RequestVerificationToken"]').val();

    if (!customCode) {
        // No custom code entered: auto-generate a random invite code
        $.post('/Home/GenerateInviteCode', {
            serverId: currentServerId,
            __RequestVerificationToken: token
        }, function(res) {
            if (res.success) {
                const baseUrl = window.location.origin + '/';
                $('#finalInviteUrl').val(baseUrl + res.inviteCode);
                $('#inviteStepCreate').hide();
                $('#inviteStepSuccess').removeClass('hidden');
            } else {
                showToast('Davet kodu oluşturulamadı.', 'danger');
            }
        }).fail(function() {
            showToast('Davet kodu oluşturulurken bir hata oluştu.', 'danger');
        });
        return;
    }

    // Custom code entered: set vanity URL
    $.post('/Home/SetServerCustomUrl', {
        serverId: currentServerId,
        customUrl: customCode,
        __RequestVerificationToken: token
    }, function(res) {
        if (res.success) {
            const baseUrl = window.location.origin + '/';
            $('#finalInviteUrl').val(baseUrl + customCode);
            $('#inviteStepCreate').hide();
            $('#inviteStepSuccess').removeClass('hidden');
        } else {
            showToast(res.message || 'Bu kod zaten kullanılıyor.', 'danger');
        }
    }).fail(function() {
        showToast('Davet oluşturulurken bir hata oluştu.', 'danger');
    });
}

function copyInviteUrl() {
    const input = document.getElementById('finalInviteUrl');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(function() {
        const btn = input.nextElementSibling;
        if (btn) {
            const original = btn.textContent;
            btn.textContent = 'Kopyalandı!';
            btn.style.background = 'var(--status-success)';
            setTimeout(() => {
                btn.textContent = original;
                btn.style.background = '';
            }, 2000);
        }
    });
}

// ═══════════════════════════════════════════════════════
// NOTIFICATION SETTINGS MODAL
// ═══════════════════════════════════════════════════════

function openNotificationSettingsModal() {
    closeServerDropdown();
    var modal = new bootstrap.Modal(document.getElementById('notificationSettingsModal'));
    modal.show();
}

function saveNotificationSettings() {
    // Preferences stored locally per-server
    const key = 'dwt-notif-' + (currentServerId || 'global');
    const prefs = {
        muteAll: document.getElementById('notifMuteAll').checked,
        muteEveryone: document.getElementById('notifMuteEveryone').checked,
        muteRoles: document.getElementById('notifMuteRoles').checked
    };
    localStorage.setItem(key, JSON.stringify(prefs));
    
    bootstrap.Modal.getInstance(document.getElementById('notificationSettingsModal')).hide();
}
