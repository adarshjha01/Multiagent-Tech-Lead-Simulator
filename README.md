# Multiagent Tech Lead Simulator

A browser-based software engineering practice tool that simulates real-world debugging workflows — generating realistic Jira-style tickets with broken React/JavaScript code, then reviewing your fix with AI-powered senior engineer feedback.

---

## Problem Statement

Junior and mid-level engineers rarely get structured, low-stakes environments to practice debugging under realistic conditions. Code challenges on LeetCode don't reflect actual day-to-day work, and PR reviews from senior engineers are asynchronous and limited by their availability. This simulator fills that gap by generating lifelike bug tickets (complete with acceptance criteria, difficulty ratings, and code context) and providing instant, structured mentor-quality feedback on submitted fixes — all without waiting for a human reviewer.

---

## Key Features

- **AI-Generated Debugging Scenarios** — The Scenario Generator agent (GPT-4.1) produces realistic Jira-style tickets with a ticket ID, title, description, acceptance criteria, difficulty level, technology tags, broken React/JavaScript code, and an optional hint.
- **In-Browser Code Editor** — A textarea-based editor with synchronized line numbers, Tab-key indent support, a basic auto-format utility, and a VSCode-inspired dark theme.
- **Syntax-Highlighted Code Preview** — The ticket panel renders the broken code with a custom Monokai-style tokenizer (keywords, strings, numbers, React hooks, comments) — no external syntax library required.
- **AI Code Review** — The Code Mentor agent (GPT-4.1) scores submissions on a 0–10 scale and returns a structured verdict (APPROVED / needs work), summary, what went well, misconceptions, improvement suggestions, a corrected code sample, and curated learning resources.
- **Review Modal** — Results are displayed in a blurred-overlay modal with colour-coded score, verdict badge, collapsible corrected code block with syntax highlighting, and a learning resources list.
- **Session Stats** — Tracks challenges completed, total score, and average grade across the session; all stats are persisted to `localStorage`.
- **Sample Data Mode** — A toggle switch bypasses live agent calls and uses hardcoded sample scenario/review data for instant offline demos.
- **Agent Status Indicator** — The status bar shows which AI agent is currently active (Scenario Generator or Code Mentor) with a live green indicator dot.
- **Responsive Layout** — Split-panel desktop layout (40% ticket / 60% editor); on mobile the ticket panel is collapsible via a dedicated toggle bar.
- **Persistent State** — Current scenario, user code, and session stats survive page refreshes via `localStorage`.
- **Welcome Overlay** — A one-time onboarding screen shown on first visit; dismissed state is stored in `localStorage`.
- **Error Boundary** — A React class-based `ErrorBoundary` catches rendering errors and displays a recovery UI.

---

## Tech Stack

| Category | Library / Framework | Version |
|---|---|---|
| Framework | Next.js | 14.2.23 |
| UI Runtime | React / React DOM | ^18.3.1 |
| Language | TypeScript | ^5.6.2 |
| Styling | Tailwind CSS | ^3.4.11 |
| Tailwind plugins | tailwindcss-animate, tailwind-merge | latest |
| Component variants | class-variance-authority | ^0.7.1 |
| Utility | clsx | ^2.1.1 |
| UI Components | Radix UI (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, popover, select, tabs, toggle, tooltip, …) | various |
| Charts | Recharts | ^2.15.4 |
| Icons | react-icons | ^5.3.0 |
| Forms | react-hook-form + @hookform/resolvers | ^7.71.1 / ^3.10.0 |
| Validation | Zod | ^3.25.76 |
| Toasts | Sonner | ^1.7.4 |
| Carousel | embla-carousel-react | ^8.6.0 |
| Drawer | Vaul | ^0.9.9 |
| Date picker | react-day-picker + date-fns | ^9.13.0 / ^3.6.0 |
| Table | @tanstack/react-table | ^8.20.5 |
| Command palette | cmdk | ^1.1.1 |
| Resizable panels | react-resizable-panels | ^4.5.3 |
| OTP input | input-otp | ^1.4.2 |
| Theming | next-themes | ^0.4.6 |
| AI Agent SDK | lyzr-architect | latest |
| Deployment (Netlify) | @netlify/plugin-nextjs | ^5.15.8 |

