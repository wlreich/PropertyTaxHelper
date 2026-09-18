import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSuggestion } from '../src/lib/suggestion-request.ts';
const draft={submissionId:'11111111-1111-4111-8111-111111111111',category:'metric',message:'  Compare values across my neighborhood.  ',website:''};
const request=(body=draft,headers={})=>new Request('https://parcelsavvy.org/api/suggestions',{method:'POST',headers:{origin:'https://parcelsavvy.org','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
test('only acknowledges durable saves; trims content and safely reports failures',async()=>{
 let saved;
 const response=await handleSuggestion(request(),async value=>{saved=value;});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
 assert.deepEqual(saved,{submissionId:draft.submissionId,category:'metric',message:draft.message.trim()});
 assert.equal(response.headers.get('cache-control'),'no-store');
 const failure=await handleSuggestion(request(),async()=>{throw Error('private database details');});
 assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private database details/);
});
test('rejects cross-origin, malformed and unbounded inputs without writing',async()=>{
 let writes=0;const save=async()=>{writes++;};
 for(const [req,status] of [
  [request(draft,{origin:'https://other.test'}),403],[request(draft,{origin:''}),403],
  [request(draft,{'content-type':'text/plain'}),415],[request('{bad'),400],
  [request({...draft,message:'short'}),400],[request({...draft,message:'x'.repeat(2001)}),400],
  [request({...draft,category:'admin'}),400],[request({...draft,category:{toString:'feature'}}),400],[request({...draft,submissionId:'bad'}),400],
  [request({...draft,message:'bad\u0000characters'}),400],
  [request({...draft,message:'x'.repeat(9000)},{'content-length':'1'}),413],
 ]) assert.equal((await handleSuggestion(req,save)).status,status);
 assert.equal(writes,0);
 assert.equal((await handleSuggestion(request({...draft,website:'spam.test'}),save)).status,200);
 assert.equal(writes,0);
});

test('uses the incoming Host behind a proxy, without trusting arbitrary forwarded hosts',async()=>{
 let writes=0;const save=async()=>{writes++;};
 const proxied=new Request('http://internal:3000/api/suggestions',{method:'POST',headers:{origin:'https://parcelsavvy.org',host:'parcelsavvy.org','content-type':'application/json'},body:JSON.stringify(draft)});
 assert.equal((await handleSuggestion(proxied,save)).status,200);
 for(const headers of [
  {origin:'https://other.test',host:'parcelsavvy.org','x-forwarded-host':'other.test'},
  {origin:'http://parcelsavvy.org',host:'parcelsavvy.org'},
  {origin:'null',host:'parcelsavvy.org'},
 ]) assert.equal((await handleSuggestion(request(draft,headers),save)).status,403);
 assert.equal(writes,1);
});
