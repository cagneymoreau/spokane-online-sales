// Unit file viewer: lays one history series out on a single line of time, each start of the unit its own stretch, and draws a view of it.
"use strict";

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Time since the unit started, as h:mm:ss, with tenths when the view is close enough to need them.
function sinceStart(milliseconds, tenths) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const text = hours + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  return tenths ? text + "." + Math.floor((milliseconds % 1000) / 100) : text;
}

// Each start's samples placed one after another on one line: x is that line's position, so starts never overlap. A small gap marks a restart.
function layOut(samples) {
  const starts = splitStarts(samples);
  const spans = starts.map((run) => Math.max(run[run.length - 1].t - run[0].t, 1));
  const total = spans.reduce((sum, span) => sum + span, 0);
  const gap = starts.length > 1 ? total * 0.02 : 0;
  const points = [];
  const restarts = [];
  const segments = [];
  let offset = 0;
  starts.forEach((run, index) => {
    segments.push({from: offset, to: offset + spans[index], first: run[0].t, start: index + 1});
    run.forEach((row) => points.push({x: offset + (row.t - run[0].t), t: row.t, value: row.value, start: index + 1}));
    offset += spans[index];
    if (index + 1 < starts.length) {
      restarts.push(offset + gap / 2);
      offset += gap;
    }
  });
  return {points, restarts, segments, end: Math.max(offset, 1)};
}

// A tick spacing in milliseconds of about one label per 110 pixels, on a round step.
function tickStep(milliseconds, pixels) {
  const wanted = (milliseconds * 110) / Math.max(pixels, 1);
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000, 3600000, 7200000, 21600000, 43200000, 86400000];
  return steps.find((step) => step >= wanted) || steps[steps.length - 1];
}

// Draws the view [x0, x1] of the layout with values y = [low, high], and the cursor's point when there is one. Returns the plot's area.
function drawView(canvas, layout, x0, x1, y, cursor) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  ctx.font = "11px system-ui, sans-serif";
  const area = {left: 64, right: width - 10, top: 10, bottom: height - 24};
  const xOf = (x) => area.left + ((x - x0) / (x1 - x0)) * (area.right - area.left);
  const yOf = (value) => area.top + (1 - (value - y[0]) / (y[1] - y[0])) * (area.bottom - area.top);
  // Grid: five value lines, and time ticks inside each start's stretch.
  ctx.strokeStyle = cssColor("--line");
  ctx.fillStyle = cssColor("--muted");
  ctx.textAlign = "right";
  for (let line = 0; line <= 4; ++line) {
    const value = y[0] + ((y[1] - y[0]) * line) / 4;
    ctx.beginPath();
    ctx.moveTo(area.left, yOf(value));
    ctx.lineTo(area.right, yOf(value));
    ctx.stroke();
    ctx.fillText(Math.abs(y[1] - y[0]) < 20 ? value.toFixed(1) : String(Math.round(value)), area.left - 6, yOf(value) + 4);
  }
  ctx.textAlign = "center";
  const step = tickStep(x1 - x0, area.right - area.left);
  for (const segment of layout.segments) {
    for (let t = Math.ceil(segment.first / step) * step; segment.from + (t - segment.first) <= Math.min(segment.to, x1); t += step) {
      const x = segment.from + (t - segment.first);
      if (x < x0) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(xOf(x), area.top);
      ctx.lineTo(xOf(x), area.bottom);
      ctx.stroke();
      ctx.fillText(sinceStart(t, step < 1000), xOf(x), height - 8);
    }
  }
  // The line holds each value until the next, as the history keeps a value until it moves. Drawn inside the plot's frame.
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
  ctx.clip();
  ctx.strokeStyle = cssColor("--accent");
  ctx.beginPath();
  let previous = null;
  for (const point of layout.points) {
    if (previous && previous.start === point.start && point.x >= x0 && previous.x <= x1) {
      ctx.moveTo(xOf(previous.x), yOf(previous.value));
      ctx.lineTo(xOf(point.x), yOf(previous.value));
      ctx.lineTo(xOf(point.x), yOf(point.value));
    }
    previous = point;
  }
  ctx.stroke();
  ctx.strokeStyle = cssColor("--warn");
  ctx.fillStyle = cssColor("--warn");
  ctx.setLineDash([4, 4]);
  ctx.textAlign = "left";
  for (const restart of layout.restarts.filter((x) => x >= x0 && x <= x1)) {
    ctx.beginPath();
    ctx.moveTo(xOf(restart), area.top);
    ctx.lineTo(xOf(restart), area.bottom);
    ctx.stroke();
    ctx.fillText("restart", xOf(restart) + 3, area.top + 10);
  }
  ctx.setLineDash([]);
  if (cursor) {
    ctx.strokeStyle = cssColor("--muted");
    ctx.beginPath();
    ctx.moveTo(xOf(cursor.x), area.top);
    ctx.lineTo(xOf(cursor.x), area.bottom);
    ctx.stroke();
    ctx.fillStyle = cssColor("--accent");
    ctx.beginPath();
    ctx.arc(xOf(cursor.x), yOf(cursor.value), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = cssColor("--line");
  ctx.strokeRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
  return area;
}
