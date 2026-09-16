<!-- app/src/routes/(app)/review/+page.svelte -->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CardRunner from '$lib/components/CardRunner.svelte';
	let { data } = $props();
</script>

{#if data.cards.length}
	<CardRunner cards={data.cards} label="복습" onfinish={invalidateAll} />
{:else}
	<div class="pane fill center" style="justify-content:center">
		<p style="font-size:56px; margin:0">✅</p>
		<h1>복습 끝</h1>
		<p class="muted">지금 예정된 카드가 없습니다. 다음 복습은 오늘 학습한 카드부터 돌아옵니다.</p>
	</div>
	<div class="bar"><a class="btn" href="/">홈으로</a></div>
{/if}
