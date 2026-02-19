# Run all migrations in dependency order against Railway Postgres.
# Usage: from project root (Eduquest Final):
#   .\backend\run-migrations-railway.ps1
# Or set PGPASSWORD first:
#   $env:PGPASSWORD = "your-password"
#   .\backend\run-migrations-railway.ps1

$dbHost = "crossover.proxy.rlwy.net"
$port = "19603"
$user = "postgres"
$db   = "railway"
$migrationsDir = "backend\migrations"

# Order: table creation before alteration; FKs after referenced tables/seeds.
# 013 (students) before 012 (xp), 014 (seed), 015 (classes refs students); 029 (admins) before 031 (admin_id).
$order = @(
  "000-create-core-quiz-tables.sql",
  "001-add-explanation.sql",
  "002-add-explanation-column.sql",
  "003-quiz-rules.sql",
  "004-add-quiz-rule-columns.sql",
  "005-cascade-quiz-deletes.sql",
  "006-create-question-bank.sql",
  "007-add-question-bank-times-used.sql",
  "008-add-questions-topic.sql",
  "009-backfill-questions-topic-null.sql",
  "009-create-challenge-attempts.sql",
  "010-create-challenge-attempts.sql",
  "011-add-score-to-challenge-attempts.sql",
  "013-create-students.sql",
  "014-seed-default-student.sql",
  "012-add-xp-to-students.sql",
  "015-create-classes.sql",
  "016-create-student-class-progress.sql",
  "017-add-classid-to-challenge-attempts.sql",
  "018-add-classid-to-question-bank.sql",
  "019-add-classid-to-student-attempts.sql",
  "020-create-topics-table.sql",
  "021-add-topicid-to-question-bank.sql",
  "022-add-topicid-to-questions.sql",
  "023-add-topicid-to-challenge-attempts.sql",
  "025-create-educators-table.sql",
  "024-add-educator-id-to-classes.sql",
  "026-add-description-to-classes.sql",
  "027-educators-email-password.sql",
  "028-add-email-password-to-students.sql",
  "029-create-admins-table.sql",
  "030-create-subscriptions-table.sql",
  "031-add-adminid-to-students.sql",
  "032-add-coins-to-students.sql",
  "033-create-cards-system.sql",
  "034-add-rewards-to-quizzes.sql",
  "035-fix-class-id-assignments.sql",
  "036-create-reviews-table.sql",
  "037-create-platform-admins-table.sql",
  "038-create-platform-reviews-table.sql",
  "039-seed-platform-admin.sql",
  "040-add-created-by-to-educators.sql",
  "041-educators-created-by-backfill-note.sql",
  "042-educator-admins-plan-ensure.sql",
  "043-student-reports-table.sql",
  "044-add-rarities-system.sql",
  "045-add-educatoradmin-status-subscription.sql"
)

foreach ($f in $order) {
  $path = Join-Path $migrationsDir $f
  if (-not (Test-Path $path)) {
    Write-Warning "Skip (not found): $path"
    continue
  }
  Write-Host "Running $f ..."
  & psql -h $dbHost -U $user -p $port -d $db -f $path
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed: $f"
    exit 1
  }
}
Write-Host "All migrations completed."
