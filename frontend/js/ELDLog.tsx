import React from "react";

interface LogSegment {
  type: "On Duty" | "Driving" | "Off Duty" | "Sleeper Berth";
  hours: number;
}

interface ELDLogProps {
  tripDay: number;
  schedule: LogSegment[];
}

const stateColorMap: Record<string, string> = {
  "On Duty": "bg-yellow-400",
  "Driving": "bg-blue-400",
  "Off Duty": "bg-green-400",
  "Sleeper Berth": "bg-indigo-400",
};

export default function ELDLog({ tripDay, schedule }: ELDLogProps) {
  const totalHours = 24;
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <h4 className="text-md font-bold mb-2">Day {tripDay + 1} Log</h4>
      <div className="grid grid-cols-25 gap-0 border border-gray-300 rounded-md overflow-hidden">
        <div className="text-xs font-semibold border-r border-b border-gray-300 p-1">State</div>
        {[...Array(24)].map((_, i) => (
          <div key={i} className="text-xs text-center border-r border-b border-gray-300 p-1">
            {i}
          </div>
        ))}
        {schedule.map((segment, index) => (
          <React.Fragment key={index}>
            <div className="text-xs border-r border-b border-gray-300 p-1">{segment.type}</div>
            <div
              className={`${stateColorMap[segment.type]} h-4`}
              style={{ gridColumn: `span ${Math.round(segment.hours * (24 / totalHours))}` }}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
