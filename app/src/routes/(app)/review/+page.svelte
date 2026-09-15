<!-- app/src/routes/(app)/review/+page.svelte -->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CardRunner from '$lib/components/CardRunner.svelte';
	let { data } = $props();
</script>

{#if data.cards.length}
	<CardRunner cards={data.cards} label="복습" onfinish={invalidateAll} />
{:else}
	<div class="grow" style="text-align:center">
		<p style="font-size:40px">✅</p>
		<p>지금 복습할 카드가 없습니다</p>
	</div>
	<div style="padding:12px 0"><a class="btn" href="/" style="width:100%">홈으로</a></div>
{/if}
