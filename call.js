// WebRTC Calling with PeerJS
let peer = null;
let currentCall = null;
let localStream = null;
let remoteStream = null;
let callTimer = null;
let callStartTime = null;

// Initialize PeerJS
function initializePeer() {
    if (!currentUser) {
        debugLog("Cannot initialize PeerJS: no current user");
        return null;
    }
    
    try {
        // Generate a unique peer ID from user ID
        const peerId = 'anonchat_' + currentUser.uid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
        
        debugLog("Initializing PeerJS with ID:", peerId);
        
        // Initialize PeerJS
        const peerInstance = new Peer(peerId, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            debug: 2
        });
        
        return peerInstance;
        
    } catch (error) {
        console.error("Error initializing PeerJS:", error);
        return null;
    }
}

// Initialize Calling Features
function initializeCallFeatures() {
    debugLog("Initializing call features");
    
    if (!currentUser) {
        debugLog("No current user, cannot initialize call features");
        return;
    }
    
    // Initialize PeerJS
    setTimeout(() => {
        peer = initializePeer();
        if (peer) {
            setupPeerListeners();
        }
    }, 2000);
    
    // Call control buttons
    const endCallBtn = document.getElementById('endCallBtn');
    const muteBtn = document.getElementById('muteBtn');
    const videoToggleBtn = document.getElementById('videoToggleBtn');
    
    if (endCallBtn) {
        endCallBtn.addEventListener('click', endCurrentCall);
    }
    
    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }
    
    if (videoToggleBtn) {
        videoToggleBtn.addEventListener('click', toggleVideo);
    }
    
    // Incoming call buttons
    const acceptCallBtn = document.getElementById('acceptCallBtn');
    const rejectCallBtn = document.getElementById('rejectCallBtn');
    
    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', acceptIncomingCall);
    }
    
    if (rejectCallBtn) {
        rejectCallBtn.addEventListener('click', rejectIncomingCall);
    }
    
    debugLog("Call features initialized");
}

// Setup PeerJS Listeners
function setupPeerListeners() {
    if (!peer) {
        debugLog("Cannot setup PeerJS listeners: peer not initialized");
        return;
    }
    
    debugLog("Setting up PeerJS listeners");
    
    peer.on('open', (id) => {
        debugLog("PeerJS connected with ID:", id);
        updatePeerId(id);
    });
    
    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
    });
    
    peer.on('call', handleIncomingCall);
    
    // Listen for call offers via Firebase
    listenForCallOffers();
}

// Update Peer ID in Firebase
function updatePeerId(peerId) {
    if (!currentUser) return;
    
    const userRef = database.ref('users/' + currentUser.uid);
    userRef.update({
        peerId: peerId
    }).then(() => {
        debugLog("Peer ID saved to Firebase");
    }).catch(error => {
        console.error("Error saving peer ID:", error);
    });
}

// Listen for Call Offers via Firebase
function listenForCallOffers() {
    if (!currentUser) return;
    
    debugLog("Setting up Firebase call offer listener");
    
    const callsRef = database.ref('calls/' + currentUser.uid);
    callsRef.on('value', (snapshot) => {
        const callData = snapshot.val();
        if (callData && !currentCall) {
            debugLog("Incoming call offer received:", callData);
            showIncomingCallModal(callData);
        }
    });
}

