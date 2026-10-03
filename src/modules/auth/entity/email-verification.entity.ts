import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

export enum EmailVerificationPurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
}

@Entity('email_verifications')
@Index(['userId', 'purpose'])
@Index(['expiresAt'])
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
    name: 'otp_hash',
    type: 'varchar',
    length: '255',
  })
  otpHash!: string;

  @Column({
    type: 'enum',
    enum: EmailVerificationPurpose,
  })
  purpose!: EmailVerificationPurpose;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt!: Date;

  @Column({
    type: 'int',
    default: 0,
  })
  attempts!: number;

  @Column({
    name: 'max_attempts',
    type: 'int',
    default: 5,
  })
  maxAttempts!: number;

  @Column({
    name: 'consumed_at',
    type: 'timestamptz',
    nullable: true,
  })
  consumedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;
}
