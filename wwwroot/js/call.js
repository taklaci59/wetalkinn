let isCalling = false;
window.voiceState = {
    inVoiceRoom: false,
    activeVoiceChannelId: null,
    activeVoiceChannelName: null,
    localStream: null,
    screenStream: null
};
let isMicMuted = false;
let isDeafened = false;
let localStream = null;
let peerConnection = null;
let callStartTime = null;
let timerInterval = null;

const ringtone = document.getElementById('ringtone');
const callingSound = document.getElementById('calling_sound');

// WebRTC Ayarları (Google'ın ücretsiz STUN sunucusu)
const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// --- MİKROFON VE MEDYA ERİŞİMİ ---
async function setupLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (localStream) {
            localStream.getAudioTracks()[0].enabled = !isMicMuted;
        }
        return true;
    } catch (err) {
        console.error("Mikrofon izni alınamadı:", err);
        showToast("Mikrofon izni verilmediği için sesli arama yapılamıyor.", "danger");
        return false;
    }
}

// --- PEER CONNECTION (WebRTC) KURULUMU ---
function createPeerConnection(target) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Kendi sesimizi bağlantıya ekle
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Karşıdan ses geldiğinde hoparlöre ver
    peerConnection.ontrack = (event) => {
        let remoteAudio = document.getElementById('remoteAudioPlayer');
        if (!remoteAudio) {
            remoteAudio = document.createElement('audio');
            remoteAudio.id = 'remoteAudioPlayer';
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
        }
        remoteAudio.srcObject = event.streams[0];
    };

    // Bağlantı adaylarını (ICE) karşıya bildir
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            connection.invoke("SendIceCandidate", target, event.candidate);
        }
    };

    return peerConnection;
}

// --- SESLİ ODA GİRİŞİ (DISCORD STYLE) ---
window.enterVoiceRoom = async function (channelId, channelName) {
    if (!channelId) return;

    // Prevent duplicate joins
    if (
        window.voiceState.inVoiceRoom &&
        window.voiceState.activeVoiceChannelId === channelId.toString()
    ) {
        return;
    }

    try {
        // Attempt local media but proceed even if failed
        await setupLocalMedia();

        // Join via SignalR
        if (typeof connection !== 'undefined') {
            await connection.invoke("JoinVoiceChannel", channelId.toString()).catch(e => console.error("[SignalR Join Error]", e));
        }

        // Update global state
        window.voiceState.inVoiceRoom = true;
        window.voiceState.activeVoiceChannelId = channelId.toString();
        window.voiceState.activeVoiceChannelName = channelName || null;

        console.log("[Voice] Joined channel:", window.voiceState);

        startTimer();

    } catch (err) {
        console.error("[Voice] Failed to join channel:", err);
    }
};

// --- ARAMA BAŞLATMA (1-to-1) ---
async function startVoiceCall() {
    const targetUser = document.getElementById('chatHeaderName').innerText;
    if (targetUser === "Sohbet" || targetUser === "" || isCalling) return;

    if (!(await setupLocalMedia())) return;

    isCalling = true;
    showCallNotification(targetUser, "Aranıyor...", false);

    callingSound.currentTime = 0;
    callingSound.play().catch(e => console.error("Ses çalınamadı:", e));

    const pc = createPeerConnection(targetUser);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    connection.invoke("SendCallRequest", targetUser);
    connection.invoke("SendOffer", targetUser, offer);
}

// --- SIGNALR DİNLEYİCİLERİ ---
connection.on("ReceiveCall", function (fromUser) {
    if (isCalling || window.voiceState.inVoiceRoom) return;
    showCallNotification(fromUser, "Seni arıyor...", true);
    ringtone.currentTime = 0;
    ringtone.play().catch(e => console.error("Zil sesi çalınamadı:", e));
});

connection.on("ReceiveOffer", async (fromUser, offer) => {
    if (!(await setupLocalMedia())) return;

    const pc = createPeerConnection(fromUser);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    connection.invoke("SendAnswer", fromUser, answer);
});

