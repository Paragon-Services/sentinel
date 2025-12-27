import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { ClanManager } from '../../../lib/abilities/ClanManager.js';
import { MemberAbilities } from '../../../lib/abilities/MemberAbilities.js';
import { ensureFullMember } from '../../../lib/utils.js';

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberUpdate })
export class PremiumUnsubscribe extends Listener<typeof Events.GuildMemberUpdate> {
	public override async run(oldMember: GuildMember, newMember: GuildMember) {
		await ensureFullMember(oldMember);
		await ensureFullMember(newMember);

		const oldMemberAbilities = new MemberAbilities(oldMember);
		const newMemberAbilities = new MemberAbilities(newMember);

		await oldMemberAbilities.computeAbilities();
		await newMemberAbilities.computeAbilities();

		if (oldMemberAbilities.hasNone() || oldMemberAbilities.hasEqualAbilities(newMemberAbilities)) {
			return;
		}

		this.container.logger.info(`[PREMIUM] ${newMember.user.tag} has lost some premium abilities`, {
			userId: newMember.id,
			guildId: newMember.guild.id,
		});

		const clanManager = new ClanManager(oldMember);
		const clan = await clanManager.getClan();
		const canNoLongerCreateClan = !newMemberAbilities.hasAbility('canCreateClan');
		const canNoLongerCreateCustomRole =
			oldMemberAbilities.hasAbility('canCreateCustomRole') &&
			!newMemberAbilities.hasAbility('canCreateCustomRole');
		const canNoLongerGiftLegend =
			oldMemberAbilities.hasAbility('canGiftLegend') && !newMemberAbilities.hasAbility('canGiftLegend');

		const premiumMember = await this.container.prisma.premiumMember.findFirst({
			where: { guildId: newMember.guild.id, userId: newMember.id },
		});

		// If user has a clan, we put a cooldown on everything
		// Once the cooldown is over, if the user is still not back
		// The clan will be deleted, as well as everything that's handled in the "else" block
		if (canNoLongerCreateClan && clan) {
			await clanManager.makeClanOrphan();
		} else if (premiumMember) {
			if (canNoLongerCreateCustomRole) {
				await ClanManager.deletePremiumRole(premiumMember);
			}

			if (canNoLongerGiftLegend) {
				await ClanManager.deleteGiftedRole(premiumMember);
			}
		}
	}
}
