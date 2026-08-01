Attached Element Context from DaVinchi Element Picker

Element: section#tab-chart

URL: http://localhost:8090/

HTML Path: section#tab-chart

Outer HTML:
```html
<section id="tab-chart" class="panel active">
      <div class="chart-toolbar">
        <span class="tb-group" title="Инструменты рисования">
          <button class="tb" data-draw="segment" title="Отрезок">╱</button>
          <button class="tb" data-draw="straightLine" title="Прямая">─</button>
          <button class="tb" data-draw="rayLine" title="Луч">➶</button>
          <button class="tb" data-draw="horizontalStraightLine" title="Горизонталь">═</button>
          <button class="tb" data-draw="verticalStraightLine" title="Вертикаль">║</button>
          <button class="tb" data-draw="priceLine" title="Цена">₮</button>
          <button class="tb" data-draw="priceChannelLine" title="Канал">≡</button>
          <button class="tb" data-draw="parallelStraightLine" title="Параллельные">∥</button>
          <button class="tb" data-draw="fibonacciLine" title="Фибоначчи">𝔉</button>
          <button class="tb" data-draw="simpleAnnotation" title="Аннотация">✎</button>
          <button class="tb warn" id="clearDraw" title="Удалить рисунки">🗑</button>
        </span>
        <span class="tb-group">
          <select id="candleType" title="Тип графика">
            <option value="candle_solid">Свечи</option>
            <option value="candle_stroke">Контур</option>
            <option value="ohlc">OHLC</option>
            <option value="area">Линия/область</option>
          </select>
          <label class="check"><input id="showMarkers" type="checkbox" checked=""> Сделки</label>
          <label class="check"><input id="showZ" type="checkbox" checked=""> Z-Score</label>
          <label class="check" title="Ценовые полосы порогов Z на свечах (настройки вкладки Бэктест): Z LONG/SHORT сплошные, TP BUY/SELL пунктиром. Уровень Z=thr в ценах = MA + thr·σ.">
            <input id="showBands" type="checkbox" checked=""> Уровни</label>
          <label class="check" title="Live на сервере: Binance WS + дозапись свечей; дашборд только рисует тики с /api/live/ws"><input id="liveToggle" type="checkbox"> Live</label>
          <span id="liveDot" class="livedot on" title="live ATOMUSDT/VANRYUSDT 5m · c=302.785924 · 13:49:06">●</span>
          <button class="tb" id="shotBtn" title="Скриншот PNG">📷</button>
        </span>
        <span class="tb-note" id="chartInfo">ATOMUSDT/VANRYUSDT 5m · TV-окно 10911 · engine Z×10682 · period 230 · L-3/S3</span>
      </div>
      <div id="mainChart" class="chart-big" k-line-chart-id="k_line_chart_1"><div tabindex="1" style="position: relative; width: 100%; outline: none; border-style: none; cursor: crosshair; box-sizing: border-box; user-select: none; -webkit-tap-highlight-color: transparent;"><div style="width: 100%; margin: 0px; padding: 0px; position: relative; overflow: hidden; box-sizing: border-box; height: 841px;"><div style="margin: 0px; padding: 0px; position: absolute; top: 0px; overflow: hidden; box-sizing: border-box; z-index: 1; cursor: crosshair; left: 0px; width: 1635px; height: 841px;"><canvas width="1635" height="841" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 1635px; height: 841px;"></canvas><canvas width="1635" height="841" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 1635px; height: 841px;"></canvas></div><div style="margin: 0px; padding: 0px; position: absolute; top: 0px; overflow: hidden; box-sizing: border-box; z-index: 1; cursor: ns-resize; left: 1635px; width: 45px; height: 841px;"><canvas width="45" height="841" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 45px; height: 841px;"></canvas><canvas width="45" height="841" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 45px; height: 841px;"></canvas></div></div><div style="width: 1680px; margin: 0px; padding: 0px; position: relative; box-sizing: border-box; height: 1px; background-color: rgb(35, 44, 64);"><div style="width: 100%; height: 7px; margin: 0px; padding: 0px; position: absolute; top: -3px; z-index: 20; box-sizing: border-box; cursor: ns-resize;"></div></div><div style="width: 100%; margin: 0px; padding: 0px; position: relative; overflow: hidden; box-sizing: border-box; height: 200px;"><div style="margin: 0px; padding: 0px; position: absolute; top: 0px; overflow: hidden; box-sizing: border-box; z-index: 1; cursor: crosshair; left: 0px; width: 1635px; height: 200px;"><canvas width="1635" height="200" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 1635px; height: 200px;"></canvas><canvas width="1635" height="200" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 1635px; height: 200px;"></canvas></div><div style="margin: 0px; padding: 0px; position: absolute; top: 0px; overflow: hidden; box-sizing: border-box; z-index: 1; cursor: ns-resize; left: 1635px; width: 45px; height: 200px;"><canvas width="45" height="200" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 45px; height: 200px;"></canvas><canvas width="45" height="200" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 45px; height: 200px;"></canvas></div></div><div style="width: 100%; margin: 0px; padding: 0px; position: relative; overflow: hidden; box-sizing: border-box; height: 24px;"><div style="margin: 0px; padding: 0px; position: absolute; top: 0px; overflow: hidden; box-sizing: border-box; z-index: 1; cursor: ew-resize; left: 0px; width: 1635px; height: 24px;"><canvas width="1635" height="24" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 1635px; height: 24px;"></canvas><canvas width="1635" height="24" style="position: absolute; top: 0px; left: 0px; z-index: 2; box-sizing: border-box; width: 1635px; height: 24px;"></canvas></div></div></div></div>
    </section>
```

Dimensions:
- top: 146px
- left: 18px
- width: 1682px
- height: 1105px
- devicePixelRatio: 1

CSS:
```css
/* === Matched rules (element) === */

/* styles.css */
* { box-sizing: border-box; }

/* styles.css */
.panel { display: none; }

/* styles.css */
.panel.active { display: block; }

/* === Matched rules (direct children) === */

/* --- child: div.chart-toolbar --- */
/* styles.css */
* { box-sizing: border-box; }

/* styles.css */
.chart-toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; flex-wrap: wrap; }

/* --- child: div#mainChart --- */
/* styles.css */
.chart-big { height: calc(-245px + 100vh); min-height: 520px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }

/* Inherited */
