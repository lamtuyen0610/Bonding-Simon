/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    // Ghi đè toàn bộ thang bo góc mặc định để mọi thứ (card, nút, input...) trở nên
    // sắc cạnh, vuông vức — đúng tinh thần "hồ sơ giấy / terminal điều tra", không
    // bo tròn mềm mại kiểu app tiêu dùng thông thường.
    borderRadius: {
      none: "0px",
      sm: "0px",
      DEFAULT: "0px",
      md: "0px",
      lg: "2px",
      xl: "2px",
      "2xl": "2px",
      "3xl": "2px",
      full: "9999px",
    },
    extend: {
      colors: {
        ink: "#0a0a09",
        panel: "#161513",
        // "The Burn" — màu nhấn chính: cam cháy/đất nung, dùng cho hành động, cảnh báo, điểm nhấn.
        purple: {
          DEFAULT: "#B5502A",
          soft: "#E08A5C",
        },
        // "The Terminal" — xanh thép lạnh, dùng cho trạng thái xác thực/đã kiểm chứng.
        turquoise: {
          DEFAULT: "#7C97A0",
          soft: "#AEC3C9",
        },
        paper: "#DAD5C9",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        card: "2px 2px 0 rgba(0,0,0,0.4)",
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};
