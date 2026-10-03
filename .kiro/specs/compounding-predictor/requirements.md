# Requirements Document

## Introduction

The Compounding Predictor is an interactive chart component that visualises compound growth over time for a given initial deposit. Users can explore how different compounding frequencies (Daily, Weekly, Monthly, or a manually entered rate) affect their final projected balance compared to simple APY. The component renders growth curves using chart.js/react-chartjs-2 (the library already present in the codebase), re-renders instantly on input changes, and exposes a projected profit difference metric between compound and simple returns. The mathematical core must align with the backend strategy yield models, which apply the standard formula A = P(1 + r/n)^(nt).

**Note on charting library:** The project already depends on `chart.js` v4 and `react-chartjs-2` v5 (see `package.json`). The implementation MUST use these libraries rather than adding a new dependency such as Recharts.

---

## Glossary

- **CompoundingPredictor**: The React component described by this document, located at `src/components/yield/CompoundingPredictor.tsx`.
- **Principal (P)**: The user-supplied initial deposit amount in USD.
- **Annual Rate (r)**: The annual percentage yield expressed as a decimal (e.g., 0.12 for 12 %).
- **Compounding_Frequency (n)**: The number of times interest is compounded per year. Supported preset values: Daily (365), Weekly (52), Monthly (12).
- **Manual_Rate**: A compounding frequency value entered directly by the user as a positive integer number of times per year, available when the Manual mode is selected.
- **Time (t)**: The projection horizon in years. Default is 1 year; the range is 1–10 years.
- **Compound_Balance**: The projected balance computed using A = P(1 + r/n)^(nt).
- **Simple_Balance**: The projected balance computed using A = P(1 + r·t) (simple interest baseline).
- **Net_Profit_Difference**: The monetary difference between Compound_Balance and Simple_Balance at the selected time horizon: Compound_Balance − Simple_Balance.
- **Growth_Curve**: A time-series dataset of Compound_Balance values sampled at monthly intervals from month 0 to the end of the selected Time horizon.
- **Simple_Curve**: A time-series dataset of Simple_Balance values sampled at the same monthly intervals.
- **APY_Input**: The annual percentage yield slider or numeric input provided by the user.
- **Deposit_Input**: The numeric text input through which the user sets the Principal.
- **Frequency_Selector**: The group of toggle buttons (Daily, Weekly, Monthly, Manual) that sets Compounding_Frequency.
- **Backend_Yield_Model**: The server-side calculation that applies A = P(1 + r/n)^(nt) with the same formula and semantics.

---

## Requirements

### Requirement 1: Compound Growth Calculation

**User Story:** As a DeFi user, I want the predictor to compute my projected balance using the compound interest formula, so that I can accurately forecast how my deposit grows under the platform's yield strategy.

#### Acceptance Criteria

1. THE CompoundingPredictor SHALL compute Compound_Balance using the formula A = P(1 + r/n)^(nt), where P is the Principal, r is the Annual Rate as a decimal, n is the Compounding_Frequency, and t is the Time in years.
2. THE CompoundingPredictor SHALL compute Simple_Balance using the formula A = P(1 + r·t), where P is the Principal, r is the Annual Rate as a decimal, and t is the Time in years.
3. WHEN the Principal is 0 or the Annual Rate is 0, THE CompoundingPredictor SHALL return a Compound_Balance equal to the Principal for all time points.
4. THE CompoundingPredictor SHALL compute Compound_Balance and Simple_Balance values that match the Backend_Yield_Model output within a floating-point tolerance of 0.0001 USD for any Principal between 1 and 10,000,000 USD.
5. FOR ALL valid Principal, Annual Rate, Compounding_Frequency, and Time inputs, THE CompoundingPredictor SHALL produce a Compound_Balance greater than or equal to the Simple_Balance.
6. FOR ALL valid inputs, parsing the calculation inputs and re-computing SHALL produce the same result as the first computation (idempotence).

---

### Requirement 2: Growth Curve Data Generation

**User Story:** As a DeFi user, I want to see a smooth growth curve over time, so that I can compare compound versus simple returns visually.

