# AGENTS.md — Expense Tracker Backend

> Single source of truth for project context, architecture, conventions, and agent instructions.

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| **Name** | Expense Tracker Backend (CodeSense - AI Code Reviewer Platform) |
| **Framework** | NestJS v11 (TypeScript) |
| **Language** | TypeScript (ES2023, NodeNext modules) |
| **Database** | PostgreSQL via TypeORM |
| **Cache** | Redis via ioredis + BullMQ |
| **Auth** | JWT (access) + refresh tokens (hashed in DB) + Google OAuth |
| **Email** | Nodemailer (SMTP) |
| **Logging** | Pino (nestjs-pino) with correlation IDs |
| **API Docs** | Swagger/OpenAPI at `/api/docs` |
| **Validation** | class-validator + class-transformer + global ValidationPipe |
| **Testing** | Jest (unit + e2e) |
| **CI/CD** | Husky + lint-staged + ESLint (flat config) + Prettier |

**Base URL**: `http://localhost:3000/api/v1` (prefix `api`, versioning `URI`, default version `1`)

---

## 2. Directory Structure

```
src/
├── app.module.ts              # Root module, global providers/imports
├── app.controller.ts          # Health/test endpoint
├── app.service.ts             # Health/test service
├── main.ts                    # Bootstrap, global pipes, Swagger, Pino, versioning
├── config/
│   ├── configuration.ts       # Central config object (env → typed)
│   └── config-validation-schema.ts  # Joi schema for env validation
├── database/
│   └── typeorm.datasource.ts  # TypeORM DataSource for CLI migrations
├── logging/
│   ├── logging.config.ts      # Pino config (redaction, correlation ID, custom levels)
│   ├── logging.module.ts      # Global LoggerModule
│   └── user-context.interceptor.ts  # Attaches userId to log context after auth
├── exceptionn-handling/       # (typo preserved for compat)
│   ├── app-exception.ts       # AppException: code + message + timestamp
│   ├── exception-codes.ts     # Centralized error codes enum
│   └── global-exception.filter.ts  # Catch-all → structured JSON response
├── cache/
│   ├── cache.module.ts
│   ├── cache.service.ts       # Abstract cache interface (get/set/del)
│   └── redis/
│       └── redis.service.ts   # ioredis implementation + BullMQ queue
├── core/
│   ├── email/
│   │   ├── email.service.ts   # Nodemailer wrapper
│   │   └── email.module.ts
│   └── rate-limit/
│       ├── rate-limiter.service.ts  # Sliding-window using Redis sorted sets
│       └── rate-limiter.module.ts
├── types/
│   └── authenticated-request.type.ts  # Express.Request + user + id
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── controller/
│   │   │   └── auth.controller.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── auth-session.decorator.ts
│   │   │   ├── public.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── dto/
│   │   │   ├── index.ts (barrel)
│   │   │   ├── auth.dto.ts
│   │   │   ├── login.response.dto.ts
│   │   │   ├── refresh.response.dto.ts
│   │   │   ├── email-login-request.dto.ts
│   │   │   ├── email-register-request.dto.ts
│   │   │   ├── email-register-response.dto.ts
│   │   │   ├── google-signin.dto.ts
│   │   │   ├── google-user.dto.ts
│   │   │   ├── verify-email.dto.ts
│   │   │   ├── resend-verification.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   ├── logout.response.dto.ts
│   │   │   ├── otp-data.dto.ts
│   │   │   ├── device-context.dto.ts
│   │   │   ├── create-session-params.dto.ts
│   │   │   ├── auth-session.response.dto.ts
│   │   │   ├── forgot-password-request.dto.ts
│   │   │   ├── verify-password-reset-otp.dto.ts
│   │   │   ├── reset-password.dto.ts
│   │   │   └── verify-password-reset-response.dto.ts
│   │   ├── entity/
│   │   │   ├── session.entity.ts
│   │   │   └── index.ts
│   │   ├── enums/
│   │   │   ├── auth-identity-provider.enum.ts
│   │   │   ├── otp-purpose.enum.ts
│   │   │   └── index.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── refresh-token.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── service/
│   │       ├── auth/
│   │       │   └── auth.service.ts
│   │       ├── auth-token/
│   │       │   └── auth-token.service.ts
│   │       ├── email-verification/
│   │       │   ├── otp.service.ts
│   │       │   └── email-verification.service.ts
│   │       ├── password-reset/
│   │       │   └── password-reset.service.ts
│   │       ├── google-auth/
│   │       │   └── google-auth.service.ts
│   │       ├── password/
│   │       │   └── password.service.ts
│   │       ├── rate-limit/
│   │       │   └── rate-limit.service.ts
│   │       └── session/
│   │           └── session.service.ts
│   └── user/
│       ├── user.module.ts
│       ├── entity/
│       │   ├── user.entity.ts
│       │   ├── auth-identity.entity.ts
│       │   ├── password-credential.entity.ts
│       │   ├── role.entity.ts
│       │   ├── user-role.entity.ts
│       │   └── index.ts
│       ├── enum/
│       │   ├── user-status.enum.ts
│       │   ├── role.enum.ts
│       │   └── index.ts
│       └── service/
│           └── user.service.ts
├── migrations/
│   └── 1790498694965-UserEntities.ts
```

