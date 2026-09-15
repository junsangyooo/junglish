import { openDbs, type Dbs } from '../src/lib/server/db';

const CONTENT_SCHEMA = `
CREATE TABLE words (id INTEGER PRIMARY KEY, day INTEGER, seq INTEGER, word TEXT, pos TEXT, ipa TEXT, meaning_ko TEXT,
  example_work TEXT, example_work_ko TEXT, example_daily TEXT, example_daily_ko TEXT, collocations TEXT, freq_rank INTEGER);
CREATE TABLE patterns (id INTEGER PRIMARY KEY, day INTEGER, seq INTEGER, pattern TEXT, meaning_ko TEXT, category TEXT,
  grammar_note_ko TEXT, register TEXT, example_1 TEXT, example_1_ko TEXT, example_2 TEXT, example_2_ko TEXT,
  cloze_sentence TEXT, cloze_answer TEXT);
CREATE TABLE dialogues (id INTEGER PRIMARY KEY, day INTEGER UNIQUE, title_ko TEXT, situation_ko TEXT, lines TEXT);
CREATE TABLE quiz_items (id INTEGER PRIMARY KEY, dialogue_id INTEGER, line_index INTEGER, blank_text TEXT, answer TEXT, pattern_id INTEGER);
`;

export function makeTestDbs(): Dbs {
	const dbs = openDbs(':memory:', ':memory:');
	const c = dbs.content;
	c.exec(CONTENT_SCHEMA);
	const insWord = c.prepare(`insert into words(id,day,seq,word,pos,ipa,meaning_ko,example_work,example_work_ko,example_daily,example_daily_ko,collocations,freq_rank)
		values(?,1,?,?,'v','/x/',?,?,'번역',?,'번역','["a b"]',?)`);
	insWord.run(1, 1, 'leverage', '활용하다', 'We can leverage our data to win.', 'She leveraged her skills.', 1);
	insWord.run(2, 2, 'negotiate', '협상하다', 'We need to negotiate the price.', 'I negotiated with my kid.', 2);
	insWord.run(3, 3, 'invoice', '송장', 'Please send the invoice today.', 'The invoice arrived.', 3);
	const insPat = c.prepare(`insert into patterns(id,day,seq,pattern,meaning_ko,category,grammar_note_ko,register,example_1,example_1_ko,example_2,example_2_ko,cloze_sentence,cloze_answer)
		values(?,1,?,?,?,?,'','neutral','e1','ㅇ','e2','ㅇ',?,?)`);
	insPat.run(1, 1, 'I was wondering if you could ~', '혹시 ~해 주실 수 있을까 해서요', 'business', 'I was ___ if you could join.', 'wondering');
	insPat.run(2, 2, 'Just so we are on the same page', '확인차 말씀드리면', 'business', 'Just so we are on the same ___.', 'page');
	insPat.run(3, 3, "I'll circle back", '다시 연락드릴게요', 'daily', "I'll ___ back this afternoon.", 'circle');
	c.prepare(`insert into dialogues(id,day,title_ko,situation_ko,lines) values(1,1,'데모 일정','데모 잡기',?)`).run(
		JSON.stringify([
			{ speaker: 'Junsang', text: 'Hi Sarah, I was wondering if you could spare 30 minutes.', text_ko: '안녕하세요' },
			{ speaker: 'Sarah', text: 'Sure. Just so we are on the same page, is this the demo?', text_ko: '네' },
			{ speaker: 'Junsang', text: "Exactly. I'll circle back with slots.", text_ko: '네' }
		])
	);
	const insQuiz = c.prepare('insert into quiz_items(dialogue_id,line_index,blank_text,answer,pattern_id) values(1,?,?,?,?)');
	insQuiz.run(0, 'I was wondering if you could', 'I was wondering if you could', 1);
	insQuiz.run(1, 'Just so we are on the same page', 'Just so we are on the same page', 2);
	insQuiz.run(2, "I'll circle back", "I'll circle back", 3);
	dbs.progress.prepare("insert into users(id,name,password_hash) values(1,'test','x')").run();
	return dbs;
}