#### Acceptance Criteria

1. THE CompoundingPredictor SHALL generate a Growth_Curve dataset containing one data point per month from month 0 through month (Time × 12), inclusive.
2. THE CompoundingPredictor SHALL generate a Simple_Curve dataset with the same number of monthly data points as the Growth_Curve.
3. WHEN the Time horizon changes, THE CompoundingPredictor SHALL regenerate both the Growth_Curve and Simple_Curve datasets to cover the new range without retaining stale data points.
4. THE CompoundingPredictor SHALL include the starting point (t = 0) as the first data point in both curves, where both values equal the Principal.

---

### Requirement 3: Interactive Chart Rendering

**User Story:** As a DeFi user, I want an interactive chart that visualises both growth curves, so that I can immediately understand the compounding advantage.

#### Acceptance Criteria

1. THE CompoundingPredictor SHALL render a line chart with two series: the Growth_Curve labelled "Compound APY" and the Simple_Curve labelled "Simple APY".
2. THE CompoundingPredictor SHALL re-render both chart curves instantly — within the same synchronous React render cycle — whenever the user modifies the Deposit_Input, APY_Input, Compounding_Frequency, Time horizon, or Manual_Rate.
3. THE CompoundingPredictor SHALL display a tooltip when the user hovers over any data point that shows the month, the Compound_Balance, and the Simple_Balance at that point.
4. THE CompoundingPredictor SHALL render the chart using the chart.js and react-chartjs-2 libraries that are already present in the project dependencies.
5. THE CompoundingPredictor SHALL apply a filled area under the Growth_Curve using a semi-transparent fill to visually distinguish it from the Simple_Curve.
6. WHEN the chart container width changes, THE CompoundingPredictor SHALL resize the chart responsively without distortion.

---

### Requirement 4: Compounding Frequency Selector

**User Story:** As a DeFi user, I want to choose how often my yield compounds, so that I can compare different strategy configurations.

#### Acceptance Criteria

1. THE Frequency_Selector SHALL present four toggle buttons: Daily (n = 365), Weekly (n = 52), Monthly (n = 12), and Manual.
2. WHEN the user activates the Daily button, THE CompoundingPredictor SHALL set the Compounding_Frequency to 365 and recompute all curves.
3. WHEN the user activates the Weekly button, THE CompoundingPredictor SHALL set the Compounding_Frequency to 52 and recompute all curves.
4. WHEN the user activates the Monthly button, THE CompoundingPredictor SHALL set the Compounding_Frequency to 12 and recompute all curves.
5. WHEN the user activates the Manual button, THE CompoundingPredictor SHALL reveal a numeric input field that accepts a positive integer Compounding_Frequency.
6. WHILE the Manual button is active, THE CompoundingPredictor SHALL use the Manual_Rate value as the Compounding_Frequency for all calculations.
7. IF the user enters a Manual_Rate that is not a positive integer, THEN THE CompoundingPredictor SHALL display an inline validation message and revert Compounding_Frequency to the frequency that was active before Manual mode was selected (e.g., if Monthly was active prior, n reverts to 12 for calculations until a valid Manual_Rate is entered).
8. THE Frequency_Selector SHALL indicate the currently active frequency option using a visually distinct selected state that is accessible to screen readers via `aria-pressed`.

---

### Requirement 5: Deposit Input

**User Story:** As a DeFi user, I want to type my initial deposit amount, so that the chart reflects my actual planned investment.

#### Acceptance Criteria

1. THE Deposit_Input SHALL accept a numeric value representing the Principal in USD, with a minimum value of 1 and a maximum value of 10,000,000.
2. WHEN the user modifies the Deposit_Input, THE CompoundingPredictor SHALL recompute and re-render both curves without requiring a separate submit action.
3. IF the user enters a value outside the range [1, 10,000,000], THEN THE CompoundingPredictor SHALL display an inline error message and use the nearest boundary value for calculations until a valid value is entered.
4. IF the user clears the Deposit_Input field entirely, THEN THE CompoundingPredictor SHALL treat the Principal as 0 and display a flat line at zero for both curves.

