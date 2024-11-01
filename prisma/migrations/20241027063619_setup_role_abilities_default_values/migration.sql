-- AlterTable
ALTER TABLE "premium_guild_role_configs" RENAME CONSTRAINT "titan_guild_role_configs_pkey" TO "premium_guild_role_configs_pkey";

-- AlterTable
ALTER TABLE "premium_members" RENAME CONSTRAINT "titan_members_pkey" TO "premium_members_pkey";

-- AlterTable
ALTER TABLE "role_abilities" ALTER COLUMN "canCreateCustomRole" SET DEFAULT false,
ALTER COLUMN "canGiftLegend" SET DEFAULT false,
ALTER COLUMN "canCreateClan" SET DEFAULT false;
