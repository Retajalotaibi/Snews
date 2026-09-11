---
name: Market data rate limits
description: Provider limits that affect live MarketLens data refreshes.
---

Alpha Vantage's free tier enforces a one-request-per-second burst limit and a low daily quota.

**Why:** Concurrent quote requests caused real upstream failures during the first live preview.

**How to apply:** Keep Alpha Vantage calls serialized and cached server-side; never solve provider failures by substituting invented values.