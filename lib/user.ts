import { getSSLHubRpcClient } from "@farcaster/hub-nodejs";

const HUB_URL = "nemes.farcaster.xyz:2283";
const DEFAULT_FID = process.env.DEFAULT_FID
  ? parseInt(process.env.DEFAULT_FID)
  : undefined;

export function getCurrentFid(activeFid?: number): number {
  // If we're in development or Vercel environment, use DEFAULT_FID
  if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV) {
    return DEFAULT_FID || 0;
  }

  // Otherwise use the active user's FID
  return activeFid || 0;
}

export async function getUsernameFromFid(fid: number): Promise<string> {
  try {
    const client = getSSLHubRpcClient(HUB_URL);
    const result = await client.getUserData({
      fid: fid,
      userDataType: 6, // USERNAME type
    });

    if (result.isOk() && result.value?.data?.userDataBody?.value) {
      return result.value.data.userDataBody.value;
    }

    return fid.toString(); // Fallback to fid if no username found
  } catch (error) {
    console.error("Error fetching username:", error);
    return fid.toString(); // Fallback to fid if no username found
  }
}
