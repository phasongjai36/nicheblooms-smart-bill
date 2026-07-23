import { createFileRoute } from "@tanstack/react-router";
import { supabase, supabaseAdmin } from "@/lib/supabase";

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEET_ID || "1uHZZeh1epL2656CQrCJ4QsSQDDJ5TNQ42jpiXaXvCac";
const SHEET_NAME = "spayleter";

// Helper for Service Account auth with dynamic ignored imports
async function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!privateKey || !clientEmail) {
    throw new Error("Missing sheets credentials in environment variables.");
  }

  // /* @vite-ignore */ prevents Vite from analyzing/bundling this package for client-side router files
  const { google } = await import(/* @vite-ignore */ "googleapis");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return { auth, google };
}

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          console.log("LINE Webhook received:", JSON.stringify(body));

          const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
          if (!token) {
            return new Response("LINE_CHANNEL_ACCESS_TOKEN not set", { status: 500 });
          }

          if (!body || !body.events) {
            return new Response("No events found", { status: 200 });
          }

          for (const event of body.events) {
            if (event.type === "follow" || event.type === "message") {
              const userId = event.source?.userId;
              if (!userId) continue;

              // 1. Fetch user's LINE Profile to get their display name
              let displayName = "ลูกค้าใหม่";
              try {
                const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });
                if (profileRes.ok) {
                  const profile = await profileRes.json();
                  displayName = profile.displayName || "ลูกค้าใหม่";
                  console.log(
                    `Webhook resolved LINE display name: ${displayName} for UID: ${userId}`,
                  );
                }
              } catch (profileError) {
                console.error("Failed to fetch LINE profile:", profileError);
              }

              // 2. ค้นหาและจับคู่ผู้ใช้งานเพื่อผูก LINE UID อัตโนมัติ (Auto-Mapping) ทั้ง Google Sheets และ Supabase
              let matchedCustomer = displayName;

              // --- A. ดึงข้อมูลและอัปเดตบน Supabase (ระบบใหม่) ---
              try {
                const client = supabaseAdmin || supabase;
                const { data: dbCustomers } = await client.from("customers").select("*");

                // ค้นหาลูกค้าที่ตรงกับ LINE User ID นี้ หรือมีชื่อตรงกับ LINE Display Name
                const matchedDbCust = (dbCustomers || []).find(
                  (c) =>
                    c.line_uid === userId ||
                    (c.customer_name &&
                      (c.customer_name.toLowerCase().trim() === displayName.toLowerCase().trim() ||
                        c.customer_name.toLowerCase().includes(displayName.toLowerCase()) ||
                        displayName.toLowerCase().includes(c.customer_name.toLowerCase()))),
                );

                if (matchedDbCust) {
                  matchedCustomer = matchedDbCust.customer_name;
                  if (matchedDbCust.line_uid !== userId) {
                    console.log(
                      `🔗 Supabase Auto-Mapping: พบชื่อลูกค้า "${matchedDbCust.customer_name}" ที่ตรงกัน! กำลังผูก LINE UID: ${userId} โดยอัตโนมัติ`,
                    );
                    const { error: updateError } = await client
                      .from("customers")
                      .update({ line_uid: userId })
                      .eq("id", matchedDbCust.id);

                    if (updateError) {
                      console.error("❌ ล้มเหลวในการผูก LINE UID บน Supabase:", updateError);
                    } else {
                      console.log("✅ ผูก LINE UID บน Supabase เรียบร้อยแล้ว!");
                    }
                  }
                }
              } catch (dbError) {
                console.error("🚨 ระบบค้นหาและผูก UID อัตโนมัติบน Supabase ขัดข้อง:", dbError);
              }

              // --- B. ค้นหาและอัปเดตบน Google Sheets (ระบบจำลอง/เดิม) ---
              try {
                const { auth, google } = await getAuth();
                const sheets = google.sheets({ version: "v4", auth });

                const res = await sheets.spreadsheets.values.get({
                  spreadsheetId: SPREADSHEET_ID,
                  range: `${SHEET_NAME}!A2:C1000`, // คอลัมน์: No, Customer Name, LINE UID
                });

                const rows = res.data.values || [];
                let matchedRowIndex: number | null = null;

                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i];
                  const customerName = (row[1] ?? "").trim();
                  const existingUid = (row[2] ?? "").trim();

                  if (existingUid === userId) {
                    matchedRowIndex = i + 2;
                    matchedCustomer = customerName;
                    break;
                  }

                  // จับคู่ชื่อลูกค้าระหว่าง Sheets กับ LINE Profile
                  if (
                    customerName &&
                    (customerName.toLowerCase() === displayName.toLowerCase() ||
                      customerName.toLowerCase().includes(displayName.toLowerCase()) ||
                      displayName.toLowerCase().includes(customerName.toLowerCase()))
                  ) {
                    matchedRowIndex = i + 2;
                    matchedCustomer = customerName;
                  }
                }

                if (matchedRowIndex) {
                  console.log(
                    `🔗 Sheets Auto-Mapping: พบแถวลูกค้าแถวที่ ${matchedRowIndex} ใน Sheets! กำลังเขียน LINE UID`,
                  );
                  await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAME}!C${matchedRowIndex}`,
                    valueInputOption: "USER_ENTERED",
                    range_majorDimension: "ROWS",
                    requestBody: {
                      values: [[userId]],
                    },
                  });
                } else {
                  console.log(`ℹ️ ไม่พบรายชื่อตรงกันโดยตรงใน Sheets สำหรับคุณ ${displayName}`);
                }
              } catch (sheetError) {
                console.error(
                  "🚨 ระบบค้นหาและผูก UID อัตโนมัติบน Google Sheets ขัดข้อง:",
                  sheetError,
                );
              }

              // 4. Send Premium LINE Flex Message with billing link
              const baseUrl =
                process.env.APP_BASE_URL ||
                process.env.VITE_APP_BASE_URL ||
                "https://your-project.vercel.app";
              const billLink = `${baseUrl}/bill?uid=${userId}`;

              const flexContents = {
                type: "bubble",
                hero: {
                  type: "image",
                  url: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop",
                  size: "full",
                  aspectRatio: "20:13",
                  aspectMode: "cover",
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  contents: [
                    {
                      type: "text",
                      text: "NICHE BLOOM",
                      weight: "bold",
                      color: "#0d3b2e",
                      size: "sm",
                      tracking: "0.12em",
                    },
                    {
                      type: "text",
                      text: `สวัสดีค่ะ คุณ ${matchedCustomer} ✨`,
                      weight: "bold",
                      size: "xl",
                      margin: "md",
                      color: "#111111",
                    },
                    {
                      type: "text",
                      text: "ยินดีต้อนรับสู่ระบบแจ้งบิลผ่อนชำระอัตโนมัติค่ะ กดปุ่มด้านล่างเพื่อตรวจสอบบิลส่วนตัวและแจ้งชำระเงินได้ทันทีค่ะ",
                      size: "xs",
                      color: "#666666",
                      wrap: true,
                      margin: "md",
                    },
                  ],
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      height: "sm",
                      color: "#c9a86a",
                      action: {
                        type: "uri",
                        label: "ดูบิลส่วนตัวของฉัน 💳",
                        uri: billLink,
                      },
                    },
                  ],
                  flex: 1,
                },
              };

              const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  to: userId,
                  messages: [
                    {
                      type: "flex",
                      altText: "ยินดีต้อนรับสู่ NICHE BLOOM ค่ะ 💚",
                      contents: flexContents,
                    },
                  ],
                }),
              });

              if (!lineRes.ok) {
                const errBody = await lineRes.text();
                console.error("LINE Messaging API error:", errBody);
              } else {
                console.log(`Welcoming Flex Message pushed to LINE user ${userId} successfully`);
              }
            }
          }

          return new Response("OK", { status: 200 });
        } catch (err) {
          console.error("Webhook route error:", err);
          return new Response(`Error: ${(err as Error).message}`, { status: 500 });
        }
      },
    },
  },
});
