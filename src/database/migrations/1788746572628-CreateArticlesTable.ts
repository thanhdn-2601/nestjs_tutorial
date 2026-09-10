import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticlesTable1788746572628 implements MigrationInterface {
  name = 'CreateArticlesTable1788746572628';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" SERIAL NOT NULL, "slug" character varying NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL, "body" text NOT NULL, "authorId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_articles_slug" UNIQUE ("slug"), CONSTRAINT "PK_articles_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD CONSTRAINT "FK_articles_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "FK_articles_author"`,
    );
    await queryRunner.query(`DROP TABLE "articles"`);
  }
}
