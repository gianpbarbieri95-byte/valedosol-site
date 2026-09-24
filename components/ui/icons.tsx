import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

/**
 * Ícones em SVG inline. Uma biblioteca de ícones traria centenas de arquivos
 * para usar catorze — e o traço fino e uniforme importa mais aqui do que a
 * variedade. Todos herdam currentColor e o tamanho vem da classe.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, ...props }: IconProps & { children: React.ReactNode }) {
  // O tamanho padrão acompanha a fonte, mas quem chama pode fixar o seu.
  // Sem essa checagem a classe de quem chama apenas se soma à padrão, e o
  // resultado passa a depender da ordem em que o Tailwind emitiu as regras.
  const sized = className ? /(^|\s)(size-|h-|w-)\S/.test(className) : false;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", !sized && "size-[1.125em]", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export const BedIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 18v-6.5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5V18" />
    <path d="M3 15h18M3 18v2M21 18v2" />
    <path d="M6 10V7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5V10" />
  </Icon>
);

export const BathIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2Z" />
    <path d="M6 12V6a2 2 0 0 1 3.5-1.3" />
    <path d="M7 19l-1 2M17 19l1 2" />
  </Icon>
);

export const CarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 17h14M4 17v2M20 17v2" />
    <path d="M3.5 17v-4l1.8-4.2A2 2 0 0 1 7.1 7.5h9.8a2 2 0 0 1 1.8 1.3L20.5 13v4" />
    <path d="M3.5 13h17M7 15h1.5M15.5 15H17" />
  </Icon>
);

export const AreaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4h16v16H4z" />
    <path d="M4 9h3M4 15h3M9 4v3M15 4v3" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 4h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L14 13l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3 5.6 1.5 1.5 0 0 1 4.5 4Z" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8.2a4 4 0 0 1 7-.6c.6 1 .6 2.2 0 3.2C17.6 15.6 12 20 12 20Z" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14 6-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m10 6 6 6-6 6" />
  </Icon>
);

/** `data-arrow` é o gancho que faz a seta deslizar no hover do botão. */
export const ArrowRightIcon = (p: IconProps) => (
  <Icon data-arrow {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);

export const ExpandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.5" r="3.25" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5.5v13M15 5.5v13" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

/** WhatsApp é marca: o traço é preenchido, não contornado. */
export const WhatsAppIcon = ({ className, ...p }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={cn(
      "shrink-0",
      !(className && /(^|\s)(size-|h-|w-)\S/.test(className)) && "size-[1.125em]",
      className
    )}
    {...p}
  >
    <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.9 9.9 0 0 0 4.84 1.24h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.88 9.88 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.1.81.83-3.02-.2-.31a8.24 8.24 0 0 1 1.28-10.4 8.19 8.19 0 0 1 11.6 0 8.2 8.2 0 0 1-5.9 14.25Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.1-.5.11-.12.25-.29.37-.44.13-.15.17-.25.25-.42.09-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31s-.86.84-.86 2.05.88 2.38 1 2.54c.12.17 1.73 2.64 4.2 3.7.58.26 1.04.4 1.4.51.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
  </svg>
);
