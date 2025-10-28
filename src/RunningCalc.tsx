import "./index.css";
import { useState, useEffect } from "react";

// Types
type CalculationMode = "distance" | "time" | "pace";

interface RunningData {
  distance: string;
  time: string;
  pace: string;
}

interface ParsedValues {
  distanceMeters: number | null;
  timeSeconds: number | null;
  paceSecondsPerKm: number | null;
}

// Input parsing utilities
const parseDistance = (input: string): number | null => {
  if (!input.trim()) return null;

  // Remove spaces and convert to lowercase
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");

  // Match patterns like: 10km, 5mi, 10k, 5m, 10, 5.5km, etc.
  const kmMatch = cleaned.match(/^([\d.]+)(?:km?)?$/);
  const miMatch = cleaned.match(/^([\d.]+)(?:mi?|miles?)$/);

  if (miMatch) {
    const miles = parseFloat(miMatch[1]);
    return miles * 1609.344; // Convert miles to meters
  }

  if (kmMatch) {
    const km = parseFloat(kmMatch[1]);
    return km * 1000; // Convert km to meters
  }

  return null;
};

const parseTime = (input: string): number | null => {
  if (!input.trim()) return null;

  const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");

  // Try HH:MM:SS or MM:SS format
  const colonMatch = cleaned.match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (colonMatch) {
    const hours = colonMatch[1] ? parseInt(colonMatch[1]) : 0;
    const minutes = parseInt(colonMatch[2]);
    const seconds = parseInt(colonMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Try human-friendly format: 1h30m, 45m, 30s, 1h30m45s
  const parts = cleaned.match(/(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s(?:ec)?)?/);
  if (parts && (parts[1] || parts[2] || parts[3])) {
    const hours = parts[1] ? parseInt(parts[1]) : 0;
    const minutes = parts[2] ? parseInt(parts[2]) : 0;
    const seconds = parts[3] ? parseInt(parts[3]) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Try just a number (assume minutes)
  const numberMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (numberMatch) {
    return Math.round(parseFloat(numberMatch[1]) * 60);
  }

  return null;
};

const parsePace = (input: string): number | null => {
  if (!input.trim()) return null;

  const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");

  // Try MM:SS format (e.g., 5:30 for 5:30/km)
  const colonMatch = cleaned.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1]);
    const seconds = parseInt(colonMatch[2]);
    return minutes * 60 + seconds;
  }

  // Try decimal minutes (e.g., 5.5 for 5:30/km)
  const numberMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (numberMatch) {
    return Math.round(parseFloat(numberMatch[1]) * 60);
  }

  return null;
};

