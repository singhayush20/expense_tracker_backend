import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthIdentity,
  PasswordCredential,
  RoleEntity,
  UserRole,
  User,
} from './entity';
import { UserService } from './service/user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthIdentity,
      PasswordCredential,
      UserRole,
      RoleEntity,
    ]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
