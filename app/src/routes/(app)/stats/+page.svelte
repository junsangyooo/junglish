<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();
	let editing = $state<number | null>(null);
	const max = $derived(Math.max(1, ...data.next7.map((d) => d.n)));
	// The grid starts on a Monday, so 7 consecutive days make one column.
	const weeks = $derived(
		Array.from({ length: Math.ceil(data.grid.length / 7) }, (_, i) => data.grid.slice(i * 7, i * 7 + 7))
	);
</script>

<div class="pane">
	<h1 style="margin:14px 0 12px">통계</h1>

	<div class="row">
		<div class="card tight"><p class="small muted" style="margin:0">스트릭</p><p class="stat num">🔥 {data.streak}</p></div>
		<div class="card tight"><p class="small muted" style="margin:0">학습 중</p><p class="stat num">{data.learning}</p></div>
	</div>
	<div class="row" style="margin-top:8px">
		<div class="card tight"><p class="small muted" style="margin:0">안정 (21일+)</p><p class="stat num">{data.mature}</p></div>
		<div class="card tight"><p class="small muted" style="margin:0">이미 앎</p><p class="stat num">{data.known}</p></div>
	</div>

	<h2>학습 기록 (12주)</h2>
	<div class="card tight grid-wrap">
		<div class="grid">
			{#each weeks as week}
				<div class="col">
					{#each week as d}
						<span class="cell" class:on={d.active} class:today={d.today} title={d.date}></span>
					{/each}
				</div>
			{/each}
		</div>
		<p class="small muted" style="margin:10px 0 0">누적 복습 {data.reviews}회</p>
	</div>

	<h2>7일 복습 예정</h2>
	<div class="card tight bars">
		{#each data.next7 as d}
			<div class="bar-col">
				<span class="small muted num">{d.n}</span>
				<div class="bar-fill" style="height:{(d.n / max) * 72}px"></div>
				<span class="small muted num">{d.date.slice(5)}</span>
			</div>
		{/each}
	</div>

	<h2>내 문장 ({data.sentences.length})</h2>
	{#each data.sentences as s (s.id)}
		<div class="card tight" style="margin-bottom:8px">
			<p class="small muted" style="margin:0">{s.pattern}</p>
			{#if editing === s.id}
				<form method="POST" action="?/editSentence" use:enhance={() => { editing = null; }} class="stack" style="margin-top:6px">
					<input type="hidden" name="id" value={s.id} />
					<input name="text" value={s.text} />
					<button class="btn-sm" style="width:100%">저장</button>
				</form>
			{:else}
				<div class="sentence-row">
					<p style="margin:4px 0">{s.text}</p>
					<button class="btn-ghost btn-sm" onclick={() => (editing = s.id)}>수정</button>
				</div>
			{/if}
		</div>
	{/each}
	{#if data.sentences.length === 0}
		<p class="muted small">아직 없습니다. 미션의 '내 문장' 단계에서 써 보세요.</p>
	{/if}

	<h2>이미 앎 ({data.knownList.length})</h2>
	{#each data.knownList as k (k.type + k.id)}
		<form method="POST" action="?/unknown" use:enhance class="known-row">
			<span>{k.label}</span>
			<input type="hidden" name="type" value={k.type} /><input type="hidden" name="id" value={k.id} />
			<button class="btn-ghost btn-sm">되돌리기</button>
		</form>
	{/each}
	{#if data.knownList.length === 0}
		<p class="muted small">카드를 '이미 알아요'로 넘기면 여기에 쌓입니다.</p>
	{/if}
</div>

<style>
	.stat { font-size: 26px; font-weight: 800; margin: 2px 0 0; }
	.grid-wrap { overflow-x: auto; }
	.grid { display: flex; gap: 3px; min-width: max-content; }
	.col { display: flex; flex-direction: column; gap: 3px; }
	.cell { width: 12px; height: 12px; border-radius: 3px; background: var(--surface-2); }
	.cell.on { background: var(--brand); }
	.cell.today { outline: 2px solid var(--brand); outline-offset: 1px; }
	.bars { display: flex; gap: 6px; align-items: flex-end; }
	.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; justify-content: flex-end; }
	.bar-fill { width: 100%; min-height: 3px; border-radius: 4px 4px 2px 2px; background: var(--brand); }
	.sentence-row { display: flex; align-items: center; gap: 8px; }
	.sentence-row p { flex: 1; }
	.known-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--line); }
</style>
