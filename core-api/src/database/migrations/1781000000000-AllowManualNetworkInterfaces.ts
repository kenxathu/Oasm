import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowManualNetworkInterfaces1781000000000
  implements MigrationInterface
{
  name = 'AllowManualNetworkInterfaces1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "network_interfaces" ALTER COLUMN "workerId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "network_interfaces" WHERE "workerId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "network_interfaces" ALTER COLUMN "workerId" SET NOT NULL`,
    );
  }
}