connection.on("ReceiveAnswer", async (fromUser, answer) => {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

connection.on("ReceiveIceCandidate", async (fromUser, candidate) => {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
    }
});

connection.on("CallAccepted", function (acceptingUser) {
    stopAllSounds();
    setupActiveCallUI(acceptingUser);
});

connection.on("CallEnded", function () {
    resetCallUI();
});

connection.on("ReceiveMediaStatus", function (user, micMuted, deafened) {
    updateRemoteParticipantUI(micMuted, deafened);
});

// --- KONTROL VE UI FONKSİYONLARI ---
function acceptCall() {
    const caller = document.getElementById('callName').innerText;
    stopAllSounds();
    setupActiveCallUI(caller);
    connection.invoke("AcceptCallRequest", caller).catch(err => console.error(err));
}

window.endCall = function() {
    if (isCalling) {
        const target = document.getElementById('sidebarTargetName')?.innerText || document.getElementById('callName')?.innerText || '';
        if (target) {
            connection.invoke("DeclineOrEndCall", target).catch(err => console.error(err));
        }
    }
    resetCallUI();
}

window.resetCallUI = async function() {
    console.log("[Voice] Resetting call state.");

    if (window.voiceState && window.voiceState.screenStream) {
        await window.stopScreenShare();
    }

    stopAllSounds();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    const remoteAudio = document.getElementById('remoteAudioPlayer');
    if (remoteAudio) remoteAudio.remove();
    
    // 1. Notify Server (MUST happen while inVoiceRoom is still true)
    if (window.voiceState) {     
        const cid = window.voiceState.activeVoiceChannelId;
        if (window.voiceState.inVoiceRoom && cid) {
            connection.invoke("LeaveVoiceChannel", cid.toString()).catch(e => console.error(e));
            
            // Optimistic UI: Remove myself from the sidebar immediately
            if (typeof handleUserLeftVoiceSidebar === 'function') {
                handleUserLeftVoiceSidebar(null, cid); 
            }
        }
    }

    // 2. Reset local flags
    isCalling = false;
    stopTimer();

    if (window.voiceState) {     
        window.voiceState.inVoiceRoom = false;
        window.voiceState.activeVoiceChannelId = null;
        window.voiceState.activeVoiceChannelName = null;
    }
    
    // 3. UI Resets
    document.getElementById('callScreen')?.classList.remove('active');
    document.getElementById('voicePanelSidebar')?.classList.remove('active');
    document.getElementById('voiceContainerDm')?.classList.remove('active');

    // Reset footer status
    const footerStatus = document.querySelector('.voice-connection-status');
    if (footerStatus) footerStatus.innerHTML = '<i class="bi bi-broadcast text-danger me-1"></i> Ses Bağlantısı Kesildi';
    document.getElementById('voiceSidebarChannelName').innerText = 'Kanal Seçilmedi';

    console.log("[Voice] State reset completed.");
};

function showCallNotification(name, status, isIncoming) {
    const screen = document.getElementById('callScreen');
    document.getElementById('callName').innerText = name;
    document.getElementById('callStatusText').innerText = status;
    document.getElementById('btnAnswer').style.display = isIncoming ? 'flex' : 'none';
    screen.classList.add('active');
}

function setupActiveCallUI(targetUser) {
    isCalling = true;
    document.getElementById('callScreen').classList.remove('active');

    const sidebarPanel = document.getElementById('voicePanelSidebar');
    if (sidebarPanel) {
        sidebarPanel.classList.add('active');
        document.getElementById('voiceSidebarChannelName').innerText = targetUser;
        document.querySelector('.voice-connection-status').innerHTML = '<i class="bi bi-broadcast text-success me-1"></i> Ses Bağlı';
    }

    const dmPanel = document.getElementById('voiceContainerDm');
    if (dmPanel) {
        dmPanel.classList.add('active');
        const remoteAvatar = document.getElementById('dmRemoteAvatar');
        if (remoteAvatar) remoteAvatar.innerText = targetUser[0].toUpperCase();
    }

    startTimer();
}
function toggleMic() {
    isMicMuted = !isMicMuted;
    if (localStream) {
        localStream.getAudioTracks()[0].enabled = !isMicMuted;
    }

    // Update Sidebar
    const btnSidebar = document.getElementById('btnMicSidebar');
    if (btnSidebar) btnSidebar.classList.toggle('active', isMicMuted);

    // Update DM Panel (Legacy)
    const btnDm = document.getElementById('btnMicDm');
    if (btnDm) btnDm.classList.toggle('active', isMicMuted);
    const myMicBadge = document.getElementById('myMicBadge');
    if (myMicBadge) myMicBadge.style.display = isMicMuted ? 'flex' : 'none';

    sendMediaUpdate();
}

function toggleDeafen() {
    isDeafened = !isDeafened;
    const remoteAudio = document.getElementById('remoteAudioPlayer');
    if (remoteAudio) remoteAudio.muted = isDeafened;

    // Update Sidebar
    const btnSidebar = document.getElementById('btnDeafenSidebar');
    if (btnSidebar) btnSidebar.classList.toggle('active', isDeafened);

    // Update DM Panel (Legacy)
    const btnDm = document.getElementById('btnDeafenDm');
    if (btnDm) btnDm.classList.toggle('active', isDeafened);

    if (isDeafened && !isMicMuted) toggleMic();
    sendMediaUpdate();
}



function sendMediaUpdate() {
    const target = document.getElementById('voiceSidebarChannelName').innerText;
    if (target && target !== "Kanal Seçilmedi" && !window.voiceState.inVoiceRoom) {
        connection.invoke("ToggleMedia", target, isMicMuted, isDeafened).catch(err => console.error(err));
    }
}

// --- EKRAN PAYLAŞIMI (SCREEN SHARE) ---
window.toggleScreenShare = async function () {
    const { inVoiceRoom, activeVoiceChannelId } = window.voiceState;

    console.log("[ScreenShare] Attempting to toggle", window.voiceState);

    if (!inVoiceRoom || !activeVoiceChannelId) {
        alert("Önce bir ses kanalına katılmalısın.");
        console.warn("[ScreenShare] Blocked: Not in a voice channel.");
        return;
    }

    try {
        if (!window.voiceState.screenStream) {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            window.voiceState.screenStream = stream;

            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                window.stopScreenShare();
            };

            // Replace or add track to each RTCPeerConnection if available
            Object.values(window.peerConnections || {}).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === "video");
                if (sender) {
                    sender.replaceTrack(videoTrack);
                } else {
                    pc.addTrack(videoTrack, stream);
                }
            });

            // Sync visual button state
            const btnSidebar = document.getElementById('btnScreenShareSidebar');
            if (btnSidebar) btnSidebar.classList.add('text-success');

            if (typeof connection !== 'undefined') {
                await connection.invoke(
                    "StartScreenShare",
                    activeVoiceChannelId.toString()
                );
            }

            console.log("[ScreenShare] Started.");
        } else {
            await window.stopScreenShare();
        }
    } catch (err) {
        console.error("[ScreenShare] Error:", err);
    }
};

