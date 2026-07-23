import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef } from "react";
import {
  Wallet,
  Users,
  AlertCircle,
  CheckCircle2,
  ScanLine,
  Send,
  RefreshCw,
  Search,
  ExternalLink,
  Receipt,
  TrendingUp,
  Clipboard,
  Check,
  Sparkles,
  Upload,
  X,
  Loader2,
  ArrowUpRight,
  FileText,
  ChevronDown,
  Info,
  Pencil,
  Plus,
} from "lucide-react";
import {
  fetchBills,
  updateBillStatus,
  editBillRow,
  createBillRow,
  fetchPaymentLogs,
  type CustomerGroup,
  type BillRow,
  type PaymentLog,
} from "@/lib/sheet.functions";
import { sendLineNotification } from "@/lib/line.functions";
import { scanSlipWithAi, type SlipDetails } from "@/lib/gemini.functions";
import { toast, Toaster } from "sonner";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ChartTooltip } from "recharts";
import { NicheBloomsLogo } from "@/components/NicheBloomsLogo";
import { BotanicalDecor } from "@/components/BotanicalDecor";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const fmt = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const baht = (n: number) => `฿${fmt.format(n)}`;

// Premium NicheBlooms Mock Data
const NICHEBLOOMS_MOCK_DATA = {
  provider: "local_simulator",
  totals: {
    customers: 4,
    monthlyDue: 18500,
    outstanding: 74000,
    paid: 1,
    activeBills: 4,
  },
  rows: [
    {
      rowIndex: 2,
      no: "CNNB001",
      customer: "คุณพศิน (Niche Club)",
      lineUserId: "U1122334455",
      item: "ช่อกุหลาบเอกวาดอร์สีแชมเปญพรีเมียม",
      fullPrice: 24000,
      installment: 2000,
      currentPeriod: 3,
      totalPeriods: 12,
      slipUrl: "",
      slipDate: "",
      status: "ค้างชำระ",
      dueDate: "5",
      lateFeeRate: 50,
    },
    {
      rowIndex: 3,
      no: "CNNB002",
      customer: "คุณณัฏฐ์ (Niche VIP)",
      lineUserId: "U9988776655",
      item: "ชุดจัดดอกไม้ตกแต่งงานเลี้ยงพฤกษศาสตร์ออร์แกนิก",
      fullPrice: 120000,
      installment: 10000,
      currentPeriod: 1,
      totalPeriods: 12,
      slipUrl: "",
      slipDate: "",
      status: "ค้างชำระ",
      dueDate: "5",
      lateFeeRate: 50,
    },
    {
      rowIndex: 4,
      no: "CNNB003",
      customer: "คุณกมลวรรณ (Niche Premium)",
      lineUserId: "U5566778899",
      item: "แจกันสลักแก้วก้านทิวลิปฮอลแลนด์สเปเชียล",
      fullPrice: 18000,
      installment: 1500,
      currentPeriod: 2,
      totalPeriods: 12,
      slipUrl: "https://fake-slip-storage.example.com/demo-tulip",
      slipDate: "2026-07-22 14:30:00",
      status: "ชำระแล้ว",
      dueDate: "5",
      lateFeeRate: 50,
    },
    {
      rowIndex: 5,
      no: "CNNB004",
      customer: "คุณจิรายุ (Niche Classic)",
      lineUserId: "U4433221100",
      item: "ซุ้มประตูดอกไม้สดไฮเดรนเยียสีกุหลาบ",
      fullPrice: 60000,
      installment: 5000,
      currentPeriod: 4,
      totalPeriods: 12,
      slipUrl: "",
      slipDate: "",
      status: "ค้างชำระ",
      dueDate: "10",
      lateFeeRate: 50,
    },
  ],
  groups: [
    {
      customer: "คุณพศิน (Niche Club)",
      lineUserId: "U1122334455",
      totalInstallment: 2000,
      totalRemaining: 20000,
      totalFullPrice: 24000,
      items: [
        {
          rowIndex: 2,
          no: "CNNB001",
          customer: "คุณพศิน (Niche Club)",
          lineUserId: "U1122334455",
          item: "ช่อกุหลาบเอกวาดอร์สีแชมเปญพรีเมียม",
          fullPrice: 24000,
          installment: 2000,
          currentPeriod: 3,
          totalPeriods: 12,
          slipUrl: "",
          slipDate: "",
          status: "ค้างชำระ",
          dueDate: "5",
          lateFeeRate: 50,
        },
      ],
    },
    {
      customer: "คุณณัฏฐ์ (Niche VIP)",
      lineUserId: "U9988776655",
      totalInstallment: 10000,
      totalRemaining: 120000,
      totalFullPrice: 120000,
      items: [
        {
          rowIndex: 3,
          no: "CNNB002",
          customer: "คุณณัฏฐ์ (Niche VIP)",
          lineUserId: "U9988776655",
          item: "ชุดจัดดอกไม้ตกแต่งงานเลี้ยงพฤกษศาสตร์ออร์แกนิก",
          fullPrice: 120000,
          installment: 10000,
          currentPeriod: 1,
          totalPeriods: 12,
          slipUrl: "",
          slipDate: "",
          status: "ค้างชำระ",
          dueDate: "5",
          lateFeeRate: 50,
        },
      ],
    },
    {
      customer: "คุณกมลวรรณ (Niche Premium)",
      lineUserId: "U5566778899",
      totalInstallment: 0,
      totalRemaining: 15000,
      totalFullPrice: 18000,
      items: [
        {
          rowIndex: 4,
          no: "CNNB003",
          customer: "คุณกมลวรรณ (Niche Premium)",
          lineUserId: "U5566778899",
          item: "แจกันสลักแก้วก้านทิวลิปฮอลแลนด์สเปเชียล",
          fullPrice: 18000,
          installment: 1500,
          currentPeriod: 2,
          totalPeriods: 12,
          slipUrl: "https://fake-slip-storage.example.com/demo-tulip",
          slipDate: "2026-07-22 14:30:00",
          status: "ชำระแล้ว",
          dueDate: "5",
          lateFeeRate: 50,
        },
      ],
    },
    {
      customer: "คุณจิรายุ (Niche Classic)",
      lineUserId: "U4433221100",
      totalInstallment: 5000,
      totalRemaining: 40000,
      totalFullPrice: 60000,
      items: [
        {
          rowIndex: 5,
          no: "CNNB004",
          customer: "คุณจิรายุ (Niche Classic)",
          lineUserId: "U4433221100",
          item: "ซุ้มประตูดอกไม้สดไฮเดรนเยียสีกุหลาบ",
          fullPrice: 60000,
          installment: 5000,
          currentPeriod: 4,
          totalPeriods: 12,
          slipUrl: "",
          slipDate: "",
          status: "ค้างชำระ",
          dueDate: "10",
          lateFeeRate: 50,
        },
      ],
    },
  ],
};

