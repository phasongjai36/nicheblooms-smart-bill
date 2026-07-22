import React from "react";

interface BotanicalDecorProps {
  className?: string;
  variant?: "rose" | "branch" | "wreath" | "leaves";
  size?: number;
}

/**
 * BotanicalDecor Component
 * ชิ้นส่วนลายเส้นกิ่งไม้และดอกไม้มินิมอลโปร่งแสงสไตล์พรีเมียม (Minimalist Botanical Line Art)
 * สำหรับประดับตกแต่งตามส่วนมุมของการ์ดและพื้นหลังบิลแบรนด์ NicheBlooms
 */
export const BotanicalDecor: React.FC<BotanicalDecorProps> = ({
  className = "",
  variant = "rose",
  size = 120,
}) => {
  // SVG ดอกไม้แบบลายเส้นมินิมอลที่มีความประณีตอ่อนช้อยสูง
  switch (variant) {
    case "rose":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`pointer-events-none select-none text-primary/10 transition-all ${className}`}
        >
          {/* ละอองละมุนเกสร */}
          <circle cx="50" cy="30" r="1" className="opacity-40" />
          <circle cx="48" cy="24" r="0.8" className="opacity-40" />
          <circle cx="54" cy="26" r="0.8" className="opacity-40" />
          {/* กลีบดอกกุหลาบตูมตรงกลางสไตล์มินิมอลวาดเส้นเดียว (One-line Rose Art) */}
          <path d="M50 40C46 36 44 32 44 26C44 18 50 14 54 20C58 14 62 18 62 25C62 31 58 35 54 39" />
          <path d="M52 23C49 21 47 24 49 28C51 32 55 31 56 27C57 23 54 21 52 23Z" />
          <path d="M47 31C43 31 40 28 40 24C40 18 45 15 48 16" />
          {/* ก้านและใบอ่อนช้อย */}
          <path d="M50 40V80" strokeWidth="1.5" />
          {/* ใบก้านซ้าย */}
          <path d="M50 52C42 52 36 48 34 44C36 54 44 56 50 56" />
          <path d="M42 49L50 56" strokeWidth="0.8" />
          {/* ใบก้านขวา */}
          <path d="M50 64C58 64 64 61 66 58C64 67 56 68 50 68" />
          <path d="M58 61L50 68" strokeWidth="0.8" />
        </svg>
      );

    case "branch":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`pointer-events-none select-none text-primary/10 transition-all ${className}`}
        >
          {/* ก้านหลักโค้งอย่างพริ้วไหวประณีต */}
          <path d="M25 85C35 75 42 60 45 35C48 20 42 12 40 10" strokeWidth="1.5" />
          {/* กลีบใบมะกอกมินิมอลสลักสเปซหรูหรา */}
          {/* ใบที่ 1 ซ้าย */}
          <path d="M38 68C28 68 22 62 20 58C24 64 32 65 38 65" />
          {/* ใบที่ 1 ขวา */}
          <path d="M40 60C48 58 52 52 54 48C52 54 46 58 40 59" />
          {/* ใบที่ 2 ซ้าย */}
          <path d="M41 49C32 46 28 38 27 34C31 40 37 43 42 44" />
          {/* ใบที่ 2 ขวา */}
          <path d="M44 42C52 38 56 30 57 26C55 32 49 37 44 38" />
          {/* ใบตูมบนสุด */}
          <path d="M44 25C42 18 36 15 35 14C38 18 42 22 43 25" />
        </svg>
      );

    case "wreath":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`pointer-events-none select-none text-primary/10 transition-all ${className}`}
        >
          {/* พวงพฤกษชาติวงกลมสไตล์ลักชัวรีแบรนด์ Niche */}
          <circle cx="60" cy="60" r="48" strokeDasharray="3 6" className="opacity-35" />
          {/* ฝั่งซ้ายโค้งขึ้น */}
          <path d="M60 110C32 110 12 87 12 60C12 32 32 10 60 10" strokeWidth="1.2" />
          <path d="M12 60C8 56 6 48 8 44C12 50 14 54 12 60" />
          <path d="M18 42C12 38 12 30 15 25C18 32 20 36 18 42" />
          <path d="M30 25C26 18 28 10 32 6C34 14 34 18 30 25" />
          {/* ฝั่งขวาโค้งขึ้น */}
          <path d="M60 110C88 110 108 87 108 60C108 32 88 10 60 10" strokeWidth="1.2" />
          <path d="M108 60C112 56 114 48 112 44C108 50 106 54 108 60" />
          <path d="M102 42C108 38 108 30 105 25C102 32 100 36 102 42" />
          <path d="M90 25C94 18 92 10 88 6C86 14 86 18 90 25" />
          {/* ลายริบบิ้นมินิมอลผูกตรงฐาน */}
          <path d="M60 110C56 112 54 116 56 120C58 116 62 112 60 110Z" fill="currentColor" className="opacity-10" />
          <path d="M60 110C64 112 66 116 64 120C62 116 58 112 60 110Z" fill="currentColor" className="opacity-10" />
        </svg>
      );

    case "leaves":
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`pointer-events-none select-none text-primary/10 transition-all ${className}`}
        >
          {/* ลายใบไม้ตกและเกลียวพฤกษา */}
          <path d="M10 15C30 20 60 15 90 40" strokeWidth="1.5" />
          <path d="M30 18C28 28 20 32 16 34C22 30 28 26 30 18" />
          <path d="M50 18C52 28 48 36 44 40C46 32 49 26 50 18" />
          <path d="M70 23C76 32 76 42 74 48C72 40 70 32 70 23" />
        </svg>
      );
  }
};
