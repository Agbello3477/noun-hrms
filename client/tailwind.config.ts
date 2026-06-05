import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                nounGreen: '#006533', // Official Dark Green
                nounRed: '#E31B23',   // Official Red
                nounGold: '#FFCD00',  // Official Yellow/Gold
                // Map to semantic names for easier use
                primary: '#006533',
                secondary: '#E31B23',
            },
        },
    },
    plugins: [],
};
export default config;