// Formatting utilities
const formatDistance = (meters: number, unit: "km" | "mi" = "km"): string => {
  if (unit === "mi") {
    return (meters / 1609.344).toFixed(2);
  }
  return (meters / 1000).toFixed(2);
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const formatPace = (secondsPerKm: number): string => {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Pace benchmarks (in seconds per km)
const PACE_BENCHMARKS = [
  { label: "World Record", pace: 171, color: "bg-purple-500" }, // ~2:51/km
  { label: "Elite", pace: 180, color: "bg-red-500" }, // 3:00/km
  { label: "Competitive", pace: 240, color: "bg-orange-500" }, // 4:00/km
  { label: "Advanced", pace: 300, color: "bg-yellow-500" }, // 5:00/km
  { label: "Intermediate", pace: 360, color: "bg-green-500" }, // 6:00/km
  { label: "Beginner", pace: 420, color: "bg-blue-500" }, // 7:00/km
  { label: "Casual", pace: 480, color: "bg-indigo-500" }, // 8:00/km
];

const getPaceBenchmark = (secondsPerKm: number) => {
  for (let i = 0; i < PACE_BENCHMARKS.length; i++) {
    if (secondsPerKm <= PACE_BENCHMARKS[i].pace) {
      return PACE_BENCHMARKS[i];
    }
  }
  return { label: "Relaxed", pace: 600, color: "bg-gray-500" };
};

export function RunningCalc() {
  const [data, setData] = useState<RunningData>({
    distance: "",
    time: "",
    pace: "",
  });

  const [calculatedField, setCalculatedField] = useState<CalculationMode | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [error, setError] = useState<string>("");

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDistance = params.get("distance");
    const urlTime = params.get("time");
    const urlPace = params.get("pace");
    const urlUnit = params.get("unit");

    if (urlUnit === "mi" || urlUnit === "km") {
      setDistanceUnit(urlUnit);
    }

    const newData: RunningData = {
      distance: urlDistance || "",
      time: urlTime || "",
      pace: urlPace || "",
    };

    setData(newData);

    // Determine which field was calculated
    if (urlDistance && urlTime && urlPace) {
      // All three provided, assume pace was calculated
      setCalculatedField("pace");
    }
  }, []);

  // Update URL when data changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (data.distance) params.set("distance", data.distance);
    if (data.time) params.set("time", data.time);
    if (data.pace) params.set("pace", data.pace);
    if (distanceUnit !== "km") params.set("unit", distanceUnit);

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
  }, [data, distanceUnit]);

  const handleInputChange = (field: keyof RunningData, value: string) => {
    setError("");

    // Update the field and clear the calculated field if it's being edited
    setData(prev => ({
      ...prev,
      [field]: value,
    }));

    if (field === calculatedField) {
      setCalculatedField(null);
    }
  };

  const calculate = () => {
    setError("");

    const parsed: ParsedValues = {
      distanceMeters: parseDistance(data.distance),
      timeSeconds: parseTime(data.time),
      paceSecondsPerKm: parsePace(data.pace),
    };

    // Count how many fields are filled
    const filledFields: CalculationMode[] = [];
    if (parsed.distanceMeters !== null) filledFields.push("distance");
    if (parsed.timeSeconds !== null) filledFields.push("time");
    if (parsed.paceSecondsPerKm !== null) filledFields.push("pace");

    if (filledFields.length !== 2) {
      setError("Please enter exactly two values to calculate the third.");
      return;
    }

    // Determine what to calculate
    const fieldToCalculate: CalculationMode =
      filledFields.includes("distance") && filledFields.includes("time") ? "pace" :
      filledFields.includes("distance") && filledFields.includes("pace") ? "time" :
      "distance";

    setCalculatedField(fieldToCalculate);

    // Perform calculation
    if (fieldToCalculate === "pace") {
      // pace = time / distance
      const paceSecondsPerKm = parsed.timeSeconds! / (parsed.distanceMeters! / 1000);
      setData(prev => ({
        ...prev,
        pace: formatPace(paceSecondsPerKm),
      }));
    } else if (fieldToCalculate === "time") {
      // time = distance * pace
      const timeSeconds = (parsed.distanceMeters! / 1000) * parsed.paceSecondsPerKm!;
      setData(prev => ({
        ...prev,
        time: formatTime(timeSeconds),
      }));
    } else {
      // distance = time / pace
      const distanceMeters = (parsed.timeSeconds! / parsed.paceSecondsPerKm!) * 1000;
      setData(prev => ({
        ...prev,
        distance: formatDistance(distanceMeters, distanceUnit),
      }));
    }
  };

  // Auto-calculate when two fields are filled
  useEffect(() => {
    const parsed: ParsedValues = {
      distanceMeters: parseDistance(data.distance),
      timeSeconds: parseTime(data.time),
      paceSecondsPerKm: parsePace(data.pace),
    };

    const filledCount = [
      parsed.distanceMeters !== null,
      parsed.timeSeconds !== null,
      parsed.paceSecondsPerKm !== null,
    ].filter(Boolean).length;

    if (filledCount === 2) {
      calculate();
    }
  }, [data.distance, data.time, data.pace]);

  const clear = () => {
    setData({ distance: "", time: "", pace: "" });
    setCalculatedField(null);
    setError("");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  // Get pace benchmark if pace is calculated
  const paceValue = parsePace(data.pace);
  const benchmark = paceValue ? getPaceBenchmark(paceValue) : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Running Calculator
          </h1>
          <p className="text-lg text-muted-foreground">
            Calculate any missing metric: distance, time, or pace
          </p>
        </div>

        {/* Main calculator */}
        <div className="bg-card border border-border rounded-lg p-6 md:p-8 shadow-sm space-y-6">
          {/* Distance input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-card-foreground">
              Distance
              {calculatedField === "distance" && (
                <span className="ml-2 text-xs text-primary">(calculated)</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.distance}
                onChange={(e) => handleInputChange("distance", e.target.value)}
                placeholder="e.g., 10km, 5mi, 5k"
                className="flex-1 px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={calculatedField === "distance"}
              />
              <select
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value as "km" | "mi")}
                className="px-4 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </div>
          </div>

          {/* Time input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-card-foreground">
              Time
              {calculatedField === "time" && (
                <span className="ml-2 text-xs text-primary">(calculated)</span>
              )}
            </label>
            <input
              type="text"
              value={data.time}
              onChange={(e) => handleInputChange("time", e.target.value)}
              placeholder="e.g., 45:30, 1h30m, 45m"
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={calculatedField === "time"}
            />
          </div>

          {/* Pace input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-card-foreground">
              Pace (per {distanceUnit})
              {calculatedField === "pace" && (
                <span className="ml-2 text-xs text-primary">(calculated)</span>
              )}
            </label>
            <input
              type="text"
              value={data.pace}
              onChange={(e) => handleInputChange("pace", e.target.value)}
              placeholder="e.g., 5:30, 6:00"
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={calculatedField === "pace"}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Pace gauge */}
          {benchmark && calculatedField === "pace" && (
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-card-foreground">
                  Performance Level
                </span>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${benchmark.color} text-white`}>
                  {benchmark.label}
                </span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div className="absolute inset-0 flex">
                  {PACE_BENCHMARKS.map((bm, i) => (
                    <div
                      key={i}
                      className={`${bm.color} ${paceValue! <= bm.pace ? "opacity-100" : "opacity-30"}`}
                      style={{ width: `${100 / PACE_BENCHMARKS.length}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Faster</span>
                <span>Slower</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={clear}
              className="flex-1 px-4 py-2 border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Clear
            </button>
            <button
              onClick={copyUrl}
              className="flex-1 px-4 py-2 border border-input rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              disabled={!data.distance && !data.time && !data.pace}
            >
              Copy URL
            </button>
          </div>
        </div>

        {/* Help text */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            Enter any two values and the third will be calculated automatically.
          </p>
          <p>
            Supported formats: 10km, 5mi, 1h30m, 45:30, 5:30/km
          </p>
        </div>

        {/* Back to home */}
        <div className="text-center">
          <a
            href="/"
            className="text-sm text-primary hover:underline"
          >
            ← Back to Marvell Tools
          </a>
        </div>
      </div>
    </div>
  );
}

export default RunningCalc;
