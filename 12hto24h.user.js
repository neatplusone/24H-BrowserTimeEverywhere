// ==UserScript==
// @name         12 hour am pm to 24 hour format
// @namespace    https://*
// @version      2.2.f12h
// @description  Convert all elements with 12-hour time to 24-hour automatically for all websites. Tested: Discord, Cloud Hetzner Console, Google Maps/Search
// @author       dw5
// @homepage     https://github.com/dw5/24H-BrowserTimeEverywhere
// @icon         https://raw.githubusercontent.com/dw5/24H-BrowserTimeEverywhere/main/icons/128.png
// @grant        none
// @match        https://*/*
// @run-at       document-start
// @license MIT
// ==/UserScript==

// letters/digits of any script, so 8AMé or ...ü8 am are not matched
var WORD = '\\p{L}\\p{M}\\p{N}_';
// not inside fractions/dates/prices: 1/8 AM, 2023-10-5 pm, $5 pm
var BEFORE = '(?<![' + WORD + '.:/$£€¥])(?<!\\d-)';
// a range doesn't start right after a month: "Nov 3 - 5 pm" is a date, then a time ("Mon 9–5 pm" is fine)
var NOT_DATE = '(?<!(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\\.?\\s)';

// am, AM, a.m., A.M. (or a/p glued to minutes with a colon, like 8:30p - checked in code); not "3 PM's"
var MERIDIEM = '(?:\\s?([ap])(?:\\.\\s?m\\.?|m)|([ap]))(?![' + WORD + '])(?![\'’]s(?![' + WORD + ']))';
var MINUTES = '([0-5]\\d)';

// 9:30–1 pm, 3–6 pm, 8.00 - 7.00 pm, 9 to 5 pm (start has no am/pm of its own)
var rangeRegex = new RegExp(
  BEFORE + NOT_DATE + '(\\d{1,2})(?:([:.])' + MINUTES + ')?' +
  '(\\s?[-–—]\\s?|\\s+to\\s+)' +
  '(\\d{1,2})(?:([:.])' + MINUTES + ')?' + MERIDIEM, 'giu');

// 5:10 pm, 05.10 p.m., 8AM, 11:59:30 PM, 8:30p
var timeRegex = new RegExp(
  BEFORE + '(\\d{1,2})(?:([:.])' + MINUTES + '(?:\\2' + MINUTES + ')?)?' + MERIDIEM, 'giu');

// "am" is also a German word ("Fig. 2 am Rand"), so on German pages only "9 AM"/"9am"/"9:00 am" count
function isGermanAm(match, minutes) {
  return !minutes && /\sam$/.test(match) && /^de\b/i.test(document.documentElement.lang || '');
}

