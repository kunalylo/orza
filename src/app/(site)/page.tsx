import type { Metadata } from "next";
import { SITE, pageMetadata, siteOrigin } from "@/lib/site";
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

export const metadata: Metadata = pageMetadata({
  // `absoluteTitle` skips the root "%s · ÖRZA" template — the brand is already in the title.
  title: TITLE,
  absoluteTitle: true,
  description: DESCRIPTION,
  path: "/",
});

/** schema.org Organization + WebSite structured data (brand name, logo and support contact for search results). */
function homeJsonLd() {
  const origin = siteOrigin().origin;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: SITE.name,
        url: origin,
        logo: `${origin}/icons/icon-512.png`,
        description: SITE.description,
        contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SITE.supportEmail, availableLanguage: ["en", "hi"] }],
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: SITE.name,
        url: origin,
        description: DESCRIPTION,
        inLanguage: "en-IN",
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd() }} />
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
