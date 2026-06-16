import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-28">{children}</div>
      <Footer />
    </main>
  );
}
