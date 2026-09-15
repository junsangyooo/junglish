<!-- app/src/routes/(app)/+layout.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();
	const tabs = [['/', '홈'], ['/stats', '통계'], ['/settings', '설정']];
	let hideTabs = $derived(page.url.pathname.startsWith('/mission') || page.url.pathname.startsWith('/review'));
</script>

<div class="screen">
	<div class="grow" style="justify-content:flex-start">{@render children()}</div>
	{#if !hideTabs}
		<nav class="tabs">
			{#each tabs as [href, label]}
				<a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>
			{/each}
		</nav>
	{/if}
</div>
