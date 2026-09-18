document.getElementById("advanced-sections").insertAdjacentHTML("beforeend", `
  <section class="panel feature-panel" aria-labelledby="risk-title"><h2 id="risk-title">② 暴落シミュレーション</h2>
    <p class="description">指定年の開始時に一度だけ下落。回復期間は、下落前の想定市場価格の推移に戻るまでの追加リターンを仮定します。積立停止時は通常ケースと拠出元本が異なります。</p>
    <div class="advanced-grid">
      <div class="field"><div class="field-head"><label for="crash-year">暴落する年</label><div class="number-wrap"><input id="crash-year" type="number" min="1" max="50" step="1" value="5" inputmode="numeric"><span class="unit">年目</span></div></div><input id="crash-year-range" type="range" min="1" max="50" step="1" value="5" aria-label="暴落する年"><div class="bounds"><span>1年目</span><span id="crash-year-max">50年目</span></div></div>
      <div class="field"><div class="field-head"><label for="crash-loss">一度の下落率</label><div class="number-wrap"><input id="crash-loss" type="number" min="0" max="70" step="5" value="30" inputmode="decimal"><span class="unit">%</span></div></div><input id="crash-loss-range" type="range" min="0" max="70" step="5" value="30" aria-label="下落率"><div class="bounds"><span>0%</span><span>70%</span></div></div>
      <div class="field"><div class="field-head"><label for="crash-recovery">市場価格の回復期間</label><div class="number-wrap"><input id="crash-recovery" type="number" min="0" max="20" step="1" value="3" inputmode="numeric"><span class="unit">年</span></div></div><input id="crash-recovery-range" type="range" min="0" max="20" step="1" value="3" aria-label="回復期間。0は回復なし"><div class="bounds"><span>0＝回復なし</span><span>20年</span></div></div>
      <div class="field"><div class="field-head"><label for="crash-contribution">暴落後の毎月積立</label></div><select id="crash-contribution"><option value="continue">継続する</option><option value="stop">暴落した月から停止する</option></select></div>
    </div>
    <div class="feature-results" aria-live="polite"><div class="metric primary"><span class="metric-label">暴落ケースの最終資産</span><strong id="crash-final">—</strong></div><div class="metric"><span class="metric-label">通常ケースとの差</span><strong id="crash-delta">—</strong></div><div class="metric"><span class="metric-label">暴落ケースの拠出元本</span><strong id="crash-principal">—</strong></div></div>
    <p class="inline-note" id="crash-explain">—</p>
    <figure class="figure"><svg id="crash-chart" role="img" aria-label="通常ケースと暴落ケースの毎月の資産推移" viewBox="0 0 660 240" preserveAspectRatio="xMidYMid meet"></svg><div class="chart-caption"><span class="muted">通常（一定利回り）</span><span class="risk">暴落ケース</span></div><figcaption>万円。暴落時点の急落を表示。回復は仮定であり、将来の値動きを予測するものではありません。</figcaption></figure>
    <details class="details"><summary>暴落ケースの年次表</summary><div class="table-wrap"><table><thead><tr><th>経過</th><th>通常資産</th><th>暴落資産</th><th>暴落ケースの元本</th></tr></thead><tbody id="crash-rows"></tbody></table></div></details>
  </section>
  <section class="panel feature-panel" aria-labelledby="goal-title"><h2 id="goal-title">③ 目標金額から逆算</h2>
    <p class="description">基本条件の初期資金・年利・運用期間を共通で利用。目標資産額に必要な毎月末積立額と、現在の積立額で目標に到達する時期を計算します。</p>
    <div class="advanced-grid"><div class="field"><div class="field-head"><label for="goal-amount">目標資産額</label><div class="number-wrap"><input id="goal-amount" type="number" min="100" max="100000" step="100" value="10000" inputmode="numeric"><span class="unit">万円</span></div></div><input id="goal-amount-range" type="range" min="100" max="100000" step="100" value="10000" aria-label="目標資産額"><div class="bounds"><span>100万円</span><span>10億円</span></div></div></div>
    <div class="feature-results" aria-live="polite"><div class="metric primary"><span class="metric-label">期間内の達成に必要な月額</span><strong id="goal-required">—</strong></div><div class="metric"><span class="metric-label">現在設定の月額での到達時期</span><strong id="goal-years">—</strong></div><div class="metric"><span class="metric-label">現在の積立設定との差</span><strong id="goal-gap">—</strong></div></div><p class="inline-note" id="goal-explain">—</p>
  </section>
`);
