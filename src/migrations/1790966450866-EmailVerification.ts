import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailVerification1790966450866 implements MigrationInterface {
  name = 'EmailVerification1790966450866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."email_verifications_purpose_enum" AS ENUM('EMAIL_VERIFICATION')
        `);
    await queryRunner.query(`
            CREATE TABLE "email_verifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "otp_hash" character varying(255) NOT NULL,
                "purpose" "public"."email_verifications_purpose_enum" NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "attempts" integer NOT NULL DEFAULT '0',
                "max_attempts" integer NOT NULL DEFAULT '5',
                "consumed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_c1ea2921e767f83cd44c0af203f" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_73b90c6614a68d01ec06131c2b" ON "email_verifications" ("expires_at")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_ceccc754e544535da5bdcf8449" ON "email_verifications" ("user_id", "purpose")
        `);
    await queryRunner.query(`
            ALTER TABLE "email_verifications"
            ADD CONSTRAINT "FK_c4f1838323ae1dff5aa00148915" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "email_verifications" DROP CONSTRAINT "FK_c4f1838323ae1dff5aa00148915"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_ceccc754e544535da5bdcf8449"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_73b90c6614a68d01ec06131c2b"
        `);
    await queryRunner.query(`
            DROP TABLE "email_verifications"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."email_verifications_purpose_enum"
        `);
  }
}
