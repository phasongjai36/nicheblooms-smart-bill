import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import masterDb from "./latest_master.json";
import { supabase, supabaseAdmin } from "./supabase";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "1uHZZeh1epL2656CQrCJ4QsSQDDJ5TNQ42jpiXaXvCac";
const SHEET_NAME = "spayleter";

export type BillRow = {
  rowIndex: number; // 1-based row number in the sheet (header is row 1)
  no: string;
  customer: string;
  lineUserId: string;
  item: string;
  fullPrice: number;
  installment: number;
  currentPeriod: number;
  totalPeriods: number;
  slipUrl: string;
  slipDate: string;
  status: string;
  dueDate?: string; // Column L
  lateFeeRate?: number; // Column M
};

export type CustomerGroup = {
  customer: string;
  lineUserId: string;
  items: BillRow[];
  totalInstallment: number;
  totalRemaining: number;
  totalFullPrice: number;
};

const num = (v: unknown) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Global in-memory cache for the simulator to allow full write persistence during local testing
let simulatedBills: BillRow[] | null = null;

function checkIsSimulator() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  return (
    !privateKey ||
    privateKey.includes("กรอก_") ||
    privateKey.includes("your_") ||
    !clientEmail ||
    clientEmail.includes("กรอก_") ||
    clientEmail.includes("your_")
  );
}

function initSimulatedBills() {
  if (simulatedBills) return;
  const customers = masterDb.customers;
  const contracts = masterDb.contracts;

  simulatedBills = contracts.map((c, i) => {
    const cust = customers.find((cust) => cust["Customer Number"] === c["Customer Number"]) || {
      "ชื่อลูกค้า": "ลูกค้าทั่วไป",
      "UID (LINE)": "",
    };
    return {
      rowIndex: i + 2,
      no: c["Customer Number"] || `CNNB${String(i + 1).padStart(3, "0")}`,
      customer: cust["ชื่อลูกค้า"],
      lineUserId: cust["UID (LINE)"],
      item: c["รายการ"] || "",
      fullPrice: num(c["ราคาเต็ม"]),
      installment: num(c["ยอดผ่อน"]),
      currentPeriod: num(c["งวดที่"]),
      totalPeriods: num(c["จำนวนงวด"]),
      slipUrl: "",
      slipDate: "",
      status: "ค้างชำระ",
      dueDate: "5",
      lateFeeRate: 50,
    };
  });
}

// Auto-seeding logic for Supabase when the database is freshly initialized
async function autoSeedSupabaseIfNeeded() {
  if (!supabaseAdmin) {
    console.warn("⚠️ Warning: Supabase Admin client is not initialized, skipping auto-seeding.");
    return;
  }

  try {
    const { count, error } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("❌ Error checking customers count:", error);
      return;
    }

    if (count === 0) {
      console.log("🌱 Supabase is empty! Performing auto-seeding...");

      // 1. Seed Customers
      const customersToInsert = masterDb.customers.map((c) => ({
        customer_number: c["Customer Number"],
        customer_name: c["ชื่อลูกค้า"],
        line_uid: c["UID (LINE)"] || null,
        contact_info: c["ที่อยู่ / ข้อมูลติดต่อ"] || null,
      }));

      const { error: custError } = await supabaseAdmin
        .from("customers")
        .upsert(customersToInsert, { onConflict: "customer_number" });

      if (custError) {
        console.error("❌ Auto-seed customers error:", custError);
        return;
      }

      // 2. Seed Contracts
      const contractsToInsert = masterDb.contracts.map((c) => ({
        customer_number: c["Customer Number"],
        item: c["รายการ"],
        full_price: num(c["ราคาเต็ม"]),
        installment: num(c["ยอดผ่อน"]),
        current_period: num(c["งวดที่"]),
        total_periods: num(c["จำนวนงวด"]),
        notification_day: c["วันแจ้งเตือน"] || null,
        status: "ค้างชำระ",
        due_date: "5",
        late_fee_rate: 50,
      }));

      const { error: contractError } = await supabaseAdmin
        .from("contracts")
        .insert(contractsToInsert);

      if (contractError) {
        console.error("❌ Auto-seed contracts error:", contractError);
        return;
      }

      console.log("🎉 Auto-seed successfully completed on Supabase database!");
    }
  } catch (err) {
    console.error("❌ Exception during Supabase auto-seeding:", err);
  }
}

