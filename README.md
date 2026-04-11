# NewsHub

NewsHub is a full-stack civic news and election platform with authentication, location-aware news feeds, voting flow screens, and an admin dashboard.

The repository is organized using a vertical slicing approach:

- Backend uses a modular monolith with feature-first packages.
- Frontend uses feature-first folders under src/features.

## Core Features

- User authentication with Supabase (register, login, confirmed email flow)
- Profile management (account details and session actions)
- Location-aware news feed and article details
- Election browsing, candidate pages, vote verification, and vote flow screens
- Admin area with dashboard and management views for verifications, elections, candidates, and news

## Architecture Overview

### Backend (Spring Boot)

Feature-first package structure:

- backend/src/main/java/com/newshub/backend/news/api
- backend/src/main/java/com/newshub/backend/news/application
- backend/src/main/java/com/newshub/backend/news/domain
- backend/src/main/java/com/newshub/backend/news/infrastructure
- backend/src/main/java/com/newshub/backend/news/bootstrap
- backend/src/main/java/com/newshub/backend/platform/config

This keeps API, business logic, persistence, and bootstrapping grouped by feature instead of spreading classes by global technical folders.

### Frontend (React)

Feature-first structure under src/features:

- frontend/src/features/auth
- frontend/src/features/news
- frontend/src/features/elections
- frontend/src/features/profile
- frontend/src/features/admin
- frontend/src/features/shared

Each feature owns its screens, hooks, services, and local components where applicable.

## Tech Stack

### Frontend

- React 19
- React Router 6
- React Hook Form + Zod
- Supabase JS client
- Tailwind CSS

### Backend

- Java 17+
- Spring Boot 4 (Web MVC, Data JPA)
- PostgreSQL
- Jsoup

## Repository Structure

- backend: Spring Boot API and business modules
- frontend: React application

## Prerequisites

- Java 17 or newer
- Node.js 18 or newer
- npm
- PostgreSQL (or Supabase Postgres)

## Environment Configuration

### Frontend

Create frontend/.env with:

- REACT_APP_SUPABASE_URL=your_supabase_project_url
- REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

### Backend

Backend configuration is read from backend/src/main/resources/application.properties.

Recommended for team/project submission use:

- Do not commit real database credentials.
- Prefer environment variable placeholders in application.properties for datasource values.

## How To Run

### 1) Run Backend

Windows:

- cd backend
- .\mvnw.cmd spring-boot:run

Mac/Linux:

- cd backend
- ./mvnw spring-boot:run

Default API base URL:

- http://localhost:8080

### 2) Run Frontend

- cd frontend
- npm install
- npm start

Default app URL:

- http://localhost:3000

If port 3000 is in use, React will offer the next available port (for example 3001).

## Testing And Validation

### Backend tests

Windows:

- cd backend
- .\mvnw.cmd test

Mac/Linux:

- cd backend
- ./mvnw test

### Frontend tests

- cd frontend
- npm test -- --watchAll=false

### Frontend production build

- cd frontend
- npm run build

## Main API Endpoints

- GET /api/news
- GET /api/news/content?url=<article_url>

## Notes For Deployment

- Frontend uses BrowserRouter, so production hosting should rewrite unknown routes to index.html.
- Configure CORS origins in backend platform config for your deployed frontend domain.

## Contribution Workflow

- Create a feature branch
- Commit with clear messages
- Pull latest main before opening pull request
- Run tests/build before submitting
