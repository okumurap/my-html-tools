const test = require('node:test');
const assert = require('node:assert/strict');
const { transforms, apply, runPipeline } = require('./transforms.js');

test('v6で表示されていた13変換を維持', () => {
  assert.equal(transforms.length, 13);
  assert.equal(new Set(transforms.map(t => t.id)).size, 13);
  for (const transform of transforms) assert.equal(typeof apply(transform.id, ''), 'string');
});
test('全角・半角と濁点、ASCII以外の保護', () => {
  assert.equal(apply('half-all', 'ＡＢＣ１２３　ガパ。'), 'ABC123 ｶﾞﾊﾟ｡');
  assert.equal(apply('half-ascii', 'ＡＢＣ１２３　ガパ。'), 'ABC123 ガパ。');
  assert.equal(apply('full', 'ABC 123 ｶﾞﾊﾟ｡'), 'ＡＢＣ　１２３　ガパ。');
  assert.equal(apply('half-all', '😊漢字'), '😊漢字');
});
test('空白と改行 CRLF / CR / LF', () => {
  assert.equal(apply('space', '  a\t\t b  \r\n　c  d　'), 'a b\nc d');
  assert.equal(apply('newline', 'a\r\nb\rc\nd'), 'a b c d');
});
test('Windows禁止文字、予約名、空ファイル名', () => {
  assert.equal(apply('filename', 'CON.txt'), '_CON.txt');
  assert.equal(apply('filename', 'a/b:c?. '), 'a_b_c_');
  assert.equal(apply('filename', '...'), 'untitled');
});
test('Markdownチェック、重複削除、空行削除、昇順', () => {
  assert.equal(apply('markdown', 'a\n\nb'), '- [ ] a\n\n- [ ] b');
  assert.equal(apply('unique', 'b\na\nb\nA'), 'b\na\nA');
  assert.equal(apply('no-blank', 'a\n \n\tb\n\n'), 'a\n\tb');
  assert.equal(apply('sort', 'item10\nitem2\nitem1'), 'item1\nitem2\nitem10');
});
test('CSV引用符と改行を含むフィールド', () => {
  assert.equal(apply('quote', 'a"b\nc,d'), '"a""b"\n"c,d"');
  assert.equal(apply('csv-quoted', 'a"b\nc,d'), '"a""b","c,d"');
  assert.equal(apply('csv-plain', 'a\nb\nc'), 'a,b,c');
});
test('連続変換は指定順で処理し、非破壊', () => {
  const input = ' ＡＢＣ　\r\n ＡＢＣ　';
  assert.equal(runPipeline(input, ['half-ascii', 'space', 'unique', 'csv-quoted']), '"ABC"');
  assert.equal(input, ' ＡＢＣ　\r\n ＡＢＣ　');
  assert.equal(runPipeline('test', []), 'test');
  assert.throws(() => apply('invalid', ''), /不明な変換/);
});