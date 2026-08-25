import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuthContext } from "@/lib/auth";

function escapeCsv(value: string | null | undefined) {
  const text = String(value || "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export async function GET() {
  const auth = await requireAuthContext();
  const members = await prisma.member.findMany({
    where: { churchId: auth.churchId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = [
    ["First Name", "Last Name", "Preferred Name", "Mobile Phone", "Email", "Birthday", "Status", "SMS Opted Out"],
    ...members.map((member) => [
      member.firstName,
      member.lastName,
      member.preferredName || "",
      member.phoneMobile || "",
      member.email || "",
      member.birthdate ? member.birthdate.toISOString().slice(0, 10) : "",
      member.status,
      member.isSmsOptedOut ? "Yes" : "No",
    ]),
  ];

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const fileName = `members-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
