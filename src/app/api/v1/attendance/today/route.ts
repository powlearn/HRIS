import { apiRoute } from "@/lib/api";
import { getTodayAttendance } from "@/modules/attendance/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute({
  permission: "attendance.clock",
  handler: async ({ user }) => getTodayAttendance(user),
});
