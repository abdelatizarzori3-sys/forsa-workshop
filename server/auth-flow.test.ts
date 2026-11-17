import { createServer, type Server } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { createApp } from "./app";
import { MemoryRepository } from "./test-support";
const cfg={projectId:"test-auth-project",secret:"test-only-auth-secret-with-enough-bytes",portalUrl:"https://manus.im",apiUrl:"https://api.manus.im"};
const instances:Server[]=[];
afterEach(async()=>{for(const server of instances.splice(0)){server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}});
async function serve(app:ReturnType<typeof createApp>){const server=createServer(app);instances.push(server);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));return "http://127.0.0.1:"+(server.address() as {port:number}).port;}
it("OAuth browser binding, successful exchange and one-use durable nonce survive an instance switch",async()=>{
 const now=new Date("2026-11-17T00:00:00Z"),repo=new MemoryRepository(()=>now);
 const fetcher=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
  const request=JSON.parse(String(init?.body));
  if(String(url).endsWith("/ExchangeToken")){expect(request).toMatchObject({clientId:cfg.projectId,grantType:"authorization_code",code:"test-code",redirectUri:"https://forsa.manus.space/api/auth/callback"});return new Response(JSON.stringify({accessToken:"test-access-token"}),{headers:{"Content-Type":"application/json"}});}
  expect(request.accessToken).toBe("test-access-token");return new Response(JSON.stringify({openId:"test-real-flow-identity",name:"هوية اختبار",email:""}),{headers:{"Content-Type":"application/json"}});
 }) as unknown as typeof fetch;
 const first=await serve(createApp({repository:repo,authConfig:cfg,now:()=>now,fetcher}));
 const response=await fetch(first+"/api/auth/login?origin="+encodeURIComponent("https://forsa.manus.space"));expect(response.status).toBe(200);
 const cookie=response.headers.get("set-cookie")!.split(";")[0],url=new URL((await response.json()).url),state=url.searchParams.get("state")!;
 const second=await serve(createApp({repository:repo,authConfig:cfg,now:()=>now,fetcher}));
 const callback=second+"/api/auth/callback?state="+encodeURIComponent(state)+"&code=test-code";
 const success=await fetch(callback,{headers:{Cookie:cookie},redirect:"manual"});expect(success.status).toBe(302);expect(success.headers.get("location")).toBe("/workspace");
 const all=success.headers.get("set-cookie")!;expect(all).toContain("webdev_app_session=");expect(all).toContain("SameSite=None");expect(all).toContain("Secure");
 const session=all.match(/webdev_app_session=([^; ,]+)/)![1];const verified=await jwtVerify(session,new TextEncoder().encode(cfg.secret),{algorithms:["HS256"],currentDate:now});expect(verified.payload.appId).toBe(cfg.projectId);expect(verified.payload.openId).toBe("test-real-flow-identity");
 expect(repo.nonces.size).toBe(0);expect((await fetch(callback,{headers:{Cookie:cookie},redirect:"manual"})).status).toBe(400);expect(fetcher).toHaveBeenCalledTimes(2);
},15000);
