import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [dts({ rollupTypes: true })],
    build: {
        lib: {
            entry: {
                staroverlay: "src/index.ts",
                tmi: "src/addons/tmi.ts"
            },
            formats: ["es"]
        },
        outDir: "dist",
        emptyOutDir: false
    }
});