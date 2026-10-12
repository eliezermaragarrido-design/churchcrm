import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { createSimpleDocx } from "@/lib/documents/simple-docx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthContext();
    const { id } = await params;
    const document = await prisma.documentRequest.findFirst({ where: { id, churchId: auth.churchId } });
    if (!document?.generatedBody) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const safeTitle = document.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim() || "Church Document";
    const wordDocument = createSimpleDocx(document.title, document.generatedBody);
    return new NextResponse(wordDocument, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeTitle}.docx"` } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
