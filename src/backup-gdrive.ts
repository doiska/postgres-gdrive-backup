import { drive } from "@googleapis/drive";
import { JWT } from "google-auth-library";
import { env } from "./env";
import { exec, execSync } from "child_process";
import { unlink } from "fs/promises";
import { statSync } from "fs";
import * as path from "path";
import * as os from "os";
import { filesize } from "filesize";
import { createReadStream } from "fs";

const auth = new JWT({
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
        exec(`pg_dump --dbname=${env.DATABASE_URL} --format=tar | gzip > ${path}`,
            (err, stdout, stderr) => {
                if (err) {
                    reject({
                        error: err,
                        stderr: stderr.trimEnd(),
                    });
                    return;
                }

                if (!!stderr) {
                    console.log(stderr.trimEnd());
                }

                const isFileValid = execSync(`gzip -cd ${path} | head -c1`).length > 0;

                if(!isFileValid) {
                    console.error("Backup file is empty");
                    reject("Backup file is empty");
                    return;
                }

                console.log(`Backup file size: ${filesize(statSync(path).size)}`);
                console.log(`Backup file created at: ${path}`)

                if(stdout) {
                    console.log(stdout);
                }

                resolve(stdout);
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
        body: createReadStream(path)
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
        const filepath = path.join(os.tmpdir(), filename);

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
