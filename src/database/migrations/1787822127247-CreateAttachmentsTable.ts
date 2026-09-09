import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachmentsTable1787822127247 implements MigrationInterface {
  name = 'CreateAttachmentsTable1787822127247';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "attachments_attachabletype_enum" AS ENUM('user')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attachments" ("id" uuid NOT NULL, "attachableType" "attachments_attachabletype_enum" NOT NULL, "attachableId" integer NOT NULL, "url" character varying NOT NULL, "fileName" character varying NOT NULL, "fileType" character varying NOT NULL, "fileSize" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_attachable" ON "attachments" ("attachableType", "attachableId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_attachments_attachable"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP TYPE "attachments_attachabletype_enum"`);
  }
}
