-- Marca qué material son las diapositivas de la sesión.
ALTER TABLE "Material" ADD COLUMN "isSlides" BOOLEAN NOT NULL DEFAULT false;
