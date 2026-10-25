var DEFAULTS; // sent by the page, from 12hto24h.user.js

var RULE_NAMES = {
  range: 'range',
  hourOnly: 'hour only',
  dot: 'dot separator',
  shorthand: 'a/p shorthand',
  time: 'time'
};

var tabId;
var host;
var scope = 'site';
var settings = { global: {}, sites: {} };

function effective() {
  var global = Object.assign({}, DEFAULTS, settings.global);
  return scope === 'global' ? global : Object.assign(global, settings.sites[host]);
}

function render() {
  var values = effective();
  var overrides = settings.sites[host] || {};
  var hasOverrides = Object.keys(overrides).length > 0;

  document.getElementById('scope-site').classList.toggle('active', scope === 'site');
  document.getElementById('scope-global').classList.toggle('active', scope === 'global');
  document.getElementById('enabled-label').textContent = scope === 'site' ? 'Convert times on ' + host : 'Convert times on all sites';

  var note = document.getElementById('scope-note');
  note.textContent = '';
  if (scope === 'site' && hasOverrides) {
    note.append('Custom settings for this site. ');
    var reset = document.createElement('button');
    reset.id = 'reset';
    reset.textContent = 'Use "All sites" settings';
    reset.addEventListener('click', function () {
      delete settings.sites[host];
      save();
    });
    note.append(reset);
  } else if (scope === 'global' && hasOverrides) {
    note.textContent = host + ' has its own settings, which win over these.';
  }

  document.querySelectorAll('input[type=checkbox][data-key]').forEach(function (input) {
    input.checked = values[input.dataset.key];
  });
  document.querySelectorAll('input[name=colon]').forEach(function (input) {
    input.checked = String(values.colon) === input.value;
  });
  document.getElementById('rules').disabled = !values.enabled;
}

function set(key, value) {
  if (scope === 'global') {
    settings.global[key] = value;
    // sites that set the same value no longer differ from "All sites"
    Object.keys(settings.sites).forEach(function (site) {
      if (settings.sites[site][key] === value) {
        delete settings.sites[site][key];
        if (!Object.keys(settings.sites[site]).length) {
          delete settings.sites[site];
        }
      }
    });
  } else {
    var global = Object.assign({}, DEFAULTS, settings.global);
    var site = Object.assign({}, settings.sites[host]);
    // a site only stores what differs from "All sites", so later global changes still reach it
    if (global[key] === value) {
      delete site[key];
    } else {
      site[key] = value;
    }
    if (Object.keys(site).length) {
      settings.sites[host] = site;
    } else {
      delete settings.sites[host];
    }
  }
  save();
}

function save() {
  chrome.storage.local.set(settings);
  render();
  // the page reverts and reconverts on storage change; refresh the match list after that
  setTimeout(refreshHits, 250);
  setTimeout(refreshHits, 1000);
}

function renderHits(hits, enabled) {
  var box = document.getElementById('hits');
  box.textContent = '';
  var message = !enabled ? 'Off for this site.' : !hits.length ? 'Nothing converted on this page.' : '';
  if (message) {
    var note = document.createElement('span');
    note.className = 'muted';
    note.textContent = message;
    box.appendChild(note);
    return;
  }
  var table = document.createElement('table');
  hits.forEach(function (hit) {
    var row = table.insertRow();
    var from = row.insertCell();
    var before = document.createElement('code');
    before.textContent = hit.from;
    var after = document.createElement('code');
    after.textContent = hit.to;
    from.append(before, ' → ', after);
    var rule = row.insertCell();
    rule.className = 'rule';
    rule.textContent = RULE_NAMES[hit.rule] || hit.rule;
    var count = row.insertCell();
    count.className = 'count';
    count.textContent = hit.count > 1 ? '×' + hit.count : '';
  });
  box.appendChild(table);
}

function refreshHits() {
  chrome.tabs.sendMessage(tabId, { type: 'getStatus' }, { frameId: 0 }, function (status) {
    if (!chrome.runtime.lastError && status) {
      renderHits(status.hits, status.enabled);
    }
  });
}

document.querySelectorAll('input[type=checkbox][data-key]').forEach(function (input) {
  input.addEventListener('change', function () { set(input.dataset.key, input.checked); });
});
document.querySelectorAll('input[name=colon]').forEach(function (input) {
  input.addEventListener('change', function () { set('colon', input.value === 'true'); });
});
document.getElementById('scope-site').addEventListener('click', function () { scope = 'site'; render(); });
document.getElementById('scope-global').addEventListener('click', function () { scope = 'global'; render(); });

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  tabId = tabs[0].id;
  chrome.tabs.sendMessage(tabId, { type: 'getStatus' }, { frameId: 0 }, function (status) {
    if (chrome.runtime.lastError || !status) {
      document.getElementById('unavailable').hidden = false;
      return;
    }
    host = status.host;
    DEFAULTS = status.defaults;
    chrome.storage.local.get({ global: {}, sites: {} }, function (data) {
      settings = data;
      document.getElementById('main').hidden = false;
      render();
      renderHits(status.hits, status.enabled);
    });
  });
});
