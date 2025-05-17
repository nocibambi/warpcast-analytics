import type { NextApiRequest, NextApiResponse } from "next";
import { getUsernameFromFid, getCurrentFid } from "@/lib/user";

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

// Add timeout utility
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Utility to chunk array for batch processing
function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const jwt = process.env.NEXT_PUBLIC_PINATA_API_JWT;
    const baseUrl = "https://hub.pinata.cloud/v1";
    const fid = getCurrentFid();

    // 1. Fetch all casts with timeout
    const castsUrl = `${baseUrl}/castsByFid?fid=${fid}&reverse=true`;
    const castsResponse = await fetchWithTimeout(
      castsUrl,
      {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${jwt}`,
        },
      },
      10000
    );

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

    // Helper to fetch reactions for a cast hash with error handling
    async function fetchReactions(hash: string) {
      try {
        const url = `${baseUrl}/cast-reactions?castHash=${encodeURIComponent(hash)}`;
        const resp = await fetchWithTimeout(
          url,
          {
            headers: {
              accept: "application/json",
              authorization: `Bearer ${jwt}`,
            },
          },
          5000
        );
        if (!resp.ok) return { likes: 0, recasts: 0 };
        const data: ReactionsResponse = await resp.json();
        let likes = 0, recasts = 0;
        for (const r of data.reactions || []) {
          if (r.type === "REACTION_TYPE_LIKE") likes++;
          if (r.type === "REACTION_TYPE_RECAST") recasts++;
        }
        return { likes, recasts };
      } catch (error) {
        console.error(`Error fetching reactions for cast ${hash}:`, error);
        return { likes: 0, recasts: 0 };
      }
    }

    // For each thread, aggregate reactions and replies with concurrency limit
    const batchSize = 5;
    const results = [];
    for (const batch of chunk(Array.from(threadsMap.entries()), batchSize)) {
      const batchResults = await Promise.all(
        batch.map(async ([rootHash, threadCasts]) => {
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
          const username = await getUsernameFromFid(fid);

          return {
            hash: root.hash,
            username,
            timestamp: root.data.timestamp * 1000,
            text: root.data.castAddBody?.text ?? "",
            reactions: { count: totalLikes },
            replies: { count: replies },
            recasts: { count: totalRecasts },
          };
        })
      );
      results.push(...batchResults);
    }

    res.status(200).json({ casts: results });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
