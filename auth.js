// Authentication Management
document.addEventListener('DOMContentLoaded', function() {
    debugLog("DOM loaded, checking auth state");
    
    // Check if we're on login page or main app
    const isLoginPage = document.querySelector('.login-container') !== null;
    const isIndexPage = document.querySelector('.app-container') !== null;
    
    debugLog("Page detection - Login:", isLoginPage, "Index:", isIndexPage);
    
    // Setup auth state observer
    setupAuthStateObserver(isLoginPage, isIndexPage);
    
    // Initialize login page if it exists
    if (isLoginPage) {
        initializeLoginPage();
    }
});

// Setup Auth State Observer
function setupAuthStateObserver(isLoginPage, isIndexPage) {
    debugLog("Setting up auth state observer");
    
    auth.onAuthStateChanged(async (user) => {
        debugLog("Auth state changed:", user ? `User logged in (${user.uid})` : "No user");
        
        if (user) {
            // User is signed in
            currentUser = user;
            
            try {
                // Check if username is set
                const userRef = database.ref('users/' + user.uid);
                const snapshot = await userRef.once('value');
                
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    currentUsername = userData.username;
                    debugLog("User data found:", userData);
                    
                    if (isLoginPage) {
                        // User is on login page but already logged in - redirect to index
                        debugLog("User already logged in, redirecting to index.html");
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 100);
                    } else if (isIndexPage) {
                        // Initialize main app
                        debugLog("Initializing main app");
                        setTimeout(() => {
                            initializeApp(userData);
                        }, 500);
                    }
                } else {
                    // New user - show username modal
                    debugLog("New user, needs to set username");
                    if (isIndexPage) {
                        setTimeout(() => {
                            showUsernameModal();
                        }, 500);
                    }
                }
            } catch (error) {
                console.error("Error checking user data:", error);
                if (isIndexPage) {
                    showMessage("Error loading user data. Please refresh the page.", "error");
                }
            }
        } else {
            // User is signed out
            debugLog("User signed out");
            currentUser = null;
            currentUsername = null;
            
            if (isIndexPage) {
                // User is on index page but not logged in - redirect to login
                debugLog("User not logged in, redirecting to login.html");
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 100);
            }
        }
    }, (error) => {
        console.error("Auth state observer error:", error);
        if (isIndexPage) {
            showMessage("Authentication error. Please refresh the page.", "error");
        }
    });
}

// Initialize Login Page
function initializeLoginPage() {
    debugLog("Initializing login page");
    
    // Email Login
    const emailLoginBtn = document.getElementById('emailLoginBtn');
    if (emailLoginBtn) {
        emailLoginBtn.addEventListener('click', handleEmailLogin);
        debugLog("Email login button initialized");
    }
    
    // Email Signup
    const emailSignupBtn = document.getElementById('emailSignupBtn');
    if (emailSignupBtn) {
        emailSignupBtn.addEventListener('click', handleEmailSignup);
        debugLog("Email signup button initialized");
    }
    
    // Google Login
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
        debugLog("Google login button initialized");
    }
    
    // Password visibility toggle
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }
    
    // Enter key support
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleEmailLogin();
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleEmailLogin();
        });
    }
}

