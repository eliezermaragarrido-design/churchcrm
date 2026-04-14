export type DashboardMetric = {
  label: string;
  value: string;
  note: string;
};

export type MemberSummary = {
  name: string;
  household: string;
  phone: string;
  birthday: string;
  tags: string[];
  careStatus: string;
};

export type GroupSummary = {
  name: string;
  type: string;
  leaders: string;
  members: number;
  nextMeeting: string;
  feedHighlight: string;
};

export type CalendarSummary = {
  name: string;
  visibility: "Internal" | "Public";
  owner: string;
  color: string;
  note: string;
};

export type CalendarEventSummary = {
  time: string;
  title: string;
  calendar: string;
  note: string;
  type: string;
};

export type AssistantTask = {
  title: string;
  description: string;
  output: string;
};

export const dashboardMetrics: DashboardMetric[] = [
  { label: "Birthdays this week", value: "12", note: "4 texts scheduled for tomorrow morning" },
  { label: "Open follow-ups", value: "18", note: "7 belong to first-time guests" },
  { label: "Active groups", value: "26", note: "Sunday school, teams, and small groups" },
  { label: "Upcoming events", value: "9", note: "3 public calendar events have SMS reminders" },
];

export const members: MemberSummary[] = [
  {
    name: "Angela Brooks",
    household: "Brooks Family",
    phone: "(555) 203-1188",
    birthday: "March 18",
    tags: ["Choir", "Prayer team"],
    careStatus: "Needs follow-up call",
  },
  {
    name: "David Carter",
    household: "Carter Household",
    phone: "(555) 104-9920",
    birthday: "April 2",
    tags: ["Sunday School", "Usher"],
    careStatus: "Stable",
  },
  {
    name: "Maria Ortiz",
    household: "Ortiz Family",
    phone: "(555) 631-4468",
    birthday: "March 25",
    tags: ["Youth parent", "New member"],
    careStatus: "Prayer request open",
  },
];

export const groups: GroupSummary[] = [
  {
    name: "Faith Builders Class",
    type: "Sunday school",
    leaders: "Bro. Jenkins, Sis. Horne",
    members: 24,
    nextMeeting: "Sunday, 9:15 AM",
    feedHighlight: "Pinned lesson outline and prayer thread",
  },
  {
    name: "Midweek Young Adults",
    type: "Small group",
    leaders: "Pastor Eli Gomez",
    members: 18,
    nextMeeting: "Wednesday, 7:00 PM",
    feedHighlight: "Photo album from outreach night",
  },
  {
    name: "Worship Team",
    type: "Ministry team",
    leaders: "Tanya Reed",
    members: 11,
    nextMeeting: "Thursday, 6:30 PM",
    feedHighlight: "Set list video and rehearsal reminder",
  },
];

export const calendars: CalendarSummary[] = [
  {
    name: "Senior Pastor Calendar",
    visibility: "Internal",
    owner: "Pastor Mitchell",
    color: "#235347",
    note: "Counseling, visits, and sermon prep",
  },
  {
    name: "Youth Ministry Calendar",
    visibility: "Public",
    owner: "Youth Pastor Elaine",
    color: "#8f6d1f",
    note: "Youth services, trips, and parent nights",
  },
  {
    name: "Secretary Office Calendar",
    visibility: "Internal",
    owner: "Church Office",
    color: "#7b4156",
    note: "Absences, certificates, and office deadlines",
  },
];

export const todayEvents: CalendarEventSummary[] = [
  {
    time: "9:00 AM",
    title: "Staff prayer and planning",
    calendar: "Main staff",
    note: "Internal coordination block",
    type: "Meeting",
  },
  {
    time: "1:00 PM",
    title: "Hospital visit for Sister Hall",
    calendar: "Senior Pastor Calendar",
    note: "Pastoral care visit",
    type: "Appointment",
  },
  {
    time: "6:00 PM",
    title: "Youth night reminder SMS",
    calendar: "Youth Ministry Calendar",
    note: "Automatic text goes out 2 hours before event",
    type: "Public event",
  },
];

export const assistantTasks: AssistantTask[] = [
  {
    title: "Secretary document assistant",
    description: "Generate transfer letters, baptism certificates, bulletin copy, and church office correspondence.",
    output: "Structured church documents with saved templates",
  },
  {
    title: "Meeting notes from audio",
    description: "Upload one- or two-hour board or staff meeting audio and return summarized notes, action items, and decisions.",
    output: "Meeting summary with action list",
  },
  {
    title: "Sermon notes from PowerPoint",
    description: "Upload sermon slides and let the assistant extract points, verses, and a clean note outline.",
    output: "Sermon note draft",
  },
  {
    title: "Prayer request digest",
    description: "Prepare weekly or biweekly prayer-request text updates from approved prayer lists.",
    output: "Scheduled prayer text campaign",
  },
];

export const reminderRules = [
  "Official church activities can schedule SMS reminders for one day before and two hours before the event.",
  "Daily social content is pulled from purchased folders: one image of the day and one reel of the day.",
  "Stories and feed posts use the same approved asset when the destination platform supports it.",
  "Prayer request updates can be sent on a weekly or biweekly schedule from approved prayer lists.",
];
