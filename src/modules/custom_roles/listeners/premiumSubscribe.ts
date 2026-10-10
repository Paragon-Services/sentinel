import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import { ClanManager } from '../../../lib/abilities/ClanManager.js';
import { MemberAbilities } from '../../../lib/abilities/MemberAbilities.js';
import { LogPrefix } from '../../../lib/utils/logPrefix.js';

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberUpdate })
export class PremiumSubscribe extends Listener<typeof Events.GuildMemberUpdate> {
	public override async run(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
		const newMemberAbilities = new MemberAbilities(newMember);
		await newMemberAbilities.computeAbilities();

		if (newMemberAbilities.hasNone()) {
			return;
		}

		// An uncached member arrives without its previous roles, so there is no diff to compute, and fetching it
		// would only return the current state. Un-orphaning is idempotent, so it is still safe to attempt.
		let couldCreateClan = false;

		if (!oldMember.partial) {
			const oldMemberAbilities = new MemberAbilities(oldMember);
			await oldMemberAbilities.computeAbilities();

			if (oldMemberAbilities.hasEqualAbilities(newMemberAbilities)) {
				return;
			}

			couldCreateClan = oldMemberAbilities.hasAbility('canCreateClan');

			this.container.logger.info(`${LogPrefix.PREMIUM} ${newMember.user.tag} has gained some premium abilities`, {
				userId: newMember.id,
				guildId: newMember.guild.id,
			});
		}

		const canNowCreateClan = !couldCreateClan && newMemberAbilities.hasAbility('canCreateClan');

		if (!canNowCreateClan) {
			return;
		}

		const clanManager = new ClanManager(newMember);
		const clan = await clanManager.getClan();

		// If user has a clan, we can end the cooldown and un-orphan the clan
		if (clan) {
			await clanManager.makeClanNotOrphan({ actorUserId: newMember.id, reason: 'Owner regained premium' });
		}
	}
}
