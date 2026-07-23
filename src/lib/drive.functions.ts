import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UploadInputSchema = z.object({
  fileName: z.string(),
  base64Data: z.string(),
  customerNumber: z.string(),
  mimeType: z.string(),
});

// Direct service account authentication helper with dynamic ignored import
async function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is missing. " +
        "Please set them in your .env.local file to connect to Google Drive.",
    );
  }

  // /* @vite-ignore */ prevents Vite from analyzing/bundling this package for client
  const { google } = await import(/* @vite-ignore */ "googleapis");

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return { auth, google };
}

// Uploads a base64 encoded slip image to Google Drive, categorizes it by Customer, and returns a shareable link.
export const uploadSlipToDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => UploadInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { auth, google } = await getAuth();
      const drive = google.drive({ version: "v3", auth });

      let parentFolderId = process.env.GOOGLE_DRIVE_SLIPS_FOLDER_ID;

      // 1. If no parent folder ID is specified, locate or create a root folder named "NICHE BLOOM Slips"
      if (!parentFolderId) {
        console.log(
          "No GOOGLE_DRIVE_SLIPS_FOLDER_ID in env, searching for 'NICHE BLOOM Slips' folder...",
        );
        const listRes = await drive.files.list({
          q: "name = 'NICHE BLOOM Slips' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: "files(id)",
        });

        const files = listRes.data.files ?? [];
        if (files.length > 0) {
          parentFolderId = files[0].id!;
          console.log(`Found existing main folder with ID: ${parentFolderId}`);
        } else {
          console.log("Creating new main folder 'NICHE BLOOM Slips'...");
          const folder = await drive.files.create({
            requestBody: {
              name: "NICHE BLOOM Slips",
              mimeType: "application/vnd.google-apps.folder",
            },
            fields: "id",
          });
          parentFolderId = folder.data.id!;

          // Share this main folder as reader to anyone so public links will resolve
          await drive.permissions.create({
            fileId: parentFolderId,
            requestBody: { role: "reader", type: "anyone" },
          });
        }
      }

      // 2. Create or locate a customer-specific subfolder (e.g., "NICHE BLOOM Slips - CNNB001")
      let targetFolderId = parentFolderId;
      const subfolderName = `NICHE BLOOM Slips - ${data.customerNumber}`;
      console.log(`Searching for subfolder: '${subfolderName}'...`);

      const sublistRes = await drive.files.list({
        q: `name = '${subfolderName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id)",
      });

      const subfiles = sublistRes.data.files ?? [];
      if (subfiles.length > 0) {
        targetFolderId = subfiles[0].id!;
        console.log(`Found existing subfolder with ID: ${targetFolderId}`);
      } else {
        console.log(`Creating new subfolder: '${subfolderName}'...`);
        const subfolder = await drive.files.create({
          requestBody: {
            name: subfolderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentFolderId],
          },
          fields: "id",
        });
        targetFolderId = subfolder.data.id!;

        // Share this customer folder as reader to anyone
        await drive.permissions.create({
          fileId: targetFolderId,
          requestBody: { role: "reader", type: "anyone" },
        });
      }

      // 3. Upload the slip image
      const formattedDate = new Date().toISOString().slice(0, 10);
      const fileName = `${formattedDate}_${data.fileName}`;
      console.log(`Uploading file '${fileName}' to subfolder: ${targetFolderId}...`);

      const file = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [targetFolderId],
        },
        media: {
          mimeType: data.mimeType,
          body: Buffer.from(data.base64Data, "base64"),
        },
        fields: "id, webViewLink, webContentLink",
      });

      // 4. Ensure individual file is shareable (readers can open)
      await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: { role: "reader", type: "anyone" },
      });

      // We prefer the direct link or direct webViewLink
      return {
        fileId: file.data.id,
        url: file.data.webViewLink || "",
      };
    } catch (error) {
      console.error("Google Drive upload failed:", error);
      throw error;
    }
  });
