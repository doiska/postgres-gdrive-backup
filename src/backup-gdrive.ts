import { drive } from "@googleapis/drive";
import { google } from "googleapis";
import { env } from "./env.ts";
import { exec } from "child_process";
import { unlink } from "fs/promises";

const auth = new google.auth.JWT({
    email: env.SERVICE_ACCOUNT.client_email,
    key: env.SERVICE_ACCOUNT.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
});

const gdrive = drive({
    version: "v3",
    auth: auth,
});

const dumpToFile = async (path: string) => {
    return new Promise((resolve, reject) => {
        exec(`pg_dump ${env.DATABASE_URL} -F t | gzip > ${path}`,
            (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout);
                }
            }
        );
    });
}

const pushToDrive = async (filename: string, path: string) => {
    const folderAccess = await gdrive.files.get({
        fileId: env.FOLDER_ID,
        fields: "id",
    });

    if (!folderAccess.data.id) {
        console.error(`No access to FOLDER_ID: ${env.FOLDER_ID}`);
        return;
    }

    const fileMetadata = {
        name: filename,
        parents: [env.FOLDER_ID],
    };

    const media = {
        mimeType: "application/gzip",
        body: path,
    };

    await gdrive.files.create({
        requestBody: fileMetadata,
        media: media,
    });
}

export async function run() {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-");

        const filename = `${env.FILE_PREFIX}${timestamp}.tar.gz`;
        const filepath = `/tmp/${filename}`

        console.log(`Starting backup of ${filename}`);

        await dumpToFile(filepath);

        console.log("Backup done! Uploading to Google Drive...");

        await pushToDrive(filename, filepath);

        console.log("Backup uploaded to Google Drive!");

        await unlink(filepath);

        console.log("All done!");
    } catch (err) {
        console.error("Something went wrong:", err);
    }
}