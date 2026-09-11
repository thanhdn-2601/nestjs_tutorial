import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticleTagsTable1788746583621 implements MigrationInterface {
  name = 'CreateArticleTagsTable1788746583621';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "article_tags" ("id" SERIAL NOT NULL, "articleId" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_article_tags_article_name" UNIQUE ("articleId", "name"), CONSTRAINT "PK_article_tags_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_tags" ADD CONSTRAINT "FK_article_tags_article" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_article_tags_name" ON "article_tags" ("name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_article_tags_name"`);
    await queryRunner.query(
      `ALTER TABLE "article_tags" DROP CONSTRAINT "FK_article_tags_article"`,
    );
    await queryRunner.query(`DROP TABLE "article_tags"`);
  }
}
