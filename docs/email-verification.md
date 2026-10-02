# OTP-Based Email Verification
## NestJS + TypeORM + PostgreSQL

## 1. Objective

Add OTP-based email verification to the existing authentication system.

The final authentication flow will be:

```text
Email Registration
       │
       ▼
Create User
emailVerified = false
       │
       ▼
Generate 6-digit OTP
       │
       ▼
Hash OTP with Argon2
       │
       ▼
Store EmailVerification
       │
       ▼
Send OTP through email
       │
       ▼
Flutter Verification Screen
       │
       ▼
POST /auth/email/verify
       │
       ├── OTP valid
       │       │
       │       ▼
       │   emailVerified = true
       │       │
       │       ▼
       │   Create Session
       │       │
       │       ▼
       │   Access + Refresh Token
       │
       └── OTP invalid
               │
               ▼
          attempts++
```

Google authentication remains separate:

```text
Google ID Token
      │
      ▼
Google verification
      │
      ▼
Google email_verified = true
      │
      ▼
Create/login User
      │
      ▼
Create Session
```

The existing project architecture places authentication after the local-first application and before cloud synchronization, which is consistent with keeping authentication concerns isolated from the financial domain.

---

# 2. Final Architecture

Use the following responsibilities.

```text
AuthController
      │
      ▼
AuthService
      │
      ├── UserService
      ├── PasswordCredential
      ├── AuthIdentity
      ├── SessionService
      └── EmailVerificationService
                    │
                    ├── OtpService
                    └── EmailService
```

Persistence:

```text
PostgreSQL
│
├── users
├── password_credentials
├── auth_identities
├── sessions
└── email_verifications
```

Infrastructure:

```text
Redis
└── HTTP / OTP abuse rate limiting

SMTP / Email Provider
└── Verification email delivery
```

The important separation is:

```text
EmailVerificationService
        │
        ├── OTP generation
        ├── OTP hashing
        ├── OTP validation
        ├── expiration
        ├── attempt limits
        ├── resend cooldown
        └── verification state
```

while:

```text
SessionService
        │
        ├── access token
        ├── refresh token
        ├── session persistence
        └── session revocation
```

remains responsible for authentication sessions.

---

# 3. Final Folder Structure

Use this structure:

```text
src/
├── core/
│   └── email/
│       ├── email.module.ts
│       └── email.service.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   │
│   │   ├── dto/
│   │   │   ├── email-login.dto.ts
│   │   │   ├── email-register.dto.ts
│   │   │   ├── verify-email.dto.ts
│   │   │   └── resend-verification.dto.ts
│   │   │
│   │   ├── entities/
│   │   │   ├── auth-identity.entity.ts
│   │   │   ├── email-verification.entity.ts
│   │   │   ├── password-credential.entity.ts
│   │   │   └── session.entity.ts
│   │   │
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── refresh-token.guard.ts
│   │   │   └── roles.guard.ts
│   │   │
│   │   └── services/
│   │       ├── google/
│   │       │   └── google-auth.service.ts
│   │       │
│   │       ├── jwt/
│   │       │   └── jwt-token.service.ts
│   │       │
│   │       ├── session/
│   │       │   └── session.service.ts
│   │       │
│   │       └── email-verification/
│   │           ├── email-verification.service.ts
│   │           └── otp.service.ts
│   │
│   └── users/
│       └── entities/
│           └── user.entity.ts
│
└── database/
    └── migrations/
        └── CreateEmailVerifications.ts
```

---

# 4. Install Dependencies

Install OTP hashing and email delivery dependencies:

```bash
npm install argon2 nodemailer
npm install -D @types/nodemailer
```

If you already use `argon2` for passwords, do not install it again.

---

# 5. Environment Configuration

Add:

```env
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM="Expense Tracker <your-email@gmail.com>"

EMAIL_VERIFICATION_OTP_LENGTH=6
EMAIL_VERIFICATION_EXPIRES_IN_MINUTES=10
EMAIL_VERIFICATION_MAX_ATTEMPTS=5
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
EMAIL_VERIFICATION_MAX_RESENDS_PER_HOUR=5
```

Recommended production values:

