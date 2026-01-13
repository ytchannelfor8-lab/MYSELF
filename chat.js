// Chat Management
let currentChatPartner = null;
let messagesRef = null;
let typingRef = null;
let typingTimeout = null;

// Initialize Chat Features
function initializeChatFeatures() {
    debugLog("Initializing chat features");
    
    if (!currentUser) {
        debugLog("No current user, cannot initialize chat");
        return;
    }
    
    // User Search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', handleUserSearch);
        debugLog("User search initialized");
    }
    
    const clearSearch = document.getElementById('clearSearch');
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            if (userSearch) {
                userSearch.value = '';
                loadContacts();
            }
        });
    }
    
    // Message Input
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (messageInput) {
        messageInput.addEventListener('input', handleTyping);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        debugLog("Message input initialized");
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
        debugLog("Send button initialized");
    }
    
    // Attachment Buttons
    const attachBtn = document.getElementById('attachBtn');
    const imageUpload = document.getElementById('imageUpload');
    const audioUpload = document.getElementById('audioUpload');
    const recordBtn = document.getElementById('recordBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    
    if (attachBtn && imageUpload) {
        attachBtn.addEventListener('click', () => imageUpload.click());
    }
    
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }
    
    if (audioUpload) {
        audioUpload.addEventListener('change', handleAudioUpload);
    }
    
    if (recordBtn) {
        recordBtn.addEventListener('click', toggleAudioRecording);
    }
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', () => {
            alert('Emoji picker will be implemented in future update!');
        });
    }
    
    // New Chat Button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            const userSearch = document.getElementById('userSearch');
            if (userSearch) {
                userSearch.focus();
            }
        });
    }
    
    // Load initial data
    setTimeout(() => {
        loadContacts();
        loadRecentChats();
    }, 1000);
    
    debugLog("Chat features initialized");
}

// Load Contacts
async function loadContacts() {
    const searchQuery = document.getElementById('userSearch')?.value?.toLowerCase().trim() || '';
    const contactsList = document.getElementById('contactsList');
    
    if (!contactsList || !currentUser) {
        debugLog("Cannot load contacts: missing elements or user");
        return;
    }
    
    debugLog("Loading contacts, search query:", searchQuery);
    
    try {
        const usersRef = database.ref('users');
        const snapshot = await usersRef.once('value');
        
        if (!snapshot.exists()) {
            contactsList.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No users found</p></div>';
            debugLog("No users found in database");
            return;
        }
        
        const users = [];
        snapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            if (user.uid !== currentUser.uid) {
                users.push(user);
            }
        });
        
        // Filter by search query
        const filteredUsers = searchQuery ? 
            users.filter(user => 
                (user.username && user.username.toLowerCase().includes(searchQuery)) ||
                (user.name && user.name.toLowerCase().includes(searchQuery)) ||
                (user.email && user.email.toLowerCase().includes(searchQuery))
            ) : users;
        
        // Sort by online status, then alphabetically
        filteredUsers.sort((a, b) => {
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            const nameA = (a.name || a.username || '').toLowerCase();
            const nameB = (b.name || b.username || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        // Update online count
        const onlineCount = users.filter(u => u.online).length;
        const onlineCountEl = document.getElementById('onlineCount');
        if (onlineCountEl) {
            onlineCountEl.textContent = `${onlineCount} online`;
        }
        
        // Render contacts
        if (filteredUsers.length === 0) {
            contactsList.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No users found matching your search</p></div>';
            return;
        }
        
        contactsList.innerHTML = '';
        filteredUsers.forEach(user => {
            const contactItem = createContactItem(user);
            contactsList.appendChild(contactItem);
        });
        
        debugLog(`Loaded ${filteredUsers.length} contacts`);
        
    } catch (error) {
        console.error('Error loading contacts:', error);
        contactsList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading contacts</p></div>';
    }
}

// Create Contact Item
function createContactItem(user) {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.userId = user.uid;
    div.dataset.username = user.username;
    
    const displayName = user.name || user.username || 'Anonymous';
    const avatarUrl = user.photo || generateAvatarUrl(displayName);
    
    // Format status
    let statusText = user.online ? 'Online' : 'Offline';
    let statusClass = user.online ? 'online' : 'offline';
    
    if (!user.online && user.lastSeen) {
        statusText = 'Last seen ' + formatTimestamp(user.lastSeen);
    }
    
    div.innerHTML = `
        <img src="${avatarUrl}" 
             alt="${displayName}"
             onerror="this.src='${generateAvatarUrl(displayName.charAt(0))}'">
        <div class="contact-info">
            <h4>${displayName}</h4>
            <p>@${user.username || 'user'}</p>
        </div>
        <div class="contact-status">
            <span class="status ${statusClass}">
                ${statusText}
            </span>
        </div>
    `;
    
    div.addEventListener('click', () => openChat(user));
    return div;
}

// Load Recent Chats
async function loadRecentChats() {
    const chatsList = document.getElementById('chatsList');
    if (!chatsList || !currentUser) {
        debugLog("Cannot load chats: missing elements or user");
        return;
    }
    
    try {
        const userChatsRef = database.ref('userChats/' + currentUser.uid);
        const snapshot = await userChatsRef.orderByChild('time').limitToLast(20).once('value');
        
        if (!snapshot.exists()) {
            debugLog("No recent chats found");
            return;
        }
        
        const chatPromises = [];
        snapshot.forEach((childSnapshot) => {
            const chatId = childSnapshot.key;
            const lastMessage = childSnapshot.val();
            chatPromises.push(loadChatInfo(chatId, lastMessage));
        });
        
        const chatItems = await Promise.all(chatPromises);
        chatsList.innerHTML = '';
        
        // Sort by last message time (newest first)
        chatItems.sort((a, b) => {
            if (!a || !b) return 0;
            return b.lastMessageTime - a.lastMessageTime;
        });
        
        // Filter out null items and add to list
        let hasChats = false;
        chatItems.forEach(item => {
            if (item) {
                chatsList.appendChild(createChatItem(item));
                hasChats = true;
            }
        });
        
        if (!hasChats) {
            chatsList.innerHTML = '<div class="empty-state"><i class="fas fa-comment-dots"></i><p>No conversations yet</p></div>';
        }
        
        debugLog(`Loaded ${chatItems.filter(i => i).length} recent chats`);
        
    } catch (error) {
        console.error('Error loading recent chats:', error);
        chatsList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading chats</p></div>';
    }
}

// Load Chat Info
async function loadChatInfo(chatId, lastMessage) {
    try {
        if (!chatId || !currentUser) return null;
        
        // Get partner ID from chat ID
        const ids = chatId.split('_');
        const partnerId = ids.find(id => id !== currentUser.uid);
        if (!partnerId) return null;
        
        // Get partner info
        const userRef = database.ref('users/' + partnerId);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) return null;
        
        const partner = snapshot.val();
        const unread = lastMessage?.seen === false && lastMessage?.sender !== currentUser.uid;
        
        return {
            partner,
            lastMessage,
            lastMessageTime: lastMessage?.time || 0,
            unread: unread
        };
        
    } catch (error) {
        console.error('Error loading chat info:', error);
        return null;
    }
}

