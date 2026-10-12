import { requireAuthContext } from "@/lib/auth";
﻿import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/layout/badge";
import { SectionCard } from "@/components/layout/section-card";
import {
  createCalendarAction,
  createCalendarEventAction,
  deleteCalendarAction,
  deleteCalendarEventAction,
} from "./actions";
import { CalendarEventForm } from "./calendar-event-form";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function CalendarsPage() {
  const { churchId } = await requireAuthContext();
  const now = new Date();

  const [calendars, upcomingEvents] = await Promise.all([
    prisma.calendar.findMany({
      where: { churchId },
      include: {
        entries: {
          orderBy: { startsAt: "asc" },
          take: 5,
        },
      },
      orderBy: [{ visibility: "asc" }, { name: "asc" }],
    }),
    prisma.calendarEvent.findMany({
      where: { churchId, startsAt: { gte: now } },
      include: { calendar: true },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
  ]);

  const internalCalendars = calendars.filter((calendar) => calendar.visibility === "INTERNAL");
  const publicCalendars = calendars.filter((calendar) => calendar.visibility === "PUBLIC");
  const absenceCalendars = calendars.filter((calendar) => calendar.isAbsenceCalendar);

  return (
    <AppShell
      title="Calendars"
      subtitle="Plan church events, staff permissions, and internal schedules from one clear view."
      currentPath="/calendars"
      actions={<span className="pill">{calendars.length} calendars</span>}
    >
      <section className="hero-card">
        <div className="stack">
          <p className="kicker">Calendar operations</p>
          <h3 className="card-title">Keep church events, staff permissions, and internal plans organized.</h3>
          <p className="page-subtitle">
            Create the calendar first, then add the event, absence, or personal entry that belongs to it.
          </p>
        </div>
        <div className="metrics-grid">
          <div className="panel panel-soft">
            <strong className="metric-value">{internalCalendars.length}</strong>
              <p className="muted">internal calendars</p>
          </div>
          <div className="panel panel-soft">
            <strong className="metric-value">{publicCalendars.length}</strong>
              <p className="muted">church event calendars</p>
          </div>
          <div className="panel panel-soft">
            <strong className="metric-value">{absenceCalendars.length}</strong>
              <p className="muted">permission calendars</p>
          </div>
        </div>
      </section>

      <section className="two-column">
        <SectionCard title="Create calendar">
          <form action={createCalendarAction} className="form-grid">
            <input className="input" name="name" placeholder="Calendar name" required />
            <input className="input" name="description" placeholder="Description" />
            <input className="input" name="colorHex" placeholder="#235347 (optional)" />
            <select className="select" name="visibility" defaultValue="INTERNAL">
              <option value="INTERNAL">Internal staff calendar</option>
              <option value="PUBLIC">Public church calendar</option>
            </select>
            <label className="muted"><input type="checkbox" name="isAbsenceCalendar" /> Use this calendar for absences, permissions, and time off</label>
            <button className="button" type="submit">Save calendar</button>
          </form>
        </SectionCard>

        <SectionCard title="Create event or absence">
          <CalendarEventForm
            calendars={calendars.map((calendar) => ({ id: calendar.id, name: calendar.name }))}
            action={createCalendarEventAction}
          />
        </SectionCard>
      </section>

      <section className="three-column">
        <SectionCard title="Internal calendars" action={<Badge>{internalCalendars.length}</Badge>}>
          <div className="calendar-day-list">
            {internalCalendars.length ? internalCalendars.map((calendar) => (
              <div key={calendar.id} className="calendar-event">
                <div className="toolbar">
                  <strong>{calendar.name}</strong>
                  <Badge>Internal</Badge>
                </div>
                <div className="muted">{calendar.description || "No description yet"}</div>
                <form action={deleteCalendarAction}>
                  <input type="hidden" name="calendarId" value={calendar.id} />
                  <button className="button secondary" type="submit">Delete calendar</button>
                </form>
              </div>
            )) : <div className="calendar-event">No internal calendars yet.</div>}
          </div>
        </SectionCard>

        <SectionCard title="Public calendars" action={<Badge>{publicCalendars.length}</Badge>}>
          <div className="calendar-day-list">
            {publicCalendars.length ? publicCalendars.map((calendar) => (
              <div key={calendar.id} className="calendar-event">
                <div className="toolbar">
                  <strong>{calendar.name}</strong>
                  <Badge>Public</Badge>
                </div>
                <div className="muted">{calendar.description || "No description yet"}</div>
                <form action={deleteCalendarAction}>
                  <input type="hidden" name="calendarId" value={calendar.id} />
                  <button className="button secondary" type="submit">Delete calendar</button>
                </form>
              </div>
            )) : <div className="calendar-event">No public calendars yet.</div>}
          </div>
        </SectionCard>

        <SectionCard title="Absence calendars" action={<Badge>{absenceCalendars.length}</Badge>}>
          <div className="calendar-day-list">
            {absenceCalendars.length ? absenceCalendars.map((calendar) => (
              <div key={calendar.id} className="calendar-event">
                <div className="toolbar">
                  <strong>{calendar.name}</strong>
                  <Badge tone="warn">Time off</Badge>
                </div>
                <div className="muted">{calendar.description || "Tracks permissions, time off, and internal absences."}</div>
                <form action={deleteCalendarAction}>
                  <input type="hidden" name="calendarId" value={calendar.id} />
                  <button className="button secondary" type="submit">Delete calendar</button>
                </form>
              </div>
            )) : <div className="calendar-event">No absence calendars yet.</div>}
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Next events" action={<span className="muted">Next 8 entries</span>}>
          <div className="calendar-event-grid">
            {upcomingEvents.length ? (
              upcomingEvents.map((event) => (
                <div key={event.id} className="calendar-event">
                  <div className="toolbar">
                    <strong>{event.title}</strong>
                    <Badge>{event.isAbsence ? "Absence" : event.eventType.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="muted">{formatDateTime(event.startsAt)} to {formatDateTime(event.endsAt)}</div>
                  <div className="muted">{event.calendar.name}</div>
                  <div className="muted">{event.location || (event.isAbsence ? "Personal leave / permission" : "No location")}</div>
                  {event.description ? <div className="muted">{event.description}</div> : null}
                  <form action={deleteCalendarEventAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <button className="button secondary" type="submit">Delete event</button>
                  </form>
                </div>
              ))
            ) : (
              <div className="calendar-event">No upcoming events yet.</div>
            )}
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
