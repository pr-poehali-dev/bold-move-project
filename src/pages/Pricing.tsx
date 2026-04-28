import { useState } from "react";
import PricingHeroAndTrial from "./pricing/PricingHeroAndTrial";
import PricingPackages from "./pricing/PricingPackages";
import PricingFeatures from "./pricing/PricingFeatures";
import PricingPayment from "./pricing/PricingPayment";

export default function Pricing() {
  const [selected, setSelected] = useState<string | null>(null);

  const choosePackage = (id: string) => {
    setSelected(id);
    setTimeout(() => {
      document.getElementById("payment-block")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#06060c" }}>
      <PricingHeroAndTrial />
      <PricingPackages selected={selected} onSelect={choosePackage} />
      <PricingFeatures />
      <PricingPayment selectedId={selected} />
    </div>
  );
}
