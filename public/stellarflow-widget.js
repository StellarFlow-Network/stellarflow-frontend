(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var frame = document.createElement('iframe');
  var url = new URL(script.getAttribute('data-widget-url') || '/embed/swap', script.src || window.location.href);
  var attributes = ['inputCurrency', 'outputCurrency', 'theme', 'accentColor'];

  attributes.forEach(function (name) {
    var value = script.getAttribute('data-' + name);
    if (value) url.searchParams.set(name, value);
  });

  frame.src = url.toString();
  frame.title = 'StellarFlow token swap';
  frame.loading = 'lazy';
  frame.allow = 'clipboard-write';
  frame.style.cssText = 'display:block;width:100%;height:' + (script.getAttribute('data-height') || '480px') + ';border:0;overflow:hidden;';
  frame.setAttribute('scrolling', 'no');
  script.parentNode.insertBefore(frame, script.nextSibling);
})();