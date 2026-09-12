import Link from "next/link";
export function PropertyNavigation({propertyId,active="overview"}:{propertyId:string;active?:"overview"|"compare"}) {
  return (
    <nav className="property-navigation" aria-label="Property tools">
      <ul>
        {([{key:"overview",label:"Overview",href:`/property/${propertyId}`},{key:"compare",label:"Compare properties",href:`/property/${propertyId}/compare`}] as const).map(item=>(
          <li key={item.key}><Link className="property-navigation-item" href={item.href} aria-current={active===item.key?"page":undefined}>{item.label}</Link></li>
        ))}
        {["Neighborhood", "Protest guide"].map(label => (
          <li key={label}><span className="property-navigation-item" aria-disabled="true"><span>{label}</span><span className="property-navigation-status">Coming soon</span></span></li>
        ))}
      </ul>
    </nav>
  );
}
