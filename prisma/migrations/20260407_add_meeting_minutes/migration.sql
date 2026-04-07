-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "summary" TEXT,
    "our_staff" TEXT,
    "clinic_attendees" TEXT,
    "zoom_url" TEXT,
    "recording_url" TEXT,
    "next_actions" TEXT,
    "is_visible_to_clinic" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_minutes_clinic_id_idx" ON "meeting_minutes"("clinic_id");

-- CreateIndex
CREATE INDEX "meeting_minutes_clinic_id_meeting_date_idx" ON "meeting_minutes"("clinic_id", "meeting_date");

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
