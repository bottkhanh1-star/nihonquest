import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nihon Quest — Học Tiếng Nhật",
    short_name: "Nihon Quest",
    description:
      "Học tiếng Nhật cùng Nihon Quest: luyện viết Kana, ôn tập SRS, hội thoại AI và khám phá văn hóa Nhật Bản.",
    start_url: "/app",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1419",
    theme_color: "#d22f27",
    icons: [
      {
        src: "/icon.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
