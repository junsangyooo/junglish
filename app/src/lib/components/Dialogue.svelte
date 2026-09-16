<!-- app/src/lib/components/Dialogue.svelte — the day's dialogue as a chat thread. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { speak } from '$lib/tts';

	let { lines, texts, showKo, highlight = -1 }: {
		lines: { speaker: string; text: string; text_ko: string }[];
		texts: string[];
		showKo: boolean;
		highlight?: number;
	} = $props();

	let first = $derived(lines[0]?.speaker);
	let thread = $state<HTMLElement>();
	// Keep the line being quizzed or shadowed in view — the thread is taller than the screen.
	$effect(() => {
		if (highlight < 0) return;
		thread?.children[highlight]?.scrollIntoView({ block: 'center' });
	});
	onDestroy(() => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); });
</script>

<div class="thread" bind:this={thread}>
	{#each lines as l, i}
		<div class="turn" class:mine={l.speaker === first} class:dim={highlight >= 0 && highlight !== i}>
			<p class="small muted name">{l.speaker}</p>
			<div class="bubble" class:active={highlight === i}>
				<p class="en">{texts[i]}</p>
				{#if showKo}<p class="small muted ko">{l.text_ko}</p>{/if}
				<button class="audio sm" onclick={() => speak(l.text)} aria-label="{l.speaker} 줄 듣기">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" /></svg>
				</button>
			</div>
		</div>
	{/each}
</div>

<style>
	.thread { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 8px; }
	.turn { max-width: 88%; }
	.turn.mine { align-self: flex-end; }
	.turn.dim { opacity: 0.4; transition: opacity 0.2s; }
	.name { margin: 0 0 3px 4px; }
	.turn.mine .name { text-align: right; margin: 0 4px 3px 0; }
	.bubble {
		position: relative; background: var(--surface); border: 1px solid var(--line);
		border-radius: var(--r-md); padding: 12px 14px 12px 14px;
	}
	.turn.mine .bubble { background: var(--brand-soft); border-color: transparent; }
	.bubble.active { border-color: var(--brand); border-width: 2px; }
	.en { margin: 0; font-weight: 600; line-height: 1.55; }
	.ko { margin: 6px 0 0; }
	.audio.sm { width: 36px; height: 36px; min-height: 36px; margin-top: 8px; }
</style>
