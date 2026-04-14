"use client";

import { useEffect, useState } from "react";

type CalendarOption = {
  id: string;
  name: string;
};

type CalendarEventFormProps = {
  calendars: CalendarOption[];
  action: (formData: FormData) => void | Promise<void>;
};

function toLocalDateTimeValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CalendarEventForm({ calendars, action }: CalendarEventFormProps) {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [startsAt, setStartsAt] = useState(toLocalDateTimeValue(defaultStart));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeValue(defaultEnd));
  const [isAllDay, setIsAllDay] = useState(false);

  useEffect(() => {
    if (!startsAt) {
      return;
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (Number.isNaN(startDate.getTime())) {
      return;
    }

    if (isAllDay) {
      const sameDayEnd = new Date(startDate);
      sameDayEnd.setHours(23, 0, 0, 0);
      setEndsAt(toLocalDateTimeValue(sameDayEnd));
      return;
    }

    if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      const suggestedEnd = new Date(startDate.getTime() + 60 * 60 * 1000);
      setEndsAt(toLocalDateTimeValue(suggestedEnd));
    }
  }, [startsAt, isAllDay]);

  return (
    <form action={action} className="form-grid">
      <select className="select" name="calendarId" defaultValue="">
        <option value="" disabled>Select calendar</option>
        {calendars.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>{calendar.name}</option>
        ))}
      </select>
      <input className="input" name="title" placeholder="Event or absence title" required />
      <input className="input" name="description" placeholder="Description" />
      <input className="input" name="location" placeholder="Location or leave blank for absence/time off" />
      <select className="select" name="eventType" defaultValue="OTHER">
        <option value="OTHER">Other</option>
        <option value="MEETING">Meeting</option>
        <option value="SERVICE">Service</option>
        <option value="MINISTRY_EVENT">Ministry event</option>
        <option value="PUBLIC_EVENT">Public event</option>
        <option value="REHEARSAL">Rehearsal</option>
        <option value="APPOINTMENT">Appointment</option>
        <option value="VACATION">Vacation</option>
        <option value="ABSENCE">Absence</option>
      </select>
      <div className="two-up-inputs">
        <input
          className="input"
          name="startsAt"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />
        <input
          className="input"
          name="endsAt"
          type="datetime-local"
          value={endsAt}
          min={startsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          required
        />
      </div>
      <div className="list-card panel-soft stack">
        <label className="muted">
          <input
            type="checkbox"
            name="isAllDay"
            checked={isAllDay}
            onChange={(event) => setIsAllDay(event.target.checked)}
          /> All-day event
        </label>
        <label className="muted"><input type="checkbox" name="isAbsence" /> This is an absence / personal permission / time-off item</label>
        <label className="muted"><input type="checkbox" name="isPublished" /> Published event for church reminder texts</label>
        <p className="muted">The end time must be after the start. This form now auto-suggests an end time one hour later.</p>
      </div>
      <button className="button" type="submit">Save event</button>
    </form>
  );
}