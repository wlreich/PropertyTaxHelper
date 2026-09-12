import { getComparisons } from "@/lib/supabase/comparisons";
export const maxDuration=30;
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params,url=new URL(request.url);
  const result=await getComparisons(id,url.searchParams.get("source"),[],url.searchParams.get("q")??"",Number(url.searchParams.get("page")??0));
  return Response.json(result,{status:result.status==="ok"?200:result.status==="invalid"?400:result.status==="not_found"?404:503,headers:{"Cache-Control":"no-store"}});
}
