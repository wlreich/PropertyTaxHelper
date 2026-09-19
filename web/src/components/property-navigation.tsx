import Link from "next/link";
export function PropertyNavigation({propertyId,active="overview"}:{propertyId:string;active?:"overview"|"compare"|"neighborhood"}) {
  return (
    <nav className="property-navigation" aria-label="Property tools">
      <ul>
        {([{key:"overview",label:"Overview",href:`/property/${propertyId}`},{key:"compare",label:"Compare properties",href:`/property/${propertyId}/compare`},{key:"neighborhood",label:"Neighborhood",href:`/property/${propertyId}/neighborhood`},{key:"guide",label:"Protest Guide",href:`/protest-guide?property=${encodeURIComponent(propertyId)}`}] as const).map(item=>(
          <li key={item.key}><Link className="property-navigation-item" href={item.href} aria-current={active===item.key?"page":undefined}>{item.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
