# EduQuest Backend

Node.js + Express + PostgreSQL backend for the EduQuest quiz system.

## Setup

1. **PostgreSQL**: Create a database named `eduquest` and run the schema:
   ```bash
   createdb eduquest
   psql -U postgres -d eduquest -f schema.sql
   ```
   Or in `psql`: `\i schema.sql` after connecting to `eduquest`.

2. **Environment** (optional): Set `PGUSER` and `PGPASSWORD` if different from `postgres`/`postgres`.

3. **Install and run**:
   ```bash
   cd backend
   npm install
   npm start
   ```
   Server runs at `http://localhost:3000`.

## API

- `POST /api/quizzes` — Create quiz (body: `{ title, class_id?, created_by?, questions: [{ question_text, difficulty_level?, options: [{ option_text, is_correct }] }] }`).
- `GET /api/quizzes` — List all quizzes (includes `question_count`).
- `GET /api/quizzes/:id` — Get quiz with questions and options.
- `PUT /api/quizzes/:id` — Update quiz (body: `{ title?, class_id?, created_by?, questions? }`).
- `DELETE /api/quizzes/:id` — Delete quiz.
- `POST /api/attempts` — Submit attempt (body: `{ student_id, quiz_id, answers: [{ question_id, selected_option_id }] }`).

## Frontend

Open the HTML files from the project root (or a local server). They call `http://localhost:3000/api`. For create/edit/quiz list use educator pages; for taking a quiz use `student-quiz.html?id=<quiz_id>`.
