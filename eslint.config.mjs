import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".claude/**", "demo-video/**"] },
  ...coreWebVitals,
];

export default eslintConfig;