// Direct service account authentication helper with dynamic ignored import
async function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is missing. " +
      "Please set them in your .env.local file to connect to Google Sheets."
    );
  }

  // /* @vite-ignore */ prevents Vite from analyzing/bundling this package for client
  const { google } = await import(/* @vite-ignore */ "googleapis");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive"
    ],
  });

  return { auth, google };
}

// Fetch all bill records directly from Supabase, Google Sheets, or the local database simulator
export const fetchBills = createServerFn({ method: "GET" }).handler(async () => {
  const isSupabase = process.env.DATABASE_PROVIDER === "supabase";

  if (isSupabase) {
    try {
      console.log("🔌 Database Provider: SUPABASE (Active)");
      
      // ตรวจสอบและ Auto-Seed ข้อมูลเบื้องต้นถ้าไม่มีข้อมูลในฐานข้อมูล
      await autoSeedSupabaseIfNeeded();

      const client = supabaseAdmin || supabase;

      // 1. ดึงข้อมูลจาก Supabase
      const { data: customers, error: custError } = await client.from("customers").select("*");
      const { data: contracts, error: contrError } = await client.from("contracts").select("*").order("created_at", { ascending: true });

      if (custError || contrError) {
        throw new Error(`Supabase query failed: ${custError?.message || contrError?.message}`);
      }

      // 2. แปรรูปข้อมูลให้อยู่ในโมเดล BillRow
      const rows: BillRow[] = (contracts || []).map((c, i) => {
        const cust = (customers || []).find((cust) => cust.customer_number === c.customer_number) || {
          customer_name: "ลูกค้าทั่วไป",
          line_uid: "",
        };
        return {
          rowIndex: i + 2, // รักษาตำแหน่งดัชนีจำลองไว้สำหรับการเข้ากันได้กับระบบเดิม
          no: c.customer_number,
          customer: cust.customer_name,
          lineUserId: cust.line_uid || "",
          item: c.item,
          fullPrice: Number(c.full_price),
          installment: Number(c.installment),
          currentPeriod: Number(c.current_period),
          totalPeriods: Number(c.total_periods),
          slipUrl: c.slip_url || "",
          slipDate: c.slip_date || "",
          status: c.status,
          dueDate: c.due_date || "5",
          lateFeeRate: Number(c.late_fee_rate) || 50,
        };
      });

      // 3. จัดกลุ่มรายชื่อลูกค้า (Customer Grouping)
      const map = new Map<string, CustomerGroup>();
      for (const row of rows) {
        const key = row.lineUserId || row.customer;
        let g = map.get(key);
        if (!g) {
          g = {
            customer: row.customer,
            lineUserId: row.lineUserId,
            items: [],
            totalInstallment: 0,
            totalRemaining: 0,
            totalFullPrice: 0,
          };
          map.set(key, g);
        }
        g.items.push(row);
        g.totalInstallment += row.installment;
        g.totalFullPrice += row.fullPrice;
        const remainingPeriods = Math.max(row.totalPeriods - row.currentPeriod, 0);
        g.totalRemaining += row.installment * remainingPeriods;
      }

      const groups = Array.from(map.values()).sort((a, b) =>
        a.customer.localeCompare(b.customer, "th")
      );

      const totals = {
        customers: groups.length,
        activeBills: rows.length,
        monthlyDue: groups.reduce((s, g) => s + g.totalInstallment, 0),
        outstanding: groups.reduce((s, g) => s + g.totalRemaining, 0),
        paid: rows.filter((r) => /ชำระ|paid|จ่าย/i.test(r.status)).length,
        pending: rows.filter((r) => !/ชำระ|paid|จ่าย/i.test(r.status)).length,
      };

      return { rows, groups, totals, provider: "supabase" };
    } catch (e) {
      console.error("🚨 Supabase fetch failed. Falling back to Google Sheets/Simulator...", e);
    }
  }

  // Fallback: แหล่งข้อมูลดั้งเดิม (Google Sheets / Simulator Mode)
  const isSimulator = checkIsSimulator();

  if (isSimulator) {
    console.log("⚡ Running in Google Sheets SIMULATOR Mode. Using high-fidelity local master database.");
    initSimulatedBills();
    
    const rows = simulatedBills!;
    const map = new Map<string, CustomerGroup>();
    for (const row of rows) {
      const key = row.lineUserId || row.customer;
      let g = map.get(key);
      if (!g) {
        g = {
          customer: row.customer,
          lineUserId: row.lineUserId,
          items: [],
          totalInstallment: 0,
          totalRemaining: 0,
          totalFullPrice: 0,
        };
        map.set(key, g);
      }
      g.items.push(row);
      g.totalInstallment += row.installment;
      g.totalFullPrice += row.fullPrice;
      const remainingPeriods = Math.max(row.totalPeriods - row.currentPeriod, 0);
      g.totalRemaining += row.installment * remainingPeriods;
    }

    const groups = Array.from(map.values()).sort((a, b) =>
      a.customer.localeCompare(b.customer, "th")
    );

    const totals = {
      customers: groups.length,
      activeBills: rows.length,
      monthlyDue: groups.reduce((s, g) => s + g.totalInstallment, 0),
      outstanding: groups.reduce((s, g) => s + g.totalRemaining, 0),
      paid: rows.filter((r) => /ชำระ|paid|จ่าย/i.test(r.status)).length,
      pending: rows.filter((r) => !/ชำระ|paid|จ่าย/i.test(r.status)).length,
    };

    return { rows, groups, totals, provider: "simulator" };
  }

  try {
    const { auth, google } = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:M1000`,
    });

    const values = res.data.values ?? [];
    const rows: BillRow[] = values
      .filter((r) => r.length > 0 && (r[1] ?? "").trim() !== "")
      .map((r, i) => ({
        rowIndex: i + 2,
        no: r[0] ?? "",
        customer: r[1] ?? "",
        lineUserId: r[2] ?? "",
        item: r[3] ?? "",
        fullPrice: num(r[4]),
        installment: num(r[5]),
        currentPeriod: num(r[6]),
        totalPeriods: num(r[7]),
        slipUrl: r[8] ?? "",
        slipDate: r[9] ?? "",
        status: r[10] ?? "",
        dueDate: r[11] ?? "5",
        lateFeeRate: r[12] !== undefined ? num(r[12]) : 50,
      }));

    // Group by LINE user id (fallback to customer name)
    const map = new Map<string, CustomerGroup>();
    for (const row of rows) {
      const key = row.lineUserId || row.customer;
      let g = map.get(key);
      if (!g) {
        g = {
          customer: row.customer,
          lineUserId: row.lineUserId,
          items: [],
          totalInstallment: 0,
          totalRemaining: 0,
          totalFullPrice: 0,
        };
        map.set(key, g);
      }
      g.items.push(row);
      g.totalInstallment += row.installment;
      g.totalFullPrice += row.fullPrice;
      const remainingPeriods = Math.max(row.totalPeriods - row.currentPeriod, 0);
      g.totalRemaining += row.installment * remainingPeriods;
    }

    const groups = Array.from(map.values()).sort((a, b) =>
      a.customer.localeCompare(b.customer, "th")
    );

    const totals = {
      customers: groups.length,
      activeBills: rows.length,
      monthlyDue: groups.reduce((s, g) => s + g.totalInstallment, 0),
      outstanding: groups.reduce((s, g) => s + g.totalRemaining, 0),
      paid: rows.filter((r) => /ชำระ|paid|จ่าย/i.test(r.status)).length,
      pending: rows.filter((r) => !/ชำระ|paid|จ่าย/i.test(r.status)).length,
    };

    return { rows, groups, totals, provider: "sheets" };
  } catch (error) {
    console.error("Direct Google Sheets fetch failed:", error);
    throw error;
  }
});

const UpdateInputSchema = z.object({
  rowIndex: z.number().positive(),
  status: z.string(),
  slipUrl: z.string().optional(),
  slipDate: z.string().optional(),
  amount: z.number().optional(),
  sender: z.string().optional(),
  transRef: z.string().optional(),
});

// Update bill status and log changes directly via Supabase, Google Sheets, or local database simulator
export const updateBillStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateInputSchema.parse(input))
  .handler(async ({ data }) => {
    const isSupabase = process.env.DATABASE_PROVIDER === "supabase";

    if (isSupabase) {
      try {
        console.log(`🔌 Supabase: Updating status for row index ${data.rowIndex} to state: ${data.status}`);
        const client = supabaseAdmin || supabase;

        // 1. ดึงสัญญาทั้งหมดเพื่อค้นหาตามลำดับแถว (หรือสามารถคิวรีด้วยคีย์เฉพาะถ้ามี)
        const { data: contracts, error: contrError } = await client
          .from("contracts")
          .select("*")
          .order("created_at", { ascending: true });

        if (contrError) throw contrError;

        const contract = (contracts || [])[data.rowIndex - 2];
        if (contract) {
          let nextPeriod = contract.current_period;
          if (/ชำระแล้ว|paid|จ่ายแล้ว/i.test(data.status)) {
            nextPeriod = Math.min(contract.current_period + 1, contract.total_periods);
          }

          // อัปเดตข้อมูลสัญญาใน Supabase
          const { error: updateError } = await client
            .from("contracts")
            .update({
              status: data.status,
              slip_url: data.slipUrl || null,
              slip_date: data.slipDate || new Date().toLocaleString("th-TH"),
              current_period: nextPeriod,
            })
            .eq("id", contract.id);

          if (updateError) throw updateError;
          console.log(`✅ Supabase contract status updated successfully for: ${contract.id}`);

          // บันทึกประวัติการจ่ายเงินลงตาราง payment_logs บน Supabase (แบบเรียลไทม์)
          try {
            await client
              .from("payment_logs")
              .insert({
                row_index: data.rowIndex,
                status: data.status,
                slip_url: data.slipUrl || null,
                slip_date: data.slipDate || new Date().toLocaleString("th-TH"),
                amount: data.amount || Number(contract.installment) || 0.00,
                sender: data.sender || null,
                trans_ref: data.transRef || null,
              });
            console.log("✅ Supabase: Payment log inserted successfully!");
          } catch (logError) {
            console.warn("⚠️ Warning: Failed to insert payment log in Supabase:", logError);
          }

          return { ok: true };
        } else {
          console.error("❌ Supabase contract match not found for index:", data.rowIndex);
        }
      } catch (err) {
        console.error("🚨 Supabase bill status update failed:", err);
      }
    }

    // Fallback: แหล่งข้อมูลดั้งเดิม (Google Sheets / Simulator Mode)
    const isSimulator = checkIsSimulator();

    if (isSimulator) {
      console.log(`⚡ Simulator updating rowIndex: ${data.rowIndex} to state: ${data.status}`);
      initSimulatedBills();
      
      const item = simulatedBills!.find((b) => b.rowIndex === data.rowIndex);
      if (item) {
        item.status = data.status;
        item.slipUrl = data.slipUrl ?? "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=200";
        item.slipDate = data.slipDate ?? new Date().toLocaleString("th-TH");
        // Simulate local period increment logic if paid
        if (/ชำระแล้ว|paid|จ่ายแล้ว/i.test(data.status)) {
          item.currentPeriod = Math.min(item.currentPeriod + 1, item.totalPeriods);
        }
      }
      return { ok: true };
    }

    try {
      const { auth, google } = await getAuth();
      const sheets = google.sheets({ version: "v4", auth });

      // 1. Update the row status and slip details in spayleter sheet
      const range = `${SHEET_NAME}!I${data.rowIndex}:K${data.rowIndex}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              data.slipUrl ?? "",
              data.slipDate ?? "",
              data.status
            ]
          ]
        }
      });

      // 2. Log payment in Payment_Logs sheet (Robust fallback so failure here doesn't crash the main status update)
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Payment_Logs!A:H",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [
              [
                new Date().toLocaleString("th-TH"),
                `Row ${data.rowIndex}`,
                data.status,
                data.slipUrl ?? "",
                data.slipDate ?? "",
                data.amount ?? 0,
                data.sender ?? "",
                data.transRef ?? "",
              ]
            ]
          }
        });
      } catch (logError) {
        console.warn("Payment log append failed (Payment_Logs sheet might be missing or locked):", logError);
        // Do not fail the outer operation if only logging failed
      }

      return { ok: true };
    } catch (error) {
      console.error("Direct Google Sheets status update failed:", error);
      throw error;
    }
  });

