INSERT INTO students (id, name)
VALUES (1, 'Test Student')
ON CONFLICT (id) DO NOTHING;
