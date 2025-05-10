"use client";

import { useEffect, useState } from "react";

type Cast = {
  hash: string;
  timestamp: number;
  text: string;
  reactions: { count: number };
  replies: { count: number };
  recasts: { count: number };
};

type ApiResponse = {
  result: {
    casts: Cast[];
  };
};

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function CastStatsTable() {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replace with your actual API endpoint
    const token = process.env.NEXT_PUBLIC_WARPCAST_API_TOKEN;
    fetch("https://client.warpcast.com/v2/casts?fid=967464&limit=15", {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    })
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        setCasts(data.result.casts);
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
