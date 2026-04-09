let isCalling = false;
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
        return true;
    } catch (err) {
        console.error("Mikrofon izni alınamadı:", err);
        alert("Mikrofon izni verilmediği için sesli arama yapılamıyor.");
        return false;
    }
}

// --- PEER CONNECTION (WebRTC) KURULUMU ---
function createPeerConnection(targetUser) {
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
            connection.invoke("SendIceCandidate", targetUser, event.candidate);
        }
    };

    return peerConnection;
}

// --- ARAMA BAŞLATMA ---
async function startVoiceCall() {
    const targetUser = document.getElementById('chatHeaderName').innerText;
    if (targetUser === "Sohbet" || targetUser === "" || isCalling) return;

    if (!(await setupLocalMedia())) return;

    isCalling = true;
    showCallNotification(targetUser, "Aranıyor...", false);

    callingSound.currentTime = 0;
    callingSound.play().catch(e => console.error("Ses çalınamadı:", e));

    // WebRTC Offer Oluştur
    const pc = createPeerConnection(targetUser);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    connection.invoke("SendCallRequest", targetUser);
    connection.invoke("SendOffer", targetUser, offer);
}

// --- SIGNALR DİNLEYİCİLERİ ---
connection.on("ReceiveCall", function (fromUser) {
    if (isCalling) return;
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

function endCall() {
    const target = isCalling ?
        document.getElementById('sidebarTargetName').innerText :
        document.getElementById('callName').innerText;

    connection.invoke("DeclineOrEndCall", target).catch(err => console.error(err));
    resetCallUI();
}

function resetCallUI() {
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

    isCalling = false;
    stopTimer();
    document.getElementById('callScreen').classList.remove('active');
    document.getElementById('voicePanelSidebar')?.classList.remove('active');
    document.getElementById('voiceContainerDm')?.classList.remove('active');
}

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
        document.getElementById('sidebarTargetName').innerText = targetUser;
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

    const btnSidebar = document.getElementById('btnMicSidebar');
    const btnDm = document.getElementById('btnMicDm');
    if (btnSidebar) btnSidebar.classList.toggle('active', isMicMuted);
    if (btnDm) btnDm.classList.toggle('active', isMicMuted);

    const myMicBadge = document.getElementById('myMicBadge');
    if (myMicBadge) myMicBadge.style.display = isMicMuted ? 'flex' : 'none';

    sendMediaUpdate();
}

function toggleDeafen() {
    isDeafened = !isDeafened;
    const remoteAudio = document.getElementById('remoteAudioPlayer');
    if (remoteAudio) remoteAudio.muted = isDeafened;

    const btnSidebar = document.getElementById('btnDeafenSidebar');
    const btnDm = document.getElementById('btnDeafenDm');
    if (btnSidebar) btnSidebar.classList.toggle('active', isDeafened);
    if (btnDm) btnDm.classList.toggle('active', isDeafened);

    if (isDeafened && !isMicMuted) toggleMic();
    sendMediaUpdate();
}

function sendMediaUpdate() {
    const target = document.getElementById('sidebarTargetName').innerText;
    if (target && target !== "Kullanıcı") {
        connection.invoke("ToggleMedia", target, isMicMuted, isDeafened).catch(err => console.error(err));
    }
}

function updateRemoteParticipantUI(mic, deaf) {
    const remoteMicBadge = document.getElementById('remoteMicBadge');
    const remoteDeafBadge = document.getElementById('remoteDeafBadge');
    if (remoteMicBadge) remoteMicBadge.style.display = mic ? 'flex' : 'none';
    if (remoteDeafBadge) remoteDeafBadge.style.display = deaf ? 'flex' : 'none';
}

function startTimer() {
    callStartTime = Date.now();
    const timerDisplay = document.getElementById('callTimer');
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
    ringtone.pause(); ringtone.currentTime = 0;
    callingSound.pause(); callingSound.currentTime = 0;
}

function startVideoCall() { startVoiceCall(); }