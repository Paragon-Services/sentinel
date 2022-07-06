import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { GuildChannel } from 'discord.js';
import { removeMediaOnlyChannel } from '../../lib/utils/caches/mediaOnlyCache.js';

@ApplyOptions<Listener.Options>({
	event: Events.ChannelDelete,
})
export class ChannelDeleteMaybeMediaOnly extends Listener {
	public async run(channel: GuildChannel) {
		await removeMediaOnlyChannel(channel.id);
	}
}
