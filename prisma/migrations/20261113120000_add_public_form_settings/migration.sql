-- Formulário público configurável (tarefa 010).

-- AlterTable
ALTER TABLE "accounts"
    ADD COLUMN "public_form_slug" TEXT,
    ADD COLUMN "public_form_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "public_form_title" TEXT,
    ADD COLUMN "public_form_message" TEXT,
    ADD COLUMN "public_form_whatsapp" TEXT,
    ADD COLUMN "public_form_owner_id" TEXT;

-- Contas existentes mantêm o link atual (/f/<id>) como slug inicial.
UPDATE "accounts" SET "public_form_slug" = "id" WHERE "public_form_slug" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_public_form_slug_key" ON "accounts"("public_form_slug");
CREATE UNIQUE INDEX "accounts_public_form_owner_id_key" ON "accounts"("public_form_owner_id");

-- AddForeignKey
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_public_form_owner_id_fkey"
    FOREIGN KEY ("public_form_owner_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