const MOCK_PAYMENT_LOGS: PaymentLog[] = [
  {
    id: "LOG_001",
    createdAt: "2026-07-22T14:30:00Z",
    customerName: "คุณกมลวรรณ (Niche Premium)",
    itemName: "แจกันสลักแก้วก้านทิวลิปฮอลแลนด์สเปเชียล",
    amount: 1500,
    status: "ชำระแล้ว",
    sender: "คุณกมลวรรณ",
    transRef: "01620314300098374",
    slipUrl: "https://fake-slip-storage.example.com/demo-tulip",
    slipDate: "2026-07-22 14:30:00",
  },
];

function Dashboard() {
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(fetchBills);
  const updateStatusFn = useServerFn(updateBillStatus);
  const scanSlipFn = useServerFn(scanSlipWithAi);
  const editBillFn = useServerFn(editBillRow);
  const createBillFn = useServerFn(createBillRow);
  const fetchLogsFn = useServerFn(fetchPaymentLogs);

  const {
    data: serverData,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["bills"],
    queryFn: () => fetchFn(),
  });

  const {
    data: serverLogs,
    isLoading: isLogsLoading,
    isFetching: isLogsFetching,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["paymentLogs"],
    queryFn: () => fetchLogsFn(),
  });

  // Client-Side Local State Bypass for seamless local offline testing
  const [localBills, setLocalBills] = useState<BillRow[] | null>(null);
  const [localLogs, setLocalLogs] = useState<PaymentLog[] | null>(null);

  // Auto-sync or initialize local memory state
  const resolvedData = useMemo(() => {
    let activeBillsList: BillRow[] = [];

    if (localBills) {
      activeBillsList = localBills;
    } else if (serverData && serverData.rows && serverData.rows.length > 0) {
      activeBillsList = serverData.rows;
    } else {
      activeBillsList = NICHEBLOOMS_MOCK_DATA.rows;
    }

    // Process and group the current activeBillsList
    const groupsMap = new Map<string, BillRow[]>();
    activeBillsList.forEach((row) => {
      // Create a unique key for grouping (either lineUserId or customer name)
      const key =
        row.lineUserId && row.lineUserId.trim() ? row.lineUserId.trim() : row.customer.trim();
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(row);
    });

    const groups: CustomerGroup[] = Array.from(groupsMap.entries()).map(([key, items]) => {
      const first = items[0];
      // Total installment is the sum of installments of unpaid bills in current cycle
      const totalInstallment = items.reduce(
        (sum, item) => sum + (!/ชำระ|paid|จ่าย/i.test(item.status) ? item.installment : 0),
        0,
      );

      // Calculate remaining based on installments left
      const totalRemaining = items.reduce((sum, item) => {
        const isPaid = /ชำระ|paid|จ่าย/i.test(item.status);
        const periodsLeft = Math.max(0, item.totalPeriods - item.currentPeriod + (isPaid ? 0 : 1));
        return sum + item.installment * periodsLeft;
      }, 0);
      const totalFullPrice = items.reduce((sum, item) => sum + item.fullPrice, 0);

      return {
        customer: first.customer,
        lineUserId: first.lineUserId || "",
        items,
        totalInstallment,
        totalRemaining,
        totalFullPrice,
      };
    });

    // Recalculate totals
    const customersCount = groups.length;
    const activeBillsCount = activeBillsList.length;
    const paidCount = activeBillsList.filter((r) =>
      /ชำระแล้ว|paid|จ่ายแล้ว/i.test(r.status),
    ).length;
    const outstandingSum = activeBillsList.reduce(
      (sum, r) => (!/ชำระ|paid|จ่าย/i.test(r.status) ? sum + r.installment : sum),
      0,
    );
    const monthlyDueSum = activeBillsList.reduce((sum, r) => sum + r.installment, 0);

    return {
      provider: localBills ? "local_simulator" : serverData?.provider || "local_simulator",
      rows: activeBillsList,
      groups,
      totals: {
        customers: customersCount,
        monthlyDue: monthlyDueSum,
        outstanding: outstandingSum,
        paid: paidCount,
        activeBills: activeBillsCount,
      },
    };
  }, [serverData, localBills]);

  const resolvedLogs = useMemo(() => {
    if (localLogs) return localLogs;
    if (serverLogs && serverLogs.length > 0) return serverLogs;
    return MOCK_PAYMENT_LOGS;
  }, [serverLogs, localLogs]);

  const [activeTab, setActiveTab] = useState<"customers" | "logs">("customers");
  const [q, setQ] = useState("");

  // Modals / Overlays state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLinePreviewOpen, setIsLinePreviewOpen] = useState(false);
  const [selectedGroupForLine, setSelectedGroupForLine] = useState<CustomerGroup | null>(null);
  const [customLineMessage, setCustomMessage] = useState("");
  const [copiedText, setCopiedText] = useState(false);
  const [sendingLine, setSendingLine] = useState(false);

  // Edit Bill Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRowToEdit, setSelectedRowToEdit] = useState<BillRow | null>(null);
  const [editInstallment, setEditInstallment] = useState<number>(0);
  const [editCurrentPeriod, setEditCurrentPeriod] = useState<number>(0);
  const [editTotalPeriods, setEditTotalPeriods] = useState<number>(0);
  const [editDueDate, setEditDueDate] = useState<string>("5");
  const [editLateFeeRate, setEditLateFeeRate] = useState<number>(50);
  const [savingEdit, setSavingEdit] = useState(false);

  // Create Bill Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerNo, setNewCustomerNo] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newFullPrice, setNewFullPrice] = useState<number>(0);
  const [newInstallment, setNewInstallment] = useState<number>(0);
  const [newCurrentPeriod, setNewCurrentPeriod] = useState<number>(1);
  const [newTotalPeriods, setNewTotalPeriods] = useState<number>(12);
  const [newDueDate, setNewDueDate] = useState<string>("5");
  const [newLateFeeRate, setNewLateFeeRate] = useState<number>(50);
  const [newLineUserId, setNewLineUserId] = useState("");
  const [savingCreate, setSavingCreate] = useState(false);

  // Scanner upload and scan state
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDetails, setScannedDetails] = useState<SlipDetails | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Matching customer & bill row state
  const [selectedMatchRowIndex, setSelectedMatchRowIndex] = useState<number | null>(null);
  const [savingScanResult, setSavingScanResult] = useState(false);

  // Clickable state for manual status edit loader
  const [updatingRowId, setUpdatingRowId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return resolvedData.groups;
    return resolvedData.groups.filter(
      (g) =>
        g.customer.toLowerCase().includes(term) ||
        g.lineUserId.toLowerCase().includes(term) ||
        g.items.some((i) => i.item.toLowerCase().includes(term)),
    );
  }, [resolvedData, q]);

  // Calculations for donut chart
  const chartData = useMemo(() => {
    // Calculate total collected vs total remaining
    const totalFull = resolvedData.rows.reduce((sum, r) => sum + r.installment * r.totalPeriods, 0);
    const remaining = resolvedData.totals.outstanding;
    const collected = Math.max(0, totalFull - remaining);

    return [
      { name: "เก็บเงินแล้ว", value: collected, color: "var(--secondary-foreground)" },
      { name: "ยังค้างชำระ", value: remaining, color: "var(--border)" },
    ];
  }, [resolvedData]);

  const onManualToggleStatus = async (row: BillRow) => {
    setUpdatingRowId(row.rowIndex);
    const newStatus = /ชำระ|paid|จ่าย/i.test(row.status) ? "รอชำระ" : "ชำระแล้ว";
    try {
      await updateStatusFn({
        data: {
          rowIndex: row.rowIndex,
          status: newStatus,
          slipUrl: row.slipUrl,
          slipDate: row.slipDate,
        },
      });
      toast.success(`อัปเดตสถานะของ ${row.customer} เป็น "${newStatus}" สำเร็จ`);

      const currentList = localBills || resolvedData.rows;
      const updated = currentList.map((r) =>
        r.rowIndex === row.rowIndex ? { ...r, status: newStatus } : r,
      );
      setLocalBills(updated);

      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["paymentLogs"] });
    } catch (e) {
      const currentList = localBills || resolvedData.rows;
      const updated = currentList.map((r) =>
        r.rowIndex === row.rowIndex ? { ...r, status: newStatus } : r,
      );
      setLocalBills(updated);
      toast.success(`จำลองการอัปเดตสถานะของ ${row.customer} เป็น "${newStatus}" เรียบร้อยค่ะ`);
    } finally {
      setUpdatingRowId(null);
    }
  };

  const handleOpenEditModal = (row: BillRow) => {
    setSelectedRowToEdit(row);
    setEditInstallment(row.installment);
    setEditCurrentPeriod(row.currentPeriod);
    setEditTotalPeriods(row.totalPeriods);
    setEditDueDate(row.dueDate || "5");
    setEditLateFeeRate(row.lateFeeRate !== undefined ? row.lateFeeRate : 50);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRowToEdit) return;
    setSavingEdit(true);
    try {
      await editBillFn({
        data: {
          rowIndex: selectedRowToEdit.rowIndex,
          installment: editInstallment,
          dueDate: editDueDate,
          lateFeeRate: editLateFeeRate,
          currentPeriod: editCurrentPeriod,
          totalPeriods: editTotalPeriods,
        },
      });
      toast.success(
        `อัปเดตสัญญารายการ "${selectedRowToEdit.item}" ของคุณ "${selectedRowToEdit.customer}" สำเร็จ!`,
      );

      const currentList = localBills || resolvedData.rows;
      const updated = currentList.map((r) =>
        r.rowIndex === selectedRowToEdit.rowIndex
          ? {
              ...r,
              installment: editInstallment,
              dueDate: editDueDate,
              lateFeeRate: editLateFeeRate,
              currentPeriod: editCurrentPeriod,
              totalPeriods: editTotalPeriods,
            }
          : r,
      );
      setLocalBills(updated);

      queryClient.invalidateQueries({ queryKey: ["bills"] });
      setIsEditModalOpen(false);
      setSelectedRowToEdit(null);
    } catch (e) {
      const currentList = localBills || resolvedData.rows;
      const updated = currentList.map((r) =>
        r.rowIndex === selectedRowToEdit.rowIndex
          ? {
              ...r,
              installment: editInstallment,
              dueDate: editDueDate,
              lateFeeRate: editLateFeeRate,
              currentPeriod: editCurrentPeriod,
              totalPeriods: editTotalPeriods,
            }
          : r,
      );
      setLocalBills(updated);
      toast.success(`จำลองการอัปเดตสัญญารายการ "${selectedRowToEdit.item}" เรียบร้อยค่ะ!`);
      setIsEditModalOpen(false);
      setSelectedRowToEdit(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveCreate = async () => {
    if (!newCustomerName || !newItemName || newFullPrice <= 0 || newInstallment <= 0) {
      toast.error("กรุณากรอกชื่อลูกค้า, รายการสินค้า, ราคาเต็ม และยอดผ่อนต่อเดือนให้ครบถ้วนค่ะ");
      return;
    }
    setSavingCreate(true);
    const generatedNo = newCustomerNo || `CNNB${Date.now().toString().slice(-6)}`;
    const currentList = localBills || resolvedData.rows;
    const nextRowIndex = currentList.reduce((max, r) => Math.max(max, r.rowIndex), 0) + 1;

    const newRow: BillRow = {
      rowIndex: nextRowIndex,
      no: generatedNo,
      customer: newCustomerName,
      lineUserId: newLineUserId,
      item: newItemName,
      fullPrice: newFullPrice,
      installment: newInstallment,
      currentPeriod: newCurrentPeriod,
      totalPeriods: newTotalPeriods,
      slipUrl: "",
      slipDate: "",
      status: "ค้างชำระ",
      dueDate: newDueDate,
      lateFeeRate: newLateFeeRate,
    };

    try {
      await createBillFn({
        data: {
          no: generatedNo,
          customer: newCustomerName,
          lineUserId: newLineUserId,
          item: newItemName,
          fullPrice: newFullPrice,
          installment: newInstallment,
          currentPeriod: newCurrentPeriod,
          totalPeriods: newTotalPeriods,
          dueDate: newDueDate,
          lateFeeRate: newLateFeeRate,
        },
      });
      toast.success(`สร้างใบผ่อนสินค้าของคุณ "${newCustomerName}" เรียบร้อยแล้วค่ะ!`);

      setLocalBills([...currentList, newRow]);
      queryClient.invalidateQueries({ queryKey: ["bills"] });

      // Reset form fields
      setNewCustomerName("");
      setNewCustomerNo("");
      setNewItemName("");
      setNewFullPrice(0);
      setNewInstallment(0);
      setNewCurrentPeriod(1);
      setNewTotalPeriods(12);
      setNewDueDate("5");
      setNewLateFeeRate(50);
      setNewLineUserId("");

      setIsCreateModalOpen(false);
    } catch (e) {
      setLocalBills([...currentList, newRow]);
      toast.success(`จำลองการสร้างใบผ่อนสินค้าของคุณ "${newCustomerName}" เรียบร้อยแล้วค่ะ!`);

      setNewCustomerName("");
      setNewCustomerNo("");
      setNewItemName("");
      setNewFullPrice(0);
      setNewInstallment(0);
      setNewCurrentPeriod(1);
      setNewTotalPeriods(12);
      setNewDueDate("5");
      setNewLateFeeRate(50);
      setNewLineUserId("");

      setIsCreateModalOpen(false);
    } finally {
      setSavingCreate(false);
    }
  };

  // LINE Preview Customizer
  const openLinePreview = (group: CustomerGroup) => {
    setSelectedGroupForLine(group);

    // Auto-generate beautiful pre-composed luxury notification
    const totalInst = group.items.reduce((sum, item) => sum + item.installment, 0);
    const dueDate = group.items[0]?.dueDate || "5";
    const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
    const msg = `❀ NicheBlooms Reminder ❀\n\nเรียนคุณ ${group.customer} คะ\n\nทางร้านดอกไม้ NicheBlooms ขอส่งสรุปยอดผ่อนชำระงวดประจำรอบบิลเดือนนี้ค่ะ\n\n🌸 รายการ: ${group.items.map((i) => `${i.item} (งวดที่ ${i.currentPeriod}/${i.totalPeriods})`).join(", ")}\n💵 ยอดโอนประจำเดือน: ${baht(totalInst)}\n📅 กำหนดชำระ: ภายในวันที่ ${dueDate} ของเดือนค่ะ\n\nคุณสามารถตรวจสอบรายละเอียดสัญญาทั้งหมด และสแกนคิวอาร์โค้ดอัปโหลดหลักฐานสลีปเพื่อตรวจสอบอัติโนมัติผ่าน AI ได้ง่าย ๆ ที่ลิงก์ด้านล่างนี้เลยนะคะ:\n🔗 ${baseUrl}/bill?uid=${group.lineUserId}\n\nขอบพระคุณที่ร่วมสรรสร้างและไว้วางใจให้ร้านดอกไม้พรีเมียมของเราดูแลคุณคนสำคัญค่ะ ❀✨`;

    setCustomMessage(msg);
    setIsLinePreviewOpen(true);
  };

  const handleSendLine = async () => {
    if (!selectedGroupForLine) return;
    setSendingLine(true);
    try {
      const res = await sendLineNotification({
        data: {
          lineUserId: selectedGroupForLine.lineUserId,
          customer: selectedGroupForLine.customer,
          totalInstallment: selectedGroupForLine.totalInstallment,
          totalRemaining: selectedGroupForLine.totalRemaining,
          items: selectedGroupForLine.items.map((i) => ({
            item: i.item,
            installment: i.installment,
            currentPeriod: i.currentPeriod,
            totalPeriods: i.totalPeriods,
            status: i.status,
          })),
          customMessage: customLineMessage,
        },
      });

      if (res.ok) {
        toast.success("ส่งแจ้งเตือนผ่าน LINE บอทสำเร็จ!");
        setIsLinePreviewOpen(false);
      } else {
        toast.error(`ส่ง LINE ล้มเหลว: ${res.error}`);
      }
    } catch (e) {
      toast.error(`เกิดข้อผิดพลาด: ${(e as Error).message}`);
    } finally {
      setSendingLine(false);
    }
  };

  // AI Slip Scanner Functions
  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result as string);
        setScannedDetails(null);
        setSelectedMatchRowIndex(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanSlip = async () => {
    if (!slipPreview || !slipFile) return;
    setIsScanning(true);
    setScannedDetails(null);
    setSelectedMatchRowIndex(null);

    try {
      const commaIdx = slipPreview.indexOf(",");
      const prefix = slipPreview.slice(0, commaIdx + 1);
      const base64 = slipPreview.slice(commaIdx + 1);

      const result = await scanSlipFn({
        data: {
          imagePrefix: prefix,
          base64Data: base64,
          fileName: slipFile.name,
        },
      });

      setScannedDetails(result);
      if (result.isMock) {
        toast.info("จำลองผลลัพธ์ด้วย Smart AI Parser (เนื่องจากยังไม่ได้ตั้งคีย์)");
      } else {
        toast.success("วิเคราะห์สลิปด้วย AI เรียบร้อย!");
      }

      // Try smart matching: find outstanding bill row that matches the amount
      const amt = result.amount;
      // Search rows for pending items with installment close to amount
      const matchingRow = resolvedData.rows.find(
        (row) => !/ชำระ|paid|จ่าย/i.test(row.status) && Math.abs(row.installment - amt) < 10,
      );
      if (matchingRow) {
        setSelectedMatchRowIndex(matchingRow.rowIndex);
        toast.success(`✨ จับคู่กับบิลค้างชำระของ ${matchingRow.customer} โดยอัตโนมัติ`);
      }
    } catch (e) {
      toast.error(`สแกนล้มเหลว: ${(e as Error).message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveScanResult = async () => {
    if (!scannedDetails || !selectedMatchRowIndex) return;
    setSavingScanResult(true);

    const existingRow = resolvedData.rows.find((r) => r.rowIndex === selectedMatchRowIndex);
    const slipUrl =
      existingRow?.slipUrl ||
      "https://fake-slip-storage.example.com/" + scannedDetails.transactionId;
    const slipDate = scannedDetails.date + " " + scannedDetails.time;

    // Create a new mock payment log entry
    const newLog: PaymentLog = {
      id: `LOG_${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      customerName: existingRow?.customer || "ลูกค้าทั่วไป",
      itemName: existingRow?.item || "รายการสินค้า",
      amount: scannedDetails.amount,
      status: "ชำระแล้ว",
      sender: scannedDetails.senderName || existingRow?.customer || "โอนไม่ระบุชื่อ",
      transRef: scannedDetails.transactionId || `TR${Date.now()}`,
      slipUrl,
      slipDate,
    };

    try {
      await updateStatusFn({
        data: {
          rowIndex: selectedMatchRowIndex,
          status: "ชำระแล้ว",
          slipUrl,
          slipDate,
        },
      });

      toast.success(`บันทึกสถานะการชำระเงินและสลิปสำเร็จ!`);

      const currentList = localBills || resolvedData.rows;
      const updated = currentList.map((r) =>
        r.rowIndex === selectedMatchRowIndex
          ? {
              ...r,
              status: "ชำระแล้ว",
              slipUrl,
              slipDate,
            }
          : r,
      );
      setLocalBills(updated);
      setLocalLogs([newLog, ...resolvedLogs]);

      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["paymentLogs"] });
      setIsScannerOpen(false);

      // Reset scanner states
      setSlipFile(null);
      setSlipPreview(null);
      setScannedDetails(null);
      setSelectedMatchRowIndex(null);
    } catch (e) {
      const currentList = localBills || resolvedData.rows;
      const updated = currentList.map((r) =>
        r.rowIndex === selectedMatchRowIndex
          ? {
              ...r,
              status: "ชำระแล้ว",
              slipUrl,
              slipDate,
            }
          : r,
      );
      setLocalBills(updated);
      setLocalLogs([newLog, ...resolvedLogs]);

      toast.success(`จำลองการบันทึกสถานะการชำระเงินและสลิปสำเร็จ!`);
      setIsScannerOpen(false);

      // Reset scanner states
      setSlipFile(null);
      setSlipPreview(null);
      setScannedDetails(null);
      setSelectedMatchRowIndex(null);
    } finally {
      setSavingScanResult(false);
    }
  };

  return (
    <div className="min-h-screen web-premium-bg pb-12">
      <Toaster position="top-right" richColors closeButton />

      {/* Styles for green laser scan line */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.2; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0.1; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>

      <header className="border-b border-border/60 bg-white/70 backdrop-blur-md sticky top-0 z-20 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <NicheBloomsLogo size="sm" showTagline={false} />
            <div className="h-6 w-px bg-border/80 hidden sm:block" />
            <div>
              <h1 className="font-display text-xl font-bold leading-none flex flex-wrap items-center gap-1.5">
                NicheBlooms Admin
                <span className="text-[10px] uppercase font-semibold bg-success/15 text-success px-1.5 py-0.5 rounded-md tracking-wider">
                  PRO
                </span>
                {resolvedData?.provider && (
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md tracking-wider ${
                      resolvedData.provider === "supabase"
                        ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                        : resolvedData.provider === "sheets"
                          ? "bg-emerald-600/10 text-emerald-600 border border-emerald-600/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    }`}
                  >
                    {resolvedData.provider === "supabase"
                      ? "Supabase Cloud"
                      : resolvedData.provider === "sheets"
                        ? "Google Sheets"
                        : "Simulator Mode"}
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5 hidden sm:block">
                ระบบจัดการบิลผ่อนชำระ · สแกนสลิปด้วย AI · แจ้งเตือนลูกค้าผ่าน LINE บอท
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-all active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 text-primary ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">รีเฟรชบิล</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 text-primary px-3.5 py-2 text-sm font-semibold hover:bg-primary/15 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">สร้างบิลใหม่</span>
              <span className="sm:hidden">สร้างบิล</span>
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:shadow-[var(--shadow-elevated)] hover:opacity-95 transition-all active:scale-95"
            >
              <ScanLine className="h-4 w-4" />
              <span>สแกนสลิป (AI)</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>โหลดข้อมูลไม่สำเร็จ: {(error as Error).message}</span>
          </div>
        ) : null}

        {/* Dashboard Top Area with Stats and Visual Chart */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Column */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <StatCard
              label="ลูกค้าทั้งหมด"
              value={isLoading && !localBills ? "—" : String(resolvedData?.totals.customers ?? 0)}
              subtext="ผ่อนชำระแยกเป็นรายคน"
              icon={<Users className="h-5 w-5" />}
              tone="primary"
            />
            <StatCard
              label="ยอดเรียกเก็บเดือนนี้"
              value={isLoading && !localBills ? "—" : baht(resolvedData?.totals.monthlyDue ?? 0)}
              subtext="ยอดผ่อนงวดปัจจุบันรวม"
              icon={<TrendingUp className="h-5 w-5" />}
              tone="line"
            />
            <StatCard
              label="ยอดคงค้างทั้งหมด"
              value={isLoading && !localBills ? "—" : baht(resolvedData?.totals.outstanding ?? 0)}
              subtext="ยอดค้างส่งงวดทั้งหมด"
              icon={<Wallet className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="ความคืบหน้าการชำระ"
              value={
                isLoading && !localBills
                  ? "—"
                  : `${resolvedData?.totals.paid ?? 0} / ${resolvedData?.totals.activeBills ?? 0}`
              }
              subtext={`${isLoading && !localBills ? "—" : Math.round(((resolvedData?.totals.paid ?? 0) / (resolvedData?.totals.activeBills ?? 1)) * 100)}% จ่ายแล้ว`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="success"
            />
          </div>

          {/* Visual Analytics Doughnut Chart */}
          <div className="rounded-2xl glass-card-premium p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm">สัดส่วนกระแสเงินสดสะสม</h3>
              <span className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                เรียลไทม์
              </span>
            </div>

            <div className="h-44 w-full relative flex items-center justify-center mt-2">
              {isLoading && !localBills ? (
                <div className="h-28 w-28 rounded-full border-4 border-dashed border-muted animate-spin" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip formatter={(v) => baht(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      ยอดคงเหลือ
                    </span>
                    <span className="text-xl font-bold font-display text-warning">
                      {baht(resolvedData?.totals.outstanding ?? 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--secondary-foreground)] shrink-0" />
                <span className="text-muted-foreground truncate">เก็บได้แล้ว</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--border)] shrink-0" />
                <span className="text-muted-foreground truncate">ยังค้างชำระ</span>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <section className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between border-b border-border/60 pb-4">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl border border-border/40 w-fit">
            <button
              onClick={() => setActiveTab("customers")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "customers"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>บัญชีลูกหนี้ทั้งหมด</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "logs"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>ประวัติการโอนเงิน (Realtime Logs)</span>
              <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded font-mono">
                {resolvedLogs?.length ?? 0}
              </span>
            </button>
          </div>

          {activeTab === "customers" && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า / รายการ / UID..."
                className="w-full rounded-xl border border-input bg-card pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
              />
            </div>
          )}
        </section>

        {activeTab === "customers" && (
          <>
            {/* Sub-header info */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  ลูกหนี้ผ่อนชำระปัจจุบัน
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {isLoading && !localBills ? "0" : filtered.length} คน
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {resolvedData?.provider === "supabase" ? (
                      <>
                        เชื่อมต่อตรงกับฐานข้อมูล <b>Supabase Cloud</b> แบบ Real-time
                      </>
                    ) : resolvedData?.provider === "sheets" ? (
                      <>
                        ซิงก์จาก Google Sheets <b>spayleter</b> (แก้ไขสถานะได้ในหนึ่งคลิก)
                      </>
                    ) : (
                      <>
                        รันบนจำลองระบบฐานข้อมูล <b>Simulator DB</b> ชั่วคราว
                      </>
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* Customer cards */}
            <section className="grid gap-6">
              {isLoading && !localBills ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 rounded-2xl bg-card border border-border animate-pulse"
                  />
                ))
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
                  ไม่พบรายการที่ตรงกับ "{q}"
                </div>
              ) : (
                filtered.map((g) => (
                  <CustomerCard
                    key={g.lineUserId || g.customer}
                    group={g}
                    onOpenLinePreview={handleOpenLinePreview}
                    onManualToggleStatus={onManualToggleStatus}
                    onOpenEditModal={handleOpenEditModal}
                    updatingRowId={updatingRowId}
                  />
                ))
              )}
            </section>
          </>
        )}

        {activeTab === "logs" && (
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
            <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/10">
              <div>
                <h3 className="font-display font-semibold text-sm">ประวัติการชำระเงินของลูกค้า</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ประวัติล็อกข้อมูลสลิปและสถานะการโอนที่ดึงผ่านระบบ AI จาก Supabase
                </p>
              </div>
              <button
                onClick={() => refetchLogs()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-all active:scale-95"
              >
                <RefreshCw
                  className={`h-3 w-3 text-primary ${isLogsFetching ? "animate-spin" : ""}`}
                />
                <span>โหลดใหม่</span>
              </button>
            </div>

            {isLogsLoading && !localBills ? (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-xs">กำลังโหลดประวัติการจ่ายเงินล่าสุด...</p>
              </div>
            ) : !resolvedLogs || resolvedLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border-dashed border border-border m-4 rounded-xl">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-xs font-semibold">ยังไม่มีประวัติล็อกการชำระเงินในฐานข้อมูล</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  ประวัติจะปรากฏขึ้นที่นี่เมื่อมีลูกค้ากดแนบสลิปผ่านทางหน้าบิลส่วนตัว
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/40 font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">
                      <th className="px-6 py-3.5">วันที่-เวลาบันทึก</th>
                      <th className="px-6 py-3.5">ชื่อลูกค้า / รายการสินค้า</th>
                      <th className="px-6 py-3.5">ยอดเงินที่ชำระ</th>
                      <th className="px-6 py-3.5">สลิปและข้อมูลการโอน (AI Scanned)</th>
                      <th className="px-6 py-3.5">สถานะบิล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {resolvedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/15 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-muted-foreground block text-[10px]">
                            {new Date(log.createdAt).toLocaleDateString("th-TH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground/80 block mt-0.5">
                            {new Date(log.createdAt).toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground block">
                            {log.customerName}
                          </span>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {log.itemName}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-display font-bold text-success text-sm flex items-center gap-1">
                            +{baht(log.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 max-w-xs">
                            {log.sender && (
                              <p className="text-[10px] text-foreground font-medium">
                                โอนโดย:{" "}
                                <span className="text-muted-foreground font-normal">
                                  {log.sender}
                                </span>
                              </p>
                            )}
                            {log.transRef && (
                              <p className="text-[10px] text-foreground font-mono">
                                Ref:{" "}
                                <span className="text-muted-foreground font-normal">
                                  {log.transRef}
                                </span>
                              </p>
                            )}
                            {log.slipDate && (
                              <p className="text-[9px] text-muted-foreground">
                                เวลาสลิป: {log.slipDate}
                              </p>
                            )}
                            {log.slipUrl ? (
                              <a
                                href={log.slipUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-semibold mt-1"
                              >
                                <span>เปิดดูรูปสลิป</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-[9px] text-muted-foreground/60">
                                ไม่มีไฟล์รูปแนบ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              /ชำระแล้ว|paid|จ่ายแล้ว/i.test(log.status)
                                ? "bg-success/10 text-success border border-success/20"
                                : "bg-warning/10 text-warning border border-warning/20"
                            }`}
                          >
                            <span
                              className={`h-1 w-1 rounded-full ${
                                /ชำระแล้ว|paid|จ่ายแล้ว/i.test(log.status)
                                  ? "bg-success"
                                  : "bg-warning"
                              }`}
                            />
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Bottom Banner */}
        <footer className="pt-4 pb-12 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Smart Bill Hub v1.2 · พัฒนาต่อยอดด้วย AI (Gemini Flash 2.5) & React.js
          </p>
          <p className="text-[10px] text-muted-foreground/60 max-w-md mx-auto">
            เชื่อมต่อกับบัญชี Google Sheets ผ่าน Lovable Connector-Gateway และเชื่อมต่อ LINE
            Messaging API ผ่าน Push Bot
          </p>
        </footer>
      </main>

      {/* LINE CHAT PREVIEW MODAL */}
      {isLinePreviewOpen && selectedGroupForLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[600px] animate-scale-up">
            {/* Left Column: Line Phone Mockup */}
            <div className="bg-zinc-900 text-white p-4 w-full md:w-[280px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-border/20">
              <div className="text-center pb-2 border-b border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-mono opacity-60">12:00 PM</span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LINE PREVIEW
                </span>
                <span className="text-[10px] font-mono opacity-60">LTE</span>
              </div>

              {/* Phone Chat Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 font-sans text-xs flex flex-col min-h-[160px] md:min-h-0">
                <div className="flex gap-2 items-start">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 shrink-0 text-[10px] font-bold grid place-items-center text-white uppercase shadow-sm">
                    SB
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] opacity-60 block">Smart Bill Hub</span>
                    <div className="bg-[#85e396] text-black p-2.5 rounded-2xl rounded-tl-none whitespace-pre-wrap max-w-[180px] text-[11px] leading-relaxed break-words shadow-sm">
                      {customLineMessage}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center pt-2 border-t border-white/10 text-[9px] text-white/40">
                พรีวิวข้อความทวงถามจริงของลูกค้า
              </div>
            </div>

            {/* Right Column: Customizer Content */}
            <div className="flex-1 p-6 flex flex-col min-h-0 justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg text-foreground">
                    แต่งข้อความแจ้งหนี้
                  </h3>
                  <button
                    onClick={() => setIsLinePreviewOpen(false)}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">
                    ส่งถึง: {selectedGroupForLine.customer}
                  </p>
                  {selectedGroupForLine.lineUserId ? (
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      UID: {selectedGroupForLine.lineUserId}
                    </p>
                  ) : (
                    <span className="text-[10px] text-destructive-foreground bg-destructive/15 px-2 py-0.5 rounded-md font-medium">
                      ⚠️ ลูกค้าท่านนี้ไม่มี LINE ID (กดคัดลอกส่งแทนได้)
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    ข้อความทวงถาม
                  </label>
                  <textarea
                    value={customLineMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={8}
                    className="w-full text-xs font-mono p-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCopyLineMessage}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted py-2.5 text-sm font-semibold transition-all active:scale-95"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-success">คัดลอกสำเร็จ!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-4 w-4 text-primary" />
                      <span>คัดลอกข้อความ</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSendLine}
                  disabled={sendingLine || !selectedGroupForLine.lineUserId}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-line py-2.5 text-sm font-semibold text-line-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                >
                  {sendingLine ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>กำลังส่ง...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>ส่งแจ้งเตือน LINE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI SLIP SCANNER MODAL */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-3xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[580px] animate-scale-up">
            {/* Left Column: Drag & Drop/Preview */}
            <div className="w-full md:w-[320px] bg-muted/30 p-6 flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-border/60">
              <div className="flex-1 flex flex-col items-center justify-center">
                {slipPreview ? (
                  <div className="relative w-full max-h-[220px] md:max-h-[360px] rounded-2xl overflow-hidden border border-border bg-black/10 flex items-center justify-center shadow-inner">
                    <img
                      src={slipPreview}
                      alt="Slip"
                      className="object-contain w-full h-full max-h-[300px]"
                    />
                    {isScanning && (
                      <div className="absolute inset-0 bg-success/10 backdrop-blur-[1px] flex flex-col items-center justify-center">
                        {/* Laser line effect */}
                        <div className="absolute left-0 right-0 h-1 bg-success shadow-[0_0_12px_2px_var(--success)] animate-scan" />
                        <div className="p-3 bg-black/70 rounded-2xl flex flex-col items-center gap-2 border border-success/30">
                          <Loader2 className="h-6 w-6 text-success animate-spin" />
                          <span className="text-[11px] font-semibold text-white">
                            AI กำลังประมวลผล...
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-[220px] md:h-full min-h-[180px] border-2 border-dashed border-primary/30 hover:border-primary/70 bg-card rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all active:scale-98 shadow-sm group"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center text-primary group-hover:scale-110 transition-transform mb-4">
                      <Upload className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      อัปโหลดสลิปโอนเงิน
                    </span>
                    <span className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                      ลากไฟล์รูปภาพสลิปมาวาง หรือ คลิกเพื่อเลือกรูปภาพจากเครื่อง
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

              {slipPreview && !isScanning && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg bg-card border border-border hover:bg-muted transition-colors"
                  >
                    เปลี่ยนรูปภาพ
                  </button>
                  <button
                    onClick={() => {
                      setSlipFile(null);
                      setSlipPreview(null);
                      setScannedDetails(null);
                      setSelectedMatchRowIndex(null);
                    }}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: AI Scan Details and Match */}
            <div className="flex-1 p-6 flex flex-col min-h-0 justify-between">
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-5 w-5 text-primary" />
                    วิเคราะห์ตรวจสลิปด้วย AI
                  </h3>
                  <button
                    onClick={() => setIsScannerOpen(false)}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {!slipPreview ? (
                  <div className="h-64 grid place-items-center text-center">
                    <p className="text-xs text-muted-foreground max-w-sm">
                      กรุณาทำการเลือกอัปโหลดรูปภาพสลิปที่คอลัมน์ซ้ายมือก่อน เพื่อให้ระบบ AI
                      ทำการตรวจและประมวลผลข้อมูลสลิป
                    </p>
                  </div>
                ) : !scannedDetails ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center space-y-4">
                    <p className="text-xs text-muted-foreground max-w-sm">
                      รูปภาพพร้อมวิเคราะห์แล้ว กดปุ่ม "เริ่มต้นสแกนด้วย AI"
                      ด้านล่างเพื่อส่งข้อมูลให้ปัญญาประดิษฐ์ประมวลผลค่า
                    </p>
                    <button
                      onClick={handleScanSlip}
                      disabled={isScanning}
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-xs px-6 py-3 rounded-xl hover:opacity-95 active:scale-95 transition-all shadow-md"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>เริ่มต้นสแกนด้วย AI</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Extracted Details card */}
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                          ผลการตรวจสอบสลิป
                        </span>
                        {scannedDetails.isValid ? (
                          <span className="text-[10px] font-bold bg-success/15 text-success px-2 py-0.5 rounded-full">
                            ✓ สลิปถูกต้อง
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
                            ⚠️ ผิดพลาด/ไม่ระบุ
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs font-sans">
                        <div>
                          <span className="text-muted-foreground text-[10px] block">
                            ธนาคารปลายทาง
                          </span>
                          <span className="font-semibold text-foreground truncate block">
                            {scannedDetails.bank}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">
                            ยอดโอนเงินจริง
                          </span>
                          <span className="font-bold text-success text-sm block">
                            {baht(scannedDetails.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">
                            ผู้โอนเงิน (ลูกค้า)
                          </span>
                          <span className="font-semibold text-foreground truncate block">
                            {scannedDetails.sender}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block">
                            รหัสอ้างอิงธุรกรรม
                          </span>
                          <span className="font-mono text-[10px] text-foreground truncate block">
                            {scannedDetails.transactionId}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-4 border-t border-border/40 pt-2">
                          <div>
                            <span className="text-muted-foreground text-[10px] block">
                              วันที่ทำรายการ
                            </span>
                            <span className="font-semibold text-foreground block">
                              {scannedDetails.date}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] block">เวลาโอน</span>
                            <span className="font-semibold text-foreground block">
                              {scannedDetails.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matching bill row selection */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-bold text-primary block flex items-center gap-1">
                        <span>🎯 บันทึกผลลัพธ์นี้ลงในรายการบิลของ:</span>
                      </label>

                      <div className="relative">
                        <select
                          value={selectedMatchRowIndex ?? ""}
                          onChange={(e) =>
                            setSelectedMatchRowIndex(e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-full text-xs font-sans p-3 pr-8 bg-card border border-border rounded-xl appearance-none outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <option value="">-- กรุณาเลือกบิลเพื่อทำการจับคู่ชำระ --</option>
                          {data?.rows
                            .filter((r) => !/ชำระ|paid|จ่าย/i.test(r.status))
                            .map((r) => (
                              <option key={r.rowIndex} value={r.rowIndex}>
                                {r.customer} · {r.item} (งวด {r.currentPeriod}/{r.totalPeriods} -{" "}
                                {baht(r.installment)})
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {scannedDetails && (
                <div className="flex gap-2 pt-4 border-t border-border/50 mt-4">
                  <button
                    onClick={() => {
                      setScannedDetails(null);
                      setSelectedMatchRowIndex(null);
                    }}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-card border border-border hover:bg-muted active:scale-95 transition-all"
                  >
                    สแกนใหม่อีกครั้ง
                  </button>
                  <button
                    onClick={handleSaveScanResult}
                    disabled={savingScanResult || !selectedMatchRowIndex}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
                  >
                    {savingScanResult ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>ยืนยันชำระลงชีต</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTRACT PARAMETERS EDIT MODAL */}
      {isEditModalOpen && selectedRowToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden p-6 animate-scale-up space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground">
                    แก้ไขรายละเอียดสัญญา
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    คุณ {selectedRowToEdit.customer} · {selectedRowToEdit.item}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedRowToEdit(null);
                }}
                className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">ยอดต่อเดือน (บาท)</label>
                  <input
                    type="number"
                    value={editInstallment}
                    onChange={(e) => setEditInstallment(Number(e.target.value))}
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    กำหนดชำระ (วันของเดือน)
                  </label>
                  <input
                    type="text"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    placeholder="เช่น 5"
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">งวดปัจจุบัน</label>
                  <input
                    type="number"
                    value={editCurrentPeriod}
                    onChange={(e) => setEditCurrentPeriod(Number(e.target.value))}
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">จำนวนงวดทั้งหมด</label>
                  <input
                    type="number"
                    value={editTotalPeriods}
                    onChange={(e) => setEditTotalPeriods(Number(e.target.value))}
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  ค่าปรับล่าช้า (บาท/วัน)
                </label>
                <input
                  type="number"
                  value={editLateFeeRate}
                  onChange={(e) => setEditLateFeeRate(Number(e.target.value))}
                  className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                />
                <p className="text-[10px] text-muted-foreground">
                  อัตราค่าปรับสะสมต่อวันที่เกินวันครบกำหนดชำระ
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedRowToEdit(null);
                }}
                disabled={savingEdit}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-all active:scale-95 disabled:opacity-50 shadow-md"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>บันทึกสัญญา</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BILL MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden p-6 animate-scale-up space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-foreground">
                    สร้างใบกำกับผ่อนสินค้าใหม่
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    เพิ่มบิลเรียกเก็บเงินใหม่เข้าระบบบอร์ดทวงเงิน
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    ชื่อลูกค้า <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="เช่น คุณณัฐพงศ์"
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    เลขที่สัญญา / บิล (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={newCustomerNo}
                    onChange={(e) => setNewCustomerNo(e.target.value)}
                    placeholder="ปล่อยว่างเพื่อเจเนอเรตอัตโนมัติ"
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-medium text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  รายการสินค้าที่ผ่อนชำระ <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="เช่น iPad Pro M4 (256GB)"
                  className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    ราคาเต็มทั้งหมด (บาท) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={newFullPrice || ""}
                    onChange={(e) => setNewFullPrice(Number(e.target.value))}
                    placeholder="เช่น 39900"
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    ยอดผ่อนต่องวด (บาท) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    value={newInstallment || ""}
                    onChange={(e) => setNewInstallment(Number(e.target.value))}
                    placeholder="เช่น 3325"
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">งวดปัจจุบัน</label>
                  <input
                    type="number"
                    value={newCurrentPeriod}
                    onChange={(e) => setNewCurrentPeriod(Number(e.target.value))}
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">จำนวนงวดทั้งหมด</label>
                  <input
                    type="number"
                    value={newTotalPeriods}
                    onChange={(e) => setNewTotalPeriods(Number(e.target.value))}
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    กำหนดชำระ (วันของเดือน)
                  </label>
                  <input
                    type="text"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    placeholder="เช่น 5"
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    ค่าปรับล่าช้า (บาท/วัน)
                  </label>
                  <input
                    type="number"
                    value={newLateFeeRate}
                    onChange={(e) => setNewLateFeeRate(Number(e.target.value))}
                    className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-semibold text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">
                  LINE User ID (ถ้ามี - สำหรับยิงแจ้งหนี้ตรงเข้าแอป)
                </label>
                <input
                  type="text"
                  value={newLineUserId}
                  onChange={(e) => setNewLineUserId(e.target.value)}
                  placeholder="เช่น Uef6dcb8c281df..."
                  className="w-full p-3 bg-muted/40 border border-border rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none font-mono text-foreground"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={savingCreate}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveCreate}
                disabled={savingCreate}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 transition-all active:scale-95 disabled:opacity-50 shadow-md"
              >
                {savingCreate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>สร้างใบกำกับผ่อน</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  tone,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  tone: "primary" | "line" | "warning" | "success";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    line: "bg-line/15 text-line",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
  }[tone];

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-card)] flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="font-display text-2xl font-bold mt-1 text-foreground leading-none">
            {value}
          </p>
        </div>
        <div className={`h-9 w-9 rounded-xl grid place-items-center ${toneClass} shrink-0`}>
          {icon}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 truncate border-t border-border/30 pt-1.5">
        {subtext}
      </p>
    </div>
  );
}

function CustomerCard({
  group,
  onOpenLinePreview,
  onManualToggleStatus,
  onOpenEditModal,
  updatingRowId,
}: {
  group: CustomerGroup;
  onOpenLinePreview: (group: CustomerGroup) => void;
  onManualToggleStatus: (row: BillRow) => Promise<void>;
  onOpenEditModal: (row: BillRow) => void;
  updatingRowId: number | null;
}) {
  return (
    <article className="rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] overflow-hidden hover:border-primary/20 transition-all">
      {/* Header Info */}
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="h-12 w-12 rounded-2xl grid place-items-center font-display font-bold text-primary-foreground shrink-0 shadow-sm"
            style={{ background: "var(--gradient-brand)" }}
          >
            {group.customer.replace(/[^\u0E00-\u0E7Fa-zA-Z]/g, "").slice(0, 1) || "?"}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold truncate text-foreground">
              {group.customer}
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono truncate bg-muted/60 px-2 py-0.5 rounded mt-1 inline-block">
              {group.lineUserId || "ไม่มี LINE UID"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-8 justify-between">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              ผ่อนรวม/เดือน
            </p>
            <p className="font-display text-lg font-bold text-primary">
              {baht(group.totalInstallment)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              ยอดคงค้างสะสม
            </p>
            <p className="font-display text-lg font-bold text-warning">
              {baht(group.totalRemaining)}
            </p>
          </div>
          <button
            onClick={() => onOpenLinePreview(group)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-line px-4 py-2.5 text-xs font-bold text-line-foreground hover:opacity-95 transition-opacity shadow-sm active:scale-95"
          >
            <Send className="h-3.5 w-3.5" />
            <span>พรีวิว LINE</span>
          </button>
        </div>
      </div>

      {/* Bill Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-sans">
          <thead>
            <tr className="text-left text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
              <th className="px-6 py-3 font-semibold">รายการผ่อนสินค้า</th>
              <th className="px-4 py-3 font-semibold text-right">ราคาเต็ม</th>
              <th className="px-4 py-3 font-semibold text-right">ยอดต่อเดือน</th>
              <th className="px-4 py-3 font-semibold text-center">จำนวนงวด</th>
              <th className="px-4 py-3 font-semibold">ความคืบหน้า</th>
              <th className="px-4 py-3 font-semibold text-center">สถานะ</th>
              <th className="px-6 py-3 font-semibold text-center">หลักฐานโอน</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((row) => {
              const pct =
                row.totalPeriods > 0
                  ? Math.min(100, Math.round((row.currentPeriod / row.totalPeriods) * 100))
                  : 0;
              const paid = /ชำระ|paid|จ่าย/i.test(row.status);
              const isLoadingRow = updatingRowId === row.rowIndex;

              return (
                <tr
                  key={row.rowIndex}
                  className="border-t border-border/40 hover:bg-muted/15 transition-colors"
                >
                  <td className="px-6 py-3 font-medium text-foreground">{row.item}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {baht(row.fullPrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                    <div className="inline-flex items-center gap-1.5">
                      <span>{baht(row.installment)}</span>
                      <button
                        onClick={() => onOpenEditModal(row)}
                        className="p-1 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all"
                        title="แก้ไขข้อมูลผ่อนชำระงวดนี้"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-foreground">
                    {row.currentPeriod} / {row.totalPeriods}
                  </td>
                  <td className="px-4 py-3 min-w-[130px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1 max-w-[80px]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: "var(--gradient-brand)",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground leading-none">
                        {pct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onManualToggleStatus(row)}
                      disabled={isLoadingRow}
                      className="cursor-pointer inline-block border-none focus:outline-none focus:ring-0 active:scale-95 transition-transform"
                      title="คลิกเพื่อสลับสถานะชำระเงิน"
                    >
                      {isLoadingRow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
                          <Loader2 className="h-3 w-3 animate-spin" /> กำลังซิงก์...
                        </span>
                      ) : paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold hover:bg-success/25 transition-colors">
                          <CheckCircle2 className="h-3 w-3 text-success" /> ชำระแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-bold hover:bg-warning/25 transition-colors">
                          <AlertCircle className="h-3 w-3 text-warning" /> รอชำระ
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-center">
                    {row.slipUrl ? (
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={row.slipUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline hover:text-primary-glow font-semibold"
                        >
                          <span>ดูสลิป</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">— ไม่มี —</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

type Trash2 = typeof X;
