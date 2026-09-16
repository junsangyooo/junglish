<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { speak, voices } from '$lib/tts';
	let { data, form } = $props();
	let list = $state<SpeechSynthesisVoice[]>([]);
	let voice = $state('');
	let rate = $state('0.95');
	let ttsSupported = $state(true);

	onMount(() => {
		ttsSupported = typeof speechSynthesis !== 'undefined';
		if (ttsSupported) {
			const load = () => (list = voices());
			load();
			speechSynthesis.onvoiceschanged = load;
		}
		try {
			voice = localStorage.getItem('tts_voice') ?? '';
			rate = localStorage.getItem('tts_rate') ?? '0.95';
		} catch { /* storage unavailable */ }
	});

	function saveTts() {
		try {
			localStorage.setItem('tts_voice', voice);
			localStorage.setItem('tts_rate', rate);
		} catch { /* storage unavailable */ }
		speak('This is how I sound.');
	}
</script>

<div class="pane">
	<h1 style="margin:14px 0 12px">설정</h1>
	{#if form?.message}<p class="small toast-ok">{form.message}</p>{/if}

	<h2>일일 복습 상한</h2>
	<div class="card tight">
		<p class="small muted" style="margin:0 0 10px">하루에 한 번에 밀어 넣을 복습 카드 수입니다 (10~500).</p>
		<form method="POST" action="?/limit" use:enhance class="row">
			<input name="review_limit" type="number" inputmode="numeric" min="10" max="500" value={data.review_limit} />
			<button class="btn-quiet" style="flex:0 0 90px">저장</button>
		</form>
	</div>

	<h2>발음</h2>
	<div class="card tight">
		{#if ttsSupported}
			<label for="tts-voice">음성</label>
			<select id="tts-voice" bind:value={voice}>
				<option value="">기본</option>
				{#each list as v}<option value={v.name}>{v.name} ({v.lang})</option>{/each}
			</select>
			<label for="tts-rate" style="margin-top:14px">속도 <span class="num">{rate}배</span></label>
			<input id="tts-rate" type="range" min="0.6" max="1.3" step="0.05" bind:value={rate} />
			<button class="btn-quiet" style="margin-top:10px" onclick={saveTts}>저장하고 들어보기</button>
		{:else}
			<p class="small muted" style="margin:0">이 브라우저는 음성 재생을 지원하지 않습니다. Safari나 Chrome에서 열어주세요.</p>
		{/if}
	</div>

	<h2>비밀번호</h2>
	<div class="card tight">
		<form method="POST" action="?/password" use:enhance class="stack">
			<input name="current" type="password" placeholder="현재 비밀번호" autocomplete="current-password" required />
			<input name="next" type="password" placeholder="새 비밀번호 (8자 이상)" autocomplete="new-password" required />
			<button class="btn-quiet">변경</button>
		</form>
	</div>

	<h2>계정</h2>
	<form method="POST" action="/logout" style="margin-bottom:16px">
		<button class="btn-quiet">로그아웃</button>
	</form>
</div>

<style>
	.toast-ok { color: var(--brand); font-weight: 700; }
	input[type='range'] { padding: 0; border: 0; background: transparent; accent-color: var(--brand); }
</style>
