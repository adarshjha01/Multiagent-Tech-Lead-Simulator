# Architecture

## System Overview

This project implements a **two-agent runtime** in the checked-in code and workflow definition, not a three-agent runtime. The only agent nodes defined in `workflow.json` are **Scenario Generator** (`69ec62bdbe4c8f6024bc4f39`) and **Code Mentor** (`69ec62bd913abe53de549399`) (`workflow.json:3-39`). There is **no third reviewer/mentor split** in the repository files provided; the “reviewer” and “mentor” responsibilities are combined into the single **Code Mentor** agent. Because of that, the requested “3-agent pipeline” cannot be documented as an actual implementation without inventing behavior, so this file describes the real two-agent system and explicitly calls out the mismatch.

**Diagram in words of the actual implemented flow:**

1. The UI in `app/page.tsx` loads and either restores a saved scenario from `localStorage` or triggers `loadScenario()` (`app/page.tsx:149-188`, `221-270`, `272-277`).
2. `loadScenario()` calls `callAIAgent()` with the prompt _“Generate a new React/JavaScript debugging scenario with a realistic Jira ticket and broken code that the developer needs to fix.”_ and sends it to agent ID `69ec62bdbe4c8f6024bc4f39` (`app/page.tsx:237-240`).
3. The Scenario Generator returns a JSON object shaped exactly like `response_schemas/scenario_generator_response.json`: top-level `status`, `message`, `result`; nested `result.ticket_id`, `ticket_title`, `ticket_description`, `acceptance_criteria`, `difficulty`, `tags`, `broken_code`, `hint` (`response_schemas/scenario_generator_response.json:8-25`).
4. The UI stores that result in local component state and renders the ticket details and broken code in `TicketPanel`, while also preloading `broken_code` into the editor (`app/page.tsx:243-257`, `460-468`; `app/sections/TicketPanel.tsx:158-253`).
5. When the user clicks **Submit for Review**, `handleSubmit()` builds a review prompt from the current scenario plus the edited code and sends it to agent ID `69ec62bd913abe53de549399` (`app/page.tsx:279-342`, especially `302-305`).
6. The Code Mentor returns a JSON object shaped exactly like `response_schemas/code_mentor_response.json`: top-level `status`, `message`, `result`; nested `result.verdict`, `technical_score`, `summary`, `what_went_well`, `misconceptions`, `suggestions`, `corrected_code`, `learning_resources` (`response_schemas/code_mentor_response.json:8-31`).
7. The UI stores that review object in local state and displays it in `ReviewModal` (`app/page.tsx:307-329`, `519-525`; `app/sections/ReviewModal.tsx:82-242`).

### Actual workflow topology from `workflow.json`

`workflow.json` defines a fan-out graph, not a chained pipeline:

- `input_node -> scenario_generator`
- `input_node -> code_mentor`
- `scenario_generator -> output_node`
- `code_mentor -> output_node`

(`workflow.json:9-14`)

That means there is **no conditional logic** and **no explicit step-to-step agent chaining** in the workflow file itself. In practice, the UI introduces sequencing by calling Scenario Generator first and Code Mentor later from different event handlers in `app/page.tsx`.

---

## Component Communication

### What happens when a user clicks "Submit for Review"

#### 1) Which function fires

The **Submit for Review** button lives in `EditorPanel` and calls the `onSubmit` prop when clicked (`app/sections/EditorPanel.tsx:146-168`). In `app/page.tsx`, that prop is wired to `handleSubmit` (`app/page.tsx:460-468`). So the concrete function that fires is:

- `handleSubmit()` in `app/page.tsx` (`app/page.tsx:279-342`)

#### 2) Preconditions

`handleSubmit()` exits early if either of these is missing:

- `!userCode.trim()`
- `!scenario`

(`app/page.tsx:279-280`)

So a review call only happens when the user has non-empty code and there is an active scenario in state.

#### 3) Sample mode branch

