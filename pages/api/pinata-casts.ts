import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const jwt = process.env.NEXT_PUBLIC_PINATA_API_JWT;
  const baseUrl = "https://hub.pinata.cloud/v1";
  const fid = 967464;

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

  const castsData = await castsResponse.json();

  // 2. For each cast, filter out replies to other users' casts
  const messages = (castsData.messages || []).filter((msg: any) => {
    if (msg.data?.type !== "MESSAGE_TYPE_CAST_ADD") return false;
    const parentCastId = msg.data.castAddBody?.parentCastId;
    // Keep if not a reply, or if replying to own cast
    return !parentCastId || parentCastId.fid === fid;
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
    if (!resp.ok) return { likes: 0, recasts: 0, replies: 0 };
    const data = await resp.json();
    // Count reactions by type
    let likes = 0,
      recasts = 0,
      replies = 0;
    for (const r of data.reactions || []) {
      if (r.type === "REACTION_TYPE_LIKE") likes++;
      if (r.type === "REACTION_TYPE_RECAST") recasts++;
    }
    // Replies are not included in reactions, so keep as 0
    return { likes, recasts, replies };
  }

  // 3. Fetch reactions in parallel (limit concurrency if needed)
  const results = await Promise.all(
    messages.map(async (msg: any) => {
      const { likes, recasts, replies } = await fetchReactions(msg.hash);
      return {
        hash: msg.hash,
        timestamp: msg.data.timestamp,
        text: msg.data.castAddBody?.text ?? "",
        reactions: { count: likes },
        replies: { count: replies },
        recasts: { count: recasts },
      };
    }),
  );

  res.status(200).json({ casts: results });
}
