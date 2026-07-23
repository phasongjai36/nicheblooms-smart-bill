import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ScanInputSchema = z.object({
  imagePrefix: z.string(), // e.g. "data:image/png;base64,"
  base64Data: z.string(), // pure base64 data
  fileName: z.string().optional(),
});

export type SlipDetails = {
  bank: string;
  sender: string;
  receiver: string;
  amount: number;
  date: string;
  time: string;
  transactionId: string;
  isValid: boolean;
  isMock?: boolean;
  slipOkValid?: boolean;
};

// Scan slip with Gemini 2.5 Flash and cross-verify with SlipOK API (Anti-Fraud)
export const scanSlipWithAi = createServerFn({ method: "POST" })
  .validator((input: unknown) => ScanInputSchema.parse(input))
  .handler(async ({ data }): Promise<SlipDetails> => {
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey && (apiKey.includes("กรอก_") || apiKey.includes("your_"))) {
      apiKey = undefined;
    }

    let gatewayKey = process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_KEY;
    if (gatewayKey && (gatewayKey.includes("กรอก_") || gatewayKey.includes("your_"))) {
      gatewayKey = undefined;
    }

    let parsed: SlipDetails = {
      bank: "KBank",
      sender: "นาย ณัฏฐนิชา วุ้นเส้น",
      receiver: "NICHE BLOOM",
      amount: 1347,
      date: new Date().toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.",
      transactionId: "TRF" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      isValid: true,
      isMock: true,
    };

    // 1. If Gemini API Key is configured, use Gemini to parse receipt fields
    if (apiKey) {
      try {
        let mimeType = "image/jpeg";
        const match = data.imagePrefix.match(/data:([^;]+);base64,/);
        if (match && match[1]) {
          mimeType = match[1];
        }

        const prompt = `Analyze this Thai Bank Transfer Slip image. 
Extract the following transaction details and return them strictly in JSON format matching this schema:
{
  "bank": "name of bank, e.g. KBank, SCB, PromptPay, GSB, BBL",
  "sender": "sender's full name in Thai or English",
  "receiver": "receiver's full name in Thai or English",
  "amount": number (parsed payment amount, e.g. 1200.00),
  "date": "transaction date formatted nicely, e.g. 17 ก.ค. 2569 or 17 Jul 2026",
  "time": "transaction time, e.g. 09:30",
  "transactionId": "transaction reference or ID number, usually 12-18 digits or letters",
  "isValid": true (boolean, set to false if the image does not look like a valid transfer slip or is tampered/blank)
}
Return ONLY a valid JSON object. Do not include markdown block wrappers or extra text.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: data.base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          },
        );

        if (response.ok) {
          const result = await response.json();
          const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const cleanText = text.trim().replace(/```json\n?|\n?```/g, "");
            const geminiParsed = JSON.parse(cleanText) as SlipDetails;
            parsed = {
              ...geminiParsed,
              isMock: false,
            };
          }
        } else {
          const errorText = await response.text();
          console.warn(
            `Gemini API failed [${response.status}]: ${errorText}.`,
          );
        }
      } catch (geminiError) {
        console.error("Gemini scanning failed:", geminiError);
      }
    }

    // 1.5. If primary Gemini API key failed or was missing, try Vercel AI Gateway
    if (parsed.isMock && gatewayKey) {
      try {
        console.log("Attempting Vercel AI Gateway for slip scanning...");
        const prompt = `Analyze this Thai Bank Transfer Slip image. 
Extract the following transaction details and return them strictly in JSON format matching this schema:
{
  "bank": "name of bank, e.g. KBank, SCB, PromptPay, GSB, BBL",
  "sender": "sender's full name in Thai or English",
  "receiver": "receiver's full name in Thai or English",
  "amount": number (parsed payment amount, e.g. 1200.00),
  "date": "transaction date formatted nicely, e.g. 17 ก.ค. 2569 or 17 Jul 2026",
  "time": "transaction time, e.g. 09:30",
  "transactionId": "transaction reference or ID number, usually 12-18 digits or letters",
  "isValid": true (boolean, set to false if the image does not look like a valid transfer slip or is tampered/blank)
}
Return ONLY a valid JSON object. Do not include markdown block wrappers or extra text.`;

        const imageUrl = data.imagePrefix && data.imagePrefix.startsWith("data:")
          ? data.imagePrefix + data.base64Data
          : `data:image/jpeg;base64,${data.base64Data}`;

        const gwResponse = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gatewayKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
          }),
        });

        if (gwResponse.ok) {
          const gwResult = await gwResponse.json();
          const content = gwResult?.choices?.[0]?.message?.content;
          if (content) {
            const cleanJson = content.trim().replace(/```json\n?|\n?```/g, "");
            const gwParsed = JSON.parse(cleanJson) as SlipDetails;
            parsed = {
              ...gwParsed,
              isMock: false,
            };
            console.log("Successfully scanned slip via Vercel AI Gateway!");
          }
        } else {
          const errText = await gwResponse.text();
          console.warn(`Vercel AI Gateway failed [${gwResponse.status}]: ${errText}`);
        }
      } catch (gwErr) {
        console.error("Vercel AI Gateway scanning failed:", gwErr);
      }
    }

    // 2. Anti-Fraud System: If SlipOK API is configured, scan the QR code to fetch verified Bank-direct values
    let slipOkKey = process.env.SLIPOK_API_KEY;
    if (slipOkKey && (slipOkKey.includes("กรอก_") || slipOkKey.includes("your_"))) {
      slipOkKey = undefined;
    }

    if (slipOkKey) {
      try {
        const branchId = process.env.SLIPOK_BRANCH_ID || "12345";
        console.log(`Checking slip with SlipOK API at branch: ${branchId}...`);

        const slipOkRes = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
          method: "POST",
          headers: {
            "x-authorization": slipOkKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: data.imagePrefix + data.base64Data }),
        });

        if (slipOkRes.ok) {
          const slipOkData = await slipOkRes.json();
          console.log("SlipOK raw response data:", JSON.stringify(slipOkData));

          if (slipOkData?.success && slipOkData?.data) {
            console.log(
              "SlipOK verification SUCCESS. Overwriting parsed fields with bank-verified details.",
            );
            return {
              bank: slipOkData.data.sendingBank || parsed.bank,
              sender: slipOkData.data.sender?.displayName || parsed.sender,
              receiver: slipOkData.data.receiver?.displayName || parsed.receiver,
              amount: Number(slipOkData.data.amount) || parsed.amount,
              date: slipOkData.data.transDate
                ? new Date(slipOkData.data.transDate).toLocaleDateString("th-TH")
                : parsed.date,
              time: slipOkData.data.transTime || parsed.time,
              transactionId: slipOkData.data.transRef || parsed.transactionId,
              isValid: true,
              isMock: false,
              slipOkValid: true,
            };
          } else {
            console.warn(
              "SlipOK returned non-success response. Slip might be invalid/fake or QR could not be scanned.",
            );
            return {
              ...parsed,
              slipOkValid: false,
            };
          }
        } else {
          const errText = await slipOkRes.text();
          console.error(`SlipOK API error response [${slipOkRes.status}]:`, errText);
        }
      } catch (slipOkError) {
        console.error("SlipOK API fetch call failed:", slipOkError);
      }
    }

    return parsed;
  });
