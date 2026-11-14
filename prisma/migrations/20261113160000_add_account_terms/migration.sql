-- LGPD (tarefa 013): registro do aceite dos termos no cadastro.

-- AlterTable
ALTER TABLE "accounts"
    ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
    ADD COLUMN "terms_version" TEXT;

-- Contas existentes aceitaram os termos na versão vigente no lançamento.
-- (O registro retroativo é uma decisão de produto documentada em .notes/013.)
UPDATE "accounts"
SET "terms_accepted_at" = "created_at",
    "terms_version" = '2026-11-13'
WHERE "terms_accepted_at" IS NULL;