If `sampleMode` is enabled, no network/agent call happens. Instead, the function waits 1.5 seconds, injects the hardcoded `SAMPLE_REVIEW`, shows the modal, updates stats, and flashes the submit button green (`app/page.tsx:282-295`). This is a local mock path.

#### 4) Live review branch

If `sampleMode` is false, `handleSubmit()`:

- sets `submittingReview = true`
- clears `error`
- sets `activeAgentId = MENTOR_AGENT_ID`

(`app/page.tsx:298-300`)

`MENTOR_AGENT_ID` is defined as `69ec62bd913abe53de549399` (`app/page.tsx:15-16`).

It then derives `criteria` by joining `scenario.acceptance_criteria` with `; ` (`app/page.tsx:302`). Next, it constructs a prompt string containing:

- ticket ID
- ticket title
- ticket description
- acceptance criteria
- the user’s submitted code

The file excerpt truncates the full template string, but the call site clearly shows the message is assembled from scenario context and then sent to the mentor agent (`app/page.tsx:303-305`).

#### 5) What data is sent to which agent ID via `callAIAgent`

`handleSubmit()` calls:

```ts
const result = await callAIAgent(message, MENTOR_AGENT_ID)
```

(`app/page.tsx:305`)

That means the data sent is:

- `message`: the review prompt string built from scenario metadata + user code
- `agent_id`: `69ec62bd913abe53de549399`

Inside `callAIAgent()` in `lib/aiAgent.ts`, this becomes a POST to `/api/agent` with JSON body:

- `message`
- `agent_id`
- `user_id` (optional, from `options?.user_id`)
- `session_id` (optional, from `options?.session_id`)
- `assets` (optional, from `options?.assets`)

(`lib/aiAgent.ts:84-101`)

In `app/page.tsx`, no options object is passed, so only `message` and `agent_id` are meaningfully populated.

#### 6) What `callAIAgent()` does exactly

`callAIAgent()` is a client-side async wrapper around `/api/agent` (`lib/aiAgent.ts:80-179`):

1. **Submit phase**: POST to `/api/agent` with `message`, `agent_id`, and optional metadata (`lib/aiAgent.ts:90-101`).
2. If no HTTP response object is returned, it returns:
   - `success: false`
   - `response.status: 'error'`
   - `response.result: {}`
   - `error: 'No response from server'`
   (`lib/aiAgent.ts:103-109`)
3. It parses `submitRes.json()` (`lib/aiAgent.ts:111`).
4. If the submit response does not include `task_id`, it returns either the submit payload as-is when `submitData.success === false`, or a synthesized error saying `No task_id in response` (`lib/aiAgent.ts:113-122`).
5. If `task_id` exists, it starts polling the same `/api/agent` endpoint with body `{ task_id }` (`lib/aiAgent.ts:124-155`).
6. Poll timing uses adaptive backoff:
   - starts at `300 * 1.5^attempt`
   - capped at `3000ms`
   - overall timeout is `5 minutes`
   (`lib/aiAgent.ts:78`, `126-133`)
7. If a poll response contains `status === 'processing'`, it keeps polling (`lib/aiAgent.ts:145-147`).
8. When a non-processing response arrives, it returns the poll payload plus `agent_id`, `user_id`, and `session_id` from submit time (`lib/aiAgent.ts:149-155`).
9. If the loop exceeds 5 minutes, it returns a timeout error (`lib/aiAgent.ts:158-167`).
10. Any thrown exception becomes a normalized network error response (`lib/aiAgent.ts:168-177`).

#### 7) What the response shape looks like

The UI expects the review response in one of two places:

- `result.response.result`
- or fallback `result.response`

(`app/page.tsx:308`)

The intended schema from `response_schemas/code_mentor_response.json` is:

Top level:
- `status: string`
- `message: string`
- `result: { ... }`

Nested result:
- `verdict: string`
- `technical_score: number`
- `summary: string`
- `what_went_well: string[]`
- `misconceptions: string[]`
- `suggestions: string[]`
- `corrected_code: string`
- `learning_resources: Array<{ title: string, topic: string }>`

(`response_schemas/code_mentor_response.json:8-31`)

