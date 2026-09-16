<!-- app/src/routes/(app)/mission/[step]/+page.svelte -->
<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CardRunner from '$lib/components/CardRunner.svelte';
	import Dialogue from '$lib/components/Dialogue.svelte';
	import SessionHeader from '$lib/components/SessionHeader.svelte';
	import { maskedTexts } from '$lib/quiz';
	import { speak, speakSequence } from '$lib/tts';
	let { data } = $props();

	let moving = $state(false);
	async function advance() {
		if (moving) return;
		moving = true;
		try {
			const r = await fetch('/api/step', {
				method: 'POST', headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ day: data.day, from: data.step })
			});
			if (!r.ok) { await invalidateAll(); return; }
			const { step } = await r.json();
			await goto(`/mission/${step}`, { invalidateAll: true });
		} finally {
			moving = false;
		}
	}

	// --- dialogue quiz: one blank at a time ---
	let showKo = $state(false);
	let solved = $state(new Set<number>());
	let wrong = $state<string | null>(null);
	let current = $derived(data.questions?.find((q) => !solved.has(q.id)));
	let texts = $derived(data.dialogue ? maskedTexts(data.dialogue.lines, data.questions ?? [], solved) : []);
	function answer(option: string) {
		if (!current) return;
		if (option === current.answer) {
			solved = new Set([...solved, current.id]);
			wrong = null;
			speak(data.dialogue!.lines[current.line_index].text);
		} else {
			wrong = option;
		}
	}

	// --- shadowing ---
	let line = $state(0);
	function goLine(next: number) {
		line = next;
		speak(data.dialogue!.lines[next].text);
	}

	// --- write ---
	let drafts = $state<Record<number, string>>({});
	let saveError = $state(false);
	let saving = $state(false);
	async function saveSentences() {
		if (saving) return;
		saving = true;
		try {
			for (const s of data.suggestions ?? []) {
				const text = (drafts[s.pattern.id] ?? s.existing ?? '').trim();
				if (!text || text === s.existing) continue;
				const r = await fetch('/api/sentence', {
					method: 'POST', headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ pattern_id: s.pattern.id, text })
				});
				if (!r.ok) { saveError = true; return; }
			}
			saveError = false;
			await advance();
		} catch {
			saveError = true;
		} finally {
			saving = false;
		}
	}
</script>

