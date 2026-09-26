import Joi from 'joi';

export const configValidationSchema = Joi.object({
  ENVIRONMENT: Joi.string().valid('dev', 'prod', 'test', 'local').required(),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_SECRET_KEY: Joi.string().min(10).required(),
});
