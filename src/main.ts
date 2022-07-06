import '@sapphire/plugin-logger/register';

import { ApplicationCommandRegistries, LogLevel, RegisterBehavior } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import { createColors } from 'colorette';
import { Intents, Options } from 'discord.js';
import { inspect } from 'util';
import { UtilsBot } from './lib/UtilsBot.js';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.Overwrite);

inspect.defaultOptions.depth = 2;
const colorette = createColors({ useColor: true });

const client = new UtilsBot({
	presence: {
		activities: [
			{
				name: 'with tools!',
				type: 'PLAYING',
			},
		],
	},
	restTimeOffset: 0,
	intents: new Intents([
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_BANS,
		Intents.FLAGS.GUILD_MESSAGES,
	]),
	caseInsensitiveCommands: true,
	logger: {
		depth: 2,
		level: Reflect.has(process.env, 'PM2_HOME') ? LogLevel.Info : LogLevel.Debug,
	},
	loadDefaultErrorListeners: false,
	makeCache: Options.cacheWithLimits({
		MessageManager: {
			maxSize: 50,
		},
		UserManager: {
			maxSize: 100,
			keepOverLimit: (user) => user.id === user.client.user!.id,
		},
		GuildMemberManager: {
			maxSize: 100,
			keepOverLimit: (member) => member.user.id === member.client.user!.id,
		},
		// Useless props for the bot
		GuildEmojiManager: { maxSize: 0 },
		GuildStickerManager: { maxSize: 0 },
	}),
	sweepers: {
		// Members, users and messages are needed for the bot to function
		guildMembers: {
			interval: Time.Minute * 15,
			// Sweep all members except the bot member
			filter: () => (member) => member.user.id !== member.client.user!.id,
		},
		users: {
			interval: Time.Minute * 15,
			// Sweep all users except the bot user
			filter: () => (user) => user.id !== user.client.user!.id,
		},
		messages: {
			interval: Time.Minute * 5,
			lifetime: Time.Minute * 15,
		},
	},
});

try {
	await client.login();
} catch (error) {
	client.logger.error(colorette.red('Failed to launch the bot:'), error);
	client.destroy();
}
