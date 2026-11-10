import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";

const schema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(120),
  departmentId: z.string().min(1, "Pilih departemen"),
  positionId: z.string().optional(),
  description: z.string().trim().min(20, "Deskripsi minimal 20 karakter").max(4000),
  requirements: z.string().trim().max(2000).optional(),
  employmentType: z.enum(["PERMANENT", "FIXED_TERM", "INTERNSHIP"]).default("PERMANENT"),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE", "FIELD"]).default("HYBRID"),
  location: z.string().trim().max(120).optional(),
  openings: z.coerce.number().int().min(1).max(50).default(1),
  salaryMin: z.coerce.number().min(0).optional(),
  salaryMax: z.coerce.number().min(0).optional(),
  status: z.enum(["DRAFT", "OPEN"]).default("DRAFT"),
});

export const POST = apiRoute({
  permission: "recruitment.manage",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const department = await prisma.department.findFirst({ where: { id: input.departmentId, tenantId: user.tenantId } });
    if (!department) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(422, "Departemen tidak valid untuk tenant ini.");
    }

    const count = await prisma.jobVacancy.count({ where: { tenantId: user.tenantId } });
    const vacancy = await prisma.jobVacancy.create({
      data: {
        tenantId: user.tenantId,
        title: input.title,
        code: `VAC-${department.code}-${String(count + 1).padStart(3, "0")}`,
        departmentId: input.departmentId,
        positionId: input.positionId || null,
        description: input.description,
        requirements: input.requirements,
        employmentType: input.employmentType,
        workMode: input.workMode,
        location: input.location,
        openings: input.openings,
        salaryMin: input.salaryMin !== undefined ? new Decimal(input.salaryMin) : null,
        salaryMax: input.salaryMax !== undefined ? new Decimal(input.salaryMax) : null,
        status: input.status,
        publishedAt: input.status === "OPEN" ? new Date() : null,
        closingDate: new Date(Date.now() + 45 * 86400000),
      },
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "recruitment.vacancy_created",
      module: "rekrutmen",
      entityType: "JobVacancy",
      entityId: vacancy.id,
      metadata: { title: vacancy.title, code: vacancy.code, status: vacancy.status },
      req,
    });

    return { id: vacancy.id, code: vacancy.code };
  },
});
