import { Certificates, OAuth2Client } from 'google-auth-library';

/**
 * Map of token value to expiration timestamp in milliseconds.
 * We don't need to store token `email` claim to verify, because expected value can't change without redeploy and it kept in memory
 */
const validCachedTokens: {
    [token: string]: number; 
} = {};

let certificates: Certificates | null = null;

const authClient = new OAuth2Client();

async function getCertificates(): Promise<Certificates> {
    if (!certificates) {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/certs');
        if (!response.ok) {
            const data = await response.text();
            throw new Error('Error getting google oauth certificates. Status: ' + response.status + '; Response: ' + JSON.stringify(data));
        }
        certificates = await response.json();
    }
    return certificates as Certificates;
}

/**
 * Verifies the given token is a valid Google OAuth token and the `email` claim in the token matches the expected service account.
 * 
 * Valid tokens cached in memory to avoid extra external calls
 * 
 * @link https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions#protocol
 * 
 * @param token Token to verify
 * @param expectedServiceAccount Expected `email` claim value in the token
 */
export async function verifyPubSubToken(token: string, expectedServiceAccount: string): Promise<boolean> {
   
    if (validCachedTokens[token]) {
        if (validCachedTokens[token] > Date.now()) {
            return true;
        } else {
            delete validCachedTokens[token];
            return false;
        }
    }

    try {

        const ticket = await authClient.verifySignedJwtWithCertsAsync(
            token,
            await getCertificates(),
        );

        const claim = ticket.getPayload();

        if(claim && claim.email === expectedServiceAccount && claim.email_verified){
            validCachedTokens[token] = claim.exp * 1000;
            return true;
        } else {
            console.warn('Token email claims does not match expected', claim);
            return false;
        }
    } catch (error) {
        console.error('Error verifying token', error);
        return false;
    }
}
