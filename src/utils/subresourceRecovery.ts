export const subresourceRecoveryScript = `
  (function() {
    var maxRetries = 1;
    var failedAssets = {};
    
    // Mapping of primary to secondary CDNs
    var cdnFallbacks = [
      { primary: 'cdnjs.cloudflare.com', secondary: 'unpkg.com' },
      { primary: 'cdn.jsdelivr.net', secondary: 'unpkg.com' },
      { primary: 'polyfill-library.fastly.dev', secondary: 'cdnjs.cloudflare.com/ajax/libs/core-js/3.33.0/minified.js' } // example
    ];

    window.addEventListener('error', function(e) {
      var target = e.target || e.srcElement;
      var isScript = target.tagName === 'SCRIPT';
      var isLink = target.tagName === 'LINK';
      
      if (isScript || isLink) {
        var url = target.src || target.href;
        if (!url) return;
        
        failedAssets[url] = (failedAssets[url] || 0) + 1;
        if (failedAssets[url] > maxRetries) return; // Prevent infinite loops
        
        // Log to analytics
        try {
          console.warn('[SubresourceRecovery] Asset failed to load:', url);
          if (window.gtag) {
            window.gtag('event', 'asset_load_failure', { url: url });
          }
        } catch (err) {}
        
        var newUrl = url;
        var replaced = false;
        
        for (var i = 0; i < cdnFallbacks.length; i++) {
          if (url.indexOf(cdnFallbacks[i].primary) !== -1) {
            newUrl = url.replace(cdnFallbacks[i].primary, cdnFallbacks[i].secondary);
            replaced = true;
            break;
          }
        }
        
        // If it's a local static asset (e.g., Next.js chunk), append a cache bust
        if (!replaced && url.indexOf(window.location.origin) === 0) {
          newUrl = url + (url.indexOf('?') === -1 ? '?' : '&') + 'retry=' + Date.now();
          replaced = true;
        }

        if (replaced) {
          console.log('[SubresourceRecovery] Retrying with:', newUrl);
          if (isScript) {
             var script = document.createElement('script');
             script.src = newUrl;
             script.crossOrigin = target.crossOrigin || 'anonymous';
             document.head.appendChild(script);
          } else {
             var link = document.createElement('link');
             link.href = newUrl;
             link.rel = target.rel || 'stylesheet';
             link.crossOrigin = target.crossOrigin || 'anonymous';
             document.head.appendChild(link);
          }
        } else {
          // If no fallback works, show offline UI
          if (failedAssets[url] >= maxRetries) {
             var fallbackUI = document.getElementById('offline-fallback-ui');
             if (!fallbackUI && document.body) {
                fallbackUI = document.createElement('div');
                fallbackUI.id = 'offline-fallback-ui';
                fallbackUI.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#dc2626;color:white;text-align:center;padding:12px;z-index:99999;font-family:sans-serif;font-size:14px;';
                fallbackUI.innerText = 'Network error: Critical assets failed to load. The application may not function correctly.';
                document.body.appendChild(fallbackUI);
             }
          }
        }
      }
    }, true); // Use capture phase to catch resource loading errors
  })();
`;
