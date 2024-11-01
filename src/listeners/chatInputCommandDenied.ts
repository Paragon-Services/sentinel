import { Listener } from '@sapphire/framework';
import type { PreconditionError, ChatInputCommandDeniedPayload } from '@sapphire/framework';
import { createInfoEmbed } from '../lib/utils/createEmbed.js';

export class ChatInputCommandDeniedListener extends Listener {
	public async run(error: PreconditionError, context: ChatInputCommandDeniedPayload) {
		await context.interaction.reply({ embeds: [createInfoEmbed(error.message)], ephemeral: true });
	}
}
