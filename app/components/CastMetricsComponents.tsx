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
    fetch("/api/warpcast_stats")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        setCasts(data.result.casts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Post Statistics</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg bg-[var(--app-card-bg)]">
            <thead>
              <tr className="bg-[var(--app-card-border)]">
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-center">Reactions</th>
                <th className="px-4 py-2 text-center">Replies</th>
                <th className="px-4 py-2 text-center">Recasts</th>
              </tr>
            </thead>
            <tbody>
              {casts.map((cast) => (
                <tr key={cast.hash} className="border-t border-[var(--app-card-border)]">
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(cast.timestamp)}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={cast.text}>
                    {cast.text.split("\n")[0].slice(0, 80)}
                  </td>
                  <td className="px-4 py-2 text-center">{cast.reactions.count}</td>
                  <td className="px-4 py-2 text-center">{cast.replies.count}</td>
                  <td className="px-4 py-2 text-center">{cast.recasts.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