```text
OTP length              6 digits
OTP expiration          10 minutes
Maximum attempts        5
Resend cooldown         60 seconds
Maximum resends/hour    5
```

For Gmail SMTP, use an App Password rather than your normal Gmail password.

---

# 6. Verify User Entity

Your existing `User` entity must contain:

```typescript
@Column({
  name: 'email_verified',
  type: 'boolean',
  default: false,
})
emailVerified: boolean;
```

The important state is:

```text
New email account
    ↓
emailVerified = false
```

After successful OTP verification:

```text
emailVerified = true
```

Do not create a second boolean such as:

```text
isEmailVerified
```

if `emailVerified` already exists.

---

# 7. Create EmailVerification Entity

Create:

```text
src/modules/auth/entities/email-verification.entity.ts
```

Use:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

export enum EmailVerificationPurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
}

@Entity('email_verifications')
@Index(['userId', 'purpose'])
@Index(['expiresAt'])
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: User;

  @Column({
    name: 'otp_hash',
    type: 'varchar',
    length: 255,
  })
  otpHash: string;

  @Column({
    type: 'enum',
    enum: EmailVerificationPurpose,
  })
  purpose: EmailVerificationPurpose;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt: Date;

  @Column({
    type: 'int',
    default: 0,
  })
  attempts: number;

  @Column({
    name: 'max_attempts',
    type: 'int',
    default: 5,
  })
  maxAttempts: number;

  @Column({
    name: 'consumed_at',
    type: 'timestamptz',
    nullable: true,
  })
  consumedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}
```

Never add:

```typescript
otp: string;
```

The plaintext OTP must never be persisted.

The database stores only:

```text
otpHash
```

---

# 8. Create OTP Service

Create:

```text
src/modules/auth/services/email-verification/otp.service.ts
```

Implementation:

```typescript
import {
  BadRequestException,
  Injectable,
  TooManyRequestsException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import * as argon2 from 'argon2';

import { randomInt } from 'crypto';

@Injectable()
export class OtpService {
  private readonly otpLength: number;
  private readonly expiryMinutes: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.otpLength =
      this.configService.get<number>(
        'EMAIL_VERIFICATION_OTP_LENGTH',
      ) ?? 6;

    this.expiryMinutes =
      this.configService.get<number>(
        'EMAIL_VERIFICATION_EXPIRES_IN_MINUTES',
      ) ?? 10;

    this.maxAttempts =
      this.configService.get<number>(
        'EMAIL_VERIFICATION_MAX_ATTEMPTS',
      ) ?? 5;
  }

  generateOtp(): string {
    const min = 10 ** (this.otpLength - 1);
    const max = 10 ** this.otpLength;

    return randomInt(min, max).toString();
  }

  async hashOtp(
    otp: string,
  ): Promise<string> {
    return argon2.hash(otp);
  }

  async verifyOtp(
    otp: string,
    otpHash: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(
        otpHash,
        otp,
      );
    } catch {
      return false;
    }
  }

  getExpiryDate(): Date {
    return new Date(
      Date.now() +
        this.expiryMinutes * 60 * 1000,
    );
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }

  assertNotExpired(
    expiresAt: Date,
  ): void {
    if (
      expiresAt.getTime() <=
      Date.now()
    ) {
      throw new BadRequestException(
        'Verification code has expired.',
      );
    }
  }

  assertAttemptsAvailable(
    attempts: number,
    maxAttempts: number,
  ): void {
    if (
      attempts >= maxAttempts
    ) {
      throw new TooManyRequestsException(
        'Too many invalid verification attempts. Please request a new code.',
      );
    }
  }
}
```

`crypto.randomInt()` should be used rather than `Math.random()` for OTP generation.

---

# 9. Create Email Service

Create:

```text
src/core/email/email.service.ts
```

```typescript
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger =
    new Logger(EmailService.name);

  private readonly transporter:
    nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const host =
      this.configService.getOrThrow<string>(
        'EMAIL_SMTP_HOST',
      );

    const port =
      this.configService.getOrThrow<number>(
        'EMAIL_SMTP_PORT',
      );

    const secure =
      this.configService.get<boolean>(
        'EMAIL_SMTP_SECURE',
      ) ?? false;

    const user =
      this.configService.getOrThrow<string>(
        'EMAIL_SMTP_USER',
      );

    const password =
      this.configService.getOrThrow<string>(
        'EMAIL_SMTP_PASSWORD',
      );

    this.transporter =
      nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass: password,
        },
      });
  }

  async sendEmailVerificationOtp(
    email: string,
    otp: string,
  ): Promise<void> {
    const from =
      this.configService.getOrThrow<string>(
        'EMAIL_FROM',
      );

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject:
          'Verify your Expense Tracker email',

        text: `
Your Expense Tracker verification code is:

${otp}

This code expires in 10 minutes.

If you did not create an Expense Tracker account,
you can safely ignore this email.
        `.trim(),

        html: this.buildVerificationEmail(
          otp,
        ),
      });
    } catch (error) {
      this.logger.error(
        'Failed to send email verification OTP',
        error instanceof Error
          ? error.stack
          : undefined,
      );

      throw new InternalServerErrorException(
        'Unable to send verification email.',
      );
    }
  }

  private buildVerificationEmail(
    otp: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <body>
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 520px;
              margin: auto;
            "
          >
            <h2>Verify your email</h2>

            <p>
              Use the following verification code
              to verify your Expense Tracker account:
            </p>

            <div
              style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                margin: 24px 0;
              "
            >
              ${otp}
            </div>

            <p>
              This code expires in
              <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not create this account,
              you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}
