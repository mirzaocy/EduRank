(function (global) {
    const TOKEN_KEY = 'edurank_token';
    const USER_KEY = 'edurank_user';

    function safeGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {}
    }

    function safeRemove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    }

    const Storage = {
        getToken() {
            return safeGet(TOKEN_KEY) || safeGet('token');
        },
        setToken(token) {
            safeSet(TOKEN_KEY, token);
            safeSet('token', token);
        },
        removeToken() {
            safeRemove(TOKEN_KEY);
            safeRemove('token');
        },
        getUser() {
            const raw = safeGet(USER_KEY) || safeGet('user');
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        },
        setUser(user) {
            const val = typeof user === 'string' ? user : JSON.stringify(user);
            safeSet(USER_KEY, val);
            safeSet('user', val);
        },
        removeUser() {
            safeRemove(USER_KEY);
            safeRemove('user');
        },
        clearAuth() {
            this.removeToken();
            this.removeUser();
            safeRemove('edurankLoggedIn');
            safeRemove('name');
            safeRemove('username');
            safeRemove('email');
            safeRemove('birthDate');
            safeRemove('authProvider');
            safeRemove('studentPhotoVerified');
            safeRemove('studentCardVerified');
            safeRemove('province');
            safeRemove('city');
            safeRemove('school');
            safeRemove('class_level');
            safeRemove('bio');
            safeRemove('country');
            safeRemove('rank');
            safeRemove('avatar');
            safeRemove('exp');
            safeRemove('matches');
            safeRemove('wins');
            safeRemove('elo_matematika');
            safeRemove('elo_fisika');
            safeRemove('elo_bahasainggris');
            safeRemove('elo_informatika');
            safeRemove('highest_matematika');
            safeRemove('highest_fisika');
            safeRemove('highest_bahasainggris');
            safeRemove('highest_informatika');
            safeRemove('learningStyle');
            safeRemove('learningStyleLabel');
            safeRemove('learningStyleScores');
            safeRemove('studentPhotoData');
            safeRemove('studentCardPhotoData');
        }
    };

    global.EduRankStorage = Storage;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Storage;
    }
})(typeof window !== 'undefined' ? window : globalThis);