window.stopScreenShare = async function () {
    const { screenStream, activeVoiceChannelId } = window.voiceState;

    if (!screenStream) return;

    screenStream.getTracks().forEach(track => track.stop());
    window.voiceState.screenStream = null;

    // Update UI Button
    const btnSidebar = document.getElementById('btnScreenShareSidebar');
    if (btnSidebar) btnSidebar.classList.remove('text-success');

    if (typeof connection !== 'undefined' && activeVoiceChannelId) {
        await connection.invoke(
            "StopScreenShare",
            activeVoiceChannelId.toString()
        );
    }

    console.log("[ScreenShare] Stopped.");
};


function updateRemoteParticipantUI(mic, deaf) {
    // For 1-to-1 Calls
    const remoteMicBadge = document.getElementById('remoteMicBadge');
    const remoteDeafBadge = document.getElementById('remoteDeafBadge');
    if (remoteMicBadge) remoteMicBadge.style.display = mic ? 'flex' : 'none';
    if (remoteDeafBadge) remoteDeafBadge.style.display = deaf ? 'flex' : 'none';
}

function startTimer() {
    callStartTime = Date.now();
    const timerDisplay = document.getElementById('callTimer');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const delta = Date.now() - callStartTime;
        const minutes = Math.floor(delta / 60000);
        const seconds = Math.floor((delta % 60000) / 1000);
        if (timerDisplay) timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const timerDisplay = document.getElementById('callTimer');
    if (timerDisplay) timerDisplay.innerText = "0:00";
}

function stopAllSounds() {
    if (ringtone) { ringtone.pause(); ringtone.currentTime = 0; }
    if (callingSound) { callingSound.pause(); callingSound.currentTime = 0; }
}

function startVideoCall() { startVoiceCall(); }