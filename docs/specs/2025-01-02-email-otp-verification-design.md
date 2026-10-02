# Email OTP Verification Design

**Date**: 2025-01-02  
**Status**: Draft  
**Scope**: Architectural - New subsystem integration

## Objective

Implement OTP-based email verification for the expense tracker backend, ensuring unverified users cannot authenticate via email/password while keeping Google authentication unchanged.

## Current State Analysis

### Existing Authentication Flow
- Email registration creates user with `emailVerified: false`
- Registration immediately returns access + refresh tokens (creates session)
- Login does NOT check email verification status
- Google authentication sets `emailVerified: true` automatically
- No email verification infrastructure exists

### Existing Infrastructure
- User entity has `emailVerified` boolean field
- Session management via SessionService
- Password hashing via PasswordService (argon2)
- Redis available for rate limiting
- No email sending infrastructure

## Proposed Architecture

### Component Structure

```
src/
├── core/
│   └── email/
│       ├── email.module.ts
│       └── email.service.ts
│
└── modules/
    └── auth/
        ├── dto/
        │   ├── verify-email.dto.ts (NEW)
        │   └── resend-verification.dto.ts (NEW)
        │
        ├── entities/
        │   └── email-verification.entity.ts (NEW)
        │
        └── services/
            └── email-verification/
                ├── email-verification.service.ts (NEW)
                └── otp.service.ts (NEW)
```

### Data Model

#### EmailVerification Entity

```typescript
@Entity('email_verifications')
export class EmailVerification {
  id: string (UUID)
  userId: string (FK → users)
  otpHash: string (Argon2 hash)
  purpose: enum ('EMAIL_VERIFICATION')
  expiresAt: timestamp
  attempts: number (default 0)
  maxAttempts: number (default 5)
  consumedAt: timestamp | null
  createdAt: timestamp
}
```

**Indexes**:
- `(userId, purpose)` - find active verification for user
- `(expiresAt)` - cleanup expired records

### Service Responsibilities

#### OtpService
- Generate secure 6-digit OTP using `crypto.randomInt()`
- Hash OTP with argon2
- Verify OTP against hash
- Calculate expiration dates

#### EmailVerificationService
- Create verification records
- Send verification emails
- Validate OTP submissions
- Manage attempt limits
- Handle resend cooldown

#### EmailService
- Configure SMTP transport
- Send verification emails
- Handle email templates

### API Contract Changes

#### Modified: POST /api/v1/auth/email/register

**Current Response**:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "user": { "id": "...", "roles": [...] }
}
```

**New Response**:
```json
{
  "verificationRequired": true
}
```

**Changes**:
- Create user with `emailVerified: false`
- Create PasswordCredential
- Create AuthIdentity
- Generate and send OTP email
- Return verification requirement (NO session created)

#### New: POST /api/v1/auth/email/verify

**Request**:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response** (on success):
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "user": { "id": "...", "roles": [...] }
}
```

**Behavior**:
- Validate OTP
- Set `emailVerified = true`
- Mark verification as consumed
- Create session and return tokens

#### New: POST /api/v1/auth/email/resend-verification

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "message": "If the account requires verification, a verification code has been sent."
}
```

**Behavior**:
- Generic response (does not reveal account existence)
- Resend OTP if cooldown period passed
- 60-second cooldown between resends

#### Modified: POST /api/v1/auth/email/login

**Current**: Authenticates any active user

**New**: Handle unverified users gracefully

```typescript
if (!user.emailVerified) {
  // User registered but hasn't verified email yet
  // Send new OTP and inform user
  await this.emailVerificationService.sendVerificationEmail(user);
  
  throw new AppException(
    ExceptionCodes.EMAIL_NOT_VERIFIED,
    'Please verify your email before signing in. A new verification code has been sent to your email.',
    HttpStatus.FORBIDDEN,
  );
}
```

**Behavior**:
- If user is unverified, send a fresh OTP
- Throw `AppException` with code `E0004` 
- Frontend can check `code: 'E0004'` to redirect to verification screen
- User can then verify with the new OTP

#### Unchanged: POST /api/v1/auth/google

Google authentication flow remains unchanged. Google's `email_verified` claim is trusted.

### Security Requirements

- ✅ OTP generated using `crypto.randomInt()` (cryptographically secure)
- ✅ OTP never stored in plaintext
- ✅ OTP hashed with Argon2
- ✅ OTP expires after 10 minutes
- ✅ Maximum 5 verification attempts
- ✅ OTP unusable after successful verification (`consumedAt`)
- ✅ Only one active verification per user (old ones deleted)
- ✅ 60-second resend cooldown
- ✅ Generic error responses (do not reveal account existence)
- ✅ No JWT issued during registration
- ✅ Session created only after verification
- ✅ Email sending outside DB transaction
- ✅ Pessimistic lock during verification update

### Configuration

Add to environment:

```env
# Email SMTP
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM="Expense Tracker <your-email@gmail.com>"

