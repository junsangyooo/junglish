<script lang="ts">
	import type { CardVM } from '$lib/server/cards';
	import { speak } from '$lib/tts';
	let { card, onresult }: { card: CardVM; onresult: (correct: boolean) => void } = $props();
	let value = $state('');
	let checked = $state<null | boolean>(null);
	const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
	$effect(() => { card; value = ''; checked = null; });
	function check() { checked = norm(value) === norm(card.typing!.answer); }
</script>

<div class="grow">
	<div class="card">
		<p class="muted small">빈칸에 들어갈 말을 입력하세요</p>
		<p style="font-size:22px; margin:16px 0">{card.typing!.sentence}</p>
		<p class="muted">{card.type === 'word' ? card.back.sub : card.front}</p>
		{#if checked === null}
			<input bind:value placeholder="정답 입력" autocapitalize="off" autocorrect="off" onkeydown={(e) => e.key === 'Enter' && check()} />
		{:else}
			<p style="font-size:20px; font-weight:700; color: {checked ? 'var(--good)' : 'var(--again)'}">
				{checked ? '정답' : `정답: ${card.typing!.answer}`}
				<button class="ghost" style="min-height:48px; min-width:48px; padding:0" onclick={() => speak(card.typing!.sentence.replace('___', card.typing!.answer))}>▶</button>
			</p>
			{#if !checked}<p class="muted small">입력: {value}</p>{/if}
		{/if}
	</div>
</div>
<div style="padding:12px 0">
	{#if checked === null}
		<button style="width:100%" onclick={check}>확인</button>
	{:else}
		<button style="width:100%" onclick={() => onresult(checked!)}>다음</button>
	{/if}
</div>