`handleSubmit()` normalizes this into its local `ReviewData` state shape by defaulting missing fields to empty strings, empty arrays, or `0` (`app/page.tsx:309-319`).

#### 8) How the UI updates with the result

On success, `handleSubmit()`:

- stores normalized review data in `review`
- sets `showReview = true`
- increments `challengesCompleted`
- adds the returned score to `totalScore`
- increments `reviewCount`
- computes whether the verdict counts as “approved” and flashes the submit button green or red

(`app/page.tsx:320-329`)

The modal is rendered via:

```tsx
<ReviewModal
  visible={showReview}
  review={review}
  onClose={() => setShowReview(false)}
  onNewScenario={handleNewScenario}
/>
```

(`app/page.tsx:519-525`)

`ReviewModal` then reads:

- `review.summary`
- `review.what_went_well`
- `review.misconceptions`
- `review.suggestions`
- `review.corrected_code`
- `review.learning_resources`
- `review.technical_score`
- `review.verdict`

and displays them in dedicated sections (`app/sections/ReviewModal.tsx:87-225`).

#### 9) Where state lives

**Local `useState` state in `app/page.tsx`:**

- `scenario`
- `userCode`
- `review`
- `loadingScenario`
- `submittingReview`
- `showReview`
- `activeAgentId`
- `sampleMode`
- `error`
- `scenarioCount`
- `showAgents`
- `showWelcome`
- `mobileTicketOpen`
- `activePanel`
- `submitFlash`
- `challengesCompleted`
- `totalScore`
- `reviewCount`

(`app/page.tsx:125-145`)

**Ref state:**
- `initialLoadDone` via `useRef(false)` (`app/page.tsx:147`)

**Persisted in `localStorage`:**
- `swe_sim_welcomed`
- `swe_sim_challenges_completed`
- `swe_sim_total_score`
- `swe_sim_review_count`
- `swe_sim_user_code`
- `swe_sim_scenario`

(`app/page.tsx:154-187`, `190-219`, `352-355`)

So the review result itself is **not persisted**; it only lives in React state. The current code, current scenario, and aggregate stats are persisted locally in the browser.

---

## Agent Responsibilities

### 1) Scenario Generator

**Agent ID:** `69ec62bdbe4c8f6024bc4f39` (`workflow.json:18-27`, `app/page.tsx:15`)

**What input it expects**

In the actual UI, the Scenario Generator is called with a single plain-text prompt asking it to create a React/JavaScript debugging scenario with a realistic Jira ticket and broken code (`app/page.tsx:237-240`). No typed input contract for the prompt exists in the repository; the only formal contract present is the output schema.

**What output schema it returns**

From `response_schemas/scenario_generator_response.json`, the returned top-level shape is:

- `status: string`
- `message: string`
- `result: { ... }`

Nested `result` fields and types:

- `ticket_id: string`
- `ticket_title: string`
- `ticket_description: string`
- `acceptance_criteria: string[]`
- `difficulty: string`
- `tags: string[]`
- `broken_code: string`
- `hint: string`

(`response_schemas/scenario_generator_response.json:8-25`)

**How its output is consumed**

`loadScenario()` maps those fields into local `scenario` state, then copies `broken_code` into `userCode` so the editor is prefilled (`app/page.tsx:243-257`). `TicketPanel` consumes the scenario object to render the ticket metadata, acceptance criteria, broken code preview, and optional hint (`app/sections/TicketPanel.tsx:154-253`).

### 2) Code Mentor

**Agent ID:** `69ec62bd913abe53de549399` (`workflow.json:28-38`, `app/page.tsx:16`)

**What input it expects**

The UI builds a single review prompt string that includes the scenario’s ticket ID, title, description, acceptance criteria, and the user’s submitted code (`app/page.tsx:302-305`). Again, there is no formal input schema in the repo; the output schema is formalized.

**What output schema it returns**

From `response_schemas/code_mentor_response.json`, the returned top-level shape is:

- `status: string`
- `message: string`
- `result: { ... }`

Nested `result` fields and types:

