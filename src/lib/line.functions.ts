import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

const ItemSchema = z.object({
  item: z.string().max(200),
  installment: z.number().nonnegative(),
  currentPeriod: z.number().nonnegative(),
  totalPeriods: z.number().nonnegative(),
  status: z.string().max(60).optional().default(""),
});

const InputSchema = z.object({
  lineUserId: z.string().min(10).max(64).regex(/^U[0-9a-f]{32}$/i, "LINE UID ไม่ถูกต้อง"),
  customer: z.string().min(1).max(120),
  totalInstallment: z.number().nonnegative(),
  totalRemaining: z.number().nonnegative(),
  items: z.array(ItemSchema).min(1).max(30),
  customMessage: z.string().max(2000).optional(),
});

const fmt = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const baht = (n: number) => `฿${fmt.format(n)}`;

function buildMessage(data: z.infer<typeof InputSchema>) {
  if (data.customMessage && data.customMessage.trim()) return data.customMessage.trim();
  const lines: string[] = [];
  lines.push(`สวัสดีคุณ ${data.customer} 🙏`);
  lines.push(`แจ้งเตือนรายการผ่อนชำระประจำเดือน`);
  lines.push("");
  for (const it of data.items) {
    const remain = Math.max(it.totalPeriods - it.currentPeriod, 0);
    lines.push(`• ${it.item}`);
    lines.push(`   งวด ${it.currentPeriod}/${it.totalPeriods} · ${baht(it.installment)}/เดือน`);
    if (remain > 0) lines.push(`   เหลืออีก ${remain} งวด`);
  }
  lines.push("");
  lines.push(`ยอดรวมต่อเดือน: ${baht(data.totalInstallment)}`);
  lines.push(`คงค้างทั้งหมด: ${baht(data.totalRemaining)}`);
  lines.push("");
  lines.push(`ขอบคุณที่ใช้บริการ 💚`);
  return lines.join("\n");
}

export const sendLineNotification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return { ok: false as const, error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" };
    }

    const text = buildMessage(data);

    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: data.lineUserId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("LINE push failed", res.status, body);
      return {
        ok: false as const,
        error: `LINE API ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    return { ok: true as const, message: text };
  });
