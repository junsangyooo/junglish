<!-- app/src/routes/(app)/+page.svelte -->
<script lang="ts">
	let { data } = $props();
	let done = $derived(data.finishedToday !== null);
</script>

<div class="pane fill">
	<header>
		<div class="head-row">
			<div>
				<p class="small muted" style="margin:0">오늘의 학습</p>
				<h1>Day {data.day}</h1>
			</div>
			<span class="chip flame num">🔥 {data.streak}일</span>
		</div>
		<div class="week">
			{#each data.week as d}
				<div class="day">
					<span class="small muted">{d.label}</span>
					<span class="dot" class:on={d.active} class:today={d.today}>
						{#if d.active}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	</header>

	{#if !data.hasContent}
		<div class="card">
			<h2 style="margin-top:0">오늘 학습할 내용이 아직 없어요</h2>
			<p class="muted small">준비된 마지막 Day까지 모두 끝냈습니다. 새 콘텐츠가 추가되면 이어서 학습할 수 있어요.</p>
			<p class="muted small">그동안은 아래에서 복습을 계속하세요.</p>
		</div>
	{:else if done}
		<div class="card center pop" style="margin-bottom:12px">
			<p style="font-size:44px; margin:4px 0">🌿</p>
			<h2 style="margin:0">Day {data.finishedToday} 완료</h2>
			<p class="muted small">오늘 몫은 끝났습니다. 내일 이어서 스트릭을 지켜요.</p>
		</div>
		<div class="card tight">
			<p class="small muted" style="margin:0 0 2px">지금 복습할 카드</p>
			<p class="num" style="font-size:22px; font-weight:800; margin:0">{data.due}개</p>
		</div>
	{:else}
		<ol class="path">
			{#each data.overview as s, i}
				<li class={s.state}>
					<span class="marker">
						{#if s.state === 'done'}
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
						{:else}
							{i + 1}
						{/if}
					</span>
					<span class="label">{s.label}</span>
					<span class="detail small muted num">{s.detail}</span>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<div class="bar stack">
	{#if data.hasContent && !done}
		<a class="btn" href="/mission/{data.step}">
			{data.stepIndex === 0 ? `Day ${data.day} 시작하기` : `이어하기 · ${data.stepIndex}/${data.totalSteps}`}
		</a>
	{/if}
	<a class="btn btn-quiet" href="/review">복습만 하기 · {data.due}개</a>
</div>

<style>
	header { padding: 12px 0 16px; }
	.head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.week { display: flex; gap: 6px; margin-top: 14px; }
	.day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; }
	.dot {
		width: 30px; height: 30px; border-radius: 999px; background: var(--surface-2); border: 2px solid transparent;
		display: flex; align-items: center; justify-content: center; color: var(--on-brand);
	}
	.dot.on { background: var(--brand); }
	.dot.today { border-color: var(--brand); }
	.path { list-style: none; margin: 0; padding: 0; position: relative; }
	.path li {
		display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 8px;
		background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
	}
	.path li.current { border-color: var(--brand); border-width: 2px; background: var(--brand-soft); }
	.path li.todo { opacity: 0.55; }
	.marker {
		flex: none; width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
		background: var(--surface-2); color: var(--muted); font-size: 13px; font-weight: 800;
	}
	.path li.done .marker { background: var(--brand); color: var(--on-brand); }
	.path li.current .marker { background: var(--brand); color: var(--on-brand); }
	.label { flex: 1; font-weight: 700; }
</style>
