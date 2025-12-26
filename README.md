# Peace Market — Backend

This repository contains the Node.js / Express backend for the Peace Market application.

Contents
- API server (Express)
- MongoDB models (Mongoose)
- Admin and User routes
- Features added in this branch: 7-Day Challenge, Admin-created Tasks with auto-complete and analytics

---

Getting started

Prerequisites
- Node.js 18+ (LTS recommended)
- MongoDB reachable via connection string

Install

```bash
cd backend
npm install
```

Environment
Create a `.env` file in the `backend` folder (or set environment variables in your runtime). Common env vars used by the project:

- `MONGO_URI` — MongoDB connection string
- `PORT` — server port (default 5000)
- `NODE_ENV` — `development` or `production`
- `JWT_SECRET` — JSON Web Token secret
- Mailer and payment credentials as required by your deployment (see existing config usage in controllers)

Run

```bash
# development (with nodemon if installed)
npm run dev

# production
npm start
```

Server will mount routes under `/api` (see Routes section below).

---

New features (implemented)

1) 7-Day Challenge
- Users with an active subscription can claim daily challenge points for 7 days.
- Points per day: [25, 50, 75, 100, 125, 150, 200].
- Rules:
	- If user misses more than 48 hours between claims, the challenge resets to day 1.
	- Claims must be at least 24 hours apart.
	- After each successful claim the user's `pointsBalance` is incremented immediately.
	- Claims are logged to `ChallengeEvent` for analytics.

Endpoints (user)
- `GET /api/users/challenge/status` — returns `currentDay`, `pointsToday`, `lastClaimedAt`, `eligible`, and timing info.
- `POST /api/users/challenge/claim` — claim today's challenge points (requires auth + active subscription).

Data model
- `User.challenge` — stores `currentDay`, `lastClaimedAt`, `isActive`, `completedDays[]`, `totalChallengePoints`.
- `ChallengeEvent` — stores `user`, `day`, `points`, and `createdAt` for analytics.

2) Admin-created Tasks (Auto-complete)
- Admins can create tasks that are shown to subscribed users.
- Users can auto-complete tasks (tap 'done') and are awarded points immediately.
- Tasks are one-time per user (unique constraint). Tasks can have expiry dates and be deactivated by admin.

User endpoints (tasks)
- `GET /api/users/tasks` — list active tasks for the authenticated subscribed user, includes `completed` flag and `completedAt`.
- `POST /api/users/tasks/:id/complete` — complete a task (auto-complete) and immediately credit `pointsBalance`.
- `GET /api/users/tasks/submissions` — list user's completed tasks.

Admin endpoints (tasks & analytics)
- `POST /api/admin/tasks` — create a task (admin only)
- `PUT /api/admin/tasks/:id` — update task
- `DELETE /api/admin/tasks/:id` — delete task
- `GET /api/admin/tasks` — list tasks
- `GET /api/admin/analytics/tasks-summary` — aggregated tasks analytics (total tasks, active tasks, total submissions, total points awarded, top tasks)

Data model
- `Task` — fields: `title`, `description`, `platform`, `actionUrl`, `points`, `expiryDate`, `isActive`, `repeatable`, `maxPerUser`, `createdBy`.
- `TaskSubmission` — stores `task`, `user`, `pointsAwarded`, `completedAt`. Unique index `{ task, user }` enforces one-time completion.

---

Admin analytics (challenge + tasks)
- Challenge analytics endpoints available under admin:
	- `GET /api/admin/analytics/subscriptions-count`
	- `GET /api/admin/analytics/challenge-summary`
	- `GET /api/admin/analytics/tasks-summary` (top tasks, totals)

These endpoints aggregate data from `ChallengeEvent` and `TaskSubmission` collections.

---

Database migrations / initialization

- `scripts/init-challenge.js` — initializes `challenge` fields for existing users. Run once after deploying the schema change:

```bash
node scripts/init-challenge.js
```

Notes: there is currently no seed script for tasks; you can create tasks via the admin API.

---

Cron jobs

- `src/utils/cronJobs.js` contains a function `setupChallengeAggregateCron` that will compute daily aggregates for `ChallengeEvent` (not enabled automatically). To enable scheduled daily aggregation, call `setupChallengeAggregateCron()` from startup (e.g., in `server.js` or `src/config/Db.js`) after the DB connection is ready.

---

Testing

- Unit/integration tests use `jest` + `supertest` (configured in `package.json`). Run tests with:

```bash
npm test
```

Add tests under a `__tests__` or `tests` folder and use test MongoDB or an in-memory Mongo for isolation.

---

Implementation notes & recommendations

- Time handling: dates are stored in UTC; business rules (24/48 hours) are computed server-side in UTC.
- Concurrency: claim and task-complete flows use atomic operations/transactions to prevent double-award.
- Analytics: `ChallengeEvent` and `TaskSubmission` are indexed for fast aggregation. Consider nightly aggregation persistence if the data grows.

---

Contributing

- Create a feature branch and open a pull request against `main`.
- Include tests for new endpoints and functionality.

---

If you want, I can:
- add unit tests for the challenge and task flows,
- enable the daily aggregate cron on startup,
- create a small admin seed script to add example tasks.

---

Contact

Maintainers: see repository owner information.


## 7-Day Challenge API

Endpoints:

- `GET /api/user/challenge/status` (auth) — returns current day, points for today, eligibility
- `POST /api/user/challenge/claim` (auth) — claim today's points (subscription required)

Admin analytics:

- `GET /api/admin/analytics/subscriptions-count` (admin) — count of subscribed users
- `GET /api/admin/analytics/challenge-summary` (admin) — aggregated challenge stats and daily claims

Scripts:

- `node scripts/init-challenge.js` — initialize challenge fields for existing users
