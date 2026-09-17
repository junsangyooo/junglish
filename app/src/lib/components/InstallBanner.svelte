<!-- app/src/lib/components/InstallBanner.svelte — shown only in a browser tab, never once installed. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { dismiss, isDismissed, isIos, isStandalone, shouldShowInstallBanner } from '$lib/install';

	let show = $state(false);
	let ios = $state(false);
	let prompt: (Event & { prompt(): Promise<void> }) | null = $state(null);

	onMount(() => {
		ios = isIos();
		show = shouldShowInstallBanner({ standalone: isStandalone(), dismissed: isDismissed() });
		const onPrompt = (e: Event) => {
			e.preventDefault();
			prompt = e as Event & { prompt(): Promise<void> };
		};
		addEventListener('beforeinstallprompt', onPrompt);
		return () => removeEventListener('beforeinstallprompt', onPrompt);
	});

	function close() {
		dismiss();
		show = false;
	}

	async function install() {
		if (!prompt) return;
		await prompt.prompt();
		close();
	}
</script>

{#if show}
	<div class="banner">
		<span class="mark">🌿</span>
		<div class="text">
			<p class="title">홈 화면에 두고 쓰세요</p>
			<p class="small muted">
				{#if ios}
					공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 열리고 알림도 받을 수 있어요.
				{:else}
					설치하면 앱처럼 열리고, 오프라인에서도 오늘 미션을 볼 수 있어요.
				{/if}
			</p>
		</div>
		<div class="actions">
			{#if prompt}<button class="btn-sm" onclick={install}>설치</button>{/if}
			<button class="btn-ghost btn-sm" onclick={close} aria-label="설치 안내 닫기">닫기</button>
		</div>
	</div>
{/if}

<style>
	.banner {
		display: flex; align-items: flex-start; gap: 10px;
		margin: 0 var(--pad) 10px; padding: 12px 14px;
		background: var(--brand-soft); border-radius: var(--r-md);
	}
	.mark { font-size: 20px; line-height: 1.3; }
	.text { flex: 1; min-width: 0; }
	.title { font-weight: 700; margin: 0 0 2px; }
	.text p { margin: 0; }
	.actions { display: flex; flex-direction: column; gap: 4px; flex: none; }
</style>
