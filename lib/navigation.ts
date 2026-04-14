export type NavItem = {
  href: string;
  label: string;
  description: string;
};

export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Overview",
  },
  {
    href: "/members",
    label: "Members",
    description: "Directory",
  },
  {
    href: "/calendars",
    label: "Calendars",
    description: "Schedules",
  },
  {
    href: "/messages",
    label: "Messages",
    description: "SMS center",
  },
  {
    href: "/assistant",
    label: "Assistant",
    description: "AI and sermons",
  },
  {
    href: "/automation",
    label: "Automation",
    description: "Social posting",
  },
];