// Show Incoming Call Modal
async function showIncomingCallModal(callData) {
    debugLog("Showing incoming call modal");
    
    const modal = document.getElementById('incomingCallModal');
    const callerNameEl = document.getElementById('callerName');
    const callerPhotoEl = document.getElementById('callerPhoto');
    const callerTypeEl = document.getElementById('callerType');
    
    if (!modal) return;
    
    try {
        // Get caller info
        const callerRef = database.ref('users/' + callData.from);
        const snapshot = await callerRef.once('value');
        
        if (snapshot.exists()) {
            const caller = snapshot.val();
            
            if (callerNameEl) {
                callerNameEl.textContent = caller.name || caller.username || 'Anonymous';
            }
            
            if (callerPhotoEl) {
                const avatarUrl = caller.photo || generateAvatarUrl(caller.name || caller.username);
                callerPhotoEl.src = avatarUrl;
                callerPhotoEl.onerror = function() {
                    this.src = generateAvatarUrl(caller.name?.charAt(0) || caller.username?.charAt(0) || 'U');
                };
            }
            
            if (callerTypeEl) {
                callerTypeEl.textContent = callData.type === 'video' ? 'Video Call' : 'Voice Call';
            }
        }
        
        // Store call data
        modal.dataset.callFrom = callData.from;
        modal.dataset.callType = callData.type;
        modal.dataset.callId = callData.callId;
        
        // Show modal
        modal.style.display = 'flex';
        
        // Auto-reject after 45 seconds
        setTimeout(() => {
            if (modal.style.display === 'flex') {
                debugLog("Auto-rejecting unanswered call");
                rejectIncomingCall();
            }
        }, 45000);
        
    } catch (error) {
        console.error('Error showing incoming call:', error);
    }
}

// Accept Incoming Call
async function acceptIncomingCall() {
    debugLog("Accepting incoming call");
    
    const modal = document.getElementById('incomingCallModal');
    if (!modal) return;
    
    const callFrom = modal.dataset.callFrom;
    const callType = modal.dataset.callType;
    const callId = modal.dataset.callId;
    
    // Hide modal
    modal.style.display = 'none';
    
    // Clear call offer from Firebase
    try {
        const callRef = database.ref('calls/' + currentUser.uid);
        await callRef.remove();
        debugLog("Call offer cleared from Firebase");
    } catch (error) {
        console.error("Error clearing call offer:", error);
    }
    
    // Start the call
    await startCall(callFrom, callType, false, callId);
}

// Reject Incoming Call
async function rejectIncomingCall() {
    debugLog("Rejecting incoming call");
    
    const modal = document.getElementById('incomingCallModal');
    if (!modal) return;
    
    const callFrom = modal.dataset.callFrom;
    const callId = modal.dataset.callId;
    
    // Hide modal
    modal.style.display = 'none';
    
    // Send rejection via Firebase
    try {
        const callRef = database.ref('callResponses/' + callFrom);
        await callRef.set({
            callId: callId,
            accepted: false,
            reason: 'rejected',
            timestamp: Date.now()
        });
        debugLog("Call rejection sent to caller");
    } catch (error) {
        console.error("Error sending rejection:", error);
    }
    
    // Clear call offer
    try {
        const myCallRef = database.ref('calls/' + currentUser.uid);
        await myCallRef.remove();
        debugLog("Call offer cleared");
    } catch (error) {
        console.error("Error clearing call offer:", error);
    }
}

// Initiate Call
function initiatePeerCall(userId, type) {
    debugLog("Initiating call to:", userId, "Type:", type);
    
    if (!peer) {
        debugLog("PeerJS not initialized");
        alert('Call system not ready yet. Please try again.');
        return;
    }
    
    if (currentCall) {
        alert('You already have an active call');
        return;
    }
    
    if (!currentUser) {
        alert('Please log in to make calls');
        return;
    }
    
    // Generate unique call ID
    const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    debugLog("Generated call ID:", callId);
    
    // Send call offer via Firebase
    sendCallOffer(userId, type, callId);
}

