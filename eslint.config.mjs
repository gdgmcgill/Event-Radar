import coreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".claude/**", ".next/**", "AI/**", "node_modules/**"] },
  ...coreWebVitals,
];

export default eslintConfig;
