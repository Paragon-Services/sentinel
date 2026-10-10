import { ApplyOptions } from '@sapphire/decorators';
import { isDMChannel } from '@sapphire/discord.js-utilities';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { Message } from 'discord.js';

/**
 * Replaces Sapphire's own CorePreMessageParser, which shares this name and is therefore unloaded in favour of it.
 * The original reads `message.channel.permissionsFor()` without checking the channel, and `message.channel` is null
 * when the channel is not cached, which throws on every such message. The bot only has a mention prefix
 * (`fetchPrefix` returns null), so this only handles that.
 */
@ApplyOptions<Listener.Options>({ name: 'CorePreMessageParser', event: Events.PreMessageParsed })
export class CorePreMessageParser extends Listener<typeof Events.PreMessageParsed> {
	private readonly requiredPermissions: Readonly<PermissionsBitField> = new PermissionsBitField([
		PermissionFlagsBits.ViewChannel,
		PermissionFlagsBits.SendMessages,
	]).freeze();

	public override async run(message: Message): Promise<void> {
		if (!(await this.canRunInChannel(message))) {
			return;
		}

		const prefix: string | null = this.getMentionPrefix(message);
		const { client } = this.container;

		if (prefix === null) {
			client.emit(Events.NonPrefixedMessage, message);
		} else if (message.content.length === prefix.length) {
			client.emit(Events.MentionPrefixOnly, message);
		} else {
			client.emit(Events.PrefixedMessage, message, prefix);
		}
	}

	private async canRunInChannel(message: Message): Promise<boolean> {
		// The `channel` getter resolves from the cache and is null for channels the bot has not cached.
		const channel: Message['channel'] | null = message.channel ?? null;

		if (!channel || channel.type === ChannelType.GroupDM) {
			return false;
		}

		if (isDMChannel(channel)) {
			return true;
		}

		const me = await message.guild?.members.fetchMe();

		if (!me) {
			return false;
		}

		return channel.permissionsFor(me)?.has(this.requiredPermissions, true) ?? false;
	}

	private getMentionPrefix(message: Message): string | null {
		const { client } = this.container;

		if (client.disableMentionPrefix || message.content.length < 20 || !message.content.startsWith('<@')) {
			return null;
		}

		const [offset, id]: [number, string | undefined] =
			message.content[2] === '&' ?
				[3, message.guild?.roles.botRoleFor(client.id!)?.id]
			:	[message.content[2] === '!' ? 3 : 2, client.id!];

		if (!id) {
			return null;
		}

		const offsetWithId: number = offset + id.length;

		if (message.content[offsetWithId] !== '>' || message.content.slice(offset, offsetWithId) !== id) {
			return null;
		}

		return message.content.slice(0, offsetWithId + 1);
	}
}
