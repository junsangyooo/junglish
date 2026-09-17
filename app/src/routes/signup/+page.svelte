<!-- app/src/routes/signup/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="screen">
	<div class="pane fill" style="justify-content:center">
		<div class="center" style="margin-bottom:24px">
			<p style="font-size:44px; margin:0">🌿</p>
			<h1 style="font-size:26px; margin:6px 0 2px">시작하기</h1>
			<p class="muted small">초대 코드가 있으면 바로 계정을 만들 수 있어요</p>
		</div>

		{#if data.open}
			<form method="POST" use:enhance class="stack">
				<div>
					<label for="name">이름</label>
					<input id="name" name="name" value={form?.name ?? ''} placeholder="로그인할 때 쓸 이름"
						autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required />
					<p class="small muted hint">2~20자, 한글·영문·숫자와 . _ -</p>
				</div>
				<div>
					<label for="password">비밀번호</label>
					<input id="password" name="password" type="password" placeholder="8자 이상" autocomplete="new-password" required />
				</div>
				<div>
					<label for="invite">초대 코드</label>
					<input id="invite" name="invite" placeholder="전달받은 코드" autocapitalize="none" autocorrect="off" spellcheck="false" required />
				</div>
				{#if form?.message}<p class="small" style="color:var(--again); margin:0">{form.message}</p>{/if}
				<button>계정 만들기</button>
			</form>
		{:else}
			<div class="card center">
				<p style="margin:0 0 6px; font-weight:700">지금은 가입을 받지 않습니다</p>
				<p class="small muted" style="margin:0">이미 계정이 있다면 로그인해 주세요.</p>
			</div>
		{/if}
	</div>

	<div class="bar stack">
		<a class="btn btn-quiet" href="/login">이미 계정이 있어요</a>
		<a class="btn-ghost btn" href="/">처음 화면으로</a>
	</div>
</div>

<style>
	.hint { margin: 6px 0 0; }
</style>
