import Joi from 'joi';

export const configValidationSchema = Joi.object({
  // App
  ENV: Joi.string().valid('dev', 'prod', 'test', 'local').required(),
  PORT: Joi.number().default(3000),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // Cache / Redis
  REDIS_URL: Joi.string().uri().required(),

  // Tokens
  JWT_SECRET_KEY: Joi.string().min(10).required(),

  // Swagger (optional)
  SWAGGER_USERNAME: Joi.string().optional().allow(''),
  SWAGGER_PASSWORD: Joi.string().optional().allow(''),

  // Google OAuth
  GOOGLE_OAUTH_ANDROID_CLIENT_ID: Joi.string().required(),

  // Email
  EMAIL_SMTP_HOST: Joi.string().required(),
  EMAIL_SMTP_PORT: Joi.number().default(587),
  EMAIL_SMTP_SECURE: Joi.string().valid('true', 'false').default('false'),
  EMAIL_SMTP_USER: Joi.string().required(),
  EMAIL_SMTP_PASSWORD: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // Email Verification
  EMAIL_VERIFICATION_OTP_LENGTH: Joi.number()
    .integer()
    .min(4)
    .max(10)
    .default(6),
  EMAIL_VERIFICATION_EXPIRES_IN_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(10),
  EMAIL_VERIFICATION_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(5),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(0)
    .max(3600)
    .default(60),

  // Rate Limit - Register
  RATE_LIMIT_REGISTER_MAX: Joi.number().integer().min(1).max(100).default(5),
  RATE_LIMIT_REGISTER_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(3600),

  // Rate Limit - Verify
  RATE_LIMIT_VERIFY_IP_MAX: Joi.number().integer().min(1).max(100).default(10),
  RATE_LIMIT_VERIFY_IP_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(900),
  RATE_LIMIT_VERIFY_EMAIL_MAX: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(5),
  RATE_LIMIT_VERIFY_EMAIL_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(900),

  // Rate Limit - Resend
  RATE_LIMIT_RESEND_IP_MAX: Joi.number().integer().min(1).max(100).default(3),
  RATE_LIMIT_RESEND_IP_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(3600),
  RATE_LIMIT_RESEND_EMAIL_MAX: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(3),
  RATE_LIMIT_RESEND_EMAIL_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(3600),
});
