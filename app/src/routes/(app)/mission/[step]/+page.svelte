<!-- app/src/routes/(app)/mission/[step]/+page.svelte -->
<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CardRunner from '$lib/components/CardRunner.svelte';
	import Dialogue from '$lib/components/Dialogue.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { speak, speakSequence } from '$lib/tts';
	let { data } = $props();

	const LABEL: Record<string, string> = { review: '복습', words: '신규 단어', patterns: '신규 패턴', dialogue: '읽기·듣기', shadow: '쉐도잉', write: '내 문장', final: '마무리 복습', done: '완료' };

	async function advance() {
		const r = await fetch('/api/step', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ day: data.day, from: data.step }) });
		if (!r.ok) { await invalidateAll(); return; }
		const { step } = await r.json();
		await goto(`/mission/${step}`, { invalidateAll: true });
	}

	// dialogue quiz state
	let showKo = $state(false);
	let answers = $state<Record<number, string>>({});
	let quizDone = $derived(data.dialogue ? data.dialogue.quiz.every((q) => answers[q.id] === q.blank_text) : false);
	let blanks = $derived(data.dialogue ? new Map(data.dialogue.quiz.filter((q) => answers[q.id] !== q.blank_text).map((q) => [q.line_index, q.blank_text])) : undefined);
	function playAll() {
		if (!data.dialogue) return;
		speakSequence(data.dialogue.lines.map((l) => l.text));
	}

	// shadow state
	let line = $state(0);

	// write state
	let texts = $state<Record<number, string>>({});
	let saveError = $state(false);
	async function saveSentences() {
		try {
			for (const s of data.suggestions ?? []) {
				const t = (texts[s.pattern.id] ?? '').trim();
				if (t && t !== s.existing) {
					const r = await fetch('/api/sentence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pattern_id: s.pattern.id, text: t }) });
					if (!r.ok) { saveError = true; return; }
				}
			}
		} catch {
			saveError = true;
			return;
		}
		saveError = false;
		await advance();
	}
</script>

{#if data.cards}
	<CardRunner cards={data.cards} label="Day {data.day} · {LABEL[data.step]}" onfinish={advance} />

{:else if data.step === 'dialogue' && data.dialogue}
	<ProgressBar label="Day {data.day} · 읽기·듣기" index={data.stepIndex} total={data.totalSteps} />
	<h2>{data.dialogue.title_ko}</h2>
	<p class="muted small" style="margin:0 0 8px">{data.dialogue.situation_ko}</p>
	<div class="row" style="margin-bottom:8px">
		<button class="ghost" onclick={playAll}>▶ 전체 듣기</button>
		<button class="ghost" onclick={() => (showKo = !showKo)}>{showKo ? '한글 숨기기' : '한글 보기'}</button>
	</div>
	<Dialogue lines={data.dialogue.lines} {showKo} {blanks} />
	<div style="padding:8px 0">
		{#each data.dialogue.quiz as q (q.id)}
			{#if answers[q.id] !== q.blank_text}
				<p class="small muted" style="margin:6px 0 4px">{q.line_index + 1}번째 줄 빈칸</p>
				<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px">
					{#each q.options as o}
						<button class="ghost" style="border:1px solid var(--line); font-size:14px; min-height:48px; color: {answers[q.id] === o && o !== q.blank_text ? 'var(--again)' : 'var(--fg)'}" onclick={() => (answers[q.id] = o)}>{o}</button>
					{/each}
				</div>
			{/if}
		{/each}
		<button style="width:100%; margin-top:8px" disabled={!quizDone} onclick={advance}>{quizDone ? '다음: 쉐도잉' : `빈칸 ${data.dialogue.quiz.length}개를 맞히세요`}</button>
	</div>

{:else if data.step === 'shadow' && data.dialogue}
	<ProgressBar label="Day {data.day} · 쉐도잉" index={line} total={data.dialogue.lines.length} />
	<p class="muted small">한 줄씩 듣고 따라 말하세요</p>
	<Dialogue lines={data.dialogue.lines} showKo={true} highlight={line} />
	<div class="row" style="padding:12px 0">
		<button class="ghost" onclick={() => speak(data.dialogue!.lines[line].text)}>▶ 듣기</button>
		{#if line < data.dialogue.lines.length - 1}
			<button onclick={() => line++}>다음 줄</button>
		{:else}
			<button onclick={advance}>다음: 내 문장</button>
		{/if}
	</div>

{:else if data.step === 'write' && data.suggestions}
	<ProgressBar label="Day {data.day} · 내 문장" index={data.stepIndex} total={data.totalSteps} />
	{#if saveError}<p class="small" style="background:var(--again); color:#fff; padding:6px 10px; border-radius:8px">저장 안 됨. 네트워크를 확인하세요.</p>{/if}
	<div class="card" style="flex:1">
		<p class="muted small">오늘 패턴으로 내 상황에 맞는 문장을 하나씩 써 보세요. 채점하지 않습니다.</p>
		{#each data.suggestions as s (s.pattern.id)}
			<p style="margin:14px 0 2px; font-weight:700">{s.pattern.pattern}</p>
			<p class="small muted" style="margin:0 0 6px">{s.pattern.meaning_ko} · 예: {s.pattern.example_1}</p>
			<textarea rows="2" placeholder="내 문장" value={texts[s.pattern.id] ?? s.existing ?? ''} oninput={(e) => (texts[s.pattern.id] = (e.target as HTMLTextAreaElement).value)}></textarea>
		{/each}
	</div>
	<div class="row" style="padding:12px 0">
		<button class="ghost" onclick={advance}>건너뛰기</button>
		<button onclick={saveSentences}>저장하고 다음</button>
	</div>

{:else if data.step === 'done' && data.summary}
	<div class="grow" style="text-align:center">
		<h1>Day {data.day} 완료</h1>
		<p style="font-size:40px">🔥 {data.streak}</p>
		<p class="muted">복습 {data.summary.reviews} · 신규 {data.summary.learned} · 이미 앎 {data.summary.known}</p>
	</div>
	<div class="row" style="padding:12px 0">
		<a class="btn ghost" href="/">홈으로</a>
		<a class="btn" href="/" data-sveltekit-reload>다음 Day 이어서</a>
	</div>
{/if}
