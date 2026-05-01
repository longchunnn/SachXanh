import { useEffect, useRef, useState } from "react";

interface CountdownTimerProps {
  endsAt: string; // ISO datetime string
  onExpired?: () => void;
}

export default function CountdownTimer({
  endsAt,
  onExpired,
}: CountdownTimerProps) {
  const [display, setDisplay] = useState("00:00:00");
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const updateCountdown = () => {
      const end = new Date(endsAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);

      if (diff <= 0) {
        setDisplay("00:00:00");
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpired?.();
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDisplay(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [endsAt, onExpired]);

  return (
    <div className="font-mono text-lg font-bold text-white">{display}</div>
  );
}
