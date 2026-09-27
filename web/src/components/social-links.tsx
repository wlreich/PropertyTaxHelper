type SocialLinksProps = {
  className?: string;
  as?: "nav" | "div";
  variant?: "labeled" | "icon-only";
};

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        fill="currentColor"
        d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.3v3h2.8v8h3.4Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

const socialAccounts = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/parcelsavvy",
    icon: <FacebookIcon />,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/parcelsavvy/",
    icon: <InstagramIcon />,
  },
];

export function SocialLinks({
  className,
  as: Container = "nav",
  variant = "labeled",
}: SocialLinksProps) {
  return (
    <Container
      aria-label="Follow ParcelSavvy"
      className={["social-links", `social-links-${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      role={Container === "div" ? "group" : undefined}
    >
      {socialAccounts.map(({ name, href, icon }) => (
        <a
          key={name}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} (opens in a new tab)`}
        >
          {icon}
          <span className="social-links-label">{name}</span>
          <span className="social-links-external" aria-hidden="true">↗</span>
        </a>
      ))}
    </Container>
  );
}
