<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { speak, voices } from '$lib/tts';
	let { data, form } = $props();
	let list = $state<SpeechSynthesisVoice[]>([]);
	let voice = $state('');
	let rate = $state('0.95');
	onMount(() => {
		const load = () => (list = voices());
		load(); speechSynthesis.onvoiceschanged = load;
		try { voice = localStorage.getItem('tts_voice') ?? ''; rate = localStorage.getItem('tts_rate') ?? '0.95'; } catch {}
	});
	function saveTts() { try { localStorage.setItem('tts_voice', voice); localStorage.setItem('tts_rate', rate); } catch {} speak('This is how I sound.'); }
</script>

<div style="overflow:auto; flex:1">
	<h1>설정</h1>
	{#if form?.message}<p class="small" style="color:var(--accent)">{form.message}</p>{/if}
	<h2>일일 복습 상한</h2>
	<form method="POST" action="?/limit" use:enhance class="row">
		<input name="review_limit" type="number" min="10" max="500" value={data.review_limit} />
		<button>저장</button>
	</form>
	<h2>발음 음성</h2>
	<select bind:value={voice} style="width:100%; font-size:17px; padding:12px">
		<option value="">기본</option>
		{#each list as v}<option value={v.name}>{v.name} ({v.lang})</option>{/each}
	</select>
	<p><label class="small muted" for="tts-rate">속도 {rate}</label></p>
	<input id="tts-rate" type="range" min="0.6" max="1.3" step="0.05" bind:value={rate} />
	<button class="ghost" onclick={saveTts}>저장하고 들어보기</button>
	<h2>비밀번호 변경</h2>
	<form method="POST" action="?/password" use:enhance>
		<p><input name="current" type="password" placeholder="현재 비밀번호" required /></p>
		<p><input name="next" type="password" placeholder="새 비밀번호 (8자 이상)" required /></p>
		<button>변경</button>
	</form>
	<h2>계정</h2>
	<form method="POST" action="/logout"><button class="ghost">로그아웃</button></form>
</div>
