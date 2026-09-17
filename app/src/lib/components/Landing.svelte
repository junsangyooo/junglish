<!-- app/src/lib/components/Landing.svelte — what a visitor sees at '/' before signing in. -->
<script lang="ts">
	import type { ContentTotals } from '$lib/server/content';
	let { totals, signupOpen }: { totals: ContentTotals; signupOpen: boolean } = $props();

	const steps = ['복습', '신규 단어', '신규 패턴', '읽기·듣기', '쉐도잉', '내 문장', '마무리'];
	const features: [string, string, string][] = [
		['🧠', '잊을 때쯤 다시', 'FSRS 간격 반복이 오늘 복습할 것만 골라 줍니다. 버튼마다 다음 복습이 언제인지 보여요.'],
		['💬', '대화 속에서 굳히기', '그날 배운 단어와 표현이 실제 업무 대화로 다시 나옵니다. 빈칸을 채우고 한 줄씩 따라 말해요.'],
		['✍️', '내 문장으로 마무리', '배운 표현으로 내 상황에 맞는 문장을 씁니다. 채점하지 않고 기록만 남겨요.']
	];
</script>

<div class="pane">
	<header class="hero">
		<p class="mark">🌿</p>
		<h1>Junglish</h1>
		<p class="tagline">매일 20분, 일에서 쓰는 영어</p>
		<p class="muted small sub">리그도 젬도 없습니다. 하루 한 번, 오늘 몫만 끝내면 되는 학습앱이에요.</p>
	</header>

	<div class="numbers card">
		<div><p class="n num">{totals.words.toLocaleString()}</p><p class="small muted">단어</p></div>
		<div><p class="n num">{totals.patterns.toLocaleString()}</p><p class="small muted">표현·패턴</p></div>
		<div><p class="n num">{totals.dialogues.toLocaleString()}</p><p class="small muted">대화</p></div>
	</div>
	<p class="small muted center days">{totals.days}일치 학습이 준비돼 있습니다</p>

	<h2>하루 흐름</h2>
	<div class="steps">
		{#each steps as s, i}
			<span class="chip small">{i + 1}. {s}</span>
		{/each}
	</div>

	<h2>이렇게 배웁니다</h2>
	{#each features as [icon, title, body]}
		<div class="card tight feature">
			<span class="icon">{icon}</span>
			<div>
				<p class="f-title">{title}</p>
				<p class="small muted" style="margin:0">{body}</p>
			</div>
		</div>
	{/each}

	<p class="small muted center note">
		{signupOpen ? '가입에는 초대 코드가 필요합니다.' : '지금은 새 가입을 받지 않고 있어요.'}
	</p>
</div>

<div class="bar stack">
	<a class="btn" href="/login">로그인</a>
	{#if signupOpen}<a class="btn btn-quiet" href="/signup">초대 코드로 시작하기</a>{/if}
</div>

<style>
	.hero { text-align: center; padding: 8dvh 0 24px; }
	.mark { font-size: 56px; margin: 0; }
	h1 { font-size: 34px; margin: 6px 0 2px; }
	.tagline { font-weight: 700; margin: 0 0 8px; }
	.sub { max-width: 30ch; margin: 0 auto; }
	.numbers { display: flex; text-align: center; padding: 16px 12px; }
	.numbers > div { flex: 1; }
	.n { font-size: 22px; font-weight: 800; margin: 0; }
	.days { margin: 8px 0 0; }
	.steps { display: flex; flex-wrap: wrap; gap: 6px; }
	.feature { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
	.icon { font-size: 24px; line-height: 1.2; }
	.f-title { font-weight: 700; margin: 0 0 2px; }
	.note { margin: 18px 0 8px; }
</style>