# OTP Settings
EMAIL_VERIFICATION_OTP_LENGTH=6
EMAIL_VERIFICATION_EXPIRES_IN_MINUTES=10
EMAIL_VERIFICATION_MAX_ATTEMPTS=5
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
EMAIL_VERIFICATION_MAX_RESENDS_PER_HOUR=5
```

### Database Migration

Create `email_verifications` table with:
- UUID primary key
- Foreign key to users (CASCADE delete)
- `otp_hash` varchar(255)
- `purpose` enum
- `expires_at` timestamptz
- `attempts` integer
- `max_attempts` integer
- `consumed_at` timestamptz (nullable)
- `created_at` timestamptz

### Transaction Strategy

**Registration flow**:
```text
1. Start transaction
2. Create User (emailVerified=false)
3. Create PasswordCredential
4. Create AuthIdentity
5. Commit transaction
6. Send OTP email (outside transaction)
```

**Verification flow**:
```text
1. Find user by email
2. Find active verification
3. Check consumedAt, attempts, expiration
4. Verify OTP hash
5. Start transaction with pessimistic lock
6. Set verification.consumedAt
7. Set user.emailVerified = true
8. Commit transaction
9. Create session (outside transaction)
```

### Error Handling

All errors use the custom `AppException` class with specific exception codes for frontend handling.

#### Add to ExceptionCodes:

```typescript
export const ExceptionCodes = {
  ROLES_NOT_FOUND: 'E0001',
  USER_NOT_FOUND: 'E0002',
  METHOD_ARGUMENT_NOT_VALID: 'E0003',
  EMAIL_NOT_VERIFIED: 'E0004',
  INVALID_VERIFICATION_CODE: 'E0005',
  VERIFICATION_CODE_EXPIRED: 'E0006',
  TOO_MANY_VERIFICATION_ATTEMPTS: 'E0007',
  VERIFICATION_CODE_ALREADY_USED: 'E0008',
  EMAIL_ALREADY_VERIFIED: 'E0009',
  RESEND_COOLDOWN_ACTIVE: 'E0010',
  NO_VERIFICATION_FOUND: 'E0011',
};
```

#### Error Responses:

| Scenario | Code | HTTP Status | Response |
|----------|------|-------------|----------|
| Invalid OTP | E0005 | 400 | `{ "code": "E0005", "message": "Invalid verification code." }` |
| Expired OTP | E0006 | 400 | `{ "code": "E0006", "message": "Verification code has expired." }` |
| Too many attempts | E0007 | 429 | `{ "code": "E0007", "message": "Too many invalid attempts. Request a new code." }` |
| OTP already used | E0008 | 400 | `{ "code": "E0008", "message": "Verification code has already been used." }` |
| Already verified | E0009 | 400 | `{ "code": "E0009", "message": "Email is already verified." }` |
| Resend too soon | E0010 | 429 | `{ "code": "E0010", "message": "Please wait X seconds before requesting another code." }` |
| No verification found | E0011 | 400 | `{ "code": "E0011", "message": "Invalid verification code." }` |
| Email not verified (login) | E0004 | 403 | `{ "code": "E0004", "message": "Please verify your email before signing in. A new verification code has been sent to your email." }` |

**Example Response Format**:
```json
{
  "statusCode": 403,
  "message": "Please verify your email before signing in. A new verification code has been sent to your email.",
  "requestId": "req-abc123",
  "timestamp": "2025-01-02T10:30:00.000Z",
  "path": "/api/v1/auth/email/login"
}
```

**Frontend Handling**:
```typescript
// Frontend can now handle errors programmatically
if (error.response.data.code === 'E0004') {
  // Redirect to verification screen
  router.push('/verify-email');
}
```

### Cleanup Strategy

Expired verification records accumulated in database. Implement scheduled cleanup:

- Run every 30 minutes
- Delete records where `expires_at < NOW()`
- Use `@nestjs/schedule` or existing scheduler

### Rate Limiting Implementation

Create `src/modules/auth/guards/rate-limit.guard.ts`:

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const email = request.body?.email;
    
    const endpoint = this.getEndpointType(request);
    const limits = this.configService.get(`rateLimit.${endpoint}`);
    
    // Check IP-based limit
    if (await this.isRateLimited(`ip:${ip}`, limits.ip)) {
      throw new TooManyRequestsException('Too many requests. Please try again later.');
    }
    
    // Check email-based limit if email provided
    if (email && await this.isRateLimited(`email:${email}`, limits.email)) {
      throw new TooManyRequestsException('Too many requests. Please try again later.');
    }
    
    // Increment counters
    await this.incrementCounter(`ip:${ip}`, limits.ip.window);
    if (email) {
      await this.incrementCounter(`email:${email}`, limits.email.window);
    }
    
    return true;
  }
}
```