// Send Call Offer
async function sendCallOffer(userId, type, callId) {
    try {
        // Get recipient info
        const recipientRef = database.ref('users/' + userId);
        const snapshot = await recipientRef.once('value');
        
        if (!snapshot.exists()) {
            alert('User not found');
            return;
        }
        
        const recipient = snapshot.val();
        
        if (!recipient.online) {
            alert('User is offline');
            return;
        }
        
        // Send call offer via Firebase
        const callRef = database.ref('calls/' + userId);
        await callRef.set({
            from: currentUser.uid,
            fromName: currentUsername || 'Anonymous',
            type: type,
            callId: callId,
            timestamp: Date.now()
        });
        
        debugLog("Call offer sent to:", userId);
        
        // Show calling interface
        showCallInterface(type, 'Calling...', true);
        
        // Listen for response
        listenForCallResponse(callId, userId, type);
        
    } catch (error) {
        console.error("Error sending call offer:", error);
        alert('Failed to initiate call. Please try again.');
        hideCallInterface();
    }
}

// Listen for Call Response
function listenForCallResponse(callId, userId, type) {
    const responseRef = database.ref('callResponses/' + currentUser.uid);
    const responseListener = responseRef.on('value', async (snapshot) => {
        const response = snapshot.val();
        if (response && response.callId === callId) {
            debugLog("Call response received:", response);
            
            // Remove listener
            responseRef.off('value', responseListener);
            
            // Clear response
            await responseRef.remove();
            
            if (response.accepted) {
                debugLog("Call accepted by recipient");
                // Start the call
                await startCall(userId, type, true, callId);
            } else {
                debugLog("Call rejected by recipient");
                hideCallInterface();
                alert('Call was rejected');
            }
        }
    });
    
    // Auto-cancel after 45 seconds
    setTimeout(async () => {
        if (!currentCall) {
            debugLog("Call timeout - no answer");
            const callRef = database.ref('calls/' + userId);
            await callRef.remove();
            hideCallInterface();
            alert('No answer from user');
        }
    }, 45000);
}

// Start Call
async function startCall(userId, type, isInitiator, callId) {
    debugLog("Starting call:", { userId, type, isInitiator, callId });
    
    if (currentCall) {
        alert('You already have an active call');
        return;
    }
    
    try {
        // Get user's media
        const constraints = {
            audio: true,
            video: type === 'video'
        };
        
        debugLog("Requesting media with constraints:", constraints);
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        debugLog("Media access granted");
        
        // Show call interface
        showCallInterface(type, '00:00', false);
        
        // Setup local video
        const localVideo = document.getElementById('localVideo');
        if (localVideo && type === 'video') {
            localVideo.srcObject = localStream;
        }
        
        if (isInitiator) {
            // We are initiating the call
            debugLog("Initiating call as caller");
            
            const recipientRef = database.ref('users/' + userId);
            const snapshot = await recipientRef.once('value');
            
            if (snapshot.exists()) {
                const recipient = snapshot.val();
                
                if (recipient.peerId) {
                    debugLog("Calling recipient with Peer ID:", recipient.peerId);
                    
                    // Call the recipient via PeerJS
                    currentCall = peer.call(recipient.peerId, localStream, {
                        metadata: {
                            type: type,
                            callId: callId
                        }
                    });
                    
                    setupCallListeners();
                } else {
                    throw new Error('Recipient not available for calls');
                }
            }
        }
        // If not initiator, we handle the call in handleIncomingCall
        
    } catch (error) {
        console.error('Error starting call:', error);
        alert('Failed to start call: ' + error.message);
        endCurrentCall();
    }
}

// Handle Incoming Call via PeerJS
async function handleIncomingCall(incomingCall) {
    debugLog("Incoming PeerJS call received");
    
    if (currentCall) {
        debugLog("Already in a call, rejecting new call");
        incomingCall.close();
        return;
    }
    
    try {
        // Get metadata
        const metadata = incomingCall.metadata || {};
        
        // Get local media
        const constraints = {
            audio: true,
            video: metadata.type === 'video'
        };
        
        debugLog("Requesting media for incoming call");
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        debugLog("Media access granted for incoming call");
        
        // Show call interface
        showCallInterface(metadata.type || 'audio', '00:00', false);
        
        // Setup local video
        const localVideo = document.getElementById('localVideo');
        if (localVideo && metadata.type === 'video') {
            localVideo.srcObject = localStream;
        }
        
        // Answer the call
        currentCall = incomingCall;
        incomingCall.answer(localStream);
        debugLog("Call answered");
        
        setupCallListeners();
        
    } catch (error) {
        console.error('Error handling incoming call:', error);
        alert('Failed to answer call: ' + error.message);
        endCurrentCall();
    }
}

