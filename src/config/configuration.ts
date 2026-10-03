const configuration = () => {
  return {
    app: {
      port: parseInt(process.env.PORT ?? '3000', 10),
      env: process.env.ENVIRONMENT,
    },
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME,
      name: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
    },
    cache: {
      redis: {
        url: process.env.REDIS_URL ?? '',
      },
    },
    tokens: {
      accessTokenExpiresInSeconds: 3600, // 1 hour in seconds
      refreshTokenExpiresInSeconds: 7 * 24 * 60 * 60, // 7 days in seconds
      refreshTokenBytes: 64,
      jwtSecretKey: process.env.JWT_SECRET_KEY,
    },
    swagger: {
      username: process.env.SWAGGER_USERNAME,
      password: process.env.SWAGGER_PASSWORD,
    },
    googleOAuth: {
      androidClientId: process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
    },
    email: {
      smtp: {
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT ?? '587', 10),
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        user: process.env.EMAIL_SMTP_USER,
        password: process.env.EMAIL_SMTP_PASSWORD,
      },
      from: process.env.EMAIL_FROM,
    },
    emailVerification: {
      otpLength: parseInt(process.env.EMAIL_VERIFICATION_OTP_LENGTH ?? '6', 10),
      expiresInMinutes: parseInt(
        process.env.EMAIL_VERIFICATION_EXPIRES_IN_MINUTES ?? '10',
        10,
      ),
      maxAttempts: parseInt(
        process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS ?? '5',
        10,
      ),
      resendCooldownSeconds: parseInt(
        process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? '60',
        10,
      ),
    },
    rateLimit: {
      register: {
        max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX ?? '5', 10),
        windowSeconds: parseInt(
          process.env.RATE_LIMIT_REGISTER_WINDOW_SECONDS ?? '3600',
          10,
        ),
      },
      verify: {
        ipMax: parseInt(process.env.RATE_LIMIT_VERIFY_IP_MAX ?? '10', 10),
        ipWindowSeconds: parseInt(
          process.env.RATE_LIMIT_VERIFY_IP_WINDOW_SECONDS ?? '900',
          10,
        ),
        emailMax: parseInt(process.env.RATE_LIMIT_VERIFY_EMAIL_MAX ?? '5', 10),
        emailWindowSeconds: parseInt(
          process.env.RATE_LIMIT_VERIFY_EMAIL_WINDOW_SECONDS ?? '900',
          10,
        ),
      },
      resend: {
        ipMax: parseInt(process.env.RATE_LIMIT_RESEND_IP_MAX ?? '3', 10),
        ipWindowSeconds: parseInt(
          process.env.RATE_LIMIT_RESEND_IP_WINDOW_SECONDS ?? '3600',
          10,
        ),
        emailMax: parseInt(process.env.RATE_LIMIT_RESEND_EMAIL_MAX ?? '3', 10),
        emailWindowSeconds: parseInt(
          process.env.RATE_LIMIT_RESEND_EMAIL_WINDOW_SECONDS ?? '3600',
          10,
        ),
      },
    },
  };
};

export default configuration;

export type AppConfig = ReturnType<typeof configuration>;
