import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { getProjectById, listProjectTasks, listProjectMilestones, getProjectMembers } from "@/server/actions/projects";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const project = await getProjectById(id);
    if (!project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const [tasks, milestones, members] = await Promise.all([
      listProjectTasks(id),
      listProjectMilestones(id),
      getProjectMembers(id),
    ]);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(project.title, 14, 20);

    // Meta
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let y = 30;
    const meta: [string, string][] = [
      ["Tipe", project.type],
      ["Status", project.status.replace(/_/g, " ")],
      ["Progress", `${project.progress}%`],
      ["Mulai", project.startDate ?? "-"],
      ["Selesai", project.endDate ?? "-"],
      ["SKP", project.skp ?? "-"],
      ["Lokasi", project.lokasi ?? "-"],
    ];
    for (const [label, value] of meta) {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 50, y);
      y += 6;
    }

    // Labels
    if (project.labels.length > 0) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.text("Labels:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(project.labels.map((l) => l.name).join(", "), 40, y);
      y += 8;
    }

    // Milestones
    if (milestones.length > 0) {
      y += 4;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Milestones", 14, y);
      y += 4;
      (doc as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable({
        startY: y,
        head: [["Milestone", "Target", "Status"]],
        body: milestones.map((m) => [
          m.title,
          m.targetDate ?? "-",
          m.isCompleted ? "Selesai" : "Belum",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Tasks
    if (tasks.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Tasks", 14, y);
      y += 4;
      (doc as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable({
        startY: y,
        head: [["Task", "Assignee", "Status", "Due Date", "Milestone"]],
        body: tasks.map((t) => [
          t.title,
          t.assigneeName ?? "-",
          t.status.replace(/_/g, " "),
          t.dueDate ?? "-",
          t.milestoneId
            ? milestones.find((m) => m.id === t.milestoneId)?.title ?? "-"
            : "-",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Members
    if (members.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Members", 14, y);
      y += 4;
      (doc as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable({
        startY: y,
        head: [["Nama", "Email", "Role"]],
        body: members.map((m) => [
          m.namaLengkap ?? "-",
          m.email ?? "-",
          m.role,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      });
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${project.title.replace(/[^a-zA-Z0-9]/g, "_")}_summary.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Forbidden") return NextResponse.json({ error: "Anda tidak memiliki akses ke project ini." }, { status: 403 });
    if (message === "Unauthorized") return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
