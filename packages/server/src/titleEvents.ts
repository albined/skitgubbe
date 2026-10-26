// Titles are global, so a change decided in one room has to reach every open
// room. GameRoom announces changes here and the room manager fans them out,
// which keeps gameRoom.ts free of an import cycle with rooms.ts.
const listeners = new Set<() => void>();

export function onTitlesChanged(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function announceTitlesChanged() {
	for (const listener of listeners) listener();
}
