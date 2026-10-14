// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// GitHub Pages(프로젝트 페이지)는 /<저장소명>/ 아래에서 서비스된다. Actions에서 SITE/BASE_PATH로 넘긴다.
export default defineConfig({
  site: process.env.SITE,
  base: process.env.BASE_PATH ?? "/",
  integrations: [react()],
});
