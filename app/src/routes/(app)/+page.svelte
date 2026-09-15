<!-- app/src/routes/(app)/+page.svelte -->
<script lang="ts">
	let { data } = $props();
</script>

<h1>Day {data.day}</h1>
<p class="muted">🔥 {data.streak}일 연속</p>
<div class="grow">
	{#if data.hasContent}
		<a class="btn" href="/mission/{data.step}" style="font-size:20px; min-height:64px">
			{data.stepIndex === 0 ? `Day ${data.day} 미션 시작` : `이어하기 (${data.stepIndex}/${data.totalSteps})`}
		</a>
	{:else}
		<p class="card">Day {data.day} 콘텐츠가 아직 없습니다. content.db를 갱신하세요.</p>
	{/if}
	<p></p>
	<a class="btn ghost" href="/review">복습만 하기 · {data.due}개</a>
</div>
