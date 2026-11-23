import { apiError, apiOk } from "@/lib/api";
import { generateStatement } from "@/lib/services/statements";
import { requireClient } from "@/lib/session";
import { statementRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = statementRequestSchema.parse(await request.json());
    const statement = await generateStatement({
      companyId: session.companyId,
      year: data.year,
      month: data.month,
      actorId: session.sub,
    });
    return apiOk({ ok: true, id: statement.id, number: statement.statementNumber });
  } catch (error) {
    return apiError(error);
  }
}
