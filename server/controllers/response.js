function sendServiceResult(res, result) {
    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }
    return res.status(result.status).json(result.data);
}

module.exports = { sendServiceResult };
