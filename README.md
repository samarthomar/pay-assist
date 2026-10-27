# Pay Assist

Agentic collections proof of concept (Tech Mahindra). A single-page React demo with six screens: Assess, Engage, Resolve, Protect, Sustain and Results.

All customer data is synthetic and the AI agents are simulated. The business rules, plan calculations and Guardian checks are real code.

## Run locally

```bash
cd pay-assist-poc
npm install
npm run dev
```

- `npm test` runs the unit tests.
- `npm run package` builds one offline file, `pay-assist-demo.html`.

## Deploy

Import this repository in Vercel and set **Root Directory** to `pay-assist-poc`. The build settings are in `pay-assist-poc/vercel.json`.

See `DEMO_SCRIPT.md` for the presenter script.
