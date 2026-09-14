import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsTable1788746695343 implements MigrationInterface {
  name = 'CreateCommentsTable1788746695343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" SERIAL NOT NULL, "body" text NOT NULL, "articleId" integer NOT NULL, "authorId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_comments_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_article" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_article" ON "comments" ("articleId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_comments_article"`);
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_article"`,
    );
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
