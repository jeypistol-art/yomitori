import { ImageResponse } from "next/og";

export const alt = "YOMITORI DocuTask - 書類を、要約・タスク・リマインド・証跡へ。";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f7f8f5",
          color: "#1f2933",
          fontFamily: "Arial, sans-serif",
          padding: "64px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #102c27 0%, #1f4f43 54%, #d7b56d 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "45%",
            height: "100%",
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: "#f7f8f5",
                color: "#2f5d50",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                fontWeight: 900,
              }}
            >
              Y
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, color: "#d7b56d", fontWeight: 700 }}>
                YOMITORI
              </div>
              <div style={{ fontSize: 44, color: "#ffffff", fontWeight: 900 }}>
                DocuTask
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                color: "#ffffff",
                fontSize: 70,
                lineHeight: 1.08,
                fontWeight: 900,
                maxWidth: 850,
              }}
            >
              書類を、要約・タスク・リマインド・証跡へ。
            </div>
            <div
              style={{
                color: "#e7eee9",
                fontSize: 30,
                lineHeight: 1.45,
                maxWidth: 840,
              }}
            >
              不動産・施設管理会社向けの書類タスク化SaaS
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              color: "#ffffff",
              fontSize: 25,
              fontWeight: 700,
            }}
          >
            <span>行政通知</span>
            <span>契約更新</span>
            <span>点検報告</span>
            <span>メール本文</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