// "Opens 8 a.m." and "at 8 a.m.” Then" keep the period; mid-sentence ("9 a.m. ET on") it goes away
function sentenceEnd(match, offset, string) {
  if (match.slice(-1) !== '.') {
    return '';
  }
  var rest = string.slice(offset + match.length);
  return (rest === '' || /^[\n\r"”’')\]]/.test(rest)) ? '.' : '';
}

function logHit(hits, from, rule, to) {
  if (hits) {
    hits.push({ from: from, to: to, rule: rule });
  }
  return to;
}

function to24(hour, meridiem) {
  if (hour === 12) {
    return meridiem === 'a' ? 0 : 12;
  }
  return meridiem === 'a' ? hour : hour + 12;
}

function formatTime(hour, separator, minutes, seconds) {
  return ('0' + hour).slice(-2) + separator + (minutes || '00') + (seconds ? (separator + seconds) : '');
}

// rule switches, overridable globally and per site from the extension popup
var DEFAULTS = { enabled: true, range: true, hourOnly: true, dot: true, shorthand: true, colon: false };

// which switch a single time falls under
function ruleOf(separator, minutes, letter) {
  if (letter) {
    return 'shorthand';
  }
  if (!minutes) {
    return 'hourOnly';
  }
  return separator === '.' ? 'dot' : 'time';
}

// hits (optional array) collects {from, to, rule} for the popup
function convertText(text, hits, options) {
  options = options || DEFAULTS;
  // ranges left alone are parked so the single-time pass can't convert just their end ("3–18:00")
  var kept = [];
  function keep(match) {
    return '\u0000' + (kept.push(match) - 1) + '\u0001';
  }
  text = text.replace(rangeRegex, function (match, startH, startSep, startM, dash, endH, endSep, endM, meridiem, letter, offset, string) {
    var start = parseInt(startH, 10);
    var end = parseInt(endH, 10);
    if (start < 1 || start > 12 || end < 1 || end > 12 || (letter && endSep !== ':') || isGermanAm(match, endM)) {
      return match;
    }
    if (!options.range || (letter && !options.shorthand) || ((!startM || !endM) && !options.hourOnly) ||
        (!options.dot && (startSep === '.' || endSep === '.'))) {
      return keep(match);
    }
    var mer = (meridiem || letter).toLowerCase();
    var end24 = to24(end, mer);
    // start shares the end's am/pm, unless that would put it after the end (9:30–1 pm)
    var start24 = to24(start, mer);
    if (start24 * 60 + parseInt(startM || '0', 10) > end24 * 60 + parseInt(endM || '0', 10)) {
      start24 = to24(start, mer === 'a' ? 'p' : 'a');
    }
    var sep = options.colon ? ':' : startSep || endSep || ':';
    return logHit(hits, match, 'range',
      formatTime(start24, sep, startM) + dash + formatTime(end24, options.colon ? ':' : endSep || sep, endM) + sentenceEnd(match, offset, string));
  });

  text = text.replace(timeRegex, function (match, hours, separator, minutes, seconds, meridiem, letter, offset, string) {
    var hour = parseInt(hours, 10);
    var rule = ruleOf(separator, minutes, letter);
    if ((letter && separator !== ':') || isGermanAm(match, minutes) || hour < 1 || hour > 12 ||
        options[rule] === false || (separator === '.' && !options.dot)) {
      return match;
    }
    return logHit(hits, match, rule,
      formatTime(to24(hour, (meridiem || letter).toLowerCase()), options.colon ? ':' : separator || ':', minutes, seconds) + sentenceEnd(match, offset, string));
  });
  return kept.length ? text.replace(/\u0000(\d+)\u0001/g, function (token, index) { return kept[index]; }) : text;
}

// ---- page side: only touch nodes that changed (MutationObserver), batched per animation frame ----

var SKIP = 'head, script, noscript, style, textarea, [contenteditable]:not([contenteditable="false"])';
var PREFILTER = /\d\s?[ap]/i; // every match ends in digit + optional space + a/p
var MAX_HITS = 200;

var enabled = false;
var options = DEFAULTS;
var converted = new WeakMap(); // text node -> {original, converted}, for undo when turned off
var tracked = [];              // WeakRefs to those nodes, so undo also reaches nodes no longer walked
var trackedLimit = 1000;
var hitLog = new Map();        // "from|to|rule" -> {from, to, rule, count}, for the popup
var pending = new Set();
var scheduled = false;
var observedRoots = new WeakSet();
var observer;

function recordHits(hits) {
  hits.forEach(function (hit) {
    var key = hit.from + '|' + hit.to + '|' + hit.rule;
    var entry = hitLog.get(key);
    if (entry) {
      entry.count++;
    } else if (hitLog.size < MAX_HITS) {
      hitLog.set(key, { from: hit.from, to: hit.to, rule: hit.rule, count: 1 });
    }
  });
}

function convertNode(node) {
  var text = node.nodeValue;
  if (!node.isConnected || !PREFILTER.test(text)) {
    return;
  }
  var parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) {
    return;
  }
  var hits = [];
  var convertedText = convertText(text, hits, options);
  if (convertedText !== text) {
    if (!converted.has(node)) {
      track(node);
    }
    converted.set(node, { original: text, converted: convertedText });
    node.nodeValue = convertedText;
    recordHits(hits);
  }
}

function track(node) {
  tracked.push(new WeakRef(node));
  if (tracked.length > trackedLimit) {
    tracked = tracked.filter(function (ref) { return ref.deref(); });
    trackedLimit = Math.max(1000, tracked.length * 2);
  }
}

function enterShadow(element, visit) {
  if (enabled) {
    observe(element.shadowRoot);
  }
  walk(element.shadowRoot, visit);
}

function walk(root, visit) {
  if (root.nodeType === Node.TEXT_NODE) {
    visit(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.matches(SKIP)) {
      return;
    }
    if (root.shadowRoot) {
      enterShadow(root, visit);
    }
  }
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      if (node.matches(SKIP)) {
        return NodeFilter.FILTER_REJECT; // skips the whole subtree
      }
      if (node.shadowRoot) {
        enterShadow(node, visit);
      }
      return NodeFilter.FILTER_SKIP;
    }
  });
  var node;
  while ((node = walker.nextNode())) {
    visit(node);
  }
}