Configure limits in `app.config.ts`:

```typescript
rateLimit: {
  register: { ip: { max: 5, window: 3600 } }, // 5 per hour
  verify: { 
    ip: { max: 10, window: 900 },  // 10 per 15 min
    email: { max: 5, window: 900 } // 5 per 15 min
  },
  resend: { 
    ip: { max: 3, window: 3600 },  // 3 per hour
    email: { max: 3, window: 3600 }
  },
}
```

### Testing Requirements

Unit tests for:
- OTP generation (length, numeric, randomness)
- OTP hashing and verification
- Expiration validation
- Attempt limits
- Resend cooldown
- Email verification service flows

Integration tests for:
- Registration → Verification → Login flow
- Concurrent verification attempts (race conditions)
- Resend cooldown enforcement
- Invalid/expired OTP handling

## Implementation Order

1. Install dependencies (`nodemailer`, `@types/nodemailer`, `@nestjs/schedule`)
2. Add environment configuration (SMTP + OTP settings)
3. Add rate limit configuration
4. Create `EmailVerification` entity
5. Create database migration
6. Run migration
7. Implement `OtpService`
8. Implement `EmailService`
9. Create `EmailModule`
10. Implement `EmailVerificationService`
11. Implement `RateLimitGuard`
12. Register services in `AuthModule`
13. Create DTOs (`VerifyEmailDto`, `ResendVerificationDto`)
14. Modify `AuthService.registerWithEmail` (no session, send OTP)
15. Add verification endpoints to `AuthController` (with rate limiting)
16. Modify `AuthService.loginWithEmail` (check verification, resend OTP if needed)
17. Add cleanup scheduler
18. Write unit tests
19. Write integration tests

## Breaking Changes

**.registration endpoint response changes**:
- Clients expecting immediate authentication tokens must handle `verificationRequired` response
- Clients must redirect to verification screen
- Clients must call `/auth/email/verify` with OTP

**Migration path**:
- Existing users created before this feature will have `emailVerified: false`
- Consider migration script to set `emailVerified: true` for existing active users with email accounts
- Google-authenticated users already have `emailVerified: true`

## Rollback Plan

1. Remove verification check from login
2. Restore registration to create session immediately
3. Remove verification endpoints
4. Drop `email_verifications` table via migration revert
5. Remove email services and modules

## Redis Rate Limiting

Implement Redis-based rate limiting for verification endpoints to prevent abuse:

### Rate Limit Rules

| Endpoint | Limit Strategy | Configuration |
|----------|---------------|---------------|
| `/auth/email/register` | Per IP | 5 requests per hour |
| `/auth/email/verify` | Per IP + Per Email | 10 attempts per 15 minutes (IP), 5 attempts per 15 minutes (email) |
| `/auth/email/resend-verification` | Per IP + Per Email | 3 requests per hour (IP), 3 requests per hour (email) |
| `/auth/email/login` (unverified) | Per Email | 3 OTP resends per hour |

### Implementation

Use Redis with sliding window algorithm:

```typescript
// Key structure
rate_limit:register:{ip}
rate_limit:verify_ip:{ip}
rate_limit:verify_email:{email}
rate_limit:resend_ip:{ip}
rate_limit:resend_email:{email}
```

Implementation using existing `ioredis`:
- Check rate limit before processing request
- Return 429 with retry-after header if exceeded
- Store attempt counts with TTL matching the window

This prevents:
- Brute-force OTP guessing
- Email bombing via resend
- Registration spam
- Verification endpoint abuse

## Open Questions

~~1. **Existing users migration**: Should we automatically verify existing active email users?~~
   - **Resolution**: No existing users in system, not required
   
~~2. **Rate limiting**: Should we implement Redis-based rate limiting per IP/email?~~
   - **Resolution**: Implement now with Redis (see above)
   
~~3. **Email provider**: Gmail SMTP vs dedicated service (SendGrid, SES)?~~
   - **Resolution**: Gmail SMTP for development, migrate to production provider later

## Success Criteria

- ✅ New users cannot login without email verification
- ✅ OTP delivered via email
- ✅ OTP validated correctly
- ✅ Session created only after verification
- ✅ Google auth flow unchanged
- ✅ No security vulnerabilities
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Login handles unverified users gracefully (resends OTP)
- ✅ Redis rate limiting active on verification endpoints
