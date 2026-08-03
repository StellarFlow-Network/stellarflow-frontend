/**
 * Custom Workbox/next-pwa worker extensions for Web Push (#599).
 *
 * next-pwa prepends files from `worker/` into the generated service worker.
 * This handler shows notifications and deep-links clicks to `/?tx=&type=`.
 */

/* eslint-disable no-undef */
/* global self, clients */

self.addEventListener("push", (event) => {
  let payload = {
    title: "StellarFlow",
    body: "You have a new update",
    type: "swap",
    txHash: "",
    meta: {},
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    try {
      const text = event.data && event.data.text();
      if (text) payload.body = text;
    } catch {
      /* ignore */
    }
  }

  const title = payload.title || "StellarFlow";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.txHash ? `tx-${payload.txHash}` : `sf-${Date.now()}`,
    renotify: Boolean(payload.txHash),
    data: {
      type: payload.type,
      txHash: payload.txHash,
      meta: payload.meta || {},
      url:
        payload.txHash && payload.type
          ? `/?tx=${encodeURIComponent(payload.txHash)}&type=${encodeURIComponent(payload.type)}`
          : "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          } else {
            client.postMessage({
              type: "SF_PUSH_DEEP_LINK",
              url: targetUrl,
            });
          }
          return;
        }
      }

      if (clients.openWindow) {
        await clients.openWindow(targetUrl);
      }
    })(),
  );
});
