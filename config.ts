import { ServiceAccount } from 'firebase-admin/app';

export type Config = {
    googleAppCredentials: ServiceAccount;
    texterBaseUrl: string;
    texterApiToken: string;
    jwtServiceAccountName?: string;
};
