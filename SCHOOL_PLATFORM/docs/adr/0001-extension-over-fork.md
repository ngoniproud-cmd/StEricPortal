# ADR 0001: Extend Canvas instead of deep-forking it

**Status:** Accepted for baseline

**Decision:** Keep upstream Canvas pinned and minimally modified. Branding uses supported themes; administration lives in School Core; embedded learning features use LTI 1.3; synchronisation uses SIS/REST/events.

**Why:** A deep React/Rails fork gives short-term UI freedom but makes security upgrades, schema changes and upstream testing progressively expensive. The separate boundary also prevents finance/guardians from inheriting Canvas permission semantics.

**Consequence:** Some Canvas-native screens remain recognisably Canvas. Any proposed core patch needs an owner, upgrade-cost estimate and evidence that supported extension points cannot meet the need.
