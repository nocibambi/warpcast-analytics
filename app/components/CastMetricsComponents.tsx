"use client";

import { useEffect, useState } from "react";

// New Cast type based on new API structure
type Cast = {
  hash: string;
  timestamp: number;
  text: string;
  reactions: { count: number };
  replies: { count: number };
  recasts: { count: number };
};

type Message = {
  data: {
    type: string;
    timestamp: number;
    castAddBody?: {
      text: string;
    };
  };
  hash: string;
};

type ApiResponse = {
  messages: Message[];
};

function formatDate(ts: number) {
  // The new timestamp is likely in seconds, convert to ms if needed
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

export default function CastStatsTable() {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = "https://hoyt.farcaster.xyz:2281/v1/castsByFid?fid=967464";

    fetch(url)
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        // Parse new structure: filter for MESSAGE_TYPE_CAST_ADD
        const parsedCasts: Cast[] = (data.messages || [])
          .filter((msg) => msg.data.type === "MESSAGE_TYPE_CAST_ADD")
          .map((msg) => ({
            hash: msg.hash,
            timestamp: msg.data.timestamp,
            text: msg.data.castAddBody?.text || "",
            reactions: { count: 0 }, // No reactions in new structure, set to 0 or parse if available
            replies: { count: 0 },   // No replies in new structure, set to 0 or parse if available
            recasts: { count: 0 },   // No recasts in new structure, set to 0 or parse if available
          }));
        setCasts(parsedCasts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 w-full max-w-[1800px] mx-auto">
      <h2 className="text-xl font-semibold mb-4">Post Statistics</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[1800px] border border-gray-200 rounded-lg bg-[var(--app-card-bg)]">
            <thead>
              <tr className="bg-[var(--app-card-border)]">
                <th className="px-6 py-2 text-left">Time</th>
                <th className="px-6 py-2 text-left">Title</th>
                <th className="px-6 py-2 text-center">Reactions</th>
                <th className="px-6 py-2 text-center">Replies</th>
                <th className="px-6 py-2 text-center">Recasts</th>
              </tr>
            </thead>
            <tbody>
              {casts.map((cast) => (
                <tr key={cast.hash} className="border-t border-[var(--app-card-border)]">
                  <td className="px-6 py-2 max-w-[25px] whitespace-nowrap">{formatDate(cast.timestamp)}</td>
                  <td className="px-6 py-2 max-w-[50px] truncate" title={cast.text}>
                    {cast.text.split("\n")[0].slice(0, 80)}
                  </td>
                  <td className="px-6 py-2 text-center">{cast.reactions.count}</td>
                  <td className="px-6 py-2 text-center">{cast.replies.count}</td>
                  <td className="px-6 py-2 text-center">{cast.recasts.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
