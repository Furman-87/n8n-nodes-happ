import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';

import { messageRoleOptions } from './descriptions/MessageDescription';
import { happApiRequest, toListItems } from './GenericFunctions';
import { filterByRoles, selectNewItems } from './triggerHelpers';
import type { PollItem, PollState } from './triggerHelpers';

export class HappTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Happ Trigger',
		name: 'happTrigger',
		icon: 'file:happ.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when new Happ chats or messages appear',
		defaults: {
			name: 'Happ Trigger',
		},
		polling: true,
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'happApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'New Chat', value: 'newChat' },
					{ name: 'New Message', value: 'newMessage' },
				],
				default: 'newMessage',
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description:
					'Watch a single chat. Leave empty to watch the latest message of every chat (one extra API call per poll).',
				displayOptions: { show: { event: ['newMessage'] } },
			},
			{
				displayName: 'Roles',
				name: 'roles',
				type: 'multiOptions',
				options: messageRoleOptions,
				default: [],
				description:
					'Only emit messages whose role matches. Pick "User" to react to customer messages only. Empty means all roles.',
				displayOptions: { show: { event: ['newMessage'] } },
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const staticData = this.getWorkflowStaticData('node') as PollState;

		let items: PollItem[] = [];

		if (event === 'newChat') {
			const response = await happApiRequest.call(this, 'GET', '/api/chats', { take: 100 });
			items = toListItems(response) as PollItem[];
		} else {
			const chatId = this.getNodeParameter('chatId') as string;
			if (chatId) {
				const response = await happApiRequest.call(this, 'GET', '/api/messages', {
					chatId,
					take: 100,
				});
				items = toListItems(response) as PollItem[];
			} else {
				const chatsResponse = await happApiRequest.call(this, 'GET', '/api/chats', {
					take: 100,
				});
				const chatIds = toListItems(chatsResponse)
					.map((chat) => chat.id)
					.filter((id) => id !== undefined && id !== null)
					.join(',');
				if (chatIds !== '') {
					const lastMessages = (await happApiRequest.call(this, 'GET', '/api/messages/last', {
						chatIds,
					})) as Record<string, PollItem> | null;
					items = Object.values(lastMessages ?? {}).filter(
						(message): message is PollItem => message !== null && typeof message === 'object',
					);
				}
			}
			const roles = this.getNodeParameter('roles', []) as string[];
			items = filterByRoles(items, roles);
		}

		if (this.getMode() === 'manual') {
			const { newItems } = selectNewItems(items, {});
			const latest = newItems[newItems.length - 1];
			if (latest === undefined) return null;
			return [this.helpers.returnJsonArray([latest as IDataObject])];
		}

		const isFirstPoll = staticData.lastTimestamp === undefined;
		const { newItems, nextState } = selectNewItems(items, staticData);

		staticData.lastTimestamp = nextState.lastTimestamp;
		staticData.seenIds = nextState.seenIds;

		if (isFirstPoll && staticData.lastTimestamp === undefined) {
			// No items with createdAt found — record current time as the watermark so
			// the next poll does not flood with the full history.
			staticData.lastTimestamp = new Date().toISOString();
			staticData.seenIds = [];
		}

		if (isFirstPoll || newItems.length === 0) return null;

		return [this.helpers.returnJsonArray(newItems as IDataObject[])];
	}
}
