import { useEffect, useState } from "react";

type CarouselImage = { src: string; alt: string };

export default function ImageCarousel({ images, className = "" }: { images: CarouselImage[]; className?: string }) {
  const safeImages = images.filter((image) => image.src);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (safeImages.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => current >= safeImages.length - 1 ? 0 : current + 1), 5000);
    return () => window.clearInterval(timer);
  }, [safeImages.length]);

  if (!safeImages.length) return null;
  return <div className={`relative overflow-hidden ${className}`} aria-roledescription="carousel">
    <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${index * 100}%)` }}>
      {safeImages.map((image) => <img key={`${image.src}-${image.alt}`} src={image.src} alt={image.alt} className="h-[190px] min-w-full object-cover sm:h-[240px] lg:h-[300px]" />)}
    </div>
    {safeImages.length > 1 ? <>
      <button type="button" onClick={() => setIndex((current) => current === 0 ? safeImages.length - 1 : current - 1)} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/55 text-xl font-bold text-white shadow" aria-label="Previous image">‹</button>
      <button type="button" onClick={() => setIndex((current) => current === safeImages.length - 1 ? 0 : current + 1)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/55 text-xl font-bold text-white shadow" aria-label="Next image">›</button>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">{safeImages.map((image, imageIndex) => <button key={`${image.src}-dot`} type="button" onClick={() => setIndex(imageIndex)} className={`h-2 w-2 rounded-full ${imageIndex === index ? "bg-white" : "bg-white/50"}`} aria-label={`Show image ${imageIndex + 1}`} />)}</div>
    </> : null}
  </div>;
}
