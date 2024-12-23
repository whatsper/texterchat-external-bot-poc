/**
 * Map of token value to expiration timestamp in milliseconds.
 * We don't need to store token `email` claim to verify, because expected value can't change without redeploy and it kept in memory
 */
const validCachedTokens: {
    [token: string]: number; 
} = {};

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
        const queryParams = new URLSearchParams();
        queryParams.set('id_token', token);
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?${queryParams.toString()}`);
        if (!response.ok) {
            const data = await response.text();
            console.error('Error verifying token', { status: response.status, data });
            return false;
        }
        const data = await response.json();
        if(data.email === expectedServiceAccount){
            validCachedTokens[token] = parseInt(data.exp, 10) * 1000;
            return true;
        } else {
            console.warn('Token email claim does not match expected service account', data);
            return false;
        }
    } catch (error) {
        console.error('Error verifying token', error);
        return false;
    }
}
