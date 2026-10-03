import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEntities1790498694965 implements MigrationInterface {
  name = 'UserEntities1790498694965';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."auth_identities_provider_enum" AS ENUM('EMAIL', 'GOOGLE')
        `);
    await queryRunner.query(`
            CREATE TABLE "auth_identities" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "provider" "public"."auth_identities_provider_enum" NOT NULL,
                "provider_user_id" character varying(255),
                "user_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_auth_identity_provider_user" ON "auth_identities" ("provider", "provider_user_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "password_credentials" (
                "user_id" uuid NOT NULL,
                "password_hash" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9b6358b8110bfd9267608e85e0d" PRIMARY KEY ("user_id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."roles_name_enum" AS ENUM('USER', 'ADMIN')
        `);
    await queryRunner.query(`
            CREATE TABLE "roles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" "public"."roles_name_enum" NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"),
                CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "user_roles" (
                "user_id" uuid NOT NULL,
                "role_id" uuid NOT NULL,
                CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'DELETED')
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(320),
                "email_verified" boolean NOT NULL DEFAULT false,
                "display_name" character varying(255),
                "avatar_url" text,
                "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_users_email" ON "users" ("email")
        `);
    await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "refresh_token_hash" character varying(64) NOT NULL,
                "device_id" character varying(255),
                "device_name" character varying(255),
                "user_agent" text,
                "ip_address" inet,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "last_used_at" TIMESTAMP WITH TIME ZONE,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_sessions_refresh_token_hash" ON "sessions" ("refresh_token_hash")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_sessions_user_id" ON "sessions" ("user_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_identities"
            ADD CONSTRAINT "FK_c06a980d83c42611d27a294e55c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "password_credentials"
            ADD CONSTRAINT "FK_9b6358b8110bfd9267608e85e0d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "user_roles"
            ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "user_roles"
            ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "sessions"
            ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"
        `);
    await queryRunner.query(`
            ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"
        `);
    await queryRunner.query(`
            ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"
        `);
    await queryRunner.query(`
            ALTER TABLE "password_credentials" DROP CONSTRAINT "FK_9b6358b8110bfd9267608e85e0d"
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_c06a980d83c42611d27a294e55c"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_sessions_user_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_sessions_refresh_token_hash"
        `);
    await queryRunner.query(`
            DROP TABLE "sessions"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_users_email"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."users_status_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "user_roles"
        `);
    await queryRunner.query(`
            DROP TABLE "roles"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."roles_name_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "password_credentials"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_auth_identity_provider_user"
        `);
    await queryRunner.query(`
            DROP TABLE "auth_identities"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."auth_identities_provider_enum"
        `);
  }
}
