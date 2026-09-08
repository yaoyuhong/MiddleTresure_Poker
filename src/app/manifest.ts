import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Middle Treasure Poker",
    short_name: "Middle Treasure",
    description: "Private club games, settlement, and season rankings.",
    start_url: "/club",
    display: "standalone",
    background_color: "#101a17",
    theme_color: "#101a17",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
