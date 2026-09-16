<!-- app/src/lib/components/SessionHeader.svelte — close button + progress + counter, shared by every session step. -->
<script lang="ts">
	let { label, index, total, exitHref = '/' }: { label: string; index: number; total: number; exitHref?: string } = $props();
	let pct = $derived(total ? Math.min(100, (index / total) * 100) : 0);
</script>

<div class="session-head">
	<a class="icon-btn" href={exitHref} aria-label="나가기">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
	</a>
	<div class="progress" role="progressbar" aria-label={label} aria-valuenow={index} aria-valuemin="0" aria-valuemax={total}>
		<i style="width:{pct}%"></i>
	</div>
	<span class="counter num">{index}/{total}</span>
</div>
<p class="small muted" style="margin:0 0 8px; padding:0 var(--pad)">{label}</p>
