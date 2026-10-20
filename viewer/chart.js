// Unit file viewer: draws one history series as a line, each start of the unit its own stretch with a restart mark between them.
"use strict";

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Time since the unit started, as h:mm:ss.
function sinceStart(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

function drawSeries(canvas, samples) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  ctx.font = "11px system-ui, sans-serif";
  if (samples.length === 0) {
    ctx.fillStyle = cssColor("--muted");
    ctx.fillText("No samples in this file.", 8, 20);
    return;
  }
  const starts = splitStarts(samples);
  // Each start gets room for its own span; restarts get a small gap so the break shows.
  const spans = starts.map((run) => Math.max(run[run.length - 1].t - run[0].t, 1));
  const total = spans.reduce((sum, span) => sum + span, 0);
  const gap = starts.length > 1 ? total * 0.02 : 0;
  // The axis spans every value in the file, the highest and lowest included.
  const values = samples.map((row) => row.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = Math.max((high - low) * 0.1, Math.abs(high) * 0.0005, 1);
  const padLeft = 64, padRight = 10, padTop = 10, padBottom = 24;
  const plotWidth = width - padLeft - padRight;
  const scale = plotWidth / (total + gap * (starts.length - 1));
  const bottom = low - margin, top = high + margin;
  const yOf = (value) => padTop + (1 - (value - bottom) / (top - bottom)) * (height - padTop - padBottom);
  let lastLabelEnd = -Infinity;
  ctx.strokeStyle = cssColor("--line");
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, height - padBottom);
  ctx.lineTo(width - padRight, height - padBottom);
  ctx.stroke();
  let offset = padLeft;
  starts.forEach((run, index) => {
    const xOf = (t) => offset + (t - run[0].t) * scale;
    // A history keeps a value until it moves, so the line holds each value until the next.
    ctx.strokeStyle = cssColor("--accent");
    ctx.beginPath();
    run.forEach((row, at) => {
      if (at === 0) {
        ctx.moveTo(xOf(row.t), yOf(row.value));
      } else {
        ctx.lineTo(xOf(row.t), yOf(run[at - 1].value));
        ctx.lineTo(xOf(row.t), yOf(row.value));
      }
    });
    ctx.stroke();
    // A start's time under it, unless the last label is still in the way.
    const label = sinceStart(run[0].t);
    if (offset > lastLabelEnd + 6) {
      ctx.fillStyle = cssColor("--muted");
      ctx.fillText(label, offset, height - 8);
      lastLabelEnd = offset + ctx.measureText(label).width;
    }
    offset += spans[index] * scale;
    if (index + 1 < starts.length) {
      const mark = offset + (gap * scale) / 2;
      ctx.strokeStyle = cssColor("--warn");
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mark, padTop);
      ctx.lineTo(mark, height - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cssColor("--warn");
      ctx.fillText("restart", mark + 3, padTop + 10);
      offset += gap * scale;
    }
  });
  ctx.fillStyle = cssColor("--muted");
  ctx.textAlign = "right";
  ctx.fillText(String(Math.round(top)), padLeft - 6, padTop + 10);
  ctx.fillText(String(Math.round(bottom)), padLeft - 6, height - padBottom);
  ctx.textAlign = "left";
}