{#if data.cards}
	<CardRunner cards={data.cards} label="Day {data.day} · {data.label}" onfinish={advance} />

{:else if data.step === 'dialogue' && data.dialogue}
	<SessionHeader label="Day {data.day} · {data.label}" index={data.stepIndex} total={data.totalSteps} />
	<div class="pane">
		<h2 style="margin-top:0">{data.dialogue.title_ko}</h2>
		<p class="muted small">{data.dialogue.situation_ko}</p>
		<div class="row" style="margin:12px 0">
			<button class="btn-quiet btn-sm" onclick={() => speakSequence(data.dialogue!.lines.map((l) => l.text))}>▶ 전체 듣기</button>
			<button class="btn-quiet btn-sm" onclick={() => (showKo = !showKo)}>{showKo ? '한글 숨기기' : '한글 보기'}</button>
		</div>
		<Dialogue lines={data.dialogue.lines} {texts} {showKo} highlight={current ? current.line_index : -1} />
	</div>
	<div class="bar">
		{#if current}
			<p class="small muted center" style="margin:0 0 8px">
				빈칸 {solved.size + 1} / {data.questions?.length} · 알맞은 표현을 고르세요
			</p>
			<div class="options">
				{#each current.options as o}
					<button
						class="btn-quiet opt"
						class:shake={wrong === o}
						class:bad={wrong === o}
						onclick={() => answer(o)}>{o}</button
					>
				{/each}
			</div>
		{:else}
			<button disabled={moving} onclick={advance}>다음 · 쉐도잉</button>
		{/if}
	</div>

{:else if data.step === 'shadow' && data.dialogue}
	<SessionHeader label="Day {data.day} · {data.label}" index={line} total={data.dialogue.lines.length} />
	<div class="pane">
		<p class="small muted">한 줄씩 듣고 따라 말하세요</p>
		<Dialogue lines={data.dialogue.lines} texts={data.dialogue.lines.map((l) => l.text)} showKo={true} highlight={line} />
	</div>
	<div class="bar">
		<div class="row">
			<button class="btn-quiet" disabled={line === 0} onclick={() => goLine(line - 1)}>이전</button>
			<button class="btn-quiet" onclick={() => speak(data.dialogue!.lines[line].text)}>▶ 다시 듣기</button>
		</div>
		<div style="margin-top:8px">
			{#if line < data.dialogue.lines.length - 1}
				<button onclick={() => goLine(line + 1)}>다음 줄</button>
			{:else}
				<button disabled={moving} onclick={advance}>다음 · 내 문장</button>
			{/if}
		</div>
	</div>

{:else if data.step === 'write' && data.suggestions}
	<SessionHeader label="Day {data.day} · {data.label}" index={data.stepIndex} total={data.totalSteps} />
	<div class="pane">
		<p class="muted small">오늘 패턴으로 내 상황에 맞는 문장을 써 보세요. 채점하지 않습니다. 비워 두어도 넘어갑니다.</p>
		{#each data.suggestions as s (s.pattern.id)}
			<div class="card tight" style="margin-bottom:10px">
				<p style="margin:0 0 2px; font-weight:700">{s.pattern.pattern}</p>
				<p class="small muted" style="margin:0 0 8px">{s.pattern.meaning_ko}</p>
				<p class="small muted" style="margin:0 0 8px">예: {s.pattern.example_1}</p>
				<textarea
					rows="2"
					placeholder="내 문장"
					value={drafts[s.pattern.id] ?? s.existing ?? ''}
					oninput={(e) => (drafts[s.pattern.id] = (e.target as HTMLTextAreaElement).value)}
				></textarea>
			</div>
		{/each}
	</div>
	<div class="bar">
		{#if saveError}<p class="small" style="color:var(--again); margin:0 0 8px">저장하지 못했습니다. 연결을 확인하고 다시 눌러주세요.</p>{/if}
		<button disabled={saving || moving} onclick={saveSentences}>저장하고 다음</button>
	</div>

{:else if data.step === 'done' && data.summary}
	<div class="pane fill center">
		<div class="confetti" aria-hidden="true">
			{#each Array(14) as _, i}
				<i style="left:{(i * 7 + 4) % 100}%; animation-delay:{i * 0.12}s; background:{['var(--brand)', 'var(--gold)', 'var(--info)', 'var(--hard)'][i % 4]}"></i>
			{/each}
		</div>
		<div class="hero pop">
			<p style="font-size:56px; margin:0">🌿</p>
			<h1>Day {data.day} 완료</h1>
			<p class="chip flame num" style="font-size:20px; padding:10px 16px">🔥 {data.streak}일 연속</p>
		</div>
		<div class="row" style="margin-top:22px">
			<div class="card tight"><p class="small muted" style="margin:0">복습</p><p class="stat num">{data.summary.reviews}</p></div>
			<div class="card tight"><p class="small muted" style="margin:0">신규</p><p class="stat num">{data.summary.learned}</p></div>
			<div class="card tight"><p class="small muted" style="margin:0">이미 앎</p><p class="stat num">{data.summary.known}</p></div>
		</div>
	</div>
	<div class="bar stack">
		<a class="btn" href="/" data-sveltekit-reload>홈으로</a>
		<a class="btn btn-quiet" href="/review">복습 더 하기</a>
	</div>
{/if}

<style>
	.options { display: flex; flex-direction: column; gap: 8px; max-height: 46dvh; overflow-y: auto; }
	.opt { min-height: 52px; height: auto; padding: 10px 14px; font-size: 15px; font-weight: 600; text-align: center; }
	.opt.bad { color: var(--again); border-color: var(--again); }
	.hero { margin-top: 6dvh; }
	.stat { font-size: 26px; font-weight: 800; margin: 2px 0 0; }
	.confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
	.confetti i {
		position: absolute; top: -20px; width: 9px; height: 14px; border-radius: 2px;
		animation: fall 2.4s ease-in forwards;
	}
</style>
