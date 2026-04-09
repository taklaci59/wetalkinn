/**
 * THEME MANAGER: Scalable, zero-flicker theme and accent synchronization.
 * No external dependencies (vanilla JS only).
 */

// Vanilla debounce — no lodash required
function _debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

const ThemeManager = {
    currentTheme: 'theme-dark',
    currentAccent: null, // Initialized from localStorage in init()
    _syncTimer: null,

    init: function() {
        console.log("ThemeManager: Initializing...");
        
        // 1. FASTER BOOT: Check auth state to prevent public pages from bleeding user themes
        const authStatusTag = document.querySelector('meta[name="user-auth-status"]');
        const isAuth = authStatusTag ? authStatusTag.content === 'true' : false;
        
        let localTheme, localAccent;
        
        if (isAuth) {
            localTheme = localStorage.getItem('dwt-theme') || 'theme-dark';
            localAccent = localStorage.getItem('dwt-accent');
            
            if (!localTheme.startsWith('theme-')) {
                localTheme = 'theme-dark';
            }
        } else {
            // Unauthenticated pages ALWAYS use default DoWeTalk identity
            localTheme = 'theme-dark';
            localAccent = null; // Forces CSS default (--accent: #7C5CFF)
        }

        this.applyTheme(localTheme, false); // false = dont persist yet to prevent overwriting saved theme on public
        
        if (localAccent) {
            this.applyAccent(localAccent, false);
        } else if (!isAuth) {
            // Explicitly clear accent on public pages to guarantee default CSS fallback
            this.applyAccent('default', false);
        }

        // 2. SYNC LATER: Update from backend after initial render (only if logged in)
        window.addEventListener('load', () => {
            if (isAuth) this.syncFromBackend();
        });
    },

    syncFromBackend: async function() {
        try {
            const response = await fetch('/api/theme/status');
            if (response.ok) {
                const data = await response.json();
                const backendTheme = data.theme?.toLowerCase();
                const backendAccent = data.accentColor;

                if (backendTheme && (backendTheme !== this.currentTheme || backendAccent !== this.currentAccent)) {
                    console.log("ThemeManager: Syncing with backend values...");
                    this.applyTheme(backendTheme, true);
                    if (backendAccent) this.applyAccent(backendAccent, true);
                }
            }
        } catch (err) {
            console.warn("ThemeManager: Backend sync failed, using local storage.", err);
        }
    },

    applyTheme: function(name, persist) {
        if (!name) return;
        if (typeof persist === 'undefined') persist = true;
        
        const root = document.documentElement;

        // Cleanup: Remove all previous theme- classes strictly
        const classesToRemove = [];
        root.classList.forEach(cls => {
            if (cls.startsWith('theme-')) classesToRemove.push(cls);
        });
        classesToRemove.forEach(cls => root.classList.remove(cls));

        // Add new theme class to root
        root.classList.add(name);
        
        this.currentTheme = name;

        if (persist) {
            localStorage.setItem('dwt-theme', name);
            this.scheduleSyncWithBackend();
        }

        // Update UI selection highlights
        this.updateUI();
        console.log("ThemeManager: Applied theme:", name);
    },

    applyAccent: function(color, persist) {
        if (!color) return;
        if (typeof persist === 'undefined') persist = true;
        
        const root = document.documentElement;
        
        // If it's the "default" or we want to clear it
        if (color === 'default') {
            root.style.removeProperty('--accent');
            root.style.removeProperty('--accent-hover');
            root.style.removeProperty('--user-accent');
            localStorage.removeItem('dwt-accent');
            this.currentAccent = null;
        } else {
            // Direct assignment to root for cleanest implementation
            root.style.setProperty('--accent', color);
            
            // Create a translucent hover version
            // We can do this by appending alpha if it's hex, but simpler CSS is better
            root.style.setProperty('--accent-hover', color + 'ee'); 
            root.style.setProperty('--accent-soft', color + '20'); 
            root.style.setProperty('--user-accent', color); 
            
            this.currentAccent = color;

            if (persist) {
                localStorage.setItem('dwt-accent', color);
                this.scheduleSyncWithBackend();
            }
        }

        // Update UI selection
        this.updateUI();
        console.log("ThemeManager: Applied accent:", color);
    },

    scheduleSyncWithBackend: function() {
        // Vanilla debounce: wait 1s after last change before syncing
        clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => {
            this._doSyncWithBackend();
        }, 1000);
    },

    _doSyncWithBackend: async function() {
        try {
            // jQuery may or may not be loaded; check both ways for the CSRF token
            let token = '';
            const tokenInput = document.querySelector('input[name="__RequestVerificationToken"]');
            if (tokenInput) token = tokenInput.value;
            
            // If token is missing (public pages), skip backend sync
            if (!token) return;

            await fetch('/api/theme/update', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'RequestVerificationToken': token
                },
                body: JSON.stringify({ 
                    theme: this.currentTheme, 
                    accentColor: this.currentAccent 
                })
            });
            console.log("ThemeManager: Synced with backend.");
        } catch (err) {
            console.error("ThemeManager: Failed to sync with backend.", err);
        }
    },

    updateUI: function() {
        // Highlight active theme card (works across categories)
        document.querySelectorAll('.theme-card').forEach(card => {
            const theme = card.getAttribute('data-theme-name');
            if (theme === this.currentTheme) {
                card.classList.add('active');
                // Scroll into view if needed? (optional polish)
            } else {
                card.classList.remove('active');
            }
        });

        // Highlight active accent swatch
        const activeAccent = this.currentAccent; 
        document.querySelectorAll('.accent-swatch').forEach(swatch => {
            const color = swatch.getAttribute('data-color');
            if (color && activeAccent && color.toLowerCase() === activeAccent.toLowerCase()) {
                swatch.classList.add('active');
            } else {
                swatch.classList.remove('active');
            }
        });
    }
};

// Global shorthand functions (called by onclick in HTML)
function changeTheme(name) { ThemeManager.applyTheme(name); }
function changeAccent(color) { ThemeManager.applyAccent(color); }

// Start immediately (early boot)
ThemeManager.init();
