import { getSSLHubRpcClient, Message } from "@farcaster/hub-nodejs";

const HUB_URL = "nemes.farcaster.xyz:2283";
const DEFAULT_FID = process.env.DEFAULT_FID ? parseInt(process.env.DEFAULT_FID) : undefined;

export function getCurrentFid(activeFid?: number): number {
    // If we're in development or Vercel environment, use DEFAULT_FID
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV) {
        return DEFAULT_FID || 0;
    }
    
    // Otherwise use the active user's FID
    return activeFid || 0;
}

export async function getUsernameFromFid(fid: number): Promise<string> {
    try {
        const client = getSSLHubRpcClient(HUB_URL);
        const requests = await client.getUserDataByFid({ 
            fid: fid,
            userDataType: 6 // USERNAME type
        });

        const response = await requests.next();
        if (!response.value?.data?.value) {
            return `fid:${fid}`;
        }

        return response.value.data.value.toString();
    } catch (error) {
        console.error('Error fetching username:', error);
        return `fid:${fid}`;
    }
}
