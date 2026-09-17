// Checks that every built asset is actually named in the built service worker.
// The service worker's list comes from $service-worker at build time; this script
// re-scans the output directory independently, so the two sources can disagree.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CLIENT = 'build/client';
const SW = join(CLIENT, 'service-worker.js');

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

let sw;
try {
	sw = readFileSync(SW, 'utf8');
} catch {
	console.error(`verify:sw — ${SW} 가 없습니다. 먼저 npm run build 를 실행하세요.`);
	process.exit(1);
}

const assets = walk(join(CLIENT, '_app', 'immutable'))
	.filter((f) => /\.(js|css)$/.test(f))
	.map((f) => '/' + relative(CLIENT, f));

const missing = assets.filter((path) => !sw.includes(path));

if (missing.length) {
	console.error(`verify:sw — precache 목록에서 빠진 파일 ${missing.length}개:`);
	for (const path of missing.slice(0, 10)) console.error('   ' + path);
	process.exit(1);
}

const offline = sw.includes('/offline.html');
if (!offline) {
	console.error('verify:sw — 오프라인 폴백 페이지(/offline.html)가 precache 목록에 없습니다.');
	process.exit(1);
}

console.log(`verify:sw — 빌드 산출물 ${assets.length}개와 오프라인 폴백 모두 precache 목록에 있습니다.`);
