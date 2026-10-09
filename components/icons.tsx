import React from "react";

type IconProps = { size?: number; className?: string };

const base = (size = 18): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const IconPlay = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.79-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
  </svg>
);

export const IconPause = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4" height="15" rx="1.4" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.4" />
  </svg>
);

export const IconNext = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M6 5.5v13a1 1 0 0 0 1.55.83L16 13.9v4.6a1 1 0 0 0 2 0v-13a1 1 0 0 0-2 0v4.6L7.55 4.67A1 1 0 0 0 6 5.5Z" />
  </svg>
);

export const IconPrev = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M18 5.5v13a1 1 0 0 1-1.55.83L8 13.9v4.6a1 1 0 0 1-2 0v-13a1 1 0 0 1 2 0v4.6l8.45-5.43A1 1 0 0 1 18 5.5Z" />
  </svg>
);

export const IconVolume = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

export const IconMute = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);

export const IconMusic = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

export const IconVideo = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5.5" width="14" height="13" rx="2.5" />
    <path d="m16.5 10.5 5-3v9l-5-3" />
  </svg>
);

export const IconUpload = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconDownload = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconMail = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

export const IconUser = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const IconUsers = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.3" />
    <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16 5.3a3.3 3.3 0 0 1 0 6.4M17.6 14.4A6.2 6.2 0 0 1 21.2 20" />
  </svg>
);

export const IconCart = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 4h2.2l2 11.2a1.8 1.8 0 0 0 1.8 1.5h7.9a1.8 1.8 0 0 0 1.8-1.4L21 8H6" />
    <circle cx="10" cy="20" r="1.3" />
    <circle cx="18" cy="20" r="1.3" />
  </svg>
);

export const IconGrid = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </svg>
);

export const IconSettings = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.93-1.16l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.16-2.93l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.93 1.16l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 20.4 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5.5Z" />
  </svg>
);

export const IconSearch = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconMenu = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconClose = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconCheck = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconTrash = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.9 12.1A1.6 1.6 0 0 0 9 20.6h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7" />
  </svg>
);

export const IconExternal = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
  </svg>
);

export const IconShield = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.2 5 6v6c0 4.2 2.9 7.6 7 8.8 4.1-1.2 7-4.6 7-8.8V6l-7-2.8Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const IconBolt = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13L13.5 3Z" />
  </svg>
);

export const IconPhone = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
    <path d="M11 18.6h2" />
  </svg>
);

export const IconBank = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 9.5 12 4.5l8.5 5M5 10v8.5M9.5 10v8.5M14.5 10v8.5M19 10v8.5M3.5 20h17" />
  </svg>
);

export const IconCard = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.4" />
    <path d="M2.5 10h19M6 15h4" />
  </svg>
);

export const IconClock = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconLogo = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="currentColor" opacity="0.16" />
    <g fill="currentColor">
      <rect x="9.5" y="17" width="3.4" height="7" rx="1.7" />
      <rect x="15.2" y="12.5" width="3.4" height="16" rx="1.7" />
      <rect x="20.9" y="8.5" width="3.4" height="23" rx="1.7" />
      <rect x="26.6" y="15" width="3.4" height="11" rx="1.7" />
    </g>
  </svg>
);
