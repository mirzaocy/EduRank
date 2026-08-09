const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const registrationChecker = require('./registrationChecker');
const { getJwtSecret } = require('../config/serverConfig');

async function registerUser(body) {
    const { name, email, password, birthDate, studentPhoto, studentCardPhoto } = body || {};
    
    const validation = registrationChecker.validateRegistration({
        name, email, password, birthDate, studentPhoto, studentCardPhoto
    });
    
    if (!validation.valid) {
        return { status: 400, error: validation.error };
    }

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(password || '');

    const saveInfo = registrationChecker.saveRegistration({
        name: trimmedName,
        email: trimmedEmail,
        birthDate,
        studentPhoto,
        studentCardPhoto
    });

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);
    const safeBirthDate = birthDate ? String(birthDate).slice(0, 10) : null;
    const username = trimmedEmail.split('@')[0].slice(0, 50);

    return new Promise((resolve) => {
        userModel.countAdminUsers((countErr, row) => {
            if (countErr) {
                console.error('Failed to count admin users:', countErr);
                return resolve({ status: 500, error: 'Gagal memproses pendaftaran.' });
            }

            const isFirstAdmin = !row || row.adminCount === 0;
            const userRole = isFirstAdmin ? 'admin' : 'siswa';

            userModel.createUser(
                {
                    username,
                    email: trimmedEmail,
                    hashedPassword,
                    nama: trimmedName,
                    safeBirthDate,
                    photoUrl: saveInfo.studentPhotoUrl,
                    studentCardPhotoUrl: saveInfo.studentCardPhotoUrl,
                    role: userRole
                },
                function (err) {
                    if (err) {
                        console.error("Register DB error code:", err.code, "message:", err.message);
                        if (err.code === 'ER_DUP_ENTRY' || String(err.message).includes('UNIQUE') || String(err.message).includes('duplicate')) {
                            return resolve({ status: 400, error: "Email sudah terdaftar." });
                        }
                        return resolve({ status: 500, error: "Gagal menyimpan ke database." });
                    }

                    const userId = this.lastID || this.insertId;
                    const token = jwt.sign({ id: userId, email: trimmedEmail }, getJwtSecret(), { expiresIn: '7d' });

                    resolve({
                        status: 200,
                        data: {
                            message: "Registration successful",
                            token,
                            user: {
                                id: userId,
                                name: trimmedName,
                                email: trimmedEmail,
                                username,
                                role: userRole
                            }
                        }
                    });
                }
            );
        });
    });
}

function loginUser(body) {
    const { email, password } = body || {};
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPassword = String(password || '');

    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
        return Promise.resolve({ status: 400, error: "Format email tidak valid." });
    }

    if (trimmedPassword.length < 8) {
        return Promise.resolve({ status: 400, error: "Password minimal 8 karakter." });
    }

    if (trimmedEmail === 'google.user@edurank.local') {
        return Promise.resolve({ status: 400, error: "Gunakan metode login yang sesuai." });
    }

    return new Promise((resolve) => {
        userModel.findUserByEmail(trimmedEmail, async (err, user) => {
            if (err || !user) {
                if (err) console.error("Login DB error:", err);
                return resolve({ status: 404, error: "Akun belum terdaftar." });
            }

            if (user.banned) {
                return resolve({ status: 403, error: "Akun anda telah diban" });
            }

            const validPassword = await bcrypt.compare(trimmedPassword, user.password);
            if (!validPassword) {
                return resolve({ status: 400, error: "Password salah." });
            }

            const token = jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' });
            const { password: _password, ...safeUser } = user;
            resolve({ status: 200, data: { token, user: safeUser } });
        });
    });
}

module.exports = {
    registerUser,
    loginUser
};
