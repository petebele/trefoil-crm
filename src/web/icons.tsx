/**
 * Inline SVG ikony — jediný zdroj ikon pro celou aplikaci. Styl Feather / **Lucide**
 * (lucide.dev, licence ISC; Lucide je udržovaný nástupce Featheru, sdílí stejné cesty).
 * Bez závislosti a bez extra requestu. Nové ikony ber z Lucide a přidávej sem.
 */

type IconProps = { size?: number };

function Svg(props: { size?: number; children: unknown }) {
  const s = props.size ?? 20;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export const IconHome = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
);

export const IconUsers = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const IconCheck = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Svg>
);

/** Prostá fajfka (Lucide „check") — primární akce „Schválit". */
export const IconCheckPlain = (p: IconProps = {}) => (
  <Svg size={p.size ?? 16}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const IconBriefcase = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </Svg>
);

export const IconTrend = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </Svg>
);

export const IconLayers = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Svg>
);

export const IconClock = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Svg>
);

export const IconSliders = (p: IconProps = {}) => (
  <Svg size={p.size}>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </Svg>
);

export const IconSearch = (p: IconProps = {}) => (
  <Svg size={p.size ?? 16}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

export const IconPlus = (p: IconProps = {}) => (
  <Svg size={p.size ?? 14}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const IconChevron = (p: IconProps = {}) => (
  <Svg size={p.size ?? 14}>
    <polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const IconPhone = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

export const IconMail = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </Svg>
);

export const IconGlobe = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Svg>
);

export const IconTag = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </Svg>
);

export const IconPencil = (p: IconProps = {}) => (
  <Svg size={p.size ?? 14}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

// ---- Lucide (lucide.dev, ISC) — rozšíření sady; stejný 24×24 stroke styl jako výše ----

export const IconChevronUp = (p: IconProps = {}) => (
  <Svg size={p.size ?? 14}>
    <polyline points="18 15 12 9 6 15" />
  </Svg>
);

export const IconChevronLeft = (p: IconProps = {}) => (
  <Svg size={p.size ?? 14}>
    <polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const IconChevronRight = (p: IconProps = {}) => (
  <Svg size={p.size ?? 14}>
    <polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const IconX = (p: IconProps = {}) => (
  <Svg size={p.size ?? 16}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const IconMore = (p: IconProps = {}) => (
  <Svg size={p.size ?? 18}>
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
    <circle cx="5" cy="12" r="1.4" />
  </Svg>
);

export const IconGrip = (p: IconProps = {}) => (
  <Svg size={p.size ?? 16}>
    <circle cx="9" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="18" r="1" />
  </Svg>
);

export const IconTrash = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </Svg>
);

export const IconCalendar = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

export const IconFileText = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </Svg>
);

export const IconMessage = (p: IconProps = {}) => (
  <Svg size={p.size ?? 15}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);

// přepínač zobrazení poznámek (Lucide): rows-3 = jednosloupcový design, layout-dashboard = víc sloupců
export const IconRows3 = (p: IconProps = {}) => (
  <Svg size={p.size ?? 18}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </Svg>
);

export const IconLayoutDashboard = (p: IconProps = {}) => (
  <Svg size={p.size ?? 18}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </Svg>
);

/** Ikona modulu podle klíče z registru. */
export function moduleIcon(icon: 'users' | 'check' | 'briefcase' | 'trend' | 'layers' | 'clock') {
  switch (icon) {
    case 'users':
      return <IconUsers />;
    case 'check':
      return <IconCheck />;
    case 'briefcase':
      return <IconBriefcase />;
    case 'trend':
      return <IconTrend />;
    case 'layers':
      return <IconLayers />;
    case 'clock':
      return <IconClock />;
  }
}
