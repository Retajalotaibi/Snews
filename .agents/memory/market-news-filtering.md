---
name: Market news filtering
description: Rules for keeping MarketLens news focused on real financial-market catalysts.
---

NewsAPI search terms can match retail, lifestyle, and commerce headlines through words such as “shipping” or substring collisions such as “war” in “Walmart.”

**Why:** Broad queries and unbounded keyword regexes allowed irrelevant product listings into the News Desk.

**How to apply:** Search headline fields, require a whole-word market or geopolitical catalyst, use explicit relevance exclusions for retail/lifestyle/celebrity content, and attach an asset-level score only when a rule explains the transmission mechanism.