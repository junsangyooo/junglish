import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { SqliteError } from 'better-sqlite3';
import { hashPassword } from '../src/lib/server/auth';
import { getDbs } from '../src/lib/server/db';

const argi = process.argv.indexOf('--name');
const name = argi > 0 ? process.argv[argi + 1] : undefined;
if (!name || name.startsWith('--')) {
	console.error('usage: npm run user:add -- --name <name>');
	process.exit(1);
}
const rl = createInterface({ input: stdin, output: stdout });
const pw = await rl.question('password: ');
rl.close();
try {
	getDbs().progress.prepare('insert into users(name,password_hash) values(?,?)').run(name, hashPassword(pw));
	console.log(`user '${name}' created`);
} catch (e) {
	if (e instanceof SqliteError && e.message.includes('UNIQUE')) console.error(`user '${name}' already exists`);
	else throw e;
}
