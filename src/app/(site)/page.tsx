import type { Metadata } from "next";
import { HomeHero } from "@/components/home/Hero";
import { HomeStats } from "@/components/home/Stats";
import { HomeProblem } from "@/components/home/Problem";
import { HomeFeatures } from "@/components/home/Features";
import { HomeVoice } from "@/components/home/Voice";
import { HomeIndia } from "@/components/home/India";
import { HomeHousehold } from "@/components/home/Household";
import { HomeStories } from "@/components/home/Stories";
import { HomeSteps } from "@/components/home/Steps";
import { HomeTestimonials } from "@/components/home/Testimonials";
import { HomeTrust } from "@/components/home/Trust";
import { HomeFinalCTA } from "@/components/home/FinalCTA";

const TITLE = "ÖRZA — Your health, reimagined by AI that evolves with you";
const DESCRIPTION =
  "Snap your meals, chat naturally in English, Hindi or Hinglish, and get instant nutrition insights. India-first AI wellness that learns your lifestyle and helps you thrive — judgment-free.";

export const metadata: Metadata = {
  // `absolute` skips the root "%s · ÖRZA" template — the brand is already in the title.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeStats />
      <HomeProblem />
      <HomeFeatures />
      <HomeVoice />
      <HomeIndia />
      <HomeHousehold />
      <HomeStories />
      <HomeSteps />
      <HomeTestimonials />
      <HomeTrust />
      <HomeFinalCTA />
    </>
  );
}
