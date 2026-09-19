/* 文字列変換の純粋関数。UIと分離してNode.jsでもテストできるようにする。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TextFormatter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const splitLines = text => text.split(/\r\n|\n|\r/);
  const halfKana = new Map();
  for (let code = 0xff61; code <= 0xff9d; code++) {
    const half = String.fromCharCode(code);
    halfKana.set(half.normalize('NFKC'), half);
  }
  for (let code = 0xff66; code <= 0xff9d; code++) {
    const base = String.fromCharCode(code);
    for (const mark of ['\uff9e', '\uff9f']) {
      const composed = (base + mark).normalize('NFKC');
      if ([...composed].length === 1) halfKana.set(composed, base + mark);
    }
  }
  const asciiHalf = text => text.replace(/[\uff01-\uff5e\u3000]/g, char =>
    char === '\u3000' ? ' ' : String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  const toHalfAll = text => [...asciiHalf(text)].map(char => halfKana.get(char) ?? char).join('');
  const toFull = text => text.replace(/[\uff61-\uff9f]+/g, chunk => chunk.normalize('NFKC'))
    .replace(/[\x21-\x7e ]/g, char => char === ' ' ? '\u3000' : String.fromCharCode(char.charCodeAt(0) + 0xfee0));
  const tidySpaces = text => splitLines(text).map(line => line.replace(/[\t\u3000\u00a0]/g, ' ')
    .replace(/ {2,}/g, ' ').trim()).join('\n');
  const newlineToSpace = text => text.replace(/\r\n|\r|\n/g, ' ').replace(/ {2,}/g, ' ').trim();
  const safeFilename = text => {
    let name = text.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')
      .replace(/[\r\n]+/g, '_').replace(/[. ]+$/g, '').trim();
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\..*)?$/i.test(name)) name = '_' + name;
    return name || 'untitled';
  };
  const quote = value => '"' + value.replace(/"/g, '""') + '"';
  const markdownChecklist = text => splitLines(text).map(line => line.trim() ? `- [ ] ${line}` : line).join('\n');
  const uniqueLines = text => [...new Set(splitLines(text))].join('\n');
  const removeBlankLines = text => splitLines(text).filter(line => line.trim() !== '').join('\n');
  const sortLines = text => splitLines(text).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true })).join('\n');
  const quoteLines = text => splitLines(text).map(quote).join('\n');
  const commaQuoted = text => splitLines(text).map(quote).join(',');
  const commaPlain = text => splitLines(text).join(',');

  const transforms = [
    { id: 'half-all', title: '半角（すべて）', category: 'width', hint: '全角英数字・スペース・カタカナを半角へ', fn: toHalfAll },
    { id: 'half-ascii', title: '半角（英数字・記号・スペース）', category: 'width', hint: 'カタカナには触れず、ASCII相当だけ変換', fn: asciiHalf },
    { id: 'full', title: '全角', category: 'width', hint: '英数字・記号・スペース・半角カナを全角へ', fn: toFull },
    { id: 'space', title: '空白整理', category: 'space', hint: '各行の前後空白と連続スペースを整理', fn: tidySpaces },
    { id: 'newline', title: '改行を空白へ', category: 'space', hint: '複数行を一行へまとめる', fn: newlineToSpace },
    { id: 'filename', title: 'ファイル名安全化', category: 'dev', hint: 'Windowsで使えない文字と予約名を処理', fn: safeFilename },
    { id: 'markdown', title: 'Markdownチェック', category: 'dev', hint: '空白行以外にMarkdownの未チェック項目を追加', fn: markdownChecklist },
    { id: 'unique', title: '重複行削除', category: 'lines', hint: '最初に現れた行と元の順番を残す', fn: uniqueLines },
    { id: 'no-blank', title: '空行削除', category: 'lines', hint: '空白だけの行も除去', fn: removeBlankLines },
    { id: 'sort', title: '行を昇順', category: 'lines', hint: '日本語対応・数字の自然順で並べ替え', fn: sortLines },
    { id: 'quote', title: '各行を引用符で囲む', category: 'lines', hint: '行中の二重引用符はCSV形式でエスケープ', fn: quoteLines },
    { id: 'csv-quoted', title: 'カンマ区切り＋引用符', category: 'dev', hint: '各行を引用符付きCSVの1フィールドへ', fn: commaQuoted },
    { id: 'csv-plain', title: 'カンマ区切り', category: 'dev', hint: '各行をカンマで連結（CSV用エスケープなし）', fn: commaPlain }
  ];
  const byId = new Map(transforms.map(item => [item.id, item]));
  const apply = (id, input) => {
    const entry = byId.get(id);
    if (!entry) throw new Error('不明な変換です: ' + id);
    return entry.fn(String(input));
  };
  const runPipeline = (input, ids) => ids.reduce((text, id) => apply(id, text), String(input));
  return Object.freeze({ transforms, apply, runPipeline, splitLines, asciiHalf, toHalfAll, toFull });
});