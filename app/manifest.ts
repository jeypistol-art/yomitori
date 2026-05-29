import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YOMITORI DocuTask",
    short_name: "YOMITORI",
    description:
      "書類を、要約・タスク・リマインド・証跡へ。不動産・施設管理会社向けの書類タスク化SaaS。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f5",
    theme_color: "#2f5d50",
    lang: "ja",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