- `verdict: string`
- `technical_score: number`
- `summary: string`
- `what_went_well: string[]`
- `misconceptions: string[]`
- `suggestions: string[]`
- `corrected_code: string`
- `learning_resources: Array<{ title: string, topic: string }>`

(`response_schemas/code_mentor_response.json:8-31`)

**How its output is consumed**

`handleSubmit()` converts that payload into local `review` state and opens `ReviewModal` (`app/page.tsx:307-321`). `ReviewModal` renders the score, verdict, summary, positives, misconceptions, suggestions, corrected code, and learning resources directly from that review object (`app/sections/ReviewModal.tsx:87-225`).

### 3) Reviewer Agent

There is **no separate Reviewer Agent implemented** in the checked-in repository.

- `workflow.json` declares only `scenario_generator` and `code_mentor` (`workflow.json:3-39`)
- `app/page.tsx` defines only `SCENARIO_AGENT_ID` and `MENTOR_AGENT_ID` (`app/page.tsx:15-21`)
- only two response schema files exist in `response_schemas/`

So if someone asks about a reviewer stage in an interview, the accurate explanation is: **the repository currently merges reviewer and mentor behavior into the single Code Mentor agent**.

---

## Data Flow Diagram (ASCII)

### Scenario generation path

```text
User opens app / clicks "New Scenario"
        |
        v
app/page.tsx::loadScenario()
        |
        | callAIAgent(message, "69ec62bdbe4c8f6024bc4f39")
        v
lib/aiAgent.ts::callAIAgent()
        |
        | POST /api/agent { message, agent_id }
        v
Server API route (/api/agent)
        |
        v
Lyzr agent platform
        |
        v
Scenario Generator agent
        |
        | returns schema from response_schemas/scenario_generator_response.json
        v
callAIAgent() polling loop resolves final payload
        |
        v
page.tsx sets scenario + userCode
        |
        v
TicketPanel + EditorPanel render scenario and broken code
```

### Review path

```text
User clicks "Submit for Review"
        |
        v
EditorPanel onSubmit prop
        |
        v
app/page.tsx::handleSubmit()
        |
        | build review prompt from scenario + userCode
        | callAIAgent(message, "69ec62bd913abe53de549399")
        v
lib/aiAgent.ts::callAIAgent()
        |
        | POST /api/agent { message, agent_id }
        v
Server API route (/api/agent)
        |
        v
Lyzr agent platform
        |
        v
Code Mentor agent
        |
        | returns schema from response_schemas/code_mentor_response.json
        v
callAIAgent() polling loop resolves final payload
        |
        v
page.tsx sets review + showReview + stats
        |
        v
ReviewModal renders verdict, score, feedback, corrected code, resources
```

---

## Models

The repository contains a `models/` directory, but these models are **not referenced anywhere in the files reviewed for the active UI flow**.

### `models/Scenario.ts`

`getScenarioModel()` initializes a Lyzr Architect model named `Scenario` using `initDB()` and `createModel()` (`models/Scenario.ts:1-23`). Its schema fields are:

- `user_id: String` (required)
- `difficulty: String` (required)
- `ticket_title: String` (required)
- `original_code: String` (required)
- `user_fix: String` (default `''`)
- `review_score: Number` (default `0`)
- `feedback_md: String` (default `''`)
- `review_data: String` (default `''`)
- `mentor_data: String` (default `''`)
- `ticket_description: String` (default `''`)
- `priority: String` (default `''`)
- `acceptance_criteria: String` (default `''`)
- `completed_at: Date`

This looks like a persistence model for storing a scenario, the user’s fix, and review output, but no live code path in `app/page.tsx` or `lib/aiAgent.ts` uses it.

### `models/Progress.ts`

`getProgressModel()` initializes a Lyzr Architect model named `Progress` (`models/Progress.ts:1-17`). Its schema fields are:

- `user_id: String` (required, unique)
- `total_completed: Number` (default `0`)
- `avg_score: Number` (default `0`)
- `easy_count: Number` (default `0`)
- `medium_count: Number` (default `0`)
- `hard_count: Number` (default `0`)
- `last_active: Date` (default `Date.now`)

