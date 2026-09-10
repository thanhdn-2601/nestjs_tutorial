import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticleFavoritesTable1788746595343 implements MigrationInterface {
  name = 'CreateArticleFavoritesTable1788746595343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "article_favorites" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "articleId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_article_favorites_user_article" UNIQUE ("userId", "articleId"), CONSTRAINT "PK_article_favorites_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_favorites" ADD CONSTRAINT "FK_article_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_favorites" ADD CONSTRAINT "FK_article_favorites_article" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_article_favorites_article" ON "article_favorites" ("articleId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_article_favorites_article"`);
    await queryRunner.query(
      `ALTER TABLE "article_favorites" DROP CONSTRAINT "FK_article_favorites_article"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_favorites" DROP CONSTRAINT "FK_article_favorites_user"`,
    );
    await queryRunner.query(`DROP TABLE "article_favorites"`);
  }
}
