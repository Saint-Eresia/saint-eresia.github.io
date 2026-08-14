-- Avancement détaillé des patchs : quatre axes suivis séparément par l'équipe.
-- La colonne `progress` reste la moyenne des quatre axes, calculée par l'application à chaque écriture.
ALTER TABLE patches ADD COLUMN IF NOT EXISTS progress_translation INTEGER NOT NULL DEFAULT 0 CHECK (progress_translation BETWEEN 0 AND 100);
ALTER TABLE patches ADD COLUMN IF NOT EXISTS progress_images INTEGER NOT NULL DEFAULT 0 CHECK (progress_images BETWEEN 0 AND 100);
ALTER TABLE patches ADD COLUMN IF NOT EXISTS progress_technical INTEGER NOT NULL DEFAULT 0 CHECK (progress_technical BETWEEN 0 AND 100);
ALTER TABLE patches ADD COLUMN IF NOT EXISTS progress_proofreading INTEGER NOT NULL DEFAULT 0 CHECK (progress_proofreading BETWEEN 0 AND 100);

-- Les fiches existantes n'avaient qu'un pourcentage global : on le reporte sur les quatre axes.
UPDATE patches
SET progress_translation = progress, progress_images = progress, progress_technical = progress, progress_proofreading = progress
WHERE progress_translation = 0 AND progress_images = 0 AND progress_technical = 0 AND progress_proofreading = 0 AND progress > 0;

CREATE INDEX IF NOT EXISTS idx_patches_progress ON patches(progress DESC) WHERE deleted_at IS NULL;