This appears intended to persist user progress in a database, but the currently active UI stores stats in `localStorage` instead (`app/page.tsx:161-167`, `205-219`).

---

## Hooks

### `hooks/use-mobile.tsx`

This file exports `useIsMobile()` (`hooks/use-mobile.tsx:5-19`). It:

- tracks whether `window.innerWidth < 768`
- listens to a `matchMedia` change event
- returns a boolean mobile flag

In the reviewed files, `app/page.tsx` does **not** use this hook; mobile behavior there is implemented directly with React state (`mobileTicketOpen`) plus Tailwind responsive classes (`app/page.tsx:138`, `411-430`, `433-469`).

### `hooks/useAgent.ts`

This file exports a more feature-rich hook than the simple hooks in `lib/aiAgent.ts` (`hooks/useAgent.ts:120-257`). It is also **not used** by `app/page.tsx`.

What it does:

- wraps `callAIAgent()` from `lib/aiAgent.ts`
- chooses `agentId` from `callOptions.agentId`, `options.agentId`, or `process.env.NEXT_PUBLIC_AGENT_ID` (`hooks/useAgent.ts:126-129`)
- stores `loading`, `error`, `response`, and `lastResult` in local hook state (`hooks/useAgent.ts:121-124`)
- converts failures into an `ErrorDetails` object containing:
  - `type`
  - `message`
  - `stack?`
  - `componentStack?`
  - `raw_response?`
  - `endpoint?`
  - `timestamp`
  - `userAgent`
  - `url`
  (`hooks/useAgent.ts:24-34`, `76-88`)
- forwards errors to a parent frame if the app is running inside an iframe using helpers from `@/components/ErrorBoundary` (`hooks/useAgent.ts:17`, `161-167`, `189-194`, `216-221`)
- exposes `requestFix()` and `clearError()` helpers (`hooks/useAgent.ts:238-246`)

The same file also exports `callAgentAPI()`, a non-hook wrapper around `callAIAgent()` with the same error packaging pattern (`hooks/useAgent.ts:266-324`).

### Hooks inside `lib/aiAgent.ts`

Although your prompt called out `hooks/`, there are also two exported React hooks in `lib/aiAgent.ts` that are relevant to architecture:

#### `useAIAgent()`

- Stores `loading`, `error`, and `response` in local state (`lib/aiAgent.ts:232-265`)
- Calls `callAIAgent()` through `callAgent()` (`lib/aiAgent.ts:237-257`)
- On success, stores `result.response`
- On failure, stores both `error` and `result.response`

This hook is a light wrapper over `callAIAgent()`. It is not used in `app/page.tsx`; the page imports `callAIAgent()` directly (`app/page.tsx:4`).

#### `useFileUpload()`

- Stores `uploading`, `error`, and `result` in local state (`lib/aiAgent.ts:270-299`)
- Calls `uploadFiles()` through `upload()` (`lib/aiAgent.ts:275-291`)
- `uploadFiles()` submits a `FormData` payload to `/api/upload` (`lib/aiAgent.ts:184-227`)

This upload path is not used anywhere in the files reviewed for the main scenario/review UI.

---

## State and Function Trace for `app/page.tsx`

### State variables

`app/page.tsx` defines the following local state (`app/page.tsx:125-145`):

- `scenario: ScenarioData | null` — current generated scenario
- `userCode: string` — code in the editor
- `review: ReviewData | null` — current mentor response
- `loadingScenario: boolean` — whether scenario generation is in progress
- `submittingReview: boolean` — whether review submission is in progress
- `showReview: boolean` — whether the review modal is visible
- `activeAgentId: string | null` — currently active agent indicator
- `sampleMode: boolean` — toggle for mock mode
- `error: string` — user-visible error banner text
- `scenarioCount: number` — count of scenarios loaded/generated
- `showAgents: boolean` — whether the floating agent info panel is open
- `showWelcome: boolean` — whether welcome overlay is visible
- `mobileTicketOpen: boolean` — mobile ticket panel expand/collapse state
- `activePanel: 'ticket' | 'editor'` — which panel is visually active
- `submitFlash: 'approved' | 'rejected' | null` — temporary submit button flash state
- `challengesCompleted: number` — total completed challenge count
- `totalScore: number` — cumulative review score sum
- `reviewCount: number` — number of completed reviews

