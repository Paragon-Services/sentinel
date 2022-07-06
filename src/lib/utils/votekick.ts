import type { Prisma, VoteKick } from '@prisma/client';
import { container } from '@sapphire/framework';
import { Time } from '@sapphire/time-utilities';
import { CommandInteraction, MessageActionRow, MessageButton, MessageEmbed, User, VoiceChannel } from 'discord.js';
import { getMessageUrlFromInteractionResponse, toReadableUser } from '../utils.js';

export async function createVoteKick(interaction: CommandInteraction, userToKick: User, voiceChannel: VoiceChannel) {
	const data: Prisma.VoteKickCreateInput = {
		user_to_kick: userToKick.id,
		started_by: interaction.user.id,
		voters_agreeing_with_kick: [interaction.user.id],
		voters_disagreeing_with_kick: [userToKick.id],
		message_url: '',
		voice_channel_id: voiceChannel.id,
	};

	const membersInVoiceChannel = voiceChannel.members.size;

	const memberIds = voiceChannel.members.map((member) => member.id);

	const rawHalf = membersInVoiceChannel / 2;
	// Removes decimals from the halved number
	const truncatedHalf = Math.trunc(rawHalf);

	// 5 / 2 = 2.5 -> we expect 3 people needed to vote yes for kick
	// 4 / 2 = 2 -> we expect 3 people needed to vote yes for kick (since you have two votes by default)
	// 3 / 2 = 1.5 -> we expect 2 people needed to vote yes for kick
	const finalAmount = truncatedHalf + 1;

	// Send message about the kick vote being started
	const result = await interaction.reply({
		content: memberIds.map((id) => `<@${id}>`).join(', '),
		embeds: [
			new MessageEmbed() //
				.setColor('BLURPLE')
				.setDescription(`A vote to kick **${toReadableUser(userToKick)}** was started!`)
				.addFields(
					{ name: 'Members agreeing with vote', value: '1', inline: true },
					{ name: 'Members disagreeing with vote', value: '1', inline: true },
				)
				.setFooter({ text: `This vote needs ${finalAmount} votes to pass.` })
				.setThumbnail(userToKick.displayAvatarURL({ dynamic: true, size: 256, format: 'png' })),
		],
		components: [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId(generateButtonId('yes', userToKick.id, voiceChannel.id))
					.setStyle('SECONDARY')
					.setLabel('Agree with vote')
					.setEmoji('check:889466938433101835'),
				new MessageButton()
					.setCustomId(generateButtonId('no', userToKick.id, voiceChannel.id))
					.setStyle('SECONDARY')
					.setLabel('Disagree with vote')
					.setEmoji('❌'),
			),
		],
		allowedMentions: {
			parse: [],
			users: memberIds,
		},
		fetchReply: true,
	});

	data.message_url = getMessageUrlFromInteractionResponse(result);

	// Save kick in db
	const kick = await container.prisma.voteKick.create({ data });

	// Create task that decides outcome in 2 minutes, or when everyone votes (whichever happens first)
	await container.client.schedule.add(
		'handleVoteResult',
		Date.now() + Time.Minute * 2,
		JSON.stringify({
			voteId: kick.id,
			expectedNumberOfVotesToDecideOutcome: finalAmount,
		}),
	);
}

export async function announceAlreadyStartedVoteKick(
	interaction: CommandInteraction,
	userToKick: User,
	kick: VoteKick,
) {
	await interaction.reply({
		ephemeral: true,
		embeds: [
			new MessageEmbed()
				.setColor('RED')
				.setDescription(
					`A vote to kick **${toReadableUser(
						userToKick,
					)}** was already started.\n\nClick the button below to jump to that message`,
				)
				.setThumbnail(userToKick.displayAvatarURL({ dynamic: true, size: 256, format: 'png' })),
		],
		components: [
			new MessageActionRow().addComponents(
				new MessageButton() //
					.setURL(kick.message_url)
					.setLabel('Jump to message')
					.setStyle('LINK'),
			),
		],
	});
}

function generateButtonId(action: 'yes' | 'no', kickedUserId: string, voiceChannelId: string) {
	return `votekick.${action}.${kickedUserId}.${voiceChannelId}`;
}
