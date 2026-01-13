// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCGHhx35Rd_wl422i6dXARwVLCmhjp11Zg",
    authDomain: "bgmi-tournament-panel.firebaseapp.com",
    databaseURL: "https://bgmi-tournament-panel-default-rtdb.firebaseio.com",
    projectId: "bgmi-tournament-panel",
    storageBucket: "bgmi-tournament-panel.firebasestorage.app",
    messagingSenderId: "531853804076",
    appId: "1:531853804076:web:0be88f13b7c721bc354789"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
}

// Firebase Services
const auth = firebase.auth();
const database = firebase.database();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// ImgBB API Configuration
const IMGBB_API_KEY = 'e1cc46cc05630f0c0b2df4a38a889985';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// Set persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
        console.error('Persistence error:', error);
    });

// Global Variables
let currentUser = null;
let currentUsername = null;
let currentChatId = null;

// Utility Functions
function generateChatId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Upload to ImgBB
async function uploadToImgBB(file, type = 'image') {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', file);
        
        fetch(IMGBB_UPLOAD_URL, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                resolve({
                    url: data.data.url,
                    deleteUrl: data.data.delete_url,
                    type: type
                });
            } else {
                reject(new Error(data.error?.message || 'Upload failed'));
            }
        })
        .catch(error => {
            console.error('ImgBB upload error:', error);
            reject(error);
        });
    });
}

// Validate username format
function validateUsername(username) {
    if (!username || username.trim() === '') return 'Username is required';
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) return 'Username must be at least 3 characters';
    if (trimmedUsername.length > 20) return 'Username must be less than 20 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) return 'Username can only contain letters, numbers, and underscores';
    if (/^[0-9]/.test(trimmedUsername)) return 'Username cannot start with a number';
    if (/^_/.test(trimmedUsername)) return 'Username cannot start with underscore';
    return null;
}

// Sanitize input
function sanitizeInput(input) {
    if (!input) return '';
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Debug logging helper
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    if (data) {
        console.log(`[${timestamp}] ${message}:`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

// Generate avatar URL
function generateAvatarUrl(name) {
    const encodedName = encodeURIComponent(name || 'User');
    return `https://ui-avatars.com/api/?name=${encodedName}&background=0066FF&color=fff&size=150`;
}