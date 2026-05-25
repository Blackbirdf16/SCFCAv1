module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI Variable",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      colors: {
        // Keep existing class names (bg-dark, bg-dark-panel, bg-dark-card, bg-gold)
        // but map them to CSS variables controlled by the authenticated role.
        gold: "var(--scfca-accent)",
        dark: "var(--scfca-bg)",
        "dark-panel": "var(--scfca-panel)",
        "dark-card": "var(--scfca-card)"
      }
    }
  },
  plugins: []
};
