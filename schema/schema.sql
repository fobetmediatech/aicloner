CREATE TABLE IF NOT EXISTS characters (
  id VARCHAR(96) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  consent_status ENUM('pending', 'approved', 'rejected', 'demo-placeholder') NOT NULL DEFAULT 'pending',
  source_status ENUM('draft', 'ready_for_provider', 'provider_created', 'archived') NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_assets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_id VARCHAR(96) NOT NULL,
  asset_type ENUM('reference_image', 'voice_sample', 'end_frame', 'generated_clip', 'other') NOT NULL,
  storage_uri TEXT NOT NULL,
  original_filename VARCHAR(512) NULL,
  mime_type VARCHAR(128) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_character_assets_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  INDEX idx_character_assets_character_type (character_id, asset_type)
);

CREATE TABLE IF NOT EXISTS provider_bindings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  character_id VARCHAR(96) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  binding_type ENUM('character', 'element', 'voice', 'asset') NOT NULL,
  provider_resource_id VARCHAR(255) NOT NULL,
  status ENUM('active', 'failed', 'archived') NOT NULL DEFAULT 'active',
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_provider_bindings_character FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_provider_binding (provider, binding_type, provider_resource_id),
  INDEX idx_provider_bindings_character (character_id, provider)
);

CREATE TABLE IF NOT EXISTS module1_runs (
  id VARCHAR(128) PRIMARY KEY,
  character_id VARCHAR(96) NOT NULL,
  user_prompt TEXT NOT NULL,
  aspect_ratio VARCHAR(16) NOT NULL DEFAULT '16:9',
  status ENUM('planned', 'running', 'complete', 'failed') NOT NULL DEFAULT 'planned',
  manifest_uri TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_module1_runs_character FOREIGN KEY (character_id) REFERENCES characters(id)
);

CREATE TABLE IF NOT EXISTS module1_clips (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  run_id VARCHAR(128) NOT NULL,
  clip_index INT NOT NULL,
  character_id VARCHAR(96) NOT NULL,
  duration_seconds DECIMAL(5,2) NULL,
  prompt TEXT NOT NULL,
  status ENUM('planned', 'submitted', 'complete', 'failed') NOT NULL DEFAULT 'planned',
  provider VARCHAR(64) NOT NULL DEFAULT 'kling',
  provider_job_id VARCHAR(255) NULL,
  request_uri TEXT NULL,
  response_uri TEXT NULL,
  output_video_uri TEXT NULL,
  start_frame_uri TEXT NULL,
  end_frame_uri TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_module1_clips_run FOREIGN KEY (run_id) REFERENCES module1_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_module1_clips_character FOREIGN KEY (character_id) REFERENCES characters(id),
  UNIQUE KEY uniq_run_clip (run_id, clip_index)
);
