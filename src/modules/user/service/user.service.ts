import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthIdentityProvider } from '../../auth/enums';
import { AuthIdentity, PasswordCredential, User, UserRole } from '../entity';
import { UserStatus, Role } from '../enum';

export interface CreateUserParams {
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(AuthIdentity)
    private readonly identitiesRepository: Repository<AuthIdentity>,
    @InjectRepository(PasswordCredential)
    private readonly passwordCredentialsRepository: Repository<PasswordCredential>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        email: email.toLowerCase().trim(),
      },
    });
  }

  async findByGoogleSubject(googleSubject: string): Promise<User | null> {
    const identity = await this.identitiesRepository.findOne({
      where: {
        provider: AuthIdentityProvider.GOOGLE,
        providerUserId: googleSubject,
      },
      relations: {
        user: true,
      },
    });

    return identity?.user ?? null;
  }

  async createUser(params: CreateUserParams): Promise<User> {
    const email = params.email ? params.email.toLowerCase().trim() : null;

    if (email) {
      const existing = await this.findByEmail(email);

      if (existing) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    const user = this.usersRepository.create({
      email,
      displayName: params.displayName ?? null,
      avatarUrl: params.avatarUrl ?? null,
      emailVerified: params.emailVerified ?? false,
      status: UserStatus.ACTIVE,
    });

    return this.usersRepository.save(user);
  }

  async createPasswordCredential(
    userId: string,
    passwordHash: string,
  ): Promise<PasswordCredential> {
    const existing = await this.passwordCredentialsRepository.findOne({
      where: {
        userId,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Password authentication is already configured',
      );
    }

    const credential = this.passwordCredentialsRepository.create({
      userId,
      passwordHash,
    });

    return this.passwordCredentialsRepository.save(credential);
  }

  async getPasswordCredential(
    userId: string,
  ): Promise<PasswordCredential | null> {
    return this.passwordCredentialsRepository.findOne({
      where: {
        userId,
      },
    });
  }

  async createIdentity(
    userId: string,
    provider: AuthIdentityProvider,
    providerUserId: string | null,
  ): Promise<AuthIdentity> {
    const identity = this.identitiesRepository.create({
      userId,
      provider,
      providerUserId,
    });

    return this.identitiesRepository.save(identity);
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await this.userRolesRepository.find({
      where: {
        userId,
      },
      relations: {
        role: true,
      },
    });

    return rows.map((row) => row.role.name);
  }
}
