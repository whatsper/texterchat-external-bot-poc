import { OAuth2Client } from 'google-auth-library';

/**
 * Map of token value to expiration timestamp in milliseconds.
 * We don't need to store token `email` claim to verify, because expected value can't change without redeploy and it kept in memory
 */
const validCachedTokens: {
    [token: string]: number; 
} = {};

const authClient = new OAuth2Client();

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

        const tokenInfo = await authClient.getTokenInfo(token);

        if(tokenInfo && tokenInfo.email === expectedServiceAccount && tokenInfo.email_verified){
            validCachedTokens[token] = tokenInfo.expiry_date * 1000;
            return true;
        } else {
            console.warn('Token claims does not match expected', tokenInfo);
            return false;
        }
    } catch (error) {
        console.error('Error verifying token', error);
        return false;
    }
}
