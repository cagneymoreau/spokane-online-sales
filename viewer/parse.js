// Unit file viewer: splits a downloaded settings file into its sections and reads each one. It touches nothing on the page.
"use strict";

// A file from any firmware: sections it knows are read, the rest are kept as text, and anything it cannot read is named in problems.
function parseUnitFile(text) {
  const file = {about: {}, catalog: {}, catalogNotes: [], settings: null, metrics: null, series: [], events: [], kept: "", other: [], problems: []};
  const sections = [];
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const heading = /^=== (.+) ===\s*$/.exec(line);
    if (heading) {
      current = {name: heading[1].trim(), lines: []};
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (sections.length === 0) {
    file.problems.push("This does not look like a unit file: it has no === SECTION === headings.");
    return file;
  }
  for (const section of sections) {
    const body = section.lines.join("\n").trim();
    if (section.name === "ABOUT") {
      readAbout(body, file);
    } else if (section.name === "SETTINGS CATALOG") {
      readCatalog(section.lines, file);
    } else if (section.name === "SETTINGS CURRENT") {
      file.settings = readJson(body, "SETTINGS CURRENT", file);
    } else if (section.name === "FIRMWARE METRICS" || section.name === "STATUS") {
      file.metrics = Object.assign(file.metrics || {}, readJson(body, section.name, file) || {});
    } else if (section.name === "HISTORY KEPT") {
      file.kept = body;
    } else if (section.name === "HISTORY EVENTS") {
      file.events = readList(body, section.name, file).filter((row) => row && Number.isFinite(Number(row.t))).map((row) => ({t: Number(row.t), text: String(row.text ?? "")}));
    } else if (section.name.startsWith("HISTORY ")) {
      const samples = readList(body, section.name, file).filter((row) => row && Number.isFinite(Number(row.t)) && Number.isFinite(Number(row.count)));
      file.series.push({name: section.name.slice("HISTORY ".length), samples: samples.map((row) => ({t: Number(row.t), value: Number(row.count)}))});
    } else {
      file.other.push({name: section.name, body});
    }
  }
  if (!file.settings) {
    file.problems.push("The file has no readable SETTINGS CURRENT section.");
  }
  return file;
}

// key: value lines; a line with no key is the section's note.
function readAbout(body, file) {
  for (const line of body.split("\n")) {
    const match = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (match) {
      file.about[match[1]] = match[2];
    }
  }
}

// "key, other_key: what they mean", carried on by indented lines. Lines with no key are notes for the whole catalog.
function readCatalog(lines, file) {
  let keys = null;
  for (const line of lines) {
    if (/^\s+\S/.test(line) && keys) {
      for (const key of keys) {
        file.catalog[key] += " " + line.trim();
      }
      continue;
    }
    const match = /^([a-z0-9_]+(?:, [a-z0-9_]+)*): (.*)$/.exec(line);
    if (match) {
      keys = match[1].split(", ");
      for (const key of keys) {
        file.catalog[key] = match[2].trim();
      }
    } else if (line.trim() !== "") {
      keys = null;
      file.catalogNotes.push(line.trim());
    }
  }
}

function readJson(body, name, file) {
  try {
    return JSON.parse(body);
  } catch (error) {
    file.problems.push(name + " could not be read: " + error.message);
    return null;
  }
}

function readList(body, name, file) {
  const value = readJson(body || "[]", name, file);
  if (!Array.isArray(value)) {
    if (value !== null) {
      file.problems.push(name + " is not a list.");
    }
    return [];
  }
  return value;
}

// Times count from each start of the unit, so a time smaller than the one before is a restart. Each run is one start, in order.
function splitStarts(rows) {
  const starts = [];
  let run = [];
  for (const row of rows) {
    if (run.length && row.t < run[run.length - 1].t) {
      starts.push(run);
      run = [];
    }
    run.push(row);
  }
  if (run.length) {
    starts.push(run);
  }
  return starts;
}
