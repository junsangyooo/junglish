<script lang="ts">
	let { label, index, total }: { label: string; index: number; total: number } = $props();
</script>

<div class="small muted" style="display:flex; justify-content:space-between; padding:12px 0 6px">
	<span>{label}</span><span>{index}/{total}</span>
</div>
<div style="height:4px; background:var(--line); border-radius:2px">
	<div style="height:4px; width:{total ? (index / total) * 100 : 0}%; background:var(--accent); border-radius:2px"></div>
</div>
