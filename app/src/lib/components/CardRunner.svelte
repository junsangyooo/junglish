<script lang="ts">
	import type { CardVM } from '$lib/server/cards';
	import FlipCard from './FlipCard.svelte';
	import TypeCard from './TypeCard.svelte';
	import SessionHeader from './SessionHeader.svelte';
	let { cards, label, onfinish }: { cards: CardVM[]; label: string; onfinish: () => void } = $props();
	let i = $state(0);
	let flipped = $state(false);
	let busy = $state(false);
	let pending = $state<null | (() => Promise<void>)>(null);
	$effect(() => { cards; i = 0; flipped = false; pending = null; });

	async function post(url: string, body: unknown): Promise<boolean> {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
				if (r.ok) return true;
				if (r.status >= 400 && r.status < 500) return false;
			} catch { /* offline — retry */ }
			await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
		}
		return false;
	}

	/** One in-flight save at a time; a failed save keeps the card so nothing is silently lost. */
	async function run(url: string, body: unknown) {
		if (busy) return;
		busy = true;
		const ok = await post(url, body);
		busy = false;
		if (!ok) { pending = () => run(url, body); return; }
		pending = null;
		flipped = false;
		if (++i >= cards.length) onfinish();
	}

	const rate = (r: 1 | 2 | 3) => run('/api/rate', { type: cards[i].type, id: cards[i].id, rating: r });
	const known = () => run('/api/known', { type: cards[i].type, id: cards[i].id });

	function onkey(e: KeyboardEvent) {
		if (busy || i >= cards.length || e.metaKey || e.ctrlKey) return;
		if (cards[i].mode === 'type') return;
		if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flipped = true; }
		else if (flipped && ['1', '2', '3'].includes(e.key)) rate(Number(e.key) as 1 | 2 | 3);
	}
</script>

<svelte:window onkeydown={onkey} />

<SessionHeader {label} index={i} total={cards.length} />

{#if pending}
	<div class="toast">
		<span class="small">저장하지 못했습니다. 연결을 확인하세요.</span>
		<button class="btn-sm" disabled={busy} onclick={() => pending?.()}>다시 시도</button>
	</div>
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
	.toast {
		display: flex; align-items: center; justify-content: space-between; gap: 10px;
		margin: 0 var(--pad) 8px; padding: 10px 12px; border-radius: var(--r-sm);
		background: var(--again-soft); color: var(--again); font-weight: 600;
	}
</style>
