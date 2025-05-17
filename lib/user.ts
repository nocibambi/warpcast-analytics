import { getSSLHubRpcClient } from "@farcaster/hub-nodejs";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const DEFAULT_FID = process.env.DEFAULT_FID
  ? parseInt(process.env.DEFAULT_FID)
  : undefined;

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_API_JWT;

export function getCurrentFid(activeFid?: number): number {
  // If we're in development or Vercel environment, use DEFAULT_FID
  if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV) {
    return DEFAULT_FID || 0;
  }

  // Otherwise use the active user's FID
  return activeFid || 0;
}

interface UserDataMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    userDataBody: {
      type: string;
      value: string;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export async function getUsernameFromFid(fid: number): Promise<string> {
  try {
    const response = await fetch(
      `https://hub.pinata.cloud/v1/userDataByFid?fid=${fid}&userDataType=USER_DATA_TYPE_USERNAME`,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${PINATA_JWT}`,
        },
      },
    );

    if (!response.ok) {
      return `fid:${fid}`;
    }

    const data = await response.json();
    const messages = data.messages as UserDataMessage[];
    const usernameMsg = messages
      .filter((m) => m.data?.userDataBody?.type === "USER_DATA_TYPE_USERNAME")
      .sort((a, b) => b.data.timestamp - a.data.timestamp)[0];

    if (usernameMsg?.data?.userDataBody?.value) {
      return usernameMsg.data.userDataBody.value;
    }

    return `fid:${fid}`;
  } catch (error) {
    return `fid:${fid}`;
  }
}