```

---

# 10. Create Email Module

Create:

```text
src/core/email/email.module.ts
```

```typescript
import {
  Global,
  Module,
} from '@nestjs/common';

import { EmailService } from './email.service';

@Global()
@Module({
  providers: [
    EmailService,
  ],
  exports: [
    EmailService,
  ],
})
export class EmailModule {}
```

Register it in `AppModule`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    EmailModule,

    // ...
  ],
})
export class AppModule {}
```

---

# 11. Create VerifyEmailDto

Create:

```text
src/modules/auth/dto/verify-email.dto.ts
```

```typescript
import {
  IsEmail,
  IsString,
  Length,
} from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
```

---

# 12. Create ResendVerificationDto

Create:

```text
src/modules/auth/dto/resend-verification.dto.ts
```

```typescript
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email: string;
}
```

---

# 13. Implement EmailVerificationService

Create:

```text
src/modules/auth/services/email-verification/email-verification.service.ts
```

```typescript
import {
  BadRequestException,
  Injectable,
  TooManyRequestsException,
} from '@nestjs/common';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  Repository,
} from 'typeorm';

import { ConfigService } from '@nestjs/config';

import {
  EmailVerification,
  EmailVerificationPurpose,
} from '../../entities/email-verification.entity';

import { User } from '../../../users/entities/user.entity';

import { OtpService } from './otp.service';

import { EmailService } from '../../../../core/email/email.service';

@Injectable()
export class EmailVerificationService {
  private readonly resendCooldownSeconds: number;

  constructor(
    @InjectRepository(
      EmailVerification,
    )
    private readonly verificationRepository:
      Repository<EmailVerification>,

    @InjectRepository(User)
    private readonly userRepository:
      Repository<User>,

    private readonly otpService: OtpService,

    private readonly emailService: EmailService,

    private readonly configService: ConfigService,
  ) {
    this.resendCooldownSeconds =
      this.configService.get<number>(
        'EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS',
      ) ?? 60;
  }

  async sendVerificationEmail(
    user: User,
  ): Promise<void> {
    if (user.emailVerified) {
      return;
    }

    const existing =
      await this.verificationRepository.findOne({
        where: {
          userId: user.id,
          purpose:
            EmailVerificationPurpose.EMAIL_VERIFICATION,
        },
        order: {
          createdAt: 'DESC',
        },
      });

    if (existing) {
      const secondsSinceCreation =
        (Date.now() -
          existing.createdAt.getTime()) /
        1000;

      if (
        secondsSinceCreation <
        this.resendCooldownSeconds
      ) {
        throw new TooManyRequestsException(
          `Please wait ${Math.ceil(
            this.resendCooldownSeconds -
              secondsSinceCreation,
          )} seconds before requesting another code.`,
        );
      }
    }

    await this.verificationRepository
      .createQueryBuilder()
      .delete()
      .from(EmailVerification)
      .where(
        'user_id = :userId',
        {
          userId: user.id,
        },
      )
      .andWhere(
        'purpose = :purpose',
        {
          purpose:
            EmailVerificationPurpose.EMAIL_VERIFICATION,
        },
      )
      .execute();

    const otp =
      this.otpService.generateOtp();

    const otpHash =
      await this.otpService.hashOtp(
        otp,
      );

    const verification =
      this.verificationRepository.create({
        userId: user.id,
        otpHash,
        purpose:
          EmailVerificationPurpose.EMAIL_VERIFICATION,
        expiresAt:
          this.otpService.getExpiryDate(),
        attempts: 0,
        maxAttempts:
          this.otpService.getMaxAttempts(),
        consumedAt: null,
      });

    await this.verificationRepository.save(
      verification,
    );

    try {
      await this.emailService
        .sendEmailVerificationOtp(
          user.email,
          otp,
        );
    } catch (error) {
      await this.verificationRepository.delete(
        verification.id,
      );

      throw error;
    }
  }

  async verifyEmail(
    email: string,
    otp: string,
  ): Promise<User> {
    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await this.userRepository.findOne({
        where: {
          email: normalizedEmail,
        },
      });

    if (!user) {
      throw new BadRequestException(
        'Invalid verification code.',
      );
    }

    if (user.emailVerified) {
      throw new BadRequestException(
        'Email is already verified.',
      );
    }

    const verification =
      await this.verificationRepository.findOne({
        where: {
          userId: user.id,
          purpose:
            EmailVerificationPurpose.EMAIL_VERIFICATION,
        },
        order: {
          createdAt: 'DESC',
        },
      });

    if (!verification) {
      throw new BadRequestException(
        'No active verification code exists. Please request a new code.',
      );
    }

    if (verification.consumedAt) {
      throw new BadRequestException(
        'Verification code has already been used.',
      );
    }

    this.otpService.assertAttemptsAvailable(
      verification.attempts,
      verification.maxAttempts,
    );

    this.otpService.assertNotExpired(
      verification.expiresAt,
    );

    const valid =
      await this.otpService.verifyOtp(
        otp,
        verification.otpHash,
      );

    if (!valid) {
      verification.attempts += 1;

      await this.verificationRepository.save(
        verification,
      );

      throw new BadRequestException(
        'Invalid verification code.',
      );
    }

    await this.userRepository.manager.transaction(
      async (manager) => {
        const lockedVerification =
          await manager.findOne(
            EmailVerification,
            {
              where: {
                id: verification.id,
              },
              lock: {
                mode: 'pessimistic_write',
              },
            },
          );

        if (
          !lockedVerification ||
          lockedVerification.consumedAt
        ) {
          throw new BadRequestException(
            'Verification code has already been used.',
          );
        }

        lockedVerification.consumedAt =
          new Date();

        user.emailVerified = true;

        await manager.save(
          EmailVerification,
          lockedVerification,
        );

        await manager.save(
          User,
          user,
        );
      },
    );

    return user;
  }

  async resendVerificationEmail(
    email: string,
  ): Promise<void> {
    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await this.userRepository.findOne({
        where: {
          email: normalizedEmail,
        },
      });

    if (
      !user ||
      user.emailVerified
    ) {
      return;
    }

    await this.sendVerificationEmail(
      user,
    );
  }
}
```

