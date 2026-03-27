declare module "lucide-react/dist/esm/icons/*" {
  import type { LucideProps } from "lucide-react";
  import type { ForwardRefExoticComponent, RefAttributes } from "react";

  const icon: ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>;
  export default icon;
}