// Create Chat Item
function createChatItem(chatInfo) {
    if (!chatInfo || !chatInfo.partner) return null;
    
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.userId = chatInfo.partner.uid;
    div.dataset.username = chatInfo.partner.username;
    
    const displayName = chatInfo.partner.name || chatInfo.partner.username || 'Anonymous';
    
    // Format last message text
    let lastMessageText = '';
    if (chatInfo.lastMessage) {
        switch (chatInfo.lastMessage.type) {
            case 'text':
                lastMessageText = chatInfo.lastMessage.text || '';
                break;
            case 'image':
                lastMessageText = '📷 Image';
                break;
            case 'audio':
                lastMessageText = '🎤 Voice message';
                break;
            default:
                lastMessageText = '📎 Attachment';
        }
        
        // Truncate long text
        if (lastMessageText.length > 30) {
            lastMessageText = lastMessageText.substring(0, 30) + '...';
        }
    } else {
        lastMessageText = 'No messages yet';
    }
    
    const avatarUrl = chatInfo.partner.photo || generateAvatarUrl(displayName);
    
    div.innerHTML = `
        <img src="${avatarUrl}" 
             alt="${displayName}"
             onerror="this.src='${generateAvatarUrl(displayName.charAt(0))}'">
        <div class="chat-info">
            <h4>${displayName}</h4>
            <p>${lastMessageText}</p>
        </div>
        <div class="contact-status">
            ${chatInfo.unread ? '<span class="unread-badge">!</span>' : ''}
            <span class="message-time">${formatTimestamp(chatInfo.lastMessageTime)}</span>
        </div>
    `;
    
    div.addEventListener('click', () => openChat(chatInfo.partner));
    return div;
}

// Open Chat
async function openChat(partner) {
    if (!currentUser || !partner) {
        debugLog("Cannot open chat: missing user or partner");
        return;
    }
    
    debugLog("Opening chat with:", partner.username);
    
    currentChatPartner = partner;
    currentChatId = generateChatId(currentUser.uid, partner.uid);
    
    // Update UI
    updateChatHeader(partner);
    
    // Enable message input
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    if (messageInput && sendBtn) {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
    
    // Clear previous listeners
    if (messagesRef) {
        messagesRef.off();
        messagesRef = null;
    }
    
    if (typingRef) {
        typingRef.off();
        typingRef = null;
    }
    
    // Clear typing timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    
    // Clear messages container
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading messages...</p></div>';
    }
    
    // Load messages
    await loadMessages();
    
    // Listen for new messages
    messagesRef = database.ref('chats/' + currentChatId);
    messagesRef.orderByChild('time').limitToLast(100).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            displayMessage(message, true);
            
            // Mark as seen if received
            if (message.sender === partner.uid && !message.seen) {
                markAsSeen(snapshot.key);
            }
        }
    });
    
    // Listen for typing indicator
    typingRef = database.ref('typing/' + currentChatId + '/' + partner.uid);
    typingRef.on('value', (snapshot) => {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.display = snapshot.exists() ? 'block' : 'none';
        }
    });
    
    // Mark chat as active in UI
    document.querySelectorAll('.contact-item, .chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.userId === partner.uid) {
            item.classList.add('active');
        }
    });
    
    debugLog("Chat opened successfully");
}

