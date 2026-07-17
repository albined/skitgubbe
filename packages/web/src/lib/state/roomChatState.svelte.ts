import type { ChatMessage } from 'shared';
import type { RoomState } from './roomState.svelte';

export const MAX_CHAT_MESSAGES = 100;

export class RoomChatState {
	roomState: RoomState;

	chatMessages = $state<ChatMessage[]>([]);
	activeBubbles = $state<
		Map<string, { type: 'chat' | 'emote'; content: string; timestamp: number }>
	>(new Map());
	activeTimeouts = new Map<string, number>();
	lastSeenChatId = $state<number>(0);
	catchUpChatQueue = $state<ChatMessage[]>([]);
	catchUpTimer: number | undefined = undefined;

	constructor(roomState: RoomState) {
		this.roomState = roomState;
		if (typeof window !== 'undefined') {
			const storedId = localStorage.getItem(`skitgubbe_last_seen_chat_id_${this.roomState.roomId}`);
			this.lastSeenChatId = storedId ? parseInt(storedId, 10) : 0;
		}
	}

	triggerBubble(playerId: string, message?: string, emote?: string) {
		const content = emote || message || '';
		if (!content) return;

		if (this.activeTimeouts.has(playerId)) {
			clearTimeout(this.activeTimeouts.get(playerId));
		}

		this.activeBubbles.set(playerId, {
			type: emote ? 'emote' : 'chat',
			content,
			timestamp: Date.now()
		});
		this.activeBubbles = new Map(this.activeBubbles);

		const timeoutId = window.setTimeout(() => {
			this.activeBubbles.delete(playerId);
			this.activeBubbles = new Map(this.activeBubbles);
			this.activeTimeouts.delete(playerId);
		}, 4000);

		this.activeTimeouts.set(playerId, timeoutId);
	}

	get unreadChatCount(): number {
		if (this.roomState.showChat) return 0;
		return this.chatMessages.filter(
			(msg) => msg.playerId !== this.roomState.playerId && msg.id > this.lastSeenChatId
		).length;
	}

	markChatsAsRead() {
		if (this.roomState.maxChatId > this.lastSeenChatId) {
			this.lastSeenChatId = this.roomState.maxChatId;
			localStorage.setItem(
				`skitgubbe_last_seen_chat_id_${this.roomState.roomId}`,
				this.roomState.maxChatId.toString()
			);
		}
	}

	playCatchUpChats() {
		if (this.catchUpChatQueue.length === 0) return;
		if (this.catchUpTimer) {
			clearTimeout(this.catchUpTimer);
		}

		const nextChat = () => {
			if (this.catchUpChatQueue.length === 0 || this.roomState.showChat) {
				this.catchUpChatQueue = [];
				this.catchUpTimer = undefined;
				return;
			}
			const msg = this.catchUpChatQueue.shift();
			if (msg) {
				this.triggerBubble(msg.playerId, msg.message, msg.emote);
			}
			if (this.catchUpChatQueue.length > 0) {
				this.catchUpTimer = this.roomState.trackTimeout(nextChat, 500);
			} else {
				this.catchUpTimer = undefined;
			}
		};
		nextChat();
	}

	onChatOpen() {
		this.markChatsAsRead();
		this.catchUpChatQueue = [];
		if (this.catchUpTimer) {
			clearTimeout(this.catchUpTimer);
			this.catchUpTimer = undefined;
		}
	}

	destroy() {
		if (this.catchUpTimer) {
			clearTimeout(this.catchUpTimer);
			this.catchUpTimer = undefined;
		}
		for (const timeoutId of this.activeTimeouts.values()) {
			clearTimeout(timeoutId);
		}
		this.activeTimeouts.clear();
	}
}
