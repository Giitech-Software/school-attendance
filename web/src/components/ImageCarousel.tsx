import { useEffect, useState } from "react";

type CarouselImage = { src: string; alt: string };

export default function ImageCarousel({ images, className = "" }: { images: CarouselImage[]; className?: string }) {
  const safeImages = images.filter((image) => image.src);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (safeImages.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => current + 1), 5000);
    return () => window.clearInterval(timer);
  }, [safeImages.length]);

  const displayImages = [...safeImages, safeImages[0]];
  useEffect(() => {
    if (index !== safeImages.length) return;
    const reset = window.setTimeout(() => { setAnimate(false); setIndex(0); requestAnimationFrame(() => setAnimate(true)); }, 700);
    return () => window.clearTimeout(reset);
  }, [index, safeImages.length]);
  if (!safeImages.length) return null;
  return <div className={`relative overflow-hidden ${className}`} aria-roledescription="carousel">
    <div className={animate ? "flex transition-transform duration-700 ease-in-out" : "flex"} style={{ transform: `translateX(-${index * 100}%)` }}>
      {displayImages.map((image, position) => <img key={`${image.src}-${image.alt}-${position}`} src={image.src} alt={image.alt} className="h-[280px] min-w-full object-cover sm:h-[340px] lg:h-[400px]" />)}
    </div>
  </div>;
}
