// Bloqueio por dispositivo (decisão 9 do ciclo): roda contra o wpda de dev.
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.WPDA_URL ?? "http://curitiba.localhost:5176";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL, trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "ipad", use: { ...devices["iPad Pro 11"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } }
  ]
});
