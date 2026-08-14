BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE, username VARCHAR(32) NOT NULL UNIQUE, display_name VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','TRANSLATOR','EDITOR','MODERATOR','ADMIN')),
  avatar_url TEXT, bio VARCHAR(500), email_verified_at TIMESTAMPTZ, reader_preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL UNIQUE, sid VARCHAR NOT NULL PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

CREATE TABLE IF NOT EXISTS novels (
  id BIGSERIAL PRIMARY KEY, slug VARCHAR(180) NOT NULL UNIQUE, title VARCHAR(180) NOT NULL, original_title VARCHAR(180),
  type VARCHAR(20) NOT NULL CHECK (type IN ('Light Novel','Web Novel')), cover_url TEXT, banner_url TEXT, synopsis TEXT NOT NULL,
  author VARCHAR(160) NOT NULL, artist VARCHAR(160), original_publisher VARCHAR(160), translator VARCHAR(160),
  original_language VARCHAR(60) NOT NULL, translation_language VARCHAR(60) NOT NULL DEFAULT 'Français',
  work_status VARCHAR(20) NOT NULL CHECK (work_status IN ('En cours','Terminé','En pause','Abandonné','Licencié')),
  translation_status VARCHAR(20) NOT NULL CHECK (translation_status IN ('En cours','Terminée','En pause','Abandonnée')),
  published_at DATE, last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), volume_count INTEGER NOT NULL DEFAULT 0 CHECK (volume_count >= 0),
  chapter_count INTEGER NOT NULL DEFAULT 0 CHECK (chapter_count >= 0), average_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0), views BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0), favorites_count BIGINT NOT NULL DEFAULT 0 CHECK (favorites_count >= 0),
  content_warnings TEXT[] NOT NULL DEFAULT '{}', license_info TEXT, meta_title VARCHAR(180), meta_description VARCHAR(320),
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','scheduled','published','archived')),
  scheduled_at TIMESTAMPTZ, created_by BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_novels_catalog ON novels(publication_status, last_updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_novels_type ON novels(type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS novel_alternative_titles (
  id BIGSERIAL PRIMARY KEY, novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE, title VARCHAR(180) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(novel_id,title)
);
CREATE TABLE IF NOT EXISTS volumes (
  id BIGSERIAL PRIMARY KEY, novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE, number NUMERIC(8,2) NOT NULL,
  title VARCHAR(180) NOT NULL, slug VARCHAR(180) NOT NULL, cover_url TEXT, summary TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  published_at DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ,
  UNIQUE(novel_id,slug), UNIQUE(novel_id,number)
);
CREATE INDEX IF NOT EXISTS idx_volumes_novel_order ON volumes(novel_id,sort_order) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS chapters (
  id BIGSERIAL PRIMARY KEY, volume_id BIGINT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE, title VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE, number NUMERIC(8,2) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, content_html TEXT NOT NULL DEFAULT '',
  translation_note TEXT, status VARCHAR(20) NOT NULL DEFAULT 'Brouillon' CHECK (status IN ('Brouillon','Programmé','Publié','Archivé')),
  published_at TIMESTAMPTZ, scheduled_at TIMESTAMPTZ, word_count INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  estimated_reading_minutes INTEGER NOT NULL DEFAULT 1 CHECK (estimated_reading_minutes > 0), views BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0),
  created_by BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ,
  UNIQUE(volume_id,number)
);
CREATE INDEX IF NOT EXISTS idx_chapters_volume_order ON chapters(volume_id,sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chapters_publication ON chapters(status,published_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS genres (id BIGSERIAL PRIMARY KEY, slug VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tags (id BIGSERIAL PRIMARY KEY, slug VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS novel_genres (id BIGSERIAL UNIQUE, novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE, genre_id BIGINT NOT NULL REFERENCES genres(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(novel_id,genre_id));
CREATE TABLE IF NOT EXISTS novel_tags (id BIGSERIAL UNIQUE, novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE, tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(novel_id,tag_id));

CREATE TABLE IF NOT EXISTS patches (
  id BIGSERIAL PRIMARY KEY, slug VARCHAR(180) NOT NULL UNIQUE, title VARCHAR(180) NOT NULL, alternative_titles TEXT[] NOT NULL DEFAULT '{}',
  vndb_id VARCHAR(30), vndb_url TEXT, cover_url TEXT, banner_url TEXT, game_synopsis TEXT, developer VARCHAR(180), publisher VARCHAR(180),
  engine VARCHAR(100), platform VARCHAR(180), compatible_systems TEXT[] NOT NULL DEFAULT '{}', compatible_game_version VARCHAR(120),
  original_language VARCHAR(60), patch_language VARCHAR(60) NOT NULL DEFAULT 'Français', translation_team VARCHAR(180), translators TEXT[] NOT NULL DEFAULT '{}',
  proofreaders TEXT[] NOT NULL DEFAULT '{}', technical_leads TEXT[] NOT NULL DEFAULT '{}', patch_type VARCHAR(40) NOT NULL CHECK (patch_type IN ('Traduction complète','Traduction partielle','Correctif','Interface','Compatibilité','Patch technique','Voix','Restauration de contenu')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('En développement','Alpha','Bêta','Stable','Terminé','Obsolète','Abandonné')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100), current_version VARCHAR(60), first_released_at DATE, last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installation_instructions TEXT, requirements TEXT, warnings TEXT, downloads_count BIGINT NOT NULL DEFAULT 0, average_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5), favorites_count BIGINT NOT NULL DEFAULT 0,
  official_purchase_links JSONB NOT NULL DEFAULT '[]', is_adult BOOLEAN NOT NULL DEFAULT false, publication_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published','archived')),
  rights_confirmed_by BIGINT REFERENCES users(id), rights_confirmed_at TIMESTAMPTZ, created_by BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_patches_catalog ON patches(publication_status,last_updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patches_vndb ON patches(vndb_id) WHERE vndb_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS patch_versions (
  id BIGSERIAL PRIMARY KEY, patch_id BIGINT NOT NULL REFERENCES patches(id) ON DELETE CASCADE, version VARCHAR(60) NOT NULL,
  file_storage_key TEXT NOT NULL, file_size BIGINT NOT NULL CHECK (file_size > 0), mime_type VARCHAR(120) NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL, game_version VARCHAR(120), changelog TEXT, status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  released_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ,
  UNIQUE(patch_id,version)
);
CREATE INDEX IF NOT EXISTS idx_patch_versions_patch ON patch_versions(patch_id,released_at DESC) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS patch_mirrors (id BIGSERIAL PRIMARY KEY, patch_version_id BIGINT NOT NULL REFERENCES patch_versions(id) ON DELETE CASCADE, label VARCHAR(80) NOT NULL, storage_key TEXT, external_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK ((storage_key IS NOT NULL) <> (external_url IS NOT NULL)));
CREATE TABLE IF NOT EXISTS patch_screenshots (id BIGSERIAL PRIMARY KEY, patch_id BIGINT NOT NULL REFERENCES patches(id) ON DELETE CASCADE, image_url TEXT NOT NULL, alt_text VARCHAR(180) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS favorites (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, novel_id BIGINT REFERENCES novels(id) ON DELETE CASCADE, patch_id BIGINT REFERENCES patches(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK ((novel_id IS NOT NULL) <> (patch_id IS NOT NULL)), UNIQUE NULLS NOT DISTINCT(user_id,novel_id,patch_id));
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS reading_list (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE, category VARCHAR(20) NOT NULL CHECK (category IN ('À lire','En cours','Terminé','En pause','Abandonné')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id,novel_id));
CREATE TABLE IF NOT EXISTS reading_progress (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE, chapter_id BIGINT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE, progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100), scroll_position INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id,novel_id));
CREATE TABLE IF NOT EXISTS reading_history (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, novel_id BIGINT REFERENCES novels(id) ON DELETE SET NULL, chapter_id BIGINT REFERENCES chapters(id) ON DELETE SET NULL, patch_id BIGINT REFERENCES patches(id) ON DELETE SET NULL, viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (novel_id IS NOT NULL OR patch_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_history_user_date ON reading_history(user_id,viewed_at DESC);
CREATE TABLE IF NOT EXISTS ratings (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, novel_id BIGINT REFERENCES novels(id) ON DELETE CASCADE, patch_id BIGINT REFERENCES patches(id) ON DELETE CASCADE, score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK ((novel_id IS NOT NULL) <> (patch_id IS NOT NULL)), UNIQUE NULLS NOT DISTINCT(user_id,novel_id,patch_id));
CREATE TABLE IF NOT EXISTS downloads (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, patch_version_id BIGINT NOT NULL REFERENCES patch_versions(id), ip_hash CHAR(64), user_agent_hash CHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_downloads_version_date ON downloads(patch_version_id,created_at DESC);
CREATE TABLE IF NOT EXISTS media (id BIGSERIAL PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, category VARCHAR(30) NOT NULL CHECK (category IN ('cover','banner','screenshot','avatar','patch')), mime_type VARCHAR(120) NOT NULL, byte_size BIGINT NOT NULL CHECK (byte_size > 0), width INTEGER, height INTEGER, checksum_sha256 CHAR(64), uploaded_by BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS notifications (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(40) NOT NULL, title VARCHAR(180) NOT NULL, body TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id,created_at DESC) WHERE read_at IS NULL;
CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, action VARCHAR(80) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id BIGINT, before_data JSONB, after_data JSONB, ip_hash CHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type,entity_id,created_at DESC);

COMMIT;
