import { filterByRoles, selectNewItems } from './triggerHelpers';

describe('selectNewItems', () => {
	it('returns all items when state is empty (first poll)', () => {
		const items = [
			{ id: 'a', createdAt: '2026-06-11T10:00:00.000Z' },
			{ id: 'b', createdAt: '2026-06-11T10:01:00.000Z' },
		];
		const { newItems, nextState } = selectNewItems(items, {});
		expect(newItems.map((i) => i.id)).toEqual(['a', 'b']);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:01:00.000Z');
		expect(nextState.seenIds).toEqual(['b']);
	});

	it('filters out items at or before the watermark', () => {
		const state = { lastTimestamp: '2026-06-11T10:01:00.000Z', seenIds: ['b'] };
		const items = [
			{ id: 'a', createdAt: '2026-06-11T10:00:00.000Z' },
			{ id: 'b', createdAt: '2026-06-11T10:01:00.000Z' },
			{ id: 'c', createdAt: '2026-06-11T10:02:00.000Z' },
		];
		const { newItems, nextState } = selectNewItems(items, state);
		expect(newItems.map((i) => i.id)).toEqual(['c']);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:02:00.000Z');
		expect(nextState.seenIds).toEqual(['c']);
	});

	it('emits unseen items sharing the watermark timestamp', () => {
		const state = { lastTimestamp: '2026-06-11T10:01:00.000Z', seenIds: ['b'] };
		const items = [
			{ id: 'b', createdAt: '2026-06-11T10:01:00.000Z' },
			{ id: 'd', createdAt: '2026-06-11T10:01:00.000Z' },
		];
		const { newItems, nextState } = selectNewItems(items, state);
		expect(newItems.map((i) => i.id)).toEqual(['d']);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:01:00.000Z');
		expect(nextState.seenIds!.sort()).toEqual(['b', 'd']);
	});

	it('returns items sorted by createdAt ascending', () => {
		const items = [
			{ id: 'late', createdAt: '2026-06-11T10:05:00.000Z' },
			{ id: 'early', createdAt: '2026-06-11T10:00:00.000Z' },
		];
		const { newItems } = selectNewItems(items, {});
		expect(newItems.map((i) => i.id)).toEqual(['early', 'late']);
	});

	it('skips items without createdAt and keeps state intact', () => {
		const state = { lastTimestamp: '2026-06-11T10:00:00.000Z', seenIds: ['a'] };
		const { newItems, nextState } = selectNewItems([{ id: 'x' }], state);
		expect(newItems).toEqual([]);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:00:00.000Z');
		expect(nextState.seenIds).toEqual(['a']);
	});

	it('handles empty input', () => {
		const { newItems, nextState } = selectNewItems([], {});
		expect(newItems).toEqual([]);
		expect(nextState.lastTimestamp).toBeUndefined();
	});
});

describe('filterByRoles', () => {
	const items = [
		{ id: '1', role: 'User' },
		{ id: '2', role: 'Assistant' },
		{ id: '3' },
	];

	it('returns all items when roles list is empty', () => {
		expect(filterByRoles(items, [])).toHaveLength(3);
	});

	it('keeps only items with matching roles', () => {
		expect(filterByRoles(items, ['User']).map((i) => i.id)).toEqual(['1']);
	});
});
