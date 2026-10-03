# Fee Savings Widget - Usage Examples

## 📚 Real-World Implementation Examples

### Example 1: Basic Integration in Remittance Flow

```tsx
// src/app/remittance/page.tsx

import { FeeSavingsWidget } from "@/components/remittance";

export default function RemittancePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Send Money Globally</h1>
        <p className="text-neutral-400">
          Fast, transparent, and affordable remittances powered by Stellar
        </p>
      </div>

      {/* Fee Savings Widget */}
      <FeeSavingsWidget className="mb-12" />

      {/* Rest of remittance form... */}
    </div>
  );
}
```

### Example 2: Landing Page Hero Section

```tsx
// src/app/page.tsx

import { FeeSavingsWidget } from "@/components/remittance";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-b from-neutral-950 to-neutral-900 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">
              Save Up to 90% on Transfer Fees
            </h1>
            <p className="text-xl text-neutral-300">
              See your savings in real-time. No hidden fees, no surprises.
            </p>
          </div>

          {/* Interactive Calculator */}
          <FeeSavingsWidget defaultAmount={500} className="max-w-6xl mx-auto" />

          <div className="text-center mt-8">
            <Link
              href="/remittance"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-colors"
            >
              Start Saving Now
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
```

### Example 3: Embedded in Dashboard

```tsx
// src/app/dashboard/page.tsx

import { FeeSavingsWidget } from "@/components/remittance";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Account Overview */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-xl font-bold mb-4">Account Overview</h2>
        {/* Account stats... */}
      </div>

      {/* Fee Savings Widget - Compact View */}
      <FeeSavingsWidget 
        defaultAmount={200} 
        className="md:col-span-1"
      />

      {/* Recent Transactions */}
      <div className="md:col-span-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-xl font-bold mb-4">Recent Transfers</h2>
        {/* Transaction list... */}
      </div>
    </div>
  );
}
```

### Example 4: Modal/Dialog Integration

```tsx
// src/components/modals/SavingsCalculatorModal.tsx

"use client";

import { useState } from "react";
import { FeeSavingsWidget } from "@/components/remittance";
import { X } from "lucide-react";

export default function SavingsCalculatorModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Calculate Your Savings
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-auto rounded-2xl bg-neutral-900 p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Widget */}
            <FeeSavingsWidget defaultAmount={750} />
          </div>
        </div>
      )}
    </>
  );
}
```

### Example 5: A/B Testing Variants

```tsx
// src/app/marketing/compare/page.tsx

"use client";

import { FeeSavingsWidget } from "@/components/remittance";
import { useEffect, useState } from "react";

export default function ComparePage() {
  const [variant, setVariant] = useState<"compact" | "detailed">("detailed");

  useEffect(() => {
    // A/B test logic
    const isVariantA = Math.random() < 0.5;
    setVariant(isVariantA ? "compact" : "detailed");

    // Track variant
    if (typeof window !== "undefined" && window.analytics) {
      window.analytics.track("Savings Widget Viewed", {
        variant: isVariantA ? "A" : "B",
      });
    }
  }, []);

  if (variant === "compact") {
    // Variant A: Compact with preset amounts
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8 text-center">
          How Much Can You Save?
        </h1>
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <FeeSavingsWidget defaultAmount={100} />
          <FeeSavingsWidget defaultAmount={500} />
          <FeeSavingsWidget defaultAmount={1000} />
        </div>
      </div>
    );
  }

  // Variant B: Single detailed widget
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Interactive Savings Calculator
      </h1>
      <FeeSavingsWidget defaultAmount={500} className="max-w-6xl mx-auto" />
    </div>
  );
}
```

### Example 6: Blog Post Integration

```tsx
// src/app/blog/remittance-fees-explained/page.tsx

import { FeeSavingsWidget } from "@/components/remittance";

export default function BlogPost() {
  return (
    <article className="prose prose-invert mx-auto max-w-4xl px-4 py-12">
      <h1>Understanding Remittance Fees: A Complete Guide</h1>
      
      <p>
        When sending money internationally, understanding the true cost of your
        transfer is crucial. Many providers advertise low fees but hide costs
        in exchange rate markups...
      </p>

      <h2>Compare Costs in Real-Time</h2>
      <p>
        Use our interactive calculator to see exactly how much you can save
        with StellarFlow:
      </p>

      {/* Widget embedded in content */}
      <div className="not-prose my-8">
        <FeeSavingsWidget defaultAmount={300} />
      </div>

      <h2>Breaking Down the Costs</h2>
      <p>
        As you can see from the calculator above, traditional money transfer
        operators charge fees in three ways...
      </p>
    </article>
  );
}
```

