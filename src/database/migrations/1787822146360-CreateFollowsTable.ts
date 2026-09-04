import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFollowsTable1787822146360 implements MigrationInterface {
  name = 'CreateFollowsTable1787822146360';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "follows" ("id" SERIAL NOT NULL, "followerId" integer NOT NULL, "followeeId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_follows_follower_followee" UNIQUE ("followerId", "followeeId"), CONSTRAINT "PK_dd904ba2b939f36eaf1e2fdd8f1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_follower" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_followee" FOREIGN KEY ("followeeId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_followee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_follower"`,
    );
    await queryRunner.query(`DROP TABLE "follows"`);
  }
}
