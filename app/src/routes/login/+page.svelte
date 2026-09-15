<!-- app/src/routes/login/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<div class="screen">
	<div class="grow">
		<h1>Junglish</h1>
		<form method="POST" use:enhance>
			<p><input name="name" placeholder="이름" autocomplete="username" required /></p>
			<p><input name="password" type="password" placeholder="비밀번호" autocomplete="current-password" required /></p>
			{#if form?.message}<p class="small" style="color: var(--again)">{form.message}</p>{/if}
			<button style="width:100%">로그인</button>
		</form>
	</div>
</div>