---

# 14. Register the Service in AuthModule

Update:

```text
src/modules/auth/auth.module.ts
```

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { User } from '../users/entities/user.entity';

import {
  AuthIdentity,
} from './entities/auth-identity.entity';

import {
  PasswordCredential,
} from './entities/password-credential.entity';

import {
  Session,
} from './entities/session.entity';

import {
  EmailVerification,
} from './entities/email-verification.entity';

import {
  EmailVerificationService,
} from './services/email-verification/email-verification.service';

import {
  OtpService,
} from './services/email-verification/otp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthIdentity,
      PasswordCredential,
      Session,
      EmailVerification,
    ]),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    EmailVerificationService,
    OtpService,

    // existing providers
  ],

  exports: [
    AuthService,
    EmailVerificationService,
  ],
})
export class AuthModule {}
```

---

# 15. Modify Email Registration

Your existing registration flow should become:

```text
POST /auth/email/register
        │
        ▼
Normalize email
        │
        ▼
Check existing user
        │
        ▼
Create User
emailVerified = false
        │
        ├── PasswordCredential
        │
        └── AuthIdentity
        │
        ▼
Send verification OTP
        │
        ▼
Return verificationRequired=true
```

The registration method should **not** create an authenticated session.

Conceptually:

```typescript
async registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<{
  verificationRequired: true;
}> {
  const normalizedEmail =
    email.trim().toLowerCase();

  const existingUser =
    await this.userService.findByEmail(
      normalizedEmail,
    );

  if (existingUser) {
    throw new ConflictException(
      'An account with this email already exists.',
    );
  }

  const passwordHash =
    await argon2.hash(password);

  const user =
    await this.userRepository.manager.transaction(
      async (manager) => {
        const newUser =
          manager.create(User, {
            email: normalizedEmail,
            displayName,
            emailVerified: false,
            isActive: true,
          });

        const savedUser =
          await manager.save(
            User,
            newUser,
          );

        const passwordCredential =
          manager.create(
            PasswordCredential,
            {
              userId: savedUser.id,
              passwordHash,
            },
          );

        await manager.save(
          PasswordCredential,
          passwordCredential,
        );

        const identity =
          manager.create(
            AuthIdentity,
            {
              userId: savedUser.id,
              provider:
                AuthProvider.EMAIL,
              providerSubject:
                normalizedEmail,
            },
          );

        await manager.save(
          AuthIdentity,
          identity,
        );

        return savedUser;
      },
    );

  await this.emailVerificationService
    .sendVerificationEmail(user);

  return {
    verificationRequired: true,
  };
}
```

Use your existing entity property names if they differ.

---

# 16. Important Transaction Decision

Do not send the email while the database transaction is still open.

Correct:

```text
Transaction
    │
    ├── Create User
    ├── Create PasswordCredential
    └── Create AuthIdentity
    │
    ▼
