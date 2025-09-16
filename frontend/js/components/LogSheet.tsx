// frontend/js/components/LogSheet.tsx
import { saveAs } from "file-saver";
import { toPng } from "html-to-image";
import React, { useRef } from "react";

type DutySegment = { type: string; hours: number };
type DailySheet = {
  day: number;
  driving_hours: number;
  on_duty_hours: number;
  duty_segments: DutySegment[];
};

export default function LogSheet({
  dailySheets,
}: {
  dailySheets: DailySheet[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const exportPNG = async () => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, { cacheBust: true });
      saveAs(dataUrl, `eld_logs_${Date.now()}.png`);
    } catch (err) {
      console.error(`Failed to export image: ${(err as Error).message}`);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3>Daily ELD Sheets</h3>
        <button className="btn" type="button" onClick={exportPNG}>
          Export as PNG
        </button>
      </div>

      <div
        ref={ref}
        style={{ background: "#fff", padding: 12, borderRadius: 6 }}
      >
        {dailySheets.map((day) => (
          <div
            key={day.day}
            style={{ border: "1px solid #eee", marginBottom: 10, padding: 12 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <strong>Day {day.day}</strong>
              <span>
                Driving: {day.driving_hours}h • On-duty: {day.on_duty_hours}h
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>
                    Segment
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: 6 }}>
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {day.duty_segments.map((s) => (
                  <tr key={s.type}>
                    <td style={{ border: "1px solid #eee", padding: 6 }}>
                      {s.type}
                    </td>
                    <td style={{ border: "1px solid #eee", padding: 6 }}>
                      {s.hours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

