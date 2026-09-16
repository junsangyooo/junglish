<script lang="ts">
	import type { CardVM } from '$lib/server/cards';
	import { speak } from '$lib/tts';
	let { card, flipped, onflip, onrate, onknown, busy }: {
		card: CardVM; flipped: boolean; onflip: () => void;
		onrate: (r: 1 | 2 | 3) => void; onknown?: () => void; busy: boolean;
	} = $props();
</script>

<div class="pane fill">
	{#if !flipped}
		<button class="face" onclick={onflip}>
			<span class="small muted">{card.type === 'word' ? '단어' : '패턴'} · 뜻을 떠올려 보세요</span>
			<span class="front">{card.front}</span>
			<span class="muted small">{card.frontSub}</span>
		</button>
		{#if !card.reverse}
			<div class="center" style="margin-top:14px">
				<button class="audio lg" onclick={() => speak(card.tts)} aria-label="발음 듣기">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg>
				</button>
			</div>
		{/if}
	{:else}
		<div class="card pop back">
			<div class="title-row">
				<h2 style="margin:0">{card.back.title}</h2>
				<button class="audio" onclick={() => speak(card.tts)} aria-label="발음 듣기">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" /></svg>
				</button>
			</div>
			<p class="muted small">{card.back.sub}</p>
			{#if card.back.note}<p class="note small">{card.back.note}</p>{/if}
			{#each card.back.lines as l}
				<p class="en">{l.en}</p>
				<p class="muted small">{l.ko}</p>
			{/each}
			{#if card.back.extra}
				<div class="collos">
					{#each card.back.extra.split(' · ') as c}<span class="chip small">{c}</span>{/each}
				</div>
			{/if}
			{#if card.mySentence}<p class="mine small">✍️ {card.mySentence}</p>{/if}
		</div>
	{/if}
</div>

<div class="bar">
	{#if flipped}
		<div class="row">
			<button class="btn-again rate" disabled={busy} onclick={() => onrate(1)}>모름<small class="num">{card.intervals[1]}</small></button>
			<button class="btn-hard rate" disabled={busy} onclick={() => onrate(2)}>애매<small class="num">{card.intervals[2]}</small></button>
			<button class="rate" disabled={busy} onclick={() => onrate(3)}>앎<small class="num">{card.intervals[3]}</small></button>
		</div>
	{:else}
		<div class="row">
			{#if card.isNew && onknown}
				<button class="btn-quiet" disabled={busy} onclick={onknown}>이미 알아요</button>
			{/if}
			<button onclick={onflip}>뜻 확인</button>
		</div>
	{/if}
</div>

<style>
	.face {
		flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
		background: var(--surface); border: 1px solid var(--line); border-bottom: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 24px; text-align: center; color: var(--ink); min-height: 0;
	}
	.face:active { transform: none; margin-bottom: 0; border-bottom-width: 1px; }
	.front { font-size: 32px; font-weight: 800; line-height: 1.25; word-break: break-word; }
	.back { flex: 1; overflow-y: auto; min-height: 0; }
	.title-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.en { margin: 14px 0 2px; font-weight: 600; }
	.note { border-left: 3px solid var(--brand); padding-left: 10px; color: var(--muted); }
	.collos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
	.mine { margin-top: 14px; padding: 10px; border-radius: var(--r-sm); background: var(--brand-soft); }
	.rate { flex-direction: column; gap: 1px; }
	.rate small { font-size: 11px; font-weight: 600; opacity: 0.85; }
</style>