Transaction commits
    │
    ▼
Send OTP email
```

Incorrect:

```text
Transaction starts
    │
    ├── Create User
    ├── Send email
    └── Commit
```

Email delivery is an external network operation and should not hold a database transaction open.

---

# 17. Add Verify Endpoint

In `AuthController`:

```typescript
@Post('email/verify')
async verifyEmail(
  @Body() dto: VerifyEmailDto,
  @Req() request: Request,
) {
  const user =
    await this.emailVerificationService
      .verifyEmail(
        dto.email,
        dto.otp,
      );

  return this.authService.createSession(
    user,
    {
      ipAddress: request.ip,
      userAgent:
        request.headers['user-agent'],
    },
  );
}
```

This reuses the existing session-generation mechanism.

The endpoint should return your normal authentication response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900
}
```

---

# 18. Add Resend Endpoint

In `AuthController`:

```typescript
@Post('email/resend-verification')
async resendVerification(
  @Body()
  dto: ResendVerificationDto,
) {
  await this.emailVerificationService
    .resendVerificationEmail(
      dto.email,
    );

  return {
    message:
      'If the account requires verification, a verification code has been sent.',
  };
}
```

The response must deliberately be generic.

Do not expose whether an email address exists.

---

# 19. Modify Email Login

Email login must reject unverified accounts.

After validating the password:

```typescript
if (!user.emailVerified) {
  throw new ForbiddenException(
    'Please verify your email before signing in.',
  );
}
```

The login flow becomes:

```text
Email
  │
  ▼
Find User
  │
  ▼
Check Password
  │
  ▼
Check Active
  │
  ▼
Check emailVerified
  │
  ├── false → 403
  │
  └── true
         │
         ▼
    createSession()
```

Do not return JWTs to an unverified email account.

---

# 20. Google Authentication

Google authentication should remain independent from email OTP.

Your existing Google service already extracts:

```typescript
emailVerified: boolean;
```

When creating a Google user:

