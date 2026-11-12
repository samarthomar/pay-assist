# Pay Assist

Agentic collections proof of concept (Tech Mahindra). A single-page React demo with six screens: Assess, Engage, Resolve, Protect, Sustain and Results.

All customer data is synthetic and the AI agents are simulated. The business rules, plan calculations and Guardian checks are real code. The app has no backend, no database and no API keys.

## Folder layout

| Path | What it is |
|---|---|
| `pay-assist-poc/` | The app source (Vite + React + TypeScript) |
| `pay-assist-poc/src/domain/` | Business rules, plan calculations, Guardian checks and the synthetic data generator |
| `pay-assist-poc/src/scenes/` | One file per screen |
| `pay-assist-poc/middleware.ts`, `vercel.json` | Password login, used on Vercel only |
| `pay-assist-demo.html` | Ready-built offline copy of the whole app in one file |
| `DEMO_SCRIPT.md` | Presenter script |

## Run locally

Needs Node.js 18 or later.

```bash
cd pay-assist-poc
npm install
npm run dev
```

- `npm test` runs the unit tests.
- `npm run build` builds the website into `pay-assist-poc/dist/` (a single `index.html`).
- `npm run package` builds and copies it to `pay-assist-demo.html`.

## Deploy on AWS

The build output is one static file, `dist/index.html`, with all code, styles, fonts and images inside it. Any static host works.

### Option A: AWS Amplify Hosting (simplest)

1. Build: `cd pay-assist-poc && npm ci && npm run build`.
2. Zip the contents of `pay-assist-poc/dist/` (just `index.html`).
3. In the AWS console open **Amplify → Create new app → Deploy without Git**, and upload the zip.
4. Optional password: in the app, open **Hosting → Access control** and set a username and password.

To deploy from a Git repository instead, connect the repository in Amplify and use these build settings:

- App root: `pay-assist-poc`
- Build command: `npm run build`
- Output directory: `dist`

### Option B: S3 and CloudFront

1. Build as above.
2. Upload `dist/index.html` to an S3 bucket.
3. Serve it through a CloudFront distribution, with `index.html` as the default root object.

### About the password login

`middleware.ts` only runs on Vercel and is ignored by other hosts. A normal build has no login screen. Use the host's own access control on AWS, such as Amplify access control or CloudFront with an authentication function.

## Deploy on Vercel

Import the repository, set **Root Directory** to `pay-assist-poc`, and add an environment variable `DEMO_PASSWORD`. Visitors are asked for this password on every new visit.
