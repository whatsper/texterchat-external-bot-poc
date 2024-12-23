import Ajv from 'ajv';
import { existsSync, readFileSync } from 'fs';

export function createConfig(
    deps: {
        ajv: Ajv;
    }
){

    const validateEnvironment = deps.ajv.compile({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
            GOOGLE_SERVICE_ACCOUNT_KEY: { type: 'string' },
            TEXTER_BASE_URL: { type: 'string' },
            TEXTER_API_TOKEN: { type: 'string' },
            JWT_SERVICE_ACCOUNT_NAME: { type: 'string' },
        },
        required: ['GOOGLE_SERVICE_ACCOUNT_KEY', 'TEXTER_BASE_URL', 'TEXTER_API_TOKEN'],
    });

    if (!validateEnvironment(process.env)) {
        console.error('Invalid environment variables', { errors: deps.ajv.errorsText(validateEnvironment.errors) });
        throw new Error('Invalid environment variables');
    }

    if (!existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY file does not exist: ' + process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    return {
        config: {
            googleAppCredentials: JSON.parse(
                readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).toString()
            ),
            texterBaseUrl: process.env.TEXTER_BASE_URL,
            texterApiToken: process.env.TEXTER_API_TOKEN,
            jwtServiceAccountName: process.env.JWT_SERVICE_ACCOUNT_NAME,
        },
    };
}
