<!-- app/src/routes/login/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="screen">
	<div class="pane fill" style="justify-content:center">
		<div class="center" style="margin-bottom:28px">
			<p style="font-size:52px; margin:0">🌿</p>
			<h1 style="font-size:30px">Junglish</h1>
			<p class="muted">매일 20분, 일에서 쓰는 영어</p>
		</div>
		<form method="POST" use:enhance class="stack">
			<input name="name" placeholder="이름" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required />
			<input name="password" type="password" placeholder="비밀번호" autocomplete="current-password" required />
			{#if form?.message}<p class="small" style="color:var(--again); margin:0">{form.message}</p>{/if}
			<button>로그인</button>
		</form>
	</div>

	<div class="bar stack">
		{#if data.signupOpen}
			<a class="btn btn-quiet" href="/signup">초대 코드로 계정 만들기</a>
		{/if}
		<a class="btn-ghost btn" href="/">처음 화면으로</a>
	</div>
</div>
