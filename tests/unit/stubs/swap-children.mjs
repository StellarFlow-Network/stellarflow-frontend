/**
 * Lightweight stand-ins for `SwapCard`'s presentational children and the token
 * icon. The real modules pull in browser-only charting/dialog/animation code;
 * these doubles keep the server-rendered assertions focused on `SwapCard`'s own
 * layout and state machine.
 */
import React from 'react';

export const TokenIcon = ({ symbol }) =>
  React.createElement('span', { 'data-testid': 'token-icon' }, symbol ?? '');

export const PathVisualizer = () => null;

export const GasEstimateBadge = () => null;

export const TokenSelectorModal = () => null;

export const SlippageSettingsModal = () => null;

export const SlippageVisualizer = () => null;

export default TokenIcon;
