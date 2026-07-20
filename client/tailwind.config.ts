import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // CSS variable mapping for dynamic design token configuration
                primary: {
                    DEFAULT: 'var(--color-primary, #006533)',
                    light: 'var(--color-primary-light, #008040)',
                    dark: 'var(--color-primary-dark, #004d26)',
                },
                nounGreen: {
                    DEFAULT: 'var(--color-primary, #006533)',
                    light: 'var(--color-primary-light, #008040)',
                    dark: 'var(--color-primary-dark, #004d26)',
                },
                secondary: {
                    DEFAULT: 'var(--color-secondary, #FFCD00)',
                    light: 'var(--color-secondary-light, #FFE066)',
                    dark: 'var(--color-secondary-dark, #CC9E00)',
                },
                accent: {
                    DEFAULT: 'var(--color-accent, #E31B23)',
                },
                surface: {
                    DEFAULT: 'var(--color-surface, #FFFFFF)',
                    alt: 'var(--color-surface-alt, #F8FAFC)',
                }
            },
        },
    },
    plugins: [],
};
export default config;
