<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { isStandalone, isIos } from '$lib/install';
	import { speak, voices } from '$lib/tts';
	let { data, form } = $props();

	let list = $state<SpeechSynthesisVoice[]>([]);
	let voice = $state('');
	let rate = $state('0.95');
	let ttsSupported = $state(true);

	// push state
	let pushSupported = $state(true);
	let subscribedHere = $state(false);
	let pushMessage = $state('');
	let working = $state(false);
	let needsInstall = $state(false);

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

		pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
		needsInstall = isIos() && !isStandalone();
		if (pushSupported) {
			navigator.serviceWorker.ready
				.then((reg) => reg.pushManager.getSubscription())
				.then((sub) => (subscribedHere = !!sub))
				.catch(() => (subscribedHere = false));
		}
	});

	function saveTts() {
		try {
			localStorage.setItem('tts_voice', voice);
			localStorage.setItem('tts_rate', rate);
		} catch { /* storage unavailable */ }
		speak('This is how I sound.');
	}

	/** VAPID keys travel as base64url; the subscribe call wants raw bytes. */
	function keyBytes(base64: string): ArrayBuffer {
		const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(padded);
		const buffer = new ArrayBuffer(raw.length);
		const view = new Uint8Array(buffer);
		for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
		return buffer;
	}

	async function subscribeHere() {
		working = true;
		pushMessage = '';
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				pushMessage = '브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 허용해 주세요.';
				return;
			}
			const registration = await navigator.serviceWorker.ready;
			const sub = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: keyBytes(data.notify.publicKey)
			});
			const r = await fetch('/api/push', {
				method: 'POST', headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() })
			});
			if (!r.ok) throw new Error('save failed');
			subscribedHere = true;
			pushMessage = '이 기기로 알림을 받습니다.';
		} catch {
			pushMessage = '알림을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.';
		} finally {
			working = false;
		}
	}

	async function unsubscribeHere() {
		working = true;
		pushMessage = '';
		try {
			const registration = await navigator.serviceWorker.ready;
			const sub = await registration.pushManager.getSubscription();
			if (sub) {
				await sub.unsubscribe();
				await fetch('/api/push', {
					method: 'POST', headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint })
				});
			}
			subscribedHere = false;
			pushMessage = '이 기기에서는 알림을 받지 않습니다.';
		} catch {
			pushMessage = '해제하지 못했습니다.';
		} finally {
			working = false;
		}
	}
</script>

<div class="pane">
	<h1 style="margin:14px 0 12px">설정</h1>
	{#if form?.message}<p class="small toast-ok">{form.message}</p>{/if}

	<h2>복습 알림</h2>
	<div class="card tight">
		{#if !data.notify.available}
			<p class="small muted" style="margin:0">이 서버에는 알림 키가 설정돼 있지 않아 알림을 보낼 수 없습니다.</p>
		{:else}
			<form method="POST" action="?/notify" use:enhance>
				<label class="switch">
					<input type="checkbox" name="notify_enabled" checked={data.notify.enabled} />
					<span>매일 정해진 시각에 알림 받기</span>
				</label>
				<label for="notify_at" style="margin-top:14px">알림 시각</label>
				<input id="notify_at" name="notify_at" type="time" value={data.notify.at} required />
				<button class="btn-quiet" style="margin-top:12px">저장</button>
			</form>

			<hr />
			<p class="small muted" style="margin:0 0 8px">
				알림을 받으려면 기기마다 한 번씩 허용해야 합니다. 현재 {data.notify.devices}개 기기가 등록돼 있어요.
			</p>
			{#if needsInstall}
				<p class="small warn">iPhone은 홈 화면에 추가한 뒤에야 알림을 받을 수 있습니다. 공유 버튼 → "홈 화면에 추가"를 먼저 해주세요.</p>
			{:else if !pushSupported}
				<p class="small muted">이 브라우저는 웹 알림을 지원하지 않습니다.</p>
			{:else if subscribedHere}
				<button class="btn-quiet" disabled={working} onclick={unsubscribeHere}>이 기기 알림 끄기</button>
			{:else}
				<button class="btn-quiet" disabled={working} onclick={subscribeHere}>이 기기에서 알림 받기</button>
			{/if}
			{#if pushMessage}<p class="small" style="margin:8px 0 0">{pushMessage}</p>{/if}
		{/if}
	</div>

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
	.switch { display: flex; align-items: center; gap: 10px; font-size: 16px; color: var(--ink); font-weight: 600; margin: 0; }
	.switch input { width: 22px; height: 22px; flex: none; accent-color: var(--brand); }
	hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0; }
	.warn { color: var(--hard-press); margin: 0; }
</style>
