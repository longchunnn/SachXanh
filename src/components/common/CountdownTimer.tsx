import { useEffect, useRef, useState } from "react";

interface CountdownTimerProps {
  endsAt: string; // ISO datetime string
  onExpired?: () => void;
}

type TimeParts = {
  hours: string;
  minutes: string;
  seconds: string;
};

function TimeBox({ value }: { value: string }) {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center rounded-sm border-4 border-gray-900 bg-white text-3xl font-extrabold text-gray-900 sm:h-16 sm:w-16 sm:text-4xl"
    >
      <span
        className="font-mono leading-none"
        style={{ fontFeatureSettings: '"zero" 0', fontVariantNumeric: "normal" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function CountdownTimer({
  endsAt,
  onExpired,
}: CountdownTimerProps) {
  const [display, setDisplay] = useState<TimeParts>({
    hours: "00",
    minutes: "00",
    seconds: "00",
  });
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    const updateCountdown = () => {
      const end = new Date(endsAt).getTime();
      const now = Date.now();
      const diff = Number.isFinite(end) ? Math.max(0, end - now) : 0;

      if (diff <= 0) {
        setDisplay({ hours: "00", minutes: "00", seconds: "00" });
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpired?.();
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDisplay({
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [endsAt, onExpired]);

  return (
    <div className="inline-flex items-center gap-2">
      <TimeBox value={display.hours} />
      <span className="text-3xl font-extrabold text-gray-900 sm:text-4xl">:</span>
      <TimeBox value={display.minutes} />
      <span className="text-3xl font-extrabold text-gray-900 sm:text-4xl">:</span>
      <TimeBox value={display.seconds} />
    </div>
  );
}