### Example 7: Comparison Page with Multiple Scenarios

```tsx
// src/app/compare/scenarios/page.tsx

import { FeeSavingsWidget } from "@/components/remittance";

const SCENARIOS = [
  { name: "Student Support", amount: 200, description: "Monthly support for education" },
  { name: "Family Support", amount: 500, description: "Regular family remittance" },
  { name: "Business Payment", amount: 2000, description: "Contractor or supplier payment" },
  { name: "Emergency Transfer", amount: 1000, description: "Urgent family emergency" },
];

export default function ScenariosPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Real-World Savings Scenarios</h1>
        <p className="text-xl text-neutral-400">
          See how much you save in common remittance situations
        </p>
      </div>

      <div className="space-y-16">
        {SCENARIOS.map((scenario) => (
          <div key={scenario.name}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{scenario.name}</h2>
              <p className="text-neutral-400">{scenario.description}</p>
            </div>
            <FeeSavingsWidget defaultAmount={scenario.amount} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 8: Integration with Form Wizard

```tsx
// src/app/send/wizard/step2-preview.tsx

"use client";

import { useState } from "react";
import { FeeSavingsWidget } from "@/components/remittance";

interface PreviewStepProps {
  amount: number;
  currency: string;
  onConfirm: () => void;
  onBack: () => void;
}

