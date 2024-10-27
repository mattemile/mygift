import { Carousel } from "@/components/carousel";
import { ThreeItemGrid } from "@/components/grid/three-items";
import Hero from "@/components/hero";
import Footer from "@/components/layout/footer";
import ConnectSupabaseSteps from "@/components/tutorial/connect-supabase-steps";
import SignUpUserSteps from "@/components/tutorial/sign-up-user-steps";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Suspense } from "react";

export const metadata = {
  description: 'High-performance ecommerce store built with Next.js, Vercel, and BigCommerce.',
  openGraph: {
    type: 'website'
  }
};

export default async function Index() {
  return (
    <>
      <ThreeItemGrid />
        <Carousel />
          <Footer />
    </>
  );
}
