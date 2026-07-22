import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef } from "react";
import {
  Wallet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Upload,
  X,
  Loader2,
  Check,
  QrCode,
  ArrowUpRight,
  Shield,
  RefreshCw,
  PhoneCall,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { fetchBills, updateBillStatus, type CustomerGroup, type BillRow } from "@/lib/sheet.functions";
import { scanSlipWithAi, type SlipDetails } from "@/lib/gemini.functions";
import { uploadSlipToDrive } from "@/lib/drive.functions";
import { toast, Toaster } from "sonner";

// Retrieve PROMPTPAY_ID server-side to prevent exposing .env variables directly on the client if desired,
// or provide a simple server-side endpoint.
import { createServerFn } from "@tanstack/react-start";

export const getPromptPayId = createServerFn({ method: "GET" }).handler(async () => {
  return process.env.PROMPTPAY_ID || "0886272148";
});

export const Route = createFileRoute("/bill")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      uid: (search.uid as string) || undefined,
      customer: (search.customer as string) || undefined,
    };
  },
  component: CustomerBillPortal,
});

const fmt = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const baht = (n: number) => `฿${fmt.format(n)}`;

function CustomerBillPortal() {
  const queryClient = useQueryClient();
  const { uid, customer: searchCustomerName } = Route.useSearch();

  const fetchFn = useServerFn(fetchBills);
  const updateStatusFn = useServerFn(updateBillStatus);
  const scanSlipFn = useServerFn(scanSlipWithAi);
  const uploadSlipFn = useServerFn(uploadSlipToDrive);
  const getPromptPayFn = useServerFn(getPromptPayId);

  // Load sheets data
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["bills"],
    queryFn: () => fetchFn(),
  });

  // Load PromptPay ID from server env
  const { data: promptPayId } = useQuery({
    queryKey: ["promptPayId"],
    queryFn: () => getPromptPayFn(),
    placeholderData: "0886272148",
  });

  // Client-side Slip Upload / Scanning State
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDetails, setScannedDetails] = useState<SlipDetails | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Match the user group safely based on uid or customer name fallback
  const customerGroup = useMemo(() => {
    if (!data) return null;
    
    // First, try matching by LINE UID
    if (uid) {
      const match = data.groups.find((g) => g.lineUserId?.toLowerCase() === uid.toLowerCase());
      if (match) return match;
    }
    
    // Fallback: match by Customer Name
    if (searchCustomerName) {
      const match = data.groups.find(
        (g) => g.customer.toLowerCase().trim() === searchCustomerName.trim().toLowerCase()
      );
      if (match) return match;
    }
    
    return null;
  }, [data, uid, searchCustomerName]);

  // Compute pending installment summary for this user
  const pendingAmount = useMemo(() => {
    if (!customerGroup) return 0;
    return customerGroup.items
      .filter((row) => !/ชำระ|paid|จ่าย/i.test(row.status))
      .reduce((sum, row) => sum + row.installment, 0);
  }, [customerGroup]);

  // Helper to calculate late days and late fee for a row
  const getLateFeeInfo = (row: BillRow) => {
    if (/ชำระ|paid|จ่าย/i.test(row.status)) return { lateDays: 0, lateFee: 0 };
    
    const today = new Date();
    const currentDay = today.getDate();
    
    let dueDay = 5;
    if (row.dueDate) {
      const match = row.dueDate.match(/\d+/);
      if (match) dueDay = parseInt(match[0], 10);
    }
    
    if (currentDay > dueDay) {
      const lateDays = currentDay - dueDay;
      const rate = row.lateFeeRate !== undefined ? row.lateFeeRate : 50;
      return { lateDays, lateFee: lateDays * rate };
    }
    return { lateDays: 0, lateFee: 0 };
  };

  // Compute total late fee
  const totalLateFee = useMemo(() => {
    if (!customerGroup) return 0;
    return customerGroup.items
      .reduce((sum, row) => sum + getLateFeeInfo(row).lateFee, 0);
  }, [customerGroup]);

  // Total amount to pay (Installment + Late Fee)
  const totalAmountToPay = useMemo(() => {
    return pendingAmount + totalLateFee;
  }, [pendingAmount, totalLateFee]);

  // Handle Drag/Upload
  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipFile(file);
    setScannedDetails(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanSlip = async () => {
    if (!slipPreview) return;
    setIsScanning(true);
    try {
      const commaIdx = slipPreview.indexOf(",");
      const prefix = slipPreview.slice(0, commaIdx + 1);
      const pureBase64 = slipPreview.slice(commaIdx + 1);

      const parsed = await scanSlipFn({
        data: {
          imagePrefix: prefix,
          base64Data: pureBase64,
          fileName: slipFile?.name || "slip.png",
        },
      });

      setScannedDetails(parsed);
      toast.success("AI วิเคราะห์สลิปโอนเงินเสร็จสิ้นแล้วค่ะ!");
    } catch (e) {
      toast.error(`สแกนล้มเหลว: ${(e as Error).message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!customerGroup || !scannedDetails) return;
    setSavingResult(true);
    try {
      // Find the first pending bill row of this customer to apply the payment
      const pendingBills = customerGroup.items.filter((r) => !/ชำระ|paid|จ่าย/i.test(r.status));
      if (pendingBills.length === 0) {
        toast.error("คุณไม่มีบิลค้างชำระประจำเดือนนี้ให้บันทึกค่ะ");
        return;
      }

      // We'll choose the bill row that closest matches the installment amount, or the first pending bill
      let targetBill = pendingBills[0];
      const exactMatch = pendingBills.find((b) => Math.abs(b.installment - scannedDetails.amount) < 10);
      if (exactMatch) {
        targetBill = exactMatch;
      }

      let slipUrl = "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=200";

      // Upload file directly to Google Drive if preview is loaded
      if (slipPreview && slipFile) {
        try {
          const commaIdx = slipPreview.indexOf(",");
          const pureBase64 = slipPreview.slice(commaIdx + 1);

          toast.loading("กำลังบันทึกสลิปโอนเงินของคุณลงใน Google Drive...", { id: "drive-upload" });

          const uploadRes = await uploadSlipFn({
            data: {
              fileName: slipFile.name || "slip.png",
              base64Data: pureBase64,
              customerNumber: targetBill.no || "CNNB_UNKNOWN",
              mimeType: slipFile.type || "image/png",
            },
          });

          if (uploadRes?.url) {
            slipUrl = uploadRes.url;
            toast.success("อัปโหลดสลิปลง Google Drive สำเร็จค่ะ!", { id: "drive-upload" });
          } else {
            toast.warn("อัปโหลดสลิปเรียบร้อยแต่ไม่พบ URL ตอบกลับ", { id: "drive-upload" });
          }
        } catch (uploadError) {
          console.error("Failed to upload slip to Google Drive:", uploadError);
          toast.error("อัปโหลดสลิปล้มเหลว กำลังใช้การบันทึกสถานะแบบปกติค่ะ...", { id: "drive-upload" });
        }
      }

      // Call sheet sync function with service account
      const today = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
      await updateStatusFn({
        data: {
          rowIndex: targetBill.rowIndex,
          status: "ชำระแล้ว",
          slipUrl: slipUrl,
          slipDate: `${today} (${scannedDetails.time || "โอนสำเร็จ"})`,
          amount: scannedDetails.amount,
          sender: scannedDetails.sender,
          transRef: scannedDetails.transactionId,
        },
      });

      toast.success(`แจ้งชำระบิล "${targetBill.item}" สำเร็จแล้วค่ะ! ระบบกำลังอัปเดตแผ่นงานของทางร้าน...`);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      
      // Reset state
      setSlipFile(null);
      setSlipPreview(null);
      setScannedDetails(null);
    } catch (e) {
      toast.error(`บันทึกชำระเงินล้มเหลว: ${(e as Error).message}`);
    } finally {
      setSavingResult(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdfcfa] text-[#0d3b2e] p-6">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="mt-4 text-xs text-muted-foreground animate-pulse font-medium">
          กำลังเรียกคืนบิลส่วนตัวของคุณอัจฉริยะ...
        </p>
      </div>
    );
  }

  if (!customerGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[var(--background)] to-[var(--secondary)] flex items-center justify-center p-4 text-[var(--foreground)]">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl p-8 border border-[var(--border)] shadow-2xl text-center space-y-6 relative overflow-hidden">
          {/* Subtle background flowers decoration */}
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[var(--primary)]/5 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-[var(--accent)]/5 blur-xl pointer-events-none" />

          <NicheBloomsLogo size="md" className="mx-auto opacity-95" />
          
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <AlertCircle className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="font-display font-black text-xl tracking-tight text-[var(--primary)]">ไม่พบประวัติบิลส่วนตัวของคุณ</h1>
            <p className="text-sm text-[var(--foreground)]/75 leading-relaxed">
              ขออภัยอย่างยิ่งค่ะ ระบบไม่พบเอกสารบิลผ่อนชำระด้วยรหัสประจำตัวนี้ กรุณาติดต่อทางทีมงานนักการตลาดร้านดอกไม้เพื่อความถูกต้องนะคะ
            </p>
          </div>

          <div className="pt-2">
            <a
              href="https://line.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-line py-3 text-xs font-bold text-white hover:opacity-90 transition-all w-full shadow-lg shadow-line/20"
            >
              <span>ติดต่อแอดมินผ่าน LINE</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen invoice-premium-bg text-[var(--foreground)] font-sans antialiased selection:bg-[var(--primary)]/10 pb-20 relative">
      <Toaster position="top-center" richColors />

      {/* Glow Ornaments removed/hidden to perfectly showcase the premium textured watercolor background */}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 relative z-10 space-y-6">
        
        {/* NicheBlooms Centralized Brand Banner */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-[var(--border)]/70 shadow-sm text-center relative overflow-hidden">
          {/* Botanical lines subtle decoration background */}
          <div className="absolute top-2 left-2 opacity-[0.03] select-none pointer-events-none text-left">
            ❀ 🌸 🌿
          </div>
          <NicheBloomsLogo size="md" className="mx-auto" />
        </div>

        {/* Portal Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6 pt-2">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl grid place-items-center text-white font-display font-extrabold text-lg shadow-lg relative overflow-hidden"
                 style={{ background: "var(--gradient-brand)" }}>
              {customerGroup.customer.replace(/[^\u0E00-\u0E7Fa-zA-Z]/g, "").slice(0, 1) || "?"}
            </div>
            <div>
              <h1 className="font-display font-extrabold text-2xl text-[var(--primary)] tracking-tight flex items-center gap-2">
                <span>บิลส่วนตัวของคุณ</span>
                <span className="text-[var(--accent)] font-bold text-xs px-2.5 py-0.5 bg-[var(--accent)]/10 rounded-full border border-[var(--border)]">
                  {customerGroup.customer}
                </span>
              </h1>
              <p className="text-xs text-[#8a6d3b] mt-1 font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#0d3b2e]" />
                <span>ความปลอดภัยสูง · แสดงข้อมูลเฉพาะบุคคลของคุณเท่านั้น</span>
              </p>
            </div>
          </div>

          <button 
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-end sm:self-auto p-2.5 rounded-xl bg-white/70 border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:text-[var(--primary)] transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            title="ดึงข้อมูลล่าสุด"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Dynamic Financial Overview */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-[var(--border)] p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--secondary-foreground)] uppercase tracking-widest block">ยอดค้างชำระเดือนนี้</span>
              <p className="font-display text-4xl font-black mt-2 text-[var(--primary)] tracking-tight">
                {baht(pendingAmount)}
              </p>
            </div>
            <p className="text-[10px] text-[var(--secondary-foreground)]/80 mt-4 pt-3 border-t border-[var(--border)]">
              {pendingAmount > 0 
                ? "💡 กรุณาชำระยอดงวดปัจจุบันให้ครบถ้วนเพื่อผลประโยชน์และคะแนนเครดิตที่ดีของคุณค่ะ" 
                : "🎉 คุณได้ทำการชำระยอดงวดปัจจุบันเรียบร้อยแล้ว ขอบพระคุณอย่างสูงค่ะ"}
            </p>
          </div>

          <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-[var(--border)] p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-[var(--secondary-foreground)] uppercase tracking-widest block">คงเหลือยอดปิดบัญชีทั้งหมด</span>
              <p className="font-display text-4xl font-black mt-2 text-[var(--secondary-foreground)] tracking-tight">
                {baht(customerGroup.totalRemaining)}
              </p>
            </div>
            <p className="text-[10px] text-[var(--secondary-foreground)]/80 mt-4 pt-3 border-t border-[var(--border)]">
              สะสมจากรายการผ่อนชำระทั้งหมด {customerGroup.items.length} รายการ
            </p>
          </div>
        </section>

        {/* Main Interface Columns */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Block: Active Bills (7 Columns on desktop) */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display font-extrabold text-base text-[var(--primary)] flex items-center gap-2">
              <span>รายการผ่อนชำระปัจจุบัน</span>
              <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-ping" />
            </h2>

            <div className="space-y-4">
              {customerGroup.items.map((row, idx) => {
                const pct = row.totalPeriods > 0 ? Math.min(100, Math.round((row.currentPeriod / row.totalPeriods) * 100)) : 0;
                const paid = /ชำระ|paid|จ่าย/i.test(row.status);

                return (
                  <article key={idx} className="rounded-2xl bg-white/80 backdrop-blur-md border border-[var(--border)] p-5 shadow-lg space-y-4 hover:border-[var(--accent)]/40 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-sm text-[var(--primary)]">{row.item}</h3>
                        <p className="text-[10px] text-[var(--secondary-foreground)] mt-1 font-medium">
                          งวดปัจจุบัน: <span className="font-semibold text-[var(--primary)] font-mono">{row.currentPeriod} / {row.totalPeriods}</span>
                        </p>
                      </div>
                      <div>
                        {paid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--border)] px-2.5 py-0.5 text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3" /> ชำระแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] border border-[var(--border)] px-2.5 py-0.5 text-[10px] font-bold">
                            <AlertCircle className="h-3 w-3" /> รอชำระ
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 border-t border-b border-[var(--border)] py-3 text-xs">
                      <div>
                        <span className="text-[var(--secondary-foreground)] text-[10px] block font-medium">ยอดที่ผ่อนต่องวด</span>
                        <span className="font-bold text-[var(--primary)] text-sm">{baht(row.installment)}</span>
                      </div>
                      <div>
                        <span className="text-[var(--secondary-foreground)] text-[10px] block font-medium">ราคาเต็มสินค้า</span>
                        <span className="font-semibold text-[var(--secondary-foreground)]/80 text-sm">{baht(row.fullPrice)}</span>
                      </div>
                    </div>

                    {!paid && getLateFeeInfo(row).lateFee > 0 && (
                      <div className="bg-red-50 border border-red-200/50 rounded-xl p-3 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-red-700 block">ชำระล่าช้าเกิน {getLateFeeInfo(row).lateDays} วัน</span>
                          <span className="text-[10px] text-[var(--secondary-foreground)]">กำหนดชำระภายในวันที่ {row.dueDate || "5"} ของเดือน</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--secondary-foreground)] block">ค่าปรับ ({row.lateFeeRate || 50}฿/วัน)</span>
                          <span className="font-extrabold text-red-600">+{baht(getLateFeeInfo(row).lateFee)}</span>
                        </div>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-[var(--secondary-foreground)]">
                        <span>ความคืบหน้าผ่อน</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--primary)]/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Right Block: Dynamic Payment & Slip upload (5 Columns on desktop) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Dynamic PromptPay QR */}
            {pendingAmount > 0 ? (
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-[var(--border)] p-6 shadow-xl space-y-5 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-[var(--accent)]/10 blur-xl pointer-events-none" />
                
                <div className="flex items-center justify-center gap-1.5">
                  <QrCode className="h-5 w-5 text-[var(--primary)]" />
                  <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">สแกนจ่ายผ่านพร้อมเพย์</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-[var(--secondary-foreground)] font-medium">ยอดเงินสแกนจ่ายสุทธิงวดนี้</p>
                  <p className="font-display text-3xl font-black text-[var(--primary)] tracking-tight">
                    {baht(totalAmountToPay)}
                  </p>
                  {totalLateFee > 0 && (
                    <div className="text-[10px] text-[var(--secondary-foreground)] bg-[var(--secondary)] border border-[var(--border)] p-2.5 rounded-xl mt-1.5 space-y-0.5 max-w-[240px] mx-auto">
                      <div className="flex justify-between gap-4">
                        <span>ยอดผ่อนงวดปัจจุบัน:</span>
                        <span className="font-semibold">{baht(pendingAmount)}</span>
                      </div>
                      <div className="flex justify-between gap-4 text-red-600 font-semibold">
                        <span>ค่าปรับชำระล่าช้า:</span>
                        <span>+{baht(totalLateFee)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* PromptPay QR Frame */}
                <div className="bg-white p-4 rounded-2xl w-48 h-44 mx-auto flex items-center justify-center shadow-md border border-[var(--border)] relative">
                  <img
                    src={`https://promptpay.io/${promptPayId}/${totalAmountToPay}.png`}
                    alt="PromptPay QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="space-y-1 text-center">
                  <p className="text-[10px] text-[var(--secondary-foreground)] font-mono">พร้อมเพย์ ID: {promptPayId}</p>
                  <p className="text-[9px] text-[var(--primary)] font-semibold bg-[var(--primary)]/10 py-1 px-3 rounded-full inline-block border border-[var(--primary)]/10">
                    ✓ คิวอาร์โค้ดสร้างขึ้นตามยอดจริงอัตโนมัติ
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white/50 border border-[var(--primary)]/10 p-6 shadow-xl text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-[var(--primary)]/10 grid place-items-center text-[var(--primary)] mx-auto">
                  <Check className="h-6 w-6" />
                </div>
                <h3 className="font-display font-extrabold text-sm text-[var(--primary)]">ชำระยอดงวดปัจจุบันเรียบร้อย</h3>
                <p className="text-xs text-[var(--secondary-foreground)]/80 leading-relaxed">
                  คุณไม่มีบิลผ่อนชำระคงค้างในรอบบิลเดือนนี้ค่ะ ขอบพระคุณอย่างสูงสำหรับการชำระยอดที่ตรงเวลาอันยอดเยี่ยมเสมอมานะคะ! 💖
                </p>
              </div>
            )}

            {/* Slip Uploader and AI verification for customer */}
            {pendingAmount > 0 && (
              <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-[var(--border)] p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5 text-[var(--primary)]" />
                  <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">แจ้งโอนเงินด้วย AI</span>
                </div>

                {/* Image Drop Area */}
                <div>
                  {slipPreview ? (
                    <div className="relative w-full h-[180px] rounded-xl overflow-hidden border border-[var(--border)] bg-black/5 flex items-center justify-center shadow-inner">
                      <img src={slipPreview} alt="Slip" className="object-contain w-full h-full max-h-[160px]" />
                      {isScanning && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center">
                          {/* Laser line animation */}
                          <div className="absolute left-0 right-0 h-1 bg-[var(--primary)] shadow-[0_0_12px_2px_var(--primary)] animate-scan" />
                          <div className="p-2 bg-[var(--primary)] rounded-xl flex flex-col items-center gap-1.5 border border-[var(--border)]">
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                            <span className="text-[10px] font-semibold text-white">AI กำลังตรวจสอบสลิป...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-[140px] border border-dashed border-[var(--border)] hover:border-[var(--primary)] bg-[var(--secondary)]/50 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all active:scale-98 shadow-sm group"
                    >
                      <div className="h-9 w-9 rounded-full bg-[var(--primary)]/5 grid place-items-center text-[var(--primary)] group-hover:scale-110 transition-transform mb-3 border border-[var(--border)]">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-[var(--primary)]">อัปโหลดสลิปที่หน้านี้</span>
                      <span className="text-[10px] text-[var(--secondary-foreground)]/80 mt-1 max-w-[180px]">
                        แตะเพื่อเลือกภาพหลักฐานสลิปโอนเงินของคุณ
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleSlipChange}
                    className="hidden"
                  />
                </div>

                {/* Bottom Actions for AI verify */}
                {slipPreview && !isScanning && (
                  <div className="space-y-3">
                    {!scannedDetails ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSlipFile(null);
                            setSlipPreview(null);
                            setScannedDetails(null);
                          }}
                          className="p-2 text-destructive bg-destructive/10 hover:bg-destructive/25 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4 text-[var(--secondary-foreground)]" />
                        </button>
                        <button
                          onClick={handleScanSlip}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[var(--primary)] text-white font-semibold text-xs py-2.5 rounded-xl hover:opacity-95 active:scale-95 transition-all shadow-md"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>ให้ AI ตรวจสอบสลิป</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Extracted Details block */}
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5 mb-2">
                            <span className="text-[9px] uppercase font-bold text-[var(--secondary-foreground)]">ผลวิเคราะห์ออโต้</span>
                            {scannedDetails.isValid ? (
                              <span className="text-[9px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded-md border border-[var(--primary)]/20">✓ สลิปถูกต้อง</span>
                            ) : (
                              <span className="text-[9px] font-bold bg-[#e48aaa]/10 text-[#e48aaa] px-1.5 py-0.5 rounded-md border border-[#e48aaa]/20">⚠️ ไม่สมบูรณ์</span>
                            )}
                          </div>
                          
                          <div className="space-y-1 font-sans">
                            <div className="flex justify-between">
                              <span className="text-[var(--secondary-foreground)] text-[10px]">ผู้โอน:</span>
                              <span className="font-semibold text-[var(--primary)] truncate max-w-[140px]">{scannedDetails.sender}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--secondary-foreground)] text-[10px]">ยอดโอน:</span>
                              <span className="font-bold text-[var(--primary)]">{baht(scannedDetails.amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--secondary-foreground)] text-[10px]">วันเวลาโอน:</span>
                              <span className="text-[var(--primary)] font-mono text-[10px]">{scannedDetails.date} ({scannedDetails.time})</span>
                            </div>
                          </div>
                        </div>

                        {/* Record check down button */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setScannedDetails(null);
                            }}
                            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-white border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors text-[var(--secondary-foreground)]"
                          >
                            แก้ไขรูปภาพ
                          </button>
                          <button
                            onClick={handleConfirmPayment}
                            disabled={savingResult || !scannedDetails.isValid}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] py-2 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                          >
                            {savingResult ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-white" />
                                <span>กำลังบันทึกชีต...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>ส่งสลิปแจ้งยอด</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-10 text-center space-y-1 border-t border-[var(--border)]">
          <p className="text-[10px] text-[var(--secondary-foreground)] font-medium">
            NicheBlooms Smart Bill Portal · เชื่อมข้อมูลเข้ารหัสความปลอดภัย SSL
          </p>
          <p className="text-[9px] text-[var(--secondary-foreground)]/60 font-medium">
            ระบบจัดทำและบริหารจัดการบิลอัจฉริยะสำหรับลูกค้าคนสำคัญของเรา ❀
          </p>
        </footer>
      </main>
    </div>
  );
}
