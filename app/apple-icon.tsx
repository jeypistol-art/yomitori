import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f5d50",
          color: "#f7f8f5",
          fontFamily: "Arial, sans-serif",
          fontSize: 104,
          fontWeight: 900,
        }}
      >
        Y
      </div>
    ),
    size
  );
}
