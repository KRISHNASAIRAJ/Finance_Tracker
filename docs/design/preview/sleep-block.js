'use strict';
/*
 * Shared renderer for the Meridian sleep block.
 * Mirrors SleepBlockRenderer.kt (mobile/android/app/src/main/java/com/krishnasairaj/meridian/widgets/)
 * and docs/design/GEOMETRY.md. Used by preview.html (block only) and widget.html (full card).
 *
 * All sizes come from geometry.json — the same object both pages poll.
 * Draw origin = top-left corner of the block (canvas.w x canvas.h units).
 */
window.SleepBlock = (function () {
  function fmt(n) { return Math.round(n * 100) / 100; }

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function setLS(c, em, size) {
    try { c.letterSpacing = fmt((em || 0) * (size || 0)) + 'px'; } catch (_) {}
  }

  function render(c, g, opts) {
    opts = opts || {};
    const W = g.canvas.w, H = g.canvas.h;
    c.clearRect(0, 0, W, H);

    // 1. silhouette (same path as SleepBlockRenderer.kt)
    const s = g.silhouette;
    c.fillStyle = g.colors.red;
    c.beginPath();
    c.moveTo(0, s.moveTo);
    c.quadraticCurveTo(s.tlQuad[0], s.tlQuad[1], s.tlQuad[2], s.tlQuad[3]);
    c.lineTo(s.approachX, s.bodyTopY);
    c.quadraticCurveTo(s.filletQuad[0], s.filletQuad[1], s.filletQuad[2], s.filletQuad[3]);
    c.quadraticCurveTo(s.tabRootQuad[0], s.tabRootQuad[1], s.tabRootQuad[2], s.tabRootQuad[3]);
    c.lineTo(s.tabRightLineEndX, 0);
    c.quadraticCurveTo(s.rightQuad[0], s.rightQuad[1], s.rightQuad[2], s.rightQuad[3]);
    c.lineTo(s.rightQuad[2], s.rightBottomLineEndY);
    c.quadraticCurveTo(s.bottomRightQuad[0], s.bottomRightQuad[1], s.bottomRightQuad[2], s.bottomRightQuad[3]);
    c.lineTo(s.bottomLeftLineEndX, H);
    c.quadraticCurveTo(s.bottomLeftQuad[0], s.bottomLeftQuad[1], s.bottomLeftQuad[2], s.bottomLeftQuad[3]);
    c.closePath();
    c.fill();

    // 2. texts
    const t = g.texts;
    c.textBaseline = 'alphabetic';
    const tOne = (txt, cfg) => {
      c.fillStyle = cfg.color;
      c.font = cfg.weight + ' ' + cfg.size + 'px "Segoe UI", Roboto, sans-serif';
      setLS(c, cfg.spacing, cfg.size);
      c.fillText(txt, cfg.x, cfg.baseline);
      setLS(c, 0, 0);
    };
    tOne('SLEEP', t.sleep);
    tOne(g.sampleNight.duration, t.duration);
    tOne('Score ' + g.sampleNight.score, t.score);

    // score track: dim track + fill = score percent
    const st = t.scoreTrack;
    c.fillStyle = 'rgba(0,0,0,' + st.trackAlpha + ')';
    rr(c, st.x0, st.y, st.x1 - st.x0, st.h, st.radius); c.fill();
    c.fillStyle = t.duration.color;
    const fillW = (st.x1 - st.x0) * Math.max(0, Math.min(100, g.sampleNight.score)) / 100;
    if (fillW > 0) { rr(c, st.x0, st.y, fillW, st.h, st.radius); c.fill(); }

    // 3. lane labels
    c.fillStyle = t.labels.color;
    c.font = t.labels.weight + ' ' + t.labels.size + 'px "Segoe UI", Roboto, sans-serif';
    setLS(c, t.labels.spacing, t.labels.size);
    ['DEEP', 'LIGHT', 'AWAKE'].forEach((name, i) => c.fillText(name, t.labels.x, t.labels.baselines[i]));
    setLS(c, 0, 0);

    const L = g.lanes;

    // 4. tracks (always visible)
    c.fillStyle = 'rgba(0,0,0,' + L.trackAlpha + ')';
    L.rowTops.forEach(y => { rr(c, L.trackX, y, L.trackWidth, L.barHeight, L.radius); c.fill(); });

    // 5. dotted awake line
    c.strokeStyle = 'rgba(0,0,0,' + L.dotColorAlpha + ')';
    c.lineWidth = L.dotStroke;
    c.lineCap = 'round';
    c.setLineDash([0.1, L.dotPeriod]);
    c.beginPath(); c.moveTo(L.dotX0, L.dotY); c.lineTo(L.dotX1, L.dotY); c.stroke();
    c.setLineDash([]);

    // 6. bars
    const drawBars = (i, segs, color) => {
      c.fillStyle = color;
      for (const seg of segs) {
        const a = Math.max(0, Math.min(100, seg[0]));
        const b = Math.max(0, Math.min(100, seg[1]));
        if (b <= a) continue;
        const x0 = L.trackX + a / 100 * L.trackWidth;
        const x1 = Math.min(L.trackX + L.trackWidth, Math.max(x0 + L.minBar, L.trackX + b / 100 * L.trackWidth));
        rr(c, x0, L.rowTops[i], x1 - x0, L.barHeight, L.radius); c.fill();
      }
    };
    drawBars(0, g.sampleNight.deep, g.colors.deep);
    drawBars(1, g.sampleNight.light, g.colors.light);
    drawBars(2, g.sampleNight.awake, g.colors.awake);

    // 7. bed / wake times
    c.fillStyle = t.times.color;
    c.font = '400 ' + t.times.size + 'px "Segoe UI", Roboto, sans-serif';
    c.textAlign = 'left';
    c.fillText(g.sampleNight.bed, t.times.bedX, t.times.baseline);
    c.textAlign = 'right';
    c.fillText(g.sampleNight.wake, t.times.wakeRightX, t.times.baseline);
    c.textAlign = 'left';

    // 8. optional guides
    if (opts.guides) {
      c.strokeStyle = 'rgba(0, 255, 255, 0.55)';
      c.fillStyle = 'rgba(0, 255, 255, 0.9)';
      c.lineWidth = 0.4;
      c.setLineDash([3, 3]);
      c.font = '400 4px "Segoe UI", Roboto, sans-serif';
      const yGuides = [0, s.bodyTopY, L.rowTops[0], L.rowTops[1], L.rowTops[2],
                       L.dotY, t.labels.baselines[0], t.labels.baselines[1], t.labels.baselines[2],
                       t.times.baseline, H];
      for (const y of yGuides) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); c.fillText('y=' + y, 1, y - 0.8); }
      const xGuides = [0, s.approachX, s.filletQuad[0], s.tabRootQuad[2],
                       L.trackX, st.x0, st.x1, L.trackX + L.trackWidth, W];
      for (const x of xGuides) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); c.fillText('x=' + x, x + 0.8, 6); }
      c.setLineDash([]);
    }
  }

  return { render, rr };
})();
