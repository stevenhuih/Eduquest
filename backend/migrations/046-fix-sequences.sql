-- Fix educators sequence
SELECT setval(
  pg_get_serial_sequence('educators', 'id'),
  COALESCE((SELECT MAX(id) FROM educators), 1),
  true
);

-- Fix students sequence
SELECT setval(
  pg_get_serial_sequence('students', 'id'),
  COALESCE((SELECT MAX(id) FROM students), 1),
  true
);

-- Fix classes sequence (prevent future issues)
SELECT setval(
  pg_get_serial_sequence('classes', 'id'),
  COALESCE((SELECT MAX(id) FROM classes), 1),
  true
);
