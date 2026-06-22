import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import Problem from "@/components/Problem";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import ProcessRoadmap from "@/components/ProcessRoadmap";
import Comparison from "@/components/Comparison";
import Pricing from "@/components/Pricing";
import ROICalculator from "@/components/ROICalculator";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import BackToTop from "@/components/BackToTop";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <SocialProof />
      <Problem />
      <Features />
      <HowItWorks />
      <ProcessRoadmap />
      <Comparison />
      <Pricing />
      <ROICalculator />
      <FAQ />
      <CTABanner />
      <Footer />
      <BackToTop />
    </main>
  );
}
