-- 035-fix-class-id-assignments.sql
-- Data repair: reassign question_bank and quizzes that were saved under wrong class_id.
-- Run verification queries first to decide correct (from_class_id -> to_class_id) mapping.
-- Then edit and run the UPDATE section below.

-- =============================================================================
-- STEP 1: VERIFY CURRENT DATA (run these and inspect results)
-- =============================================================================

-- Count questions per class
SELECT class_id, COUNT(*) AS question_count
FROM question_bank
GROUP BY class_id
ORDER BY class_id;

-- Count quizzes per class
SELECT class_id, COUNT(*) AS quiz_count
FROM quizzes
GROUP BY class_id
ORDER BY class_id;

-- List classes (id, name) to map IDs to names
SELECT id, name, educator_id FROM classes ORDER BY id;

-- Sample: see which questions are in which class (topic/text hint for which class they belong to)
-- SELECT id, class_id, topic, LEFT(question_text, 50) AS question_preview FROM question_bank ORDER BY class_id, id;

-- =============================================================================
-- STEP 2: REASSIGN RECORDS (edit the target class_id values, then run)
-- Replace <CORRECT_CLASS_ID> with the actual class id (e.g. 4 for Physics, 2 for Maths).
-- Replace <WRONG_CLASS_ID> with the class_id currently on the records (e.g. 1 if they were saved under wrong class).
-- =============================================================================

-- Example: move all question_bank rows from class 1 to class 4 (Physics)
-- UPDATE question_bank SET class_id = 4 WHERE class_id = 1;

-- Example: move all quizzes from class 1 to class 4
-- UPDATE quizzes SET class_id = 4 WHERE class_id = 1;

-- Uncomment and edit the lines you need, then run this file (or run the UPDATEs manually).
-- Example for multiple classes:
-- UPDATE question_bank SET class_id = 4 WHERE class_id = 1;
-- UPDATE question_bank SET class_id = 2 WHERE class_id = 1 AND topic ILIKE '%math%';
-- UPDATE quizzes SET class_id = 4 WHERE class_id = 1;
