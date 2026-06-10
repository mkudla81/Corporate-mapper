import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d6ecdf",
          500: "#2f7d52",
          600: "#26683f",
          700: "#1e5434",
          900: "#12331f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
