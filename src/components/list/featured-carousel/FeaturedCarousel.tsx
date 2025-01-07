'use client'
import type { FeaturedCardProps } from './FeaturedCard'
import { Carousel } from 'nuka-carousel'
import FeaturedCard from './FeaturedCard'

export interface FeaturedCarouselProps {
  features: FeaturedCardProps[]
}

export default function FeaturedCarousel({ features }: FeaturedCarouselProps) {
  return (
    <Carousel
      autoplay
      autoplayInterval={5000}
      showArrows
      showDots
      wrapMode="wrap"
      className={`
        container

        max-sm:w-[60vh]
      `}

    >
      {features.map(feature => (
        <FeaturedCard key={feature.slug} {...feature} />
      ))}
    </Carousel>
  )
}
