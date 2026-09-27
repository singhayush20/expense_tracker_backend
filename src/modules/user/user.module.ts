import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthIdentity } from './entity/auth-identity.entity';
import { PasswordCredential } from './entity/password-credential.entity';
import { RoleEntity } from './entity/role.entity';
import { UserRole } from './entity/user-role.entity';
import { User } from './entity/user.entity';
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
})
export class UserModule {}
