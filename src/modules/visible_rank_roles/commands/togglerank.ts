import { RoleSyncType } from '@prisma/client';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { type Message } from 'discord.js';
import { createInfoEmbed } from '../../../lib/utils/createInfoEmbed.js';

@ApplyOptions<Command.Options>({
	description: 'Toggles whether your rank role should be showcased to others or not',
})
export class ToggleRankCommand extends Command {
	public override async messageRun(message: Message) {
		if (message.author.id !== '139836912335716352') {
			return;
		}

		await message.channel.send({
			content: 'TOGGLE_RANK_ROLE_COMMAND_TOGGLED_ROLE',
			embeds: [createInfoEmbed('Toggled the visibility of your rank role.')],
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction<'cached'>) {
		// Find all roles that can be synced
		const roles = await this.container.prisma.roleSync.findMany({
			where: {
				type: RoleSyncType.VisibleRank,
				origin_guild_id: interaction.guildId,
			},
		});

		const member = await interaction.guild.members.fetch(interaction.user.id);

		for (const { origin_role_id: mainRankRole, destination_role_id: visibleRankRole } of roles) {
			const hasRole = member.roles.cache.has(mainRankRole);
			const hasVisibleRole = member.roles.cache.has(visibleRankRole);

			try {
				// If they have the visible role, we don't care if they lose the main role, just remove it
				if (hasVisibleRole) {
					await member.roles.remove(visibleRankRole, 'Rank role visibility toggled');
					continue;
				}

				// If they have the main role, add the visible role
				if (hasRole) {
					await member.roles.add(visibleRankRole, 'Rank role visibility toggled');
				} else {
					await member.roles.remove(visibleRankRole, 'Rank role visibility toggled');
				}
			} catch (error) {
				this.container.logger.warn(
					`[TOGGLE_RANK_ROLE_COMMAND_TOGGLED_ROLE] Failed to toggle role`,
					{ mainRankRole, visibleRankRole },
					error,
				);
			}
		}

		await interaction.reply({
			embeds: [createInfoEmbed('Toggled the visibility of your rank role.')],
			ephemeral: true,
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName(this.name).setDescription(this.description).setDMPermission(false),
		);
	}
}