---

## Architecture Overview

The application is a Next.js 14 App Router project with a strict client/server split: all AI calls originate from browser components but are proxied through a pre-built `/api/agent` server route (provided by `lyzr-architect`) which holds the `LYZR_API_KEY` securely. The workflow is a **fan-out** pattern — both agents receive user input independently and write directly to the output rather than chaining through each other.

```
User Input
    │
    ├──► Scenario Generator Agent (GPT-4.1, temp 0.85)
    │         role: "Senior Software Engineer and Technical Interviewer"
    │         output: ticket_id, ticket_title, ticket_description,
    │                 acceptance_criteria[], difficulty, tags[],
    │                 broken_code, hint
    │
    └──► Code Mentor Agent (GPT-4.1, temp 0.40)
              role: "Senior Staff Engineer and Technical Mentor"
              output: verdict, technical_score, summary,
                      what_went_well[], misconceptions[],
                      suggestions[], corrected_code,
                      learning_resources[]
```

Agent calls are **asynchronous with client-side polling**: `callAIAgent()` in `lib/aiAgent.ts` first POSTs to `/api/agent` to submit a task (receiving a `task_id`), then polls the same endpoint with adaptive exponential backoff (starting at 300 ms, capped at 3 s) until the task completes or a 5-minute timeout is reached.

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- A [Lyzr](https://www.lyzr.ai/) account with an API key and the two pre-configured agent IDs (already embedded in the source)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/adarshjha01/Multiagent-Tech-Lead-Simulator.git
cd Multiagent-Tech-Lead-Simulator

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local and set:
#   LYZR_API_KEY=your-lyzr-api-key-here
#   AGENT_ID=your-agent-id-here   (optional — agent IDs are also hardcoded in the source)

# 4. Start the development server (runs on port 3333)
npm run dev
```

Open [http://localhost:3333](http://localhost:3333) in your browser.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LYZR_API_KEY` | ✅ Yes | API key for authenticating requests to the Lyzr agent platform |
| `AGENT_ID` | Optional | Default agent ID; the app also uses hardcoded agent IDs per role |

---

## How It Works

1. **Scenario Generation** — On first load (or when "New Scenario" is clicked), the app calls the **Scenario Generator** agent with a prompt requesting a React/JavaScript debugging challenge. The agent returns a structured JSON object containing a Jira-style ticket, acceptance criteria, broken code, difficulty rating, and an optional hint — all rendered in the left-side ticket panel.

2. **Editing** — The broken code is pre-loaded into the right-side editor. The developer reads the ticket, understands the bug, and writes their fix directly in the browser editor. Tab indentation, a basic formatter, and line-number sync are supported natively.

3. **Code Review** — When the developer clicks "Submit for Review", the app sends the ticket context (ID, title, description, acceptance criteria) along with the user's code to the **Code Mentor** agent. The agent returns a structured JSON review with a 0–10 technical score, a APPROVED/needs-work verdict, detailed feedback, a corrected code example, and recommended learning resources.

4. **Results & Loop** — The review is displayed in a full-screen modal with colour-coded feedback sections. Session stats (challenges completed, average grade) are updated in `localStorage`. The developer can then close the modal and click "Tackle New Scenario" to start the loop again.

---

## Deployment Notes

### Netlify

The repository includes a `netlify.toml` configured for zero-configuration deployment using the official Next.js plugin:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Push to any Netlify-connected branch and set `LYZR_API_KEY` in the Netlify environment variables dashboard.

### Docker

A multi-stage `Dockerfile` is included for self-hosted deployments:

```bash
# Build the image
docker build -t swe-simulator .

# Run the container (pass your API key at runtime)
docker run -p 3333:3333 -e LYZR_API_KEY=your-key swe-simulator
```

The production image uses **Node 20 Alpine**, runs as a non-root `nextjs` user, leverages Next.js standalone output, and exposes port **3333**.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack on port 3333 |
| `npm run build` | Create production build |
| `npm run start` | Start production server on port 3333 |
| `npm run lint` | Run ESLint |
