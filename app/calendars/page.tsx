import { prisma } from "@/lib/db/prisma";
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

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default async function CalendarsPage() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [calendars, upcomingEvents, publishedEvents] = await Promise.all([
    prisma.calendar.findMany({
      include: {
        entries: {
          orderBy: { startsAt: "asc" },
          take: 5,
        },
      },
      orderBy: [{ visibility: "asc" }, { name: "asc" }],
    }),
    prisma.calendarEvent.findMany({
      where: { startsAt: { gte: now } },
      include: { calendar: true },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
    prisma.calendarEvent.findMany({
      where: {
        startsAt: { gte: now },
        isPublished: true,
        isAbsence: false,
      },
      include: { calendar: true },
      orderBy: { startsAt: "asc" },
      take: 30,
    }),
  ]);

  const laterReminderCandidates = publishedEvents.filter((event) => isSameLocalDay(new Date(event.startsAt), tomorrow));
  const soonReminderCandidates = publishedEvents.filter((event) => {
    const eventDate = new Date(event.startsAt);
    return eventDate >= now && eventDate <= twoHoursAhead;
  });

  const internalCalendars = calendars.filter((calendar) => calendar.visibility === "INTERNAL");
  const publicCalendars = calendars.filter((calendar) => calendar.visibility === "PUBLIC");
  const absenceCalendars = calendars.filter((calendar) => calendar.isAbsenceCalendar);

  return (
    <AppShell
      title="Calendars"
      subtitle="Coordinate internal staff schedules, time-off, ministry planning, and public church events from one place."
      currentPath="/calendars"
      actions={<span className="pill">{calendars.length} calendars</span>}
    >
      <section className="hero-card">
        <div className="stack">
          <p className="kicker">Calendar operations</p>
          <h3 className="card-title">One place for internal planning, public events, staff absences, and reminder-ready scheduling.</h3>
          <p className="page-subtitle">
            Staff calendars can stay private, church event calendars can stay public, and published events can flow directly into reminder texts one day before and two hours before.
          </p>
        </div>
        <div className="metrics-grid">
          <div className="panel panel-soft">
            <strong className="metric-value">{internalCalendars.length}</strong>
            <p className="muted">internal staff calendars</p>
          </div>
          <div className="panel panel-soft">
            <strong className="metric-value">{publicCalendars.length}</strong>
            <p className="muted">public church calendars</p>
          </div>
          <div className="panel panel-soft">
            <strong className="metric-value">{absenceCalendars.length}</strong>
            <p className="muted">absence or time-off calendars</p>
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

      <section className="two-column">
        <SectionCard title="Upcoming schedule" action={<span className="muted">Live calendar events</span>}>
          <div className="calendar-day-list">
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

        <SectionCard title="Reminder queue for SMS">
          <div className="stack">
            <div className="panel panel-soft stack">
              <div className="toolbar">
                <strong>Tomorrow reminders</strong>
                <Badge>{laterReminderCandidates.length} ready</Badge>
              </div>
              <div className="list compact-list">
                {laterReminderCandidates.length ? laterReminderCandidates.map((event) => (
                  <div key={event.id} className="list-item">
                    <div>
                      <strong>{event.title}</strong>
                      <div className="muted">{formatDateTime(event.startsAt)} - {event.calendar.name}</div>
                    </div>
                  </div>
                )) : <div className="list-item"><span>No published events are currently scheduled for tomorrow.</span></div>}
              </div>
            </div>

            <div className="panel panel-soft stack">
              <div className="toolbar">
                <strong>2-hour reminders</strong>
                <Badge>{soonReminderCandidates.length} ready</Badge>
              </div>
              <div className="list compact-list">
                {soonReminderCandidates.length ? soonReminderCandidates.map((event) => (
                  <div key={event.id} className="list-item">
                    <div>
                      <strong>{event.title}</strong>
                      <div className="muted">{formatDateTime(event.startsAt)} - {event.calendar.name}</div>
                    </div>
                  </div>
                )) : <div className="list-item"><span>No published events currently entering the 2-hour reminder window.</span></div>}
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Published church events" action={<Badge>{publishedEvents.length} public reminders eligible</Badge>}>
        <div className="three-column">
          {publishedEvents.length ? publishedEvents.map((event) => (
            <article key={event.id} className="calendar-event">
              <div className="toolbar">
                <strong>{event.title}</strong>
                <Badge>{event.calendar.name}</Badge>
              </div>
              <div className="muted">{formatDateTime(event.startsAt)}</div>
              <div className="muted">{event.location || "No location"}</div>
              <div className="muted">This event is marked to support church text reminders.</div>
              <form action={deleteCalendarEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="button secondary" type="submit">Delete event</button>
              </form>
            </article>
          )) : <article className="calendar-event">No published church events yet. Mark an event as published to make it reminder-ready.</article>}
        </div>
      </SectionCard>
    </AppShell>
  );
}