// Update Chat Header
function updateChatHeader(partner) {
    const defaultHeader = document.querySelector('.chat-header-default');
    const activeHeader = document.querySelector('.chat-header-active');
    const partnerName = document.getElementById('partnerName');
    const partnerPhoto = document.getElementById('partnerPhoto');
    const partnerStatus = document.getElementById('partnerStatus');
    const partnerStatusDot = document.getElementById('partnerStatusDot');
    
    if (defaultHeader) defaultHeader.style.display = 'none';
    if (activeHeader) activeHeader.style.display = 'flex';
    
    const displayName = partner.name || partner.username || 'Anonymous';
    if (partnerName) partnerName.textContent = displayName;
    
    if (partnerPhoto) {
        const avatarUrl = partner.photo || generateAvatarUrl(displayName);
        partnerPhoto.src = avatarUrl;
        partnerPhoto.onerror = function() {
            this.src = generateAvatarUrl(displayName.charAt(0));
        };
    }
    
    if (partnerStatus) {
        let statusText = partner.online ? 'Online' : 'Offline';
        let statusColor = partner.online ? '#10B981' : '#64748B';
        
        if (!partner.online && partner.lastSeen) {
            statusText = 'Last seen ' + formatTimestamp(partner.lastSeen);
        }
        
        partnerStatus.textContent = statusText;
        partnerStatus.className = 'status ' + (partner.online ? 'online' : 'offline');
        
        if (partnerStatusDot) {
            partnerStatusDot.style.background = statusColor;
        }
    }
    
    // Initialize call buttons
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    
    if (voiceCallBtn) {
        voiceCallBtn.onclick = () => {
            if (typeof initiatePeerCall === 'function') {
                initiatePeerCall(partner.uid, 'audio');
            } else {
                alert('Call feature is not ready yet');
            }
        };
    }
    
    if (videoCallBtn) {
        videoCallBtn.onclick = () => {
            if (typeof initiatePeerCall === 'function') {
                initiatePeerCall(partner.uid, 'video');
            } else {
                alert('Call feature is not ready yet');
            }
        };
    }
}

// Load Messages
async function loadMessages() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer || !currentChatId) return;
    
    debugLog("Loading messages for chat:", currentChatId);
    
    try {
        const messagesRef = database.ref('chats/' + currentChatId);
        const snapshot = await messagesRef.orderByChild('time').limitToLast(50).once('value');
        
        if (!snapshot.exists()) {
            messagesContainer.innerHTML = '<div class="empty-chat"><div class="empty-icon"><i class="fas fa-comment-dots"></i></div><h3>No messages yet</h3><p>Start the conversation!</p></div>';
            return;
        }
        
        messagesContainer.innerHTML = '';
        const messages = [];
        
        snapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            if (message) {
                messages.push(message);
            }
        });
        
        // Sort messages by time (oldest first)
        messages.sort((a, b) => a.time - b.time);
        
        // Display messages
        messages.forEach(message => {
            displayMessage(message, false);
        });
        
        // Scroll to bottom
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
        
        debugLog(`Loaded ${messages.length} messages`);
        
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading messages</p></div>';
    }
}

// Display Message
function displayMessage(message, scrollToBottom = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    // Remove empty state if present
    const emptyState = messagesContainer.querySelector('.empty-chat');
    if (emptyState) {
        emptyState.remove();
    }
    
    const isSent = message.sender === currentUser.uid;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${isSent ? 'sent' : 'received'}`;
    
    let content = '';
    if (message.type === 'text') {
        // Escape HTML and preserve line breaks
        const safeText = sanitizeInput(message.text || '').replace(/\n/g, '<br>');
        content = `<div class="message-text">${safeText}</div>`;
    } else if (message.type === 'image') {
        content = `
            <img src="${message.url}" alt="Image" class="message-image" onclick="openImageModal('${message.url}')">
            ${message.text ? `<div class="message-text">${sanitizeInput(message.text)}</div>` : ''}
        `;
    } else if (message.type === 'audio') {
        content = `
            <div class="message-audio">
                <div class="audio-player" onclick="toggleAudioPlayback(this, '${message.url}')">
                    <div class="audio-progress" style="width: 0%"></div>
                </div>
                <div class="audio-controls">
                    <button onclick="toggleAudioPlayback(this.parentElement.parentElement.querySelector('.audio-player'), '${message.url}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <span>${Math.round(message.duration || 0)}s</span>
                </div>
            </div>
            ${message.text ? `<div class="message-text">${sanitizeInput(message.text)}</div>` : ''}
        `;
    }