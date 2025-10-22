/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zama: {
          primary: "#6366f1", // 紫蓝色主色调（Zama 科技感）
          secondary: "#8b5cf6", // 辅助紫粉色
          dark: "#1e1b4b", // 深色背景
          card: "#312e81", // 卡片背景
        },
      },
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};