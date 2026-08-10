const authService = require('../services/authService');

async function handleRegister(req, res) {
    try {
        const result = await authService.registerUser(req.body);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }
        res.status(result.status).json(result.data);
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Server error during registration." });
    }
}

async function handleLogin(req, res) {
    try {
        const result = await authService.loginUser(req.body);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }
        res.status(result.status).json(result.data);
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error during login." });
    }
}

module.exports = {
    handleRegister,
    handleLogin
};