---

## 3. Key Architectural Decisions

### 3.1 Module Organization

- **Feature modules** under `src/modules/` (auth, user). Each owns its entities, DTOs, guards, services.
- **Core modules** under `src/core/` (email, rate-limit) — shared, no domain logic.
- **Infrastructure modules** at root level (logging, cache, config, database, exception handling).
- **Global providers** in `AppModule`: `UserContextInterceptor` (APP_INTERCEPTOR), `GlobalExceptionFilter` (APP_FILTER).

### 3.2 Authentication & Authorization

| Component | Responsibility |
|-----------|----------------|
| `JwtAuthGuard` | Verifies access token, loads user, checks `UserStatus.ACTIVE`, attaches `AuthenticatedUser` to request |
| `RefreshTokenGuard` | Verifies refresh token from body, loads session, attaches `Session` entity |
| `RolesGuard` | Checks `@Roles(...)` decorator against user roles |
| `@Public()` | Skip auth on specific routes |
| `@CurrentUser()` | Extract `AuthenticatedUser` or field from request |
| `@AuthSession()` | Extract `Session` entity (used in refresh/logout) |

**Token flow**:
- Access token: JWT (RS256/HS256), 1h default, payload `{ sub, sid, roles, type: 'access' }`
- Refresh token: cryptographically random (64 bytes base64url), stored as SHA-256 hash in `sessions.refreshTokenHash`
- Rotation on refresh: old session revoked, new session created

### 3.3 Database Conventions (TypeORM)

- **Primary keys**: UUID (`PrimaryGeneratedColumn('uuid')`)
- **Timestamps**: `CreateDateColumn` + `UpdateDateColumn` (`timestamptz`)
- **Indexes**: Explicit `@Index` on foreign keys and lookup columns (`email`, `refreshTokenHash`, `userId`)
- **Relationships**: Bidirectional with `onDelete: 'CASCADE'` where appropriate
- **Naming**: `snake_case` columns (`name: 'email_verified'`), PascalCase entities
- **Migrations**: Generated via `npm run migration:generate`, run via `npm run migration:run`

### 3.4 Error Handling

