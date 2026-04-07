-- AlterTable: ClinicにnapInfoフィールドを追加
ALTER TABLE "clinics" ADD COLUMN "nap_info" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: NAP統一管理（媒体別）
CREATE TABLE "nap_platforms" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL,
    "platform_url" TEXT,
    "name_status" TEXT NOT NULL DEFAULT 'unchecked',
    "address_status" TEXT NOT NULL DEFAULT 'unchecked',
    "phone_status" TEXT NOT NULL DEFAULT 'unchecked',
    "status" TEXT NOT NULL DEFAULT 'unchecked',
    "note" TEXT,
    "requested_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminded_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nap_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nap_platforms_clinic_id_idx" ON "nap_platforms"("clinic_id");

-- AddForeignKey
ALTER TABLE "nap_platforms" ADD CONSTRAINT "nap_platforms_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
