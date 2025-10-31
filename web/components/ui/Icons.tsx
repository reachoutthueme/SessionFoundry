import React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function svg(p: IconProps, path: React.ReactNode) {
  const { size = 18, className = "", ...rest } = p;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block align-middle ${className}`}
      style={{ overflow: 'visible' }}
      {...rest}
    >
      {path}
    </svg>
  );
}

export const IconAnvil = (p: IconProps) => svg(p, (
  <>
    <path d="M3 20h18"/>
    <path d="M6 16h6a6 6 0 0 0 6-6V7h-6l-2-2H4v2h4v3a4 4 0 0 1-4 4H3"/>
  </>
));

// Stylized foundry/crucible icon
export const IconFoundry = (p: IconProps) => svg({ ...p }, (
  <g fill="currentColor" stroke="none">
    {/* Heads */}
    <circle cx="8" cy="6" r="2.2" />
    <circle cx="16" cy="6" r="2.2" />

    {/* Rounded interlocking arms (diagonal pills) */}
    <rect x="4.8" y="9.2" width="8" height="4.2" rx="2.1" transform="rotate(-45 8.8 11.3)" />
    <rect x="11.2" y="10.8" width="8" height="4.2" rx="2.1" transform="rotate(45 15.2 12.9)" />

    {/* Diamond */}
    <rect x="10.5" y="14" width="5" height="5" transform="rotate(45 13 16.5)" />

    {/* Triangle */}
    <polygon points="17,18 21,18 19,21" />
  </g>
));

export const IconDashboard = (p: IconProps) => svg(p, (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>));
export const IconSessions  = (p: IconProps) => svg(p, (<><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/></>));
export const IconTemplates = (p: IconProps) => svg(p, (<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></>));
export const IconSettings  = (p: IconProps) => svg(p, (<><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6c.7 0 1.3-.4 1.51-1V3a2 2 0 1 1 4 0v.09c.08.6.47 1.1 1.02 1.36.55.26 1.2.17 1.66-.23l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.4.46-.49 1.11-.23 1.66.26.55.77.94 1.36 1.02H21a2 2 0 1 1 0 4h-.09c-.6.08-1.1.47-1.36 1.02Z"/></>));
export const IconHelp      = (p: IconProps) => svg(p, (<><path d="M9 9a3 3 0 1 1 5.24 2c-.66.5-1.24.94-1.24 2"/><line x1="12" y1="17" x2="12" y2="17"/></>));

export const IconVote     = (p: IconProps) => svg(p, (<><path d="M9 12l2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2"/></>));
export const IconResults  = (p: IconProps) => svg(p, (<><path d="M3 3v18"/><path d="M7 13h3v8H7z"/><path d="M12 9h3v12h-3z"/><path d="M17 5h3v16h-3z"/></>));
export const IconGroup    = (p: IconProps) => svg(p, (<><circle cx="9" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M10 21a7 7 0 0 1 12 0"/></>));
export const IconBrain    = (p: IconProps) => svg(p, (<><path d="M8 2a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4"/><path d="M16 2a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4"/><path d="M12 8v8"/></>));
export const IconList     = (p: IconProps) => svg(p, (<><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></>));
export const IconTimer    = (p: IconProps) => svg(p, (<><circle cx="12" cy="14" r="8"/><path d="M12 9v5l3 3"/><path d="M9 2h6"/></>));
export const IconTrophy   = (p: IconProps) => svg(p, (<><path d="M8 21h8"/><path d="M12 17v4"/><path d="M17 5h3a3 3 0 0 1-3 3"/><path d="M7 5H4a3 3 0 0 0 3 3"/><rect x="7" y="2" width="10" height="12" rx="5"/></>));

export const IconLock     = (p: IconProps) => svg(p, (<><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>));
export const IconShield   = (p: IconProps) => svg(p, (<>
  <path d="M12 3l7 4v5a9 9 0 0 1-7 8 9 9 0 0 1-7-8V7l7-4z"/>
 </>));

export const IconSun = (p: IconProps) => svg(p, (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" /><path d="M12 20v2" />
    <path d="M4.9 4.9l1.4 1.4" />
    <path d="M17.7 17.7l1.4 1.4" />
    <path d="M2 12h2" /><path d="M20 12h2" />
    <path d="M4.9 19.1l1.4-1.4" />
    <path d="M17.7 6.3l1.4-1.4" />
  </>
));

export const IconMoon = (p: IconProps) => svg(p, (
  <>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
  </>
));

export default {
  IconAnvil,
  IconFoundry,
  IconDashboard,
  IconSessions,
  IconTemplates,
  IconSettings,
  IconHelp,
  IconVote,
  IconResults,
  IconGroup,
  IconBrain,
  IconList,
  IconTimer,
  IconTrophy,
  IconLock,
  IconShield,
  IconSun,
  IconMoon,
};

export const IconChevronLeft = (p: IconProps) => svg(p, (<><path d="M15 18l-6-6 6-6"/></>));
export const IconChevronRight = (p: IconProps) => svg(p, (<><path d="M9 6l6 6-6 6"/></>));
export const IconCopy = (p: IconProps) => svg(p, (<>
  <rect x="9" y="9" width="13" height="13" rx="2" />
  <rect x="2" y="2" width="13" height="13" rx="2" />
</>));
export const IconCheck = (p: IconProps) => svg(p, (<><path d="M20 6L9 17l-5-5"/></>));
export const IconX = (p: IconProps) => svg(p, (<><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>));
