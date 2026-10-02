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
      jwtSecretKey: process.env.JWT_SECRET_KEY,
    },
    swagger: {
      username: process.env.SWAGGER_USERNAME,
      password: process.env.SWAGGER_PASSWORD,
    },
    googleOAuth: {
      androidClientId: process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
    },
  };
};

export default configuration;

export type AppConfig = ReturnType<typeof configuration>;
