ALTER TABLE "Contact" ADD COLUMN "groups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Contact" ADD COLUMN "cardBackUrl" TEXT;
ALTER TABLE "Contact" ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}'::JSONB;
UPDATE "Contact" SET "groups" = ARRAY["groupName"] WHERE "groupName" IS NOT NULL AND "groupName" <> '' AND cardinality("groups") = 0;
