import { cleanEnv, str, json, bool } from 'envalid';

export const env = cleanEnv(process.env, {
    SERVICE_ACCOUNT: json<{
        type: string;
        project_id: string;
        private_key_id: string;
        private_key: string;
        client_email: string;
        client_id: string;
        auth_uri: string;
        token_uri: string;
        auth_provider_x509_cert_url: string;
        client_x509_cert_url: string;
    }>(),
    FILE_PREFIX: str({ default: 'db-backup-' }),
    DATABASE_URL: str(),
    FOLDER_ID: str(),
    CRON_EXPRESSION: str({ default: '0 0 * * *' }),
    RUN_ON_START: bool({ default: false })
});
