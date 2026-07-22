import { supabaseAdmin } from "./supabase";
import masterDb from "./latest_master.json";

async function seed() {
  if (!supabaseAdmin) {
    console.error("❌ Error: supabaseAdmin is not initialized. Please ensure SUPABASE_SECRET_KEY is set in your .env or .env.local.");
    return;
  }

  console.log("🌱 Starting seed process to Supabase...");

  // 1. นำเข้าข้อมูล Customers
  const customersToInsert = masterDb.customers.map((c) => ({
    customer_number: c["Customer Number"],
    customer_name: c["ชื่อลูกค้า"],
    line_uid: c["UID (LINE)"] || null,
    contact_info: c["ที่อยู่ / ข้อมูลติดต่อ"] || null,
  }));

  console.log(`Inserting ${customersToInsert.length} customers...`);
  const { error: custError } = await supabaseAdmin
    .from("customers")
    .upsert(customersToInsert, { onConflict: "customer_number" });

  if (custError) {
    console.error("❌ Error inserting customers:", custError);
    return;
  }
  console.log("✅ Customers inserted successfully!");

  // 2. นำเข้าข้อมูล Contracts
  const contractsToInsert = masterDb.contracts.map((c) => ({
    customer_number: c["Customer Number"],
    item: c["รายการ"],
    full_price: Number(c["ราคาเต็ม"]) || 0.0,
    installment: Number(c["ยอดผ่อน"]) || 0.0,
    current_period: Number(c["งวดที่"]) || 1,
    total_periods: Number(c["จำนวนงวด"]) || 1,
    notification_day: c["วันแจ้งเตือน"] || null,
    status: "ค้างชำระ",
    due_date: "5",
    late_fee_rate: 50.0,
  }));

  console.log(`Inserting ${contractsToInsert.length} contracts...`);
  const { error: contractError } = await supabaseAdmin
    .from("contracts")
    .insert(contractsToInsert);

  if (contractError) {
    console.error("❌ Error inserting contracts:", contractError);
    return;
  }
  console.log("✅ Contracts inserted successfully!");
  console.log("🎉 Supabase seeding completed successfully!");
}

seed().catch(console.error);
