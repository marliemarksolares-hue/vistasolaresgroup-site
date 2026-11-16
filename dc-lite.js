/* dc-lite: tiny template runtime for the Vista-Solares Group site.
   Supports <sc-if value="{{ x }}">, <sc-for list="{{ xs }}" as="x">, {{ a.b }} in text and attributes,
   onClick/onInput/onChange handlers, and re-renders (in place) after setState. No dependencies. */
(function () {
  'use strict';
  var BOOL = { checked: 1, disabled: 1, selected: 1, required: 1, hidden: 1, open: 1 };
  var HANDLERS = ['onclick', 'oninput', 'onchange', 'onkeydown'];

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (s) {
    var next = typeof s === 'function' ? s(this.state) : s;
    for (var k in next) this.state[k] = next[k];
    if (this.__schedule) this.__schedule();
  };
  DCLogic.prototype.renderVals = function () { return {}; };
  window.DCLogic = DCLogic;

  function get(scope, path) {
    var neg = false;
    path = path.trim();
    if (path.charAt(0) === '!') { neg = true; path = path.slice(1).trim(); }
    var cur = scope, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) { cur = undefined; break; }
      cur = cur[parts[i]];
    }
    return neg ? !cur : cur;
  }
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  function interp(str, scope) {
    return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, p) {
      var v = get(scope, p); return v == null ? '' : String(v);
    });
  }

  function build(node, scope, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(node.nodeValue.indexOf('{{') >= 0 ? interp(node.nodeValue, scope) : node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-if') {
      var m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && get(scope, m[1])) buildKids(node, scope, out);
      return;
    }
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || '');
      var list = (lm && get(scope, lm[1])) || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var sc = Object.create(scope); sc[as] = list[i]; sc.index = i;
        buildKids(node, sc, out);
      }
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var n = attrs[a].name, v = attrs[a].value;
      if (n.indexOf('hint-') === 0) continue;
      var dyn = v.indexOf('{{') >= 0;
      var lower = n.toLowerCase();
      if (dyn) {
        var wm = WHOLE.exec(v);
        var raw = wm ? get(scope, wm[1]) : interp(v, scope);
        if (lower.indexOf('on') === 0 && typeof raw === 'function') { el[lower] = raw; continue; }
        if (lower === 'value') { el.__value = raw == null ? '' : String(raw); continue; }
        if (BOOL[lower]) {
          if (raw) el.setAttribute(n, '');
          if (lower === 'checked') el.__checked = !!raw;
          continue;
        }
        if (raw == null || raw === false && lower.indexOf('aria-') !== 0) continue;
        el.setAttribute(n, String(raw));
      } else {
        el.setAttribute(n, v);
      }
    }
    buildKids(node, scope, el);
    if (el.__value !== undefined && (tag === 'input' || tag === 'select' || tag === 'textarea')) el.value = el.__value;
    if (el.__checked !== undefined) el.checked = el.__checked;
    out.appendChild(el);
  }
  function buildKids(node, scope, out) {
    for (var c = node.firstChild; c; c = c.nextSibling) build(c, scope, out);
  }

  function sumText(el) { var s = el.querySelector && el.querySelector('summary'); return s ? s.textContent : ''; }

  function syncEl(a, b) {
    var i, at;
    // attributes
    for (i = a.attributes.length - 1; i >= 0; i--) {
      at = a.attributes[i].name;
      if (!b.hasAttribute(at)) {
        if (at.indexOf('data-m-') === 0) continue;
        if (at === 'open' && a.nodeName === 'DETAILS' && sumText(a) === sumText(b)) continue;
        a.removeAttribute(at);
      }
    }
    for (i = 0; i < b.attributes.length; i++) {
      at = b.attributes[i].name;
      if (at === 'open' && a.nodeName === 'DETAILS' && sumText(a) === sumText(b)) continue;
      if (a.getAttribute(at) !== b.attributes[i].value) a.setAttribute(at, b.attributes[i].value);
    }
    // handlers
    for (i = 0; i < HANDLERS.length; i++) {
      if (a[HANDLERS[i]] !== b[HANDLERS[i]]) a[HANDLERS[i]] = b[HANDLERS[i]];
    }
    // form state
    var t = a.nodeName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') {
      if (b.__value !== undefined && a.value !== b.__value) {
        a.value = b.__value;
        if (document.activeElement === a && a.setSelectionRange && /^(text|search|tel|url|email|textarea)$/.test(a.type || 'text')) {
          try { a.setSelectionRange(a.value.length, a.value.length); } catch (e) { /* ignore */ }
        }
      }
      if (b.__checked !== undefined && a.checked !== b.__checked) a.checked = b.__checked;
    }
  }

  function morph(oldP, newP) {
    var o = Array.prototype.slice.call(oldP.childNodes);
    var n = Array.prototype.slice.call(newP.childNodes);
    for (var i = 0; i < n.length; i++) {
      var a = o[i], b = n[i];
      if (!a) { oldP.appendChild(b); continue; }
      if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { oldP.replaceChild(b, a); continue; }
      if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; continue; }
      if (a.nodeType === 1) { syncEl(a, b); morph(a, b); }
    }
    while (oldP.childNodes.length > n.length) oldP.removeChild(oldP.lastChild);
  }

  window.DC = {
    mount: function (Component) {
      var root = document.querySelector('x-dc');
      if (!root) return;
      var tpl = root.cloneNode(true);
      root.textContent = '';
      var inst = new Component({});
      var pending = false;
      function render() {
        pending = false;
        var scope = inst.renderVals() || {};
        var frag = document.createElement('div');
        buildKids(tpl, scope, frag);
        morph(root, frag);
      }
      inst.__schedule = function () {
        if (pending) return;
        pending = true;
        var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (window.__dcVT && document.startViewTransition && !reduce) {
          window.__dcVT = 0;
          document.startViewTransition(render);
        } else {
          window.__dcVT = 0;
          Promise.resolve().then(render);
        }
      };
      render();
      document.documentElement.classList.add('dc-ready');
      function toHash() {
        var h = location.hash && location.hash.slice(1);
        var el = h && document.getElementById(h);
        if (el) el.scrollIntoView();
      }
      setTimeout(toHash, 60);
      // highlighter sweep: mark .hl spans as they enter the viewport
      if ('IntersectionObserver' in window) {
        document.documentElement.classList.add('m-on');
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) { e.target.setAttribute('data-m-in', ''); io.unobserve(e.target); }
          });
        }, { rootMargin: '0px 0px -18% 0px' });
        [].forEach.call(document.querySelectorAll('.hl'), function (el) { io.observe(el); });
      }
      window.addEventListener('hashchange', toHash);
    }
  };
})();