// Setup Call Listeners
function setupCallListeners() {
    if (!currentCall) {
        debugLog("Cannot setup call listeners: no active call");
        return;
    }
    
    debugLog("Setting up call listeners");
    
    currentCall.on('stream', (stream) => {
        debugLog("Remote stream received");
        remoteStream = stream;
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            remoteVideo.srcObject = stream;
        }
        
        // Start call timer
        startCallTimer();
    });
    
    currentCall.on('close', () => {
        debugLog("Call closed by remote party");
        endCurrentCall();
    });
    
    currentCall.on('error', (error) => {
        console.error('Call error:', error);
        endCurrentCall();
    });
}

// Show Call Interface
function showCallInterface(type, duration, isCalling) {
    debugLog("Showing call interface:", { type, duration, isCalling });
    
    const callInterface = document.getElementById('callInterface');
    const callType = document.getElementById('callType');
    const callDuration = document.getElementById('callDuration');
    
    if (callInterface) {
        callInterface.style.display = 'block';
        
        if (callType) {
            callType.textContent = type === 'video' ? 'Video Call' : 'Voice Call';
        }
        
        if (callDuration) {
            callDuration.textContent = duration;
        }
        
        // Show/hide video elements
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (localVideo) {
            localVideo.style.display = type === 'video' ? 'block' : 'none';
        }
        
        if (remoteVideo) {
            remoteVideo.style.display = type === 'video' ? 'block' : 'none';
        }
    }
}

// Hide Call Interface
function hideCallInterface() {
    debugLog("Hiding call interface");
    
    const callInterface = document.getElementById('callInterface');
    if (callInterface) {
        callInterface.style.display = 'none';
    }
}

// Start Call Timer
function startCallTimer() {
    callStartTime = Date.now();
    
    if (callTimer) {
        clearInterval(callTimer);
    }
    
    callTimer = setInterval(() => {
        if (callStartTime) {
            const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            const callDuration = document.getElementById('callDuration');
            if (callDuration) {
                callDuration.textContent = 
                    minutes.toString().padStart(2, '0') + ':' + 
                    seconds.toString().padStart(2, '0');
            }
        }
    }, 1000);
    
    debugLog("Call timer started");
}

// End Current Call
async function endCurrentCall() {
    debugLog("Ending current call");
    
    // Stop call timer
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    
    // Close PeerJS call
    if (currentCall) {
        try {
            currentCall.close();
        } catch (error) {
            console.warn("Error closing call:", error);
        }
        currentCall = null;
    }
    
    // Stop local media streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Stop remote media streams
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    // Clear video elements
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    
    if (localVideo) {
        localVideo.srcObject = null;
    }
    
    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }
    
    // Hide interface
    hideCallInterface();
    
    // Clear any pending call offers/responses
    if (currentUser) {
        try {
            const callsRef = database.ref('calls/' + currentUser.uid);
            await callsRef.remove();
            
            const responsesRef = database.ref('callResponses/' + currentUser.uid);
            await responsesRef.remove();
        } catch (error) {
            console.error("Error clearing Firebase call data:", error);
        }
    }
}

// Toggle Mute
function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        const isMuted = !audioTracks[0].enabled;
        audioTracks[0].enabled = isMuted;
        
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

// Toggle Video
function toggleVideo() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        const isEnabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = isEnabled;
        
        const videoToggleBtn = document.getElementById('videoToggleBtn');
        if (videoToggleBtn) {
            videoToggleBtn.innerHTML = isEnabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        }
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.display = isEnabled ? 'block' : 'none';
        }
    }
}