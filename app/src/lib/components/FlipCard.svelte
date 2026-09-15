<script lang="ts">
	import type { CardVM } from '$lib/server/cards';
	import { speak } from '$lib/tts';
	let { card, onrate, onknown }: { card: CardVM; onrate: (r: 1 | 2 | 3) => void; onknown?: () => void } = $props();
	let flipped = $state(false);
	$effect(() => { card; flipped = false; });
</script>

<div class="grow">
	<div class="card" style="min-height:60%" onclick={() => (flipped = true)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (flipped = true)}>
		{#if !flipped}
			<p class="muted small">{card.type === 'word' ? '단어' : '패턴'} · 떠올려 보세요</p>
			<p style="font-size:30px; font-weight:700; margin:24px 0 8px">{card.front}</p>
			<p class="muted">{card.frontSub}</p>
			{#if !card.reverse}<button class="ghost" onclick={(e) => { e.stopPropagation(); speak(card.tts); }}>▶ 듣기</button>{/if}
		{:else}
			<p style="font-size:26px; font-weight:700; margin:0 0 4px">{card.back.title}
				<button class="ghost" style="min-height:48px; min-width:48px; padding:0" onclick={(e) => { e.stopPropagation(); speak(card.tts); }}>▶</button></p>
			<p class="muted">{card.back.sub}</p>
			{#if card.back.note}<p class="small" style="border-left:3px solid var(--accent); padding-left:8px">{card.back.note}</p>{/if}
			{#each card.back.lines as l}
				<p style="margin:12px 0 2px">{l.en}</p><p class="muted small" style="margin:0">{l.ko}</p>
			{/each}
			{#if card.back.extra}<p class="small muted" style="margin-top:12px">{card.back.extra}</p>{/if}
			{#if card.mySentence}<p class="small" style="margin-top:12px">✍️ {card.mySentence}</p>{/if}
		{/if}
	</div>
</div>
{#if flipped}
	<div class="row" style="padding:12px 0">
		<button class="again" onclick={() => onrate(1)}>모름</button>
		<button class="hard" onclick={() => onrate(2)}>애매</button>
		<button class="good" onclick={() => onrate(3)}>앎</button>
	</div>
{:else}
	<div style="padding:12px 0; text-align:center">
		<p class="muted small">카드를 탭해서 확인</p>
		{#if card.isNew && onknown}<button class="ghost" onclick={onknown}>이미 알아요</button>{/if}
	</div>
{/if}
