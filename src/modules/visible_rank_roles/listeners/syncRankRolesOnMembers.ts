import { RoleSyncType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { GuildMember, PartialGuildMember } from 'discord.js';

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberUpdate })
export class SyncRankRoles extends Listener<typeof Events.GuildMemberUpdate> {
	public override async run(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
		const toggleableRoles = await this.container.prisma.roleSync.findMany({
			where: {
				type: RoleSyncType.VisibleRank,
				origin_guild_id: newMember.guild.id,
			},
		});

		for (const { origin_role_id: mainRankRole, destination_role_id: visibleRankRole } of toggleableRoles) {
			// Check if the user had the role before, and now they don't have it
			// if they don't have it anymore, and they have the visible role, remove it

			// Check if the user has the main role
			const hadRole = oldMember.roles.cache.has(mainRankRole);

			if (!hadRole) {
				continue;
			}

			const hasRole = newMember.roles.cache.has(mainRankRole);
			const hasVisibleRole = newMember.roles.cache.has(visibleRankRole);

			if (!hasRole && hasVisibleRole) {
				try {
					await newMember.roles.remove(visibleRankRole, 'Rank role visibility toggled');
				} catch (error) {
					this.container.logger.warn(
						`[Sync Rank Roles] Failed to remove visible role after user lost the original role`,
						{ mainRankRole, visibleRankRole, user: newMember.id },
						error,
					);
				}
			}
		}
	}
}
