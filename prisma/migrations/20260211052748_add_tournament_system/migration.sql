-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secondme_user_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" DATETIME NOT NULL,
    "mbti" TEXT,
    "intent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "agent_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "mbti" TEXT NOT NULL,
    "traits" JSONB,
    "intent" TEXT,
    "prompt_persona" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "candidate_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "current_phase" TEXT,
    "winner_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    CONSTRAINT "tournaments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tournament_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournament_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rank" INTEGER,
    "total_score" REAL,
    "eliminated_at_phase" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_candidates_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tournament_candidates_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "simulation_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_a_id" TEXT NOT NULL,
    "agent_b_id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "candidate_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "overall_score" REAL,
    "matched" BOOLEAN,
    "terminate_reason" TEXT,
    "started_at" DATETIME,
    "finished_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "simulation_sessions_agent_a_id_fkey" FOREIGN KEY ("agent_a_id") REFERENCES "agent_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "simulation_sessions_agent_b_id_fkey" FOREIGN KEY ("agent_b_id") REFERENCES "agent_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "simulation_sessions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "simulation_sessions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "tournament_candidates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "simulation_rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "score_reason" TEXT,
    "score_detail" JSONB,
    "round_count" INTEGER NOT NULL DEFAULT 3,
    "result" TEXT NOT NULL DEFAULT 'PASS',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_rounds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "simulation_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "round_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "round_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "round_messages_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "simulation_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "compatibility_score" REAL NOT NULL,
    "highlights" JSONB,
    "recommendation" TEXT,
    "dimension_scores" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "simulation_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_reports_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_secondme_user_id_key" ON "users"("secondme_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_profiles_user_id_key" ON "agent_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_reports_session_id_key" ON "match_reports"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_reports_tournament_id_key" ON "match_reports"("tournament_id");