// Email Login Handler
async function handleEmailLogin() {
    debugLog("Email login triggered");
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('loginMessage');
    
    if (!email || !password) {
        showMessage('Please enter email and password', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        debugLog("Attempting email/password login");
        await auth.signInWithEmailAndPassword(email, password);
        // The redirect will happen via auth state observer
    } catch (error) {
        console.error("Email login error:", error);
        showMessage(getAuthErrorMessage(error), 'error');
    } finally {
        showLoading(false);
    }
}

// Email Signup Handler
async function handleEmailSignup() {
    debugLog("Email signup triggered");
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showMessage('Please enter email and password', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        debugLog("Attempting email/password signup");
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        debugLog("Email signup successful:", userCredential.user.uid);
        
        // Send email verification
        await userCredential.user.sendEmailVerification();
        
        showMessage('Account created successfully! You will be redirected shortly.', 'success');
        
    } catch (error) {
        console.error("Email signup error:", error);
        showMessage(getAuthErrorMessage(error), 'error');
    } finally {
        showLoading(false);
    }
}

// Google Login Handler
async function handleGoogleLogin() {
    debugLog("Google login triggered");
    showLoading(true);
    
    try {
        debugLog("Opening Google popup");
        await auth.signInWithPopup(googleProvider);
        // The redirect will happen via auth state observer
    } catch (error) {
        console.error("Google login error:", error);
        showMessage(getAuthErrorMessage(error), 'error');
    } finally {
        showLoading(false);
    }
}

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Get Auth Error Message
function getAuthErrorMessage(error) {
    debugLog("Auth error code:", error.code);
    
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Invalid email address format';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'Email already in use';
        case 'auth/weak-password':
            return 'Password is too weak (minimum 6 characters)';
        case 'auth/operation-not-allowed':
            return 'Email/password accounts are not enabled';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later';
        case 'auth/popup-blocked':
            return 'Popup blocked. Please allow popups for this site';
        case 'auth/popup-closed-by-user':
            return 'Login popup was closed';
        case 'auth/unauthorized-domain':
            return 'This domain is not authorized for login';
        default:
            return error.message || 'Authentication failed. Please try again.';
    }
}

// Show/Hide Loading
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

// Show Message
function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('loginMessage');
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.style.display = 'block';
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize Main App
function initializeApp(userData) {
    debugLog("Initializing main app with user data:", userData);
    
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.style.display = 'flex';
        
        // Update user info
        updateUserInfo(userData);
        
        // Initialize logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Set online status
        setUserOnline();
        
        // Listen for presence changes
        setupPresenceTracking();
        
        // Initialize chat features if chat.js is loaded
        if (typeof initializeChatFeatures === 'function') {
            setTimeout(() => {
                initializeChatFeatures();
            }, 1000);
        }
        
        debugLog("Main app initialized successfully");
    } else {
        debugLog("App container not found");
    }
}

// Update User Info in UI
function updateUserInfo(userData) {
    const userNameEl = document.getElementById('userName');
    const userPhotoEl = document.getElementById('userPhoto');
    const userStatusEl = document.getElementById('userStatus');
    const userAvatar = document.querySelector('.user-profile .profile-avatar');
    
    const displayName = userData.name || userData.username || 'Anonymous User';
    
    if (userNameEl) {
        userNameEl.textContent = displayName;
    }
    
    if (userPhotoEl) {
        userPhotoEl.src = userData.photo || generateAvatarUrl(displayName);
        userPhotoEl.onerror = function() {
            this.src = generateAvatarUrl(displayName.charAt(0));
        };
    }
    
    if (userStatusEl) {
        userStatusEl.textContent = 'Online';
        userStatusEl.className = 'status online';
    }
    
    if (userAvatar) {
        const onlineDot = userAvatar.querySelector('.online-dot');
        if (onlineDot) {
            onlineDot.style.display = 'block';
        }
    }
}

// Set User Online Status
function setUserOnline() {
    if (!currentUser) {
        debugLog("No current user for online status");
        return;
    }
    
    debugLog("Setting user online status");
    
    const userStatusRef = database.ref('users/' + currentUser.uid + '/online');
    const lastSeenRef = database.ref('users/' + currentUser.uid + '/lastSeen');
    
    // Set online to true
    userStatusRef.set(true).catch(error => {
        console.error("Error setting online status:", error);
    });
    
    // Update lastSeen on disconnect
    userStatusRef.onDisconnect().set(false);
    lastSeenRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
}

