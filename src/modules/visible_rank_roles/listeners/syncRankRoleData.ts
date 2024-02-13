import { RoleSyncType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { Role } from 'discord.js';

@ApplyOptions<Listener.Options>({ event: Events.GuildRoleUpdate })
export class SyncRankRoleData extends Listener<typeof Events.GuildRoleUpdate> {
	public override async run(oldRole: Role, newRole: Role) {
		if (
			oldRole.name === newRole.name &&
			oldRole.color === newRole.color &&
			oldRole.icon === newRole.icon &&
			oldRole.unicodeEmoji === newRole.unicodeEmoji
		) {
			return;
		}

		const syncRole = await this.container.prisma.roleSync.findFirst({
			where: {
				origin_role_id: oldRole.id,
				type: RoleSyncType.VisibleRank,
			},
		});

		if (syncRole === null) {
			return;
		}

		// Update the destination role to match the origin role
		const destinationRole = newRole.guild.roles.resolve(syncRole.destination_role_id);

		if (destinationRole === null) {
			this.container.logger.warn(
				`[Sync Rank Role data] Destination role was not found, cannot keep roles in sync`,
				syncRole,
			);
			return;
		}

		await destinationRole.edit({
			name: newRole.name,
			color: newRole.color,
			icon: newRole.iconURL({ size: 4_096 }),
			unicodeEmoji: newRole.unicodeEmoji,
			reason: 'Sync rank role data between origin and destination role',
		});
	}
}
