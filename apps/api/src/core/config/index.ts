function requireSecret(envVar: string, devFallback: string): string {
    const value = process.env[envVar];
    if (!value) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`${envVar} no esta configurado`);
        }
        return devFallback;
    }
    return value;
}

// Environment configuration
export const config = {
    // Server
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',

    // JWT
    // Sin fallback hardcodeado en producción: un secreto público conocido
    // permite forjar tokens válidos para cualquier usuario.
    jwtSecret: requireSecret('JWT_SECRET', 'dev-only-jwt-secret'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshTokenSecret: requireSecret('REFRESH_TOKEN_SECRET', 'dev-only-refresh-secret'),
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',

    // CORS
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],

    // Database (Supabase)
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

    // AI
    googleAiKey: process.env.GOOGLE_AI_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
};
