-- Add optional section title to modules for visual grouping within lectures
ALTER TABLE modules ADD COLUMN section_title text;
COMMENT ON COLUMN modules.section_title IS 'Optional heading displayed above this module as a section separator';
