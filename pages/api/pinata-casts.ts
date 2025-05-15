import type { NextApiRequest, NextApiResponse } from "next";
import { validateFrameMessage } from '@farcaster/core';

interface FrameRequest {
  trustedData?: {
    messageBytes: string;
  };
  untrustedData: {
    fid: number;
    url: string;
    messageHash: string;
    timestamp: number;
    network: number;
    buttonIndex: number;
    inputText: string;
    castId: {
      fid: number;
      hash: string;
    };
  };
}

// Types for Pinata Casts and Reactions
interface CastAddBody {
  text?: string;
  parentCastId?: { fid: number; hash: string };
}

interface CastData {
  type: string;
  timestamp: number;
  castAddBody?: CastAddBody;
}

interface CastMessage {
  hash: string;
  data: CastData;
}

interface Reaction {
  type: string;
}

interface ReactionsResponse {
  reactions?: Reaction[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Validate frame and get user info
  const body = req.body as FrameRequest;
  if (!body?.untrustedData?.fid) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const fid = body.untrustedData.fid;
  const jwt = process.env.NEXT_PUBLIC_PINATA_API_JWT;
  const baseUrl = "https://hub.pinata.cloud/v1";

  // Get user profile to get username
  const userProfileUrl = `${baseUrl}/profile?fid=${fid}`;
  const userProfileResp = await fetch(userProfileUrl, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${jwt}`,
    },
  });
  
  const userProfile = await userProfileResp.json();
  const username = userProfile.username || `user_${fid}`;

  // 1. Fetch all casts
  const castsUrl = `${baseUrl}/castsByFid?fid=${fid}`;
  const castsResponse = await fetch(castsUrl, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${jwt}`,
    },
  });

  if (!castsResponse.ok) {
    res.status(castsResponse.status).json({ error: "Failed to fetch casts" });
    return;
  }

  const castsData: { messages?: CastMessage[] } = await castsResponse.json();

  // 2. Filter to only MESSAGE_TYPE_CAST_ADD from this user
  const allCasts: CastMessage[] = (castsData.messages || []).filter(
    (msg: CastMessage) => {
      return msg.data?.type === "MESSAGE_TYPE_CAST_ADD";
    },
  );

  // Build a map from hash to cast for easy lookup
  const castMap = new Map<string, CastMessage>();
  allCasts.forEach((msg: CastMessage) => {
    castMap.set(msg.hash, msg);
  });

  // For each cast, find its thread root
  function findThreadRoot(msg: CastMessage): CastMessage {
    let current = msg;
    while (true) {
      const parentCastId = current.data.castAddBody?.parentCastId;
      if (!parentCastId) return current;
      if (parentCastId.fid !== fid) return current;
      const parent = castMap.get(parentCastId.hash);
      if (!parent) return current;
      current = parent;
    }
  }

  // Group casts by thread root hash
  const threadsMap = new Map<string, CastMessage[]>();
  allCasts.forEach((msg: CastMessage) => {
    const root = findThreadRoot(msg);
    const rootHash = root.hash;
    // Only group threads where the root cast is NOT a reply to another user's cast
    const parentCastId = root.data.castAddBody?.parentCastId;
    if (!parentCastId || parentCastId.fid === fid) {
      if (!threadsMap.has(rootHash)) threadsMap.set(rootHash, []);
      threadsMap.get(rootHash)!.push(msg);
    }
  });

  // Helper to fetch reactions for a cast hash
  async function fetchReactions(hash: string) {
    const url = `${baseUrl}/cast-reactions?castHash=${encodeURIComponent(hash)}`;
    const resp = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${jwt}`,
      },
    });
    if (!resp.ok) return { likes: 0, recasts: 0 };
    const data: ReactionsResponse = await resp.json();
    let likes = 0,
      recasts = 0;
    for (const r of data.reactions || []) {
      if (r.type === "REACTION_TYPE_LIKE") likes++;
      if (r.type === "REACTION_TYPE_RECAST") recasts++;
    }
    return { likes, recasts };
  }

  // For each thread, aggregate reactions and replies
  const results = await Promise.all(
    Array.from(threadsMap.entries()).map(async ([rootHash, threadCasts]) => {
      // Aggregate reactions and recasts for all casts in the thread
      let totalLikes = 0,
        totalRecasts = 0;
      await Promise.all(
        threadCasts.map(async (msg: CastMessage) => {
          const { likes, recasts } = await fetchReactions(msg.hash);
          totalLikes += likes;
          totalRecasts += recasts;
        }),
      );
      // Replies = thread length - 1 (excluding root)
      const replies = threadCasts.length - 1;
      // Use root cast info for display
      const root = castMap.get(rootHash)!;
      return {
        hash: root.hash,
        username, // Use dynamic username
        timestamp: root.data.timestamp * 1000,
        text: root.data.castAddBody?.text ?? "",
        reactions: { count: totalLikes },
        replies: { count: replies },
        recasts: { count: totalRecasts },
      };
    }),
  );

  res.status(200).json({ casts: results });
}
