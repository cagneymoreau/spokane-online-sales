// Unit file viewer: one series' chart a person can zoom, pan, and read: wheel or pinch zooms time, dragging pans, a point under the cursor reads out.
"use strict";

const MOST_ZOOM_MILLISECONDS = 20;

class SeriesView {
  constructor(box, samples, unit) {
    this.layout = layOut(samples);
    this.unit = unit;
    this.yMode = "fit";
    this.manual = [0, 1];
    this.cursor = null;
    this.pointers = new Map();
    this.buildControls(box);
    this.canvas = element("canvas");
    this.canvas.style.touchAction = "none";
    box.appendChild(this.canvas);
    this.caption = element("p", "", "muted");
    box.appendChild(this.caption);
    this.reset();
    this.listen();
  }

  buildControls(box) {
    const bar = element("div", undefined, "controls");
    const button = (text, action) => {
      const made = element("button", text);
      made.type = "button";
      made.addEventListener("click", action);
      bar.appendChild(made);
    };
    button("Zoom in", () => this.zoomAt(0.5, (this.x0 + this.x1) / 2));
    button("Zoom out", () => this.zoomAt(2, (this.x0 + this.x1) / 2));
    button("Whole file", () => this.reset());
    const scale = element("select");
    [["fit", "Value scale: fit what is shown"], ["file", "Value scale: whole file"], ["manual", "Value scale: set by hand"]].forEach(([value, text]) => {
      const option = element("option", text);
      option.value = value;
      scale.appendChild(option);
    });
    scale.addEventListener("change", () => {
      this.yMode = scale.value;
      this.low.hidden = this.high.hidden = scale.value !== "manual";
      if (scale.value === "manual") {
        [this.low.value, this.high.value] = this.range().map((value) => Math.round(value));
        this.manual = [Number(this.low.value), Number(this.high.value)];
      }
      this.render();
    });
    bar.appendChild(scale);
    this.low = element("input");
    this.high = element("input");
    [this.low, this.high].forEach((input, index) => {
      input.type = "number";
      input.hidden = true;
      input.title = index === 0 ? "lowest value shown" : "highest value shown";
      input.addEventListener("change", () => {
        this.manual = [Number(this.low.value), Number(this.high.value)];
        this.render();
      });
      bar.appendChild(input);
    });
    box.appendChild(bar);
  }

  reset() {
    this.x0 = 0;
    this.x1 = this.layout.end;
    this.render();
  }

  // Zooms time by factor around line position at, never past the file's ends or closer than MOST_ZOOM_MILLISECONDS.
  zoomAt(factor, at) {
    const span = Math.min(Math.max((this.x1 - this.x0) * factor, MOST_ZOOM_MILLISECONDS), this.layout.end);
    const share = (at - this.x0) / (this.x1 - this.x0);
    this.x0 = at - share * span;
    this.x1 = this.x0 + span;
    this.clampView();
    this.render();
  }

  clampView() {
    const span = this.x1 - this.x0;
    this.x0 = Math.min(Math.max(this.x0, 0), this.layout.end - span);
    this.x1 = this.x0 + span;
  }

  // The values in view: what is drawn between x0 and x1, and the value held into the view from just before it.
  shownValues() {
    const points = this.layout.points;
    const values = [];
    for (let index = 0; index < points.length; ++index) {
      const inside = points[index].x >= this.x0 && points[index].x <= this.x1;
      const heldIn = index + 1 < points.length && points[index].x < this.x0 && points[index + 1].x >= this.x0 && points[index + 1].start === points[index].start;
      if (inside || heldIn) {
        values.push(points[index].value);
      }
    }
    return values;
  }

  // Fit and whole file both span every value they cover, the highest and lowest included; by hand is what the person typed.
  range() {
    if (this.yMode === "manual" && this.manual[1] > this.manual[0]) {
      return this.manual;
    }
    const values = this.yMode === "file" ? this.layout.points.map((point) => point.value) : this.shownValues();
    if (values.length === 0) {
      return [0, 1];
    }
    const low = Math.min(...values);
    const high = Math.max(...values);
    const margin = Math.max((high - low) * 0.08, 1);
    return [low - margin, high + margin];
  }

  render() {
    const y = this.range();
    this.area = drawView(this.canvas, this.layout, this.x0, this.x1, y, this.cursor);
    const shown = this.shownValues();
    const outside = this.yMode === "manual" ? shown.filter((value) => value < y[0] || value > y[1]).length : 0;
    const reading = this.cursor ? "Start " + this.cursor.start + ", " + sinceStart(this.cursor.t, true) + " since start: " + this.cursor.value + this.unit + ". " : "";
    this.caption.textContent = reading + shown.length + " values in view" + (outside ? ", " + outside + " of them outside the range set by hand." : ".") +
      " Wheel or pinch to zoom, drag to move, double-click for the whole file.";
  }

  // The line position under a pixel, and the nearest drawn point to it.
  positionAt(pixel) {
    return this.x0 + ((pixel - this.area.left) / (this.area.right - this.area.left)) * (this.x1 - this.x0);
  }

  nearest(x) {
    const points = this.layout.points;
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (points[middle].x < x) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    const before = points[Math.max(low - 1, 0)];
    return points.length === 0 ? null : Math.abs(before.x - x) < Math.abs(points[low].x - x) ? before : points[low];
  }

  listen() {
    const pixel = (event) => event.clientX - this.canvas.getBoundingClientRect().left;
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoomAt(event.deltaY > 0 ? 1.25 : 0.8, this.positionAt(pixel(event)));
    }, {passive: false});
    this.canvas.addEventListener("dblclick", () => this.reset());
    this.canvas.addEventListener("pointerdown", (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, pixel(event));
    });
    this.canvas.addEventListener("pointermove", (event) => {
      const now = pixel(event);
      if (this.pointers.size === 2 && this.pointers.has(event.pointerId)) {
        // Pinch: the gap between the two fingers scales time around their middle.
        const [first, second] = [...this.pointers.entries()];
        const other = first[0] === event.pointerId ? second[1] : first[1];
        const before = Math.abs(this.pointers.get(event.pointerId) - other);
        const after = Math.abs(now - other);
        if (before > 4 && after > 4) {
          this.zoomAt(before / after, this.positionAt((now + other) / 2));
        }
      } else if (this.pointers.size === 1 && this.pointers.has(event.pointerId)) {
        const moved = this.positionAt(this.pointers.get(event.pointerId)) - this.positionAt(now);
        this.x0 += moved;
        this.x1 += moved;
        this.clampView();
      }
      if (this.pointers.has(event.pointerId)) {
        this.pointers.set(event.pointerId, now);
      }
      this.cursor = this.nearest(this.positionAt(now));
      this.render();
    });
    const lift = (event) => this.pointers.delete(event.pointerId);
    this.canvas.addEventListener("pointerup", lift);
    this.canvas.addEventListener("pointercancel", lift);
    this.canvas.addEventListener("pointerleave", () => {
      this.cursor = null;
      this.render();
    });
    window.addEventListener("resize", () => this.render());
  }
}
