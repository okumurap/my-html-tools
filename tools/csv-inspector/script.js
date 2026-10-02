(() => {
  'use strict';

  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const DISPLAY_ISSUE_LIMIT = 100;
  const TYPE_LABELS = {
    number: '数値',
    date: '日時',
    boolean: '真偽',
    category: 'カテゴリ',
    text: '文字列',
    empty: '空列'
  };

  const normalizeText = value => String(value ?? '').normalize('NFKC').trim();
  const isBlank = value => normalizeText(value) === '';
  const isBlankRow = row => row.every(isBlank);

  function detectDelimiter(text) {
    const counts = new Map([[',', 0], ['\t', 0], [';', 0]]);
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') { i += 1; continue; }
        quoted = !quoted;
        continue;
      }
      if (!quoted && (ch === '\n' || ch === '\r')) break;
      if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][1] > 0
      ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : ',';
  }

  function parseDelimited(text, delimiter = detectDelimiter(text)) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 1; }
          else quoted = false;
        } else {
          cell += ch;
        }
        continue;
      }
      if (ch === '"' && cell === '') { quoted = true; continue; }
      if (ch === delimiter) { row.push(cell); cell = ''; continue; }
      if (ch === '\r') {
        if (text[i + 1] === '\n') i += 1;
        row.push(cell); rows.push(row); row = []; cell = '';
        continue;
      }
      if (ch === '\n') {
        row.push(cell); rows.push(row); row = []; cell = '';
        continue;
      }
      cell += ch;
    }
    if (quoted) throw new Error('CSVの引用符が閉じていません。ファイル末尾付近を確認してください。');
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    if (rows.length && rows[0].length) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
    return { rows, delimiter };
  }

  function parseNumber(value) {
    let s = normalizeText(value);
    if (!s) return null;
    if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replaceAll(',', '');
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function dateInfo(value) {
    const s = normalizeText(value);
    if (!s) return null;
    let match;
    let pattern;
    if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) pattern = 'YYYY-MM-DD';
    else if ((match = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/))) pattern = 'YYYY/MM/DD';
    else if ((match = s.match(/^(\d{4})(\d{2})(\d{2})$/))) pattern = 'YYYYMMDD';
    else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/))) pattern = 'ISO日時';
    else return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    if (pattern === 'ISO日時') {
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6] || 0);
      if (hour > 23 || minute > 59 || second > 59) return null;
    }
    return { pattern };
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  function outlierIndexes(entries) {
    if (entries.length < 4) return new Set();
    const values = entries.map(entry => entry.value).slice().sort((a, b) => a - b);
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    const iqr = q3 - q1;
    if (!Number.isFinite(iqr) || iqr <= 0) return new Set();
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    return new Set(entries.filter(entry => entry.value < low || entry.value > high).map(entry => entry.rowIndex));
  }

  function mostCommon(values) {
    const counts = new Map();
    values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }

  function inferColumn(header, values, forcedType = 'auto') {
    const nonEmptyEntries = values
      .map((value, rowIndex) => ({ value, rowIndex }))
      .filter(entry => !isBlank(entry.value));
    const nonEmpty = nonEmptyEntries.length;
    const blanks = values.length - nonEmpty;
    const normalizedValues = nonEmptyEntries.map(entry => normalizeText(entry.value));
    const distinct = new Set(normalizedValues).size;
    if (!nonEmpty) return { type: forcedType==='auto'?'empty':forcedType, blanks, distinct, numericMismatches: [], dateMismatches: [], outliers: [], detail: '値なし' };

    const numericEntries = nonEmptyEntries
      .map(entry => ({ ...entry, parsed: parseNumber(entry.value) }))
      .filter(entry => entry.parsed !== null)
      .map(entry => ({ rowIndex: entry.rowIndex, value: entry.parsed }));
    const dateEntries = nonEmptyEntries
      .map(entry => ({ ...entry, info: dateInfo(entry.value) }))
      .filter(entry => entry.info);
    const booleanSet = new Set(['true', 'false', 'yes', 'no', '0', '1', '○', '×']);
    const booleanCount = normalizedValues.filter(value => booleanSet.has(value.toLowerCase())).length;
    const numericRatio = numericEntries.length / nonEmpty;
    const dateRatio = dateEntries.length / nonEmpty;
    const headerSuggestsDate = /(date|time|日時|日付|年月日|時刻)/i.test(header);
    const dominantDatePattern = mostCommon(dateEntries.map(entry => entry.info.pattern));
    const categoryThreshold = Math.min(20, Math.max(2, Math.ceil(nonEmpty * 0.2)));

    let type = 'text';
    if (dateRatio >= 0.8 && (headerSuggestsDate || numericRatio < 0.95 || dominantDatePattern !== 'YYYYMMDD')) type = 'date';
    else if (numericRatio >= 0.8) type = 'number';
    else if (booleanCount / nonEmpty >= 0.9) type = 'boolean';
    else if (nonEmpty >= 3 && distinct <= categoryThreshold) type = 'category';

    if (forcedType !== 'auto') type = forcedType;
    const numericMismatches = type === 'number'
      ? nonEmptyEntries.filter(entry => parseNumber(entry.value) === null).map(entry => entry.rowIndex)
      : [];
    const dateMismatches = type === 'date'
      ? nonEmptyEntries.filter(entry => {
          const info = dateInfo(entry.value);
          return !info || (dominantDatePattern && info.pattern !== dominantDatePattern);
        }).map(entry => entry.rowIndex)
      : [];
    const outliers = type === 'number'
      ? [...outlierIndexes(numericEntries.filter(entry => !numericMismatches.includes(entry.rowIndex)))]
      : [];

    let detail = `${nonEmpty}件中 ${distinct}種類`;
    if (type === 'number' && numericEntries.length) {
      const nums = numericEntries.map(entry => entry.value);
      detail = `最小 ${nums.reduce((a,b)=>Math.min(a,b), Infinity)} / 最大 ${nums.reduce((a,b)=>Math.max(a,b), -Infinity)}`;
    } else if (type === 'date' && dominantDatePattern) {
      detail = `主形式 ${dominantDatePattern}`;
    } else if (type === 'category') {
      detail = `カテゴリ候補 ${distinct}種類`;
    }
    return { type, blanks, distinct, numericMismatches, dateMismatches, outliers, detail };
  }

  function inspectCsv(text, rules = []) {
    validateRules(rules);
    if (typeof text !== 'string' || !text.trim()) throw new Error('CSVが空です。');
    const { rows, delimiter } = parseDelimited(text);
    if (!rows.length) throw new Error('CSVの行を読み取れませんでした。');
    if (rows.length === 1 && rows[0].length === 1) throw new Error('1列しか検出できませんでした。区切り文字やファイル形式を確認してください。');

    const rawHeader = rows[0];
    const width = rawHeader.length;
    const headers = rawHeader.map((value, index) => normalizeText(value) || `列${index + 1}`);
    const dataRows = rows.slice(1);
    const activeRows = dataRows
      .map((row, index) => ({ row, sourceRow: index + 2 }))
      .filter(entry => !isBlankRow(entry.row));
    const emptyRows = dataRows.length - activeRows.length;
    const issues = [];
    let structuralErrors = 0;

    const blankHeaderIndexes = rawHeader.map((value, index) => isBlank(value) ? index : -1).filter(index => index >= 0);
    blankHeaderIndexes.forEach(index => {
      structuralErrors += 1;
      issues.push({ level: 'danger', type: '空の列名', row: 1, column: index + 1, columnName: headers[index], detail: `列${index + 1}のヘッダーが空です。` });
    });

    const headerSeen = new Map();
    headers.forEach((header, index) => {
      const key = header.toLocaleLowerCase('ja');
      if (headerSeen.has(key)) {
        structuralErrors += 1;
        issues.push({ level: 'danger', type: '列名の重複', row: 1, column: index + 1, columnName: header, detail: `「${header}」が複数列にあります。` });
      } else headerSeen.set(key, index);
    });

    activeRows.forEach(entry => {
      if (entry.row.length !== width) {
        structuralErrors += 1;
        issues.push({ level: 'danger', type: '列数不一致', row: entry.sourceRow, detail: `期待 ${width}列 / 実際 ${entry.row.length}列` });
      }
    });

    const paddedRows = activeRows.map(entry => ({
      sourceRow: entry.sourceRow,
      values: Array.from({ length: width }, (_, index) => entry.row[index] ?? '')
    }));
    let blanks = 0;
    let whitespaceCells = 0;
    paddedRows.forEach(entry => entry.values.forEach((value, columnIndex) => {
      if (isBlank(value)) blanks += 1;
      else if (String(value) !== String(value).trim()) {
        whitespaceCells += 1;
        issues.push({ level: 'warn', type: '前後空白', row: entry.sourceRow, column: columnIndex + 1, columnName: headers[columnIndex], detail: `「${String(value).slice(0, 80)}」` });
      }
    }));

    const rowKeys = new Map();
    let duplicateRows = 0;
    paddedRows.forEach(entry => {
      const key = JSON.stringify(entry.values);
      if (rowKeys.has(key)) {
        duplicateRows += 1;
        issues.push({ level: 'danger', type: '重複行', row: entry.sourceRow, detail: `先に出た行: ${rowKeys.get(key)}行目` });
      } else rowKeys.set(key, entry.sourceRow);
    });

    const columnStats = headers.map((header, columnIndex) => {
      const values = paddedRows.map(entry => entry.values[columnIndex]);
      const rule = rules.find(r=>r.header===header) || {type:'auto'};
      const stat = inferColumn(header, values, rule.type);
      stat.numericMismatches.forEach(rowIndex => issues.push({
        level: 'danger', type: '数値列の文字', row: paddedRows[rowIndex].sourceRow, column: columnIndex + 1, columnName: header,
        detail: `「${String(values[rowIndex]).slice(0, 80)}」は数値として読めません。`
      }));
      stat.dateMismatches.forEach(rowIndex => issues.push({
        level: 'danger', type: '日付形式不一致', row: paddedRows[rowIndex].sourceRow, column: columnIndex + 1, columnName: header,
        detail: `「${String(values[rowIndex]).slice(0, 80)}」が主な日付形式と一致しません。`
      }));
      stat.outliers.forEach(rowIndex => issues.push({
        level: 'warn', type: '外れ値候補', row: paddedRows[rowIndex].sourceRow, column: columnIndex + 1, columnName: header,
        detail: `値 ${normalizeText(values[rowIndex])} がIQR基準の範囲外です。`
      }));
      return { header, ...stat };
    });

    const configured = rules.filter(r=>r.type!=='auto'||r.required||r.key||r.min!==null||r.max!==null);
    configured.forEach(rule=>{
      if(!headers.includes(rule.header))issues.push({level:'danger',type:'必須列なし',columnName:rule.header,detail:'検査条件にある列がCSVにありません。'});
    });
    let ruleViolations = 0, keyDuplicates = 0;
    headers.forEach((header,columnIndex)=>{
      const rule=rules.find(r=>r.header===header);
      if(!rule)return;
      paddedRows.forEach(entry=>{
        const value=entry.values[columnIndex];let detail='';
        if(isBlank(value)){if(rule.required)detail='必須の値が空欄です。';}
        else if(rule.min!==null||rule.max!==null){const n=parseNumber(value);if(n===null)detail='数値範囲を確認できない値です。';else if((rule.min!==null&&n<rule.min)||(rule.max!==null&&n>rule.max))detail=`値 ${value} は許容範囲 ${rule.min??'下限なし'} ～ ${rule.max??'上限なし'} の外です。`;}
        if(detail){ruleViolations++;issues.push({level:'danger',type:'列ルール違反',row:entry.sourceRow,column:columnIndex+1,columnName:header,detail});}
      });
    });
    const keys=rules.filter(r=>r.key);
    if(keys.length&&keys.every(r=>headers.filter(h=>h===r.header).length===1)){
      const indexes=keys.map(r=>headers.indexOf(r.header)),seen=new Map();
      paddedRows.forEach(entry=>{
        // IDは文字列のまま完全一致で比較し、先頭ゼロを保持する。
        const values=indexes.map(i=>entry.values[i]);
        if(values.some(isBlank)){ruleViolations++;issues.push({level:'danger',type:'キー空欄',row:entry.sourceRow,detail:'一意キーの列に空欄があります。'});return;}
        const key=JSON.stringify(values);
        if(seen.has(key)){keyDuplicates++;issues.push({level:'danger',type:'キー重複',row:entry.sourceRow,detail:`${keys.map(r=>r.header).join(' ＋ ')} が ${seen.get(key)}行目と重複しています。`});}else seen.set(key,entry.sourceRow);
      });
    }
    const encodingSuspicion = (text.match(/\uFFFD/g) || []).length;
    if (encodingSuspicion) issues.push({ level: 'danger', type: '文字コード注意', detail: `置換文字 � を ${encodingSuspicion}件検出しました。文字化けの可能性があります。` });
    if (emptyRows) issues.push({ level: 'warn', type: '空行', detail: `${emptyRows}行の空行があります。` });

    const numericMismatch = columnStats.reduce((sum, stat) => sum + stat.numericMismatches.length, 0);
    const dateMismatch = columnStats.reduce((sum, stat) => sum + stat.dateMismatches.length, 0);
    const outliers = columnStats.reduce((sum, stat) => sum + stat.outliers.length, 0);
    const dangerCount = issues.filter(issue => issue.level === 'danger').length;
    const warnCount = issues.filter(issue => issue.level === 'warn').length;
    const level = dangerCount ? 'danger' : warnCount || blanks ? 'warn' : 'ok';
    const verdictTitle = level === 'ok' ? '大きな異常は見つかりませんでした' : level === 'danger' ? 'そのまま計算する前に要確認です' : '計算前に軽く確認してください';
    const verdictDetail = level === 'ok'
      ? '構造・重複・型・日付形式・外れ値候補の範囲では、目立つ問題はありません。'
      : `重大候補 ${dangerCount}件、注意候補 ${warnCount}件${blanks ? `、空欄 ${blanks}セル` : ''}を検出しました。`;

    return {
      ruleViolations,
      keyDuplicates,
      delimiter,
      headers,
      dataRows: paddedRows.length,
      columns: width,
      blanks,
      duplicateRows,
      numericMismatch,
      dateMismatch,
      outliers,
      structuralErrors,
      emptyRows,
      whitespaceCells,
      encodingSuspicion,
      columnStats,
      issues,
      level,
      verdictTitle,
      verdictDetail
    };
  }

  function validateRules(rules){
    if(!Array.isArray(rules)||rules.length>1000)throw new Error('検査条件の形式が不正です。');
    const names=new Set();
    for(const r of rules){
      if(!r||typeof r.header!=='string'||!r.header||names.has(r.header)||!['auto','text','number','date'].includes(r.type)||typeof r.required!=='boolean'||typeof r.key!=='boolean'||![r.min,r.max].every(n=>n===null||Number.isFinite(n)))throw new Error('検査条件の形式が不正です。');
      if(r.min!==null&&r.max!==null&&r.min>r.max)throw new Error(`「${r.header}」の下限が上限を超えています。`);
      if((r.min!==null||r.max!==null)&&!['auto','number'].includes(r.type))throw new Error(`「${r.header}」の範囲は数値型または自動で指定してください。`);
      names.add(r.header);
    }
    return rules;
  }
  function decodeCsv(buffer,encoding){
    if(!['utf-8','shift_jis'].includes(encoding))throw new Error('文字コードを選択してください。');
    return new TextDecoder(encoding).decode(buffer);
  }
  const core = { detectDelimiter, parseDelimited, parseNumber, dateInfo, quantile, inferColumn, inspectCsv, validateRules, decodeCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const inputError = $('input-error');
  const results = $('results');
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  const fileMeta = $('file-meta');
  let lastReport = null;
  let sourceText='', sourceFile=null, fileGeneration=0;
  let activeRules=[];
  const PRESET_KEY='csv-inspector:presets:v1';
  let toastTimer = null;

  const toast = message => {
    const node = $('toast');
    clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add('show');
    toastTimer = setTimeout(() => node.classList.remove('show'), 1700);
  };

  const showError = message => {
    inputError.textContent = message;
    inputError.hidden = false;
  };
  const clearError = () => { inputError.hidden = true; inputError.textContent = ''; };
  const delimiterLabel = delimiter => delimiter === '\t' ? 'タブ (TSV)' : delimiter === ';' ? 'セミコロン' : 'カンマ';
  const formatNumber = value => Number(value).toLocaleString('ja-JP');

  function renderIssues(report) {
    const list = $('issue-list');
    list.replaceChildren();
    if (!report.issues.length) {
      const empty = document.createElement('p');
      empty.className = 'issue-empty';
      empty.textContent = '表示する異常候補はありません。';
      list.append(empty);
      return;
    }
    report.issues.slice(0, DISPLAY_ISSUE_LIMIT).forEach(issue => {
      const item = document.createElement('article');
      item.className = `issue issue--${issue.level}`;
      const top = document.createElement('div');
      top.className = 'issue__top';
      const type = document.createElement('span');
      type.className = 'issue__type';
      type.textContent = issue.type;
      const where = document.createElement('span');
      where.className = 'issue__where';
      const parts = [];
      if (issue.row) parts.push(`${issue.row}行目`);
      if (issue.column) parts.push(`${issue.column}列目`);
      if (issue.columnName) parts.push(issue.columnName);
      where.textContent = parts.join(' / ');
      const detail = document.createElement('p');
      detail.className = 'issue__detail';
      detail.textContent = issue.detail || '';
      top.append(type, where);
      item.append(top, detail);
      list.append(item);
    });
    if (report.issues.length > DISPLAY_ISSUE_LIMIT) {
      const more = document.createElement('p');
      more.className = 'muted';
      more.textContent = `表示は先頭${DISPLAY_ISSUE_LIMIT}件までです。残り ${report.issues.length - DISPLAY_ISSUE_LIMIT}件。`;
      list.append(more);
    }
  }

  function renderColumns(report) {
    const body = $('column-body');
    body.replaceChildren();
    report.columnStats.forEach((stat, index) => {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = `${index + 1}. ${stat.header}`;
      const type = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'type-badge';
      badge.textContent = TYPE_LABELS[stat.type] || stat.type;
      type.append(badge);
      const blanks = document.createElement('td');
      blanks.textContent = formatNumber(stat.blanks);
      const distinct = document.createElement('td');
      distinct.textContent = formatNumber(stat.distinct);
      const detail = document.createElement('td');
      detail.textContent = stat.detail;
      tr.append(name, type, blanks, distinct, detail);
      body.append(tr);
    });
  }

  function render(report) {
    lastReport = report;
    const verdict = $('verdict');
    verdict.dataset.level = report.level;
    $('verdict-title').textContent = report.verdictTitle;
    $('verdict-detail').textContent = report.verdictDetail;
    $('metric-rows').textContent = formatNumber(report.dataRows);
    $('metric-columns').textContent = formatNumber(report.columns);
    $('metric-blanks').textContent = formatNumber(report.blanks);
    $('metric-duplicates').textContent = formatNumber(report.duplicateRows);
    $('metric-numeric-mismatch').textContent = formatNumber(report.numericMismatch);
    $('metric-date-mismatch').textContent = formatNumber(report.dateMismatch);
    $('metric-outliers').textContent = formatNumber(report.outliers);
    $('metric-rules').textContent = formatNumber(report.ruleViolations);
    $('metric-keys').textContent = formatNumber(report.keyDuplicates);
    $('metric-structure').textContent = formatNumber(report.structuralErrors);
    $('issues-summary').textContent = `${report.issues.length}件の候補を検出。重大候補を優先して確認してください。`;
    $('meta-delimiter').textContent = delimiterLabel(report.delimiter);
    $('meta-encoding').textContent = report.encodingSuspicion ? `置換文字 ${report.encodingSuspicion}件` : '検出なし';
    $('meta-empty-rows').textContent = formatNumber(report.emptyRows);
    $('meta-whitespace').textContent = formatNumber(report.whitespaceCells);
    renderIssues(report);
    renderColumns(report);
    renderRules(report.headers);
    results.hidden = false;
    requestAnimationFrame(() => verdict.focus({ preventScroll: false }));
  }

  function analyzeText(text) {
    sourceText=text;
    clearError();
    try {
      render(inspectCsv(text, activeRules));
    } catch (error) {
      results.hidden = true;
      lastReport=null;
      showError(error instanceof Error ? error.message : 'CSVの解析に失敗しました。');
    }
  }

  async function analyzeFile(file) {
    clearError();
    if (!file) return;
    const generation=++fileGeneration;sourceFile=file;sourceText='';lastReport=null;results.hidden=true;
    if (file.size > MAX_FILE_BYTES) {
      showError('20 MBを超えるファイルです。ブラウザが重くなるため、分割して確認してください。');
      return;
    }
    try {
      fileMeta.textContent = `${file.name} / ${(file.size / 1024).toLocaleString('ja-JP', { maximumFractionDigits: 1 })} KB`;
      const buffer=await file.arrayBuffer();
      if(generation!==fileGeneration)return;
      analyzeText(decodeCsv(buffer,$('encoding').value));
    } catch {
      if(generation!==fileGeneration)return;
      showError('ファイルを読み込めませんでした。別のCSVで試してください。');
    }
  }

  function renderRules(headers){
    const root=$('rule-list');root.replaceChildren();
    const allHeaders=[...new Set([...headers,...activeRules.map(r=>r.header)])];
    allHeaders.forEach((header,index)=>{
      const rule=activeRules.find(r=>r.header===header)||{header,type:'auto',required:false,key:false,min:null,max:null};
      const card=document.createElement('fieldset');card.className='rule-card';card.dataset.header=header;
      const legend=document.createElement('legend');legend.textContent=header+(headers.includes(header)?'':'（このCSVに列なし）');card.append(legend);
      const field=(label,node,name)=>{const id=`rule-${index}-${name}`;node.id=id;node.dataset.field=name;const lab=document.createElement('label');lab.htmlFor=id;lab.append(document.createTextNode(label),node);card.append(lab);};
      const select=document.createElement('select');[['auto','自動'],['text','文字列（IDなど）'],['number','数値'],['date','日時']].forEach(([v,l])=>select.add(new Option(l,v)));select.value=rule.type;field('列の型',select,'type');
      for(const [name,label] of [['required','必須'],['key','一意キーの一部']]){const input=document.createElement('input');input.type='checkbox';input.checked=rule[name];field(label,input,name);}
      for(const [name,label] of [['min','数値下限'],['max','数値上限']]){const input=document.createElement('input');input.type='number';input.step='any';input.value=rule[name]??'';input.placeholder='指定なし';field(label,input,name);}
      root.append(card);
    });
  }
  function readRules(){
    const rules=[...$('rule-list').children].map(card=>{
      const get=name=>card.querySelector(`[data-field="${name}"]`);
      const number=name=>{const el=get(name);if(!el.validity.valid)throw new Error('範囲には有効な数値を入力してください。');return el.value===''?null:Number(el.value)};
      return {header:card.dataset.header,type:get('type').value,required:get('required').checked,key:get('key').checked,min:number('min'),max:number('max')};
    });
    return validateRules(rules);
  }
  function loadPresets(){
    const raw=localStorage.getItem(PRESET_KEY);if(!raw)return[];
    const items=JSON.parse(raw);if(!Array.isArray(items)||items.length>30)throw new Error('保存された検査条件が不正です。');
    items.forEach(p=>{if(!p||typeof p.name!=='string'||!p.name||p.name.length>60||!['utf-8','shift_jis'].includes(p.encoding))throw new Error('保存された検査条件が不正です。');validateRules(p.rules)});
    return items;
  }
  function refreshPresets(){
    const select=$('preset-select'),old=select.value;select.replaceChildren(new Option('保存条件を選択',''));
    try{loadPresets().forEach(p=>select.add(new Option(p.name,p.name)));select.value=old;}catch{$('preset-status').textContent='保存条件を読み込めません。既存データは上書きしません。';}
  }
  $('apply-rules').addEventListener('click',()=>{try{activeRules=readRules();analyzeText(sourceText);}catch(e){showError(e.message)}});
  $('clear-rules').addEventListener('click',()=>{activeRules=[];if(sourceText)analyzeText(sourceText);else renderRules([]);$('preset-status').textContent='検査条件を解除しました。保存済みの条件は残ります。';});
  $('save-preset').addEventListener('click',()=>{
    try{const name=$('preset-name').value.trim();if(!name)throw new Error('保存名を入力してください。');
      const rules=readRules();if(!rules.length)throw new Error('CSVを読み込んで列の条件を設定してください。');
      const items=loadPresets(),index=items.findIndex(p=>p.name===name);
      if(index>=0&&!confirm(`「${name}」の検査条件を上書きしますか？`))return;
      if(index<0&&items.length>=30)throw new Error('保存は30件までです。不要な条件を削除してください。');
      const item={name,rules,encoding:$('encoding').value};if(index>=0)items[index]=item;else items.push(item);
      localStorage.setItem(PRESET_KEY,JSON.stringify(items));activeRules=rules;refreshPresets();$('preset-select').value=name;$('preset-status').textContent=`「${name}」を保存しました。CSV本体は保存していません。`;if(sourceText)analyzeText(sourceText);
    }catch(e){$('preset-status').textContent=`保存できません：${e.message}`;}
  });
  $('load-preset').addEventListener('click',()=>{
    try{const item=loadPresets().find(p=>p.name===$('preset-select').value);if(!item)throw new Error('保存条件を選択してください。');
      activeRules=item.rules;$('encoding').value=item.encoding;$('preset-name').value=item.name;renderRules(lastReport?.headers||[]);
      $('preset-status').textContent=`「${item.name}」を適用しました。`;
      if(sourceFile)analyzeFile(sourceFile);else if(sourceText)analyzeText(sourceText);
    }catch(e){$('preset-status').textContent=e.message;}
  });
  $('delete-preset').addEventListener('click',()=>{
    try{const name=$('preset-select').value;if(!name)throw new Error('削除する条件を選択してください。');if(!confirm(`「${name}」を削除しますか？`))return;
      localStorage.setItem(PRESET_KEY,JSON.stringify(loadPresets().filter(p=>p.name!==name)));refreshPresets();$('preset-status').textContent='保存条件を削除しました。現在適用中の条件は残ります。';
    }catch(e){$('preset-status').textContent=e.message;}
  });
  $('encoding').addEventListener('change',()=>{if(sourceFile)analyzeFile(sourceFile)});
  refreshPresets();

  fileInput.addEventListener('change', () => analyzeFile(fileInput.files?.[0]));
  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove('is-dragover');
  }));
  dropZone.addEventListener('drop', event => analyzeFile(event.dataTransfer?.files?.[0]));

  $('paste-button').addEventListener('click', () => {sourceFile=null;fileGeneration++;fileMeta.textContent='貼り付けテキスト';analyzeText($('paste-input').value)});
  $('sample-button').addEventListener('click', () => {
    const sample = [
      'date,price,category,note',
      '2026-10-01,120,A,ok',
      '2026-10-02,121,A,ok',
      '2026/10/03,119,B,format',
      '2026-10-04,NG,B,check',
      '2026-10-05,122,A,ok',
      '2026-10-06,123,A,ok',
      '2026-10-06,123,A,ok',
      '2026-10-07,124,A,ok',
      '2026-10-08,9999,A," outlier "',
      '2026-10-09,,A,missing'
    ].join('\n');
    $('paste-input').value = sample;
    sourceFile=null;fileGeneration++;fileMeta.textContent='サンプルCSV';analyzeText(sample);
  });

  $('copy-summary').addEventListener('click', async () => {
    if (!lastReport) return;
    const lines = [
      'CSV Inspector 結果',
      lastReport.verdictTitle,
      `データ行: ${lastReport.dataRows}`,
      `列: ${lastReport.columns}`,
      `空欄: ${lastReport.blanks}`,
      `重複行: ${lastReport.duplicateRows}`,
      `数値列の文字: ${lastReport.numericMismatch}`,
      `日付形式不一致: ${lastReport.dateMismatch}`,
      `外れ値候補: ${lastReport.outliers}`,
      `構造エラー: ${lastReport.structuralErrors}`,
      `列ルール違反: ${lastReport.ruleViolations}`,
      `キー重複: ${lastReport.keyDuplicates}`,
      '',
      '列推定:',
      ...lastReport.columnStats.map(stat => `- ${stat.header}: ${TYPE_LABELS[stat.type] || stat.type} / 空欄${stat.blanks} / 異なる値${stat.distinct}`)
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('結果をコピーしました');
    } catch {
      const area = document.createElement('textarea');
      area.value = lines.join('\n');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      toast(ok ? '結果をコピーしました' : 'コピーできませんでした');
    }
  });
})();