```typescript
const user =
  manager.create(User, {
    email: googleUser.email,
    displayName:
      googleUser.displayName,
    avatarUrl:
      googleUser.avatarUrl,
    emailVerified:
      googleUser.emailVerified,
    isActive: true,
  });
```

For an existing user:

```typescript
if (
  googleUser.emailVerified &&
  !user.emailVerified
) {
  user.emailVerified = true;

  await this.userRepository.save(
    user,
  );
}
```

Do not send an email OTP after successful Google authentication when the Google identity is verified.

---

# 21. Create Database Migration

Create:

```bash
npx typeorm migration:create src/database/migrations/CreateEmailVerifications
```

Migration:

```typescript
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateEmailVerifications
  implements MigrationInterface
{
  name =
    'CreateEmailVerifications';

  async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name:
          'email_verifications',

        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default:
              'gen_random_uuid()',
          },

          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },

          {
            name: 'otp_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },

          {
            name: 'purpose',
            type: 'varchar',
            length: '50',
            default:
              `'EMAIL_VERIFICATION'`,
          },

          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },

          {
            name: 'attempts',
            type: 'integer',
            default: 0,
          },

          {
            name: 'max_attempts',
            type: 'integer',
            default: 5,
          },

          {
            name: 'consumed_at',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'email_verifications',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'email_verifications',
      new TableIndex({
        name:
          'IDX_EMAIL_VERIFICATION_USER_PURPOSE',
        columnNames: [
          'user_id',
          'purpose',
        ],
      }),
    );

    await queryRunner.createIndex(
      'email_verifications',
      new TableIndex({
        name:
          'IDX_EMAIL_VERIFICATION_EXPIRES_AT',
        columnNames: [
          'expires_at',
        ],
      }),
    );
  }

  async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.dropTable(
      'email_verifications',
    );
  }
}
```

Run:

```bash
npm run migration:run
```

---

# 22. Final API Contract

The authentication API should now be:

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/email/register` | Public | Register account |
| `POST /auth/email/verify` | Public | Verify OTP and authenticate |
| `POST /auth/email/resend-verification` | Public | Send another OTP |
| `POST /auth/email/login` | Public | Login verified user |
| `POST /auth/google` | Public | Google sign-in |
| `POST /auth/refresh` | Refresh token | Refresh session |
| `POST /auth/logout` | Access token | Logout |
| `GET /auth/me` | Access token | Current user |

---

# 23. Registration Request

```http
POST /auth/email/register
Content-Type: application/json
```

```json
{
  "email": "ayush@example.com",
  "password": "StrongPassword123!",
  "displayName": "Ayush"
}
```

Response:

```json
{
  "verificationRequired": true
}
```

No access token.

No refresh token.

---

# 24. Verify Request

```http
POST /auth/email/verify
Content-Type: application/json
```

```json
{
  "email": "ayush@example.com",
  "otp": "482913"
}
```

Successful response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900
}
```

---

# 25. Resend Request

```http
POST /auth/email/resend-verification
Content-Type: application/json
```

```json
{
  "email": "ayush@example.com"
}
```

Response:

```json
{
  "message": "If the account requires verification, a verification code has been sent."
}
```

---

# 26. Flutter Flow

The Flutter flow should be:

```text
RegisterPage
     │
     ▼
POST /auth/email/register
     │
     ▼
verificationRequired = true
     │
     ▼
VerifyEmailPage
     │
     ├── OTP input
     ├── Countdown
     ├── Verify
     └── Resend
             │
             ▼
      POST /auth/email/verify
             │
             ▼
       Store session
             │
             ▼
            Home
```

For resend:

```text
VerifyEmailPage
      │
      ▼
Wait 60 seconds
      │
      ▼
Resend enabled
      │
      ▼
POST /auth/email/resend-verification
```

The Flutter application should not generate, store, or validate the OTP itself. The backend is authoritative.

---

# 27. Error Handling

Recommended API behavior:

### Invalid OTP

```http
400 Bad Request
```

```json
{
  "message": "Invalid verification code."
}
```

### Expired OTP

```http
400 Bad Request
```

```json
{
  "message": "Verification code has expired."
}
```

### Too many attempts