---

### Requirement 6: APY Input

**User Story:** As a DeFi user, I want to set an annual percentage yield, so that I can simulate different strategy returns.

#### Acceptance Criteria

1. THE APY_Input SHALL accept a percentage value in the range [0.01, 500], representing the Annual Rate.
2. WHEN the user modifies the APY_Input, THE CompoundingPredictor SHALL recompute and re-render both curves without requiring a separate submit action.
3. THE APY_Input SHALL provide both a numeric text field and a range slider that remain synchronised — updating one SHALL update the other.
4. IF the user enters an APY value outside the range [0.01, 500], THEN THE CompoundingPredictor SHALL display an inline error message, clamp the value to the nearest boundary, and update both the numeric text field and the range slider to display the clamped boundary value.

---

### Requirement 7: Time Horizon Selector

**User Story:** As a DeFi user, I want to project growth over different time periods, so that I can evaluate long-term compounding benefits.

#### Acceptance Criteria

1. THE CompoundingPredictor SHALL provide a time horizon control that accepts integer values from 1 to 10, measured in years.
2. WHEN the user changes the time horizon, THE CompoundingPredictor SHALL recompute and re-render both curves to cover the updated period.
3. THE CompoundingPredictor SHALL display the selected time horizon in years alongside the control.

---

### Requirement 8: Net Profit Difference Display

**User Story:** As a DeFi user, I want to see the projected profit difference between compound and simple APY, so that I can quantify the compounding advantage in dollar terms.

#### Acceptance Criteria

1. THE CompoundingPredictor SHALL display the Net_Profit_Difference (Compound_Balance − Simple_Balance) at the end of the selected time horizon.
2. THE CompoundingPredictor SHALL format the Net_Profit_Difference as a USD currency value with two decimal places and a leading "+" sign.
3. WHEN the Net_Profit_Difference is zero, THE CompoundingPredictor SHALL display "$0.00" without a sign prefix. WHEN the Net_Profit_Difference is negative, THE CompoundingPredictor SHALL display it with a leading minus sign (e.g., "-$12.34").
4. THE CompoundingPredictor SHALL update the displayed Net_Profit_Difference in the same render as any input change, ensuring it is always consistent with the chart data.
5. THE CompoundingPredictor SHALL also display the final Compound_Balance and final Simple_Balance as labelled summary statistics alongside the Net_Profit_Difference.

---

### Requirement 9: Accessibility and Labelling

**User Story:** As a user relying on assistive technology, I want all interactive controls to be fully labelled and keyboard-navigable, so that I can use the predictor without a mouse.

#### Acceptance Criteria

1. THE CompoundingPredictor SHALL provide a visible text label and a matching `htmlFor`/`id` association for every input field.
2. THE Frequency_Selector SHALL be wrapped in a `role="group"` element with an `aria-label` describing its purpose.
3. THE CompoundingPredictor SHALL expose the Net_Profit_Difference summary region via `aria-live="polite"` so that screen readers announce updates when inputs change.
4. WHEN a validation error is shown for any input, THE CompoundingPredictor SHALL associate the error message with the input using `aria-describedby`.
5. THE CompoundingPredictor SHALL be fully operable using only keyboard navigation, including the Frequency_Selector toggle buttons and all sliders.

---

### Requirement 10: Default State

**User Story:** As a first-time visitor, I want the predictor to display a meaningful starting example, so that I understand what it does without having to enter any values first.

#### Acceptance Criteria

1. WHEN the CompoundingPredictor first mounts, THE CompoundingPredictor SHALL render with a default Principal of 10,000 USD, a default Annual Rate of 12 %, a default Compounding_Frequency of Monthly (n = 12), and a default Time horizon of 1 year.
2. WHEN the CompoundingPredictor first mounts, THE CompoundingPredictor SHALL display fully computed Growth_Curve and Simple_Curve data based on the default values.
3. THE CompoundingPredictor SHALL accept optional props `defaultPrincipal`, `defaultApy`, `defaultFrequency`, and `defaultYears` that override the built-in defaults.
