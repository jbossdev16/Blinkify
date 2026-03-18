import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Blinkify Pricing — AI Marketing Plans for Ecommerce Brands | From $39/month",
};

export default function SetupPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
