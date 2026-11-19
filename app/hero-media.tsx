import { existsSync } from "node:fs";
import { join } from "node:path";
const alt = "Fluxo integrado de orçamento, produção e gestão";

export function HeroMedia() {
  const mp4Exists = existsSync(join(process.cwd(), "public", "videos", "hero-oficina.mp4"));
  const webmExists = existsSync(join(process.cwd(), "public", "videos", "hero-oficina.webm"));
  const hasVideo = mp4Exists || webmExists;

  return (
    <div className={`hero-media${hasVideo ? " has-video" : ""}`}>
      <div className="hero-image nexofab-hero-art" role="img" aria-label={alt}><span>NEXO</span><b>FAB</b></div>
      {hasVideo && (
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        >
          {webmExists && <source src="/videos/hero-oficina.webm" type="video/webm" />}
          {mp4Exists && <source src="/videos/hero-oficina.mp4" type="video/mp4" />}
        </video>
      )}
    </div>
  );
}