function flush() {
  scheduled = false;
  var batch = pending;
  pending = new Set();
  if (enabled) {
    batch.forEach(function (root) {
      // a node inside another queued root is covered by that root's walk
      for (var parent = root.parentNode; parent; parent = parent.parentNode) {
        if (batch.has(parent)) {
          return;
        }
      }
      walk(root, convertNode);
    });
  }
  observer.takeRecords(); // drop records caused by our own writes
}

function schedule() {
  if (scheduled) {
    return;
  }
  scheduled = true;
  // rAF runs before paint (no am/pm flash) but is paused in background tabs
  if (document.hidden) {
    setTimeout(flush, 0);
  } else {
    requestAnimationFrame(flush);
  }
}

function observe(root) {
  if (observedRoots.has(root)) {
    return;
  }
  observedRoots.add(root);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  pending.add(root);
  schedule();
}

function start() {
  if (enabled) {
    return;
  }
  enabled = true;
  observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === 'characterData') {
        pending.add(record.target);
      } else {
        record.addedNodes.forEach(function (node) { pending.add(node); });
        // custom elements may attach their shadow root after we walked them
        if (record.target.shadowRoot && !observedRoots.has(record.target.shadowRoot)) {
          observe(record.target.shadowRoot);
        }
      }
    });
    if (pending.size) {
      schedule();
    }
  });
  observedRoots = new WeakSet();
  // waiting for DOMContentLoaded avoids converting half-parsed text ("9:30 p" + "m")
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (enabled) {
        observe(document);
      }
    });
  } else {
    observe(document);
  }
}

function stop() {
  if (!enabled) {
    return;
  }
  enabled = false;
  observer.disconnect();
  pending = new Set();
  scheduled = false; // a queued rAF may never run in a hidden tab; let start() schedule again
  // put back the original text (also in detached nodes), unless the page has rewritten the node since
  tracked.forEach(function (ref) {
    var node = ref.deref();
    var record = node && converted.get(node);
    if (record && node.nodeValue === record.converted) {
      node.nodeValue = record.original;
    }
  });
  tracked = [];
  converted = new WeakMap();
  hitLog.clear();
}

// ---- extension only: per-site switch and popup; the userscript just runs everywhere ----

var isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage;

if (isExtension) {
  // inside iframes, the switch follows the top page's site as far as we can tell
  var topHost = function () {
    if (window.top === window) {
      return location.hostname;
    }
    try {
      if (location.ancestorOrigins && location.ancestorOrigins.length) {
        return new URL(location.ancestorOrigins[location.ancestorOrigins.length - 1]).hostname; // throws on "null"
      }
    } catch (e) {}
    try {
      return window.top.location.hostname; // same-origin only
    } catch (e) {}
    try {
      return new URL(document.referrer).hostname;
    } catch (e) {}
    return location.hostname;
  };
  var host = topHost();

  // storage: {global: {...}, sites: {host: {...}}}; a site only stores what differs from global
  var applySettings = function (data) {
    var next = Object.assign({}, DEFAULTS, data.global, (data.sites || {})[host]);
    if (!next.enabled) {
      stop();
      options = next;
      return;
    }
    if (enabled && JSON.stringify(next) !== JSON.stringify(options)) {
      stop(); // rules changed: put the original text back, then convert again with the new rules
    }
    options = next;
    start();
  };

  chrome.storage.local.get({ global: {}, sites: {} }, applySettings);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && (changes.global || changes.sites)) {
      chrome.storage.local.get({ global: {}, sites: {} }, applySettings);
    }
  });

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'getStatus') {
      sendResponse({ host: host, enabled: enabled, defaults: DEFAULTS, hits: Array.from(hitLog.values()) });
    }
  });
} else if (typeof document !== 'undefined') {
  start();
}
