<!-- app/src/lib/components/Dialogue.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { DialogueLine } from '$lib/server/content';
	import { speak } from '$lib/tts';
	let { lines, showKo, highlight = -1, blanks }: { lines: DialogueLine[]; showKo: boolean; highlight?: number; blanks?: Map<number, string> } = $props();
	const render = (i: number, text: string) => blanks?.has(i) ? text.replace(blanks.get(i)!, '______') : text;
	onDestroy(() => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); });
</script>

<div class="card" style="flex:1">
	{#each lines as l, i}
		<div style="margin:0 0 14px; opacity:{highlight >= 0 && highlight !== i ? 0.45 : 1}">
			<p class="small muted" style="margin:0">{l.speaker}</p>
			<p style="margin:2px 0">{render(i, l.text)}
				<button class="ghost" style="min-height:48px; min-width:48px; padding:0" onclick={() => speak(l.text)}>▶</button></p>
			{#if showKo}<p class="small muted" style="margin:0">{l.text_ko}</p>{/if}
		</div>
	{/each}
</div>
