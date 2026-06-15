import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import Problem from "@/components/Problem";
import Features from "@/components/Features";
import Comparison from "@/components/Comparison";
import Pricing from "@/components/Pricing";
import CTABanner from "@/components/CTABanner";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import BackToTop from "@/components/BackToTop";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <SocialProof />
      <Problem />
      <Features />
      <Comparison />
      <Pricing />
      <CTABanner />
      <Footer />
      <BackToTop />
    </main>
  );
}
