import { ServiceAccount } from 'firebase-admin/app';

export type Config = {
    googleAppCredentials: ServiceAccount;
    jwtServiceAccountName?: string;
};