// Setup Presence Tracking
function setupPresenceTracking() {
    if (!currentUser) return;
    
    debugLog("Setting up presence tracking");
    
    // Update lastSeen when user leaves
    window.addEventListener('beforeunload', () => {
        const userRef = database.ref('users/' + currentUser.uid);
        userRef.update({
            online: false,
            lastSeen: Date.now()
        }).catch(console.error);
    });
}

// Show Username Modal
function showUsernameModal() {
    debugLog("Showing username modal");
    
    const modal = document.getElementById('usernameModal');
    if (!modal) {
        console.error("Username modal not found");
        return;
    }
    
    // Show modal immediately
    modal.style.display = 'flex';
    
    // Focus on username input
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.focus();
    }
    
    // Clear any previous error
    const errorEl = document.getElementById('usernameError');
    if (errorEl) {
        errorEl.textContent = '';
    }
    
    // Initialize save button
    const saveBtn = document.getElementById('saveUsernameBtn');
    if (!saveBtn) {
        console.error("Save username button not found");
        return;
    }
    
    // Remove any existing event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    // Add event listener to new button
    document.getElementById('saveUsernameBtn').addEventListener('click', saveUsername);
    
    // Enter key support for both inputs
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveUsername();
        });
    }
    
    const displayNameInput = document.getElementById('displayNameInput');
    if (displayNameInput) {
        displayNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveUsername();
        });
    }
    
    async function saveUsername() {
        debugLog("Saving username");
        
        const username = usernameInput.value.trim();
        const displayName = displayNameInput ? displayNameInput.value.trim() : '';
        const errorEl = document.getElementById('usernameError');
        const saveBtn = document.getElementById('saveUsernameBtn');
        
        if (!errorEl || !saveBtn) return;
        
        // Validate username
        const validationError = validateUsername(username);
        if (validationError) {
            errorEl.textContent = validationError;
            usernameInput.focus();
            return;
        }
        
        // Check if username exists
        try {
            const usernameRef = database.ref('usernames/' + username);
            const snapshot = await usernameRef.once('value');
            
            if (snapshot.exists()) {
                errorEl.textContent = 'Username already taken. Please choose another.';
                usernameInput.focus();
                return;
            }
            
            errorEl.textContent = '';
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating profile...';
            
            // Get user photo URL
            let photoURL = currentUser.photoURL;
            if (!photoURL && currentUser.email) {
                // Generate avatar based on email/name
                const avatarName = displayName || username || currentUser.email.split('@')[0];
                photoURL = generateAvatarUrl(avatarName);
            }
            
            // Create user data
            const userData = {
                uid: currentUser.uid,
                email: currentUser.email,
                name: displayName || username,
                username: username,
                photo: photoURL,
                online: true,
                lastSeen: null,
                createdAt: Date.now()
            };
            
            debugLog("Saving user data:", userData);
            
            // Save to database
            const updates = {};
            updates['users/' + currentUser.uid] = userData;
            updates['usernames/' + username] = currentUser.uid;
            
            await database.ref().update(updates);
            debugLog("User data saved successfully");
            
            // Hide modal
            modal.style.display = 'none';
            
            // Set current username and initialize app
            currentUsername = username;
            initializeApp(userData);
            
        } catch (error) {
            console.error("Error saving username:", error);
            errorEl.textContent = 'Error saving username: ' + error.message;
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Continue to Chat';
        }
    }
}

// Logout Handler
async function handleLogout() {
    debugLog("Logout initiated");
    
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Confirm logout
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    try {
        // Set offline status
        const userRef = database.ref('users/' + currentUser.uid);
        await userRef.update({
            online: false,
            lastSeen: Date.now()
        });
        debugLog("Offline status set");
        
        // Sign out
        await auth.signOut();
        debugLog("User signed out successfully");
        
        // Clear local variables
        currentUser = null;
        currentUsername = null;
        currentChatId = null;
        
        // Redirect to login
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error("Logout error:", error);
        alert('Error during logout. Please try again.');
    }
}