export const EVENT_CONFIG = {
  ISOLATION_ENABLED: true,
  STOP_PROPAGATION_ON_STATUS_CLICK: true,
  PREVENT_DEFAULT_ON_ICONS: false,
  ISOLATED_CLICK_SELECTOR: '[data-isolated-click]',
  DEBUG_EVENTS: false
};

export const STATUS_ICON_EVENTS = {
  ONLINE: 'status-online-click',
  OFFLINE: 'status-offline-click',
  AWAY: 'status-away-click',
  BUSY: 'status-busy-click'
};

export const initializeEventIsolation = () => {
  return {
    ...EVENT_CONFIG,
    timestamp: Date.now(),
    isolatedSelectors: [
      '[data-isolated-click]',
      '.status-icon',
      '.status-badge',
      '[role="img"][data-status]'
    ]
  };
};
