/** Inline SVG ikony (Feather styl) — jediný zdroj ikon pro celou aplikaci. */

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

/** Ikona modulu podle klíče z registru. */
export function moduleIcon(icon: 'users' | 'check' | 'briefcase' | 'trend') {
  switch (icon) {
    case 'users':
      return <IconUsers />;
    case 'check':
      return <IconCheck />;
    case 'briefcase':
      return <IconBriefcase />;
    case 'trend':
      return <IconTrend />;
  }
}
