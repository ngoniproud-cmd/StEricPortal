/** Brand tokens. Navy + gold suit a formal school identity; swap for the school's crest colours if different. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      navy: { 50:"#f2f5fa",100:"#e3e9f3",200:"#c4d0e4",300:"#93a8cb",500:"#3b5b93",600:"#25457a",700:"#1a3563",800:"#12284c",900:"#0c1c37" },
      gold: { 100:"#f7efd9",300:"#e0c47a",500:"#b8923a",600:"#9a7828" },
      ink: "#1b2333", mute: "#5b6577", line: "#e3e7ee", paper: "#f6f8fb",
    },
    fontFamily: { sans: ["Inter","system-ui","Segoe UI","Roboto","sans-serif"], display: ["Fraunces","Georgia","serif"] },
    boxShadow: { card: "0 1px 2px rgba(18,40,76,.06), 0 4px 16px rgba(18,40,76,.06)" },
    borderRadius: { xl: "14px" },
  } },
  plugins: [],
};
