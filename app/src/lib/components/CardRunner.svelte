<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { CardVM } from '$lib/server/cards';
	import { enqueue, flush, pending } from '$lib/queue';
	import FlipCard from './FlipCard.svelte';
	import TypeCard from './TypeCard.svelte';
	import SessionHeader from './SessionHeader.svelte';
	let { cards, label, onfinish }: { cards: CardVM[]; label: string; onfinish: () => void } = $props();
	let i = $state(0);
	let flipped = $state(false);
	let busy = $state(false);
	let queued = $state(0);
	$effect(() => { cards; i = 0; flipped = false; });

	onMount(() => {
		queued = pending();
		const drain = async () => {
			queued = await flush();
			if (queued === 0) await invalidateAll();
		};
		if (queued) drain();
		addEventListener('online', drain);
		return () => removeEventListener('online', drain);
	});

	async function post(url: string, body: Record<string, unknown>): Promise<boolean> {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
				if (r.ok) return true;
				if (r.status >= 400 && r.status < 500) return true; // the server rejected it for good
			} catch { /* offline — fall through to the queue */ }
			await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
		}
		return false;
	}

	/** The card always moves on: a rating that cannot be sent now waits in the outbox. */
	async function send(url: string, body: Record<string, unknown>) {
		if (busy) return;
		busy = true;
		const sent = await post(url, body);
		busy = false;
		if (!sent) queued = enqueue({ url, body });
		flipped = false;
		if (++i >= cards.length) onfinish();
	}

	const rate = (r: 1 | 2 | 3) =>
		send('/api/rate', { type: cards[i].type, id: cards[i].id, rating: r, at: new Date().toISOString() });
	const known = () =>
		send('/api/known', { type: cards[i].type, id: cards[i].id, at: new Date().toISOString() });

	function onkey(e: KeyboardEvent) {
		if (busy || i >= cards.length || e.metaKey || e.ctrlKey) return;
		if (cards[i].mode === 'type') return;
		if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flipped = true; }
		else if (flipped && ['1', '2', '3'].includes(e.key)) rate(Number(e.key) as 1 | 2 | 3);
	}
</script>

<svelte:window onkeydown={onkey} />

<SessionHeader {label} index={i} total={cards.length} />

{#if queued}
	<p class="queued small">{queued}개 대기 중 · 연결되면 자동으로 보냅니다</p>
{/if}

{#if i < cards.length}
	{#key i}
		{#if cards[i].mode === 'type'}
			<TypeCard card={cards[i]} onresult={(ok) => rate(ok ? 3 : 1)} {busy} />
		{:else}
			<FlipCard
				card={cards[i]}
				{flipped}
				{busy}
				onflip={() => (flipped = true)}
				onrate={rate}
				onknown={cards[i].isNew ? known : undefined}
			/>
		{/if}
	{/key}
{/if}

<style>
	.queued {
		margin: 0 var(--pad) 8px; padding: 8px 12px; border-radius: var(--r-sm);
		background: var(--hard-soft); color: var(--hard-press); font-weight: 600; text-align: center;
	}
</style>
