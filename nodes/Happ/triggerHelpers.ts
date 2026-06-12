export interface PollState {
	lastTimestamp?: string;
	seenIds?: string[];
}

export interface PollItem {
	id?: unknown;
	createdAt?: unknown;
	role?: unknown;
	[key: string]: unknown;
}

function timestampOf(item: PollItem): string {
	return typeof item.createdAt === 'string' ? item.createdAt : '';
}

export function selectNewItems(
	items: PollItem[],
	state: PollState,
): { newItems: PollItem[]; nextState: PollState } {
	const lastTimestamp = state.lastTimestamp ?? '';
	const seenIds = new Set(state.seenIds ?? []);

	const dated = items.filter((item) => timestampOf(item) !== '');
	const sorted = [...dated].sort((a, b) => timestampOf(a).localeCompare(timestampOf(b)));

	const newItems = sorted.filter((item) => {
		const ts = timestampOf(item);
		if (ts < lastTimestamp) return false;
		if (ts === lastTimestamp) {
			if (item.id === undefined) return false;
			return !seenIds.has(String(item.id));
		}
		return true;
	});

	let nextTimestamp = state.lastTimestamp;
	for (const item of sorted) {
		const ts = timestampOf(item);
		if (nextTimestamp === undefined || ts > nextTimestamp) nextTimestamp = ts;
	}

	const nextSeenIds = new Set<string>(
		nextTimestamp === state.lastTimestamp ? (state.seenIds ?? []) : [],
	);
	for (const item of sorted) {
		if (timestampOf(item) === nextTimestamp && item.id !== undefined) {
			nextSeenIds.add(String(item.id));
		}
	}

	return {
		newItems,
		nextState: { lastTimestamp: nextTimestamp, seenIds: [...nextSeenIds] },
	};
}

export function filterByRoles(items: PollItem[], roles: string[]): PollItem[] {
	if (roles.length === 0) return items;
	return items.filter((item) => roles.includes(String(item.role ?? '')));
}
