(function () {
  var maxRetries = 1;
  var failedAssets = {};
  var cdnFallbacks = [
    { primary: "cdnjs.cloudflare.com", secondary: "unpkg.com" },
    { primary: "cdn.jsdelivr.net", secondary: "unpkg.com" },
    {
      primary: "polyfill-library.fastly.dev",
      secondary: "cdnjs.cloudflare.com/ajax/libs/core-js/3.33.0/minified.js",
    },
  ];

  window.addEventListener(
    "error",
    function (event) {
      var target = event.target || event.srcElement;
      if (!target || (target.tagName !== "SCRIPT" && target.tagName !== "LINK")) {
        return;
      }

      var isScript = target.tagName === "SCRIPT";
      var url = target.src || target.href;
      if (!url) return;

      failedAssets[url] = (failedAssets[url] || 0) + 1;
      if (failedAssets[url] > maxRetries) return;

      try {
        console.warn("[SubresourceRecovery] Asset failed to load:", url);
        if (window.gtag) {
          window.gtag("event", "asset_load_failure", { url: url });
        }
      } catch (error) {}

      var newUrl = url;
      var replaced = false;
      for (var i = 0; i < cdnFallbacks.length; i++) {
        if (url.indexOf(cdnFallbacks[i].primary) !== -1) {
          newUrl = url.replace(cdnFallbacks[i].primary, cdnFallbacks[i].secondary);
          replaced = true;
          break;
        }
      }

      if (!replaced && url.indexOf(window.location.origin) === 0) {
        newUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "retry=" + Date.now();
        replaced = true;
      }

      if (replaced) {
        console.log("[SubresourceRecovery] Retrying with:", newUrl);
        var replacement = document.createElement(isScript ? "script" : "link");
        if (isScript) {
          replacement.src = newUrl;
        } else {
          replacement.href = newUrl;
          replacement.rel = target.rel || "stylesheet";
        }
        replacement.crossOrigin = target.crossOrigin || "anonymous";
        document.head.appendChild(replacement);
      } else if (failedAssets[url] >= maxRetries && document.body) {
        var fallbackUI = document.getElementById("offline-fallback-ui");
        if (!fallbackUI) {
          fallbackUI = document.createElement("div");
          fallbackUI.id = "offline-fallback-ui";
          fallbackUI.style.cssText =
            "position:fixed;bottom:0;left:0;right:0;background:#dc2626;color:white;text-align:center;padding:12px;z-index:99999;font-family:sans-serif;font-size:14px;";
          fallbackUI.innerText =
            "Network error: Critical assets failed to load. The application may not function correctly.";
          document.body.appendChild(fallbackUI);
        }
      }
    },
    true,
  );
})();
