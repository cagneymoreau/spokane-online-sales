// Unit file viewer: reads the chosen file and lays it out as cards. Everything from the file goes onto the page as text, never as markup.
"use strict";

const report = document.getElementById("report");
const message = document.getElementById("message");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MOST_EVENTS_SHOWN = 1000;

function element(tag, text, className) {
  const made = document.createElement(tag);
  if (text !== undefined) {
    made.textContent = text;
  }
  if (className) {
    made.className = className;
  }
  return made;
}

function card(title) {
  const box = element("div", undefined, "card");
  box.appendChild(element("h2", title));
  report.appendChild(box);
  return box;
}

function table(box, headings) {
  const grid = element("table");
  const head = element("tr");
  headings.forEach((heading) => head.appendChild(element("th", heading)));
  grid.appendChild(head);
  box.appendChild(grid);
  return grid;
}

function row(grid, cells, className) {
  const line = element("tr", undefined, className);
  cells.forEach(([text, cellClass]) => line.appendChild(element("td", text, cellClass)));
  grid.appendChild(line);
}

// A setting's value as a person reads it: clock times, weekday masks, and lists in words.
function shown(key, value) {
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : value.map((item) => (item && item.name ? item.name + (item.timeout ? " (" + item.timeout + ")" : "") : JSON.stringify(item))).join(", ");
  }
  if (/_minutes$/.test(key) && Number.isFinite(value)) {
    return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
  }
  if (/_weekdays$/.test(key) && Number.isFinite(value)) {
    const days = WEEKDAYS.filter((_, day) => value & (1 << day));
    return days.length ? days.join(" ") : "no days";
  }
  if (key === "router_password") {
    return "(never in the file)";
  }
  if (value === "") {
    return "(blank)";
  }
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

function showSummary(file) {
  const box = card(file.about.product || "Unit");
  const facts = element("div", undefined, "facts");
  const metrics = file.metrics || {};
  const add = (label, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    const fact = element("div", undefined, "fact");
    fact.appendChild(element("b", String(value)));
    fact.appendChild(element("span", label));
    facts.appendChild(fact);
  };
  add("firmware", file.about.firmware_version);
  add("up since its last start", Number.isFinite(metrics.uptime_milliseconds) ? sinceStart(metrics.uptime_milliseconds) : undefined);
  add("last restart", metrics.reset_reason);
  add("Wi-Fi signal", metrics.wifi_joined === false ? "not joined" : Number.isFinite(metrics.wifi_signal_dbm) ? metrics.wifi_signal_dbm + " dBm" : undefined);
  add("processor load, worst last minute", Number.isFinite(metrics.worst_load_percent_last_minute) ? metrics.worst_load_percent_last_minute + "%" : undefined);
  add("free memory", Number.isFinite(metrics.heap_free_bytes) ? Math.round(metrics.heap_free_bytes / 1024) + " KB" : undefined);
  box.appendChild(facts);
  if (file.kept) {
    box.appendChild(element("p", file.kept, "muted"));
  }
}

function showSettings(file) {
  if (!file.settings || typeof file.settings !== "object") {
    return;
  }
  const box = card("Settings");
  const grid = table(box, ["Setting", "Value", "What it means"]);
  for (const [key, value] of Object.entries(file.settings)) {
    row(grid, [[key, "key"], [shown(key, value)], [file.catalog[key] || "", "about"]]);
  }
}

function showSeries(file) {
  for (const series of file.series) {
    const box = card(series.name);
    const values = series.samples.map((sample) => sample.value);
    const starts = splitStarts(series.samples).length;
    box.appendChild(element("p", values.length
      ? values.length + " samples, " + Math.min(...values) + " to " + Math.max(...values) + (/hertz/i.test(series.name) ? " Hz" : "") + (starts > 1 ? ", across " + starts + " starts of the unit." : ".") + " Times count from each start, so a restart begins again at 0."
      : "No samples.", "muted"));
    const canvas = element("canvas");
    box.appendChild(canvas);
    drawSeries(canvas, series.samples);
    window.addEventListener("resize", () => drawSeries(canvas, series.samples));
  }
}

function showEvents(file) {
  if (file.events.length === 0) {
    return;
  }
  const box = card("Events");
  box.appendChild(element("p", file.events.length + " events, newest first. Times count from each start of the unit.", "muted"));
  const grid = table(box, ["Since start", "Event"]);
  const starts = splitStarts(file.events);
  let shownCount = 0;
  for (let run = starts.length - 1; run >= 0 && shownCount < MOST_EVENTS_SHOWN; --run) {
    for (let at = starts[run].length - 1; at >= 0 && shownCount < MOST_EVENTS_SHOWN; --at, ++shownCount) {
      row(grid, [[sinceStart(starts[run][at].t)], [starts[run][at].text]]);
    }
    if (run > 0) {
      row(grid, [["restart"], ["the unit started again here"]], "restart");
    }
  }
}

function showMetrics(file) {
  if (!file.metrics) {
    return;
  }
  const box = card("Firmware metrics");
  const grid = table(box, ["Name", "Value"]);
  for (const [key, value] of Object.entries(file.metrics)) {
    row(grid, [[key, "key"], [typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)]]);
  }
}

function showOther(file) {
  for (const section of file.other) {
    card(section.name).appendChild(element("pre", section.body));
  }
}

function show(text, name) {
  report.textContent = "";
  const file = parseUnitFile(text);
  message.className = file.problems.length ? "error" : "muted";
  message.textContent = file.problems.length ? name + ": " + file.problems.join(" ") : name;
  showSummary(file);
  showSettings(file);
  showSeries(file);
  showEvents(file);
  showMetrics(file);
  showOther(file);
}

function open(chosen) {
  if (!chosen) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => show(String(reader.result), chosen.name);
  reader.onerror = () => {
    message.className = "error";
    message.textContent = "That file could not be read.";
  };
  reader.readAsText(chosen);
}

document.getElementById("file").addEventListener("change", (event) => open(event.target.files[0]));
const drop = document.getElementById("drop");
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("over");
  open(event.dataTransfer.files[0]);
});
