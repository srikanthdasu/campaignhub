-- Per-client role for a member's access grant (distinct from their agency-wide Role) — lets the
-- same person be, say, an Approver on one client's team and just a Viewer on another's.
CREATE TYPE "ClientGroupRole" AS ENUM ('MANAGER', 'APPROVER', 'VIEWER');
ALTER TABLE "user_client_access" ADD COLUMN "role" "ClientGroupRole" NOT NULL DEFAULT 'VIEWER';
