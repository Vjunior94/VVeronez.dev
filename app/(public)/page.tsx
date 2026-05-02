import dynamic from 'next/dynamic';
import Navigation from '@/components/landing/Navigation';
import CustomCursor from '@/components/landing/CustomCursor';
import HeroSection from '@/components/landing/HeroSection';
import CredibilityBar from '@/components/landing/CredibilityBar';

const ServicesCinema = dynamic(() => import('@/components/landing/ServicesCinema'));
const ProcessSection = dynamic(() => import('@/components/landing/ProcessSection'));
const SelectedWork = dynamic(() => import('@/components/landing/SelectedWork'));
const CTASection = dynamic(() => import('@/components/landing/CTASection'));
const Footer = dynamic(() => import('@/components/landing/Footer'));

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
