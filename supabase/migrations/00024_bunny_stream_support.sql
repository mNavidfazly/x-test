-- Phase 3C-4: Bunny Stream Integration
-- Replace manual video URL fields with Bunny Stream columns.
-- No backward compatibility — delete existing rows, replace columns.

-- Delete existing rows (no manual-URL videos to preserve)
DELETE FROM module_videos;

-- Drop old columns
ALTER TABLE module_videos
  DROP COLUMN video_url,
  DROP COLUMN thumbnail_url,
  DROP COLUMN duration;

-- Add Bunny-specific columns
ALTER TABLE module_videos
  ADD COLUMN bunny_video_id    text NOT NULL,
  ADD COLUMN bunny_library_id  bigint NOT NULL,
  ADD COLUMN encoding_status   smallint NOT NULL DEFAULT 0,
  ADD COLUMN duration          integer,
  ADD COLUMN thumbnail_url     text,
  ADD COLUMN original_filename text;

-- Index for webhook lookups (one video per Bunny GUID)
CREATE UNIQUE INDEX idx_module_videos_bunny_video_id
  ON module_videos (bunny_video_id);
