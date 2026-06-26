import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange:      "#E05728",
          "orange-dk": "#C44A1F",
          "orange-lt": "#F9EDE8",
          teal:        "#2BB8B8",
          "teal-dk":   "#1E9090",
          "teal-lt":   "#E6F7F7",
          navy:        "#1A3347",
          "navy-lt":   "#2A4A63",
          "navy-xs":   "#EBF0F5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
