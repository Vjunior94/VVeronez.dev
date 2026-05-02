import Navigation from '@/components/landing/Navigation';
import CustomCursor from '@/components/landing/CustomCursor';
import HeroSection from '@/components/landing/HeroSection';
import CredibilityBar from '@/components/landing/CredibilityBar';
import ServicesCinema from '@/components/landing/ServicesCinema';
import ProcessSection from '@/components/landing/ProcessSection';
import SelectedWork from '@/components/landing/SelectedWork';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <>
      <CustomCursor />
      <Navigation />
      <HeroSection />
      <CredibilityBar />
      <ServicesCinema />
      <ProcessSection />
      <SelectedWork />
      <CTASection />
      <Footer />
    </>
  );
}