const EditInputSchema = z.object({
  rowIndex: z.number().positive(),
  installment: z.number().positive(),
  dueDate: z.string(),
  lateFeeRate: z.number().nonnegative(),
  currentPeriod: z.number().nonnegative(),
  totalPeriods: z.number().positive(),
});

export const editBillRow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EditInputSchema.parse(input))
  .handler(async ({ data }) => {
    const isSupabase = process.env.DATABASE_PROVIDER === "supabase";

    if (isSupabase) {
      try {
        console.log(`🔌 Supabase: Editing contract for row index ${data.rowIndex}`);
        const client = supabaseAdmin || supabase;

        const { data: contracts, error: contrError } = await client
          .from("contracts")
          .select("*")
          .order("created_at", { ascending: true });

        if (contrError) throw contrError;

        const contract = (contracts || [])[data.rowIndex - 2];
        if (contract) {
          const { error: updateError } = await client
            .from("contracts")
            .update({
              installment: data.installment,
              due_date: data.dueDate,
              late_fee_rate: data.lateFeeRate,
              current_period: data.currentPeriod,
              total_periods: data.totalPeriods,
            })
            .eq("id", contract.id);

          if (updateError) throw updateError;
          console.log(`✅ Supabase contract details updated successfully: ${contract.id}`);
          return { ok: true };
        }
      } catch (err) {
        console.error("🚨 Supabase contract edit failed:", err);
      }
    }

    // Fallback: แหล่งข้อมูลดั้งเดิม (Google Sheets / Simulator Mode)
    const isSimulator = checkIsSimulator();

    if (isSimulator) {
      console.log(`⚡ Simulator editing rowIndex: ${data.rowIndex}`);
      initSimulatedBills();
      const item = simulatedBills!.find((b) => b.rowIndex === data.rowIndex);
      if (item) {
        item.installment = data.installment;
        item.dueDate = data.dueDate;
        item.lateFeeRate = data.lateFeeRate;
        item.currentPeriod = data.currentPeriod;
        item.totalPeriods = data.totalPeriods;
      }
      return { ok: true };
    }

    try {
      const { auth, google } = await getAuth();
      const sheets = google.sheets({ version: "v4", auth });

      // 1. Update Column F (installment), Column G (currentPeriod), Column H (totalPeriods)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!F${data.rowIndex}:H${data.rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[data.installment, data.currentPeriod, data.totalPeriods]],
        },
      });

      // 2. Update Column L (dueDate), Column M (lateFeeRate)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!L${data.rowIndex}:M${data.rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[data.dueDate, data.lateFeeRate]],
        },
      });

      return { ok: true };
    } catch (error) {
      console.error("Direct Google Sheets edit row failed:", error);
      throw error;
    }
  });

