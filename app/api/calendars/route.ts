import { ok, handleRouteError } from "@/lib/api";
import { requireAuthContext } from "@/lib/auth";
import { calendarEventInputSchema, calendarInputSchema } from "@/lib/validators/calendars";
import { createCalendar, createCalendarEvent, listCalendars } from "@/server/services/calendars/service";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    return ok(await listCalendars(auth.churchId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    const body = await request.json();

    if (body.type === "event") {
      const payload = calendarEventInputSchema.parse(body);
      return ok(await createCalendarEvent(auth.churchId, auth.userId, payload), { status: 201 });
    }

    const payload = calendarInputSchema.parse(body);
    return ok(await createCalendar(auth.churchId, payload), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