```http
429 Too Many Requests
```

```json
{
  "message": "Too many invalid verification attempts. Please request a new code."
}
```

### Resend too quickly

```http
429 Too Many Requests
```

```json
{
  "message": "Please wait before requesting another code."
}
```

### Already verified

```http
400 Bad Request
```

or make the operation idempotent depending on your API convention.

---

# 28. Security Requirements

The implementation must satisfy all of these:

```text
✓ OTP generated using crypto.randomInt()
✓ OTP never stored in plaintext
✓ OTP hashed with Argon2
✓ OTP expires after 10 minutes
✓ Maximum 5 verification attempts
✓ OTP becomes unusable after successful verification
✓ Only one active verification OTP per user/purpose
✓ Resend cooldown
✓ Resend rate limit
✓ Generic resend response
✓ Generic invalid OTP response
✓ Unverified users cannot email-login
✓ No JWT issued during registration
✓ Session created only after verification
✓ Google verified accounts can bypass email OTP
✓ Email sending occurs outside DB transaction
✓ Verification state update occurs transactionally
```

---

# 29. Redis Rate Limiting

Your PostgreSQL `EmailVerification` record should not be responsible for high-volume API rate limiting.

Use Redis for:

```text
IP → registration attempts
IP → verification attempts
IP → resend attempts
Email → resend attempts
```

Conceptually:

```text
Redis

rate_limit:email_register:{ip}
rate_limit:email_verify:{ip}
rate_limit:email_resend:{email}
rate_limit:email_resend_ip:{ip}
```

PostgreSQL remains responsible for:

```text
EmailVerification
├── otpHash
├── expiresAt
├── attempts
└── consumedAt
```

This separation is particularly appropriate because the project already uses Redis as infrastructure while PostgreSQL remains the persistent backend database.

---

# 30. Cleanup Expired Verification Records

Expired verification rows do not need to remain indefinitely.

Add a scheduled cleanup job.

For example, using NestJS scheduling:

```bash
npm install @nestjs/schedule
```

Then:

```typescript
@Injectable()
export class EmailVerificationCleanupService {
  constructor(
    @InjectRepository(
      EmailVerification,
    )
    private readonly repository:
      Repository<EmailVerification>,
  ) {}

  @Cron('0 */30 * * * *')
  async cleanup(): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(EmailVerification)
      .where(
        'expires_at < NOW()',
      )
      .execute();
  }
}
```

This runs every 30 minutes.

If your existing application already has a scheduler, integrate this cleanup into that infrastructure instead of creating another scheduling mechanism.

---

# 31. Testing

The feature is not complete until these tests pass.

## OTP service

Test:

```text
Generate correct OTP length
Generate numeric OTP
Hash OTP
Verify correct OTP
Reject incorrect OTP
Calculate expiration
Reject expired OTP
Reject attempts >= maxAttempts
```

## EmailVerificationService

Test:

```text
Send verification email
Create verification record
Hash OTP
Reject unverified user without verification record
Reject expired OTP
Reject invalid OTP
Increment attempts
Reject after maximum attempts
Successfully verify OTP
Set emailVerified=true
Consume OTP
Reject reused OTP
Resend OTP
Reject resend before cooldown
```

## AuthService

Test:

```text
Register email user
User starts with emailVerified=false
Registration does not create session
Verified user can login
Unverified user cannot login
Google verified user can authenticate
```

## Controller

Test:

```text
POST /auth/email/register
POST /auth/email/verify
POST /auth/email/resend-verification
POST /auth/email/login
```

---

# 32. Important Race Conditions to Test

Test this case:

```text
Request A ── verify OTP ──┐
                          ├── same OTP
Request B ── verify OTP ──┘
```

Only one request should succeed.

The successful transaction should atomically perform:

```text
consumedAt = now
emailVerified = true
```

The second request must fail because the verification row has already been consumed.

This is why the verification record should be locked with:

```typescript
lock: {
  mode: 'pessimistic_write',
}
```

inside the transaction.

---

# 33. Final Database Model

The authentication database should look like:

