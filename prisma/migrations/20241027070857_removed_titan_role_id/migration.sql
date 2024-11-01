/*
  Warnings:

  - You are about to drop the column `originalTitanRoleId` on the `premium_guild_role_configs` table. All the data in the column will be lost.

*/

-- Transfer from old system to new one
INSERT INTO "role_abilities" ("guildId", "roleId", "canCreateCustomRole", "canGiftLegend", "canCreateClan")
SELECT "guildId", "originalTitanRoleId", true, true, true
FROM "premium_guild_role_configs";

-- AlterTable
ALTER TABLE "premium_guild_role_configs" DROP COLUMN "originalTitanRoleId";
