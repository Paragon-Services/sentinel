import { ClanManager } from '../lib/abilities/ClanManager.js';
import { MemberAbilities } from '../lib/abilities/MemberAbilities.js';
import { Task, type TaskRunData } from '../lib/schedule/tasks/Task.js';

export type FixMode = 'dry-run' | 'fix-all' | 'fix-mismatches' | 'fix-missing';

export interface CheckPremiumMemberAbilitiesOptions {
	/**
	 * What to fix: 'dry-run' (default), 'fix-missing', 'fix-mismatches', or 'fix-all'
	 */
	fixMode?: FixMode;
	/**
	 * Optional guild ID to check only a specific guild
	 */
	guildId?: string;
}

export interface CheckPremiumMemberAbilitiesResult {
	fixed: number;
	totalChecked: number;
	totalMismatches: number;
	totalMissing: number;
}

/**
 * Daily task that checks if premium members still have their expected abilities.
 * Logs any discrepancies for monitoring and debugging.
 */
export class CheckPremiumMemberAbilities extends Task {
	public async run(data?: TaskRunData) {
		const options: CheckPremiumMemberAbilitiesOptions = data?.data ? JSON.parse(data.data) : {};
		await this.checkAbilities(options);
		return null;
	}

	/**
	 * Cleans up a premium member who lost their abilities:
	 * - Checks for clan and deletes it immediately if not already orphaned
	 * - Deletes custom role from Discord
	 * - Deletes premium member entry from database
	 */
	private async cleanupPremiumMember(
		guildId: string,
		userId: string,
		customRoleId: string | null,
		guildName: string,
		reason: 'mismatch' | 'missing',
	): Promise<void> {
		const guild = this.container.client.guilds.resolve(guildId);
		if (!guild) return;

		let shouldDeleteCustomRole = false;

		if (customRoleId) {
			const clanManager = new ClanManager(customRoleId, guildId);
			const clan = await clanManager.getClan();

			if (clan) {
				if (clan.deletionTaskId) {
					this.container.logger.info(
						`[PREMIUM ABILITY CHECK] [CLEANUP] Clan for role ${customRoleId} is already orphaned, skipping`,
					);
				} else {
					try {
						await clanManager.deleteClan();
						this.container.logger.info(
							`[PREMIUM ABILITY CHECK] [CLEANUP] Deleted clan for role ${customRoleId} for ${reason} user ${userId}`,
						);
						shouldDeleteCustomRole = true;
					} catch (error) {
						this.container.logger.error(
							`[PREMIUM ABILITY CHECK] [CLEANUP] Failed to delete clan for role ${customRoleId}:`,
							error,
						);
						shouldDeleteCustomRole = true;
					}
				}
			} else {
				shouldDeleteCustomRole = true;
			}
		}

		if (customRoleId && shouldDeleteCustomRole) {
			const role = await guild.roles.fetch(customRoleId).catch(() => null);

			if (role) {
				try {
					await role.delete(`Premium member ${reason}: user ${userId} lost abilities`);
					this.container.logger.info(
						`[PREMIUM ABILITY CHECK] [CLEANUP] Deleted custom role ${customRoleId} for ${reason} user ${userId}`,
					);
				} catch (error) {
					this.container.logger.error(
						`[PREMIUM ABILITY CHECK] [CLEANUP] Failed to delete custom role ${customRoleId}:`,
						error,
					);
				}
			}
		}

		// 3. Delete premium member entry from database
		try {
			await this.container.prisma.premiumMember.delete({
				where: {
					guildId_userId: {
						guildId,
						userId,
					},
				},
			});

			this.container.logger.info(
				`[PREMIUM ABILITY CHECK] [FIXED] Removed premium member entry for ${reason} user ${userId} in guild ${guildName} (${guildId})`,
			);
		} catch (error) {
			this.container.logger.error(
				`[PREMIUM ABILITY CHECK] Failed to remove premium member ${userId} in guild ${guildId}:`,
				error,
			);
		}
	}

	public async checkAbilities(
		options: CheckPremiumMemberAbilitiesOptions = {},
	): Promise<CheckPremiumMemberAbilitiesResult> {
		const fixMode = options.fixMode ?? 'dry-run';
		this.container.logger.info(
			`[PREMIUM ABILITY CHECK] Starting premium member ability check (mode: ${fixMode})...`,
		);

		const whereClause = options.guildId ? { guildId: options.guildId } : {};
		const premiumMembers = await this.container.prisma.premiumMember.findMany({
			where: whereClause,
			select: {
				userId: true,
				guildId: true,
				customRoleId: true,
			},
		});

		if (premiumMembers.length === 0) {
			this.container.logger.info('[PREMIUM ABILITY CHECK] No premium members found in database.');
			return { totalChecked: 0, totalMismatches: 0, totalMissing: 0, fixed: 0 };
		}

		let totalChecked = 0;
		let totalMismatches = 0;
		let totalMissing = 0;
		let fixed = 0;

		for (const premiumMember of premiumMembers) {
			try {
				const guild = this.container.client.guilds.resolve(premiumMember.guildId);

				if (!guild) {
					this.container.logger.warn(
						`[PREMIUM ABILITY CHECK] Guild ${premiumMember.guildId} not found for user ${premiumMember.userId}`,
					);
					continue;
				}

				totalChecked++;

				let member;

				try {
					member = await guild.members.fetch(premiumMember.userId);
				} catch {
					totalMissing++;
					this.container.logger.warn(
						`[PREMIUM ABILITY CHECK] User ${premiumMember.userId} not found in guild ${guild.name} (${guild.id}) - may have left the server`,
					);

					// Fix missing members if mode is 'fix-missing' or 'fix-all'
					if (fixMode === 'fix-missing' || fixMode === 'fix-all') {
						await this.cleanupPremiumMember(
							premiumMember.guildId,
							premiumMember.userId,
							premiumMember.customRoleId,
							guild.name,
							'missing',
						);
						fixed++;
					}

					continue;
				}

				const memberAbilities = new MemberAbilities(member);
				await memberAbilities.computeAbilities();

				const hasAnyAbility =
					memberAbilities.hasAbility('canCreateClan') ||
					memberAbilities.hasAbility('canCreateCustomRole') ||
					memberAbilities.hasAbility('canGiftLegend') ||
					memberAbilities.hasAbility('areAbilitiesMultiGuild');

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

					// Fix mismatches if mode is 'fix-mismatches' or 'fix-all'
					if (fixMode === 'fix-mismatches' || fixMode === 'fix-all') {
						await this.cleanupPremiumMember(
							premiumMember.guildId,
							premiumMember.userId,
							premiumMember.customRoleId,
							guild.name,
							'mismatch',
						);
						fixed++;
					}
				}
			} catch (error) {
				this.container.logger.error(
					`[PREMIUM ABILITY CHECK] Error checking premium member ${premiumMember.userId} in guild ${premiumMember.guildId}:`,
					error,
				);
			}
		}

		this.container.logger.info(
			`[PREMIUM ABILITY CHECK] Completed. Checked ${totalChecked} members, found ${totalMismatches} mismatches, ${totalMissing} missing${fixMode === 'dry-run' ? '' : `, fixed ${fixed}`}.`,
		);

		return { totalChecked, totalMismatches, totalMissing, fixed };
	}
}