```text
users
────────────────────────
id
email
display_name
avatar_url
email_verified
is_active
created_at
updated_at


password_credentials
────────────────────────
id
user_id
password_hash
created_at
updated_at


auth_identities
────────────────────────
id
user_id
provider
provider_subject
created_at


email_verifications
────────────────────────
id
user_id
otp_hash
purpose
expires_at
attempts
max_attempts
consumed_at
created_at


sessions
────────────────────────
id
user_id
refresh_token_hash
device_id
ip_address
user_agent
expires_at
revoked_at
created_at
```

---

# 34. Final End-to-End Behavior

### New email user

```text
User enters email/password
        ↓
POST /auth/email/register
        ↓
Create User
emailVerified=false
        ↓
Create PasswordCredential
        ↓
Create AuthIdentity
        ↓
Generate OTP
        ↓
Hash OTP
        ↓
Store EmailVerification
        ↓
Send email
        ↓
Return verificationRequired=true
```

### Verify

```text
User enters OTP
        ↓
POST /auth/email/verify
        ↓
Find user
        ↓
Find active verification
        ↓
Check consumedAt
        ↓
Check attempts
        ↓
Check expiration
        ↓
Argon2.verify()
        ↓
Lock verification row
        ↓
consumedAt = now
        ↓
emailVerified = true
        ↓
Commit transaction
        ↓
createSession()
        ↓
Access + Refresh tokens
```

### Login afterwards

```text
POST /auth/email/login
        ↓
Find user
        ↓
Verify password
        ↓
Check active
        ↓
Check emailVerified
        ↓
createSession()
        ↓
Access + Refresh tokens
```

### Google

```text
Google ID token
        ↓
Verify token
        ↓
Google email_verified=true
        ↓
Create/find user
        ↓
emailVerified=true
        ↓
createSession()
```

---

# 35. Implementation Order

Implement the feature in exactly this order:

```text
1. Verify User.emailVerified
        ↓
2. Add EmailVerification entity
        ↓
3. Create database migration
        ↓
4. Run migration
        ↓
5. Add OTP configuration
        ↓
6. Implement OtpService
        ↓
7. Implement EmailService
        ↓
8. Create EmailModule
        ↓
9. Implement EmailVerificationService
        ↓
10. Register EmailVerificationService in AuthModule
        ↓
11. Create VerifyEmailDto
        ↓
12. Create ResendVerificationDto
        ↓
13. Modify email registration
        ↓
14. Remove session creation from registration
        ↓
15. Add /auth/email/verify
        ↓
16. Add /auth/email/resend-verification
        ↓
17. Modify email login
        ↓
18. Verify Google authentication behavior
        ↓
19. Add Redis rate limiting
        ↓
20. Add expired-record cleanup
        ↓
21. Add unit tests
        ↓
22. Add integration tests
        ↓
23. Test concurrent verification
        ↓
24. Test complete Flutter flow
```

---

# 36. Final Definition of Done

Email verification is complete when:

```text
□ User registers with email/password
□ User is created with emailVerified=false
□ Password is securely hashed
□ Email AuthIdentity is created
□ OTP is generated securely
□ OTP is never persisted in plaintext
□ OTP is Argon2 hashed
□ OTP expires
□ OTP attempt limit works
□ Resend cooldown works
□ Verification email is delivered
□ OTP verification works
□ Invalid OTP increments attempts
□ Expired OTP is rejected
□ Consumed OTP cannot be reused
□ Verification update is transactional
□ emailVerified becomes true
□ Session is created after verification
□ Unverified user cannot login
□ Verified user can login normally
□ Google verified users can authenticate
□ Resend endpoint does not reveal account existence
□ Redis rate limiting is enabled
□ Expired verification records are cleaned
□ Unit tests pass
□ Integration tests pass
□ Concurrent verification is safe
□ Flutter verification flow works
```

The final separation should remain:

```text
User
  │
  └── identity/account state

EmailVerification
  │
  └── temporary email ownership proof

Session
  │
  └── authenticated login state

OtpService
  │
  └── OTP generation/verification

EmailService
  │
  └── email delivery

Redis
  │
  └── abuse/rate limiting
```

This keeps email verification independent from password authentication, Google authentication, JWT generation, and session management while still integrating cleanly with the existing authentication architecture.