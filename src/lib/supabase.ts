import { createClient } from "@supabase/supabase-js";

// 1. ดึงค่าตัวแปรระบบสำหรับการเชื่อมต่อ (รองรับทั้งฝั่ง Client และ Server-side)
const supabaseUrl = 
  (typeof window !== "undefined" ? import.meta.env.VITE_SUPABASE_URL : undefined) ||
  process.env.SUPABASE_URL ||
  "";

const supabaseAnonKey = 
  (typeof window !== "undefined" ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined) ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

// 2. สร้าง Standard Client (สำหรับดึงข้อมูลทั่วไป)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Warning: Supabase URL หรือ Anon/Publishable Key ยังไม่ได้ระบุใน Environment Variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 3. สร้าง Admin/Service Role Client (สำหรับทำงานเบื้องหลังหรือ Bypass RLS บนฝั่ง Server-side เท่านั้น)
const supabaseServiceKey = 
  typeof window === "undefined" ? process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;

export const supabaseAdmin = 
  typeof window === "undefined" && supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;
