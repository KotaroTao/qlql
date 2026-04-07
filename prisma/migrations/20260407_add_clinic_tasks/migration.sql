-- CreateTable
CREATE TABLE "clinic_tasks" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "requested_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_tasks_clinic_id_idx" ON "clinic_tasks"("clinic_id");

-- CreateIndex
CREATE INDEX "clinic_tasks_clinic_id_status_idx" ON "clinic_tasks"("clinic_id", "status");

-- AddForeignKey
ALTER TABLE "clinic_tasks" ADD CONSTRAINT "clinic_tasks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