export default function PreviewStep({
  amount,
  currency,
  onConfirm,
  onBack,
}: PreviewStepProps) {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Review Your Transfer</h2>

      {/* Transfer Summary */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-neutral-400">You send:</span>
          <span className="font-bold text-xl">${amount} USD</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-neutral-400">Fee:</span>
          <span className="font-bold text-emerald-400">$0.50</span>
        </div>
        <div className="flex justify-between border-t border-neutral-800 pt-2 mt-2">
          <span className="text-neutral-400">Recipient gets:</span>
          <span className="font-bold text-xl">~{amount * 1487} {currency}</span>
        </div>
      </div>

      {/* Show Comparison Toggle */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="mb-6 text-blue-400 hover:text-blue-300 underline"
      >
        {showComparison ? "Hide" : "Show"} fee comparison with other providers
      </button>

      {/* Conditional Widget Display */}
      {showComparison && (
        <div className="mb-6">
          <FeeSavingsWidget defaultAmount={amount} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-6 py-3 font-medium text-neutral-200 hover:bg-neutral-700"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700"
        >
          Confirm Transfer
        </button>
      </div>
    </div>
  );
}
```

### Example 9: Email Marketing Template

```tsx
// src/app/api/email/savings-newsletter/route.ts

import { FeeSavingsWidget } from "@/components/remittance";
import { renderToStaticMarkup } from "react-dom/server";

export async function POST(request: Request) {
  const { userEmail, amount = 500 } = await request.json();

  // Render widget to HTML for email
  const widgetHtml = renderToStaticMarkup(
    <FeeSavingsWidget defaultAmount={amount} />
  );

  // Email template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          /* Email-safe CSS */
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>See How Much You Could Save!</h1>
          <p>Hi there,</p>
          <p>
            Did you know you could be saving hundreds of dollars per year on
            your remittance transfers? Check out your potential savings:
          </p>
          ${widgetHtml}
          <p>
            <a href="https://stellarflow.com/remittance">
              Start Saving Today →
            </a>
          </p>
        </div>
      </body>
    </html>
  `;

  // Send email (pseudo-code)
  // await sendEmail(userEmail, "Your Remittance Savings", emailHtml);

  return Response.json({ success: true });
}
```

### Example 10: Analytics Integration

```tsx
// src/components/analytics/TrackedFeeSavingsWidget.tsx

"use client";

import { FeeSavingsWidget } from "@/components/remittance";
import { useEffect, useState } from "react";

interface TrackedWidgetProps {
  defaultAmount?: number;
  campaignId?: string;
  source?: string;
}

export default function TrackedFeeSavingsWidget({
  defaultAmount = 500,
  campaignId,
  source,
}: TrackedWidgetProps) {
  const [interactionCount, setInteractionCount] = useState(0);

  useEffect(() => {
    // Track widget view
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "view_savings_widget", {
        campaign_id: campaignId,
        source: source,
        default_amount: defaultAmount,
      });
    }
  }, [campaignId, source, defaultAmount]);

  const handleInteraction = () => {
    setInteractionCount((prev) => prev + 1);

    // Track interaction
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "interact_savings_widget", {
        campaign_id: campaignId,
        source: source,
        interaction_count: interactionCount + 1,
      });
    }
  };

  return (
    <div onClick={handleInteraction}>
      <FeeSavingsWidget defaultAmount={defaultAmount} />
    </div>
  );
}

// Usage:
// <TrackedFeeSavingsWidget 
//   defaultAmount={500}
//   campaignId="summer-2026"
//   source="facebook-ad"
// />
```

## 🎯 Selecting the Right Example

| Use Case | Example | Best For |
|----------|---------|----------|
| **Main remittance page** | Example 1 | Core feature integration |
| **Homepage/Landing** | Example 2 | Marketing and conversions |
| **User dashboard** | Example 3 | Embedded functionality |
| **Interactive popup** | Example 4 | Non-intrusive education |
| **A/B testing** | Example 5 | Optimization experiments |
| **Content marketing** | Example 6 | Educational blog posts |
| **Scenario planning** | Example 7 | Detailed comparisons |
| **Transaction flow** | Example 8 | Pre-confirmation context |
| **Email campaigns** | Example 9 | Outreach and retention |
| **Performance tracking** | Example 10 | Analytics and insights |

## 💡 Pro Tips

### Tip 1: Preset Amount Strategy
Set `defaultAmount` based on user context:
```tsx
// For students
<FeeSavingsWidget defaultAmount={200} />

// For families
<FeeSavingsWidget defaultAmount={500} />

// For businesses
<FeeSavingsWidget defaultAmount={2000} />
```

### Tip 2: Context-Aware Currency
If you know user's location or destination:
```tsx
const getUserCurrency = (location: string): FxCurrencyCode => {
  const mapping: Record<string, FxCurrencyCode> = {
    "NG": "NGN",
    "BR": "BRL",
    "KE": "KES",
    "EU": "EUR",
  };
  return mapping[location] || "NGN";
};
```

### Tip 3: Progressive Enhancement
Show a simple version first, then load the full widget:
```tsx
"use client";

import dynamic from "next/dynamic";

const FeeSavingsWidget = dynamic(
  () => import("@/components/remittance/FeeSavingsWidget"),
  {
    loading: () => <WidgetSkeleton />,
    ssr: false, // Only load on client if needed
  }
);
```

### Tip 4: Mobile Optimization
Adjust for mobile viewports:
```tsx
"use client";

import { FeeSavingsWidget } from "@/components/remittance";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function ResponsiveWidget() {
  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <FeeSavingsWidget 
      defaultAmount={isMobile ? 200 : 500}
      className={isMobile ? "text-sm" : ""}
    />
  );
}
```

### Tip 5: Conversion Tracking
Track when users export or interact:
```tsx
// Wrap exports with tracking
const handleExport = (type: "csv" | "receipt") => {
  // Track event
  analytics.track("Exported Savings", { type, amount: sendAmount });
  
  // Call original export function
  if (type === "csv") {
    exportBreakdown();
  } else {
    exportReceipt();
  }
};
```

## 📱 Responsive Examples

### Desktop Layout (>1024px)
- Full 6-column savings projections
- Side-by-side provider cards (2x2 grid)
- Prominent export buttons
- Detailed disclaimer text

### Tablet Layout (768px - 1024px)
- 3-column savings projections
- 2-column provider cards
- Compact export buttons
- Condensed disclaimer

### Mobile Layout (<768px)
- Stacked savings projections (1-2 columns)
- Single-column provider cards
- Icon-only exports (space-saving)
- Scrollable content with sticky header

## 🔗 Related Components

Combine with other remittance components:

```tsx
import {
  FeeSavingsWidget,
  FxRateTicker,
  FxComparisonTable,
  RateLockCountdown,
} from "@/components/remittance";

export default function ComprehensiveRemittancePage() {
  return (
    <div>
      {/* Live rates at top */}
      <FxRateTicker />

      {/* Interactive calculator */}
      <FeeSavingsWidget className="my-8" />

      {/* Detailed comparison table */}
      <FxComparisonTable className="my-8" />

      {/* Rate expiry countdown */}
      <RateLockCountdown expiresAt={new Date(Date.now() + 300000)} />
    </div>
  );
}
```

---

**Need more examples?** Check the [Full Documentation](./docs/FEE_SAVINGS_WIDGET.md) or [Quick Start Guide](./FEE_SAVINGS_WIDGET_QUICK_START.md)!