const CreateInputSchema = z.object({
  no: z.string(),
  customer: z.string(),
  lineUserId: z.string().optional(),
  item: z.string(),
  fullPrice: z.number().positive(),
  installment: z.number().positive(),
  currentPeriod: z.number().nonnegative(),
  totalPeriods: z.number().positive(),
  dueDate: z.string().default("5"),
  lateFeeRate: z.number().nonnegative().default(50),
});

export const createBillRow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInputSchema.parse(input))
  .handler(async ({ data }) => {
    const isSupabase = process.env.DATABASE_PROVIDER === "supabase";

    if (isSupabase) {
      try {
        console.log(`🔌 Supabase: Creating new bill/contract and customer for ${data.customer}`);
        const client = supabaseAdmin || supabase;

        // 1. ตรวจสอบหรือสร้างข้อมูลผู้ใช้ในตาราง customers ก่อน (หรืออัปเดตแบบ Upsert)
        const { error: custError } = await client
          .from("customers")
          .upsert(
            {
              customer_number: data.no,
              customer_name: data.customer,
              line_uid: data.lineUserId || null,
            },
            { onConflict: "customer_number" }
          );

        if (custError) throw custError;

        // 2. เพิ่มรายการสัญญาเงินกู้/สัญญาผ่อนชำระ
        const { error: contractError } = await client
          .from("contracts")
          .insert({
            customer_number: data.no,
            item: data.item,
            full_price: data.fullPrice,
            installment: data.installment,
            current_period: data.currentPeriod,
            total_periods: data.totalPeriods,
            status: "ค้างชำระ",
            due_date: data.dueDate,
            late_fee_rate: data.lateFeeRate,
          });

        if (contractError) throw contractError;
        console.log(`✅ Supabase: Successfully created user and contract row for: ${data.customer}`);
        return { ok: true };
      } catch (err) {
        console.error("🚨 Supabase contract creation failed:", err);
      }
    }

    // Fallback: แหล่งข้อมูลดั้งเดิม (Google Sheets / Simulator Mode)
    const isSimulator = checkIsSimulator();

    if (isSimulator) {
      console.log(`⚡ Simulator creating new bill row for: ${data.customer}`);
      initSimulatedBills();
      
      const newRow: BillRow = {
        rowIndex: simulatedBills!.length + 2,
        no: data.no || `CNNB${String(simulatedBills!.length + 1).padStart(3, "0")}`,
        customer: data.customer,
        lineUserId: data.lineUserId || "",
        item: data.item,
        fullPrice: data.fullPrice,
        installment: data.installment,
        currentPeriod: data.currentPeriod,
        totalPeriods: data.totalPeriods,
        slipUrl: "",
        slipDate: "",
        status: "ค้างชำระ",
        dueDate: data.dueDate,
        lateFeeRate: data.lateFeeRate,
      };
      
      simulatedBills!.push(newRow);
      return { ok: true };
    }

    try {
      const { auth, google } = await getAuth();
      const sheets = google.sheets({ version: "v4", auth });

      // Append row to spayleter sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:M`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              data.no,
              data.customer,
              data.lineUserId || "",
              data.item,
              data.fullPrice,
              data.installment,
              data.currentPeriod,
              data.totalPeriods,
              "", // slipUrl
              "", // slipDate
              "ค้างชำระ", // status
              data.dueDate,
              data.lateFeeRate,
            ]
          ]
        }
      });

      return { ok: true };
    } catch (error) {
      console.error("Direct Google Sheets create bill row failed:", error);
      throw error;
    }
  });

