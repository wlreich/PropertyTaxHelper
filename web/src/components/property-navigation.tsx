export function PropertyNavigation() {
  return (
    <nav className="property-navigation" aria-label="Property tools">
      <ul>
        <li><span className="property-navigation-item" aria-current="page">Overview</span></li>
        {["Compare properties", "Neighborhood", "Protest guide"].map(label => (
          <li key={label}>
            <span className="property-navigation-item" aria-disabled="true">
              <span>{label}</span>
              <span className="property-navigation-status">Coming soon</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
