function resolveServerConfig(overrides = {}) {
    const env = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {};
    const explicitPort = typeof overrides === 'number'
        ? overrides
        : env.PORT ?? env.port ?? process.env.PORT ?? '3000';
    const parsedPort = Number.parseInt(String(explicitPort), 10);
    return {
        port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
        host: env.HOST ?? env.host ?? process.env.HOST ?? process.env.host ?? '0.0.0.0'
    };
}

function getJwtSecret() {
    const secret = process.env.JWT_SECRET || (
        process.env.NODE_ENV === 'production'
            ? null
            : 'dev-secret-change-me'
    );
    if (process.env.NODE_ENV === 'production' && !secret) {
        throw new Error('JWT_SECRET must be configured in production.');
    }
    return secret;
}

module.exports = {
    resolveServerConfig,
    getJwtSecret
};