It also defines `initialLoadDone` as a ref guard used to prevent duplicate initialization (`app/page.tsx:147`).

### Local TypeScript interfaces in `page.tsx`

#### `ScenarioData` (`app/page.tsx:65-74`)

- `ticket_id?: string`
- `ticket_title?: string`
- `ticket_description?: string`
- `acceptance_criteria?: string[]`
- `difficulty?: string`
- `tags?: string[]`
- `broken_code?: string`
- `hint?: string`

This mirrors the fields returned by the Scenario Generator schema.

#### `ReviewData` (`app/page.tsx:76-85`)

- `verdict?: string`
- `technical_score?: number`
- `summary?: string`
- `what_went_well?: string[]`
- `misconceptions?: string[]`
- `suggestions?: string[]`
- `corrected_code?: string`
- `learning_resources?: Array<{ title?: string; topic?: string }>`

This mirrors the fields returned by the Code Mentor schema.

### Functions in `page.tsx`

#### `extractFileName(brokenCode?)`

Parses the generated broken code using regex and attempts to infer a React component filename from a function, variable, or class name. Falls back to `Solution.jsx` (`app/page.tsx:87-96`).

#### `loadScenario()`

Primary scenario-loading function (`app/page.tsx:221-270`).

- If `sampleMode` is enabled, it loads `SAMPLE_SCENARIO` locally (`app/page.tsx:222-229`)
- Otherwise it calls Scenario Generator via `callAIAgent()` (`app/page.tsx:231-240`)
- On success it normalizes the response into `scenario` state and copies `broken_code` into `userCode` (`app/page.tsx:242-257`)
- On failure it sets `error` (`app/page.tsx:258-265`)
- It clears the loading flag in `finally` (`app/page.tsx:267-268`)

#### Initial load effect

On first load, if `scenarioCount === 0`, it invokes `loadScenario()` (`app/page.tsx:272-277`).

#### `handleSubmit()`

Primary review submission function (`app/page.tsx:279-342`).

- exits if there is no code or no scenario (`279-280`)
- in sample mode, injects `SAMPLE_REVIEW` (`282-295`)
- otherwise builds a review prompt and sends it to Code Mentor (`298-305`)
- on success normalizes the review response into `review` state and shows the modal (`307-321`)
- updates score stats (`322-325`)
- flashes green/red depending on verdict content (`326-329`)
- on failure sets `error` (`330-338`)
- always resets `submittingReview` in `finally` (`339-340`)

#### `handleNewScenario()`

Resets modal-related state and code, then triggers `loadScenario()` (`app/page.tsx:344-350`).

#### `handleDismissWelcome()`

Closes the welcome overlay and writes `swe_sim_welcomed = 'true'` to `localStorage` (`app/page.tsx:352-355`).

### Initialization and persistence effects

#### Mount-time restore effect

On first mount, the component restores local browser state from `localStorage` (`app/page.tsx:149-188`):

- welcome state
- stats
- saved code
- saved scenario

If a saved scenario exists and there is no saved code, it seeds the editor from `parsed.broken_code` (`app/page.tsx:181-184`).

#### Persistence effects

Separate effects persist:

- `userCode` (`app/page.tsx:190-195`)
- `scenario` (`app/page.tsx:197-202`)
- `challengesCompleted` (`app/page.tsx:204-209`)
- `totalScore` (`app/page.tsx:210-214`)
- `reviewCount` (`app/page.tsx:215-219`)

---

## Exact Response Schemas

### `response_schemas/scenario_generator_response.json`

Top-level fields:

