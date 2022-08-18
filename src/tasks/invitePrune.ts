import { Result } from '@sapphire/framework';
import { Task } from '../lib/schedule/tasks/Task.js';

const header = '[INVITE PRUNE] ';

export class InvitePrune extends Task {
	public override async run() {
		const guildsToCheck = await this.container.prisma.invitePrune.findMany();

		this.container.logger.info(`${header}Starting check for invite pruning...`);

		for (const { guild_id } of guildsToCheck) {
			const guild = this.container.client.guilds.resolve(guild_id);

			if (!guild) {
				this.container.logger.warn(`${header}  Failed to resolve guild ${guild_id} to prune invites for`);
				continue;
			}

			const invitesResult = await Result.fromAsync(guild.invites.fetch({ cache: false }));

			if (invitesResult.isErr()) {
				this.container.logger.warn(
					`${header}  Failed to fetch invites for guild ${guild.name} ${guild_id}`,
					invitesResult.unwrapErr(),
				);
				continue;
			}

			const invites = invitesResult.unwrap();

			for (const invite of invites.values()) {
				// Delete all invites that expire after some time
				if (invite.expiresTimestamp !== null) {
					try {
						await invite.delete(`Invite Prune: deleting invite that would expire eventually`);
					} catch (err) {
						this.container.logger.warn(
							`${header}  Failed to delete invite ${invite.code} for guild ${guild.name} (${guild.id})`,
							err,
						);
					}
				}
			}
		}

		this.container.logger.info(`${header}Finished check for invite pruning`);

		return null;
	}
}
