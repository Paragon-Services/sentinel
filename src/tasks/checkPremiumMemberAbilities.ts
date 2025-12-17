import { MemberAbilities } from '../lib/abilities/MemberAbilities.js';
import { Task } from '../lib/schedule/tasks/Task.js';

/**
 * Daily task that checks if premium members still have their expected abilities.
 * Logs any discrepancies for monitoring and debugging.
 */
export class CheckPremiumMemberAbilities extends Task {
	public async run() {
		this.container.logger.info('[PREMIUM ABILITY CHECK] Starting daily premium member ability check...');

		const premiumMembers = await this.container.prisma.premiumMember.findMany({
			select: {
				userId: true,
				guildId: true,
				customRoleId: true,
			},
		});

		if (premiumMembers.length === 0) {
			this.container.logger.info('[PREMIUM ABILITY CHECK] No premium members found in database.');
			return null;
		}

		let totalChecked = 0;
		let totalMismatches = 0;

		for (const premiumMember of premiumMembers) {
			try {
				const guild = this.container.client.guilds.resolve(premiumMember.guildId);

				if (!guild) {
					this.container.logger.warn(
						`[PREMIUM ABILITY CHECK] Guild ${premiumMember.guildId} not found for user ${premiumMember.userId}`,
					);
					continue;
				}

				let member;

				try {
					member = await guild.members.fetch(premiumMember.userId);
				} catch {
					this.container.logger.warn(
						`[PREMIUM ABILITY CHECK] User ${premiumMember.userId} not found in guild ${guild.name} (${guild.id}) - may have left the server`,
					);

					continue;
				}

				const memberAbilities = new MemberAbilities(member);
				await memberAbilities.computeAbilities();

				const hasAnyAbility =
					memberAbilities.hasAbility('canCreateClan') ||
					memberAbilities.hasAbility('canCreateCustomRole') ||
					memberAbilities.hasAbility('canGiftLegend') ||
					memberAbilities.hasAbility('areAbilitiesMultiGuild');

				totalChecked++;

				if (!hasAnyAbility) {
					totalMismatches++;
					this.container.logger.warn(
						`[PREMIUM ABILITY CHECK] [PREMIUM MEMBER LOST ABILITIES] User ${member.user.tag} (${premiumMember.userId}) in guild ${guild.name} (${guild.id}) is in the premium members database but has NO premium abilities in Discord. This indicates they lost their premium role.`,
						{
							userId: premiumMember.userId,
							guildId: premiumMember.guildId,
							guildName: guild.name,
							userTag: member.user.tag,
							customRoleId: premiumMember.customRoleId,
						},
					);
				}
			} catch (error) {
				this.container.logger.error(
					`[PREMIUM ABILITY CHECK] Error checking premium member ${premiumMember.userId} in guild ${premiumMember.guildId}:`,
					error,
				);
			}
		}

		this.container.logger.info(
			`[PREMIUM ABILITY CHECK] Completed. Checked ${totalChecked} members, found ${totalMismatches} mismatches.`,
		);

		return null;
	}
}
