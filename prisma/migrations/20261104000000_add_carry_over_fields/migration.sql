-- Carry-over ("Parking Lot") fields. A non-null carried_over_to marks the item as
-- parked for that year and excluded from current-year calculations.
ALTER TABLE "Project" ADD COLUMN "carried_over_to" TEXT;
ALTER TABLE "Project" ADD COLUMN "carried_over_at" TEXT;
ALTER TABLE "Project" ADD COLUMN "carried_over_remarks" TEXT;

ALTER TABLE "Task" ADD COLUMN "carried_over_to" TEXT;
ALTER TABLE "Task" ADD COLUMN "carried_over_at" TEXT;
ALTER TABLE "Task" ADD COLUMN "carried_over_remarks" TEXT;

ALTER TABLE "SpecialTask" ADD COLUMN "carried_over_to" TEXT;
ALTER TABLE "SpecialTask" ADD COLUMN "carried_over_at" TEXT;
ALTER TABLE "SpecialTask" ADD COLUMN "carried_over_remarks" TEXT;

ALTER TABLE "SuchTask" ADD COLUMN "carried_over_to" TEXT;
ALTER TABLE "SuchTask" ADD COLUMN "carried_over_at" TEXT;
ALTER TABLE "SuchTask" ADD COLUMN "carried_over_remarks" TEXT;
