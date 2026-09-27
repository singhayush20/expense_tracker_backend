import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './user.entity';
import { AuthIdentityProvider } from '../../auth/enums/auth-identity-provider.enum';

@Entity('auth_identities')
@Index('uq_auth_identity_provider_user', ['provider', 'providerUserId'], {
  unique: true,
})
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: AuthIdentityProvider,
  })
  provider!: AuthIdentityProvider;

  /**
   * For Google this is Google's `sub`.
   *
   * For EMAIL this can remain null because the
   * email identity is represented by the user email.
   */
  @Column({
    name: 'provider_user_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerUserId?: string | null | undefined;

  @ManyToOne(() => User, (user) => user.identities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
