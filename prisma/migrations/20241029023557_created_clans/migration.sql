-- CreateTable
CREATE TABLE "clan" (
    "guildId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "isRoleClaimable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clan_pkey" PRIMARY KEY ("guildId","customRoleId")
);

-- CreateTable
CREATE TABLE "clan_member" (
    "clanGuildId" TEXT NOT NULL,
    "clanCustomRoleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedRole" BOOLEAN NOT NULL,

    CONSTRAINT "clan_member_pkey" PRIMARY KEY ("clanGuildId","clanCustomRoleId","userId")
);

-- AddForeignKey
ALTER TABLE "clan_member" ADD CONSTRAINT "clan_member_clanGuildId_clanCustomRoleId_fkey" FOREIGN KEY ("clanGuildId", "clanCustomRoleId") REFERENCES "clan"("guildId", "customRoleId") ON DELETE RESTRICT ON UPDATE CASCADE;
