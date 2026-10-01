/**
 * Standalone Web Push service worker (#599).
 * Used when next-pwa's generated /sw.js is unavailable (e.g. development).
 *
 * A push payload may carry its own `url` (multisig signature requests deep link
 * to `/multisig?filter=pending&request=<id>`, #962); otherwise the legacy
 * `?tx=&type=` transaction deep link is derived from the payload.
 */

/* eslint-disable no-undef */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    /* ignore */
  }

  const targetUrl =
    typeof payload.url === "string" && payload.url
      ? payload.url
      : payload.txHash && payload.type
        ? `/?tx=${encodeURIComponent(payload.txHash)}&type=${encodeURIComponent(payload.type)}`
        : "/";

  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.txHash ? `tx-${payload.txHash}` : `sf-${Date.now()}`,
    data: {
      type: payload.type,
      txHash: payload.txHash,
      meta: payload.meta || {},
      url: targetUrl,
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(
        payload.title || "StellarFlow",
        options,
      );

      // Relay to open tabs so in-app state (pending badge, queues) updates
      // without a reload. Consumers ignore payload types they do not know.
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        client.postMessage({
          type: payload.type,
          url: targetUrl,
          request: payload.request,
        });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        await client.focus();
        if ("navigate" in client) {
          await client.navigate(targetUrl);
        } else {
          client.postMessage({ type: "SF_PUSH_DEEP_LINK", url: targetUrl });
        }
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
