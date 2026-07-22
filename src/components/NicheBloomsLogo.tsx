import React from "react";

interface NicheBloomsLogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  light?: boolean;
}

export function NicheBloomsLogo({
  className = "",
  showTagline = true,
  size = "md",
  light = false,
}: NicheBloomsLogoProps) {
  // Dimensions and scaling
  const dimensions = {
    sm: { width: 140, height: 75 },
    md: { width: 280, height: 150 },
    lg: { width: 420, height: 225 },
    xl: { width: 560, height: 300 },
  };

  const { width, height } = dimensions[size];

  // Brand colors matching the uploaded design
  // Light version uses ivory cream / gold tones, default version uses deep luxury plum #563b47
  const strokeColor = light ? "#faf0ed" : "#563b47";
  const textColor = light ? "#faf0ed" : "#563b47";
  const taglineColor = light ? "rgba(250, 240, 237, 0.75)" : "rgba(86, 59, 71, 0.75)";

  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 280 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all duration-300 mx-auto"
      >
        {/* ==================== FLORAL WREATH SYMBOL ==================== */}
        <g id="Wreath">
          {/* Central Circular Thin Frame */}
          <circle
            cx="140"
            cy="52"
            r="28"
            stroke={strokeColor}
            strokeWidth="0.8"
            strokeDasharray="1 1"
            className="opacity-60"
          />

          {/* Central Letter 'N' */}
          <text
            x="140"
            y="59"
            fontFamily="'Sora', 'Inter', system-ui, sans-serif"
            fontSize="21"
            fontWeight="300"
            fill={textColor}
            textAnchor="middle"
            letterSpacing="0.05em"
          >
            N
          </text>

          {/* LEFT SEMI-CIRCLE FLORAL BRANCH */}
          <path
            d="M 116 52 C 116 35, 126 23, 140 23"
            stroke={strokeColor}
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M 116 52 C 116 68, 127 80, 140 81"
            stroke={strokeColor}
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* RIGHT SEMI-CIRCLE FLORAL BRANCH */}
          <path
            d="M 164 52 C 164 35, 154 23, 140 23"
            stroke={strokeColor}
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M 164 52 C 164 68, 153 80, 140 81"
            stroke={strokeColor}
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* LEAVES & LITTLE FLOWERS (Left Side) */}
          {/* Top-left leaf */}
          <path d="M 124 32 Q 120 28 126 26 Q 128 30 124 32 Z" fill={strokeColor} />
          <line x1="126" y1="33" x2="124" y2="32" stroke={strokeColor} strokeWidth="0.8" />

          {/* Mid-left twin leaves */}
          <path d="M 114 46 Q 108 45 110 41 Q 115 42 114 46 Z" fill={strokeColor} className="opacity-90" />
          <path d="M 113 56 Q 107 58 108 62 Q 113 60 113 56 Z" fill={strokeColor} className="opacity-90" />

          {/* Bottom-left flower node */}
          <circle cx="122" cy="68" r="1.5" fill={strokeColor} />
          <path d="M 122 68 Q 120 74 126 73 Q 125 69 122 68 Z" stroke={strokeColor} strokeWidth="0.8" fill="none" />

          {/* Far bottom-left leaf */}
          <path d="M 132 78 Q 128 82 133 83 Q 135 79 132 78 Z" fill={strokeColor} />

          {/* LEAVES & LITTLE FLOWERS (Right Side) */}
          {/* Top-right leaf */}
          <path d="M 156 32 Q 160 28 154 26 Q 152 30 156 32 Z" fill={strokeColor} />
          <line x1="154" y1="33" x2="156" y2="32" stroke={strokeColor} strokeWidth="0.8" />

          {/* Mid-right twin leaves */}
          <path d="M 166 46 Q 172 45 170 41 Q 165 42 166 46 Z" fill={strokeColor} className="opacity-90" />
          <path d="M 167 56 Q 173 58 172 62 Q 167 60 167 56 Z" fill={strokeColor} className="opacity-90" />

          {/* Bottom-right flower node */}
          <circle cx="158" cy="68" r="1.5" fill={strokeColor} />
          <path d="M 158 68 Q 160 74 154 73 Q 155 69 158 68 Z" stroke={strokeColor} strokeWidth="0.8" fill="none" />

          {/* Far bottom-right leaf */}
          <path d="M 148 78 Q 152 82 147 83 Q 145 79 148 78 Z" fill={strokeColor} />
        </g>

        {/* ==================== NICHEBLOOMS BRAND TEXT ==================== */}
        <text
          x="140"
          y="108"
          fontFamily="'Sora', 'Inter', system-ui, sans-serif"
          fontSize="13"
          fontWeight="500"
          fill={textColor}
          textAnchor="middle"
          letterSpacing="0.32em"
        >
          NICHEBLOOMS
        </text>

        {/* ==================== TAGLINE ==================== */}
        {showTagline && (
          <text
            x="140"
            y="126"
            fontFamily="'Inter', system-ui, sans-serif"
            fontSize="5.2"
            fontWeight="400"
            fill={taglineColor}
            textAnchor="middle"
            letterSpacing="0.4em"
            className="opacity-90 uppercase"
          >
            BLOOMING YOUR MOMENTS, CRAFTING YOUR MEMORIES.
          </text>
        )}
      </svg>
    </div>
  );
}
