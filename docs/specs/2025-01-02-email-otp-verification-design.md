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

**New**: Reject unverified users

```typescript
if (!user.emailVerified) {
  throw new ForbiddenException('Please verify your email before signing in.');
}
```

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

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Invalid OTP | 400 | `{ "message": "Invalid verification code." }` |
| Expired OTP | 400 | `{ "message": "Verification code has expired." }` |
| Too many attempts | 429 | `{ "message": "Too many invalid attempts. Request a new code." }` |
| Resend too soon | 429 | `{ "message": "Please wait X seconds before requesting another code." }` |
| Already verified | 400 | `{ "message": "Email is already verified." }` |
| No verification found | 400 | `{ "message": "Invalid verification code." }` |

### Cleanup Strategy

Expired verification records accumulated in database. Implement scheduled cleanup:

- Run every 30 minutes
- Delete records where `expires_at < NOW()`
- Use `@nestjs/schedule` or existing scheduler

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

1. Install dependencies (`nodemailer`, `@types/nodemailer`)
2. Add environment configuration
3. Create `EmailVerification` entity
4. Create database migration
5. Run migration
6. Implement `OtpService`
7. Implement `EmailService`
8. Create `EmailModule`
9. Implement `EmailVerificationService`
10. Register services in `AuthModule`
11. Create DTOs (`VerifyEmailDto`, `ResendVerificationDto`)
12. Modify `AuthService.registerWithEmail`
13. Add verification endpoints to `AuthController`
14. Modify `AuthService.loginWithEmail` to check verification
15. Add cleanup scheduler
16. Write unit tests
17. Write integration tests

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

## Open Questions

1. **Existing users migration**: Should we automatically verify existing active email users?
   - Recommendation: Yes, via one-time migration script
   
2. **Rate limiting**: Should we implement Redis-based rate limiting per IP/email?
   - Recommendation: Yes, but can be added after core feature
   
3. **Email provider**: Gmail SMTP vs dedicated service (SendGrid, SES)?
   - Recommendation: Start with Gmail SMTP (development), migrate to production provider later

## Success Criteria

- ✅ New users cannot login without email verification
- ✅ OTP delivered via email
- ✅ OTP validated correctly
- ✅ Session created only after verification
- ✅ Google auth flow unchanged
- ✅ No security vulnerabilities
- ✅ All tests passing
- ✅ Documentation updated
