import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
const testUrl=process.env.TEST_DATABASE_URL;
if(!testUrl || !new URL(testUrl).pathname.includes("test")) throw new Error("Browser tests require a dedicated TEST_DATABASE_URL; production is never used.");
process.env.DATABASE_URL=testUrl;
process.env.DIRECT_URL=testUrl;
export default defineConfig({testDir:"tests/e2e",fullyParallel:false,workers:1,timeout:60000,expect:{timeout:12000},reporter:[["list"],["html",{open:"never"}]],globalSetup:"./tests/e2e/setup.ts",use:{baseURL:"http://localhost:3000",trace:"retain-on-failure",screenshot:"only-on-failure",launchOptions:process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}},projects:[{name:"mobile-chromium",use:{...devices["Pixel 7"],defaultBrowserType:"chromium"}}],webServer:{command:"npm run dev -- --hostname 127.0.0.1",url:"http://localhost:3000",reuseExistingServer:false,timeout:120000,env:{DATABASE_URL:testUrl,DIRECT_URL:testUrl,APP_URL:"http://localhost:3000"}}});
