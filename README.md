# ComplianceIQ

KYC onboarding and anti money laundering monitoring for a bank, with an investigation assistant for analysts.

Customers apply and upload documents. The platform checks the documents, screens the name against watchlists, scores risk and either approves the customer or sends the file to an officer. Once accounts are live, every transaction goes through a queue and a rule engine. Rule hits become alerts, analysts group alerts into cases, and an officer approves any suspicious transaction report before it is filed.

## Stack

- React and Vite for the dashboard
- Node.js, Express and Mongoose for the API
- Redis and BullMQ for transaction processing, velocity windows and job retries
- FastAPI service for summaries, report drafts, policy search and document reading
- MongoDB, Docker Compose and GitHub Actions

## Layout

```
server/       API, worker, models, seed and simulation scripts
ai-service/   FastAPI service and policy documents used for retrieval
client/       React dashboard
```

## Running with Docker

```
docker compose up --build
docker compose exec api node src/scripts/seed.js
cd client && npm install && npm run dev
```

The API is on http://localhost:4000, interactive docs on http://localhost:4000/docs and the dashboard on http://localhost:5173.

Set `ANTHROPIC_API_KEY` in your environment before starting to use a language model for the assistant features. Without it the AI service answers from built in templates and keyword search, so everything still runs.

## Running locally

```
cd server && cp .env.example .env && npm install
npm run seed
npm run dev
npm run worker
```

```
cd ai-service && pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

MongoDB and Redis need to be running locally.

## Demo

Seed users all share the password printed by the seed script.

| Role | Email |
| --- | --- |
| Admin | admin@complianceiq.dev |
| Officer | officer@complianceiq.dev |
| Analyst | analyst@complianceiq.dev |

With the API and worker running, `npm run simulate` in `server` creates sample accounts and sends traffic that triggers every rule. Open the alerts page to see the results.

## How it works

**Application states.** SUBMITTED, DOC_VERIFIED, SCREENED, RISK_SCORED, MANUAL_REVIEW, APPROVED, REJECTED. Moves are checked against an allowed transition table and applied with a conditional update, so two requests cannot move the same application at once.

**Screening.** Names are normalised, indexed by trigrams and compared with Jaro-Winkler, edit distance and a phonetic key. The index narrows the search to likely candidates before the expensive comparison.

**Monitoring.** `POST /api/transactions` needs an `Idempotency-Key` header, stores the transaction and queues it. The worker loads the enabled rules and evaluates each one:

- threshold: a single amount over a limit
- structuring: repeated deposits just below a limit inside a time window
- velocity: too many transactions in a sliding window held in a Redis sorted set
- dormant: a large movement after a long quiet period
- circular: a bounded depth first search over recent transfers looking for a loop that returns to the sending account

Alerts carry a severity priority and a due date. A unique index on transaction and rule prevents duplicates when a job is retried.

**AI features.** Personal data is replaced with aliases before any text leaves the API. Responses are validated against schemas, calls are retried with backoff, and generated reports stay in draft until an officer approves them. Every state change and approval is written to an append only audit collection.