- **AppException**: Custom HttpException with `code`, `message`, `timestamp`
- **ExceptionCodes**: Centralized string constants (`USER_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, etc.)
- **GlobalExceptionFilter**: Catches all, logs with correlation ID + userId, returns:
  ```json
  { "statusCode": 400, "message": "...", "requestId": "...", "timestamp": "...", "path": "..." }
  ```
- **ValidationPipe**: Transforms, whitelists, forbids unknown, custom exception factory → `AppException(METHOD_ARGUMENT_NOT_VALID)`

### 3.5 Rate Limiting

Sliding window via Redis sorted sets (`core/rate-limit/rate-limiter.service.ts`). Configured per endpoint group in `configuration.ts`:
- `register` (by IP)
- `login` (by IP + by email)
- `verify` (by IP + by email)
- `resend` (by IP + by email)
- `googleOAuth` (by IP)
- `tokenRefresh` (by user)
- `logout` (by user)
- `passwordReset.request` (by IP + by email)
- `passwordReset.verify` (by IP + by email)
- `passwordReset.reset` (by IP)

### 3.6 Email Verification & OTP

- 6-digit OTP (configurable), 10-min expiry, 5 max attempts, 60s resend cooldown
- `OtpService` is purpose-aware via `OtpPurpose` (`EMAIL_VERIFICATION` vs `PASSWORD_RESET`); Redis keys are namespaced (`email_verification:<email>` vs `password_reset:<email>`) so the two flows never collide
- Shared `OtpService.assertCooldownAvailable(email, purpose)` enforces the resend cooldown for both flows — don't reimplement it inline
- Stored in Redis with TTL (`cache/cache.service.ts` + `OtpService`)
- Sent via `EmailService` (Nodemailer SMTP); `buildOtpEmail()` is the shared OTP template used by both `sendEmailVerificationOtp()` and `sendPasswordResetOtp()`

### 3.7 Password Reset (Forgot Password)

- 3-step flow on `AuthController` (`POST /auth/password/forgot` → `/auth/password/verify` → `/auth/password/reset`), thin wrappers in `AuthService` delegating to `PasswordResetService`
- Step 1 validates account with explicit errors (`USER_NOT_FOUND`, `EMAIL_NOT_VERIFIED`, `USER_ACCOUNT_NOT_ACTIVE`, `PASSWORD_RESET_NOT_AVAILABLE` for Google-only accounts), then issues a purpose-namespaced OTP
- Step 2 consumes the OTP and issues a single-use opaque reset token (generated/hashed via `AuthTokenService`, stored as SHA-256 hash at `password_reset_token:<hash>` in Redis, 15-min TTL via `passwordReset.resetTokenExpiresInMinutes`, bound to email)
- Step 3 validates the token-email binding, updates `PasswordCredential` hash, consumes the token (single-use), and revokes all user sessions via `SessionService.revokeAllUserSessions` (user must re-login; no auto-login)
- Explicit errors allow email enumeration by design (unlike silent `resendVerificationEmail`) — approved tradeoff

---

## 4. Coding Conventions

### 4.1 TypeScript / NestJS

- **Strict mode**: `strictNullChecks: true`, `noImplicitAny: false` (legacy), `experimentalDecorators: true`
- **Imports**: Grouped — external libs first, then internal (`@/...` not used; relative paths)
- **Decorators**: One per line for readability (`@Injectable()` on own line)
- **Dependency injection**: Constructor injection, `private readonly` fields
- **Async/await**: Preferred over RxJS operators for service logic
- **DTOs**: `class-validator` decorators (`@IsEmail`, `@IsString`, `@MinLength`, etc.)
- **Enums**: `const enum` for internal, string enums for DB values (`UserStatus`, `Role`)

### 4.2 File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Module | `*.module.ts` | `auth.module.ts` |
| Controller | `*.controller.ts` | `auth.controller.ts` |
| Service | `*.service.ts` | `auth.service.ts` |
| Entity | `*.entity.ts` | `user.entity.ts` |
| DTO | `*.dto.ts` | `email-login-request.dto.ts` |
| Guard | `*.guard.ts` | `jwt-auth.guard.ts` |
| Decorator | `*.decorator.ts` | `roles.decorator.ts` |
| Enum | `*.enum.ts` | `role.enum.ts` |
| Config | `*.ts` | `configuration.ts` |
| Interface/Type | `*.type.ts` / `*.interface.ts` | `authenticated-request.type.ts` |

### 4.3 Barrel Exports

Each feature folder has `index.ts` re-exporting public API:
```ts
// src/modules/auth/entity/index.ts
export { Session } from './session.entity';
```

### 4.4 Logging

- Use injected `PinoLogger` (`@InjectPinoLogger(ClassName)`)
- Structured logging: `logger.info({ key: val }, 'message')`
- Correlation ID auto-added via `logging.config.ts`
- User context auto-added via `UserContextInterceptor` after auth

### 4.5 Environment Configuration

- `ConfigModule.forRoot({ isGlobal: true, envFilePath: \`.env.\${process.env.ENV || 'dev'}\`, load: [configuration], validationSchema })`
- All env access via `ConfigService.get(key)` — never `process.env` directly in services
- Typed config via `AppConfig = ReturnType<typeof configuration>`

---

## 5. Scripts & Commands

```bash
# Development
npm run start:dev          # ts-node with watch, ENV=dev
npm run start:test         # nest start --watch, ENV=test
npm run start:prod         # node dist/main, ENV=prod

# Build
npm run build              # nest build → dist/

# Lint / Format
npm run lint               # eslint --fix
npm run lint:check         # eslint (no fix)
npm run format             # prettier --write

# Test
npm run test               # jest
npm run test:watch         # jest --watch
npm run test:cov           # jest --coverage
npm run test:e2e           # jest --config test/jest-e2e.json

# Database (TypeORM CLI)
npm run migration:generate # generate migration (prompts name)
npm run migration:create   # create empty migration
npm run migration:run      # run pending migrations
npm run migration:revert   # revert last migration
# Env-specific: migration:run:dev, migration:run:prod, migration:run:test
```

---

## 6. Adding New Features — Checklist

When implementing a new feature/module, follow this sequence:

1. **Create module** under `src/modules/<feature>/` with:
   - `<feature>.module.ts`
   - `entity/` — TypeORM entities
   - `dto/` — request/response DTOs with validation
   - `service/` — business logic
   - `controller/` — HTTP endpoints
   - `guards/` / `decorators/` — if auth/roles needed
   - `enum/` — if domain enums needed
2. **Register entities** in module's `TypeOrmModule.forFeature([...])`
3. **Export services** needed by other modules
4. **Add route guards** (`JwtAuthGuard`, `RolesGuard`) on controllers
5. **Add rate limit config** in `configuration.ts` + `config-validation-schema.ts` if new endpoint
6. **Generate migration**: `npm run migration:generate`
7. **Write tests** (unit + e2e) — place `*.spec.ts` beside source
8. **Run lint + tests**: `npm run lint && npm run test`

---

## 7. Common Patterns & Gotchas

### 7.1 Transactional Writes

Use `DataSource.transaction()` in services for multi-entity atomicity:
```ts
await this.dataSource.transaction(async (manager) => {
  const user = manager.create(User, { ... });
  await manager.save(user);
  const credential = manager.create(PasswordCredential, { userId: user.id, ... });
  await manager.save(credential);
});
```

### 7.2 Accessing Request in Services

Inject `REQUEST` scoped provider or pass minimal context (ip, userAgent) from controller — **don't** inject `Request` in services.

### 7.3 Redis Key Patterns

- Rate limit: `rate_limit:<prefix>:<identifier>` (string counter, TTL = window)
- Email-verification OTP: `email_verification:<email>` (JSON `OtpData`, TTL = OTP expiry)
- Password-reset OTP: `password_reset:<email>` (JSON `OtpData`, TTL = OTP expiry)
- Password-reset token: `password_reset_token:<sha256>` (JSON `{ userId, email, createdAt }`, TTL = reset-token expiry, single-use)
- Session cache: `session:<sessionId>` (hash, TTL = refresh token TTL)

### 7.4 Swagger Documentation

- Add `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, `@ApiResponse` on controllers
- DTOs use `@ApiProperty` / `@ApiPropertyOptional`
- Global config in `main.ts` (Bearer auth, title, version)

### 7.5 Testing Patterns

```ts
// Unit: mock dependencies via module builder
const module = await Test.createTestingModule({
  providers: [AuthService, { provide: UserService, useValue: mockUserService }, ...],
}).compile();

// E2E: use supertest on INestApplication
await request(app.getHttpServer())
  .post('/api/v1/auth/email/login')
  .send({ email, password })
  .expect(200);
```

---

## 8. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENV` | Yes | — | `dev \| prod \| test \| local` |
| `PORT` | No | `3000` | HTTP port |
| `DB_HOST` | Yes | — | Postgres host |
| `DB_PORT` | No | `5432` | Postgres port |
| `DB_USERNAME` | Yes | — | Postgres user |
| `DB_PASSWORD` | Yes | — | Postgres password |
| `DB_NAME` | Yes | — | Database name |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET_KEY` | Yes | — | JWT signing secret (min 10 chars) |
| `SWAGGER_USERNAME` | No | — | Basic auth for /api/docs |
| `SWAGGER_PASSWORD` | No | — | Basic auth for /api/docs |
| `GOOGLE_OAUTH_ANDROID_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `EMAIL_SMTP_HOST` | Yes | — | SMTP host |
| `EMAIL_SMTP_PORT` | No | `587` | SMTP port |
| `EMAIL_SMTP_SECURE` | No | `false` | TLS |
| `EMAIL_SMTP_USER` | Yes | — | SMTP username |
| `EMAIL_SMTP_PASSWORD` | Yes | — | SMTP password |
| `EMAIL_FROM` | Yes | — | From address (valid email) |
| `EMAIL_VERIFICATION_OTP_LENGTH` | No | `6` | OTP digits |
| `EMAIL_VERIFICATION_EXPIRES_IN_MINUTES` | No | `10` | OTP TTL |
| `EMAIL_VERIFICATION_MAX_ATTEMPTS` | No | `5` | Max verify tries |
| `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS` | No | `60` | Resend cooldown |
| `PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES` | No | `15` | Reset-token TTL |
| `RATE_LIMIT_*_MAX` | No | various | Max requests per window |
| `RATE_LIMIT_*_WINDOW_SECONDS` | No | various | Window size in seconds |
| `RATE_LIMIT_PASSWORD_RESET_REQUEST_IP_MAX` | No | `5` | Reset request max per IP window |
| `RATE_LIMIT_PASSWORD_RESET_REQUEST_IP_WINDOW_SECONDS` | No | `3600` | Reset request IP window |
| `RATE_LIMIT_PASSWORD_RESET_REQUEST_EMAIL_MAX` | No | `3` | Reset request max per email window |
| `RATE_LIMIT_PASSWORD_RESET_REQUEST_EMAIL_WINDOW_SECONDS` | No | `3600` | Reset request email window |
| `RATE_LIMIT_PASSWORD_RESET_VERIFY_IP_MAX` | No | `10` | Reset verify max per IP window |
| `RATE_LIMIT_PASSWORD_RESET_VERIFY_IP_WINDOW_SECONDS` | No | `900` | Reset verify IP window |
| `RATE_LIMIT_PASSWORD_RESET_VERIFY_EMAIL_MAX` | No | `5` | Reset verify max per email window |
| `RATE_LIMIT_PASSWORD_RESET_VERIFY_EMAIL_WINDOW_SECONDS` | No | `900` | Reset verify email window |
| `RATE_LIMIT_PASSWORD_RESET_RESET_IP_MAX` | No | `10` | Reset confirm max per IP window |
| `RATE_LIMIT_PASSWORD_RESET_RESET_IP_WINDOW_SECONDS` | No | `900` | Reset confirm IP window |

---

## 9. Agent Instructions

### 9.1 When Modifying Code

- **Follow existing patterns** — check sibling files for conventions
- **Update barrel exports** (`index.ts`) when adding new public symbols
- **Run `npm run lint`** before committing
- **Generate migrations** for any entity changes
- **Add/update tests** for new logic

### 9.2 When Adding Dependencies

- Prefer `@nestjs/*` packages for integrations
- Add to `dependencies` (not `devDependencies`) unless build/test only
- Run `npm install` and verify `npm run build` passes

### 9.3 When Debugging

- Check logs: correlation ID (`X-Request-Id`) links request → logs
- Use `GlobalExceptionFilter` output for error details
- Swagger at `/api/docs` for API exploration
- `npm run test:e2e` for full integration flow

### 9.4 Prohibited Patterns

- ❌ `process.env` directly in services/controllers (use `ConfigService`)
- ❌ `any` type (ESLint warns; fix properly)
- ❌ Skipping validation DTOs on public endpoints
- ❌ Storing plaintext refresh tokens (always hash)
- ❌ Storing plaintext password-reset tokens (always hash, single-use, bind to email)
- ❌ Silent account merging on Google OAuth (throw `USER_ALREADY_EXISTS`)

---

## 10. Related Documents

- `package.json` — scripts, dependencies, Jest config
- `tsconfig.json` — TypeScript compiler options
- `nest-cli.json` — Nest CLI config
- `eslint.config.mjs` — ESLint flat config
- `src/config/configuration.ts` — full config shape + defaults
- `src/config/config-validation-schema.ts` — env validation rules
- `src/exceptionn-handling/exception-codes.ts` — all error codes

---

*Generated from codebase analysis. Update this file when architecture or conventions change.*