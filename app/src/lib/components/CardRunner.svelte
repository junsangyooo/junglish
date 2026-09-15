<script lang="ts">
	import type { CardVM } from '$lib/server/cards';
	import FlipCard from './FlipCard.svelte';
	import TypeCard from './TypeCard.svelte';
	import ProgressBar from './ProgressBar.svelte';
	let { cards, label, onfinish }: { cards: CardVM[]; label: string; onfinish: () => void } = $props();
	let i = $state(0);
	let saveError = $state(false);
	$effect(() => { cards; i = 0; saveError = false; });

	async function post(url: string, body: unknown) {
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
				if (r.ok) { saveError = false; return; }
			} catch { /* retry */ }
		}
		saveError = true;
	}
	function next() { if (++i >= cards.length) onfinish(); }
	async function rate(r: 1 | 2 | 3) { const c = cards[i]; await post('/api/rate', { type: c.type, id: c.id, rating: r }); next(); }
	async function known() { const c = cards[i]; await post('/api/known', { type: c.type, id: c.id }); next(); }
</script>

{#if saveError}<p class="small" style="background:var(--again); color:#fff; padding:6px 10px; border-radius:8px">저장 안 됨. 네트워크를 확인하세요.</p>{/if}
<ProgressBar {label} index={i} total={cards.length} />
{#if i < cards.length}
	{#key i}
		{#if cards[i].mode === 'type'}
			<TypeCard card={cards[i]} onresult={(ok) => rate(ok ? 3 : 1)} />
		{:else}
			<FlipCard card={cards[i]} onrate={rate} onknown={cards[i].isNew ? known : undefined} />
		{/if}
	{/key}
{/if}
