export const ICON_IDS = {
  // Navigation / Admin tabs
  radio:       "icon-radio",
  fileCheck:   "icon-file-check",
  network:     "icon-network",
  sliders:     "icon-sliders",

  // Relayer page toolbar + stats
  activity:    "icon-activity",
  plus:        "icon-plus",
  search:      "icon-search",
  moreVertical:"icon-more-vertical",
  refresh:     "icon-refresh",
  shield:      "icon-shield",
  clock:       "icon-clock",
  signal:      "icon-signal",

  // Table / list row actions
  arrowUpRight:"icon-arrow-up-right",
  externalLink:"icon-external-link",
  chevronRight:"icon-chevron-right",

  // Status / health
  checkCircle: "icon-check-circle",
  alertTriangle:"icon-alert-triangle",
  shieldAlert: "icon-shield-alert",

  // Misc page-level
  cpu:         "icon-cpu",
  upload:      "icon-upload",
  zap:         "icon-zap",
  lock:        "icon-lock",
  unlock:      "icon-unlock",
  history:     "icon-history",
  code2:       "icon-code2",
  vote:        "icon-vote",
  filePlus:    "icon-file-plus",
  users:       "icon-users",
  wallet:      "icon-wallet",
  coins:       "icon-coins",
  percent:     "icon-percent",
  flame:       "icon-flame",
  trendingUp:  "icon-trending-up",
  gavel:       "icon-gavel",
  shieldCheck: "icon-shield-check",
  key:         "icon-key",
  layers:      "icon-layers",
  creditCard:  "icon-credit-card",
  eye:         "icon-eye",
  eyeOff:      "icon-eye-off",
  copy:        "icon-copy",
  refreshCcw:  "icon-refresh-ccw",

  // Navigation sidebar
  layoutDashboard: "icon-layout-dashboard",
  database:        "icon-database",
  lineChart:       "icon-line-chart",
  globe:           "icon-globe",
  settings:        "icon-settings",

  // Docs page
  bookOpen:  "icon-book-open",
  terminal:  "icon-terminal",
  check:     "icon-check",
  play:      "icon-play",

  // Logs page
  fileText:     "icon-file-text",
  download:     "icon-download",
  filter:       "icon-filter",
  chevronLeft:  "icon-chevron-left",
  wifi:         "icon-wifi",
  wifiOff:      "icon-wifi-off",

  // Settings page
  user:       "icon-user",
  bell:       "icon-bell",
  smartphone: "icon-smartphone",
  mailIcon:   "icon-mail",
  save:       "icon-save",
  rotateCcw:  "icon-rotate-ccw",

  // Governance page
  xCircle:    "icon-x-circle",

  // Navigation / topbar
  logOut:     "icon-log-out",
} as const;

export type IconId = (typeof ICON_IDS)[keyof typeof ICON_IDS];
