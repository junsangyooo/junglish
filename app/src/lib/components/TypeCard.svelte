<script lang="ts">
	import type { CardVM } from '$lib/server/cards';
	import { normalizeAnswer } from '$lib/answer';
	import { speak } from '$lib/tts';
	let { card, onresult, busy }: { card: CardVM; onresult: (correct: boolean) => void; busy: boolean } = $props();
	let value = $state('');
	let checked = $state<null | boolean>(null);
	$effect(() => { card; value = ''; checked = null; });
	function check() { if (checked === null) checked = normalizeAnswer(value) === normalizeAnswer(card.typing!.answer); }
	const filled = $derived(value.trim().length > 0);
</script>

<div class="pane fill">
	<div class="card" style="flex:1; overflow-y:auto; min-height:0">
		<p class="small muted">빈칸에 들어갈 말을 입력하세요</p>
		<p class="sentence">{card.typing!.sentence}</p>
		<p class="muted small">{card.type === 'word' ? card.back.sub : card.front}</p>
		<input
			bind:value
			disabled={checked !== null}
			placeholder="정답 입력"
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
			enterkeyhint="done"
			onkeydown={(e) => e.key === 'Enter' && check()}
		/>
	</div>
</div>

<div class="sheet" class:open={checked !== null} class:wrong={checked === false}>
	<h3>{checked ? '정답' : '아쉬워요'}</h3>
	<div class="answer-row">
		<p style="margin:0; font-weight:700">{card.typing!.answer}</p>
		<button class="audio" onclick={() => speak(card.typing!.sentence.replace(/_{2,}/, card.typing!.answer))} aria-label="문장 듣기">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" /></svg>
		</button>
	</div>
	{#if checked === false && value.trim()}<p class="small muted" style="margin:6px 0 0">입력: {value}</p>{/if}
	<button
		class={checked === false ? 'btn-again' : ''}
		style="margin-top:12px"
		disabled={busy}
		onclick={() => onresult(checked!)}>계속</button
	>
</div>

<div class="bar">
	<button disabled={!filled || checked !== null} onclick={check}>확인</button>
</div>

<style>
	.sentence { font-size: 20px; font-weight: 600; margin: 16px 0; line-height: 1.5; }
	.answer-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
</style>
