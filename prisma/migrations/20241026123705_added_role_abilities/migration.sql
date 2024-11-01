ALTER TABLE "titan_guild_role_configs" RENAME TO "premium_guild_role_configs";
ALTER TABLE "premium_guild_role_configs" RENAME COLUMN "giftableRoleId" TO "legendRoleId";

ALTER TABLE "titan_members" RENAME TO "premium_members";

-- CreateTable
CREATE TABLE "role_abilities" (
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "canCreateCustomRole" BOOLEAN NOT NULL,
    "canGiftLegend" BOOLEAN NOT NULL,
    "canCreateClan" BOOLEAN NOT NULL,

    CONSTRAINT "role_abilities_pkey" PRIMARY KEY ("guildId","roleId")
);
