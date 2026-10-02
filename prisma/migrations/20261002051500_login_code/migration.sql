-- Código de 6 cifras para entrar sin abrir el enlace en el mismo navegador.
ALTER TABLE "LoginToken" ADD COLUMN "codeHash" TEXT,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
