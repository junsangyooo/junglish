<!-- app/src/routes/(app)/+layout.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();

	// [href, label, svg path]
	const tabs: [string, string, string][] = [
		['/', '홈', 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
		['/stats', '통계', 'M4 20V10m6 10V4m6 16v-7m4 7H3'],
		['/settings', '설정', 'M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3H9l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4z']
	];
	let sessionMode = $derived(page.url.pathname.startsWith('/mission') || page.url.pathname.startsWith('/review'));
</script>

<div class="screen">
	{@render children()}
	{#if !sessionMode}
		<nav class="tabs">
			{#each tabs as [href, label, d]}
				<a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path {d} /></svg>
					{label}
				</a>
			{/each}
		</nav>
	{/if}
</div>
