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
      {safeImages.map((image) => <img key={`${image.src}-${image.alt}`} src={image.src} alt={image.alt} className="h-[280px] min-w-full object-cover sm:h-[340px] lg:h-[400px]" />)}
    </div>
  </div>;
}