- `agent_name: string`
- `agent_id: string`
- `description: string`
- `agent_type: string`
- `accessor: string`
- `auto_generated: boolean`
- `response_schema: object`
- `example_response: object`

Within `response_schema`:

- `status: string`
- `message: string`
- `result: object`

Within `response_schema.result`:

- `ticket_id: string`
- `ticket_title: string`
- `ticket_description: string`
- `acceptance_criteria: string[]`
- `difficulty: string`
- `tags: string[]`
- `broken_code: string`
- `hint: string`

(`response_schemas/scenario_generator_response.json:1-44`)

### `response_schemas/code_mentor_response.json`

Top-level fields:

- `agent_name: string`
- `agent_id: string`
- `description: string`
- `agent_type: string`
- `accessor: string`
- `auto_generated: boolean`
- `response_schema: object`
- `example_response: object`

Within `response_schema`:

- `status: string`
- `message: string`
- `result: object`

Within `response_schema.result`:

- `verdict: string`
- `technical_score: number`
- `summary: string`
- `what_went_well: string[]`
- `misconceptions: string[]`
- `suggestions: string[]`
- `corrected_code: string`
- `learning_resources: { title: string, topic: string }[]`

(`response_schemas/code_mentor_response.json:1-58`)

---

## Known Limitations

1. **Only two agents are actually implemented.** The requested Scenario → Reviewer → Mentor pipeline does not exist in code or workflow; there is only Scenario Generator + Code Mentor (`workflow.json:3-39`, `app/page.tsx:15-21`).
2. **No conditional workflow logic in `workflow.json`.** The workflow file contains only static edges with no branching conditions, retries, guards, or chaining rules (`workflow.json:9-14`).
3. **Prompt contracts are implicit, not typed.** Output schemas are formalized, but the input prompts sent to agents are free-form strings assembled in `page.tsx` (`app/page.tsx:237-240`, `302-305`).
4. **Live persistence models exist but are unused by the main UI.** `models/Scenario.ts` and `models/Progress.ts` define DB-backed structures, but the page uses browser `localStorage` for persistence instead (`models/*.ts`; `app/page.tsx:149-219`).
5. **No authentication or user identity flow is visible.** Although models include `user_id`, `app/page.tsx` never supplies a user ID to `callAIAgent()` and does not implement auth (`models/Scenario.ts:7`, `models/Progress.ts:7`, `lib/aiAgent.ts:87`, `app/page.tsx:237-240`, `305`).
6. **Review state is transient.** The current `review` object is shown in the modal but is not persisted to storage, so refreshing after review loses the open result (`app/page.tsx:128`, `131`, `320-321`).
7. **Sample mode is hardcoded.** Both `SAMPLE_SCENARIO` and `SAMPLE_REVIEW` are static objects embedded in `app/page.tsx` (`app/page.tsx:23-63`).
8. **The UI depends on hardcoded agent IDs.** `SCENARIO_AGENT_ID` and `MENTOR_AGENT_ID` are constants inside `page.tsx`, even though `.env.example` also exposes an `AGENT_ID` variable (`app/page.tsx:15-16`, `.env.example:1-5`).
9. **No evidence of runtime use of `hooks/useAgent.ts`.** A more advanced error-aware hook exists, but the main page bypasses it and calls `callAIAgent()` directly (`hooks/useAgent.ts`, `app/page.tsx:4`).
10. **Upload support exists but is unused in the main flow.** `uploadFiles()` and `useFileUpload()` are implemented in `lib/aiAgent.ts`, but no reviewed UI component invokes them (`lib/aiAgent.ts:181-299`).
11. **Some custom UI panels referenced by `page.tsx` were not part of the requested analysis set.** `LoadingOverlay` and `WelcomeOverlay` are used (`app/page.tsx:11-13`, `472`, `528`) but their internal implementations were not required here, so their internals are intentionally not inferred.
12. **The Dockerfile assumes standalone Next.js output.** It copies `.next/standalone`, but the analyzed files did not include `next.config.js`, so this deployment assumption exists without config verification in the reviewed set (`Dockerfile:29-41`).
