import { HttpStatus, Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthIdentityProvider } from '../../auth/enums';
import {
  AuthIdentity,
  PasswordCredential,
  User,
  UserRole,
  RoleEntity,
} from '../entity';
import { UserStatus, Role } from '../enum';
import { AppException } from '../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../exceptionn-handling/exception-codes';

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
      throw new AppException(
        ExceptionCodes.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
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
        throw new AppException(
          ExceptionCodes.USER_ALREADY_EXISTS,
          'A user with this email already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    const user = this.usersRepository.create({
      email,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
      status: UserStatus.ACTIVE,
    });

    return this.usersRepository.save(user);
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

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.userRolesRepository.find({
      where: {
        userId,
      },
      relations: {
        role: true,
      },
    });

    return userRoles.map((userRole) => userRole.role.name);
  }

  async assignRole(userId: string, roleName: Role): Promise<void> {
    // Check if user already has this role
    const existingRole = await this.userRolesRepository.findOne({
      where: {
        userId,
        role: {
          name: roleName,
        },
      },
      relations: {
        role: true,
      },
    });

    if (existingRole) {
      return;
    }

    // Find the role entity by name
    const roleEntity = await this.userRolesRepository.manager.findOne(
      RoleEntity,
      {
        where: {
          name: roleName,
        },
      },
    );

    if (!roleEntity) {
      throw new AppException(
        ExceptionCodes.ROLES_NOT_FOUND,
        'Role not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Create the user-role association
    const userRole = this.userRolesRepository.create({
      userId,
      roleId: roleEntity.id,
    });

    await this.userRolesRepository.save(userRole);
  }
}
