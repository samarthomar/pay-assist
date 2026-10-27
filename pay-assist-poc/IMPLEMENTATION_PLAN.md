# Pay Assist POC – Implementation Plan

Source of truth: Pay Assist BRD (https://claude.ai/code/artifact/58d4ea54-5341-4da9-9cc3-1570db156067)
Decisions: Claude builds · simulated AI (no API key) · Tech Mahindra theme copied from the Lactalis control tower demo · shown live on a laptop · all 7 demo scenes required.

## Technical approach

| Choice | Decision | Why |
| --- | --- | --- |
| App type | React + TypeScript web app (Vite) | Modern, fast, easy to change screen by screen |
| Delivery | Built into ONE self-contained HTML file | Opens by double-click like the Lactalis demo; no server needed on demo day |
| AI | Simulated agents: scripted reasoning steps + real deterministic logic | Predictable live demo; numbers are real calculations, not hard-coded |
| Data | Synthetic, generated from a fixed seed (same every run) | 12,457 accounts + 6 named personas |
| Theme | Lactalis palette, Georama font, TechM logo | Same family look and feel |
| Tests | Unit tests for rules engine and plan calculator | Every amount shown must be correct to the cent |

## Layout (own identity, Tech Mahindra brand)

- Brand kept: TechM logo, palette, Georama font, buttons and cards. Layout is Pay Assist's own (not a copy of the Lactalis demo).
- Header: TechM logo · Pay Assist product mark · demo clock · "Synthetic data" · Demo scenes · Audit log · "Ask the agents"  · Reset
- Journey bar (navigation): 1 Assess · 2 Engage · 3 Resolve · 4 Protect · 5 Sustain · 6 Results
- Live agent strip  on every stage: 10 agents with status + current activity; opens the Agent console (bottom sheet)
- Colours: red, white and cream only (no navy). Agent strip is white with red text.
- Stage header: large stage number, title stating the outcome, lede, "Agents at work" card

## Phases

### Phase 0 – Skeleton and theme (Week 1) ✅ Done
- Project setup, single-file build, Lactalis theme tokens, header, numbered tabs, cards, buttons, pills
- Audit log drawer (empty), Reset button, scene launcher shell
- Done when: app opens by double-click and looks like the Lactalis demo with Pay Assist titles

### Phase 1 – Data and logic core (Week 1) ✅ Done
- Synthetic data generator: 12,457 accounts (7,214 elec / 2,931 gas / 2,312 dual) + Sarah, B, C, D, E, F
- Rules engine (BR-T01..T08, BR-P01..P06, BR-C/I/M rules), each returning rule ID + reason
- Affordability scorer, plan calculator, Guardian checks, escalation matrix (ESC-01..09)
- Case store + audit log events
- Done when: tests pass, incl. Sarah = $115.67 x 26 fortnights, 15 Oct 2026 to 30 Sep 2027; B–F tagged as in BRD 6.2; no bill smoothing for Sarah

### Phase 2 – Assess (morning run) (Week 2) – Scene 1 ✅ Done
- Upload daily file (sample file included) → Intake validation summary
- Live agent run: Orchestrator → Intake → Assessment → Plan → Guardian → Engagement, step by step with tool calls
- Decision table with reason for each account, filters (state, fuel, debt band, decision), customer drill-down
- Download output file (Excel/CSV)
- Done when: Scene 1 acceptance criteria in BRD section 15 are met

### Phase 3 – Engage + Resolve (customer journey) (Week 2) – Scenes 2 and 3 ✅ Done
- Phone mock-up: SMS, email, secure link, DOB + OTP (3 attempts)
- Pay Assist chat engine (state machine): welcome → balance → paths (options / already paid / trouble paying / speak to someone)
- Empathy + situation, Guardian check, plan cards, "too high" → probing questions → recommendation, affordability slider, "not sure" re-ranking
- Mock PCI payment page, payment failure retry, confirmation, reference, feedback, confirmation email with schedule
- Limited free-text understanding (keywords) with safe fallback to buttons
- Done when: Sarah's full journey and the "already paid" path run end to end

### Phase 4 – Protect (specialist workspace) (Week 3) – Scenes 4, 5, 6 ✅ Done
- Handoff queue, case cards, Copilot suggestions and drafted notes
- Customer C ($2,640): AI-drafted plan, one-click approve / edit / reject, write-back
- Customer D (life support): never messaged, specialist queue
- Distress mid-chat: Guardian stops collections, safe wording, minimal priority case card
- Done when: Scenes 4–6 acceptance criteria are met

### Phase 5 – Agent console (available on every stage) (Week 3) ✅ Done
- Live architecture picture: which agent is working, tools called, Guardian allow/block log
- Per-customer trace: every decision, rule ID and reason
- Done when: any decision in the demo can be traced back to its rule

### Phase 6 – Sustain (Week 3) – Scene 7 part 1 ✅ Done
- Plan timeline with "fast-forward 2 weeks"
- Payday reminder, failed instalment, Sustain agent message, date moved within rules, plan stays active
- Done when: Sarah's failed payment is rescued without breaking the plan

### Phase 7 – Results + Ask the agents (Week 3) – Scene 7 part 2 ✅ Done
- 5 dashboard tabs (self-service, customer experience, AI behaviour, technical, hand-off) + Sustain KPIs + overall scorecard
- Funnel, debt ageing before/after, escalation reasons, plan mix charts in the red/pink palette
- "Ask the agents": prepared manager questions answered with numbers and a chart
- Done when: all KPI tiles show values with RAG status

### Phase 8 – Demo mode, polish, rehearsal (Week 4 buffer) ✅ Done
- Scene launcher (jump to any of the 7 scenes), Reset, presenter notes, keyboard shortcuts
- Edge cases, laptop screen sizes, offline check (font bundled), performance
- Rehearsal script and backup screen recording
- Done when: full 15-minute demo runs twice in a row without a hitch

## Week view

| Week | Phases | Show the user |
| --- | --- | --- |
| 1 | 0, 1 | Themed app shell + correct numbers |
| 2 | 2, 3 | Morning run + Sarah's journey (Gate: Sarah end to end) |
| 3 | 4, 5, 6, 7 | Specialist, agent view, sustain, dashboards (Gate: all 7 scenes) |
| 4 | 8 | Polished, rehearsed demo (Gate: sign-off) |

## Status (15 Oct 2026)
All 8 phases are complete. 49 automated tests pass. The full 7-scene demo was rehearsed twice in a row (17 of 17 checks each run, with a reset in between), with no console errors. The packaged `pay-assist-demo.html` (about 660 KB) works offline, makes no network requests and fits 1280×720 to 1920×1080 screens. Presenter script: `../DEMO_SCRIPT.md`.

Open points to confirm with AGL: BR-S01 (proposed rescue rule for failed plan payments), showing real support line numbers (1800RESPECT, Lifeline, 000), and the illustrative KPI values.