export interface PaymentLog {
  id: string;
  createdAt: string;
  rowIndex: number | null;
  status: string;
  slipUrl: string | null;
  slipDate: string | null;
  amount: number;
  sender: string | null;
  transRef: string | null;
  customerName?: string;
  itemName?: string;
}

// Fetch transaction history log directly from Supabase payment_logs or simulator fallback
export const fetchPaymentLogs = createServerFn({ method: "GET" })
  .handler(async (): Promise<PaymentLog[]> => {
    const isSupabase = process.env.DATABASE_PROVIDER === "supabase";

    if (isSupabase) {
      try {
        console.log("🔌 Supabase: Fetching payment logs...");
        const client = supabaseAdmin || supabase;

        // ดึงข้อมูล logs จัดลำดับจากใหม่สุด
        const { data: logs, error: logsError } = await client
          .from("payment_logs")
          .select("*")
          .order("created_at", { ascending: false });

        if (logsError) throw logsError;

        // ดึงสัญญากลางและลูกค้าเพื่อแม็ปข้อมูลชื่อลูกค้าและสินค้า
        const { data: contracts } = await client.from("contracts").select("*");
        const { data: customers } = await client.from("customers").select("*");

        return (logs || []).map((l: any) => {
          const contract = (contracts || []).find((_, idx) => (idx + 2) === l.row_index);
          const customer = contract 
            ? (customers || []).find((c) => c.customer_number === contract.customer_number)
            : null;

          return {
            id: l.id,
            createdAt: l.created_at,
            rowIndex: l.row_index,
            status: l.status,
            slipUrl: l.slip_url,
            slipDate: l.slip_date,
            amount: Number(l.amount) || 0.00,
            sender: l.sender,
            transRef: l.trans_ref,
            customerName: customer?.customer_name || "ลูกค้าทั่วไป",
            itemName: contract?.item || "งวดผ่อนชำระ",
          };
        });
      } catch (err) {
        console.error("🚨 Supabase payment logs query failed:", err);
        return [];
      }
    }

    // Fallback: ข้อมูลการทำธุรกรรมจำลอง
    const mockLogs: PaymentLog[] = [
      {
        id: "log-1",
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        rowIndex: 2,
        status: "ชำระแล้ว",
        slipUrl: "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=200",
        slipDate: "22/07/2026, 20:30:15",
        amount: 2500,
        sender: "นาย ณัฐพล",
        transRef: "202607229871512",
        customerName: "สมชาย มีทอง",
        itemName: "iPhone 15 Pro Max 256GB",
      },
      {
        id: "log-2",
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        rowIndex: 3,
        status: "ชำระแล้ว",
        slipUrl: "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=200",
        slipDate: "21/07/2026, 15:45:00",
        amount: 1800,
        sender: "น.ส. สุรีย์",
        transRef: "202607214451299",
        customerName: "พัชราภา เลิศดี",
        itemName: "iPad Air 5 Wifi 64GB",
      }
    ];
    return mockLogs;
  });

