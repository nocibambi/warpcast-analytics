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

type PinataApiResponse = {
  casts: Cast[];
};

function formatDate(ts: number) {
  const FARCASTER_EPOCH_MS = 1609459200000;
  const finalTimestamp = FARCASTER_EPOCH_MS + ts;
  
  const d = new Date(finalTimestamp);
  // Shorter date format for mobile
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/Budapest",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CastStatsTable() {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = "/api/pinata-casts";

    fetch(url)
      .then((res) => res.json())
      .then((data: PinataApiResponse) => {
        setCasts(data.casts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-2 w-full mx-auto">
      <h2 className="text-lg font-semibold mb-2">Post Statistics</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg bg-[var(--app-card-bg)]">
            <thead>
              <tr className="bg-[var(--app-card-border)] text-sm">
                <th className="px-2 py-1 text-left">Time</th>
                <th className="px-2 py-1 text-left">Post</th>
                <th className="px-2 py-1 text-center">Stats</th>
              </tr>
            </thead>
            <tbody>
              {casts.map((cast) => (
                <tr key={cast.hash} className="border-t border-[var(--app-card-border)] text-sm">
                  <td className="px-2 py-1 whitespace-nowrap">
                    {formatDate(cast.timestamp)}
                  </td>
                  <td className="px-2 py-1 max-w-[140px] truncate" title={cast.text}>
                    {cast.text.split("\n")[0].slice(0, 40)}
                  </td>
                  <td className="px-2 py-1 text-center whitespace-nowrap">
                    <span title="Likes">♡ {cast.reactions.count}</span>{' '}
                    <span title="Replies">◎ {cast.replies.count}</span>{' '}
                    <span title="Recasts">↺ {cast.recasts.count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
