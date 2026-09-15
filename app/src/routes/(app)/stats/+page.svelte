<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();
	let editing = $state<number | null>(null);
	const max = $derived(Math.max(1, ...data.next7.map((d) => d.n)));
</script>

<div style="overflow:auto; flex:1">
	<h1>통계</h1>
	<div class="row">
		<div class="card"><p class="muted small" style="margin:0">스트릭</p><p style="font-size:28px; margin:0">🔥 {data.streak}</p></div>
		<div class="card"><p class="muted small" style="margin:0">학습 중</p><p style="font-size:28px; margin:0">{data.learning}</p></div>
		<div class="card"><p class="muted small" style="margin:0">이미 앎</p><p style="font-size:28px; margin:0">{data.known}</p></div>
	</div>
	<h2>7일 복습 예정</h2>
	<div class="card" style="display:flex; gap:6px; align-items:flex-end; height:120px">
		{#each data.next7 as d}
			<div style="flex:1; text-align:center">
				<div style="background:var(--accent); height:{(d.n / max) * 80}px; border-radius:4px"></div>
				<p class="small muted" style="margin:4px 0 0">{d.date.slice(5)}<br />{d.n}</p>
			</div>
		{/each}
	</div>
	<h2>내 문장</h2>
	{#each data.sentences as s (s.id)}
		<div class="card" style="margin-bottom:8px; padding:12px 16px">
			<p class="small muted" style="margin:0">{s.pattern}</p>
			{#if editing === s.id}
				<form method="POST" action="?/editSentence" use:enhance={() => { editing = null; }}>
					<input type="hidden" name="id" value={s.id} />
					<input name="text" value={s.text} />
					<button class="ghost">저장</button>
				</form>
			{:else}
				<p style="margin:4px 0">{s.text} <button class="ghost" onclick={() => (editing = s.id)}>수정</button></p>
			{/if}
		</div>
	{/each}
	<h2>이미 앎 ({data.knownList.length})</h2>
	{#each data.knownList as k (k.type + k.id)}
		<form method="POST" action="?/unknown" use:enhance style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--line)">
			<span>{k.label}</span>
			<input type="hidden" name="type" value={k.type} /><input type="hidden" name="id" value={k.id} />
			<button class="ghost">되돌리기</button>
		</form>
	{/each}
</div>
