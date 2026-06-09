/**
 * Individual app icons extracted from /public/app icons svg.svg
 * Each uses a cropped viewBox matching its position in the 1600×1000 sprite.
 */

function Icon({ children, viewBox, size = 56 }: {
  children: React.ReactNode;
  viewBox: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function StockPulseIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="90 100 310 310" size={size}>
      <defs>
        <linearGradient id="sp-bg" x1="90" y1="100" x2="400" y2="410">
          <stop stopColor="#F0EBFF"/><stop offset="1" stopColor="#F8F5FF"/>
        </linearGradient>
      </defs>
      <rect x="90" y="100" width="310" height="310" rx="44" fill="url(#sp-bg)"/>
      <path d="M173 229L263 178L350 221L262 274L173 229Z" fill="#8D75F4"/>
      <path d="M173 229V322L262 375V274L173 229Z" fill="#4B2BD6"/>
      <path d="M262 274L350 221V313L262 375V274Z" fill="#6F55E8"/>
      <path d="M214 206L305 252" stroke="#FFF" strokeWidth="14" strokeLinecap="round"/>
      <path d="M262 274V375" stroke="#FFF" strokeWidth="10" opacity=".9"/>
    </Icon>
  );
}

export function WasteLogIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="495 100 310 310" size={size}>
      <defs>
        <linearGradient id="wl-bg" x1="495" y1="100" x2="805" y2="410">
          <stop stopColor="#E8FAF8"/><stop offset="1" stopColor="#F3FFFC"/>
        </linearGradient>
      </defs>
      <rect x="495" y="100" width="310" height="310" rx="44" fill="url(#wl-bg)"/>
      <path d="M650 203C610 203 578 235 578 275C578 315 610 347 650 347C690 347 722 315 722 275"
        stroke="#086B62" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M650 224V277H695" stroke="#086B62" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M734 224L734 224" stroke="#086B62" strokeWidth="17" strokeLinecap="round"/>
      <path d="M747 264L747 264" stroke="#086B62" strokeWidth="17" strokeLinecap="round"/>
    </Icon>
  );
}

export function MarginViewIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="645 570 310 310" size={size}>
      <defs>
        <linearGradient id="mv-bg" x1="645" y1="570" x2="955" y2="880">
          <stop stopColor="#E8FAEF"/><stop offset="1" stopColor="#F5FFF8"/>
        </linearGradient>
      </defs>
      <rect x="645" y="570" width="310" height="310" rx="44" fill="url(#mv-bg)"/>
      <rect x="706" y="642" width="190" height="190" rx="28" fill="#17A858"/>
      <path d="M801 642V832M706 737H896" stroke="#D9FBE3" strokeWidth="6"/>
      <path d="M735 690H775M755 670V710" stroke="#D9FBE3" strokeWidth="12" strokeLinecap="round"/>
      <path d="M827 690H865" stroke="#D9FBE3" strokeWidth="12" strokeLinecap="round"/>
      <path d="M738 778L772 812M772 778L738 812" stroke="#D9FBE3" strokeWidth="12" strokeLinecap="round"/>
      <path d="M828 786H868M828 812H868" stroke="#D9FBE3" strokeWidth="12" strokeLinecap="round"/>
    </Icon>
  );
}

export function SupplierHubIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="900 100 310 310" size={size}>
      <defs>
        <linearGradient id="sh-bg" x1="900" y1="100" x2="1210" y2="410">
          <stop stopColor="#EAF5FF"/><stop offset="1" stopColor="#F5FBFF"/>
        </linearGradient>
      </defs>
      <rect x="900" y="100" width="310" height="310" rx="44" fill="url(#sh-bg)"/>
      <circle cx="1055" cy="275" r="43" fill="#1167D8"/>
      <circle cx="990"  cy="325" r="35" fill="#1167D8"/>
      <circle cx="1120" cy="325" r="35" fill="#1167D8"/>
      <circle cx="1055" cy="188" r="35" fill="#1167D8"/>
      <path d="M1055 232V275M1021 300L990 325M1089 300L1120 325"
        stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="1055" cy="179" r="13" fill="#FFF"/>
      <circle cx="990"  cy="316" r="11" fill="#FFF"/>
      <circle cx="1120" cy="316" r="11" fill="#FFF"/>
    </Icon>
  );
}

export function ShiftBoardIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="1305 100 310 310" size={size}>
      <defs>
        <linearGradient id="sb-bg" x1="1305" y1="100" x2="1615" y2="410">
          <stop stopColor="#FFF1E2"/><stop offset="1" stopColor="#FFF8EF"/>
        </linearGradient>
      </defs>
      <rect x="1305" y="100" width="310" height="310" rx="44" fill="url(#sb-bg)"/>
      <rect x="1381" y="185" width="160" height="165" rx="24" fill="#FFF9F1" stroke="#F46A00" strokeWidth="10"/>
      <path d="M1381 228H1541" stroke="#F46A00" strokeWidth="22"/>
      <path d="M1414 176V215M1508 176V215" stroke="#F46A00" strokeWidth="15" strokeLinecap="round"/>
      <circle cx="1424" cy="266" r="9" fill="#F89718"/>
      <circle cx="1462" cy="266" r="9" fill="#F89718"/>
      <circle cx="1500" cy="266" r="9" fill="#F89718"/>
      <circle cx="1424" cy="304" r="9" fill="#F89718"/>
      <circle cx="1462" cy="304" r="9" fill="#F89718"/>
      <circle cx="1546" cy="338" r="43" fill="#F46A00"/>
      <path d="M1525 337L1540 352L1570 319" stroke="#FFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    </Icon>
  );
}

export function OrderFlowIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="210 570 310 310" size={size}>
      <defs>
        <linearGradient id="of-bg" x1="210" y1="570" x2="520" y2="880">
          <stop stopColor="#FFEAF0"/><stop offset="1" stopColor="#FFF6F8"/>
        </linearGradient>
      </defs>
      <rect x="210" y="570" width="310" height="310" rx="44" fill="url(#of-bg)"/>
      <path d="M287 672H315L333 760H454L433 813H334L310 700H287V672Z" fill="#CB1552"/>
      <circle cx="350" cy="835" r="15" fill="#CB1552"/>
      <circle cx="425" cy="835" r="15" fill="#CB1552"/>
      <circle cx="453" cy="779" r="39" fill="#CB1552"/>
      <path d="M434 778L449 793L476 761" stroke="#FFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
    </Icon>
  );
}

export function ReportGenIcon({ size = 56 }: { size?: number }) {
  return (
    <Icon viewBox="1080 570 310 310" size={size}>
      <defs>
        <linearGradient id="rg-bg" x1="1080" y1="570" x2="1390" y2="880">
          <stop stopColor="#FFF7D8"/><stop offset="1" stopColor="#FFFBEA"/>
        </linearGradient>
      </defs>
      <rect x="1080" y="570" width="310" height="310" rx="44" fill="url(#rg-bg)"/>
      <rect x="1144" y="646" width="190" height="160" rx="20" fill="#FFFDF5"/>
      <path d="M1205 694V648A49 49 0 1 0 1240 733L1205 694Z" fill="#E6A800"/>
      <path d="M1214 648V685H1252" stroke="#FFFDF5" strokeWidth="8"/>
      <rect x="1190" y="760" width="26" height="35" rx="5" fill="#E6A800"/>
      <rect x="1235" y="735" width="26" height="60" rx="5" fill="#E6A800"/>
      <rect x="1280" y="705" width="26" height="90" rx="5" fill="#E6A800"/>
    </Icon>
  );
}
